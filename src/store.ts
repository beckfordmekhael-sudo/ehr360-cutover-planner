import { useCallback, useEffect, useRef, useState } from "react";
import type { Classification, DispositionMap, DurationsConfig, PayerRow, Practice } from "./domain/types";
import { PRESETS } from "./domain/systems";
import { DEFAULT_DURATIONS } from "./domain/durations";
import { NEURO_HEART_PAYERS } from "./domain/library";
import { addDays, iso, nextMonday, today } from "./engine/schedule";
import { api } from "./api";

/*
 * Server-backed state. Progress tracking across weeks means a real backend,
 * not localStorage (brief §8): every write goes to the API with a summary
 * line for the audit trail, guarded by optimistic concurrency — a 409 means
 * someone else saved first, and we reload rather than clobber.
 */

export function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export const DEFAULT_CLASSIFICATION: Classification = {
  ehrReplaced: true,
  contractsUnderTin: true,
  rcmClient: false,
  submitterChanges: true,
};

export function payerRowsFromSeed(): PayerRow[] {
  return NEURO_HEART_PAYERS.map((p) => ({
    id: uid("py"),
    name: p.name,
    payerId: p.payerId,
    variants: p.variants,
    remapped: p.variants <= 1,
    share: p.share,
    e837: { status: "none" as const },
    e835: { status: "none" as const },
    eft: { status: "none" as const },
  }));
}

export function newPractice(name: string, globalDurations: DurationsConfig): Practice {
  return {
    id: uid("pr"),
    name,
    goLive: iso(nextMonday(addDays(today(), 84))),
    classification: { ...DEFAULT_CLASSIFICATION },
    dispositions: { ...PRESETS.full.map } as DispositionMap,
    scale: { providers: 3, locations: 1, payers: 20, prescribers: 3, staff: 12 },
    progress: {},
    payers: [],
    gate: {},
    eraDecision: { order: "", billingLead: "", rationale: "" },
    // Pinned at creation — a plan does not silently move when an assumption
    // changes. "Recalculate" copies the current globals explicitly.
    assumptions: structuredClone(globalDurations),
    createdAt: iso(today()),
  };
}

/* ------------------------------ session ------------------------------ */

export function useSession() {
  const [user, setUser] = useState<{ id: string; name: string } | null | undefined>(undefined);
  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);
  const login = useCallback(async (name: string, password: string) => {
    const r = await api.login(name, password);
    setUser(r.user);
  }, []);
  const register = useCallback(async (name: string, password: string) => {
    const r = await api.register(name, password);
    setUser(r.user);
  }, []);
  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);
  return { user, login, register, logout };
}

/* ----------------------------- practices ----------------------------- */

export function usePractices(loggedIn: boolean) {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Synchronous view of latest state: setState updaters run at render time,
  // so the API write must not depend on them having executed.
  const latest = useRef<Practice[]>(practices);
  latest.current = practices;

  const refresh = useCallback(async () => {
    const r = await api.listPractices();
    latest.current = r.practices;
    setPractices(r.practices);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    refresh();
    const onFocus = () => refresh().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loggedIn, refresh]);

  /** Optimistic update + audit summary; reloads on write conflict. */
  const update = useCallback(
    async (id: string, patch: Partial<Practice>, summary: string) => {
      const cur = latest.current.find((p) => p.id === id);
      if (!cur) return;
      const next: Practice = { ...cur, ...patch };
      latest.current = latest.current.map((p) => (p.id === id ? next : p));
      setPractices(latest.current);
      try {
        const r = await api.updatePractice(next, summary, next.updatedAt);
        latest.current = latest.current.map((p) => (p.id === id ? { ...p, updatedAt: r.updatedAt } : p));
        setPractices(latest.current);
      } catch (e) {
        if ((e as { status?: number }).status === 409) await refresh();
        else console.error(`Save failed (${summary}):`, e);
      }
    },
    [refresh]
  );

  const create = useCallback(async (p: Practice) => {
    await api.createPractice(p);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await api.deletePractice(id);
    setPractices((ps) => ps.filter((p) => p.id !== id));
  }, []);

  return { practices, loaded, refresh, update, create, remove };
}

/* ------------------------------ durations ----------------------------- */

export function useGlobalDurations(loggedIn: boolean) {
  const [durations, setDurations] = useState<DurationsConfig>(DEFAULT_DURATIONS);
  useEffect(() => {
    if (!loggedIn) return;
    api.getDurations().then((r) => {
      if (r.durations) setDurations({ ...DEFAULT_DURATIONS, ...r.durations });
    }).catch(() => {});
  }, [loggedIn]);
  const save = useCallback(async (d: DurationsConfig) => {
    setDurations(d);
    await api.putDurations(d);
  }, []);
  return [durations, save] as const;
}
