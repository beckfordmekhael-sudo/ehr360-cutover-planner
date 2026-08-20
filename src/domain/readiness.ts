import type { DispositionMap, SystemKey } from "./types";

/*
 * Appendix B — Go-Live Readiness Gate (Playbook v3), filtered to scope.
 * Reviewed on the go/no-go call the Wednesday before go-live. Any item not
 * confirmed is a no-go unless the Implementation Lead documents an accepted
 * workaround. The deciding authority is an open question in the source
 * documents — surfaced in the UI, not papered over.
 */

const anyMove = (m: DispositionMap) => Object.values(m).some((v) => v === "move");
const any = (...ks: SystemKey[]) => (m: DispositionMap) => ks.some((k) => m[k] === "move");

export interface GateItem {
  id: string;
  text: string;
  owner: "EHR Team" | "Customer" | "Joint";
  when: (m: DispositionMap) => boolean;
}

export const READINESS_GATE: GateItem[] = [
  { id: "G1", text: "Practice, all locations, and all providers built and verified", owner: "EHR Team", when: anyMove },
  { id: "G2", text: "All user accounts created with correct role-based permissions", owner: "EHR Team", when: anyMove },
  { id: "G3", text: "Service types, visit types, note templates, and .phrases signed off by providers", owner: "Joint", when: any("clinical") },
  { id: "G4", text: "Provider schedules built and future appointments loaded correctly", owner: "EHR Team", when: any("sched") },
  { id: "G5", text: "Fee schedule and charge preference lists loaded", owner: "EHR Team", when: any("claims") },
  { id: "G6", text: "All required training delivered; make-up sessions complete; no untrained user going live", owner: "Joint", when: anyMove },
  { id: "G7", text: "Super users identified and trained at every site", owner: "Customer", when: anyMove },
  { id: "G8", text: "Fax number ported to RingCentral, or an accepted interim plan documented", owner: "EHR Team", when: any("fax") },
  { id: "G9", text: "Inbound fax routing tested to every queue; outbound fax tested from within a chart", owner: "Joint", when: any("fax") },
  { id: "G10", text: "Outbound caller ID confirmed correct", owner: "Joint", when: any("fax") },
  { id: "G11", text: "Sola merchant account approved; terminals delivered and configured", owner: "EHR Team", when: any("pay") },
  { id: "G12", text: "Test payment, void, and refund completed and posted correctly", owner: "Joint", when: any("pay") },
  { id: "G13", text: "Every prescriber has completed identity proofing", owner: "EHR Team", when: any("erx") },
  { id: "G14", text: "EPCS enabled and logical access control approval completed where required", owner: "EHR Team", when: any("erx") },
  { id: "G15", text: "Test prescription successfully transmitted for every prescriber", owner: "Joint", when: any("erx") },
  { id: "G16", text: "Clearinghouse connection live; payer IDs mapped", owner: "EHR Team", when: any("claims") },
  { id: "G17", text: "837 and 835 enrollment live for payers representing ≥80% of collections, or a documented exception by the named decision-maker", owner: "EHR Team", when: any("claims", "remit") },
  { id: "G18", text: "Real-time eligibility verification tested and returning correctly for major payers", owner: "Joint", when: any("elig") },
  { id: "G19", text: "Test claim batch submitted and accepted end to end", owner: "EHR Team", when: any("claims") },
  { id: "G20", text: "ERA auto-posting rules configured and mapped", owner: "EHR Team", when: any("remit") },
  { id: "G21", text: "Legacy A/R plan agreed in writing — named owner, system, duration", owner: "Joint", when: any("claims") },
  { id: "G22", text: "Test data migration validated and signed off by the practice", owner: "Customer", when: any("clinical", "hist") },
  { id: "G23", text: "Production export date confirmed with the legacy vendor", owner: "Customer", when: any("clinical", "hist") },
  { id: "G24", text: "Legacy data entry freeze time communicated practice-wide", owner: "Joint", when: any("clinical", "hist", "sched") },
  { id: "G25", text: "Legacy read-only access agreed — duration, cost, who pays", owner: "Joint", when: any("clinical", "hist") },
  { id: "G26", text: "Rita rules configured, scenario-tested, and signed off", owner: "Joint", when: any("sched", "portal") },
  { id: "G27", text: "Dress rehearsal completed successfully", owner: "Joint", when: anyMove },
  { id: "G28", text: "First-week schedule reduced to an agreed volume", owner: "Customer", when: anyMove },
  { id: "G29", text: "Hypercare support plan and escalation contacts published", owner: "EHR Team", when: anyMove },
];
