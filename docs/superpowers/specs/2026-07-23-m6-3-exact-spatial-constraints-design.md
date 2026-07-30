# M6.3 Exact Spatial Constraints — Design

**Date:** 2026-07-23  
**Status:** Approved for implementation planning  
**Branch:** `feat/m6-3-exact-spatial-constraints`

## 1. Goal

Extend accepted M6.2 Constraint-Aware Planning with the first exact millimetre-based hard spatial rule:

```text
pair-min-gap(objectA, objectB, minimumMm)
```

The rule means:

> The minimum 2D edge-to-edge distance between the two oriented furniture footprints must be at least `minimumMm` millimetres.

M6.3 deliberately proves one exact numeric rule end-to-end before adding broader rule systems, natural-language interpretation, whole-apartment planning or AI-generated geometry.

## 2. Product contract

The user should be able to express a requirement such as:

```text
Диван ↔ Стол
Минимальный проход между предметами: 800 мм
```

Every offered alternative must satisfy that requirement exactly according to deterministic 2D geometry.

The result must explain the requirement using measured evidence:

```text
Диван ↔ Стол
Требуется минимум: 800 мм
Фактически: 842 мм
```

A candidate with an actual gap below the required value is rejected as a hard constraint and is never rescued by soft preference scoring.

## 3. Scope

### In scope

- one new structured hard planning constraint: `pair-min-gap`;
- canonical millimetres only;
- exact minimum edge-to-edge distance between oriented rectangular furniture footprints;
- hard rejection when actual gap `< minimumMm`;
- exact evidence showing required and actual millimetres;
- composition with existing M6.2 `lock-object`, wall/corner preferences and pair near/far preferences;
- existing ephemeral preview;
- current-document revalidation before Apply;
- one semantic Apply / one Undo / one Redo;
- strict TDD, exact-head CI and representative browser acceptance.

### Explicit non-goals

- furniture-to-wall exact minimum gap;
- arbitrary polygonal furniture footprints;
- generic expression/rule language;
- accessibility/building-code standards automation;
- whole-apartment autonomous design;
- free-form LLM layout generation;
- opaque AI scoring;
- natural-language interpretation;
- direct 3D editing;
- photorealistic/interior-style generation;
- second persisted planning/layout state.

## 4. Exact geometry semantics

### 4.1 Footprints

The authoritative measured shapes are the same deterministic 2D furniture footprints already implied by ordinary `PlacedObject` state:

- `position`;
- `width`;
- `depth`;
- `rotationDeg`.

No Canvas pixels, DOM coordinates, Three.js meshes or approximate axis-aligned bounding boxes may be measurement authority.

### 4.2 Distance definition

For two oriented rectangular footprints A and B:

```text
minimumGap(A, B)
  = minimum Euclidean distance between their closed 2D boundaries
  when the footprints are disjoint
```

Required semantics:

- disjoint footprints → exact shortest Euclidean edge-to-edge distance;
- touching footprints → `0`;
- overlapping footprints → `0`;
- symmetry: `minimumGap(A,B) === minimumGap(B,A)` within deterministic numeric tolerance;
- rotated rectangles are measured as rotated rectangles, not bounding boxes.

Existing M2 collision authority remains unchanged. Overlapping objects are already invalid through M2; the geometry primitive still returns `0` so its semantics remain total and independently reusable.

### 4.3 Numeric boundary

`minimumMm`:

- finite number;
- integer or finite decimal accepted internally as millimetres;
- must be `>= 0`;
- `0` is valid;
- `NaN`, `Infinity`, `-Infinity` and negative values fail closed;
- UI input must parse explicitly and never silently coerce invalid text.

Comparison contract:

```text
actualGap + EPSILON >= minimumMm  → satisfied
actualGap + EPSILON <  minimumMm  → rejected
```

A small shared deterministic geometry epsilon may be used only to absorb floating-point noise, never as a user-visible relaxation of the requested millimetres.

## 5. Architecture

```text
VlezetDocument + PlanningConstraint[]
        ↓
shared fail-closed constraint validation
        ↓
@vlezet/planning bounded deterministic generation
        ↓
M2 evaluateObjectFits() hard authority
        ↓
@vlezet/geometry exact oriented-footprint gap
        ↓
pair-min-gap hard validation
        ↓
existing M6.2 deterministic soft ranking
        ↓
ranked measured explanations
        ↓
ephemeral 2D preview
        ↓ explicit Apply
current-document revalidation
        ↓
one semantic planning/apply-candidate history step
```

