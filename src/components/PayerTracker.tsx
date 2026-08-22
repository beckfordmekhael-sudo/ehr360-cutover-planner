import { useRef, useState } from "react";
import type { EnrollmentCell, EnrollmentStatus, EraDecision, PayerRow, Practice } from "../domain/types";
import { enrollmentCoverage, fmt, iso, parseISO, today } from "../engine/schedule";
import { uid, payerRowsFromSeed } from "../store";

/*
 * §11b enrollment sub-tracker. One row per payer, THREE status columns —
 * 837, 835, EFT — each with submitted/status/approval date, plus confirmed
 * receiver for 835 and confirmed account for EFT. Sequenced by share of
 * collections. Variant collapsing is a dependency of tracking, not a
 * parallel task. The ERA cutover order is a recorded decision, not a rule.
 */

interface Props {
  practice: Practice;
  update: (patch: Partial<Practice>, summary: string) => void;
}

const ENR_KEYS = [
  { k: "e837" as const, label: "837 claims", confirmLabel: null },
  { k: "e835" as const, label: "835 ERA", confirmLabel: "Receiver = EHR 360" },
  { k: "eft" as const, label: "EFT", confirmLabel: "Account confirmed" },
];

export default function PayerTracker({ practice, update }: Props) {
  const rows = [...practice.payers].sort((a, b) => b.share - a.share);
  const cov = enrollmentCoverage(practice);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importNote, setImportNote] = useState("");

  const setRows = (payers: PayerRow[], summary: string) => update({ payers }, summary);
  const patchRow = (id: string, patch: Partial<PayerRow>, summary: string) =>
    setRows(practice.payers.map((p) => (p.id === id ? { ...p, ...patch } : p)), summary);
  const patchCell = (row: PayerRow, key: "e837" | "e835" | "eft", cell: EnrollmentCell) =>
    setRows(
      practice.payers.map((p) => (p.id === row.id ? { ...p, [key]: cell } : p)),
      `${row.name || row.payerId} ${key.replace("e", "")} → ${cell.status}${cell.confirmed ? " (confirmed)" : ""}`
    );

  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const col = (names: string[]) => header.findIndex((h) => names.includes(h));
    const iName = col(["payer_name", "payer", "name"]);
    const iId = col(["payer_id", "payerid", "id"]);
    const iVar = col(["name_variants", "variants"]);
    const iShare = col(["pct_of_collections", "share", "pct", "percent"]);
    if (iName < 0 || iId < 0) {
      setImportNote("Import needs at least payer_name and payer_id columns.");
      return;
    }
    // Group by payer ID — the same ID under several name strings is one payer.
    const byId = new Map<string, { names: Set<string>; share: number; variants: number }>();
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      const pid = (cells[iId] ?? "").trim();
      if (!pid) continue;
      const entry = byId.get(pid) ?? { names: new Set(), share: 0, variants: 0 };
      entry.names.add((cells[iName] ?? "").trim());
      if (iShare >= 0) entry.share += parseFloat(cells[iShare]) || 0;
      if (iVar >= 0) entry.variants = Math.max(entry.variants, parseInt(cells[iVar], 10) || 0);
      byId.set(pid, entry);
    }
    const cell = () => ({ status: "none" as const });
    const imported: PayerRow[] = [...byId.entries()].map(([pid, e]) => {
      const variants = Math.max(e.variants, e.names.size);
      return {
        id: uid("py"), name: [...e.names][0], payerId: pid, variants,
        remapped: variants <= 1, share: Math.round(e.share * 100) / 100,
        e837: cell(), e835: cell(), eft: cell(),
      };
    });
    setRows(imported, `Imported payer list: ${imported.length} payer IDs from ${file.name}`);
    const flagged = imported.filter((p) => p.variants > 1).length;
    setImportNote(`${imported.length} payer IDs imported; ${flagged} carry multiple name variants and need collapsing before tracking is reliable.`);
  };

  const setEra = (patch: Partial<EraDecision>, summary: string) =>
    update({ eraDecision: { ...practice.eraDecision, ...patch } }, summary);

  const unremapped = rows.filter((p) => p.variants > 1 && !p.remapped);

  return (
    <div>
      {/* ---- coverage + variant status ---- */}
      <section className="panel" style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 320px" }}>
            <div className="stat-label">Readiness gate — 837 + 835 approved with receiver confirmed, by collections</div>
            <div className="gate-meter" role="meter" aria-valuenow={Math.round(cov.covered)} aria-valuemin={0} aria-valuemax={100}
              aria-label="Enrollment coverage by collections">
              <div className={`gate-fill${cov.gatePassed ? "" : " short"}`} style={{ width: `${Math.min(100, cov.covered)}%` }} />
              <div className="gate-mark" title="80% gate" />
            </div>
            <div className="stat-sub" style={{ marginTop: 4 }}>
              <span style={{ color: cov.gatePassed ? "var(--ok)" : "var(--amber)", fontWeight: 700 }}>{cov.covered.toFixed(1)}%</span>
              {" "}covered · gate ≥80% · {cov.gatePassed ? "PASSED" : `${Math.max(0, 80 - cov.covered).toFixed(1)} pts short`}
            </div>
            {cov.gap835 > 0 && (
              <div style={{ fontSize: 12, color: "var(--flag)", marginTop: 6, fontWeight: 600 }}>
                {cov.gap835.toFixed(1)}% of collections has 837 live but 835 UNCONFIRMED — go-live looks clean and the gap
                surfaces two to three weeks later when payments arrive with nothing to post against.
              </div>
            )}
          </div>
          <div style={{ flex: "1 1 300px" }}>
            <div className="stat-label">Payer table condition</div>
            {unremapped.length ? (
              <div style={{ fontSize: 12.5, color: "var(--amber)", fontWeight: 600 }}>
                {unremapped.length} payer ID(s) still carry multiple name variants.
                <div style={{ fontWeight: 400, color: "var(--ink2)", marginTop: 3 }}>
                  Variant collapse → clearinghouse re-map → reliable tracking. This is a dependency of §11b (task RCM11),
                  not a parallel task. Tick "re-mapped" per payer as the collapse completes.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--ok)", fontWeight: 600 }}>All payer IDs collapsed and re-mapped.</div>
            )}
            <div className="toolbar" style={{ marginTop: 10 }}>
              <button className="btn ghost small" onClick={() => fileRef.current?.click()}>Import payer list (CSV)</button>
              <button className="btn ghost small" onClick={() => setRows(payerRowsFromSeed(), "Loaded Neuro Heart seed payer mix")}>
                Load Neuro Heart seed
              </button>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            </div>
            {importNote && <div style={{ fontSize: 11.5, color: "var(--ink2)", marginTop: 6 }}>{importNote}</div>}
          </div>
        </div>
      </section>

      {/* ---- ERA cutover sequencing decision ---- */}
      {practice.dispositions.remit === "move" && (
        <section className="panel" style={{ marginTop: 16, borderLeft: `4px solid ${practice.eraDecision.order ? "var(--ok)" : "var(--amber)"}` }}>
          <div style={{ padding: "12px 16px" }}>
            <div className="stat-label">835 receiver cutover — a decision, not a rule (v5 §11b)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 8 }}>
              <div style={{ flex: "1 1 380px", fontSize: 12, color: "var(--ink2)", lineHeight: 1.55 }}>
                <strong style={{ color: "var(--ink)" }}>835 late:</strong> the payer keeps transmitting remittance to an endpoint
                nobody monitors. Cash arrives, nothing posts, A/R appears to spike.<br />
                <strong style={{ color: "var(--ink)" }}>835 early:</strong> remittance for legacy claims still worked in the old
                system arrives where there is nothing to match it against — this hits money already owed.
                Which risk dominates depends on open legacy A/R. Confirm per-payer ERA routing behaviour with the
                clearinghouse before deciding (open decision 1d).
              </div>
              <div style={{ flex: "1 1 300px", display: "grid", gap: 8 }}>
                <label>
                  <span className="field-label">Cutover order</span>
                  <select value={practice.eraDecision.order} style={{ width: "100%" }}
                    onChange={(e) => setEra({ order: e.target.value as EraDecision["order"], decidedOn: iso(today()) }, `ERA cutover order → ${e.target.value || "undecided"}`)}>
                    <option value="">— undecided —</option>
                    <option value="837-before-835">837 first, 835 follows</option>
                    <option value="835-before-837">835 first, ahead of 837</option>
                    <option value="same-time">Cut both together</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">Billing lead (named against the decision)</span>
                  <input type="text" value={practice.eraDecision.billingLead} placeholder="Name"
                    style={{ width: "100%" }}
                    onChange={(e) => setEra({ billingLead: e.target.value }, "ERA decision: billing lead updated")} />
                </label>
                <label>
                  <span className="field-label">Rationale (state of legacy A/R)</span>
                  <input type="text" value={practice.eraDecision.rationale} placeholder="e.g. $1.15M open A/R — run 835 late, brief manual posting"
                    style={{ width: "100%" }}
                    onChange={(e) => setEra({ rationale: e.target.value }, "ERA decision: rationale updated")} />
                </label>
                {practice.eraDecision.order && !practice.eraDecision.billingLead && (
                  <div style={{ fontSize: 11.5, color: "var(--flag)" }}>Recorded without a named billing lead — not done yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- tracker table ---- */}
      <section className="panel tbl-wrap" style={{ marginTop: 16 }}>
        <table className="tbl" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th>Payer</th>
              <th>ID</th>
              <th className="num">% coll.</th>
              <th className="num">Cum.</th>
              <th>Variants</th>
              {ENR_KEYS.map((e) => <th key={e.k}>{e.label}</th>)}
              <th className="no-print" aria-label="row actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const cum = rows.slice(0, i + 1).reduce((a, r) => a + r.share, 0);
              return (
                <tr key={p.id}>
                  <td style={{ minWidth: 150 }}>
                    <input type="text" value={p.name} placeholder="Payer name" aria-label="Payer name"
                      style={{ width: "100%", fontFamily: "var(--sans)", fontSize: 12.5 }}
                      onChange={(e) => patchRow(p.id, { name: e.target.value }, `Payer renamed → ${e.target.value}`)} />
                    <div className="share-bar"><div className="share-fill" style={{ width: `${Math.min(100, p.share * 2)}%` }} /></div>
                  </td>
                  <td className="task-id">{p.payerId}</td>
                  <td className="num">
                    <input type="number" min={0} max={100} step={0.01} value={p.share}
                      aria-label={`${p.name || p.payerId} share of collections`} style={{ width: 62, textAlign: "right" }}
                      onChange={(e) => patchRow(p.id, { share: Math.max(0, parseFloat(e.target.value || "0")) }, `${p.name} share → ${e.target.value}%`)} />
                  </td>
                  <td className="num" style={{ color: cum >= 80 ? "var(--ink-soft)" : "var(--anchor)", fontWeight: cum >= 80 ? 400 : 700 }}>
                    {cum.toFixed(0)}%
                  </td>
                  <td>
                    {p.variants > 1 ? (
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, cursor: "pointer", color: p.remapped ? "var(--ok)" : "var(--amber)" }}>
                        <input type="checkbox" checked={p.remapped}
                          aria-label={`${p.name} variants re-mapped`}
                          onChange={(e) => patchRow(p.id, { remapped: e.target.checked }, `${p.name}: variants ${e.target.checked ? "re-mapped" : "reopened"}`)} />
                        {p.variants} variants{p.remapped ? " ✓" : ""}
                      </label>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>clean</span>
                    )}
                  </td>
                  {ENR_KEYS.map((e) => (
                    <td key={e.k}>
                      <EnrollmentEditor cell={p[e.k]} label={`${p.name || p.payerId} ${e.label}`}
                        confirmLabel={e.confirmLabel}
                        onChange={(c) => patchCell(p, e.k, c)} />
                    </td>
                  ))}
                  <td className="no-print">
                    <button className="btn ghost small" aria-label={`Remove ${p.name || p.payerId}`}
                      onClick={() => setRows(practice.payers.filter((x) => x.id !== p.id), `Removed payer ${p.name || p.payerId}`)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="toolbar no-print" style={{ marginTop: 12 }}>
        <button className="btn ghost small"
          onClick={() => setRows([...practice.payers, {
            id: uid("py"), name: "", payerId: "", variants: 1, remapped: true, share: 0,
            e837: { status: "none" }, e835: { status: "none" }, eft: { status: "none" },
          }], "Added payer row")}>+ Add payer</button>
        <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
          Sorted by collection share — work top-down. 835 routes through a different intake and trails 837 by weeks; EFT is
          often a separate form. A single "EDI approved" status cannot answer whether remittance will route correctly.
        </span>
      </div>
    </div>
  );
}

