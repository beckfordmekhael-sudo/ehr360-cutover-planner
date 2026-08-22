import { describe, expect, it } from "vitest";
import type { Classification, DispositionMap, Practice } from "../src/domain/types";
import { DEFAULT_DURATIONS } from "../src/domain/durations";
import { PRESETS } from "../src/domain/systems";
import { classify } from "../src/domain/classify";
import { validateLibrary, TASKS } from "../src/domain/library";
import { evalCond } from "../src/domain/conditions";
import { computePlan, enrollmentCoverage, isMonday, parseISO } from "../src/engine/schedule";

const ASOF = parseISO("2026-08-24"); // fixed Monday, keeps goldens stable

function practiceWith(over: Partial<Practice> = {}): Practice {
  return {
    id: "pr-test",
    name: "Test",
    goLive: "2026-12-07", // a Monday, 15 weeks past ASOF
    classification: { ehrReplaced: true, contractsUnderTin: true, rcmClient: false, submitterChanges: true },
    dispositions: { ...PRESETS.full.map } as DispositionMap,
    scale: { providers: 3, locations: 1, payers: 20, prescribers: 3, staff: 12 },
    progress: {},
    payers: [],
    gate: {},
    eraDecision: { order: "", billingLead: "", rationale: "" },
    assumptions: structuredClone(DEFAULT_DURATIONS),
    createdAt: "2026-08-24",
    ...over,
  };
}

describe("task library", () => {
  it("is internally consistent (unique ids, resolvable deps, durations present)", () => {
    expect(validateLibrary()).toEqual([]);
  });

  it("has no dependency cycles under full scope", () => {
    expect(() => computePlan(practiceWith(), ASOF)).not.toThrow();
  });

  it("scopes conditions without throwing on any task", () => {
    const p = practiceWith();
    const ctx = {
      dispositions: p.dispositions,
      implType: classify(p.classification),
      classification: p.classification,
      prescribers: 3,
    } as const;
    for (const t of TASKS) expect(() => evalCond(t.applies, ctx)).not.toThrow();
  });
});

describe("classification (v5 §2.1)", () => {
  const c = (o: Partial<Classification>): Classification => ({
    ehrReplaced: true, contractsUnderTin: true, rcmClient: false, submitterChanges: true, ...o,
  });
  it("Q1 no → Type D", () => expect(classify(c({ ehrReplaced: false }))).toBe("D"));
  it("Q2 no → Type C", () => expect(classify(c({ contractsUnderTin: false }))).toBe("C"));
  it("Q3 yes → Type B", () => expect(classify(c({ rcmClient: true }))).toBe("B"));
  it("Q3 no → Type A", () => expect(classify(c({ rcmClient: false }))).toBe("A"));
});

describe("two-clock feasibility", () => {
  it("bills later than it builds on a full switch", () => {
    const plan = computePlan(practiceWith(), ASOF);
    expect(plan.billingRunway).toBeGreaterThan(plan.buildRunway);
  });

  it("earliest go-live is a Monday on/after both clocks clear", () => {
    const plan = computePlan(practiceWith(), ASOF);
    expect(isMonday(plan.earliestGoLive)).toBe(true);
    const runway = Math.max(plan.buildRunway, plan.billingRunway);
    const cleared = new Date(ASOF);
    cleared.setDate(cleared.getDate() + runway);
    expect(plan.earliestGoLive.getTime()).toBeGreaterThanOrEqual(cleared.getTime());
  });

  it("credentialing dominates the billing clock on Type C", () => {
    const typeC = practiceWith({
      classification: { ehrReplaced: true, contractsUnderTin: false, rcmClient: false, submitterChanges: true },
    });
    const base = computePlan(practiceWith(), ASOF);
    const plan = computePlan(typeC, ASOF);
    // credentialing = 120 + 3×3 providers = 129d + CAQH ahead of it
    expect(plan.billingRunway).toBeGreaterThan(base.billingRunway);
    expect(plan.billingRunway).toBeGreaterThanOrEqual(129);
    const critIds = plan.tasks.filter((t) => t.critical).map((t) => t.id);
    expect(critIds).toContain("CRED2");
  });

  it("marking a critical task done shortens or re-routes the runway, never lengthens it", () => {
    const base = computePlan(practiceWith(), ASOF);
    const critRoot = base.tasks.find((t) => t.critical && !t.deps?.length);
    expect(critRoot).toBeDefined();
    const done = computePlan(
      practiceWith({ progress: { [critRoot!.id]: { status: "done", completedOn: "2026-08-24" } } }),
      ASOF
    );
    expect(Math.max(done.buildRunway, done.billingRunway)).toBeLessThanOrEqual(
      Math.max(base.buildRunway, base.billingRunway)
    );
  });

  it("prescriber count drives the EPCS chain", () => {
    const few = computePlan(practiceWith({ scale: { providers: 3, locations: 1, payers: 5, prescribers: 1, staff: 12 } }), ASOF);
    const many = computePlan(practiceWith({ scale: { providers: 3, locations: 1, payers: 5, prescribers: 40, staff: 12 } }), ASOF);
    const dur = (p: typeof few, id: string) => p.tasks.find((t) => t.id === id)!.durationDays;
    expect(dur(many, "EPX8")).toBeGreaterThan(dur(few, "EPX8"));
  });

  it("zero prescribers removes the EPCS gate entirely", () => {
    const plan = computePlan(practiceWith({ scale: { providers: 3, locations: 1, payers: 20, prescribers: 0, staff: 12 } }), ASOF);
    expect(plan.tasks.find((t) => t.id === "EPX8")).toBeUndefined();
  });
});

