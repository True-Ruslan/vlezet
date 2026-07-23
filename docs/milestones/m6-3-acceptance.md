# M6.3 Exact Spatial Constraints — Acceptance

**Date:** 2026-07-23  
**PR:** #15 `feat: M6.3 exact spatial constraints`  
**Status:** implementation complete; automated gates PASS on code RC; final exact-head CI and representative real-browser acceptance required before merge.

## Product contract

M6.3 adds the first exact numeric hard planning rule:

```text
pair-min-gap(objectA, objectB, minimumMm)
```

Meaning:

> The minimum Euclidean edge-to-edge distance between the two oriented rectangular furniture footprints must be at least `minimumMm` canonical millimetres.

Architecture:

```text
VlezetDocument + selected room/objects + PlanningConstraint[]
        ↓
shared fail-closed constraint validation
        ↓
@vlezet/planning bounded deterministic generation
        ↓
existing M2 evaluateObjectFits() hard authority
        ↓
@vlezet/geometry exact oriented-footprint distance
        ↓
pair-min-gap hard rejection
        ↓
existing M6.2 deterministic soft ranking
        ↓
measured explanations
        ↓
ephemeral 2D ghost preview
        ↓ explicit Apply + current-document revalidation
one semantic planning/apply-candidate Undo/Redo operation
```

Non-negotiable boundaries:

- `VlezetDocument` remains the only persistent apartment/layout authority;
- millimetres remain canonical; no Canvas/DOM/Three.js measurement authority;
- M2 containment/collision/door/clearance remains authoritative and unchanged;
- exact hard constraints cannot be rescued by soft scoring;
- exact constraints/candidates/preview remain ephemeral;
- Apply recomputes validity against the current document before mutation;
- Apply changes ordinary selected-object transforms only and remains one semantic history step;
- no wall-gap rule, generic expression language, LLM dependency, whole-apartment orchestration, direct 3D editing or second persisted planning model in M6.3.

## Delivered exact geometry primitive

New framework-independent geometry API:

```ts
minimumDistanceBetweenOrientedRectangles(first, second): number
```

Semantics:

- disjoint oriented rectangles → exact shortest Euclidean boundary distance in millimetres;
- touching → `0`;
- overlapping → `0`;
- symmetric A/B result;
- rotation is measured exactly through oriented footprints, not AABBs;
- existing `GEOMETRY_EPSILON_MM` is used only for floating-point zero normalization.

Verified cases include:

- exact `1000 mm` axis-aligned gap;
- axis-aligned touch;
- rotated corner-to-edge point contact;
- overlap;
- known rotated `500 mm` separation;
- symmetry.

## Delivered `pair-min-gap` contract

```ts
{
  kind: "pair-min-gap",
  objectIds: ["sofa", "table"],
  minimumMm: 800,
}
```

Validation/normalization:

- pair is unordered and normalized into stable lexical ID order;
- exactly two distinct selected object IDs required;
- `minimumMm` must be finite and `>= 0`;
- `0` is valid and distinct from no constraint;
- negative, `NaN`, `Infinity`, `-Infinity` fail closed;
- outside-selection references fail closed;
- duplicate/conflicting exact rules for one unordered pair fail closed;
- `pair-distance` soft near/far and `pair-min-gap` hard minimum may coexist on the same pair;
- normalized `minimumMm` participates in deterministic intent/candidate identity;
- changing constraint input order does not change stable identity;
- changing `minimumMm` changes stable intent identity.

## Hard evaluation and measured evidence

Comparison boundary:

```text
actualGap + 1e-6 mm >= requiredMm  → satisfied
actualGap + 1e-6 mm <  requiredMm  → hard-invalid
```

The epsilon absorbs floating-point noise only; it is not a user-visible relaxation.

Structured evidence:

```ts
{
  kind: "pair-min-gap",
  objectIds: [string, string],
  requiredMm: number,
  actualMm: number,
  satisfied: boolean,
}
```

Deterministic display copy includes both values, for example:

```text
Диван ↔ Стол: требуется минимум 800 мм, фактически 842 мм.
```

Verified boundary behavior:

```text
799 < 800  → rejected
800 = 800  → accepted
842 > 800  → accepted + measured evidence
```

A soft `Ближе друг к другу` preference can coexist with an exact minimum, but it can never rescue a candidate below the hard minimum.

## Planner integration

Verified:

- same document + same exact constraints → same ordered candidate IDs;
- every returned exact-constrained alternative has `satisfied=true`;
- impossible `minimumMm` produces zero offered alternatives rather than violating the rule;
- M2 validity remains independently required before a candidate can be offered;
- bounded generation and maximum-three displayed alternatives are unchanged from M6.1.

## Apply-time revalidation

Existing Apply architecture remains intentionally unchanged:

```text
applyPlanningCandidateToDocument()
        ↓
evaluatePlanningCandidate(currentDocument, candidate)
        ↓
M2 + exact constraint revalidation
        ↓ valid only
ordinary document transform update
```

Regression coverage proves:

- a candidate valid against the original object dimensions can become invalid after current furniture dimensions change;
- exact gap is recomputed using current dimensions plus candidate transforms;
- stale exact candidate rejects with `candidate-invalid`;
- source/current document is not partially mutated on failure;
- malformed direct exact candidates (`NaN`, self-pair, missing/outside reference, duplicate exact identity) fail closed;
- no duplicate spacing math was added to `apply.ts`;
- one successful planning Apply remains one Undo/Redo operation through the existing semantic command.

## UX delivered

The existing planning panel is extended rather than creating another planning mode.

For each selected pair:

```text
Диван ↔ Стол

Предпочтение
[ Не важно | Ближе друг к другу | Дальше друг от друга ]

Минимальный проход между предметами
[ 800 ] мм
```

