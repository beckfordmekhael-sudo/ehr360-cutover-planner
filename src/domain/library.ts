import type { Cond, TaskDef } from "./types";
import tasksJson from "../data/tasks.json";
import deliverablesJson from "../data/deliverables.json";
import readinessJson from "../data/readiness.json";
import neuroPayersJson from "../data/neuro-heart-payers.json";

/*
 * Typed access to the data files. The library is data, not code (v5 brief §8):
 * a non-engineer edits the JSON; this module only casts and indexes it.
 */

export interface StreamDef { k: string; label: string; color: string }

export const STREAMS = tasksJson.streams as StreamDef[];
export const TASKS = tasksJson.tasks as unknown as TaskDef[];
export const TASK_BY_ID = new Map(TASKS.map((t) => [t.id, t]));

export interface DeliverableDef {
  n: number;
  text: string;
  category: string;
  dueWeek: number;
  dueDays?: number;
  dueLabel?: string;
  applies: Cond;
}
export const DELIVERABLES = deliverablesJson.items as unknown as DeliverableDef[];

export interface GateDef {
  id: string;
  text: string;
  owner: "EHR" | "Cust" | "Joint";
  evidence: string;
  applies: Cond;
}
export const READINESS_GATE = readinessJson.items as unknown as GateDef[];

export interface SeedPayer { name: string; payerId: string; variants: number; share: number }
export const NEURO_HEART_PAYERS = (neuroPayersJson as { payers: SeedPayer[] }).payers;

/** Sanity checks, run by tests and at dev startup: unique ids, resolvable deps. */
export function validateLibrary(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const t of TASKS) {
    if (seen.has(t.id)) errors.push(`Duplicate task id: ${t.id}`);
    seen.add(t.id);
    if (t.days == null && t.durKey == null) errors.push(`${t.id}: no duration (days or durKey)`);
    for (const d of t.deps ?? []) {
      if (!TASK_BY_ID.has(d)) errors.push(`${t.id}: unknown dependency ${d}`);
    }
  }
  return errors;
}
