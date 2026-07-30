# M6.3 Exact Gap Visualization — Design

**Date:** 2026-07-30  
**Status:** product design approved; implementation pending written-spec review  
**Parent milestone:** M6.3 Exact Spatial Constraints  
**Target PR:** #15 `feat/m6-3-exact-spatial-constraints`

## 1. Goal

Make the M6.3 `pair-min-gap` result immediately understandable in the editor.

The user must be able to distinguish three different concepts without reading implementation details:

1. an object's own width/depth dimensions;
2. qualitative or recommended use clearances;
3. the exact shortest gap between two real rotated furniture footprints.

The exact gap must be visually tied to the two closest points on the furniture contours and explicitly labelled as a **gap**, not shown as an unexplained millimetre value.

This is an acceptance-driven UX refinement inside M6.3, not a new persistent document feature or a separate milestone.

## 2. Approaches considered

### A. Contextual witness overlay plus structured evidence card — selected

- draw the exact shortest segment between the two closest footprint points during candidate Preview;
- use a distinct visual language from ordinary dimensions;
- show a compact canvas label `↔ Зазор 842 мм`;
- show `required / actual / measurement semantics` in a structured result block;
- display only one active exact pair at a time.

This provides direct spatial proof without turning the plan into a dense CAD drawing.

### B. Always render all exact gaps

This would make every exact rule continuously visible, but three selected objects can produce three pair constraints. Multiple lines and labels would overlap furniture, room labels and existing dimensions. This is rejected because the visual noise would undermine the clarity being added.

### C. Text-only explanation in the inspector

This is simple but does not answer the user's central question: *where exactly is that distance measured on the rotated furniture?* It is rejected because the geometry remains invisible.

## 3. UX model

### 3.1 Input copy

The pair control is renamed from a generic passage label to:

```text
↔ Минимальный зазор по контурам
```

Helper copy:

```text
Кратчайшее расстояние между внешними контурами предметов с учётом поворота.
Это не размер предмета и не расстояние между центрами.
```

The existing M6.2 qualitative preference remains separate:

```text
Ближе / дальше → ranked by object centres
Минимальный зазор → hard edge-to-edge footprint rule
```

An empty exact input still means “no exact rule”; `0` remains a real exact constraint.

### 3.2 Result evidence block

Each exact constraint in a ranked result is rendered as its own structured block rather than being buried inside the generic bullet list:

```text
↔ Точное расстояние
Диван — Стол
Фактически: 842 мм
Требуется: ≥ 800 мм
По ближайшим точкам повёрнутых контуров
[Показать на плане]
```

When this pair is active, the action becomes:

```text
[Показывается на плане]
```

The result summary and ordinary qualitative reasons remain, but the exact `required / actual` sentence is not duplicated in the generic reason list.

### 3.3 Canvas overlay

The active exact pair is shown in a dedicated non-interactive overlay above the ordinary and ghost furniture layers.

Visual language:

- violet/purple semantic colour, distinct from blue dimensions and amber recommended clearances;
- dashed shortest-segment line;
- small endpoint markers exactly on the nearest footprint points;
- no dimension extension lines;
- compact white/violet pill centred near the segment;
- pill text: `↔ Зазор 842 мм`;
- constant screen-space stroke, marker and text sizes at every zoom level;
- the overlay never receives pointer events.

A satisfied preview uses the normal exact-gap colour. If a previously generated Preview becomes stale after a document change and its actual gap is below the requirement, the overlay switches to the existing danger semantic and the pill communicates that the minimum is no longer satisfied. Apply still performs the authoritative current-document revalidation and fails atomically.

For a zero-length contact gap, the overlay uses one deterministic contact marker and an offset pill instead of trying to draw a zero-length line.

## 4. Visibility and active-pair behaviour

The overlay is deliberately contextual.

It is visible only when all of the following are true:

- the planning panel is open;
- a planning candidate is in Preview;
- the candidate contains at least one `pair-min-gap` constraint;
- both referenced objects still exist in the preview document;
- an exact measurement witness can be derived.

