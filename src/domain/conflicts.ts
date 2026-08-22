import type { Practice, ScopeCtx, SystemKey } from "./types";
import { SYSTEM_LABEL } from "./systems";

/*
 * Scope conflict warnings — derived from the disposition combination, the
 * implementation type and the classification, not from a static list.
 */

export interface Conflict {
  severity: "red" | "amber";
  text: string;
}

export function deriveConflicts(
  practice: Practice,
  ctx: ScopeCtx,
  billingShortBy: number,
  epcsChainStarted: boolean
): Conflict[] {
  const m = practice.dispositions;
  const out: Conflict[] = [];
  const mv = (k: SystemKey) => m[k] === "move";
  const st = (k: SystemKey) => m[k] === "stay";
  const anyMove = Object.values(m).includes("move");
  const anyStay = Object.values(m).includes("stay");

  if (!anyMove) {
    out.push({ severity: "amber", text: "Nothing is marked as moving. This is not a migration — it is a configuration project." });
    return out;
  }

  // §11b mis-scoping — the most consequential error available (v5 §11).
  if (ctx.implType === "B" && !ctx.classification.submitterChanges && (mv("claims") || mv("remit")))
    out.push({ severity: "red", text: "Type B with 'submitter does not change' recorded — EHR 360 submits through its own clearinghouse, so the submitter almost always changes. Verify question 4 before trusting this plan: reading §11 as verify-only on a Type B under-scopes by roughly five weeks." });

  if (mv("claims") && !mv("remit"))
    out.push({ severity: "red", text: "Claims move but remittance stays. Payments keep landing in the old system and posting stays manual — every day." });
  if (mv("remit") && !mv("claims"))
    out.push({ severity: "red", text: "Remits move but claims stay. Confirm each payer will deliver 835s to a different destination than the one receiving the 837." });
  if (mv("clinical") && st("sched"))
    out.push({ severity: "red", text: "Charting moves while scheduling stays. Someone re-keys every appointment into the chart, daily." });
  if (mv("sched") && st("clinical"))
    out.push({ severity: "red", text: "Scheduling moves while charting stays. Check-in and documentation split across two screens." });
  if (mv("clinical") && !mv("hist"))
    out.push({ severity: "amber", text: "New charting without historical data. Providers keep the legacy system open to read history — plan read-only access and say so up front." });
  if (mv("claims") && !mv("clinical") && !st("clinical"))
    out.push({ severity: "amber", text: "Claims move but no clinical source is marked. Where does the charge originate?" });

  // EPCS against the external clock.
  if (practice.scale.prescribers > 0 && mv("erx") && !epcsChainStarted)
    out.push({ severity: "red", text: `${practice.scale.prescribers} prescriber(s) present and EPCS identity proofing not started. Proofing is on the EXTERNAL clock — ~30 days per prescriber, hardware tokens ship physically, cannot compress at the end. Start it now regardless of the go-live date.` });
  if (practice.scale.prescribers > 0 && m.erx === "na")
    out.push({ severity: "amber", text: "Prescribers are present but e-prescribing is marked not applicable. Confirm this is deliberate — a provider who cannot prescribe on day one cannot see patients." });

  if ((ctx.implType === "C" || mv("cred")) && billingShortBy > 0)
    out.push({ severity: "red", text: "Credentialing is in scope and the requested date is compressed. Credentialing cannot compress — the date moves first." });
  else if (ctx.implType === "C" || mv("cred"))
    out.push({ severity: "amber", text: "Credentialing (new entity) in scope: 90–180 days, third-party gated. It sets the billing-ready date; the go-live date follows it." });

  if (mv("claims") && st("rcm"))
    out.push({ severity: "amber", text: "The practice keeps its own billing team / RCM vendor. The outside biller needs a signed BAA, a written scope of work, and named users before training is scheduled." });

  if (anyStay && anyMove) {
    const staying = (Object.keys(m) as SystemKey[]).filter((k) => m[k] === "stay").map((k) => SYSTEM_LABEL[k]);
    out.push({
      severity: "amber",
      text: `Mixed scope. Every move/stay pair is a manual bridge that needs a named owner and a written spec. Staying: ${staying.join(", ")}.`,
    });
  }

  if ((mv("claims") || mv("remit")) && practice.scale.payers > 30)
    out.push({ severity: "amber", text: `${practice.scale.payers} payers × three enrollment types ≈ ${practice.scale.payers * 3} individual enrollments. Sequence by share of collections; confirm delegated clearinghouse coverage (open decision 1b) before assuming per-payer forms.` });

  // ERA sequencing decision unrecorded.
  if (mv("remit") && !practice.eraDecision.order)
    out.push({ severity: "amber", text: "The 835 receiver cutover order is undecided. Both orders carry real risk (see the ERA sequencing card); the decision needs the billing lead's name against it." });

  return out;
}
