# EHR 360 — Cutover Planner

A work-back planning instrument for EHR 360 implementations. Enter a go-live
date and mark which of the practice's fifteen systems move, stay, or don't
apply; the tool answers whether the date is achievable, names the earliest
date that is, and produces the full schedule behind it.

Built from the EHR 360 Implementation Playbook v3 (the task library, Appendix
A deliverables, and Appendix B readiness gate), the Implementation Lifecycle
SOP v2, the Practice Onboarding Form v1.0.1, and the payer enrollment model
(837 / 835 / EFT as three separate enrollments per payer, sequenced by share
of collections).

## Run

```bash
npm install
npm run dev      # http://localhost:5199
npm run build    # production build to dist/
```

## What it does

- **Feasibility verdict** — critical path computed from a real dependency
  graph (backward pass over predecessor constraints + playbook T-week
  targets), not fixed offsets. Infeasible dates get the earliest realistic
  Monday go-live.
- **Work-back schedule** — every in-scope playbook task with owner, start,
  due, duration, and critical-path flag, grouped by week for the weekly call.
  Task status (active / done / at risk / blocked) persists per practice and
  feeds back into the runway calculation.
- **Scope conflict warnings** — derived from the disposition combination
  (claims-move/remit-stay, charting-move/scheduling-stay, etc.), not a
  static list.
- **Payer enrollment sub-tracker** — one row per payer, three enrollments
  each, sequenced by collection share, tested against the ≥80%-of-collections
  readiness gate.
- **Client deliverables** (Appendix A) and **readiness gate** (Appendix B),
  filtered to scope, with real dates; the deliverables view prints clean for
  the practice.
- **Onboarding form pre-fill map** — field by field, what we can pull
  ourselves vs. the four categories that can never be self-served (decisions,
  contract data, documents, tribal knowledge).
- **Multi-practice portfolio** with phase and red items.
- **Duration assumptions are configuration** (Assumptions tab, localStorage)
  — every figure is an estimate until the first completed migration replaces
  it with observed data, and the UI says so.

## Where things live

| Path | Contents |
|---|---|
| `src/domain/tasks.ts` | Task library: playbook §3–12 master schedule, scope predicates, dependency graph |
| `src/domain/deliverables.ts` | Appendix A, scope-filtered |
| `src/domain/readiness.ts` | Appendix B, scope-filtered |
| `src/domain/durations.ts` | Editable duration model (estimates) |
| `src/domain/conflicts.ts` | Scope conflict rules |
| `src/domain/prefill.ts` | Onboarding form pre-fill map |
| `src/engine/schedule.ts` | Work-back scheduler, critical path, feasibility, milestones |
| `src/store.ts` | localStorage persistence (practices + assumptions) |

Data persists in the browser's localStorage: per practice — scope, dates,
task status, payer enrollments, gate confirmations; shared — duration
assumptions.

## Open questions the tool surfaces (deliberately)

Timeline conflict (8 weeks playbook vs 3–5 week claim, which is build-only);
unnamed go-live decision authority; practice-kept billing; discrete-vs-PDF
notes by source EMR; open A/R ownership at cutover; legacy read-only access
terms. Each is flagged in the UI where it affects output.
