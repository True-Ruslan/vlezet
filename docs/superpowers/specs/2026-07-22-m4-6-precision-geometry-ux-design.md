# M4.6 Precision Geometry UX — Design

**Date:** 2026-07-22  
**Status:** Approved by product direction / implementation starting  
**Branch:** `feat/m4-6-precision-geometry-ux`

## 1. Problem

Vlezet currently stores walls as topological centreline segments with physical thickness, while room area is derived from inner wall faces.

A normal user can enter `3550 × 3300 mm`, see approximately `11.38 m²`, and reasonably conclude that area calculation is wrong because the UI does not explain that the entered wall length is a centreline length rather than a clear internal room dimension.

This is a product-trust problem, not cosmetic polish.

M4.6 must make geometry semantics understandable and predictable for users who do not know CAD/BIM conventions.

## 2. Product goal

A user must be able to answer, directly from the UI:

- what exactly a displayed dimension measures;
- what stays fixed when a dimension changes;
- which geometry moves;
- where added wall thickness grows;
- how wall geometry relates to room clear dimensions and area;
- how to verify arbitrary distances without modifying geometry.

Primary acceptance principle:

> A normal user can recreate a rectangular room from known clear internal dimensions and predict its resulting area without understanding wall centreline mathematics.

## 3. Architectural decision

### Keep `VlezetDocument` authoritative and unchanged

The persistent model remains:

```text
vertices + topological wall centrelines + physical thickness
→ deterministic derived faces / rooms / measurements
→ UI projections and edit intents
```

M4.6 does **not** persist duplicate `internalLength`, `externalLength`, dimension annotations or room width/height fields.

Reasons:

- avoids contradictory sources of truth;
- no schema migration is required for the first M4.6 slices;
- existing M0–M4.5 projects remain valid;
- 2D, future 3D and planning continue to consume the same geometry;
- derived values always recompute after topology/thickness changes.

### Measurement semantics are explicit edit intents

The editor may expose semantic modes such as:

- centreline dimension;
- clear internal room dimension;
- external-face dimension;
- fixed anchor `start / centre / end`;
- thickness alignment `inside / centre / outside`.

These are instructions for transforming the canonical geometry, not independent persisted geometry.

## 4. Alternatives considered

### A. Persist dimension modes and explicit internal/external lengths on every wall

Rejected for the core model.

Pros:
- user intent could persist per wall.

Cons:
- creates redundant geometry facts;
- requires schema migration and synchronization rules;
- ambiguous for partitions bordering two rooms;
- risks conflicts between stored lengths, vertices, thickness and room area.

### B. Keep centreline model and add derived measurements + semantic edit operations

**Chosen.**

Pros:
- preserves current architecture;
- deterministic;
- backwards compatible;
- ambiguity can be surfaced rather than hidden;
- supports future 3D without another geometry source.

### C. Introduce a full parametric CAD constraint solver now

Rejected as premature.

It would solve more cases, but dramatically expands scope and complexity before the basic user mental model is validated.

## 5. Delivery slices

### M4.6.1 — Honest wall length semantics and anchors

Current ambiguous `Точная длина` becomes explicitly `Длина по оси стены`.

Add fixed-anchor editing:

```text
Что остаётся на месте
● Начало
○ Центр
○ Конец
```

Semantics:

- `start`: start vertex fixed, end moves;
- `end`: end vertex fixed, start moves;
- `centre`: both endpoints move equally in opposite directions;
- wall direction remains unchanged;
- connected topology remains connected because shared vertices move semantically;
- internal T-junctions must remain on the resized wall;
- openings on the resized wall preserve their world position when the start vertex moves by compensating their stored offset;
- a resize is rejected if a junction/opening would fall outside the resulting wall or if a moved endpoint violates a host-wall junction constraint.

This slice removes hidden behaviour before introducing higher-level clear dimensions.

### M4.6.2 — Clear internal room dimensions

Add framework-independent derived room-dimension utilities.

First supported editable case: deterministic orthogonal rectangular rooms.

For a rectangular room:

- derive clear width and height directly from the usable inner polygon;
- show them as `Чистый внутренний размер`;
- area must equal the same clear polygon dimensions for a rectangle;
- editing a clear dimension moves the corresponding complete boundary line/wall while preserving orthogonality and connectivity;
- the user chooses which side stays fixed or uses centre anchoring.

Complex/ambiguous rooms:

- derived dimensions may be shown only when deterministic;
- editing is disabled with an explicit explanation rather than guessed.

This is the primary path for users reconstructing rooms from developer/measurement dimensions.

### M4.6.3 — Wall thickness alignment

