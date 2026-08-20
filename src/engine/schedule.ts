import type {
  DurationsConfig, Practice, Scale, ScheduledTask, TaskDef,
} from "../domain/types";
import { TASKS } from "../domain/tasks";

/* ----------------------------- date utils ----------------------------- */

export const DAY = 86400000;

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}
export function today(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}
export function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export function isMonday(d: Date): boolean {
  return d.getDay() === 1;
}
export function nextMonday(d: Date): Date {
  const shift = (8 - d.getDay()) % 7 || 7;
  return addDays(d, shift === 7 && d.getDay() === 1 ? 0 : shift);
}
export function tLabel(offset: number): string {
  if (offset === 0) return "T-0";
  return offset > 0 ? `T-${offset}` : `T+${-offset}`;
}
export function tWeekLabel(week: number): string {
  if (week === 0) return "T-0 · go-live week";
  return week > 0 ? `T-${week}` : `T+${-week}`;
}

/* --------------------------- duration model --------------------------- */

export function taskDuration(t: TaskDef, scale: Scale, durations: DurationsConfig): number {
  if (t.days != null && !t.durKey) return t.days;
  const spec = durations[t.durKey ?? "defaultTask"] ?? durations.defaultTask;
  let d = spec.baseDays;
  if (spec.perUnit && spec.scalesWith) d += spec.perUnit * scale[spec.scalesWith];
  return Math.max(1, Math.round(d));
}

/* ------------------------------ scheduler ------------------------------ */

export interface PlanResult {
  tasks: ScheduledTask[];
  /** Days of runway the plan needs before go-live. */
  requiredRunway: number;
  /** Days actually available between today and go-live. */
  runwayAvailable: number;
  /** Positive = the requested date is short by this many days. */
  shortBy: number;
  feasible: boolean;
  earliestGoLive: Date;
  kickoff: Date;
  goLive: Date;
  /** Latest task end after go-live (stabilization tail), days after go-live. */
  tailDays: number;
  /** Task ids left unchained (anchored to T-week target only). */
  unchained: string[];
}

/**
 * Work-back scheduler.
 *
 * Everything is computed in offset space: days BEFORE go-live (larger =
 * earlier). Each task must be done by its playbook T-week target; predecessor
 * relationships can pull a task's deadline earlier than its target when a
 * downstream chain needs the time. The critical path is the binding chain
 * that sets the total runway — computed from the dependency graph, not from
 * a manual flag.
 */
export function computePlan(practice: Practice, durations: DurationsConfig, asOf: Date = today()): PlanResult {
  const { dispositions, scale, goLive, taskStatus } = practice;
  const goLiveDate = parseISO(goLive);

  const inScope = TASKS.filter((t) => t.when(dispositions));
  const byId = new Map(inScope.map((t) => [t.id, t]));

  // successors[predId] = ids of in-scope tasks depending on pred
  const successors = new Map<string, string[]>();
  for (const t of inScope) {
    for (const dep of t.deps ?? []) {
      if (!byId.has(dep)) continue; // predecessor filtered out of scope
      const arr = successors.get(dep) ?? [];
      arr.push(t.id);
      successors.set(dep, arr);
    }
  }

  const dur = new Map<string, number>();
  for (const t of inScope) {
    const st = taskStatus[t.id];
    dur.set(t.id, st === "done" ? 0 : taskDuration(t, scale, durations));
  }

  const targetEnd = (t: TaskDef) => (t.dueDays != null ? t.dueDays : Math.round(t.dueWeek * 7));

  // Backward pass in reverse topological order (successors resolved first).
  const lateFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (id: string): void => {
    if (lateFinish.has(id)) return;
    if (visiting.has(id)) throw new Error(`Dependency cycle at ${id}`);
    visiting.add(id);
    const t = byId.get(id)!;
    let lf = targetEnd(t);
    for (const sid of successors.get(id) ?? []) {
      resolve(sid);
      lf = Math.max(lf, lateStart.get(sid)!);
    }
    lateFinish.set(id, lf);
    lateStart.set(id, lf + dur.get(id)!);
    visiting.delete(id);
  };
  inScope.forEach((t) => resolve(t.id));

  const requiredRunway = Math.max(0, ...inScope.map((t) => lateStart.get(t.id)!));
  const runwayAvailable = daysBetween(asOf, goLiveDate);
  const shortBy = requiredRunway - runwayAvailable;
  const feasible = shortBy <= 0;

  // Earliest achievable go-live: today + required runway, snapped to a Monday
  // (Friday export → weekend import → Monday open is the fixed cutover pattern).
  const rawEarliest = addDays(asOf, requiredRunway);
  const earliestGoLive = isMonday(rawEarliest) ? rawEarliest : nextMonday(rawEarliest);

  // Critical path: start from the tasks that set the runway, walk the binding
  // dependency edges toward go-live.
  const critical = new Set<string>();
  const queue = inScope.filter((t) => dur.get(t.id)! > 0 && lateStart.get(t.id)! === requiredRunway).map((t) => t.id);
  for (const id of queue) critical.add(id);
  while (queue.length) {
    const id = queue.pop()!;
    for (const sid of successors.get(id) ?? []) {
      if (critical.has(sid)) continue;
      if (lateStart.get(sid)! === lateFinish.get(id)!) {
        critical.add(sid);
        queue.push(sid);
      }
    }
  }

  const tasks: ScheduledTask[] = inScope.map((t) => {
    const endOffset = lateFinish.get(t.id)!;
    const startOffset = lateStart.get(t.id)!;
    return {
      ...t,
      durationDays: dur.get(t.id)! || taskDuration(t, scale, durations),
      startOffset,
      endOffset,
      startDate: addDays(goLiveDate, -startOffset),
      endDate: addDays(goLiveDate, -endOffset),
      critical: critical.has(t.id),
      pulledByDeps: endOffset > targetEnd(t),
      status: taskStatus[t.id] ?? "pending",
    };
  });
  tasks.sort((a, b) => a.endOffset === b.endOffset ? b.startOffset - a.startOffset : b.endOffset - a.endOffset);

  const tailDays = Math.max(0, ...tasks.map((t) => -t.endOffset));
  const unchained = inScope
    .filter((t) => !(t.deps ?? []).some((d) => byId.has(d)) && !(successors.get(t.id) ?? []).length)
    .map((t) => t.id);

  return {
    tasks,
    requiredRunway,
    runwayAvailable,
    shortBy,
    feasible,
    earliestGoLive,
    kickoff: addDays(goLiveDate, -requiredRunway),
    goLive: goLiveDate,
    tailDays,
    unchained,
  };
}

