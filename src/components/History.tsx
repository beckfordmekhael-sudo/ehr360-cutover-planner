import { useEffect, useState } from "react";
import type { AuditEntry } from "../domain/types";
import { api } from "../api";

/* Audit trail: who changed what, when. Server-recorded on every write. */

export default function History({ practiceId }: { practiceId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    let live = true;
    api.auditFor(practiceId).then((r) => { if (live) setEntries(r.audit); });
    return () => { live = false; };
  }, [practiceId]);

  if (!entries) return <div style={{ padding: 20, color: "var(--ink-soft)" }}>Loading…</div>;

  return (
    <div className="panel tbl-wrap">
      <table className="tbl" style={{ minWidth: 480 }}>
        <thead>
          <tr><th>When</th><th>Who</th><th>Change</th></tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr><td colSpan={3} style={{ color: "var(--ink-soft)" }}>No recorded changes yet.</td></tr>
          )}
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="num" style={{ textAlign: "left" }}>{new Date(e.ts).toLocaleString()}</td>
              <td style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{e.user}</td>
              <td style={{ fontSize: 12.5 }}>{e.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
