import type { DurationsConfig, Practice } from "../domain/types";
import { DEFAULT_DURATIONS } from "../domain/durations";

/*
 * Duration assumptions. Global defaults live on the server; each practice
 * PINS a snapshot at creation so an assumption change never silently moves
 * an agreed plan. "Recalculate" copies the current globals onto this
 * practice explicitly — a recorded, auditable act.
 */

interface Props {
  practice: Practice;
  globalDurations: DurationsConfig;
  saveGlobal: (d: DurationsConfig) => void;
  update: (patch: Partial<Practice>, summary: string) => void;
}

const SCALE_LABEL: Record<string, string> = {
  providers: "per provider",
  payers: "per payer",
  staff: "per staff member",
  locations: "per location",
  prescribers: "per prescriber",
};

export default function Settings({ practice, globalDurations, saveGlobal, update }: Props) {
  const pinned = practice.assumptions;
  const keys = Object.keys(DEFAULT_DURATIONS);
  const pinnedDiffers = keys.some(
    (k) => pinned[k]?.baseDays !== globalDurations[k]?.baseDays || (pinned[k]?.perUnit ?? 0) !== (globalDurations[k]?.perUnit ?? 0)
  );

  const patchGlobal = (key: string, field: "baseDays" | "perUnit", value: number) =>
    saveGlobal({ ...globalDurations, [key]: { ...globalDurations[key], [field]: value } });

  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        <strong>Estimates, not observed data.</strong> The first real migration (Neuro Heart) completes hypercare in late
        September — its planned-vs-actual replaces these numbers without a rebuild. This practice's schedule uses the{" "}
        <em>pinned</em> assumptions below; editing globals affects new practices and any plan that explicitly recalculates.
      </div>

      <section className={`panel verdict ${pinnedDiffers ? "" : "good"}`} style={{ marginBottom: 16 }}>
        <div className="verdict-stats" style={{ alignItems: "center" }}>
          <div>
            <div className="stat-label">This practice's assumptions</div>
            <div className="stat-v" style={{ color: pinnedDiffers ? "var(--amber)" : "var(--ok)" }}>
              {pinnedDiffers ? "PINNED — differs from current globals" : "In sync with globals"}
            </div>
            <div className="stat-sub">pinned at creation · plans do not silently move</div>
          </div>
          {pinnedDiffers && (
            <button className="btn small"
              onClick={() => update({ assumptions: structuredClone(globalDurations) }, "Recalculated schedule against current global assumptions")}>
              Recalculate this plan from current globals
            </button>
          )}
        </div>
      </section>

      <div className="panel">
        <div className="set-row" style={{ borderBottom: "1.5px solid var(--ink)" }}>
          <span className="kicker">Assumption (global)</span>
          <span className="kicker">Base days</span>
          <span className="kicker">+ / unit</span>
          <span className="kicker">Pinned here</span>
          <span className="kicker set-note">Scaling &amp; notes</span>
        </div>
        {keys.map((k) => {
          const g = globalDurations[k] ?? DEFAULT_DURATIONS[k];
          const p = pinned[k] ?? g;
          const rowDiffers = p.baseDays !== g.baseDays || (p.perUnit ?? 0) !== (g.perUnit ?? 0);
          return (
            <div className="set-row" key={k} style={{ gridTemplateColumns: "minmax(160px,1fr) 80px 80px 110px minmax(150px,1.3fr)" }}>
              <span style={{ fontSize: 13, fontWeight: 550 }}>{g.label}</span>
              <input type="number" min={1} value={g.baseDays}
                aria-label={`${g.label} base days`}
                onChange={(e) => patchGlobal(k, "baseDays", Math.max(1, parseInt(e.target.value || "1", 10)))} />
              {g.scalesWith ? (
                <input type="number" min={0} step={0.1} value={g.perUnit ?? 0}
                  aria-label={`${g.label} additional days ${SCALE_LABEL[g.scalesWith]}`}
                  onChange={(e) => patchGlobal(k, "perUnit", Math.max(0, parseFloat(e.target.value || "0")))} />
              ) : (
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)", textAlign: "center" }}>—</span>
              )}
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: rowDiffers ? "var(--amber)" : "var(--ink-soft)" }}>
                {p.baseDays}d{p.perUnit ? ` +${p.perUnit}` : ""}{rowDiffers ? " ≠" : ""}
              </span>
              <span className="set-note">
                {g.scalesWith && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--anchor)" }}>{SCALE_LABEL[g.scalesWith]} · </span>}
                {g.note}
              </span>
            </div>
          );
        })}
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <button className="btn ghost small" onClick={() => saveGlobal(structuredClone(DEFAULT_DURATIONS))}>
          Reset globals to shipped estimates
        </button>
      </div>
    </div>
  );
}
