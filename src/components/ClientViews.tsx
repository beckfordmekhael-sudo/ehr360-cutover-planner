import { useMemo } from "react";
import type { GateState, Practice, ScopeCtx } from "../domain/types";
import { DELIVERABLES, READINESS_GATE } from "../domain/library";
import { evalCond } from "../domain/conditions";
import { addDays, fmt, parseISO, tLabel } from "../engine/schedule";

/*
 * Appendix A (client deliverables, personalised, printable unedited) and
 * Appendix B (readiness gate — binary, evidenced, with a documented-exception
 * path). If criteria are not met, the date moves rather than the standard.
 */

export function Deliverables({ practice, ctx }: { practice: Practice; ctx: ScopeCtx }) {
  const goLive = parseISO(practice.goLive);
  const items = useMemo(() => DELIVERABLES.filter((d) => evalCond(d.applies, ctx)), [ctx]);
  const sorted = [...items].sort((a, b) => (b.dueDays != null ? b.dueDays / 7 : b.dueWeek) - (a.dueDays != null ? a.dueDays / 7 : a.dueWeek));

  return (
    <div>
      <div className="toolbar no-print" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink2)", maxWidth: 640 }}>
          Everything the practice owes us, ordered by due date, filtered to this scope ({items.length} of{" "}
          {DELIVERABLES.length} apply). Print and hand over at kickoff — good enough to send unedited.
        </span>
        <button className="btn small" onClick={() => window.print()}>Print / save as PDF</button>
      </div>

      <div className="panel" style={{ padding: "18px 20px 6px" }}>
        <div className="kicker">EHR 360 · Implementation</div>
        <h2 style={{ fontFamily: "var(--mono)", fontSize: 17, textTransform: "uppercase", margin: "4px 0 2px" }}>
          What we need from {practice.name}
        </h2>
        <div style={{ fontSize: 12.5, color: "var(--ink2)", marginBottom: 8 }}>
          Go-live {fmt(goLive)}. Items marked <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>WEEK 1</span> gate
          long-lead work with third parties and are needed regardless of how far out go-live is.
        </div>
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 560 }}>
            <thead>
              <tr><th>#</th><th>Deliverable</th><th>Category</th><th className="num">Due</th></tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const dueOffset = d.dueDays != null ? d.dueDays : Math.round(d.dueWeek * 7);
                const due = addDays(goLive, -dueOffset);
                const isWeekOne = d.dueWeek >= 8;
                return (
                  <tr key={d.n}>
                    <td className="task-id">{d.n}</td>
                    <td style={{ fontSize: 13 }}>{d.text}</td>
                    <td style={{ fontSize: 11.5, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                      {d.category}
                      {isWeekOne && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--flag)", marginLeft: 6 }}>WEEK 1</span>}
                    </td>
                    <td className="num">
                      {d.dueLabel ?? fmt(due)}
                      <div style={{ fontSize: 9.5, color: "var(--ink-soft)" }}>{tLabel(dueOffset)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", padding: "10px 0" }}>
          Questions on any item: your implementation lead is the fastest route to an answer.
        </div>
      </div>
    </div>
  );
}

export function ReadinessGate({ practice, ctx, update }: {
  practice: Practice;
  ctx: ScopeCtx;
  update: (patch: Partial<Practice>, summary: string) => void;
}) {
  const items = useMemo(() => READINESS_GATE.filter((g) => evalCond(g.applies, ctx)), [ctx]);
  const state = (id: string): GateState => practice.gate[id] ?? { checked: false };
  const confirmed = items.filter((g) => state(g.id).checked).length;
  const excepted = items.filter((g) => !state(g.id).checked && state(g.id).exception).length;
  const allClear = confirmed + excepted === items.length && items.length > 0;

  const patch = (id: string, s: Partial<GateState>, summary: string) =>
    update({ gate: { ...practice.gate, [id]: { ...state(id), ...s } } }, summary);

  return (
    <div>
      <section className={`panel verdict ${allClear ? "good" : ""}`}>
        <div className="verdict-stats">
          <div>
            <div className="stat-label">Go-live readiness gate</div>
            <div className="stat-v strong" style={allClear ? { color: "var(--ok)" } : undefined}>
              {confirmed} / {items.length} confirmed{excepted ? ` · ${excepted} excepted` : ""}
            </div>
            <div className="stat-sub">Go/no-go call, the Wednesday before go-live. Criteria are binary and evidenced.</div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", maxWidth: 520, alignSelf: "center" }}>
            An unmet criterion is a <strong>no-go</strong> unless the named decision-maker records a documented
            exception below. If criteria are not met, the date moves rather than the standard.{" "}
            <span style={{ color: "var(--amber)" }}>Open decision 1: the deciding authority is still not designated.</span>
          </div>
        </div>
      </section>

      <div className="panel" style={{ marginTop: 16 }}>
        {items.map((g) => {
          const s = state(g.id);
          return (
            <div key={g.id} className="gate-row" style={{ flexWrap: "wrap" }}>
              <input type="checkbox" checked={s.checked} id={`gate-${g.id}`}
                onChange={(e) => patch(g.id, { checked: e.target.checked }, `Gate ${g.id} ${e.target.checked ? "confirmed" : "unconfirmed"}`)} />
              <span className="gate-owner">{g.owner}</span>
              <label htmlFor={`gate-${g.id}`} style={{ flex: "1 1 300px", fontSize: 13, color: s.checked ? "var(--ink-soft)" : "var(--ink)", cursor: "pointer" }}>
                {g.text}
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-soft)", textTransform: "uppercase" }}>
                  evidence: {g.evidence}
                </span>
                <input type="text" value={s.evidenceRef ?? ""} placeholder="ref / link"
                  aria-label={`Evidence reference for ${g.id}`}
                  style={{ fontSize: 11, padding: "3px 6px", width: 140 }}
                  onChange={(e) => patch(g.id, { evidenceRef: e.target.value }, `Gate ${g.id} evidence noted`)} />
                {!s.checked && (
                  <details style={{ fontSize: 11 }}>
                    <summary style={{ cursor: "pointer", color: s.exception ? "var(--amber)" : "var(--ink-soft)", fontFamily: "var(--mono)", fontSize: 10 }}>
                      {s.exception ? "EXCEPTION RECORDED" : "record exception"}
                    </summary>
                    <div style={{ display: "grid", gap: 4, padding: "6px 0", minWidth: 240 }}>
                      <input type="text" value={s.exception ?? ""} placeholder="Accepted workaround"
                        aria-label={`Exception for ${g.id}`} style={{ fontSize: 11, padding: "3px 6px" }}
                        onChange={(e) => patch(g.id, { exception: e.target.value }, `Gate ${g.id} exception documented`)} />
                      <input type="text" value={s.exceptionBy ?? ""} placeholder="Decision-maker (named)"
                        aria-label={`Exception decision-maker for ${g.id}`} style={{ fontSize: 11, padding: "3px 6px" }}
                        onChange={(e) => patch(g.id, { exceptionBy: e.target.value }, `Gate ${g.id} exception owner named`)} />
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="callout" style={{ marginTop: 16 }}>
        <strong>Go / No-Go decision</strong> — recorded with a name and a date by the Implementation Lead, the Practice
        Point of Contact, the Billing Lead, and the Clinical Champion. An exception without a named decision-maker is an
        ambiguity, not a decision.
      </div>
    </div>
  );
}
