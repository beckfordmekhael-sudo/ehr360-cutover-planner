import { useMemo, useState } from "react";
import type { Practice, ScheduledTask, TaskStatus } from "../domain/types";
import { PRESETS, SYSTEMS } from "../domain/systems";
import { WORKSTREAMS } from "../domain/tasks";
import { deriveConflicts } from "../domain/conflicts";
import type { PlanResult } from "../engine/schedule";
import { deriveMilestones, fmt, fmtShort, isMonday, iso, tLabel, tWeekLabel } from "../engine/schedule";
import { buildSummary, downloadCsv } from "../exports";

interface Props {
  practice: Practice;
  plan: PlanResult;
  update: (patch: Partial<Practice>) => void;
}

const STATUS_OPTIONS: { v: TaskStatus; label: string }[] = [
  { v: "pending", label: "—" },
  { v: "active", label: "Active" },
  { v: "done", label: "Done" },
  { v: "risk", label: "At risk" },
  { v: "blocked", label: "Blocked" },
];

export default function Planner({ practice, plan, update }: Props) {
  const [critOnly, setCritOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const conflicts = useMemo(
    () => deriveConflicts(practice.dispositions, practice.scale, plan.shortBy),
    [practice.dispositions, practice.scale, plan.shortBy]
  );
  const milestones = useMemo(() => deriveMilestones(plan), [plan]);

  const counts = useMemo(() => {
    const c = { move: 0, stay: 0, na: 0 };
    Object.values(practice.dispositions).forEach((v) => c[v]++);
    return c;
  }, [practice.dispositions]);

  const setStatus = (id: string, v: TaskStatus) => {
    const next = { ...practice.taskStatus };
    if (v === "pending") delete next[id];
    else next[id] = v;
    update({ taskStatus: next });
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildSummary(practice, plan, conflicts));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  /* ------ week grouping ------ */
  const weekOf = (off: number) => (off > 0 ? Math.ceil(off / 7) : off === 0 ? 0 : -Math.ceil(-off / 7));
  const groups = useMemo(() => {
    const map = new Map<number, ScheduledTask[]>();
    for (const t of plan.tasks) {
      if (critOnly && !t.critical) continue;
      const w = weekOf(t.endOffset);
      const arr = map.get(w) ?? [];
      arr.push(t);
      map.set(w, arr);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [plan.tasks, critOnly]);

  const goLiveNotMonday = !isMonday(plan.goLive);

  return (
    <div>
      {/* ---- scope inputs ---- */}
      <section className="panel no-print">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: "14px 16px", borderBottom: "1px solid var(--rule-soft)", alignItems: "flex-end" }}>
          <label>
            <span className="field-label">Go-live date</span>
            <input
              type="date"
              value={practice.goLive}
              onChange={(e) => e.target.value && update({ goLive: e.target.value })}
            />
          </label>
          <NumField label="Providers" v={practice.scale.providers} set={(n) => update({ scale: { ...practice.scale, providers: n } })} />
          <NumField label="Locations" v={practice.scale.locations} set={(n) => update({ scale: { ...practice.scale, locations: n } })} />
          <NumField label="Payers" v={practice.scale.payers} set={(n) => update({ scale: { ...practice.scale, payers: n } })} />
          <NumField label="Staff" v={practice.scale.staff} set={(n) => update({ scale: { ...practice.scale, staff: n } })} />
          <div className="toolbar" style={{ marginLeft: "auto" }}>
            <span className="kicker" style={{ marginRight: 2 }}>Deal shape</span>
            {Object.entries(PRESETS).map(([k, p]) => (
              <button key={k} className="btn ghost small" title={p.blurb} onClick={() => update({ dispositions: { ...p.map } })}>
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
                    <button
                      key={d}
                      className={`seg${v === d ? ` on-${d}` : ""}`}
                      aria-pressed={v === d}
                      onClick={() => update({ dispositions: { ...practice.dispositions, [s.k]: d } })}
                    >
                      {d === "move" ? "Moves" : d === "stay" ? "Stays" : "N/A"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "10px 16px", display: "flex", gap: 14, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink2)" }}>
          <span style={{ color: "var(--move)" }}>{counts.move} moving</span>
          <span style={{ color: "var(--stay)" }}>{counts.stay} staying</span>
          <span style={{ color: "var(--na)" }}>{counts.na} out of scope</span>
          <span style={{ marginLeft: "auto", color: "var(--ink3)" }}>{plan.tasks.length} tasks in scope</span>
        </div>
      </section>

      {/* ---- verdict ---- */}
      <section className={`panel verdict ${plan.feasible ? "good" : "bad"}`} aria-live="polite">
        <div className="verdict-stats">
          <Stat label="Verdict" v={plan.feasible ? "ACHIEVABLE" : "NOT ACHIEVABLE"} danger={!plan.feasible}
            sub={plan.feasible ? `${-plan.shortBy} days of slack` : `short by ${plan.shortBy} days`} />
          <Stat label="Work starts" v={fmt(plan.kickoff)} sub={tLabel(plan.requiredRunway)} />
          <Stat label="Go-live" v={fmt(plan.goLive)} strong sub="T-0 · Monday open" />
          <Stat label="Earliest realistic go-live" v={fmt(plan.earliestGoLive)} sub="from today, Monday-snapped" danger={!plan.feasible} />
          <Stat label="Critical path" v={`${plan.requiredRunway} days`} sub={`${plan.tasks.filter((t) => t.critical).length} gating tasks`} />
          <Stat label="Stabilization through" v={fmt(new Date(plan.goLive.getTime() + plan.tailDays * 86400000))} sub={`T+${plan.tailDays}`} />
        </div>
        {goLiveNotMonday && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--flag)" }}>
            The chosen go-live is not a Monday. The cutover pattern is fixed: final export Friday, import over the weekend, open Monday morning.
          </div>
        )}
      </section>

      {/* ---- conflicts ---- */}
      <section>
        <h2 className="section-h">What this scope exposes</h2>
        <div className="panel">
          {conflicts.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--ink2)" }}>
              No structural conflicts in this scope. Re-check after any disposition change.
            </div>
          ) : (
            conflicts.map((c, i) => (
              <div className="conflict-row" key={i}>
                <span className={`conflict-n ${c.severity}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="conflict-text">{c.text}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="two-col" style={{ marginTop: 20 }}>
        {/* ---- workstream spans ---- */}
        <section>
          <h2 className="section-h">Workstreams against the date</h2>
          <div className="panel" style={{ padding: "16px 16px 10px" }}>
            <SpanChart plan={plan} />
          </div>
        </section>

        {/* ---- milestones ---- */}
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
          <h2 className="section-h" style={{ margin: 0 }}>Work-back schedule</h2>
          <div className="toolbar no-print">
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
                <WeekGroup key={week} week={week} rows={rows} setStatus={setStatus} />
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink3)", marginTop: 8 }}>
          ▲ = critical path, computed from the dependency graph. ● = deadline pulled earlier than its playbook target by a
          downstream chain. Durations are calendar days, scale with practice size, and are <span style={{ color: "var(--amber)" }}>estimates until observed data replaces them</span> (Settings).
        </div>
      </section>

      {/* ---- open questions ---- */}
      <section style={{ marginTop: 20 }}>
        <h2 className="section-h">Open questions this plan does not paper over</h2>
        <div className="panel" style={{ fontSize: 12.5 }}>
          {[
            ["Timeline", "The playbook says 8 weeks standard (10–12 complex); a separate internal workflow says 3–5 weeks. The 3–5 figure appears to describe the build phase only — EDI enrollment alone runs 30–45+ days per payer. Confirm which number is external before it reaches a client. This tool schedules from the playbook."],
            ["Go-live authority", "The readiness gate exists; the deciding authority is not named. Every go/no-go call needs a named decision-maker."],
            ["Practice keeps its own billing", "Removes or reshapes the entire billing workstream. Flagged in scope warnings when claims move but the billing team stays."],
            ["Discrete vs PDF notes, by source EMR", "Determines whether staff still re-key patient history after go-live. Must be known before it is promised — surfaced on the migration-scope task."],
            ["Open A/R at cutover", "Who works it, in which system, for how long. No standard answer exists; the plan forces a written agreement at T-2 and tracks runout to T+13 weeks."],
            ["Legacy read-only access", "Duration, cost, who pays. Should be a contract standard, not negotiated per deal."],
          ].map(([h, body], i) => (
            <div key={i} style={{ padding: "9px 16px", borderBottom: i < 5 ? "1px solid var(--rule-soft)" : "none", display: "flex", gap: 12 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--amber)", flexShrink: 0, width: 18 }}>Q{i + 1}</span>
              <span><strong style={{ fontWeight: 650 }}>{h}.</strong> {body}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function WeekGroup({ week, rows, setStatus }: {
  week: number;
  rows: ScheduledTask[];
  setStatus: (id: string, v: TaskStatus) => void;
}) {
  return (
    <>
      <tr className="week-head">
        <td colSpan={7}>
          {tWeekLabel(week)}
          <span style={{ fontWeight: 400, color: "var(--ink3)", marginLeft: 10 }}>
            due {fmtShort(rows[0].endDate)}{rows.length > 1 ? ` – ${fmtShort(rows[rows.length - 1].endDate)}` : ""}
          </span>
        </td>
      </tr>
      {rows.map((t) => {
        const ws = WORKSTREAMS.find((w) => w.k === t.workstream)!;
        return (
          <tr key={t.id} className={`row-${t.status}`}>
            <td className="task-id" title={ws.label}>
              <span style={{ display: "inline-block", width: 7, height: 7, background: ws.color, marginRight: 6 }} />
              {t.id}
              {t.critical && <span className="crit-mark" title="Critical path"> ▲</span>}
              {t.pulledByDeps && <span className="pulled" title="Deadline pulled earlier than its playbook target by dependencies"> ●</span>}
            </td>
            <td>
              <div className="task-title">{t.title}</div>
              {t.note && (
                <div className="task-note">
                  {t.note.startsWith("OPEN QUESTION") ? (<><span className="oq">Open question.</span> {t.note.slice(t.note.indexOf(":") + 1).trim()}</>) : t.note}
                </div>
              )}
            </td>
            <td style={{ fontSize: 12, color: t.owner === "Customer" ? "var(--move)" : "var(--ink2)", whiteSpace: "nowrap", fontWeight: t.owner === "Customer" ? 600 : 400 }}>
              {t.owner}
            </td>
            <td className="num">
              {fmtShort(t.startDate)}
              <div style={{ fontSize: 9.5, color: "var(--ink3)" }}>{tLabel(t.startOffset)}</div>
            </td>
            <td className="num" style={t.critical ? { color: "var(--flag)", fontWeight: 700 } : undefined}>
              {fmtShort(t.endDate)}
              <div style={{ fontSize: 9.5, color: "var(--ink3)", fontWeight: 400 }}>{tLabel(t.endOffset)}</div>
            </td>
            <td className="num">{t.durationDays}</td>
            <td className="no-print">
              <select
                className={`status-select st-${t.status}`}
                value={t.status}
                aria-label={`Status for ${t.id}`}
                onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>{o.label}</option>
                ))}
              </select>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function SpanChart({ plan }: { plan: PlanResult }) {
  const lead = plan.requiredRunway || 1;
  const tail = plan.tailDays;
  const span = lead + tail || 1;
  const pos = (off: number) => ((lead - off) / span) * 100;

  const groups = WORKSTREAMS.map((w) => {
    const rows = plan.tasks.filter((t) => t.workstream === w.k);
    if (!rows.length) return null;
    return {
      ...w,
      start: Math.max(...rows.map((r) => r.startOffset)),
      end: Math.min(...rows.map((r) => r.endOffset)),
      crit: rows.some((r) => r.critical),
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
                <span>{g.label}</span>
                <span style={{ color: "var(--ink3)" }}>{tLabel(g.start)} → {tLabel(g.end)}</span>
              </div>
              <div className="span-track">
                <div className={`span-bar${g.crit ? " crit" : ""}`} style={{ left: `${l}%`, width: `${w}%`, background: g.color }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink3)", borderTop: "1px solid var(--rule-soft)", paddingTop: 5, marginTop: 4 }}>
        <span>{fmtShort(plan.kickoff)}</span>
        <span>{iso(plan.goLive)}</span>
        <span>{fmtShort(new Date(plan.goLive.getTime() + tail * 86400000))}</span>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink3)", marginTop: 6 }}>
        red top edge = workstream contains a critical-path task
      </div>
    </div>
  );
}

function Stat({ label, v, sub, strong, danger }: { label: string; v: string; sub?: string; strong?: boolean; danger?: boolean }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className={`stat-v${strong ? " strong" : ""}${danger ? " danger" : ""}`}>{v}</div>
      {sub && <div className={`stat-sub${danger ? " danger" : ""}`}>{sub}</div>}
    </div>
  );
}

function NumField({ label, v, set }: { label: string; v: number; set: (n: number) => void }) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <input
        type="number"
        min={1}
        value={v}
        style={{ width: 68 }}
        onChange={(e) => set(Math.max(1, parseInt(e.target.value || "1", 10)))}
      />
    </label>
  );
}
