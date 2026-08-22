import { useMemo, useState } from "react";
import type { Practice, ScheduledTask, TaskStatus } from "../domain/types";
import { PRESETS, SYSTEMS } from "../domain/systems";
import { STREAMS } from "../domain/library";
import { classify, QUESTIONS, TYPE_META } from "../domain/classify";
import { deriveConflicts } from "../domain/conflicts";
import type { PlanResult } from "../engine/schedule";
import { addDays, deriveMilestones, fmt, fmtShort, isMonday, iso, tLabel, tWeekLabel } from "../engine/schedule";
import { buildSummary, downloadCsv } from "../exports";

interface Props {
  practice: Practice;
  plan: PlanResult;
  update: (patch: Partial<Practice>, summary: string) => void;
}

const STATUS_CYCLE: TaskStatus[] = ["pending", "active", "done"];
const STATUS_OPTIONS: { v: TaskStatus; label: string }[] = [
  { v: "pending", label: "—" },
  { v: "active", label: "Active" },
  { v: "done", label: "Done" },
  { v: "risk", label: "At risk" },
  { v: "blocked", label: "Blocked" },
];

export default function Planner({ practice, plan, update }: Props) {
  const [critOnly, setCritOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const implType = classify(practice.classification);
  const epcsStarted = ["EPX1", "EPX4", "EPX5", "EPX6", "EPX8"].some(
    (id) => practice.progress[id]?.status === "done" || practice.progress[id]?.status === "active"
  );
  const conflicts = useMemo(
    () => deriveConflicts(practice, plan.scopeCtx, plan.billingShortBy, epcsStarted),
    [practice, plan.scopeCtx, plan.billingShortBy, epcsStarted]
  );
  const milestones = useMemo(() => deriveMilestones(plan), [plan]);

  const setStatus = (t: ScheduledTask, v: TaskStatus) => {
    const progress = { ...practice.progress };
    if (v === "pending") delete progress[t.id];
    else progress[t.id] = { status: v, completedOn: v === "done" ? iso(new Date()) : progress[t.id]?.completedOn };
    update({ progress }, `${t.id} → ${v}`);
  };
  const cycleStatus = (t: ScheduledTask) => {
    const i = STATUS_CYCLE.indexOf(t.status);
    setStatus(t, STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] ?? "pending");
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildSummary(practice, plan, conflicts));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const weekOf = (off: number) => (off > 0 ? Math.ceil(off / 7) : off === 0 ? 0 : -Math.ceil(-off / 7));
  const groups = useMemo(() => {
    const map = new Map<number, ScheduledTask[]>();
    for (const t of plan.tasks) {
      if (critOnly && !t.critical) continue;
      if (openOnly && (t.status === "done")) continue;
      const w = weekOf(t.endOffset);
      (map.get(w) ?? map.set(w, []).get(w)!).push(t);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [plan.tasks, critOnly, openOnly]);

  const doneCount = plan.tasks.filter((t) => t.status === "done").length;
  const goLiveNotMonday = !isMonday(plan.goLive);
  const gapDays = plan.billingRunway - plan.buildRunway;

  return (
    <div>
      {/* ---- classification ---- */}
      <section className="panel no-print">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
          <div style={{ flex: "1 1 460px", borderRight: "1px solid var(--rule-soft)" }}>
            {QUESTIONS.map((q) => {
              const v = practice.classification[q.key];
              return (
                <div key={q.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: "1px solid var(--rule-soft)" }}>
                  <span style={{ flex: 1, fontSize: 12.5 }}>{q.q}</span>
                  <span style={{ fontSize: 10.5, color: "var(--ink3)", fontFamily: "var(--mono)", width: 150, textAlign: "right" }}>
                    {v ? q.yes : q.no}
                  </span>
                  <div className="seg-group" style={{ width: 96 }} role="group" aria-label={q.q}>
                    {[true, false].map((b) => (
                      <button
                        key={String(b)}
                        className={`seg${v === b ? (b ? " on-move" : " on-stay") : ""}`}
                        aria-pressed={v === b}
                        onClick={() =>
                          update(
                            { classification: { ...practice.classification, [q.key]: b } },
                            `Classification: ${q.key} = ${b ? "yes" : "no"}`
                          )
                        }
                      >
                        {b ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ flex: "1 1 300px", padding: "14px 18px", background: "var(--anchor-bg)" }}>
            <div className="kicker">Implementation type · recorded at kickoff</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700, color: "var(--anchor)", margin: "4px 0" }}>
              {TYPE_META[implType].name}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.5 }}>{TYPE_META[implType].situation}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink2)", marginTop: 6 }}>{TYPE_META[implType].duration}</div>
            {practice.classification.submitterChanges && (
              <div style={{ fontSize: 11.5, marginTop: 8, color: "var(--move)", fontWeight: 600 }}>
                Submitter changes → §11b EDI enrollment in scope IN FULL{implType === "B" ? " — even though payer contracts are untouched" : ""}.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---- scope inputs ---- */}
      <section className="panel no-print">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, padding: "14px 16px", borderBottom: "1px solid var(--rule-soft)", alignItems: "flex-end" }}>
          <label>
            <span className="field-label">Go-live date</span>
            <input type="date" value={practice.goLive}
              onChange={(e) => e.target.value && update({ goLive: e.target.value }, `Go-live → ${e.target.value}`)} />
          </label>
          <Num label="Providers" v={practice.scale.providers} set={(n) => update({ scale: { ...practice.scale, providers: n } }, `Providers → ${n}`)} />
          <Num label="Prescribers" v={practice.scale.prescribers} min={0} set={(n) => update({ scale: { ...practice.scale, prescribers: n } }, `Prescribers → ${n}`)} />
          <Num label="Locations" v={practice.scale.locations} set={(n) => update({ scale: { ...practice.scale, locations: n } }, `Locations → ${n}`)} />
          <Num label="Payers" v={practice.scale.payers} set={(n) => update({ scale: { ...practice.scale, payers: n } }, `Payers → ${n}`)} />
          <Num label="Staff" v={practice.scale.staff} set={(n) => update({ scale: { ...practice.scale, staff: n } }, `Staff → ${n}`)} />
          <div className="toolbar" style={{ marginLeft: "auto" }}>
            <span className="kicker">Disposition preset</span>
            {Object.entries(PRESETS).map(([k, p]) => (
              <button key={k} className="btn ghost small" title={p.blurb}
                onClick={() => update({ dispositions: { ...p.map } }, `Preset: ${p.name}`)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="disp-grid">
          {SYSTEMS.map((s) => {
            const v = practice.dispositions[s.k];
            return (
              <div className="disp-row" key={s.k}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="disp-name" style={v === "na" ? { color: "var(--na)" } : undefined}>{s.label}</div>
                  <div className="disp-hint">{s.hint}</div>
                </div>
                <div className="seg-group" role="group" aria-label={`${s.label} disposition`}>
                  {(["move", "stay", "na"] as const).map((d) => (
                    <button key={d} className={`seg${v === d ? ` on-${d}` : ""}`} aria-pressed={v === d}
                      onClick={() => update({ dispositions: { ...practice.dispositions, [s.k]: d } }, `${s.label} → ${d}`)}>
                      {d === "move" ? "Moves" : d === "stay" ? "Stays" : "N/A"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- two-clock verdict ---- */}
      <section className={`panel verdict ${plan.buildFeasible && plan.billingFeasible ? "good" : "bad"}`} aria-live="polite">
        <div className="verdict-stats">
          <Stat label="Build-ready · we control it"
            v={plan.buildFeasible ? "ACHIEVABLE" : "NOT ACHIEVABLE"} danger={!plan.buildFeasible}
            sub={plan.buildFeasible ? `${-plan.buildShortBy}d slack · earliest ${fmt(plan.earliestBuildReady)}` : `short ${plan.buildShortBy}d · earliest ${fmt(plan.earliestBuildReady)}`} />
          <Stat label="Billing-ready · third parties"
            v={plan.billingFeasible ? "ACHIEVABLE" : "NOT ACHIEVABLE"} danger={!plan.billingFeasible}
            sub={plan.billingFeasible ? `${-plan.billingShortBy}d slack · earliest ${fmt(plan.earliestBillingReady)}` : `short ${plan.billingShortBy}d · earliest ${fmt(plan.earliestBillingReady)}`} />
          <Stat label="Go-live" v={fmt(plan.goLive)} strong sub="T-0 · Monday open" />
          <Stat label="Earliest defensible go-live" v={fmt(plan.earliestGoLive)} sub="Monday on/after both clocks clear"
            danger={!plan.buildFeasible || !plan.billingFeasible} />
          <Stat label="Clock gap" v={`${Math.abs(gapDays)}d`}
            sub={gapDays > 0 ? "billing trails build — the practice could see patients it cannot bill for" : "build is the longer clock"} />
          <Stat label="Work starts" v={fmt(plan.kickoff)} sub={tLabel(Math.max(plan.buildRunway, plan.billingRunway))} />
        </div>
        {goLiveNotMonday && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--flag)" }}>
            The chosen go-live is not a Monday. The cutover pattern is fixed: export Friday, import over the weekend, open Monday.
          </div>
        )}
      </section>

      {/* ---- conflicts ---- */}
      <section>
        <h2 className="section-h">What this scope exposes</h2>
        <div className="panel">
          {conflicts.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--ink2)" }}>
              No structural conflicts in this scope. Re-check after any change.
            </div>
          ) : conflicts.map((c, i) => (
            <div className="conflict-row" key={i}>
              <span className={`conflict-n ${c.severity}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="conflict-text">{c.text}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="two-col" style={{ marginTop: 20 }}>
        <section>
          <h2 className="section-h">Workstreams against the date</h2>
          <div className="panel" style={{ padding: "16px 16px 10px" }}>
            <SpanChart plan={plan} />
          </div>
        </section>
        <section>
          <h2 className="section-h">Milestones</h2>
          <div className="panel">
            {milestones.map((m, i) => (
              <div key={i} className={`ms-row${m.anchor ? " anchor" : ""}`}>
                <span className={`ms-t${m.offset < 0 ? " post" : ""}`}>{tLabel(m.offset)}</span>
                <span className="ms-date">{fmtShort(m.date)}</span>
                <span className="ms-label">{m.label}</span>
                {m.done && <span className="ms-done">DONE</span>}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ---- schedule ---- */}
      <section style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h2 className="section-h" style={{ margin: 0 }}>
            Work-back schedule
            <span style={{ color: "var(--ink3)", fontWeight: 400, marginLeft: 10, letterSpacing: 0 }}>
              {doneCount}/{plan.tasks.length} done
            </span>
          </h2>
          <div className="toolbar no-print">
            <button className="btn ghost small" aria-pressed={openOnly} onClick={() => setOpenOnly((v) => !v)}>
              {openOnly ? "Showing open only" : "Hide done"}
            </button>
            <button className="btn ghost small" aria-pressed={critOnly} onClick={() => setCritOnly((v) => !v)}>
              {critOnly ? "Showing critical path" : "Critical path only"}
            </button>
            <button className="btn ghost small" onClick={copySummary}>{copied ? "Copied" : "Copy summary"}</button>
            <button className="btn ghost small" onClick={() => window.print()}>Print</button>
            <button className="btn small" onClick={() => downloadCsv(practice, plan)}>Download CSV</button>
          </div>
        </div>

        <div className="panel tbl-wrap" style={{ marginTop: 10 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="no-print" aria-label="quick toggle"></th>
                <th>ID</th>
                <th>Task</th>
                <th>Owner</th>
                <th className="num">Start</th>
                <th className="num">Due</th>
                <th className="num">Days</th>
                <th className="no-print">Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([week, rows]) => (
                <WeekGroup key={week} week={week} rows={rows} setStatus={setStatus} cycle={cycleStatus} />
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-soft)", marginTop: 8 }}>
          ★ = hard gate (v5). ▲ = critical path, computed from binding dependency edges. ● = deadline pulled earlier than its
          playbook target by a downstream chain. EXT = third-party clock. Durations are calendar days and{" "}
          <span style={{ color: "var(--amber)" }}>estimates until observed data replaces them</span> (Assumptions).
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function WeekGroup({ week, rows, setStatus, cycle }: {
  week: number;
  rows: ScheduledTask[];
  setStatus: (t: ScheduledTask, v: TaskStatus) => void;
  cycle: (t: ScheduledTask) => void;
}) {
  return (
    <>
      <tr className="week-head">
        <td colSpan={8}>
          {tWeekLabel(week)}
          <span style={{ fontWeight: 400, color: "var(--ink-soft)", marginLeft: 10 }}>
            due {fmtShort(rows[0].endDate)}{rows.length > 1 ? ` – ${fmtShort(rows[rows.length - 1].endDate)}` : ""}
          </span>
        </td>
      </tr>
      {rows.map((t) => {
        const ws = STREAMS.find((w) => w.k === t.stream);
        return (
          <tr key={t.id} className={`row-${t.status}`}>
            <td className="no-print" style={{ width: 30 }}>
              <button
                className={`quick-done${t.status === "done" ? " is-done" : t.status === "active" ? " is-active" : ""}`}
                title={`${t.id}: click to cycle — pending → active → done`}
                aria-label={`Cycle status for ${t.id}, currently ${t.status}`}
                onClick={() => cycle(t)}
              >
                {t.status === "done" ? "✓" : t.status === "active" ? "◐" : ""}
              </button>
            </td>
            <td className="task-id" title={ws?.label}>
              <span style={{ display: "inline-block", width: 7, height: 7, background: ws?.color, marginRight: 6 }} />
              {t.id}
              {t.gate && <span style={{ color: "var(--amber)" }} title="Hard gate"> ★</span>}
              {t.critical && <span className="crit-mark" title="Critical path"> ▲</span>}
              {t.pulledByDeps && <span className="pulled" title="Pulled earlier than its playbook target by dependencies"> ●</span>}
              {t.clockResolved === "external" && <div style={{ fontSize: 8.5, color: "var(--post)", letterSpacing: ".08em" }}>EXT</div>}
            </td>
            <td>
              <div className="task-title">{t.title}</div>
              {t.note && <div className="task-note">{t.note}</div>}
            </td>
            <td style={{ fontSize: 12, color: t.owner === "Cust" ? "var(--move)" : "var(--ink2)", whiteSpace: "nowrap", fontWeight: t.owner === "Cust" ? 600 : 400 }}>
              {t.owner}
            </td>
            <td className="num">
              {fmtShort(t.startDate)}
              <div style={{ fontSize: 9.5, color: "var(--ink-soft)" }}>{tLabel(t.startOffset)}</div>
            </td>
            <td className="num" style={t.critical ? { color: "var(--flag)", fontWeight: 700 } : undefined}>
              {fmtShort(t.endDate)}
              <div style={{ fontSize: 9.5, color: "var(--ink-soft)", fontWeight: 400 }}>{tLabel(t.endOffset)}</div>
            </td>
            <td className="num">{t.durationDays}</td>
            <td className="no-print">
              <select className={`status-select st-${t.status}`} value={t.status}
                aria-label={`Status for ${t.id}`}
                onChange={(e) => setStatus(t, e.target.value as TaskStatus)}>
                {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              {t.completedOn && <div style={{ fontSize: 9, color: "var(--ok)", fontFamily: "var(--mono)", marginTop: 2 }}>{t.completedOn}</div>}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function SpanChart({ plan }: { plan: PlanResult }) {
  const lead = Math.max(plan.buildRunway, plan.billingRunway) || 1;
  const tail = plan.tailDays;
  const span = lead + tail || 1;
  const pos = (off: number) => ((lead - off) / span) * 100;

  const groups = STREAMS.map((w) => {
    const rows = plan.tasks.filter((t) => t.stream === w.k);
    if (!rows.length) return null;
    return {
      ...w,
      start: Math.max(...rows.map((r) => r.startOffset)),
      end: Math.min(...rows.map((r) => r.endOffset)),
      crit: rows.some((r) => r.critical),
      done: rows.filter((r) => r.status === "done").length,
      total: rows.length,
    };
  }).filter((g): g is NonNullable<typeof g> => g !== null);

  return (
    <div style={{ position: "relative" }}>
      <div className="gantt-anchor" style={{ left: `${pos(0)}%` }} />
      <div className="gantt-anchor-label" style={{ left: `${pos(0)}%` }}>GO-LIVE</div>
      <div style={{ paddingTop: 12 }}>
        {groups.map((g) => {
          const l = pos(g.start);
          const w = Math.max(1.2, pos(g.end) - l);
          return (
            <div className="span-row" key={g.k}>
              <div className="span-head">
                <span>{g.label} <span style={{ color: "var(--ink-soft)" }}>{g.done}/{g.total}</span></span>
                <span style={{ color: "var(--ink-soft)" }}>{tLabel(g.start)} → {tLabel(g.end)}</span>
              </div>
              <div className="span-track">
                <div className={`span-bar${g.crit ? " crit" : ""}`} style={{ left: `${l}%`, width: `${w}%`, background: g.color }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-soft)", borderTop: "1px solid var(--rule-soft)", paddingTop: 5, marginTop: 4 }}>
        <span>{fmtShort(plan.kickoff)}</span>
        <span>{iso(plan.goLive)}</span>
        <span>{fmtShort(addDays(plan.goLive, tail))}</span>
      </div>
    </div>
  );
}

function Stat({ label, v, sub, strong, danger }: { label: string; v: string; sub?: string; strong?: boolean; danger?: boolean }) {
  return (
    <div style={{ maxWidth: 250 }}>
      <div className="stat-label">{label}</div>
      <div className={`stat-v${strong ? " strong" : ""}${danger ? " danger" : ""}`}>{v}</div>
      {sub && <div className={`stat-sub${danger ? " danger" : ""}`}>{sub}</div>}
    </div>
  );
}

function Num({ label, v, set, min = 1 }: { label: string; v: number; set: (n: number) => void; min?: number }) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <input type="number" min={min} value={v} style={{ width: 64 }}
        onChange={(e) => set(Math.max(min, parseInt(e.target.value || String(min), 10)))} />
    </label>
  );
}
