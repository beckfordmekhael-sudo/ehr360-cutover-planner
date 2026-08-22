import type { Practice } from "./domain/types";
import { SYSTEMS } from "./domain/systems";
import { classify, TYPE_META } from "./domain/classify";
import type { PlanResult } from "./engine/schedule";
import { deriveMilestones, enrollmentCoverage, fmt, iso, tLabel } from "./engine/schedule";
import type { Conflict } from "./domain/conflicts";

/** Excel-formula-safe cell: quote-escape and neutralise leading =+-@. */
function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCsv(practice: Practice, plan: PlanResult): void {
  const head = ["ID", "Stream", "Task", "Owner", "Clock", "Start", "Due", "Days", "T-start", "T-due", "Gate", "Critical", "Status", "Done on", "Ref", "Note"];
  const lines = [head.join(",")];
  for (const t of plan.tasks) {
    lines.push([
      t.id, t.stream, t.title, t.owner, t.clockResolved, iso(t.startDate), iso(t.endDate), t.durationDays,
      tLabel(t.startOffset), tLabel(t.endOffset), t.gate ? "GATE" : "", t.critical ? "YES" : "",
      t.status, t.completedOn ?? "", t.ref ?? "", t.note ?? "",
    ].map(csvCell).join(","));
  }
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cutover-schedule-${practice.name.replace(/\W+/g, "-").toLowerCase()}-${practice.goLive}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function buildSummary(practice: Practice, plan: PlanResult, conflicts: Conflict[]): string {
  const type = classify(practice.classification);
  const cov = enrollmentCoverage(practice);
  const L: string[] = [];
  L.push(`CUTOVER PLAN — ${practice.name} — go-live ${fmt(plan.goLive)} — Type ${type}`);
  L.push(TYPE_META[type].name + ". " + TYPE_META[type].duration);
  L.push("");
  L.push(`BUILD-READY:   ${plan.buildFeasible ? "achievable" : `SHORT ${plan.buildShortBy}d`} — earliest ${fmt(plan.earliestBuildReady)}`);
  L.push(`BILLING-READY: ${plan.billingFeasible ? "achievable" : `SHORT ${plan.billingShortBy}d`} — earliest ${fmt(plan.earliestBillingReady)}`);
  L.push(`Earliest defensible go-live (Monday): ${fmt(plan.earliestGoLive)}`);
  if (practice.dispositions.remit === "move" || practice.dispositions.claims === "move") {
    L.push(`835+837 coverage by collections: ${cov.covered.toFixed(1)}% (gate ≥80%)${cov.gap835 > 0 ? ` — ${cov.gap835.toFixed(1)}% has 837 live but 835 UNCONFIRMED` : ""}`);
  }
  L.push("");
  L.push("SCOPE");
  for (const d of ["move", "stay", "na"] as const) {
    const items = SYSTEMS.filter((s) => practice.dispositions[s.k] === d).map((s) => s.label);
    if (items.length) L.push(`- ${d === "move" ? "Moving" : d === "stay" ? "Staying" : "Out of scope"}: ${items.join(", ")}`);
  }
  L.push("");
  L.push("MILESTONES");
  for (const m of deriveMilestones(plan)) {
    L.push(`- ${fmt(m.date)}  ${tLabel(m.offset).padEnd(5)} ${m.label}${m.done ? " [DONE]" : ""}`);
  }
  const crit = plan.tasks.filter((t) => t.critical && t.status !== "done");
  if (crit.length) {
    L.push("");
    L.push("CRITICAL PATH (open)");
    for (const t of crit) L.push(`- start ${fmt(t.startDate)}, due ${fmt(t.endDate)} — ${t.title} (${t.owner}, ${t.durationDays}d)`);
  }
  if (conflicts.length) {
    L.push("");
    L.push("SCOPE WARNINGS");
    for (const c of conflicts) L.push(`- [${c.severity.toUpperCase()}] ${c.text}`);
  }
  L.push("");
  L.push("Durations are estimates until the first completed migration replaces them with observed data.");
  return L.join("\n");
}
