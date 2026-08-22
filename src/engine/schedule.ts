import type {
  Clock, DurationsConfig, Practice, Scale, ScheduledTask, ScopeCtx, TaskDef,
} from "../domain/types";
import { TASKS } from "../domain/library";
import { evalCond } from "../domain/conditions";
import { classify } from "../domain/classify";

/* ----------------------------- date utils ----------------------------- */

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
  // Round absorbs DST hour shifts; both inputs are local-midnight dates.
  return Math.round((b.getTime() - a.getTime()) / 86400000);
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
  if (d.getDay() === 1) return d;
  return addDays(d, (8 - d.getDay()) % 7 || 7);
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
  if (spec.perUnit && spec.scalesWith) d += spec.perUnit * (scale[spec.scalesWith] ?? 0);
  return Math.max(1, Math.round(d));
}

/* ------------------------------ scheduler ------------------------------ */

export interface PlanResult {
  tasks: ScheduledTask[];
  /** Days of runway needed on the internally-controlled build clock. */
  buildRunway: number;
  /** Days of runway needed on the third-party external clock. */
  billingRunway: number;
  runwayAvailable: number;
  buildShortBy: number;
  billingShortBy: number;
  buildFeasible: boolean;
  billingFeasible: boolean;
  /** Earliest date the practice can see patients and document. */
  earliestBuildReady: Date;
  /** Earliest date the practice can bill, be paid and prescribe. */
  earliestBillingReady: Date;
  /** Earliest defensible go-live: Monday on/after both clocks clear. */
  earliestGoLive: Date;
  kickoff: Date;
  goLive: Date;
  tailDays: number;
  scopeCtx: ScopeCtx;
}

/**
 * Two-clock work-back scheduler (v5 §3).
 *
 * One dependency graph, one backward pass in days-before-go-live offset
 * space — but two verdicts: the build clock (internally controlled) and the
 * billing clock (third-party gated: EDI enrollment, credentialing, EPCS,
 * telephony port, merchant underwriting). The gap between the two dates is
 * itself information.
 *
 * Critical path is provenance-tracked: during the backward pass each task
 * records which successor (or its own anchor) actually determined its late
 * finish, and the walk follows those recorded edges only.
 */