describe("Neuro Heart — reference implementation (brief §9)", () => {
  const neuroHeart = practiceWith({
    name: "Neuro Heart",
    classification: { ehrReplaced: true, contractsUnderTin: true, rcmClient: true, submitterChanges: true },
    dispositions: {
      clinical: "move", sched: "move", claims: "move", remit: "move", elig: "move",
      pay: "stay",     // payments stay in the RCM platform
      hist: "move", erx: "move", labs: "move", portal: "move",
      fax: "stay",     // RingCentral already live — re-point only
      email: "stay", cred: "na", rcm: "move", report: "move",
    } as DispositionMap,
    scale: { providers: 3, locations: 1, payers: 52, prescribers: 3, staff: 12 },
  });

  it("classifies as Type B", () => {
    expect(classify(neuroHeart.classification)).toBe("B");
  });

  it("places §11b EDI enrollment fully in scope despite Type B", () => {
    const plan = computePlan(neuroHeart, ASOF);
    const ids = plan.tasks.map((t) => t.id);
    for (const id of ["RCM1", "RCM4", "RCM5", "RCM23", "RCM24", "RCM25"]) {
      expect(ids, `§11b task ${id} must be in scope on Type B`).toContain(id);
    }
  });

  it("does NOT run full credentialing — §11a is verify-only on Type B", () => {
    const plan = computePlan(neuroHeart, ASOF);
    const ids = plan.tasks.map((t) => t.id);
    expect(ids).not.toContain("CRED2");
    expect(ids).toContain("CRED3"); // verify-only task
  });

  it("excludes payments and telephony port; includes the fax re-point", () => {
    const plan = computePlan(neuroHeart, ASOF);
    const ids = plan.tasks.map((t) => t.id);
    expect(ids).not.toContain("PAY6"); // underwriting out of scope
    expect(ids).not.toContain("FAX4"); // no port
    expect(ids).toContain("FAX13");    // re-point instead
  });

  it("critical path runs through §11b or EPCS, per the brief", () => {
    const plan = computePlan(neuroHeart, ASOF);
    const crit = plan.tasks.filter((t) => t.critical).map((t) => t.id);
    const touches = crit.some((id) => id.startsWith("RCM") || id.startsWith("EPX"));
    expect(touches, `critical was: ${crit.join(", ")}`).toBe(true);
  });
});

describe("enrollment coverage (835 receiver-confirmed gate)", () => {
  it("counts a payer only when 837 approved AND 835 approved with receiver confirmed", () => {
    const p = practiceWith({
      payers: [
        { id: "1", name: "A", payerId: "A1", variants: 1, remapped: true, share: 50, e837: { status: "approved" }, e835: { status: "approved", confirmed: true }, eft: { status: "none" } },
        { id: "2", name: "B", payerId: "B1", variants: 1, remapped: true, share: 40, e837: { status: "approved" }, e835: { status: "approved", confirmed: false }, eft: { status: "none" } },
      ],
    });
    const cov = enrollmentCoverage(p);
    expect(cov.covered).toBe(50);
    expect(cov.gap835).toBe(40); // the silent gap: 837 live, 835 unconfirmed
    expect(cov.gatePassed).toBe(false);
  });
});
