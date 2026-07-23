# M6.2 Constraint-Aware Planning — Implementation Plan

**Branch:** `feat/m6-2-constraint-aware-planning`

## Task 1 — Structured constraint contracts

Files:

- `packages/planning/src/contracts.ts`
- `packages/planning/src/constraints.ts` (new)
- `packages/planning/src/index.ts`
- tests in `packages/planning/src/*.test.ts`

TDD:

1. RED tests for supported constraint types, max count, missing/non-selected refs, duplicate/conflicting constraints, pair distinctness and all-selected-locked failure.
2. Implement stable normalization/keying and fail-closed validation.
3. Strict CI GREEN.

## Task 2 — Hard lock semantics + deterministic generation identity

Files:

- `packages/planning/src/planner.ts`
- `packages/planning/src/evaluation.ts`
- tests

TDD:

1. RED: locked selected object receives current transform only; stale lock invalidates candidate; candidate identity differs when normalized intent differs.
2. Implement locked option restriction and hard constraint evaluation.
3. Strict CI GREEN.

## Task 3 — Soft deterministic metrics/ranking

Files:

- `packages/planning/src/constraints.ts`
- `packages/planning/src/evaluation.ts`
- tests

TDD:

1. RED: prefer wall, prefer corner, pair near/far metrics/evidence.
2. RED: preference penalty ranks after M2 tight/recommendations and before rotation/movement.
3. Implement normalized `[0,1]` penalties using room diagonal.
4. Strict CI GREEN.

## Task 4 — Revalidated atomic Apply

Files:

- `packages/planning/src/apply.ts`
- `packages/editor-core/src/planning-editing.ts` if adapter changes are needed
- tests

TDD:

1. RED: Apply rejects candidate whose lock constraint is stale against current document.
2. Ensure candidate-carried constraints are revalidated before ordinary transform mutation.
3. Preserve one semantic `planning/apply-candidate` history entry.
4. Strict CI GREEN.

## Task 5 — Constraint-aware planner UI

Files:

- `apps/web/components/planning/planning-panel.tsx`
- `apps/web/components/planning/planning-panel.test.tsx`
- `apps/web/app/globals.css` if necessary

UI:

- per selected object: `Не двигать`; boundary preference select;
- per selected pair: `Не важно / Ближе / Дальше`;
- helper copy says pair metric is centre-to-centre;
- deterministic structured request mapping;
- changing any constraint clears result + preview;
- result cards show constraint evidence.

TDD:

1. RED view/helper mapping tests.
2. GREEN UI integration.
3. Strict CI GREEN.

## Task 6 — Acceptance + merge gate

- add `docs/milestones/m6-2-acceptance.md`;
- self-review changed files for source-of-truth and persistence boundaries;
- exact-head strict CI PASS;
- representative browser acceptance;
- only then Ready → squash merge → canonical state/roadmap/changelog update.
