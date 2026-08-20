import type { EnrollmentCell, EnrollmentStatus, PayerRow, Practice } from "../domain/types";
import { enrollmentCoverage, fmt, iso, today } from "../engine/schedule";
import { uid } from "../store";

/*
 * Payer enrollment sub-tracker.
 * Three separate enrollments per payer — 837 claims, 835 ERA, EFT — each
 * clearing on its own date. Sequenced by share of collections, because the
 * readiness gate tests collection coverage (≥80% with 837+835 live), not
 * payer count.
 */

interface Props {
  practice: Practice;
  update: (patch: Partial<Practice>) => void;
}

const ENR_KEYS = [
  { k: "e837" as const, label: "837 claims" },
  { k: "e835" as const, label: "835 ERA" },
  { k: "eft" as const, label: "EFT" },
];

export default function PayerTracker({ practice, update }: Props) {
  const rows = [...practice.payers].sort((a, b) => b.share - a.share);
  const cov = enrollmentCoverage(practice);

  const setRows = (payers: PayerRow[]) => update({ payers });
  const patchRow = (id: string, patch: Partial<PayerRow>) =>
    setRows(practice.payers.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const patchCell = (id: string, key: "e837" | "e835" | "eft", cell: EnrollmentCell) =>
    setRows(practice.payers.map((p) => (p.id === id ? { ...p, [key]: cell } : p)));

  const addRow = () =>
    setRows([...practice.payers, {
      id: uid("py"), name: "", share: 0,
      e837: { status: "none" }, e835: { status: "none" }, eft: { status: "none" },
    }]);

  const cumulative: number[] = [];
  rows.reduce((acc, r) => { cumulative.push(acc + r.share); return acc + r.share; }, 0);

  return (
    <div>
      <section className="panel" style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 320px" }}>
            <div className="stat-label">Readiness gate — 837 + 835 live, by share of collections</div>
            <div className="gate-meter" role="meter" aria-valuenow={Math.round(cov.covered837x835)} aria-valuemin={0} aria-valuemax={100}
              aria-label="Enrollment coverage by collections">
              <div className={`gate-fill${cov.gatePassed ? "" : " short"}`} style={{ width: `${Math.min(100, cov.covered837x835)}%` }} />
              <div className="gate-mark" title="80% gate" />
            </div>
            <div className="stat-sub" style={{ marginTop: 4 }}>
              <span style={{ color: cov.gatePassed ? "var(--ok)" : "var(--amber)", fontWeight: 700 }}>
                {cov.covered837x835.toFixed(1)}%
              </span>{" "}
              of collections covered · gate is ≥80% ·{" "}
              {cov.gatePassed ? "PASSED" : `${Math.max(0, 80 - cov.covered837x835).toFixed(1)} pts short`}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink2)", maxWidth: 420 }}>
            A small number of payers is usually most of the revenue — work this list top-down by collection share,
            not alphabetically. {cov.totalShare < 95 && (
              <span style={{ color: "var(--amber)" }}>Shares entered sum to {cov.totalShare.toFixed(1)}% — add payers or check the mix.</span>
            )}
          </div>
        </div>
      </section>

      <section className="panel tbl-wrap" style={{ marginTop: 16 }}>
        <table className="tbl" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th>Payer</th>
              <th className="num">% coll.</th>
              <th className="num">Cum.</th>
              {ENR_KEYS.map((e) => <th key={e.k}>{e.label}</th>)}
              <th className="no-print" aria-label="row actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.id}>
                <td style={{ minWidth: 160 }}>
                  <input
                    type="text" value={p.name} placeholder="Payer name"
                    aria-label="Payer name"
                    style={{ width: "100%", fontFamily: "var(--sans)", fontSize: 13 }}
                    onChange={(e) => patchRow(p.id, { name: e.target.value })}
                  />
                  <div className="share-bar"><div className="share-fill" style={{ width: `${Math.min(100, p.share)}%` }} /></div>
                </td>
                <td className="num">
                  <input
                    type="number" min={0} max={100} step={0.1} value={p.share}
                    aria-label={`${p.name || "payer"} share of collections`}
                    style={{ width: 64, textAlign: "right" }}
                    onChange={(e) => patchRow(p.id, { share: Math.max(0, parseFloat(e.target.value || "0")) })}
                  />
                </td>
                <td className="num" style={{ color: cumulative[i] >= 80 ? "var(--ink3)" : "var(--anchor)", fontWeight: cumulative[i] >= 80 ? 400 : 700 }}>
                  {cumulative[i].toFixed(0)}%
                </td>
                {ENR_KEYS.map((e) => (
                  <td key={e.k}>
                    <EnrollmentEditor
                      cell={p[e.k]}
                      label={`${p.name || "payer"} ${e.label}`}
                      onChange={(c) => patchCell(p.id, e.k, c)}
                    />
                  </td>
                ))}
                <td className="no-print">
                  <button className="btn ghost small" aria-label={`Remove ${p.name || "payer"}`}
                    onClick={() => setRows(practice.payers.filter((x) => x.id !== p.id))}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="toolbar no-print" style={{ marginTop: 12 }}>
        <button className="btn ghost small" onClick={addRow}>+ Add payer</button>
        <span style={{ fontSize: 11.5, color: "var(--ink3)" }}>
          Rows auto-sort by collection share. 835 approval typically trails 837 by weeks; EFT is independent of both.
        </span>
      </div>
    </div>
  );
}

function EnrollmentEditor({ cell, label, onChange }: {
  cell: EnrollmentCell;
  label: string;
  onChange: (c: EnrollmentCell) => void;
}) {
  const setStatus = (status: EnrollmentStatus) => {
    const next: EnrollmentCell = { ...cell, status };
    if (status === "submitted" && !next.submitted) next.submitted = iso(today());
    if (status === "approved") {
      if (!next.submitted) next.submitted = iso(today());
      if (!next.approved) next.approved = iso(today());
    }
    if (status === "none") { delete next.submitted; delete next.approved; }
    if (status === "submitted") delete next.approved;
    onChange(next);
  };
  return (
    <div className="enr-cell">
      <select
        className={`status-select enr-${cell.status === "approved" ? "approved" : cell.status === "submitted" ? "submitted" : "none"}`}
        value={cell.status}
        aria-label={`${label} status`}
        onChange={(e) => setStatus(e.target.value as EnrollmentStatus)}
      >
        <option value="none">Not started</option>
        <option value="submitted">Submitted</option>
        <option value="approved">Approved</option>
      </select>
      {cell.status !== "none" && (
        <input
          type="date" value={cell.submitted ?? ""} aria-label={`${label} submitted date`}
          title={`Submitted ${cell.submitted ? fmt(new Date(cell.submitted)) : ""}`}
          style={{ fontSize: 10.5, padding: "2px 4px" }}
          onChange={(e) => onChange({ ...cell, submitted: e.target.value })}
        />
      )}
      {cell.status === "approved" && (
        <input
          type="date" value={cell.approved ?? ""} aria-label={`${label} approved date`}
          style={{ fontSize: 10.5, padding: "2px 4px" }}
          onChange={(e) => onChange({ ...cell, approved: e.target.value })}
        />
      )}
    </div>
  );
}