function EnrollmentEditor({ cell, label, confirmLabel, onChange }: {
  cell: EnrollmentCell;
  label: string;
  confirmLabel: string | null;
  onChange: (c: EnrollmentCell) => void;
}) {
  const setStatus = (status: EnrollmentStatus) => {
    const next: EnrollmentCell = { ...cell, status };
    if (status === "submitted" && !next.submitted) next.submitted = iso(today());
    if (status === "approved") {
      if (!next.submitted) next.submitted = iso(today());
      if (!next.approved) next.approved = iso(today());
    }
    if (status === "none") { delete next.submitted; delete next.approved; next.confirmed = false; }
    if (status === "submitted") { delete next.approved; next.confirmed = false; }
    onChange(next);
  };
  return (
    <div className="enr-cell">
      <select
        className={`status-select enr-${cell.status === "approved" ? "approved" : cell.status === "submitted" ? "submitted" : "none"}`}
        value={cell.status} aria-label={`${label} status`}
        onChange={(e) => setStatus(e.target.value as EnrollmentStatus)}>
        <option value="none">Not started</option>
        <option value="submitted">Submitted</option>
        <option value="approved">Approved</option>
      </select>
      {cell.status !== "none" && (
        <input type="date" value={cell.submitted ?? ""} aria-label={`${label} submitted date`}
          title={cell.submitted ? `Submitted ${fmt(parseISO(cell.submitted))}` : "Submitted"}
          style={{ fontSize: 10.5, padding: "2px 4px" }}
          onChange={(e) => onChange({ ...cell, submitted: e.target.value })} />
      )}
      {cell.status === "approved" && (
        <>
          <input type="date" value={cell.approved ?? ""} aria-label={`${label} approved date`}
            style={{ fontSize: 10.5, padding: "2px 4px" }}
            onChange={(e) => onChange({ ...cell, approved: e.target.value })} />
          {confirmLabel && (
            <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 10, color: cell.confirmed ? "var(--ok)" : "var(--flag)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!cell.confirmed} aria-label={`${label} ${confirmLabel}`}
                onChange={(e) => onChange({ ...cell, confirmed: e.target.checked })} />
              {confirmLabel}
            </label>
          )}
        </>
      )}
    </div>
  );
}