/* ------------------------------ milestones ----------------------------- */

export interface Milestone {
  offset: number;
  date: Date;
  label: string;
  anchor?: boolean;
  done?: boolean;
}

const MILESTONE_DEFS: { id: string; label: string }[] = [
  { id: "DM2", label: "Legacy data access secured" },
  { id: "FX4", label: "Fax port order submitted" },
  { id: "PA4", label: "Sola application sent" },
  { id: "BL3", label: "837 enrollment complete, all payers" },
  { id: "BL4", label: "835 ERA enrollment complete" },
  { id: "CR2", label: "Credentialing approvals in hand" },
  { id: "DM5", label: "Field mapping locked" },
  { id: "EP4", label: "Identity proofing 100% complete" },
  { id: "FX6", label: "Fax number port confirmed" },
  { id: "DM11", label: "Practice sign-off on test migration" },
  { id: "BL15", label: "Test claims accepted end to end" },
  { id: "GL2", label: "Go / no-go call" },
  { id: "DM14", label: "Production export delivered (Friday)" },
  { id: "ST3", label: "First ERA posted and reconciled" },
  { id: "ST5", label: "Transition to standard support" },
];

export function deriveMilestones(plan: PlanResult): Milestone[] {
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const ms: Milestone[] = [];
  for (const def of MILESTONE_DEFS) {
    const t = byId.get(def.id);
    if (t) ms.push({ offset: t.endOffset, date: t.endDate, label: def.label, done: t.status === "done" });
  }
  ms.push({ offset: 0, date: plan.goLive, label: "GO-LIVE", anchor: true });
  ms.sort((a, b) => b.offset - a.offset);
  return ms;
}

/* --------------------------- payer readiness --------------------------- */

export function enrollmentCoverage(practice: Practice): {
  covered837x835: number;
  totalShare: number;
  gatePassed: boolean;
} {
  let covered = 0;
  let total = 0;
  for (const p of practice.payers) {
    total += p.share;
    if (p.e837.status === "approved" && p.e835.status === "approved") covered += p.share;
  }
  return { covered837x835: covered, totalShare: total, gatePassed: covered >= 80 };
}

/* ------------------------------ phases -------------------------------- */

export function phaseOf(plan: PlanResult, asOf: Date = today()): string {
  const d = daysBetween(asOf, plan.goLive);
  if (d < -28) return "Stabilized";
  if (d < 0) return "Hypercare";
  if (d <= 7) return "Cutover";
  if (d <= 21) return "Training";
  if (d <= 42) return "Build";
  if (d <= plan.requiredRunway) return "Long lead";
  return "Pre-kickoff";
}

/* ------------------------- red-item summary --------------------------- */

export function redItems(_practice: Practice, plan: PlanResult, asOf: Date = today()): string[] {
  const out: string[] = [];
  if (!plan.feasible) out.push(`Short ${plan.shortBy}d`);
  const blocked = plan.tasks.filter((t) => t.status === "blocked").length;
  if (blocked) out.push(`${blocked} blocked`);
  const atRisk = plan.tasks.filter((t) => t.status === "risk").length;
  if (atRisk) out.push(`${atRisk} at risk`);
  const overdue = plan.tasks.filter(
    (t) => t.status !== "done" && daysBetween(asOf, t.endDate) < 0 && t.endOffset > 0
  ).length;
  if (overdue) out.push(`${overdue} overdue`);
  return out;
}
