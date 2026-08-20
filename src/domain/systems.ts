import type { DispositionMap, SystemKey } from "./types";

export const SYSTEMS: { k: SystemKey; label: string; hint: string }[] = [
  { k: "clinical", label: "Clinical notes & chart", hint: "Encounter documentation, problem list, orders" },
  { k: "sched", label: "Scheduling", hint: "Calendar, visit types, provider templates" },
  { k: "claims", label: "Claim submission", hint: "837P/837I out through the clearinghouse" },
  { k: "remit", label: "ERA & EFT posting", hint: "835 remits, bank deposits, auto-post" },
  { k: "elig", label: "Eligibility & prior auth", hint: "270/271 checks, auth workflow" },
  { k: "pay", label: "Copay & card processing", hint: "Sola merchant account, terminals, receipts" },
  { k: "hist", label: "Historical chart data", hint: "Prior notes, scanned documents, results" },
  { k: "erx", label: "e-Prescribing & EPCS", hint: "ePx identity proofing, EPCS tokens" },
  { k: "labs", label: "Lab & imaging interfaces", hint: "Inbound results, outbound orders" },
  { k: "portal", label: "Patient portal & messaging", hint: "Portal accounts, reminders, statements" },
  { k: "fax", label: "Fax", hint: "RingCentral number port or new line" },
  { k: "email", label: "Email & domain", hint: "MX cutover, mailbox move, new addresses" },
  { k: "cred", label: "Credentialing / group NPI", hint: "New billing entity or payer re-enrollment" },
  { k: "rcm", label: "Billing team / RCM vendor", hint: "Who works the claims after cutover" },
  { k: "report", label: "Reporting & analytics", hint: "Operational and financial reports" },
];

export const SYSTEM_LABEL = Object.fromEntries(SYSTEMS.map((s) => [s.k, s.label])) as Record<SystemKey, string>;

export interface Preset {
  name: string;
  blurb: string;
  map: DispositionMap;
}

export const PRESETS: Record<string, Preset> = {
  full: {
    name: "Full EHR switch",
    blurb: "Everything moves. The long-cycle deal.",
    map: {
      clinical: "move", sched: "move", claims: "move", remit: "move", elig: "move",
      pay: "move", hist: "move", erx: "move", labs: "move", portal: "move",
      fax: "move", email: "stay", cred: "na", rcm: "move", report: "move",
    },
  },
  billing: {
    name: "Billing & RCM only",
    blurb: "Clinical stays put. Claims, remits and A/R move.",
    map: {
      clinical: "stay", sched: "stay", claims: "move", remit: "move", elig: "move",
      pay: "stay", hist: "stay", erx: "stay", labs: "stay", portal: "stay",
      fax: "stay", email: "stay", cred: "na", rcm: "move", report: "move",
    },
  },
  newentity: {
    name: "New billing entity",
    blurb: "New group NPI, exiting an existing arrangement.",
    map: {
      clinical: "stay", sched: "stay", claims: "move", remit: "move", elig: "move",
      pay: "stay", hist: "stay", erx: "stay", labs: "stay", portal: "stay",
      fax: "move", email: "move", cred: "move", rcm: "move", report: "move",
    },
  },
  addon: {
    name: "Integration / add-on",
    blurb: "Nothing replaced. Sits alongside the incumbent.",
    map: {
      clinical: "stay", sched: "stay", claims: "stay", remit: "stay", elig: "stay",
      pay: "stay", hist: "stay", erx: "stay", labs: "stay", portal: "stay",
      fax: "stay", email: "stay", cred: "na", rcm: "stay", report: "move",
    },
  },
};