### 5.1 `@vlezet/geometry`

Add a framework-independent reusable primitive for exact minimum distance between two oriented rectangles.

Recommended public shape:

```ts
minimumDistanceBetweenOrientedRectangles(first, second): number
```

The function must:

- accept deterministic geometry values, not UI objects;
- return canonical world millimetres;
- return `0` for intersection/touching;
- be symmetric;
- remain independent of planning semantics.

Implementation should reuse existing oriented-rectangle helpers where possible. Do not duplicate SAT/corner-generation logic unnecessarily.

### 5.2 `@vlezet/planning`

Extend `PlanningConstraint`:

```ts
type PairMinimumGapPlanningConstraint = Readonly<{
  kind: "pair-min-gap";
  objectIds: readonly [string, string];
  minimumMm: number;
}>;
```

Constraint normalization:

- pair is unordered and stored in stable lexical ID order;
- stable identity includes pair identity;
- stable value includes `minimumMm`;
- changing input constraint order must not change candidate identity;
- changing `minimumMm` must change normalized intent/candidate identity.

Validation:

- exactly two distinct selected object IDs;
- both referenced IDs must belong to the planning selection;
- finite `minimumMm >= 0`;
- duplicate/conflicting `pair-min-gap` constraints for the same unordered pair fail closed;
- composition with a `pair-distance` soft preference for the same pair is allowed because the semantics are complementary;
- composition with locks is allowed;
- existing maximum-constraint budget remains enforced unless tests prove a justified adjustment is necessary.

### 5.3 Evaluation order

Candidate evaluation remains layered:

1. existing M2 plan validity / containment / object collision / door obstruction / clearance authority;
2. hard M6 constraints including `lock-object` and `pair-min-gap`;
3. only hard-valid candidates reach deterministic soft scoring;
4. M6.2 preference penalty continues to rank wall/corner/near/far intent;
5. rotations, movement and stable key remain later tie-breakers.

`pair-min-gap` never contributes a soft penalty. It is binary hard validity plus measured evidence.

## 6. Exact constraint evidence

For every evaluated `pair-min-gap`, the planner should derive structured evidence before formatting human-readable copy.

Recommended internal evidence fields:

```ts
{
  kind: "pair-min-gap";
  objectIds: [string, string];
  requiredMm: number;
  actualMm: number;
  satisfied: boolean;
}
```

Human-readable result copy may then be deterministic, e.g.:

```text
Диван ↔ Стол: требуется минимум 800 мм, фактически 842 мм.
```

For rejected candidates, structured evidence remains useful in tests/debugging even though rejected variants are not shown in the normal ranked result list.

Do not parse semantic values back out of human-readable strings.

## 7. UX

Extend the existing M6 planning pair controls rather than creating a second planning mode.

For each selected unordered object pair:

```text
Диван ↔ Стол

Предпочтение:
[ Не важно | Ближе друг к другу | Дальше друг от друга ]

Минимальный проход между предметами:
[ 800 ] мм
```

UX rules:

- empty minimum-gap input means no exact constraint for that pair;
- valid `0` is different from empty and means a real zero-minimum constraint;
- invalid numeric input blocks generation with local explicit validation copy;
- changing exact gap input clears stale results and ghost preview before regeneration;
- when a result is shown, evidence states required and actual millimetres;
- helper copy explicitly says distance is measured between nearest furniture edges, not centres;
- the existing M6.2 near/far preference can coexist with exact minimum gap.

Example combined intent:

```text
Предпочтение: Ближе друг к другу
Минимум: 800 мм
```

Meaning:

> Rank valid alternatives as close together as possible, but never allow their exact footprint gap below 800 mm.

## 8. Preview, Apply and persistence

No new persistent planning state.

```text
constraint input → ephemeral
candidate → ephemeral
preview → ephemeral
Apply → ordinary VlezetDocument transforms only
```

Preview:

- existing ghost preview path;
- no history entry;
- no autosave mutation;
- no IndexedDB planning state.

Apply:

- candidate carries normalized structured constraints;
- revalidate candidate against current document;
- recompute exact pair gap from current trusted geometry;
- reject atomically if a hard exact rule is now violated;
- only position/canonical rotation of selected ordinary objects may change;
- one `planning/apply-candidate` semantic history operation;
- one Undo restores all applied transforms;
- one Redo reapplies all transforms.

## 9. Failure handling

Fail closed for:

