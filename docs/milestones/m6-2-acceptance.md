# M6.2 Constraint-Aware Planning — Acceptance

**Date:** 2026-07-23  
**PR:** #13 `feat: M6.2 constraint-aware planning`  
**Squash merge:** `db68d697540ddb9901fbddad0763d769e7d16851`  
**Status:** DONE / ACCEPTED.

## Acceptance result

M6.2 passed:

- exact-head strict CI;
- architecture self-review;
- representative real-browser acceptance on the user's apartment;
- baseline M6.1 regression checks;
- hard-lock checks;
- wall/corner preference checks;
- pair near/far preference checks;
- non-mutating preview checks;
- atomic Apply/Undo/Redo checks;
- 2D → 3D consistency checks.

Product owner confirmation:

> «Это работает настолько все гениально и четко как ты сказал, что я в восторге.»

## Accepted product contract

```text
VlezetDocument + selected room/objects + PlanningConstraint[]
        ↓
shared fail-closed constraint validation
        ↓
bounded deterministic candidate generation
        ↓
existing M2 evaluateObjectFits() hard authority
        ↓
hard constraint rejection + deterministic soft preference penalty
        ↓
ranked explainable alternatives
        ↓
ephemeral 2D ghost preview
        ↓ explicit Apply + current-document revalidation
one semantic planning/apply-candidate Undo/Redo operation
```

Non-negotiable boundaries remain intact:

- `VlezetDocument` is the only persistent apartment/layout authority;
- constraints and candidates are ephemeral planning data;
- M2 containment/collision/door-swing/clearance evaluation remains hard authority;
- hard constraints reject and cannot be rescued by scoring;
- soft preferences affect deterministic ranking only;
- preview never mutates document/history/autosave/IndexedDB;
- Apply revalidates against the current document;
- one Apply remains one semantic Undo/Redo operation;
- no LLM/API dependency, opaque AI score or second persisted layout state.

## Accepted structured constraint vocabulary

### `lock-object` — hard

UI: `Не двигать`.

- selected object remains at its current transform in every candidate;
- stale lock state fails closed before Apply;
- all-selected-objects locked is invalid because there is no movable planning problem.

### `prefer-room-boundary` — soft

UI:

- `Ближе к стене`;
- `Ближе к углу`.

Metrics are deterministic and expose measured millimetres.

### `pair-distance` — soft

UI:

- `Ближе друг к другу`;
- `Дальше друг от друга`.

Metric is explicit Euclidean centre-to-centre distance in millimetres.

## Validation / conflict rules accepted

- maximum 9 constraints;
- unknown/malformed constraints fail closed;
- every referenced object must belong to the selected planning set;
- self-pair is invalid;
- duplicate/conflicting boundary preferences are invalid;
- duplicate/conflicting near/far preferences on the same unordered pair are invalid;
- duplicate locks are invalid;
- all selected objects locked is invalid;
- constraints normalize into stable deterministic order;
- request generation and candidate/Apply revalidation use the same shared validator.

## Deterministic scoring accepted

Soft metrics are normalized by rectangular room diagonal `D`:

- wall: `wallGap / D`;
- corner: `cornerDistance / D`;
- near pair: `centreDistance / D`;
- far pair: `1 - centreDistance / D`.

Values are clamped to `[0,1]` and equal-weight penalties are summed.

Ranking order:

1. M2-valid candidates only;
2. fewer `tight` selected objects;
3. fewer M2 recommendation diagnostics;
4. lower constraint `preferencePenalty`;
5. fewer changed rotations;
6. lower total movement;
7. stable deterministic key.

Therefore user intent matters without outranking hard geometry or existing M2 fit quality.

## TDD / RC evidence

Observed RED→GREEN findings included:

1. missing structured constraint contracts;
2. deterministic normalization-order contract;
3. M6.1 fixture evolution for `preferencePenalty`;
4. explicit centre-to-centre wording contract;
5. generator/request validation stronger than direct candidate Apply validation;
6. dedicated RED proving conflicting/self-pair/all-locked direct candidates could bypass request validation;
7. shared `validatePlanningConstraintSet()` introduced for request and candidate/Apply boundaries;
8. stale locked-object Apply regression;
9. stable identity regression for order-invariant but intent-sensitive candidate identity.

## Automated verification

Final exact PR head before merge:

```text
a32b5f633ee5c36dafb5578d3c0c3f7eaa46d649
GitHub Actions 29962203961 — PASS
```

Passed:

- [x] `pnpm install --frozen-lockfile`
- [x] full unit suite
- [x] TypeScript typecheck
- [x] ESLint
- [x] production Next build

## Architecture self-review

- [x] no `VlezetDocument` schema/migration change
- [x] no planning constraints persisted in IndexedDB/project backup/autosave
- [x] no Three.js/mesh authority introduced
- [x] no duplicate fit/collision/door engine introduced
- [x] M2 remains hard authority before soft ranking
- [x] shared fail-closed constraint validation at request and Apply boundaries
- [x] candidate stable identity includes normalized intent
- [x] no random candidate ordering
- [x] preview remains ephemeral
- [x] Apply remains one semantic history operation
- [x] no LLM/network dependency for correctness

## Real-browser acceptance

All planned scenarios accepted:

- [x] baseline M6.1 generation still works without constraints
- [x] 2–3 selected objects generate deterministic alternatives
- [x] `Не двигать` keeps the locked object exactly in place
- [x] wall preference changes ranking/evidence as expected
- [x] corner preference changes ranking/evidence as expected
- [x] changing a constraint clears stale result/preview
- [x] pair `Ближе` / `Дальше` behaves consistently when candidate space permits it
- [x] helper copy makes centre-to-centre semantics understandable
- [x] preview remains ghost-only/non-mutating
- [x] explicit Apply updates ordinary furniture transforms
- [x] one Undo restores the entire candidate atomically
- [x] one Redo reapplies the entire candidate atomically
- [x] 3D reflects applied ordinary document transforms
- [x] M5.4 inspection remains correct
- [x] reload persists only explicitly applied ordinary transforms
- [x] manual furniture editing still works
- [x] no M2/M5/M6.1 regression observed

## Merge record

```text
PR #13
head:  a32b5f633ee5c36dafb5578d3c0c3f7eaa46d649
CI:    29962203961 — PASS
merge: db68d697540ddb9901fbddad0763d769e7d16851
```

M6.2 is complete. The next recommended narrow slice is **M6.3 Exact Spatial Constraints**: add explicit millimetre-based spacing rules before introducing natural-language interpretation or broader autonomous planning.
