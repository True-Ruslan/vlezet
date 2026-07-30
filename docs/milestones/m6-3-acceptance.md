# M6.3 Exact Spatial Constraints — Acceptance

**Date:** 2026-07-30  
**PR:** #15 `feat: M6.3 exact spatial constraints`  
**Status:** implementation complete; strict automated gates PASS; representative real-browser acceptance required before merge.

## Product contract

M6.3 adds the first exact numeric hard planning rule:

```text
pair-min-gap(objectA, objectB, minimumMm)
```

It means:

> The shortest Euclidean edge-to-edge distance between the two real oriented furniture footprints must be at least `minimumMm` canonical millimetres.

```text
VlezetDocument + room + selected furniture + constraints
        ↓
bounded deterministic planning generation
        ↓
existing M2 fit/collision/door/clearance authority
        ↓
exact oriented-footprint gap authority
        ↓
hard pair-min-gap rejection
        ↓
existing M6.2 soft ranking
        ↓
structured exact evidence
        ↓
ephemeral 2D Preview + contextual witness overlay
        ↓ explicit Apply + current-document revalidation
one semantic planning/apply-candidate Undo/Redo operation
```

Non-negotiable boundaries:

- `VlezetDocument` remains the only persistent layout authority;
- millimetres remain canonical;
- Canvas, DOM and Three.js are never measurement authorities;
- M2 remains authoritative for containment, collisions, doors and clearances;
- exact hard constraints cannot be rescued by soft scoring;
- planning constraints, candidates, Preview, active pair and overlay remain ephemeral;
- Apply revalidates against the current document before mutation;
- one Apply remains one Undo/Redo operation;
- no wall-gap rule, generic expression engine, LLM dependency, whole-apartment orchestration, direct 3D editing or second persisted planning model is introduced.

## Exact geometry authority

Framework-independent APIs:

```ts
minimumGapWitnessBetweenOrientedRectangles(first, second)
minimumDistanceBetweenOrientedRectangles(first, second)
```

Witness result:

```ts
{
  distanceMm: number,
  firstPoint: Point2 | null,
  secondPoint: Point2 | null,
  relation: "separated" | "touching" | "overlapping",
}
```

Semantics:

- separated footprints return the exact shortest contour points and distance;
- touching returns `0` plus one deterministic coincident contact witness;
- overlap returns `0` and nullable witnesses because no unique shortest segment exists;
- reversing rectangle order preserves distance and swaps witness ownership;
- rotation is measured through oriented footprints, not axis-aligned bounds;
- deterministic ties use a stable lexicographic point order;
- values within `GEOMETRY_EPSILON_MM` normalize to zero;
- the numeric distance API delegates to the witness API, preventing validator/visualization drift.

Verified geometry includes axis-aligned gaps, rotated known distances, edge contact, rotated corner-to-edge contact, overlap, symmetry and deterministic parallel-edge ties.

## `pair-min-gap` contract

```ts
{
  kind: "pair-min-gap",
  objectIds: ["sofa", "table"],
  minimumMm: 800,
}
```

Validation and identity:

- pair IDs are unordered and normalized lexically;
- exactly two distinct selected object IDs are required;
- `minimumMm` must be finite and `>= 0`;
- `0` is a real constraint and differs from no constraint;
- negative, `NaN`, `Infinity`, self-pair, missing/outside references and duplicates fail closed;
- qualitative `pair-distance` and exact `pair-min-gap` may coexist on the same pair;
- normalized `minimumMm` participates in deterministic candidate identity;
- input constraint order does not affect deterministic identity.

Hard comparison:

```text
actualGap + 1e-6 mm >= requiredMm  → satisfied
actualGap + 1e-6 mm <  requiredMm  → rejected
```

The epsilon only absorbs floating-point noise.

Verified boundary behavior:

```text
799 < 800  → rejected
800 = 800  → accepted
842 > 800  → accepted
```

An impossible minimum produces zero offered alternatives, never a violating result.

## Structured evidence

Planning candidate evaluation exposes:

