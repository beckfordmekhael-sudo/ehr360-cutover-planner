import { useMemo, useState } from "react";
import type { Practice } from "./domain/types";
import { classify } from "./domain/classify";
import {
  computePlan, daysBetween, enrollmentCoverage, fmt, longLeadDoneRatio, parseISO, phaseOf, redItems, today,
} from "./engine/schedule";
import { newPractice, payerRowsFromSeed, useGlobalDurations, usePractices, useSession } from "./store";
import Planner from "./components/Planner";
import PayerTracker from "./components/PayerTracker";
import { Deliverables, ReadinessGate } from "./components/ClientViews";
import Prefill from "./components/Prefill";
import Settings from "./components/Settings";
import Login from "./components/Login";
import History from "./components/History";

type Tab = "plan" | "payers" | "deliverables" | "gate" | "prefill" | "settings" | "history";

const TABS: { k: Tab; label: string }[] = [
  { k: "plan", label: "Plan" },
  { k: "payers", label: "Payer enrollment" },
  { k: "deliverables", label: "Client deliverables" },
  { k: "gate", label: "Readiness gate" },
  { k: "prefill", label: "Form pre-fill" },
  { k: "settings", label: "Assumptions" },
  { k: "history", label: "History" },
];

export default function App() {
  const { user, login, register, logout } = useSession();
  const loggedIn = !!user;
  const { practices, loaded, update, create, remove } = usePractices(loggedIn);
  const [globalDurations, saveGlobalDurations] = useGlobalDurations(loggedIn);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("plan");

  const selected = practices.find((p) => p.id === selectedId) ?? null;
  const plan = useMemo(() => (selected ? computePlan(selected) : null), [selected]);

  if (user === undefined) return null; // session check in flight
  if (!user) return <Login login={login} register={register} />;

  const updateSelected = (patch: Partial<Practice>, summary: string) => {
    if (selected) update(selected.id, patch, summary);
  };

  return (
    <>
      <header className="masthead no-print">
        <div className="masthead-inner">
          <div>
            <div className="kicker">EHR 360 · Implementation</div>
            <h1>Cutover Planner</h1>
          </div>
          {selected && (
            <button className="btn ghost small" onClick={() => setSelectedId(null)}>← All practices</button>
          )}
          <span className="est-note">All durations are estimates until the first completed migration replaces them.</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink2)" }}>
            {user.name}
            <button className="btn ghost small" style={{ marginLeft: 8 }} onClick={logout}>Sign out</button>
          </span>
        </div>
      </header>

      <main className="shell">
        {!selected && (
          <Portfolio
            practices={practices}
            loaded={loaded}
            onOpen={(id) => { setSelectedId(id); setTab("plan"); }}
            onCreate={async () => {
              const p = { ...newPractice(`Practice ${practices.length + 1}`, globalDurations), payers: payerRowsFromSeed() };
              await create(p);
              setSelectedId(p.id);
              setTab("plan");
            }}
            onDelete={(id) => {
              if (!window.confirm("Remove this practice, its tracked progress and its audit trail reference?")) return;
              remove(id);
            }}
          />
        )}

        {selected && plan && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginTop: 18 }} className="no-print">
              <input
                type="text" value={selected.name} aria-label="Practice name"
                onChange={(e) => updateSelected({ name: e.target.value }, `Renamed to "${e.target.value}"`)}
                style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 700, textTransform: "uppercase", border: "none", borderBottom: "1px dashed var(--rule)", background: "transparent", padding: "2px 0", minWidth: 240 }}
              />
              <span className="kicker">
                Type {classify(selected.classification)} · go-live {fmt(parseISO(selected.goLive))} · phase: {phaseOf(plan, longLeadDoneRatio(plan))}
              </span>
            </div>

            <nav className="tabs no-print" role="tablist" aria-label="Practice views">
              {TABS.map((t) => {
                const cov = enrollmentCoverage(selected);
                const badge =
                  t.k === "plan" && (!plan.buildFeasible || !plan.billingFeasible) ? "!" :
                  t.k === "payers" && !cov.gatePassed && (selected.dispositions.claims === "move" || selected.dispositions.remit === "move") ? "!" : null;
                return (
                  <button key={t.k} className="tab" role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}>
                    {t.label}
                    {badge && <span className="badge" aria-label="attention">{badge}</span>}
                  </button>
                );
              })}
            </nav>

            {tab === "plan" && <Planner practice={selected} plan={plan} update={updateSelected} />}
            {tab === "payers" && <PayerTracker practice={selected} update={updateSelected} />}
            {tab === "deliverables" && <Deliverables practice={selected} ctx={plan.scopeCtx} />}
            {tab === "gate" && <ReadinessGate practice={selected} ctx={plan.scopeCtx} update={updateSelected} />}
            {tab === "prefill" && <Prefill />}
            {tab === "settings" && (
              <Settings practice={selected} globalDurations={globalDurations} saveGlobal={saveGlobalDurations} update={updateSelected} />
            )}
            {tab === "history" && <History practiceId={selected.id} />}
          </>
        )}
      </main>
    </>
  );
}

/* ------------------------------ portfolio ------------------------------ */

function Portfolio({ practices, loaded, onOpen, onCreate, onDelete }: {
  practices: Practice[];
  loaded: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <h2 className="section-h" style={{ margin: 0 }}>Implementations in flight</h2>
        <button className="btn small" onClick={onCreate}>+ New practice</button>
      </div>
      {!loaded && <div style={{ color: "var(--ink-soft)" }}>Loading…</div>}
      <div className="pf-grid">
        {practices.map((p) => {
          const plan = computePlan(p);
          const reds = redItems(plan);
          const goLive = parseISO(p.goLive);
          const doneCount = plan.tasks.filter((t) => t.status === "done").length;
          const days = daysBetween(today(), goLive);
          return (
            <div key={p.id} style={{ position: "relative" }}>
              <button className="pf-card" onClick={() => onOpen(p.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 13.5, fontWeight: 700, textTransform: "uppercase" }}>{p.name}</span>
                  <span className="kicker">Type {classify(p.classification)} · {phaseOf(plan, longLeadDoneRatio(plan))}</span>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink2)", margin: "6px 0 8px" }}>
                  go-live {fmt(goLive)}
                  <span style={{ color: "var(--ink-soft)" }}> · {days >= 0 ? `in ${days}d` : `${-days}d ago`}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                  {doneCount}/{plan.tasks.length} tasks done · billing-ready {fmt(plan.earliestBillingReady)}
                </div>
                <div style={{ marginTop: 8, minHeight: 18 }}>
                  {reds.length
                    ? reds.map((r, i) => <span key={i} className="red-chip">{r}</span>)
                    : <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ok)" }}>ON TRACK</span>}
                </div>
              </button>
              <button className="btn ghost small" style={{ position: "absolute", top: 8, right: 8 }}
                aria-label={`Delete ${p.name}`} onClick={() => onDelete(p.id)}>×</button>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 14 }}>
        Server-backed: progress, payer enrollments, gate confirmations and the audit trail survive reloads and weeks
        between sessions. Duration assumptions are pinned per practice; globals live under Assumptions.
      </p>
    </section>
  );
}