export function computePlan(practice: Practice, asOf: Date = today()): PlanResult {
  const { dispositions, scale, goLive, progress, classification } = practice;
  const durations = practice.assumptions;
  const goLiveDate = parseISO(goLive);
  const implType = classify(classification);
  const scopeCtx: ScopeCtx = { dispositions, implType, classification, prescribers: scale.prescribers };

  const inScope = TASKS.filter((t) => evalCond(t.applies, scopeCtx));
  const byId = new Map(inScope.map((t) => [t.id, t]));

  const successors = new Map<string, string[]>();
  for (const t of inScope) {
    for (const dep of t.deps ?? []) {
      if (!byId.has(dep)) continue;
      (successors.get(dep) ?? successors.set(dep, []).get(dep)!).push(t.id);
    }
  }

  const dur = new Map<string, number>();
  for (const t of inScope) {
    dur.set(t.id, progress[t.id]?.status === "done" ? 0 : taskDuration(t, scale, durations));
  }

  const targetEnd = (t: TaskDef) => (t.dueDays != null ? t.dueDays : Math.round(t.dueWeek * 7));
  const clockOf = (t: TaskDef): Clock => t.clock ?? "build";

  // Backward pass with binding-edge provenance, parameterised by an edge
  // filter so the build clock can be computed on the build-only subgraph.
  function backwardPass(includeTask: (t: TaskDef) => boolean) {
    const lateFinish = new Map<string, number>();
    const lateStart = new Map<string, number>();
    const bindingSucc = new Map<string, string | null>(); // null = anchored to own target
    const visiting = new Set<string>();
    const resolve = (id: string): void => {
      if (lateFinish.has(id)) return;
      if (visiting.has(id)) throw new Error(`Dependency cycle at ${id}`);
      visiting.add(id);
      const t = byId.get(id)!;
      let lf = targetEnd(t);
      let binder: string | null = null;
      for (const sid of successors.get(id) ?? []) {
        if (!includeTask(byId.get(sid)!)) continue;
        resolve(sid);
        const need = lateStart.get(sid)!;
        if (need > lf) {
          lf = need;
          binder = sid;
        }
      }
      lateFinish.set(id, lf);
      lateStart.set(id, lf + dur.get(id)!);
      bindingSucc.set(id, binder);
      visiting.delete(id);
    };
    inScope.filter(includeTask).forEach((t) => resolve(t.id));
    return { lateFinish, lateStart, bindingSucc };
  }

  // Full graph — the schedule of record.
  const full = backwardPass(() => true);
  const { lateFinish, lateStart, bindingSucc } = full;

  // Which tasks feed an external gate (transitively)? Those set billing-ready.
  const feedsExternal = new Set<string>();
  {
    const queue = inScope.filter((t) => clockOf(t) === "external").map((t) => t.id);
    for (const id of queue) feedsExternal.add(id);
    while (queue.length) {
      const t = byId.get(queue.pop()!)!;
      for (const dep of t.deps ?? []) {
        if (byId.has(dep) && !feedsExternal.has(dep)) {
          feedsExternal.add(dep);
          queue.push(dep);
        }
      }
    }
  }

  // Build clock: the build-only subgraph — external chains must not drag a
  // feeder task's timing into the build-ready date.
  const buildPass = backwardPass((t) => clockOf(t) === "build");
  const buildRunway = Math.max(
    0,
    ...inScope.filter((t) => clockOf(t) === "build").map((t) => buildPass.lateStart.get(t.id)!)
  );
  const billingRunway = Math.max(
    0,
    ...inScope.filter((t) => feedsExternal.has(t.id)).map((t) => lateStart.get(t.id)!)
  );
  const totalRunway = Math.max(0, ...inScope.map((t) => lateStart.get(t.id)!));

  const runwayAvailable = daysBetween(asOf, goLiveDate);
  const buildShortBy = buildRunway - runwayAvailable;
  const billingShortBy = billingRunway - runwayAvailable;

  const earliestBuildReady = addDays(asOf, buildRunway);
  const earliestBillingReady = addDays(asOf, billingRunway);
  const earliestGoLive = nextMonday(addDays(asOf, totalRunway));

  // Critical path: from each root that sets the total runway, follow the
  // recorded binding edges — the successor that actually determined each
  // task's late finish — until the chain reaches a task anchored to its own
  // target. Equal-by-coincidence lateStart values never enter the chain.
  const critical = new Set<string>();
  for (const root of inScope.filter((t) => dur.get(t.id)! > 0 && lateStart.get(t.id)! === totalRunway)) {
    let id: string | null | undefined = root.id;
    while (id) {
      critical.add(id);
      id = bindingSucc.get(id);
    }
  }

  const tasks: ScheduledTask[] = inScope.map((t) => {
    const endOffset = lateFinish.get(t.id)!;
    const startOffset = lateStart.get(t.id)!;
    const p = progress[t.id];
    return {
      ...t,
      durationDays: dur.get(t.id)! || taskDuration(t, scale, durations),
      startOffset,
      endOffset,
      startDate: addDays(goLiveDate, -startOffset),
      endDate: addDays(goLiveDate, -endOffset),
      critical: critical.has(t.id),
      pulledByDeps: endOffset > targetEnd(t),
      status: p?.status ?? "pending",
      completedOn: p?.completedOn,
      clockResolved: clockOf(t),
    };
  });
  tasks.sort((a, b) => (a.endOffset === b.endOffset ? b.startOffset - a.startOffset : b.endOffset - a.endOffset));

  return {
    tasks,
    buildRunway,
    billingRunway,
    runwayAvailable,
    buildShortBy,
    billingShortBy,
    buildFeasible: buildShortBy <= 0,
    billingFeasible: billingShortBy <= 0,
    earliestBuildReady,
    earliestBillingReady,
    earliestGoLive,
    kickoff: addDays(goLiveDate, -totalRunway),
    goLive: goLiveDate,
    tailDays: Math.max(0, ...tasks.map((t) => -t.endOffset)),
    scopeCtx,
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
  { id: "SET2", label: "Implementation type recorded" },
  { id: "RCM5", label: "EDI submitter enrollment begun, all payers" },
  { id: "EPX1", label: "Prescriber roster in; proofing scheduled" },
  { id: "DATA3", label: "Legacy data access secured" },
  { id: "FAX4", label: "Port order submitted" },
  { id: "RCM11", label: "Payer variants collapsed & re-mapped" },
  { id: "CRED2", label: "Credentialing approvals in hand" },
  { id: "DATA8", label: "Field mapping locked" },
  { id: "EPX11", label: "Identity proofing & EPCS 100%" },
  { id: "RCM23", label: "837 approved across payer list" },
  { id: "RCM24", label: "835 live + receiver confirmed ≥80% collections" },
  { id: "DATA16", label: "Practice sign-off on test migration" },
  { id: "RCM27", label: "Test claims accepted end to end" },
  { id: "GL3", label: "Go / no-go call" },
  { id: "DATA20", label: "Production export delivered (Friday)" },
  { id: "GLRCM2", label: "First ERA posted and reconciled" },
  { id: "GL9", label: "Transition to standard support" },
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

export interface Coverage {
  /** Share of collections where 837 AND 835 approved with receiver confirmed. */
  covered: number;
  totalShare: number;
  gatePassed: boolean;
  /** Share where 837 approved but 835 is not confirmed — the silent gap. */
  gap835: number;
  unremappedVariants: number;
}

export function enrollmentCoverage(practice: Practice): Coverage {
  let covered = 0, total = 0, gap835 = 0, unremapped = 0;
  for (const p of practice.payers) {
    total += p.share;
    const ok837 = p.e837.status === "approved";
    const ok835 = p.e835.status === "approved" && p.e835.confirmed === true;
    if (ok837 && ok835) covered += p.share;
    else if (ok837 && !ok835) gap835 += p.share;
    if (p.variants > 1 && !p.remapped) unremapped += 1;
  }
  return { covered, totalShare: total, gatePassed: covered >= 80, gap835, unremappedVariants: unremapped };
}

/* ------------------------------ phases -------------------------------- */

export function phaseOf(plan: PlanResult, doneRatioLongLead: number, asOf: Date = today()): string {
  const d = daysBetween(asOf, plan.goLive);
  let calendar: string;
  if (d < -28) calendar = "Stabilized";
  else if (d < 0) calendar = "Hypercare";
  else if (d <= 7) calendar = "Cutover";
  else if (d <= 21) calendar = "Training";
  else if (d <= 42) calendar = "Build";
  else if (d <= Math.max(plan.buildRunway, plan.billingRunway)) calendar = "Long lead";
  else calendar = "Pre-kickoff";
  // Calendar says one thing; if long-lead work is badly behind, say so.
  if ((calendar === "Build" || calendar === "Training" || calendar === "Cutover") && doneRatioLongLead < 0.5) {
    return `${calendar} — long-lead behind`;
  }
  return calendar;
}

export function longLeadDoneRatio(plan: PlanResult): number {
  const ll = plan.tasks.filter((t) => t.clockResolved === "external");
  if (!ll.length) return 1;
  return ll.filter((t) => t.status === "done").length / ll.length;
}

/* ------------------------- red-item summary --------------------------- */

export function redItems(plan: PlanResult, asOf: Date = today()): string[] {
  const out: string[] = [];
  if (!plan.billingFeasible) out.push(`Billing short ${plan.billingShortBy}d`);
  if (!plan.buildFeasible) out.push(`Build short ${plan.buildShortBy}d`);
  const blocked = plan.tasks.filter((t) => t.status === "blocked").length;
  if (blocked) out.push(`${blocked} blocked`);
  const atRisk = plan.tasks.filter((t) => t.status === "risk").length;
  if (atRisk) out.push(`${atRisk} at risk`);
  const overdue = plan.tasks.filter(
    (t) => t.status !== "done" && t.endOffset > 0 && daysBetween(asOf, t.endDate) < 0
  ).length;
  if (overdue) out.push(`${overdue} overdue`);
  return out;
}