It is not shown:

- during normal manual editing without planning Preview;
- for qualitative `near/far` preferences without `pair-min-gap`;
- in 3D;
- after closing planning;
- after changing an input that clears the stale result/Preview;
- after Apply, unless a new candidate Preview is explicitly opened.

### One exact pair

The only exact pair becomes active automatically when Preview starts.

### Multiple exact pairs

The first pair in deterministic normalized constraint order becomes active automatically. Each structured exact evidence block exposes `Показать на плане` to switch the active pair. Only one overlay is rendered at a time.

Changing the preview candidate resets the active pair to that candidate's first exact constraint. Closing planning or clearing Preview clears the active pair.

## 5. Geometry contract

The current geometry authority returns only a numeric distance. The visualization needs the same authoritative calculation plus the closest-point witness.

Add a framework-independent geometry result:

```ts
type OrientedRectangleGapWitness = Readonly<{
  distanceMm: number;
  firstPoint: Point2 | null;
  secondPoint: Point2 | null;
  relation: "separated" | "touching" | "overlapping";
}>;
```

Add a pure function:

```ts
minimumGapWitnessBetweenOrientedRectangles(
  first: OrientedRectangle,
  second: OrientedRectangle,
): OrientedRectangleGapWitness
```

Rules:

- `separated`: returns exact closest points on both contours and their distance;
- `touching`: returns deterministic coincident contact points and `0`;
- `overlapping`: returns `0`, relation `overlapping`, and nullable witness points where a unique shortest segment does not exist;
- reversing rectangle order preserves distance and swaps witness ownership;
- deterministic tie-breaking is required when multiple equally short witness pairs exist;
- floating-point values at or below the existing geometry epsilon normalize to `0`.

The existing public `minimumDistanceBetweenOrientedRectangles()` remains available and delegates to the witness function's `distanceMm`, so planning validation and visualization cannot drift into two distance implementations.

The canvas does not calculate closest points from pixels, DOM bounds, Konva shapes or Three.js meshes.

## 6. Planning evidence contract

`PlanningConstraintEvaluation` already produces structured `PairMinimumGapConstraintEvidence`. Promote this structured evidence through `PlanningCandidateEvaluation`:

```ts
exactEvidence: readonly PairMinimumGapConstraintEvidence[]
```

The planning engine remains responsible for:

- `requiredMm`;
- `actualMm`;
- `satisfied`;
- normalized object IDs;
- hard validity.

The UI is responsible only for names, presentation and active-pair interaction.

Exact evidence is no longer duplicated as an untyped string in generic reasons. This prevents inconsistent wording and gives the panel an unambiguous source for exact evidence cards.

## 7. Ephemeral UI state

Extend the existing planning UI store with:

```ts
activeExactPairKey: string | null
setActiveExactPairKey(pairKey: string | null): void
```

State transitions:

```text
open room                 → preview null, active pair null
preview candidate         → preview set, first exact pair active or null
switch exact evidence     → active pair changes only
change planning input     → result/preview/active pair cleared
close planning            → room/preview/active pair cleared
Apply candidate           → ordinary document mutation; planning UI closes
```

This state remains UI-only and is never written to `VlezetDocument`, history, autosave, IndexedDB, project backup or export.

## 8. Web view-model boundary

Add a pure web helper that converts the preview document, candidate and active pair into a renderable annotation:

```ts
type ExactGapAnnotation = Readonly<{
  pairKey: string;
  firstPoint: Point2;
  secondPoint: Point2;
  actualMm: number;
  requiredMm: number;
  satisfied: boolean;
  zeroLength: boolean;
  label: string;
}>;
```

```ts
deriveExactGapAnnotation(
  previewDocument: VlezetDocument,
  candidate: PlanningCandidate | null,
  activePairKey: string | null,
): ExactGapAnnotation | null
```

This helper:

- resolves the normalized active `pair-min-gap` constraint;
- resolves both preview objects;
- invokes the geometry witness primitive;
- returns `null` for missing, unsupported or overlapping invalid state;
- never mutates the document or candidate;
- does not contain Konva or React code.

