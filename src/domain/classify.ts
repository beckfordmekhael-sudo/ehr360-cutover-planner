import type { Classification, ImplType } from "./types";

/*
 * Implementation type — v5 §2.1. Four questions, in order. Assigned and
 * recorded at kickoff, not inferred from the disposition grid. Without a
 * recorded type, Type A vs Type B is roughly five weeks of misallocated
 * sequencing in either direction.
 */

export function classify(c: Classification): ImplType {
  if (!c.ehrReplaced) return "D";
  if (!c.contractsUnderTin) return "C";
  return c.rcmClient ? "B" : "A";
}

export const TYPE_META: Record<ImplType, { name: string; situation: string; duration: string }> = {
  A: {
    name: "A — Full switch",
    situation: "Cold practice. Replacing the EMR and everything around it.",
    duration: "Build 4–5 wks · Billing-ready 8–12 wks",
  },
  B: {
    name: "B — RCM client adding EHR",
    situation: "Existing billing client. Payer contracts, often telephony and payments, already in place. Critical path: EDI submitter enrollment and ePx — do not read as a light version of §11.",
    duration: "Build 3–4 wks · Billing-ready 6–10 wks",
  },
  C: {
    name: "C — New billing entity",
    situation: "New group NPI, exiting an existing arrangement. Credentialing-gated.",
    duration: "Build 4–5 wks · Billing-ready 12+ wks",
  },
  D: {
    name: "D — Integration / add-on",
    situation: "Nothing replaced. Sits alongside the incumbent.",
    duration: "1–2 wks",
  },
};

export const QUESTIONS: { key: keyof Classification; q: string; yes: string; no: string }[] = [
  { key: "ehrReplaced", q: "1 · Is the EHR being replaced?", yes: "Continue", no: "Type D" },
  { key: "contractsUnderTin", q: "2 · Does the practice hold payer contracts under this TIN?", yes: "Continue", no: "Type C" },
  { key: "rcmClient", q: "3 · Already served by the RCM business — clearinghouse, telephony or payments in place?", yes: "Type B", no: "Type A" },
  { key: "submitterChanges", q: "4 · Does the submitter of record change?", yes: "§11b in scope IN FULL, whatever the type", no: "§11b verify only" },
];
