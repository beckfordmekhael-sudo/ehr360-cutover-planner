# EHR 360 Cutover Planner — context for Claude Code

Planning + tracking tool for EHR 360 implementations. v2, built from
**Implementation Playbook v5** ("claude-code-brief-cutover-planner-v2.md" in
Downloads is the build brief; where documents conflict, v5 wins).

## Ground rules

- **Every duration is an estimate.** No full migration has completed; Neuro
  Heart finishes hypercare late September and its planned-vs-actual replaces
  the estimates. Durations are data (`src/domain/durations.ts` + server
  globals), **pinned per practice** — never make a stored plan move silently.
- **The task library is DATA, not code**: `src/data/tasks.json`, with
  declarative scope conditions interpreted by `src/domain/conditions.ts`.
  A non-engineer edits the JSON. Don't move tasks into code. Don't invent
  dependencies — unclear relationships stay unchained.
- **§11 is two workstreams.** §11a payer contracts (verify-only on Type B)
  vs §11b EDI submitter enrollment (in full on A/B/C — the submitter almost
  always changes because EHR 360 uses its own clearinghouse). The Neuro
  Heart test in `tests/engine.test.ts` enforces this; if it fails, the model
  is wrong, not the test.
- **Two clocks.** Build-ready is computed on the build-only subgraph;
  billing-ready over everything feeding an external gate. Never collapse
  them into one date.
- **ERA cutover order is a recorded decision** with the billing lead named —
  never hard-code 835-before-837 or the reverse.
- Open decisions (v5 Appendix C) are surfaced in the UI where they affect
  output. Do not resolve or hide them silently.
- Design: dense ops instrument; monospace for dates/IDs/tabular data; color
  = meaning only; prints legibly; phone-usable. No SaaS-dashboard styling.

## Layout

- `src/data/*.json` — task library, Appendix A, Appendix B, Neuro Heart payer seed
- `src/domain/` — types, condition interpreter, classifier (4 questions →
  Type A–D), durations, conflicts, prefill, library accessor (+ validation)
- `src/engine/schedule.ts` — two-clock backward pass, binding-edge critical
  path, feasibility, coverage (835 receiver-confirmed), phase
- `server/index.mjs` — Express + node:sqlite (Node ≥22): simple accounts,
  sessions, practices, **audit trail** (who/when on every write), optimistic
  concurrency (409 → client reloads). DB in `server/data/` (gitignored).
- `src/store.ts` — server-backed hooks. NOTE: optimistic updates compute
  from a synchronously-maintained ref, never inside a setState updater
  (React defers those — this was a real lost-write bug).
- `src/components/` — Planner (classification + verdict + schedule),
  PayerTracker (3-column tracker, variant collapsing, CSV import, ERA
  decision card), ClientViews (Appendix A print view + evidenced gate),
  Settings (global vs pinned assumptions), History (audit), Login, Prefill

Dev: `npm run dev` (API :5177 + Vite :5199; launch.json name
`cutover-planner`). Check: `npx tsc --noEmit` · `npm test` · `npm run build`.

## Known remaining debts

1. Print/PDF pagination never visually verified (page breaks, thead repeat).
2. No JSON export/import of a practice; no React error boundary; no schema
   migration for stored practice records.
3. Session tokens live forever (no expiry sweep); registration is open.
4. Deliverables/gate JSON share condition language but only tasks.json is
   validated by `validateLibrary()` — extend it.
5. `phaseOf` long-lead cross-check is coarse (ratio of external tasks done).
