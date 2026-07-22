# M6.2 Constraint-Aware Planning — Acceptance

**Date:** 2026-07-23  
**PR:** #13 `feat: M6.2 constraint-aware planning`  
**Status:** implementation complete; automated gates required on exact final head; representative real-browser acceptance required before merge.

## Product contract

M6.2 extends accepted M6.1 with a deliberately small structured vocabulary of explicit user intent.

```text
VlezetDocument + selected room/objects + PlanningConstraint[]
        ↓
shared fail-closed constraint validation
        ↓
bounded deterministic M6.1 candidate generation
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

Non-negotiable boundaries:

- `VlezetDocument` remains the only persistent apartment/layout authority;
- constraints and candidates remain ephemeral structured planning data;
- M2 room containment, collisions, door swing and clearances remain hard authority;
- hard constraints reject and cannot be rescued by scoring;
- soft preferences affect deterministic ordering only;
- Apply revalidates the candidate and carried constraint-set against the current document;
- preview does not mutate document/history/autosave/IndexedDB;
- Apply still changes only ordinary selected-object position/canonical rotation;
- one Apply remains one Undo/Redo step;
- no LLM/API dependency, opaque AI score, whole-apartment orchestration or second persisted layout model.

## Delivered structured constraint vocabulary

### `lock-object` — hard

```text
Не двигать
```

- referenced object must be part of the selected planning set;
- generator exposes only its current transform;
- evaluator independently checks the candidate still matches the current document transform;
- stale lock state fails closed at candidate evaluation/Apply;
- all-selected-objects locked is rejected because there is no movable planning problem.

### `prefer-room-boundary` — soft

```text
Ближе к стене
Ближе к углу
```

Supported only in the already-supported deterministic rectangular-room scope.

- wall metric: minimum footprint-to-inner-room-boundary gap in millimetres;
- corner metric: minimum Euclidean footprint-corner to room-corner distance in millimetres;
- lower is better;
- evidence exposes the measured millimetres.

### `pair-distance` — soft

```text
Ближе друг к другу
Дальше друг от друга
```

- pair is unordered and normalized deterministically;
- two distinct selected objects required;
- metric is Euclidean centre-to-centre distance in millimetres;
- `near`: lower is better;
- `far`: higher is better;
- UI explicitly explains that the relationship is measured between object centres.

## Validation / conflict rules

- maximum 9 constraints;
- unknown/malformed constraints fail closed;
- every referenced object must belong to the selected set;
- self pair is invalid;
- duplicate/conflicting boundary preference on one object is invalid;
- duplicate/conflicting near/far preference on one unordered pair is invalid;
- duplicate locks are invalid;
- all selected objects locked is invalid;
- constraints normalize into stable deterministic order;
- the same shared validator is used by request generation and candidate revalidation.

## Deterministic preference scoring

Soft metrics are normalized by the rectangular target-room diagonal `D` into `[0,1]` penalties:

- wall: `wallGap / D`;
- corner: `cornerDistance / D`;
- near pair: `centreDistance / D`;
- far pair: `1 - centreDistance / D`;
- values are clamped to `[0,1]` and equal-weight penalties are summed.

Ranking order:

1. M2-valid candidates only;
2. fewer `tight` selected objects;
3. fewer M2 recommendation diagnostics;
4. lower constraint `preferencePenalty`;
5. fewer changed rotations;
6. lower total movement;
7. stable deterministic key.

Therefore user intent matters, but never outranks hard geometry or existing M2 fit/recommendation quality.

## UX delivered

The existing M6.1 planning panel is extended instead of creating a second planning mode.

Per selected object:

- `Не двигать`;
- `Без предпочтения`;
- `Ближе к стене`;
- `Ближе к углу`.

Per selected object pair:

- `Не важно`;
- `Ближе друг к другу`;
- `Дальше друг от друга`.

Changing selection, lock or preference state clears stale results and ghost preview before another generation.

Result cards keep authoritative M2 explanations and add deterministic constraint evidence such as:

```text
Диван: до ближайшей стены 24 мм.
Кровать: до ближайшего угла 180 мм.
Диван ↔ Стол: 1450 мм между центрами; предпочтение «ближе».
Стол зафиксирован и не перемещается.
```

## TDD / RC evidence

Observed RED→GREEN work:

1. structured constraints did not exist → RED contract tests for normalization/validation/lock/metrics;
2. first core implementation exposed only a canonical-order expectation mismatch → test aligned to the deliberately stable lexical normalization order;
3. old M6.1 UI fixture lacked the new `preferencePenalty` field → type contract updated with M6.2 view tests;
4. M6.2 UI test isolated a wording-only mismatch while behavior was correct → assertion aligned to explicit `между центрами предметов` semantics;
5. self-review found generator/request validation stronger than direct candidate Apply validation → dedicated RED proved conflicting/self-pair/all-locked direct candidates could pass;
6. shared `validatePlanningConstraintSet()` introduced so request validation and candidate/Apply revalidation use the same fail-closed rules;
7. explicit Apply regression verifies a locked object changed after generation invalidates the whole operation atomically;
8. candidate stable identity test verifies constraint order invariance and intent-sensitive identity.

## Automated verification

Accepted intermediate code head before final acceptance documentation:

```text
3fb53c7d9fdf43ef325cb813daca051b1386c646
GitHub Actions 29962048260 — PASS
```

Passed on that head:

- [x] `pnpm install --frozen-lockfile`
- [x] full unit suite
- [x] TypeScript typecheck
- [x] ESLint
- [x] production Next build

Final exact-head CI must be rerun after this acceptance documentation/test commit and recorded in PR #13 before browser acceptance/merge.

## Architecture self-review

Changed-file review confirms:

- [x] no `VlezetDocument` schema/migration change;
- [x] no constraint/planning state added to IndexedDB, project backup or autosave;
- [x] no Three.js/mesh authority introduced;
- [x] no duplicate fit/collision/door engine introduced;
- [x] M2 remains hard authority before soft preference ranking;
- [x] constraint validation is shared by request and candidate/Apply boundaries;
- [x] candidate stable identity includes normalized intent;
- [x] no random candidate ordering;
- [x] preview remains the existing ephemeral planning UI store;
- [x] Apply remains the existing single semantic history operation;
- [x] no LLM/network dependency for correctness.

## Real-browser acceptance — required before merge

Use the representative apartment and a rectangular room with preferably 2–3 furniture objects.

### Baseline / regression

- [ ] Open the room inspector → `Варианты расстановки`.
- [ ] Select 2–3 objects.
- [ ] Generate without constraints and confirm ordinary M6.1 behavior still works.
- [ ] Preview remains ghost-only/non-mutating.
- [ ] Apply → one Undo → one Redo still moves/restores all candidate transforms atomically.

### Hard lock

- [ ] Select at least two objects.
- [ ] Enable `Не двигать` for one object.
- [ ] Generate alternatives.
- [ ] Confirm the locked object does not move/rotate in every preview while another selected object may move.
- [ ] Apply and confirm the locked object remains exactly in place.
- [ ] Confirm UI prevents useful generation when every selected object is locked.

### Wall / corner preference

- [ ] For a movable object choose `Ближе к стене` and generate.
- [ ] Confirm result explanations show measured distance to the nearest wall.
- [ ] Change to `Ближе к углу`; confirm previous result/preview clears before regeneration.
- [ ] Generate and confirm explanations now show distance to nearest corner.
- [ ] Where multiple alternatives exist, confirm the best-ranked preview visibly follows the selected preference better than an unconstrained or less-preferred alternative.

### Pair near / far preference

- [ ] Select at least two movable objects.
- [ ] Set pair to `Ближе друг к другу`; generate and inspect evidence in millimetres between centres.
- [ ] Change the same pair to `Дальше друг от друга`; regenerate.
- [ ] Confirm ordering/preview changes consistently when the candidate space permits it.
- [ ] Confirm helper copy makes centre-to-centre semantics understandable.

### Integration

- [ ] Apply a constrained alternative.
- [ ] Switch to 3D and confirm M5.2 projects the applied ordinary document positions.
- [ ] Use M5.4 inspection and confirm dimensions/fit remain correct.
- [ ] Reload project and confirm only explicitly applied ordinary transforms persist; constraints themselves were not persisted as a second layout state.
- [ ] Confirm manual furniture editing still works after constrained planning.
- [ ] Confirm no M2 fit, M5 spatial/inspection or M6.1 regression.

## Merge gate

Do not mark M6.2 DONE or merge PR #13 until:

1. final exact PR head strict CI is PASS;
2. representative browser checklist above is accepted;
3. browser-discovered regressions, if any, receive fixes and a new exact-head PASS.

After acceptance:

```text
mark PR #13 Ready
→ verify exact head + CI
→ squash merge
→ update PROJECT_STATE.md / ROADMAP.md / CHANGELOG.md with merge SHA
→ choose the next narrow M6 slice from evidence
```
