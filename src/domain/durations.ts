import type { DurationsConfig } from "./types";

/*
 * Duration assumptions, calendar days — Playbook v5 §6 of the build brief.
 *
 * ESTIMATES, NOT OBSERVED DATA. The first real migration (Neuro Heart)
 * completes hypercare in late September; its planned-vs-actual replaces
 * these without a rebuild. Assumptions are PINNED per practice at creation;
 * an explicit "recalculate" copies the current globals onto a plan.
 */
export const DEFAULT_DURATIONS: DurationsConfig = {
  edi837: {
    label: "837 claim enrollment",
    baseDays: 30, perUnit: 0.4, scalesWith: "payers",
    note: "Per payer, third-party gated. Medicare/Medicaid cannot be expedited. Delegated clearinghouse coverage, where it exists, shortens this materially (open decision 1b).",
  },
  edi835: {
    label: "835 ERA enrollment",
    baseDays: 45, perUnit: 0.5, scalesWith: "payers",
    note: "Different intake at the payer; commonly trails 837 by weeks. The quiet schedule killer.",
  },
  eft: {
    label: "EFT enrollment",
    baseDays: 45,
    note: "Frequently a separate form, sometimes a separate portal.",
  },
  credentialing: {
    label: "Credentialing (new entity)",
    baseDays: 120, perUnit: 3, scalesWith: "providers",
    note: "90–180 days where new. Cannot be compressed; the date moves first.",
  },
  epcsProofing: {
    label: "EPCS identity proofing",
    baseDays: 30, perUnit: 2, scalesWith: "prescribers",
    note: "Per prescriber, done personally; hardware tokens ship physically. On the EXTERNAL clock.",
  },
  telephonyPort: {
    label: "Telephony port",
    baseDays: 21,
    note: "Carrier-dependent, no compression. CSR mismatch is the #1 rejection.",
  },
  underwriting: {
    label: "Merchant underwriting",
    baseDays: 21,
    note: "Sola merchant underwriting; application sent week one.",
  },
  noteTemplates: {
    label: "Note templates & .phrases",
    baseDays: 21, perUnit: 2, scalesWith: "providers",
    note: "From the practice's real notes, per specialty and provider.",
  },
  training: {
    label: "Role-based training",
    baseDays: 14, perUnit: 0.34, scalesWith: "staff",
    note: "Never in the final three days — reserved for cutover.",
  },
  legacyExtract: {
    label: "Legacy vendor data extract",
    baseDays: 21,
    note: "Vendor-dependent. Historically the largest variance in the plan.",
  },
  defaultTask: {
    label: "Default task duration",
    baseDays: 5,
    note: "Tasks without a specific assumption.",
  },
};
