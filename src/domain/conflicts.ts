import type { DispositionMap, Scale, SystemKey } from "./types";
import { SYSTEM_LABEL } from "./systems";

/*
 * Scope conflict warnings, derived from the disposition combination.
 * These are the "invisible manual work" cases — mixed scope where somebody
 * re-keys data between two systems every day and nobody notices until go-live.
 */

export interface Conflict {
  severity: "red" | "amber";
  text: string;
}

const mv = (m: DispositionMap, k: SystemKey) => m[k] === "move";
const st = (m: DispositionMap, k: SystemKey) => m[k] === "stay";

export function deriveConflicts(m: DispositionMap, scale: Scale, shortByDays: number): Conflict[] {
  const out: Conflict[] = [];
  const anyMove = Object.values(m).includes("move");
  const anyStay = Object.values(m).includes("stay");

  if (!anyMove) {
    out.push({ severity: "amber", text: "Nothing is marked as moving. This is not a migration — it is a configuration project." });
    return out;
  }

  if (mv(m, "claims") && !mv(m, "remit"))
    out.push({ severity: "red", text: "Claims move but remittance stays. Payments keep landing in the old system and posting stays manual — every day." });
  if (mv(m, "remit") && !mv(m, "claims"))
    out.push({ severity: "red", text: "Remits move but claims stay. Confirm each payer will deliver 835s to a different destination than the one receiving the 837." });
  if (mv(m, "clinical") && st(m, "sched"))
    out.push({ severity: "red", text: "Charting moves while scheduling stays. Someone re-keys every appointment into the chart, daily." });
  if (mv(m, "sched") && st(m, "clinical"))
    out.push({ severity: "red", text: "Scheduling moves while charting stays. Check-in and documentation split across two screens." });
  if (mv(m, "clinical") && !mv(m, "hist"))
    out.push({ severity: "amber", text: "New charting without historical data. Providers will keep the legacy system open to read history — plan read-only access and say so up front." });
  if (mv(m, "claims") && !mv(m, "clinical") && !st(m, "clinical"))
    out.push({ severity: "amber", text: "Claims move but no clinical source is marked. Where does the charge originate?" });
  if (mv(m, "erx") && !mv(m, "clinical"))
    out.push({ severity: "amber", text: "e-Prescribing moves without the chart. Prescribers work from a med list that lives elsewhere — confirm the workflow." });
  if (mv(m, "elig") && !mv(m, "sched"))
    out.push({ severity: "amber", text: "Eligibility moves but scheduling stays. Who runs the eligibility check, in which system, at what point before the visit?" });
  if (mv(m, "cred"))
    out.push({
      severity: shortByDays > 0 ? "red" : "amber",
      text: shortByDays > 0
        ? "Credentialing is in scope and the date is compressed. Credentialing cannot be compressed — the date moves first."
        : "Credentialing is in scope. It is the longest third-party gate in the plan; it sets the date, not the reverse.",
    });
  if (mv(m, "claims") && st(m, "rcm"))
    out.push({ severity: "amber", text: "The practice keeps its own billing team / RCM vendor. OPEN QUESTION: the process reshape for practice-kept billing is not standardised — the outside biller needs a BAA, a written scope of work, and named users before training." });
  if (mv(m, "pay") && st(m, "claims") && st(m, "remit"))
    out.push({ severity: "amber", text: "Card processing moves while billing stays. Patient payments post in one system, claims in another — reconciliation is manual until proven otherwise." });

  // Generic move/stay bridge — list the actual pairs so the owner conversation is concrete.
  if (anyMove && anyStay) {
    const moving = (Object.keys(m) as SystemKey[]).filter((k) => m[k] === "move").map((k) => SYSTEM_LABEL[k]);
    const staying = (Object.keys(m) as SystemKey[]).filter((k) => m[k] === "stay").map((k) => SYSTEM_LABEL[k]);
    out.push({
      severity: "amber",
      text: `Mixed scope: ${moving.length} moving, ${staying.length} staying. Every move/stay pair is a manual bridge that needs a named owner and a written spec. Staying: ${staying.join(", ")}.`,
    });
  }

  if ((mv(m, "claims") || mv(m, "remit")) && scale.payers > 30)
    out.push({ severity: "amber", text: `${scale.payers} payers × three enrollment types ≈ ${scale.payers * 3} individual enrollments to track. Sequence by share of collections, not alphabetically.` });

  return out;
}