Rules:

- empty input = no exact rule;
- `0` = a real zero-minimum rule;
- decimal comma is explicitly supported (`800,5 → 800.5`);
- invalid/negative/non-finite text blocks generation with local validation;
- exact gap and qualitative near/far may be used together;
- helper copy explicitly distinguishes centre-based soft ranking from nearest-edge hard minimum;
- changing exact input clears stale result and ghost preview before regeneration;
- result explanations show required and actual edge-to-edge millimetres;
- no exact planning input is persisted to project storage.

## TDD / RC evidence

Observed RED→GREEN work:

1. exact geometry tests → RED `ERR_MODULE_NOT_FOUND` while existing geometry tests stayed green;
2. exact oriented-rectangle distance primitive → GREEN full strict gate;
3. `pair-min-gap` contract/identity tests → RED `Unsupported planning constraint` while existing planning tests stayed green;
4. exact `799/800/842` evaluation/evidence tests added before production evaluation support;
5. shared contract normalization + exact hard evaluator → GREEN full strict gate;
6. stale Apply/direct-candidate revalidation regressions → GREEN without changing `apply.ts`;
7. exact UI parser/builder/view tests → isolated RED: missing parser, missing exact constraint, missing controls/copy;
8. raw-input parser + exact pair UI + stale clearing → GREEN full strict gate;
9. planner-level deterministic/impossible-minimum regressions → GREEN;
10. rotated corner-to-edge touch self-review regression → GREEN with no production fix required, confirming the primitive already returned exact zero.

## Automated verification

Latest implementation code head before this documentation commit:

```text
6e4901105df67c815e6be9255b38fa0a6dc0170e
GitHub Actions 30000670721 — PASS
```

Passed on that exact code head:

- [x] `pnpm install --frozen-lockfile`
- [x] full unit suite
- [x] TypeScript typecheck
- [x] ESLint
- [x] production Next build

Final exact PR head CI must also PASS after this acceptance-document commit before browser acceptance/merge.

## Architecture self-review

Changed-file review confirms:

- [x] no `VlezetDocument` schema/migration changes;
- [x] no IndexedDB/project-backup/autosave planning persistence;
- [x] no Three.js/Canvas/DOM measurement authority;
- [x] exact distance primitive lives in framework-independent `@vlezet/geometry`;
- [x] no duplicate M2 collision/door/containment engine;
- [x] `pair-min-gap` is hard validity, not an opaque score;
- [x] M6.2 soft ranking order remains unchanged for hard-valid candidates;
- [x] normalized `minimumMm` participates in stable candidate identity;
- [x] no random candidate ordering/sampling introduced;
- [x] preview remains the existing ephemeral planning UI state;
- [x] Apply remains the existing single semantic history operation;
- [x] no network/LLM dependency for correctness.

## Real-browser acceptance — required before merge

Use the representative apartment and a rectangular room with at least two movable furniture objects.

### Baseline regression

- [ ] Open room → `Варианты расстановки`.
- [ ] Select 2–3 objects and leave exact minimum inputs empty.
- [ ] Confirm ordinary M6.1/M6.2 generation, constraints, preview and Apply still behave normally.

### Exact minimum gap

- [ ] Select two movable objects.
- [ ] Enter a feasible exact minimum, preferably `800` mm, for that pair.
- [ ] Generate alternatives.
- [ ] Confirm result explanation explicitly says `требуется минимум 800 мм` and shows `фактически ... мм`.
- [ ] Preview alternatives and confirm furniture visibly respects the minimum nearest-edge space.
- [ ] Confirm no offered alternative visibly violates the requested hard minimum.

### Combined exact + qualitative intent

- [ ] For the same pair choose `Ближе друг к другу` and keep exact `800 мм`.
- [ ] Regenerate.
- [ ] Confirm alternatives try to move the pair closer when candidate space permits but never cross below the exact minimum.
- [ ] Confirm helper text makes it clear that `Ближе/дальше` uses centres while minimum passage uses nearest furniture edges.

### Input/stale behavior

- [ ] Change the exact value (for example `800 → 1000`) and confirm old result/ghost preview clears immediately.
- [ ] Enter an impossible/high minimum and confirm no violating alternative is offered; a controlled no-result state is shown.
- [ ] Enter negative/invalid text and confirm generation is disabled with explicit local validation.
- [ ] Clear the input completely and confirm the exact rule is removed.
- [ ] Enter `0` and confirm it is treated as a real valid zero-minimum value, not as empty.

### Apply / integration

- [ ] Apply a valid exact-constrained alternative.
- [ ] Confirm ordinary 2D furniture matches the chosen preview.
- [ ] Switch to 3D and confirm M5.2 projects the applied ordinary document positions.
- [ ] Use M5.4 inspection and confirm dimensions/fit remain correct.
- [ ] Undo exactly once and confirm all candidate transforms restore together.
- [ ] Redo exactly once and confirm all candidate transforms return together.
- [ ] Reload project and confirm only explicitly applied ordinary transforms persist; exact planning inputs themselves are not persisted.
- [ ] Confirm manual furniture editing still works afterward.
- [ ] Confirm no M2 fit, M5 spatial/inspection, M6.1 or M6.2 regression.

## Merge gate

Do not mark M6.3 DONE or merge PR #15 until:

1. final exact PR head strict CI is PASS;
2. representative browser checklist above is accepted;
3. any browser-discovered regression receives a fix and new exact-head PASS.

After explicit browser acceptance:

```text
mark PR #15 Ready
→ verify exact head + strict CI PASS
→ squash merge
→ update this acceptance record with accepted head/run/merge
→ update PROJECT_STATE.md / ROADMAP.md / CHANGELOG.md in a separate canonical docs PR
```
