import type { AuditEntry, DurationsConfig, Practice } from "./domain/types";

/* Thin fetch client for the planner backend. All endpoints same-origin. */

async function j<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error ?? `HTTP ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export const api = {
  me: () => fetch("/api/auth/me").then(j<{ user: { id: string; name: string } | null }>),
  register: (name: string, password: string) =>
    fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password }) })
      .then(j<{ user: { id: string; name: string } }>),
  login: (name: string, password: string) =>
    fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password }) })
      .then(j<{ user: { id: string; name: string } }>),
  logout: () => fetch("/api/auth/logout", { method: "POST" }).then(j<{ ok: true }>),

  listPractices: () => fetch("/api/practices").then(j<{ practices: Practice[] }>),
  createPractice: (practice: Practice) =>
    fetch("/api/practices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ practice }) })
      .then(j<{ ok: true }>),
  updatePractice: (practice: Practice, summary: string, baseUpdatedAt?: string) =>
    fetch(`/api/practices/${practice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practice, summary, baseUpdatedAt }),
    }).then(j<{ ok: true; updatedAt: string }>),
  deletePractice: (id: string) =>
    fetch(`/api/practices/${id}`, { method: "DELETE" }).then(j<{ ok: true }>),
  auditFor: (id: string) => fetch(`/api/practices/${id}/audit`).then(j<{ audit: AuditEntry[] }>),

  getDurations: () => fetch("/api/settings/durations").then(j<{ durations: DurationsConfig | null }>),
  putDurations: (durations: DurationsConfig) =>
    fetch("/api/settings/durations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durations }) })
      .then(j<{ ok: true }>),
};