Thickness edits gain an explicit alignment intent:

```text
Внутрь | По центру | Наружу
```

The persistent wall still stores centreline + thickness.

The edit operation shifts the centreline when required so that the selected reference face stays fixed:

- centre: centreline stays fixed;
- inside/outside: one physical face stays fixed and the centreline moves by half the thickness delta.

For walls with ambiguous room-side meaning, the UI must require/derive a side explicitly and never guess structural meaning.

### M4.6.4 — Dimension lines

Derived annotations on Canvas:

- selected wall centreline dimension;
- rectangular-room clear dimensions;
- optional show/hide dimensions toggle;
- labels rendered from geometry every frame/state update;
- no dimension annotation becomes geometry authority.

### M4.6.5 — Tape / measurement tool

Two-point ephemeral measurement:

- direct distance;
- horizontal delta;
- vertical delta;
- snapping to useful geometry points where existing snapping contracts allow it;
- Escape clears measurement;
- no persistence in first slice.

Typical uses:

- corner → door;
- pier width;
- balcony opening offset;
- furniture clearance;
- arbitrary verification.

## 6. Detailed M4.6.1 geometry contract

Introduce:

```ts
type WallLengthAnchor = "start" | "center" | "end";
```

Extend wall-length editing to accept an anchor.

Given original unit direction `u`, current length `L`, requested length `L2`, delta `d = L2 - L`:

```text
start anchor:
  start' = start
  end'   = end + u*d

end anchor:
  start' = start - u*d
  end'   = end

center anchor:
  start' = start - u*d/2
  end'   = end + u*d/2
```

### Opening invariants

Opening offsets are measured from wall start.

When start moves by signed distance `s` along the wall direction, preserve the opening world segment by applying:

```text
offset' = offset - s
```

Then validate:

```text
0 <= offset'
offset' + width <= new wall length
```

No opening may silently move because the user changed which endpoint is anchored.

### Junction invariants

All internal junction vertices referenced by `wall.junctionVertexIds` remain at their current world positions and must still lie strictly inside the resized wall.

Moved start/end vertices must continue satisfying any host-wall constraints in which those vertices act as junctions.

If not, reject the edit with a product-readable error.

## 7. UI contract for M4.6.1

Wall inspector:

```text
Стена

Длина по оси стены
[ 3550 ] мм

Что остаётся на месте
[ Начало | Центр | Конец ]

[ Применить длину ]
```

Supporting copy must explicitly state:

> Длина по оси — расстояние между узлами стены. Это не всегда равно чистому внутреннему размеру комнаты.

The inspector should never call centreline length merely `Точная длина` or `Длина` without qualification.

## 8. Error handling

Geometry edits fail closed.

Examples:

- shortening past an internal T-junction;
- shortening through an opening;
- moving an endpoint off a host wall;
- requesting non-positive/non-finite dimensions;
- ambiguous clear-room editing outside supported geometry.

Errors are shown in the inspector and do not partially mutate the document.

Each successful semantic edit is exactly one Undo/Redo history operation.

## 9. Testing strategy

### Framework-independent unit tests

M4.6.1:

- start anchor preserves start and moves end;
- end anchor preserves end and moves start;
- centre anchor preserves midpoint;
- wall direction is preserved;
- openings preserve world positions when start moves;
- shortening rejects consumed openings;
- internal junctions remain valid or reject;
- host-wall endpoint constraints remain enforced;
- default anchor keeps legacy start-fixed behaviour.

M4.6.2+:

- rectangular clear dimensions match usable polygon;
- `3550 × 3300` clear room produces approximately `11.715 m²` before display rounding;
- different wall thicknesses are handled deterministically;
- unsupported/ambiguous topology returns an explicit unavailable result;
- room dimension edits preserve rectangular/orthogonal invariants.

### Web/UI tests

- wall inspector uses explicit centreline wording;
- anchor selection is passed to the edit operation;
- errors remain visible and document is unchanged;
- future room dimension/tape controls have keyboard-accessible interactions.

### Regression

Full existing tests, typecheck, lint and production build remain mandatory.

## 10. Non-goals

Not in the initial M4.6 implementation:

- full parametric constraint solver;
- arbitrary polygon constraint solving;
- BIM semantics;
- structural/removability conclusions;
- persistent drafting annotations;
- 3D;
- automatic inference of authoritative construction dimensions from images.

## 11. Roadmap after M4.6

```text
M4.6 Precision Geometry UX
→ M5 Spatial 3D on the same trusted geometry
→ M6 Intelligent Planning using deterministic constraints
```

Recognition-quality refinement remains a separate evidence-driven backlog and must not derail the precision UX milestone.
