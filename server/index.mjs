/*
 * EHR 360 Cutover Planner — backend.
 *
 * Boring on purpose: Express + node:sqlite (built into Node ≥22), simple
 * accounts, cookie sessions, and an audit trail. Multi-tenant isolation
 * matters less than audit — the schedule may be cited in a dispute with a
 * practice, so every write records who and when.
 *
 * Run: node server/index.mjs   (port 5177; serves ../dist when built)
 */

import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "planner.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS practices (
    id TEXT PRIMARY KEY, data TEXT NOT NULL,
    updated_at TEXT NOT NULL, updated_by TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, user TEXT NOT NULL,
    practice_id TEXT NOT NULL, summary TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();
const hash = (password, salt) => scryptSync(password, salt, 32).toString("hex");

const app = express();
app.use(express.json({ limit: "2mb" }));

/* ------------------------------- auth ------------------------------- */

function readCookie(req, name) {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function currentUser(req) {
  const token = readCookie(req, "sid");
  if (!token) return null;
  const row = db
    .prepare("SELECT u.id, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?")
    .get(token);
  return row ?? null;
}

function setSession(res, token) {
  res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 90}`);
}

app.post("/api/auth/register", (req, res) => {
  const { name, password } = req.body ?? {};
  if (!name || !password || password.length < 4)
    return res.status(400).json({ error: "Name and a password of at least 4 characters are required." });
  if (db.prepare("SELECT 1 FROM users WHERE name = ?").get(name))
    return res.status(409).json({ error: "That name is taken — log in instead." });
  const salt = randomBytes(16).toString("hex");
  const id = randomUUID();
  db.prepare("INSERT INTO users (id, name, pass_hash, salt, created_at) VALUES (?,?,?,?,?)")
    .run(id, name, hash(password, salt), salt, now());
  const token = randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)").run(token, id, now());
  setSession(res, token);
  res.json({ user: { id, name } });
});

app.post("/api/auth/login", (req, res) => {
  const { name, password } = req.body ?? {};
  const row = db.prepare("SELECT * FROM users WHERE name = ?").get(name ?? "");
  if (!row) return res.status(401).json({ error: "Unknown user." });
  const attempt = Buffer.from(hash(password ?? "", row.salt), "hex");
  const stored = Buffer.from(row.pass_hash, "hex");
  if (attempt.length !== stored.length || !timingSafeEqual(attempt, stored))
    return res.status(401).json({ error: "Wrong password." });
  const token = randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)").run(token, row.id, now());
  setSession(res, token);
  res.json({ user: { id: row.id, name: row.name } });
});

app.post("/api/auth/logout", (req, res) => {
  const token = readCookie(req, "sid");
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.setHeader("Set-Cookie", "sid=; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: currentUser(req) });
});

/** Everything below requires a session. */
app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/auth")) return next();
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  req.user = user;
  next();
});

/* ----------------------------- practices ----------------------------- */

app.get("/api/practices", (_req, res) => {
  const rows = db.prepare("SELECT id, data, updated_at, updated_by FROM practices").all();
  res.json({
    practices: rows.map((r) => ({ ...JSON.parse(r.data), updatedAt: r.updated_at, updatedBy: r.updated_by })),
  });
});

app.post("/api/practices", (req, res) => {
  const p = req.body?.practice;
  if (!p?.id || !p?.name) return res.status(400).json({ error: "practice with id and name required" });
  db.prepare("INSERT INTO practices (id, data, updated_at, updated_by) VALUES (?,?,?,?)")
    .run(p.id, JSON.stringify(p), now(), req.user.name);
  db.prepare("INSERT INTO audit (ts, user, practice_id, summary) VALUES (?,?,?,?)")
    .run(now(), req.user.name, p.id, `Created practice "${p.name}"`);
  res.json({ ok: true });
});

app.put("/api/practices/:id", (req, res) => {
  const { practice, summary, baseUpdatedAt } = req.body ?? {};
  if (!practice) return res.status(400).json({ error: "practice required" });
  const existing = db.prepare("SELECT updated_at FROM practices WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  if (baseUpdatedAt && existing.updated_at !== baseUpdatedAt)
    return res.status(409).json({ error: "conflict", theirUpdatedAt: existing.updated_at });
  const ts = now();
  db.prepare("UPDATE practices SET data = ?, updated_at = ?, updated_by = ? WHERE id = ?")
    .run(JSON.stringify(practice), ts, req.user.name, req.params.id);
  db.prepare("INSERT INTO audit (ts, user, practice_id, summary) VALUES (?,?,?,?)")
    .run(ts, req.user.name, req.params.id, String(summary ?? "Updated"));
  res.json({ ok: true, updatedAt: ts });
});

app.delete("/api/practices/:id", (req, res) => {
  db.prepare("DELETE FROM practices WHERE id = ?").run(req.params.id);
  db.prepare("INSERT INTO audit (ts, user, practice_id, summary) VALUES (?,?,?,?)")
    .run(now(), req.user.name, req.params.id, "Deleted practice");
  res.json({ ok: true });
});

app.get("/api/practices/:id/audit", (req, res) => {
  const rows = db
    .prepare("SELECT id, ts, user, practice_id AS practiceId, summary FROM audit WHERE practice_id = ? ORDER BY id DESC LIMIT 200")
    .all(req.params.id);
  res.json({ audit: rows });
});

/* ------------------------------ settings ------------------------------ */

app.get("/api/settings/durations", (_req, res) => {
  const row = db.prepare("SELECT data FROM settings WHERE k = 'durations'").get();
  res.json({ durations: row ? JSON.parse(row.data) : null });
});

app.put("/api/settings/durations", (req, res) => {
  db.prepare("INSERT INTO settings (k, data) VALUES ('durations', ?) ON CONFLICT(k) DO UPDATE SET data = excluded.data")
    .run(JSON.stringify(req.body?.durations ?? {}));
  db.prepare("INSERT INTO audit (ts, user, practice_id, summary) VALUES (?,?,?,?)")
    .run(now(), req.user.name, "-", "Updated global duration assumptions");
  res.json({ ok: true });
});

/* ------------------------------- static ------------------------------- */

const dist = path.join(__dirname, "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const PORT = process.env.PLANNER_API_PORT ?? 5177;
app.listen(PORT, () => console.log(`planner api on http://localhost:${PORT}`));
