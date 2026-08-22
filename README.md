# EHR 360 — Cutover Planner

Planning and tracking tool for EHR 360 implementations, built from
**Implementation Playbook v5**. An implementation lead enters a go-live date,
answers four classification questions, marks which systems move — and gets
two feasibility verdicts (build-ready and billing-ready), the full work-back
schedule, and week-by-week progress tracking with a server-side audit trail.

Not a document generator: the schedule is worked through in live meetings
with items marked complete as they close.

## Run

```bash
npm install
npm run dev      # API on :5177 + Vite on :5199 (proxied)
npm test         # engine goldens + Neuro Heart correctness tests
npm run build    # production build
npm start        # serve dist/ + API from one process on :5177
```

Requires Node ≥ 22 (`node:sqlite`). Data lives in `server/data/planner.db`
(gitignored). First visit: create an account — writes are recorded against
your name in the audit trail.

## The model (v5)

- **Implementation type** — four questions in order (EHR replaced? contracts
  under this TIN? RCM client? submitter changes?) → Type A/B/C/D, recorded at
  kickoff, driving sequencing. Question 4 is the one that breaks naive
  models: EHR 360 submits through its own clearinghouse, so the submitter
  almost always changes — **§11b EDI enrollment is in full scope even on
  Type B**, where payer contracts are untouched.
- **§11 is two workstreams**: §11a payer contracts/credentialing (attaches
  to the TIN; 90–180 days where new; verify-only on Type B) and §11b EDI
  submitter enrollment (attaches to the submitter; 30–60 days per payer per
  transaction type; Types A, B and C).
- **Two clocks, two dates**: build-ready (internally controlled, computed on
  the build-only dependency subgraph) and billing-ready (third-party gated:
  EDI, credentialing, EPCS, telephony port, underwriting). The gap between
  them is itself information — a practice can see patients it cannot bill for.
- **Enrollment tracker**: one row per payer, three separate status columns
  (837 / 835 / EFT) each with submitted/approved dates, plus confirmed
  receiver for 835 and confirmed account for EFT. The gate tests 837+835
  live for payers covering ≥80% of collections; 837-live-but-835-unconfirmed
  is surfaced as the silent gap it is. Payer name-variant collapsing is a
  tracked dependency of reliable enrollment tracking (CSV import groups by
  payer ID and flags variants).
- **ERA cutover order is a recorded decision**, not a rule — both orders
  carry risk depending on legacy A/R; the billing lead is named against it.

## Where things live

| Path | Contents |
|---|---|
| `src/data/tasks.json` | Task library — **data, not code**. v5 §4 master schedule with declarative scope conditions, dependency graph, clocks, gates |
| `src/data/deliverables.json` | Appendix A (51 items), scope-filtered |
| `src/data/readiness.json` | Appendix B (37 evidenced criteria + documented-exception path) |
| `src/data/neuro-heart-payers.json` | Real seed: 52 payer IDs, four payers = 81.6% of collections |
| `src/domain/conditions.ts` | Interpreter for the JSON condition language |
| `src/engine/schedule.ts` | Two-clock work-back scheduler; provenance-tracked critical path |
| `server/index.mjs` | Express + node:sqlite — accounts, sessions, practices, audit trail, optimistic concurrency |
| `tests/engine.test.ts` | Library validation, classification, two-clock goldens, **Neuro Heart Type B correctness test** |

Duration assumptions are pinned per practice at creation; editing globals
never silently moves an agreed plan — "recalculate" is an explicit, audited
action. Every figure is an estimate until Neuro Heart's planned-vs-actual
replaces it.

## Open decisions surfaced in the tool (v5 Appendix C)

Delegated clearinghouse enrollment coverage (1b) · submitter-of-record
structure (1c) · ERA routing behaviour mid-cycle (1d) · named go-live
decision-maker (1) · EPCS ownership (2) · discrete-vs-PDF notes by source
EMR (3) · legacy access terms (4) · open A/R ownership (5).
