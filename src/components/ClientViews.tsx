import { useMemo } from "react";
import type { Practice } from "../domain/types";
import { DELIVERABLES } from "../domain/deliverables";
import { READINESS_GATE } from "../domain/readiness";
import { addDays, fmt, parseISO, tLabel } from "../engine/schedule";

/*
 * Client-facing deliverables list (Appendix A, personalised) and the go-live
 * readiness gate (Appendix B, filtered to scope). The deliverables view is
 * the document actually sent to the practice at kickoff — printable as-is,
 * no internal task detail.
 */

export function Deliverables({ practice }: { practice: Practice }) {
  const goLive = parseISO(practice.goLive);
  const items = useMemo(
    () => DELIVERABLES.filter((d) => d.when(practice.dispositions)),
    [practice.dispositions]
  );
  const sorted = [...items].sort((a, b) => b.dueWeek - a.dueWeek);

  return (
    <div>
      <div className="toolbar no-print" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink2)", maxWidth: 640 }}>
          Everything the practice owes us, in one list, ordered by due date — filtered to this scope
          ({items.length} of {DELIVERABLES.length} items apply). This is the page to print and hand over at kickoff.
        </span>
        <button className="btn small" onClick={() => window.print()}>Print / save as PDF</button>
      </div>

      <div className="panel" style={{ padding: "18px 20px 6px" }}>
        <div className="kicker">EHR 360 · Implementation</div>
        <h2 style={{ fontFamily: "var(--mono)", fontSize: 17, textTransform: "uppercase", margin: "4px 0 2px" }}>
          What we need from {practice.name}
        </h2>
        <div style={{ fontSize: 12.5, color: "var(--ink2)", marginBottom: 8 }}>
          Go-live {fmt(goLive)}. Dates below are when each item is due to your implementation lead.
          The first four categories marked <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>WEEK 1</span> gate
          long-lead work and are needed regardless of how far out go-live is.
        </div>

        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Deliverable</th>
                <th>Category</th>
                <th className="num">Due</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const due = addDays(goLive, -Math.round(d.dueWeek * 7));
                const isWeekOne = d.dueWeek >= 8;
                return (
                  <tr key={d.n}>
                    <td className="task-id">{d.n}</td>
                    <td style={{ fontSize: 13 }}>{d.text}</td>
                    <td style={{ fontSize: 11.5, color: "var(--ink3)", whiteSpace: "nowrap" }}>
                      {d.category}
                      {isWeekOne && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--flag)", marginLeft: 6 }}>WEEK 1</span>}
                    </td>
                    <td className="num">
                      {d.dueLabel ?? fmt(due)}
                      <div style={{ fontSize: 9.5, color: "var(--ink3)" }}>{tLabel(Math.round(d.dueWeek * 7))}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink3)", padding: "10px 0" }}>
          Questions on any item: your implementation lead is the fastest route to an answer.
        </div>
      </div>
    </div>
  );
}

export function ReadinessGate({ practice, update }: {
  practice: Practice;
  update: (patch: Partial<Practice>) => void;
}) {
  const items = useMemo(
    () => READINESS_GATE.filter((g) => g.when(practice.dispositions)),
    [practice.dispositions]
  );
  const confirmed = items.filter((g) => practice.gateChecked[g.id]).length;
  const allClear = confirmed === items.length && items.length > 0;

  const toggle = (id: string) =>
    update({ gateChecked: { ...practice.gateChecked, [id]: !practice.gateChecked[id] } });

  return (
    <div>
      <section className={`panel verdict ${allClear ? "good" : ""}`}>
        <div className="verdict-stats">
          <div>
            <div className="stat-label">Go-live readiness gate</div>
            <div className={`stat-v ${allClear ? "" : "strong"}`} style={allClear ? { color: "var(--ok)", fontWeight: 700 } : undefined}>
              {confirmed} / {items.length} confirmed
            </div>
            <div className="stat-sub">Reviewed on the go/no-go call, the Wednesday before go-live</div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", maxWidth: 520, alignSelf: "center" }}>
            Any item not confirmed is a <strong>no-go</strong> unless the Implementation Lead documents an accepted
            workaround. <span style={{ color: "var(--amber)" }}>Open question: the deciding authority is not named in
            any source document — name one before this call.</span>
          </div>
        </div>
      </section>

      <div className="panel" style={{ marginTop: 16 }}>
        {items.map((g) => (
          <label key={g.id} className="gate-row" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!practice.gateChecked[g.id]}
              onChange={() => toggle(g.id)}
            />
            <span className="gate-owner">{g.owner}</span>
            <span style={{ fontSize: 13, color: practice.gateChecked[g.id] ? "var(--ink3)" : "var(--ink)" }}>{g.text}</span>
          </label>
        ))}
      </div>

      <div className="callout" style={{ marginTop: 16 }}>
        <strong>Go / No-Go decision</strong> — recorded with a name and a date, by the Implementation Lead, the Practice
        Point of Contact, the Billing Lead, and the Clinical Lead / Physician Champion. If criteria are not met, the date
        moves. Going live against unmet criteria puts the failure in front of the client instead of behind us.
      </div>
    </div>
  );
}
