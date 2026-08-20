import { useEffect, useState } from "react";
import type { DispositionMap, DurationsConfig, PayerRow, Practice } from "./domain/types";
import { PRESETS } from "./domain/systems";
import { DEFAULT_DURATIONS } from "./domain/durations";
import { addDays, iso, nextMonday, today } from "./engine/schedule";

/*
 * Persistence: localStorage, versioned keys. One record for the practice
 * portfolio, one for the duration settings. A schedule you cannot update is
 * a document, not a tool — everything the lead touches is saved per practice.
 */

const PRACTICES_KEY = "ehr360.planner.practices.v1";
const SETTINGS_KEY = "ehr360.planner.durations.v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — planner still works, just not persisted */
  }
}

let idCounter = Date.now() % 100000;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

export function newPractice(name: string): Practice {
  // Default go-live: a Monday roughly 12 weeks out.
  const target = nextMonday(addDays(today(), 84));
  return {
    id: uid("pr"),
    name,
    goLive: iso(target),
    dispositions: { ...PRESETS.full.map } as DispositionMap,
    scale: { providers: 3, locations: 1, payers: 20, staff: 12 },
    taskStatus: {},
    payers: [],
    gateChecked: {},
    createdAt: iso(today()),
  };
}

export function defaultPayerRows(): PayerRow[] {
  // Seed rows reflect the enrollment model: a small number of payers is most
  // of the revenue. Names are placeholders for the lead to replace.
  const cell = () => ({ status: "none" as const });
  return [
    { id: uid("py"), name: "Medicare", share: 32, e837: cell(), e835: cell(), eft: cell() },
    { id: uid("py"), name: "BCBS", share: 24, e837: cell(), e835: cell(), eft: cell() },
    { id: uid("py"), name: "Aetna", share: 14, e837: cell(), e835: cell(), eft: cell() },
    { id: uid("py"), name: "UnitedHealthcare", share: 11, e837: cell(), e835: cell(), eft: cell() },
    { id: uid("py"), name: "Medicaid", share: 8, e837: cell(), e835: cell(), eft: cell() },
  ];
}

export function usePractices() {
  const [practices, setPractices] = useState<Practice[]>(() => {
    const stored = load<Practice[]>(PRACTICES_KEY, []);
    return stored.length ? stored : [{ ...newPractice("New practice"), payers: defaultPayerRows() }];
  });
  useEffect(() => save(PRACTICES_KEY, practices), [practices]);
  return [practices, setPractices] as const;
}

export function useDurations() {
  const [durations, setDurations] = useState<DurationsConfig>(() => {
    const stored = load<DurationsConfig>(SETTINGS_KEY, DEFAULT_DURATIONS);
    // Merge so new duration keys added in code appear for existing users.
    return { ...DEFAULT_DURATIONS, ...stored };
  });
  useEffect(() => save(SETTINGS_KEY, durations), [durations]);
  return [durations, setDurations] as const;
}