A small presentational canvas component consumes this view-model and converts world points to screen points.

## 9. Error and stale-state behaviour

- Missing object or malformed pair key: no overlay; planning Apply remains fail-closed.
- Overlapping preview objects: no misleading shortest-segment line; the candidate is already invalid under M2.
- Stale preview below required minimum: danger visual, exact measured copy remains truthful, Apply rejects atomically.
- Very short screen segment: label is offset to avoid covering endpoint markers.
- Label close to canvas edges: clamp the pill inside the visible stage bounds.
- Zoom/pan: annotation recalculates screen coordinates from the same world witness without changing the stored candidate.

## 10. Testing strategy

### Geometry TDD

- axis-aligned separated rectangles return exact distance and witness points;
- rotated rectangles return witness points on the real contours;
- touching returns `0`, relation `touching`, and coincident points;
- overlap returns relation `overlapping` and distance `0`;
- symmetry swaps witness ownership;
- deterministic tie-breaking for parallel equal-distance edges;
- existing numeric distance API remains unchanged.

### Planning TDD

- candidate evaluation exposes exact structured evidence;
- exact hard validation still uses the same geometry result;
- generic reasons do not duplicate structured exact evidence;
- existing ranking order and stable keys are unchanged.

### UI store and view-model TDD

- Preview with one exact pair auto-selects it;
- Preview with multiple pairs selects deterministic first pair;
- switching pairs changes only ephemeral UI state;
- input change, Preview clear and close clear the active pair;
- annotation uses preview transforms, not persisted transforms;
- annotation returns correct required/actual/satisfied values;
- no Preview or no exact rule returns `null`;
- stale below-minimum annotation is marked unsatisfied;
- zero gap produces zero-length annotation semantics;
- source document/candidate remain unchanged.

### Panel and canvas contracts

- pair input copy explicitly says `зазор по контурам`;
- helper says it is not an object dimension or centre distance;
- exact evidence card renders `Фактически`, `Требуется` and contour semantics;
- active button copy changes to `Показывается на плане`;
- generic reasons do not duplicate exact evidence;
- canvas overlay uses the exact-gap visual language and is non-interactive.

## 11. Browser acceptance

Using the same representative M6.3 apartment:

1. Preview a candidate with one exact pair.
2. Confirm a single violet dashed segment connects the visually nearest contour points.
3. Confirm the pill says `↔ Зазор N мм`, not only `N мм`.
4. Rotate one item and confirm the segment endpoints move to the new nearest points.
5. Confirm the right panel separately shows `Фактически`, `Требуется` and contour explanation.
6. Confirm ordinary object width/depth annotations remain visually distinct.
7. Configure three objects with multiple exact pairs and switch `Показать на плане` between them.
8. Confirm only one exact overlay is visible at a time.
9. Change an exact input and confirm result, Preview and overlay clear together.
10. Confirm Preview/overlay create no Undo step, save operation or persisted planning state.
11. Apply a candidate and confirm ordinary one-step Undo/Redo and 2D→3D consistency remain unchanged.
12. Re-check the fixed right inspector layout at the same viewport and browser scale used for the reported regression.

## 12. Non-goals

This refinement does not add:

- persistent measurement annotations;
- arbitrary user-created pair measurements outside planning;
- all-pairs simultaneous overlays;
- editable drag handles on the gap line;
- 3D gap visualization;
- furniture-to-wall exact gaps;
- accessibility-standard automation;
- a generic dimension or constraint notation system;
- any document schema, migration or persistence change.

## 13. Acceptance gate

PR #15 remains Draft and must not merge until:

- geometry witness and UI behaviour pass TDD;
- exact-head frozen install, tests, typecheck, lint and production build pass;
- the reported inspector overflow regression remains fixed;
- representative browser acceptance confirms the exact gap is clearly distinguishable from dimensions;
- canonical milestone docs are updated only after merge and final acceptance.