- malformed/unknown constraint kind;
- non-finite/negative minimum;
- self-pair;
- missing/stale referenced object;
- object outside planning selection;
- duplicate/conflicting exact constraint identity;
- invalid geometry needed for exact measurement;
- stale candidate that no longer satisfies minimum gap at Apply time.

No partial Apply is permitted.

## 10. Determinism

For the same:

- `VlezetDocument`;
- selected room/object IDs;
- normalized constraint set;

M6.3 must produce the same bounded candidate generation and same ordered accepted alternatives.

Exact spatial constraints must not introduce:

- random sampling;
- unstable object/pair iteration order;
- non-deterministic IDs;
- mesh/render dependent measurements.

## 11. TDD plan / required RED→GREEN contracts

### Geometry primitive

Tests must cover:

1. axis-aligned rectangles with exactly `1000 mm` gap;
2. touching rectangles → `0`;
3. overlapping rectangles → `0`;
4. rotated separated rectangles → known shortest distance;
5. symmetry A/B;
6. deterministic near-floating-point boundary behavior.

### Constraint normalization/validation

Tests must cover:

1. unordered pair normalization;
2. finite non-negative `minimumMm` accepted;
3. zero accepted;
4. negative rejected;
5. `NaN`/infinities rejected;
6. self-pair rejected;
7. outside-selection ID rejected;
8. duplicate/conflicting exact pair constraint rejected;
9. soft `pair-distance` + hard `pair-min-gap` on same pair compose successfully;
10. constraint input order does not change normalized set key;
11. changing `minimumMm` changes stable intent key.

### Candidate evaluation

Tests must cover:

1. `actual 799 < required 800` → hard invalid;
2. `actual 800 == required 800` → valid within deterministic epsilon contract;
3. `actual > required` → valid;
4. exact hard rule cannot be rescued by soft near/far score;
5. evidence exposes required/actual numeric values;
6. M2 collision remains independently authoritative.

### Apply boundary

Tests must cover:

1. valid generated candidate applies;
2. source document is not mutated during evaluation;
3. stale document change causing actual gap below minimum rejects Apply atomically;
4. one successful Apply remains one history entry;
5. one Undo/Redo covers all candidate transforms.

### UI

Tests must cover:

1. exact minimum-gap input per selected pair;
2. empty vs `0` semantics;
3. invalid input blocks generation;
4. changing value clears stale result/preview;
5. request generation emits normalized `pair-min-gap` constraint;
6. result renders required/actual edge-to-edge evidence and helper semantics.

## 12. Browser acceptance

Representative apartment, rectangular room, at least two movable furniture objects.

1. Baseline M6.1/M6.2 generation still works without exact constraints.
2. Enter a feasible minimum gap, e.g. `800 mm`, and generate.
3. Result explanation shows required and actual millimetres.
4. Preview visually respects the minimum space between nearest furniture edges.
5. Combine `Ближе друг к другу` with minimum gap and confirm best alternatives approach the limit without violating it when candidate space permits.
6. Change minimum gap and confirm stale result/preview clears.
7. Enter impossible/high requirement and confirm no invalid alternative is offered.
8. Apply a valid constrained candidate.
9. Switch to 3D and confirm ordinary document positions project normally.
10. One Undo restores the prior arrangement; one Redo restores the applied arrangement.
11. Reload and confirm only applied ordinary transforms persist, not exact planning constraints.
12. Manual editing, M2 fit and M5 spatial/inspection continue to work.

## 13. Acceptance gate

M6.3 is not DONE until all are true:

- exact geometry semantics implemented and unit-tested;
- shared planning validation supports `pair-min-gap` fail-closed;
- exact hard evaluation integrated without weakening M2;
- UI supports exact millimetre input and measured explanations;
- preview remains non-mutating;
- Apply revalidates exact gap against current document;
- one Apply remains one Undo/Redo;
- strict exact-head CI PASS;
- representative real-browser acceptance PASS;
- only then squash merge and update canonical state/roadmap/changelog.

## 14. Roadmap consequence

After accepted M6.3, the deterministic planning vocabulary will contain:

- hard locked objects;
- soft wall/corner preferences;
- soft near/far pair relationships;
- exact hard millimetre pair spacing.

Only then should the project consider an optional natural-language interpreter:

```text
natural-language intent
        ↓
reviewable structured PlanningConstraint[] draft
        ↓ explicit confirmation/editing
existing deterministic M6 planner
```

The interpreter must never directly mutate geometry or bypass deterministic validation.
