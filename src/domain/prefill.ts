/*
 * Practice Onboarding Form v1.0.1 — field-by-field pre-fill map.
 *
 * Roughly 70% of the form is retrievable without asking the practice:
 * from their existing system with administrator access, from NPPES, or from
 * a state board lookup. Four categories can never be self-served:
 * Decisions, Contract data, Documents, and Tribal knowledge.
 *
 * Goal: hand the practice a mostly-complete document to confirm,
 * not a blank eight-page PDF to fill.
 */

export type PrefillSource =
  | "legacy-ehr"   // practice's existing system, admin access
  | "nppes"        // NPPES registry lookup
  | "state-board"  // state medical board lookup
  | "ask-decision" // a decision only the practice can make
  | "ask-contract" // lives in payer contracts — research, not data entry
  | "ask-document" // a physical document only they hold
  | "ask-tribal";  // tribal knowledge

export const SOURCE_META: Record<PrefillSource, { label: string; self: boolean; hint: string }> = {
  "legacy-ehr":   { label: "Legacy EHR (admin access)", self: true,  hint: "Pull it ourselves once read access is granted." },
  "nppes":        { label: "NPPES lookup",              self: true,  hint: "Public registry — NPI, taxonomy, addresses." },
  "state-board":  { label: "State board lookup",        self: true,  hint: "License number, status, expiration." },
  "ask-decision": { label: "Decision — must ask",       self: false, hint: "Only the practice can decide." },
  "ask-contract": { label: "Contract data — must ask",  self: false, hint: "Lives in payer contracts, not the EHR. Looks like data entry, is actually research — this is what usually stalls the form." },
  "ask-document": { label: "Document — must ask",       self: false, hint: "A file only the practice holds." },
  "ask-tribal":   { label: "Tribal knowledge — must ask", self: false, hint: "How the practice actually runs. No system holds it." },
};

export interface PrefillField {
  section: string;
  field: string;
  source: PrefillSource;
  note?: string;
}

export const PREFILL_MAP: PrefillField[] = [
  // 1. Practice information
  { section: "1 · Practice Information", field: "Practice name", source: "nppes" },
  { section: "1 · Practice Information", field: "Practice address", source: "nppes" },
  { section: "1 · Practice Information", field: "Phone / fax numbers", source: "legacy-ehr" },
  { section: "1 · Practice Information", field: "Group NPI", source: "nppes" },
  { section: "1 · Practice Information", field: "Tax ID / EIN", source: "ask-document", note: "Confirm against W-9; not public." },
  { section: "1 · Practice Information", field: "Specialty", source: "nppes" },
  { section: "1 · Practice Information", field: "Practice logo", source: "ask-document" },

  // 2. Locations / 3. Rooms
  { section: "2 · Location Details", field: "Locations, addresses, site phones/faxes", source: "legacy-ehr" },
  { section: "3 · Rooms", field: "Room list and types per location", source: "legacy-ehr", note: "Partially recoverable from the legacy schedule resources; confirm on the discovery walk-through." },
  { section: "3 · Rooms", field: "Assigned provider per room", source: "ask-tribal" },

  // 4. Visit types / 5. Service types
  { section: "4 · Visit Types", field: "Visit types and slot durations", source: "legacy-ehr" },
  { section: "4 · Visit Types", field: "Self-pay rate per visit type", source: "ask-contract", note: "Rates live in the fee policy, not the scheduler." },
  { section: "5 · Service Types", field: "Services performed (Echo, EKG, Stress, Lab…)", source: "legacy-ehr" },
  { section: "5 · Service Types", field: "Associated schedule (which days each service runs)", source: "legacy-ehr", note: "Derivable from 12 months of appointment history." },
  { section: "5 · Service Types", field: "Default provider when two physicians share a service", source: "ask-tribal" },

  // 6. Practice schedule
  { section: "6 · Practice Schedule", field: "Office hours by location", source: "legacy-ehr" },
  { section: "6 · Practice Schedule", field: "Provider availability by location", source: "legacy-ehr" },
  { section: "6 · Practice Schedule", field: "Provider-specific scheduling rules", source: "ask-tribal", note: "\"Dr. Khan sees only follow-ups on Friday\" is in nobody's database." },
  { section: "6 · Practice Schedule", field: "Weekend hours, holidays, lunch blocks", source: "ask-tribal" },

  // 7. Insurance
  { section: "7 · Insurance", field: "Insurance names accepted", source: "legacy-ehr", note: "Payer table export — consolidate name variants before use." },
  { section: "7 · Insurance", field: "In / out-of-network status", source: "ask-contract" },
  { section: "7 · Insurance", field: "Accepted plans per insurance", source: "ask-contract" },
  { section: "7 · Insurance", field: "Per-provider network status", source: "ask-contract" },

  // 8. Staff
  { section: "8 · Staff", field: "Staff names, emails, roles", source: "legacy-ehr", note: "User list export; resolve shared logins to named users." },
  { section: "8 · Staff", field: "MA assignments per provider", source: "ask-tribal" },

  // 9. Providers
  { section: "9 · Providers", field: "Provider names, credentials", source: "nppes" },
  { section: "9 · Providers", field: "Individual NPI, taxonomy", source: "nppes" },
  { section: "9 · Providers", field: "State license number and expiration", source: "state-board" },
  { section: "9 · Providers", field: "DEA number", source: "legacy-ehr", note: "In the legacy prescriber setup; verify against the DEA registration." },
  { section: "9 · Providers", field: "Provider cell phone and direct email", source: "ask-document", note: "Required for ePx identity proofing; rarely in any system." },

  // 10. Consent forms
  { section: "10 · Consent Forms", field: "Consent form list", source: "legacy-ehr" },
  { section: "10 · Consent Forms", field: "Consent form content / documents", source: "ask-document" },
  { section: "10 · Consent Forms", field: "Which consent maps to which visit type", source: "ask-tribal" },
  { section: "10 · Consent Forms", field: "Send automatically before appointment?", source: "ask-decision" },

  // 11. Fax / 12. Phone
  { section: "11 · Fax", field: "Current fax provider and number", source: "legacy-ehr" },
  { section: "12 · Phone", field: "Current phone provider and main number", source: "legacy-ehr" },
  { section: "12 · Phone", field: "Port the number, or buy a new one?", source: "ask-decision" },
  { section: "12 · Phone", field: "Recent phone bill + CSR", source: "ask-document", note: "Mandatory for the port; request in week one." },
];
