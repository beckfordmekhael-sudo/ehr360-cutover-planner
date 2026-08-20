import type { DurationsConfig } from "./types";

/**
 * Duration assumptions, calendar days.
 *
 * ESTIMATES, NOT OBSERVED DATA. No full EHR migration has completed yet —
 * the one reference implementation was a greenfield start. Every figure here
 * is replaceable from the Settings panel and should be revised from the first
 * completed migration (Neuro Heart).
 */
export const DEFAULT_DURATIONS: DurationsConfig = {
  edi837: {
    label: "837 claim enrollment",
    baseDays: 45, perUnit: 0.4, scalesWith: "payers",
    note: "Per-payer, third-party gated. Medicare/Medicaid cannot be expedited.",
  },
  edi835: {
    label: "835 ERA enrollment",
    baseDays: 60, perUnit: 0.5, scalesWith: "payers",
    note: "Trails 837 approval by weeks. The quiet schedule killer.",
  },
  eft: {
    label: "EFT enrollment",
    baseDays: 45,
    note: "Bank + payer paperwork.",
  },
  credentialing: {
    label: "Credentialing (new group NPI)",
    baseDays: 120, perUnit: 3, scalesWith: "providers",
    note: "Commercial payers run 90–180 days. Cannot be compressed; the date moves first.",
  },
  epxProofing: {
    label: "ePx identity proofing & EPCS",
    baseDays: 30, perUnit: 2, scalesWith: "providers",
    note: "Per prescriber, done personally. Hardware tokens ship physically.",
  },
  faxPort: {
    label: "Fax number port",
    baseDays: 21,
    note: "Carrier-dependent. Cannot be compressed. CSR mismatch is the #1 rejection.",
  },
  underwriting: {
    label: "Sola payment underwriting",
    baseDays: 21,
    note: "Merchant underwriting by Sola; application sent week one.",
  },
  noteTemplates: {
    label: "Note templates & .phrases",
    baseDays: 21, perUnit: 2, scalesWith: "providers",
    note: "Built from the practice's real notes, per specialty and provider.",
  },
  training: {
    label: "Role-based training",
    baseDays: 14, perUnit: 0.34, scalesWith: "staff",
    note: "Never in the final three days — those are reserved for cutover.",
  },
  legacyExtract: {
    label: "Legacy vendor data extract",
    baseDays: 21,
    note: "Vendor-dependent. Historically the largest variance in the whole plan.",
  },
  defaultTask: {
    label: "Default task duration",
    baseDays: 5,
    note: "Applied to tasks without a specific duration assumption.",
  },
};
