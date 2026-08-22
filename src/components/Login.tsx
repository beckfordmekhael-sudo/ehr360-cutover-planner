import { useState } from "react";

/*
 * Simple accounts (brief §8): the point is audit, not tenant isolation —
 * every schedule change records who made it, because the schedule may be
 * cited in a dispute with a practice.
 */

interface Props {
  login: (name: string, password: string) => Promise<void>;
  register: (name: string, password: string) => Promise<void>;
}

export default function Login({ login, register }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await (mode === "login" ? login(name, password) : register(name, password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: "60px auto" }}>
      <div className="panel" style={{ padding: "22px 24px" }}>
        <div className="kicker">EHR 360 · Implementation</div>
        <h1 style={{ fontFamily: "var(--mono)", fontSize: 19, textTransform: "uppercase", margin: "4px 0 14px" }}>
          Cutover Planner
        </h1>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label>
            <span className="field-label">Your name</span>
            <input type="text" value={name} autoComplete="username" required style={{ width: "100%" }}
              onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span className="field-label">Password</span>
            <input type="password" value={password} required minLength={4} style={{ width: "100%" }}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div style={{ fontSize: 12.5, color: "var(--flag)" }}>{error}</div>}
          <button className="btn" type="submit" disabled={busy}>
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button className="btn ghost small" style={{ marginTop: 12 }}
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
        <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 14 }}>
          Changes are recorded against your name in the audit trail — who moved a date, and when, matters if the schedule
          is ever cited in a dispute.
        </p>
      </div>
    </div>
  );
}
