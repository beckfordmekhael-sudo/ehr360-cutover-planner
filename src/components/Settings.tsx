import type { DurationsConfig } from "../domain/types";
import { DEFAULT_DURATIONS } from "../domain/durations";

/*
 * Duration assumptions panel. These numbers are configuration, not code:
 * no full EHR migration has been completed yet, so every figure is an
 * estimate to be replaced with observed data after the first migration
 * (Neuro Heart) closes out.
 */

interface Props {
  durations: DurationsConfig;
  setDurations: (d: DurationsConfig) => void;
}

const SCALE_LABEL: Record<string, string> = {
  providers: "per provider",
  payers: "per payer",
  staff: "per staff member",
  locations: "per location",
};

export default function Settings({ durations, setDurations }: Props) {
  const patch = (key: string, field: "baseDays" | "perUnit", value: number) =>
    setDurations({ ...durations, [key]: { ...durations[key], [field]: value } });

  const keys = Object.keys(DEFAULT_DURATIONS);

  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        <strong>Estimates, not observed data.</strong> No full EHR migration has been completed to date — the one
        reference implementation was a greenfield practice start. Replace these figures with planned-vs-actual numbers
        from the post-implementation review of the first completed migration. Changes apply immediately to every
        practice's schedule and are saved on this machine.
      </div>

      <div className="panel">
        <div className="set-row" style={{ borderBottom: "1.5px solid var(--ink)" }}>
          <span className="kicker">Assumption</span>
          <span className="kicker">Base days</span>
          <span className="kicker">+ / unit</span>
          <span className="kicker set-note">Scaling &amp; notes</span>
        </div>
        {keys.map((k) => {
          const spec = durations[k];
          const dflt = DEFAULT_DURATIONS[k];
          const changed = spec.baseDays !== dflt.baseDays || (spec.perUnit ?? 0) !== (dflt.perUnit ?? 0);
          return (
            <div className="set-row" key={k}>
              <span style={{ fontSize: 13, fontWeight: 550 }}>
                {spec.label}
                {changed && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--anchor)", marginLeft: 6 }}>EDITED</span>}
              </span>
              <input
                type="number" min={1} value={spec.baseDays}
                aria-label={`${spec.label} base days`}
                onChange={(e) => patch(k, "baseDays", Math.max(1, parseInt(e.target.value || "1", 10)))}
              />
              {spec.scalesWith ? (
                <input
                  type="number" min={0} step={0.1} value={spec.perUnit ?? 0}
                  aria-label={`${spec.label} additional days ${SCALE_LABEL[spec.scalesWith]}`}
                  onChange={(e) => patch(k, "perUnit", Math.max(0, parseFloat(e.target.value || "0")))}
                />
              ) : (
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink3)", textAlign: "center" }}>—</span>
              )}
              <span className="set-note">
                {spec.scalesWith && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--anchor)" }}>{SCALE_LABEL[spec.scalesWith]} · </span>}
                {spec.note}
              </span>
            </div>
          );
        })}
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <button className="btn ghost small" onClick={() => setDurations({ ...DEFAULT_DURATIONS })}>
          Reset all to shipped estimates
        </button>
      </div>
    </div>
  );
}
