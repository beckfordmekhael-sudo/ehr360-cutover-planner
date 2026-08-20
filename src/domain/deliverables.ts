import type { DispositionMap, SystemKey } from "./types";

/*
 * Appendix A — Consolidated Customer Deliverables Checklist (Playbook v3).
 * Filtered by scope, personalised with real dates, and exported to the
 * practice at kickoff.
 */

const mv = (k: SystemKey) => (m: DispositionMap) => m[k] === "move";
const anyMove = (m: DispositionMap) => Object.values(m).some((v) => v === "move");
const any = (...ks: SystemKey[]) => (m: DispositionMap) => ks.some((k) => m[k] === "move");

export interface Deliverable {
  n: number;
  text: string;
  category: string;
  /** Weeks before go-live it is due; negative = after; 0.43 ≈ go-live Friday. */
  dueWeek: number;
  dueLabel?: string;
  when: (m: DispositionMap) => boolean;
}

export const DELIVERABLES: Deliverable[] = [
  { n: 1, text: "Practice legal name, DBA, EIN, Group NPI, taxonomy, and specialties", category: "Practice Setup", dueWeek: 7, when: anyMove },
  { n: 2, text: "All service locations with address, POS code, phone, fax, and hours", category: "Practice Setup", dueWeek: 7, when: anyMove },
  { n: 3, text: "CLIA number and certificate type per site, if applicable", category: "Practice Setup", dueWeek: 7, when: any("clinical", "labs") },
  { n: 4, text: "Practice logo, letterhead, and patient-facing display name", category: "Practice Setup", dueWeek: 7, when: any("portal", "fax", "claims") },
  { n: 5, text: "Provider roster: legal name, NPI, DEA and expiration, license and expiration, taxonomy, PTAN, CAQH", category: "Practice Setup", dueWeek: 7, when: anyMove },
  { n: 6, text: "Provider cell phone and direct email for every prescriber", category: "ePx", dueWeek: 7, when: mv("erx") },
  { n: 7, text: "Provider schedule templates and site rotation", category: "Practice Setup", dueWeek: 6, when: mv("sched") },
  { n: 8, text: "Full staff list with names, emails, roles, and site assignment", category: "Training", dueWeek: 6, when: anyMove },
  { n: 9, text: "Named super user for each site", category: "Training", dueWeek: 6, when: anyMove },
  { n: 10, text: "Sample de-identified notes, 3 to 5 per provider", category: "Clinical Config", dueWeek: 7, when: mv("clinical") },
  { n: 11, text: "Current visit type list with durations and scheduling rules", category: "Clinical Config", dueWeek: 7, when: any("sched", "clinical") },
  { n: 12, text: "In-office procedure list with CPT codes", category: "Clinical Config", dueWeek: 7, when: any("clinical", "claims") },
  { n: 13, text: "Current superbill / CPT and ICD-10 preference lists", category: "Clinical Config", dueWeek: 7, when: mv("claims") },
  { n: 14, text: "Existing .phrases / macro library export, if available", category: "Clinical Config", dueWeek: 6, when: mv("clinical") },
  { n: 15, text: "Reference lab account numbers for interface setup", category: "Clinical Config", dueWeek: 4, when: mv("labs") },
  { n: 16, text: "Customer Service Record (CSR) from the current fax carrier", category: "Fax / Telephony", dueWeek: 7, when: mv("fax") },
  { n: 17, text: "Signed LOA, recent carrier bill, account number, PIN, and exact service address", category: "Fax / Telephony", dueWeek: 7, when: mv("fax") },
  { n: 18, text: "Confirmation of which numbers port and which are retained", category: "Fax / Telephony", dueWeek: 8, when: mv("fax") },
  { n: 19, text: "Bank account owner name and email address, so the Sola application can be sent", category: "Payments", dueWeek: 8, when: mv("pay") },
  { n: 20, text: "Sola application completed and submitted by the practice directly to Sola", category: "Payments", dueWeek: 6, when: mv("pay") },
  { n: 21, text: "POS terminal count per location and confirmation of pricing", category: "Payments", dueWeek: 8, when: mv("pay") },
  { n: 22, text: "Confirmation of which prescribers require EPCS and which schedules", category: "ePx", dueWeek: 7, when: mv("erx") },
  { n: 23, text: "Two named administrators for EPCS logical access control", category: "ePx", dueWeek: 6, when: mv("erx") },
  { n: 24, text: "Each provider personally completes ePx identity proofing", category: "ePx", dueWeek: 5, when: mv("erx") },
  { n: 25, text: "Prescriber-agent relationships and preferred pharmacies", category: "ePx", dueWeek: 6, when: mv("erx") },
  { n: 26, text: "Full list of payers where the practice is credentialed, with effective dates", category: "Billing", dueWeek: 8, when: any("claims", "remit") },
  { n: 27, text: "Provider-level credentialing status, including anything still pending", category: "Billing", dueWeek: 8, when: any("claims", "cred") },
  { n: 28, text: "Medicare PTAN and Medicaid ID per provider and location", category: "Billing", dueWeek: 8, when: any("claims", "remit") },
  { n: 29, text: "Signed payer EDI enrollment forms and agreements", category: "Billing", dueWeek: 7, when: any("claims", "remit") },
  { n: 30, text: "Contracted fee schedules and allowed amounts", category: "Billing", dueWeek: 5, when: mv("claims") },
  { n: 31, text: "Outside billing company contact, BAA, scope of work, and user list", category: "Billing", dueWeek: 6, when: (m) => m.claims === "move" && m.rcm === "stay" },
  { n: 32, text: "Self-pay, sliding scale, and statement / collections policy", category: "Billing", dueWeek: 4, when: mv("claims") },
  { n: 33, text: "Legacy vendor export confirmation, cost, and notice period", category: "Data Migration", dueWeek: 8, when: any("clinical", "hist") },
  { n: 34, text: "Export format specification and sample file", category: "Data Migration", dueWeek: 7, when: any("clinical", "hist") },
  { n: 35, text: "Confirmed test export date and production export date", category: "Data Migration", dueWeek: 6, when: any("clinical", "hist") },
  { n: 36, text: "Test export delivered", category: "Data Migration", dueWeek: 5, when: any("clinical", "hist") },
  { n: 37, text: "Validation and written sign-off on the test migration", category: "Data Migration", dueWeek: 2, when: any("clinical", "hist") },
  { n: 38, text: "Production export delivered so data is available Friday", category: "Data Migration", dueWeek: 0.43, dueLabel: "Go-live Friday", when: any("clinical", "hist") },
  { n: 39, text: "Existing triage protocols, phone scripts, and nurse guidelines", category: "Rita", dueWeek: 6, when: any("sched", "portal") },
  { n: 40, text: "Scheduling rules, new patient policy, and provider preferences", category: "Rita", dueWeek: 6, when: any("sched", "portal") },
  { n: 41, text: "Hours, holiday calendar, after-hours and on-call policy per site", category: "Rita", dueWeek: 6, when: any("sched", "portal") },
  { n: 42, text: "Message routing rules, escalation criteria, and escalation contacts", category: "Rita", dueWeek: 6, when: mv("portal") },
  { n: 43, text: "Walk-in, cancellation, no-show, and late-arrival policies", category: "Rita", dueWeek: 6, when: mv("sched") },
  { n: 44, text: "Protected training time blocked and staff coverage arranged", category: "Training", dueWeek: 4, when: anyMove },
  { n: 45, text: "Reduced first-week schedule confirmed", category: "Go-Live", dueWeek: 2, when: anyMove },
];
