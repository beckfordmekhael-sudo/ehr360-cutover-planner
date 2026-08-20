import { PREFILL_MAP, SOURCE_META } from "../domain/prefill";

/*
 * Onboarding form pre-fill map. Field by field: what we can populate
 * ourselves (legacy EHR admin access, NPPES, state board) versus what only
 * the practice can supply (decisions, contract data, documents, tribal
 * knowledge). The goal is to hand the practice a mostly-complete document
 * to confirm, not a blank eight-page PDF to fill.
 */

export default function Prefill() {
  const selfCount = PREFILL_MAP.filter((f) => SOURCE_META[f.source].self).length;
  const pct = Math.round((selfCount / PREFILL_MAP.length) * 100);

  const sections = [...new Set(PREFILL_MAP.map((f) => f.section))];

  return (
    <div>
      <section className="panel" style={{ padding: "14px 16px" }}>
        <div className="verdict-stats">
          <div>
            <div className="stat-label">Self-servable</div>
            <div className="stat-v strong">{pct}%</div>
            <div className="stat-sub">{selfCount} of {PREFILL_MAP.length} field groups</div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", maxWidth: 620, alignSelf: "center" }}>
            With administrator access to the practice's existing system, an NPPES lookup, and a state board search, most
            of the Practice Onboarding Form can be filled before the practice sees it. The remainder falls into four
            categories that can never be self-served: <em>decisions</em>, <em>contract data</em>, <em>documents</em>, and{" "}
            <em>tribal knowledge</em>. Contract data is the usual stall — it looks like data entry but is actually research.
          </div>
        </div>
      </section>

      <div className="panel tbl-wrap" style={{ marginTop: 16 }}>
        <table className="tbl" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>Form field</th>
              <th>Source</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <SectionRows key={sec} section={sec} />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink3)", marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span><span className="pf-source pf-self">we pull it</span> — legacy EHR admin access, NPPES, or state board</span>
        <span><span className="pf-source pf-ask">practice must supply</span> — decision, contract data, document, or tribal knowledge</span>
      </div>
    </div>
  );
}

function SectionRows({ section }: { section: string }) {
  const rows = PREFILL_MAP.filter((f) => f.section === section);
  return (
    <>
      <tr className="week-head">
        <td colSpan={3}>{section}</td>
      </tr>
      {rows.map((f, i) => {
        const meta = SOURCE_META[f.source];
        return (
          <tr key={i}>
            <td style={{ fontSize: 13, minWidth: 200 }}>{f.field}</td>
            <td>
              <span className={`pf-source ${meta.self ? "pf-self" : "pf-ask"}`}>{meta.label}</span>
            </td>
            <td style={{ fontSize: 11.5, color: "var(--ink3)" }}>{f.note ?? meta.hint}</td>
          </tr>
        );
      })}
    </>
  );
}
