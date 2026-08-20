import { useMemo, useState } from "react";
import type { Practice } from "./domain/types";
import { computePlan, enrollmentCoverage, fmt, parseISO, phaseOf, redItems, daysBetween, today } from "./engine/schedule";
import { defaultPayerRows, newPractice, useDurations, usePractices } from "./store";
import Planner from "./components/Planner";
import PayerTracker from "./components/PayerTracker";
import { Deliverables, ReadinessGate } from "./components/ClientViews";
import Prefill from "./components/Prefill";
import Settings from "./components/Settings";

type Tab = "plan" | "payers" | "deliverables" | "gate" | "prefill" | "settings";

const TABS: { k: Tab; label: string }[] = [
  { k: "plan", label: "Plan" },
  { k: "payers", label: "Payer enrollment" },
  { k: "deliverables", label: "Client deliverables" },
  { k: "gate", label: "Readiness gate" },
  { k: "prefill", label: "Form pre-fill" },
  { k: "settings", label: "Assumptions" },
];

export default function App() {
  const [practices, setPractices] = usePractices();
  const [durations, setDurations] = useDurations();
  const [selectedId, setSelectedId] = useState<string | null>(practices.length === 1 ? practices[0].id : null);
  const [tab, setTab] = useState<Tab>("plan");

  const selected = practices.find((p) => p.id === selectedId) ?? null;
  const plan = useMemo(
    () => (selected ? computePlan(selected, durations) : null),
    [selected, durations]
  );

  const updateSelected = (patch: Partial<Practice>) => {
    if (!selected) return;
    setPractices(practices.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)));
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
            <button className="btn ghost small" onClick={() => setSelectedId(null)}>
              ← All practices
            </button>
          )}
          <span className="est-note">
            All durations are estimates until the first completed migration replaces them with observed data.
          </span>
        </div>
      </header>

      <main className="shell">
        {!selected && (
          <Portfolio
            practices={practices}
            durations={durations}
            onOpen={(id) => { setSelectedId(id); setTab("plan"); }}
            onCreate={() => {
              const p = { ...newPractice(`Practice ${practices.length + 1}`), payers: defaultPayerRows() };
              setPractices([...practices, p]);
              setSelectedId(p.id);
              setTab("plan");
            }}
            onDelete={(id) => {
              if (!window.confirm("Remove this practice and its tracked progress?")) return;
              setPractices(practices.filter((p) => p.id !== id));
            }}
          />
        )}

        {selected && plan && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginTop: 18 }} className="no-print">
              <input
                type="text"
                value={selected.name}
                aria-label="Practice name"
                onChange={(e) => updateSelected({ name: e.target.value })}
                style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 700, textTransform: "uppercase", border: "none", borderBottom: "1px dashed var(--rule)", background: "transparent", padding: "2px 0", minWidth: 240 }}
              />
              <span className="kicker">
                go-live {fmt(parseISO(selected.goLive))} · phase: {phaseOf(plan)}
              </span>
            </div>

            <nav className="tabs no-print" role="tablist" aria-label="Practice views">
              {TABS.map((t) => {
                const badge =
                  t.k === "plan" && !plan.feasible ? "!" :
                  t.k === "payers" && !enrollmentCoverage(selected).gatePassed && (selected.dispositions.claims === "move" || selected.dispositions.remit === "move") ? "!" : null;
                return (
                  <button
                    key={t.k}
                    className="tab"
                    role="tab"
                    aria-selected={tab === t.k}
                    onClick={() => setTab(t.k)}
                  >
                    {t.label}
                    {badge && <span className="badge" aria-label="attention">{badge}</span>}
                  </button>
                );
              })}
            </nav>

            {tab === "plan" && <Planner practice={selected} plan={plan} update={updateSelected} />}
            {tab === "payers" && <PayerTracker practice={selected} update={updateSelected} />}
            {tab === "deliverables" && <Deliverables practice={selected} />}
            {tab === "gate" && <ReadinessGate practice={selected} update={updateSelected} />}
            {tab === "prefill" && <Prefill />}
            {tab === "settings" && <Settings durations={durations} setDurations={setDurations} />}
          </>
        )}
      </main>
    </>
  );
}

/* ------------------------------ portfolio ------------------------------ */

function Portfolio({ practices, durations, onOpen, onCreate, onDelete }: {
  practices: Practice[];
  durations: ReturnType<typeof useDurations>[0];
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
      <div className="pf-grid">
        {practices.map((p) => {
          const plan = computePlan(p, durations);
          const reds = redItems(p, plan);
          const goLive = parseISO(p.goLive);
          const doneCount = plan.tasks.filter((t) => t.status === "done").length;
          const days = daysBetween(today(), goLive);
          return (
            <div key={p.id} style={{ position: "relative" }}>
              <button className="pf-card" onClick={() => onOpen(p.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 13.5, fontWeight: 700, textTransform: "uppercase" }}>{p.name}</span>
                  <span className="kicker">{phaseOf(plan)}</span>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink2)", margin: "6px 0 8px" }}>
                  go-live {fmt(goLive)}
                  <span style={{ color: "var(--ink3)" }}> · {days >= 0 ? `in ${days}d` : `${-days}d ago`}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                  {doneCount}/{plan.tasks.length} tasks done · {plan.tasks.filter((t) => t.critical).length} on critical path
                </div>
                <div style={{ marginTop: 8, minHeight: 18 }}>
                  {reds.length
                    ? reds.map((r, i) => <span key={i} className="red-chip">{r}</span>)
                    : <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ok)" }}>ON TRACK</span>}
                </div>
              </button>
              <button
                className="btn ghost small"
                style={{ position: "absolute", top: 8, right: 8 }}
                aria-label={`Delete ${p.name}`}
                onClick={() => onDelete(p.id)}
              >×</button>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink3)", marginTop: 14 }}>
        Data lives in this browser (localStorage) — per practice: scope, dates, task status, payer enrollments, and gate
        confirmations. Duration assumptions are shared across practices.
      </p>
    </section>
  );
}