```ts
{
  kind: "pair-min-gap",
  objectIds: [string, string],
  requiredMm: number,
  actualMm: number,
  satisfied: boolean,
}
```

Exact evidence is no longer duplicated in generic reason strings. This provides one typed source for hard validity, panel cards and canvas annotation.

Result cards render:

```text
↔ Точное расстояние
Диван — Стол
Фактически: 842 мм
Требуется: ≥ 800 мм
По ближайшим точкам повёрнутых контуров
[Показывается на плане | Показать на плане]
```

All bounded exact evidence cards are rendered; no arbitrary reason-count cutoff can hide a later exact pair.

## Planning input UX

For every selected pair:

```text
Предпочтение
[ Не важно | Ближе друг к другу | Дальше друг от друга ]

↔ Минимальный зазор по контурам
[ 800 ] мм
```

Explicit helper copy:

```text
Кратчайшее расстояние между внешними контурами предметов с учётом поворота.
Это не размер предмета и не расстояние между центрами.
```

Rules:

- empty input = no exact rule;
- `0` = a real zero-minimum rule;
- decimal comma is supported;
- invalid/negative/non-finite input blocks generation locally;
- changing any input clears stale result, Preview, active pair and overlay;
- qualitative near/far remains centre-based soft ranking;
- exact contour gap remains hard validity;
- no planning input is persisted.

## Contextual 2D exact-gap visualization

During a planning Preview, one active exact pair is visualized using a semantic language distinct from normal dimensions:

- violet/purple rather than dimension blue or clearance amber;
- dashed double-ended arrow between the authoritative nearest contour points;
- endpoint markers on both real rotated footprints;
- compact pill `↔ Зазор N мм`;
- fixed screen-space strokes, markers and text across zoom levels;
- clamped pill inside the visible stage;
- zero-length contact marker instead of a degenerate line;
- danger semantic if current Preview geometry is stale and below the minimum;
- `listening={false}` throughout;
- no additional physical Konva Layer.

Visibility:

- Preview + exact constraint + active pair only;
- one exact pair auto-selects when Preview starts;
- with several pairs, deterministic first pair auto-selects and result cards can switch it;
- only one overlay is visible at a time;
- closing planning, clearing Preview or changing input clears the active pair;
- no overlay in normal editing, qualitative-only planning or 3D.

The canvas receives a pure `ExactGapAnnotation` derived from the preview document. It does not implement or approximate closest-distance geometry itself.

## Apply-time revalidation

Existing architecture remains unchanged:

```text
applyPlanningCandidateToDocument()
        ↓
evaluatePlanningCandidate(currentDocument, candidate)
        ↓
M2 + exact constraint revalidation
        ↓ valid only
ordinary selected-object transform update
```

Verified:

- object dimensions may change after generation and invalidate an old candidate;
- exact gap is recomputed from current dimensions plus candidate transforms;
- stale exact candidate fails atomically with no partial mutation;
- malformed direct candidates fail closed;
- no spacing math exists in `apply.ts`;
- successful Apply remains one semantic history entry.

## Reported inspector viewport regression

Browser acceptance identified that selecting furniture could push the right inspector outside the viewport because toolbar min-content widened the root Grid.

Fix retained in this PR:

```css
.editor-app { grid-template-columns: minmax(0, 1fr); }
```

Optional toolbar status/shortcut copy is hidden before common desktop overflow. The stylesheet remains imported after base globals, and the regression has automated coverage.

## TDD evidence

Observed RED→GREEN cycles include:

1. missing exact numeric geometry primitive;
2. missing `pair-min-gap` contract and exact `799/800/842` boundary;
3. stale Apply/direct-candidate revalidation;
4. missing exact UI parser/controls/copy;
5. misleading hard-constraint summary;
6. reason cutoff hiding later exact evidence;
7. inspector viewport overflow;
8. missing authoritative closest-point witness API;
9. missing structured evidence on candidate evaluation;
10. missing active exact-pair ephemeral state;
11. missing pure preview annotation view-model;
12. missing structured exact result cards;
13. missing non-interactive canvas overlay and layer-budget integration.

