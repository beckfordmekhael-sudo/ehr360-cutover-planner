# EHR 360 Cutover Planner — context for Claude Code

Work-back planning tool for EHR 360 implementations. An implementation lead
enters a go-live date + which of 15 practice systems move/stay, and gets a
feasibility verdict, dependency-driven schedule, scope-conflict warnings,
payer enrollment tracker, and client-facing exports.

## Ground rules

- **Every duration is an estimate.** No full EHR migration has completed
  (Neuro Heart is the first). Durations are config in
  `src/domain/durations.ts` + the in-app Assumptions tab — never hard-code a
  duration into a task that should scale or be editable.
- **The playbook is the spine.** The task library (`src/domain/tasks.ts`)
  encodes "EHR360 Implementation Playbook.docx" §3–12 with `ref` fields.
  Don't invent tasks or dependencies; where a relationship is unclear the
  task stays unchained, anchored to its T-week target.
- **Six open questions are surfaced on purpose** (go-live authority, 8-week
  vs 3–5-week timeline conflict, practice-kept billing, discrete-vs-PDF
  notes, open A/R ownership, legacy read-only terms). They appear in the UI
  where they affect output. Do not resolve or hide them silently.
- Design: dense ops instrument, monospace for dates/IDs/tabular data, color
  carries meaning only, prints legibly, works on a phone. No gradients, no
  stat-card SaaS styling.

## Layout

- `src/domain/` — task library, Appendix A deliverables, Appendix B
  readiness gate, conflict rules, onboarding-form pre-fill map, duration
  model, systems/presets
- `src/engine/schedule.ts` — pure work-back scheduler: backward pass over
  dep graph + T-week anchors, critical path, feasibility, Monday-snapped
  earliest go-live. All in "days before go-live" offset space.
- `src/store.ts` — localStorage persistence (practices + assumptions)
- `src/components/` — Planner, PayerTracker, ClientViews (deliverables +
  gate), Prefill, Settings; shell in `src/App.tsx`

Dev: `npm run dev` (port 5199). Check: `npx tsc --noEmit` and `npm run build`.

## Known debts (from review, in priority order)

1. No tests — engine is pure; add Vitest goldens for the three preset
   runways (full switch = 82d, new billing entity = 160d at default scale)
   and scope-predicate counts.
2. Task completion records no date → planned-vs-actual loop can't close.
3. No JSON export/import of practice state; no error boundary; no schema
   migration for stored practices.
4. `--ink3` small text fails WCAG AA contrast; darken.
5. Raw ms date math in two Planner spots (DST-unsafe) — use `addDays`.
6. `uid()` can collide across sessions — use `crypto.randomUUID()`.
7. Deliverable #38 uses `dueWeek: 0.43` hack — give Deliverable a `dueDays`
   field like TaskDef has.

Source documents (this machine): `C:\Users\lordb\Downloads` — "EHR360
Implementation Playbook.docx", "EHR360_Implementation_Lifecycle_v2_INTERNAL.docx",
"Practice_Onboarding_Form_v1.0.1.pdf", plus the original build brief
"cowork-brief-migration-planner.md" and v1 artifact "migration-planner.jsx".