Every production layer was introduced only after the corresponding failing contract.

## Automated verification

Latest exact code head before this acceptance-record update:

```text
a2bae8b97c82cf3509ca3542139566a4993d18b3
GitHub Actions 30542352257 — PASS
```

Passed on that exact code head:

- [x] `pnpm install --frozen-lockfile`
- [x] full unit suite
- [x] TypeScript typecheck
- [x] ESLint
- [x] production Next build

The final documentation head must also pass the same strict gate before browser acceptance.

## Architecture self-review

- [x] no `VlezetDocument` schema/migration changes;
- [x] no IndexedDB/autosave/project-backup planning persistence;
- [x] no Three.js/Canvas/DOM geometry authority;
- [x] exact geometry remains framework-independent;
- [x] numeric distance delegates to witness calculation;
- [x] no duplicate M2 collision/door/containment engine;
- [x] exact evidence is typed and not duplicated in generic reasons;
- [x] active pair and annotation are UI-only;
- [x] only one exact overlay is rendered;
- [x] no sixth Konva Layer;
- [x] Apply/history code paths remain unchanged;
- [x] inspector viewport fix remains imported;
- [x] no network/LLM dependency for correctness.

## Representative real-browser acceptance — required before merge

Use the same apartment, viewport and browser scale that exposed the inspector regression.

### Inspector and baseline

- [ ] Select furniture and confirm the complete right inspector remains visible.
- [ ] Leave exact inputs empty and confirm ordinary M6.1/M6.2 generation, Preview and Apply still work.

### Exact input and evidence

- [ ] Select two movable objects and enter a feasible minimum, preferably `800` mm.
- [ ] Confirm the input is labelled `↔ Минимальный зазор по контурам`.
- [ ] Confirm helper copy explicitly says this is not an object size or centre distance.
- [ ] Generate alternatives.
- [ ] Confirm result cards separately show `Фактически`, `Требуется` and contour semantics.
- [ ] Confirm no generic bullet duplicates the exact `required / actual` sentence.

### Canvas witness

- [ ] Preview an exact-constrained candidate.
- [ ] Confirm one violet dashed double-arrow connects the visually nearest points of the two furniture contours.
- [ ] Confirm the pill says `↔ Зазор N мм`, not only `N мм`.
- [ ] Confirm ordinary blue width/depth dimensions remain visually distinct.
- [ ] Rotate one object in a generated alternative and confirm witness endpoints follow the real rotated contours.
- [ ] Confirm a `0` contact uses a contact marker and `↔ Зазор 0 мм`.

### Multiple pairs and stale behavior

- [ ] Configure several exact pairs and use `Показать на плане`.
- [ ] Confirm only one exact overlay is visible at a time.
- [ ] Confirm the active card says `Показывается на плане`.
- [ ] Change an exact input and confirm old result, Preview and overlay clear together.
- [ ] Enter an impossible minimum and confirm no violating alternative is offered.
- [ ] Enter invalid/negative input and confirm generation is disabled.

### Apply and persistence

- [ ] Confirm Preview/overlay creates no Undo step or save operation.
- [ ] Apply a valid alternative and confirm ordinary 2D furniture matches Preview.
- [ ] Switch to 3D and confirm the applied ordinary document positions.
- [ ] Undo once and confirm the full candidate restores together.
- [ ] Redo once and confirm the full candidate returns.
- [ ] Reload and confirm only explicitly applied transforms persist; exact planning state does not.
- [ ] Confirm no M2, M5, M6.1 or M6.2 regression.

## Merge gate

Do not mark M6.3 DONE or merge PR #15 until:

1. final exact PR head strict CI is PASS;
2. representative browser checklist is explicitly accepted;
3. any browser-discovered regression is fixed with a new exact-head PASS.

After explicit browser acceptance:

```text
mark PR #15 Ready
→ verify exact head + strict CI PASS
→ squash merge
→ open a separate canonical docs PR
→ update PROJECT_STATE.md / ROADMAP.md / CHANGELOG.md / acceptance with merge SHA
→ verify docs PR exact-head CI
→ squash merge docs PR
```
