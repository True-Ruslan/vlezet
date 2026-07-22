# Vlezet — Geometry & Dimensions UX Feedback

**Date:** 2026-07-22  
**Status:** Accepted product feedback; implementation design not started  
**Priority:** P0 before M5 Spatial 3D

## 1. Why this feedback matters

The current editor is visually simple and already behaves like a real planning tool, but a non-CAD user can misunderstand the most important geometric input: **what exactly does a wall length mean?**

Real observed case:

- entered wall lengths: `3550 mm` and `3300 mm`;
- wall thickness: `50 mm`;
- intuitive user expectation: `3.55 × 3.30 ≈ 11.72 m²`;
- Vlezet showed approximately `11.38 m²`.

The computation is not necessarily wrong: current exact wall length is based on the **wall centreline**, while room area is derived from the **inner wall faces**.

The UX problem is that the editor does not explain this distinction. A normal user therefore concludes that area calculation is wrong.

This is considered a fundamental trust problem, not cosmetic polish.

## 2. Core product principle discovered by this feedback

For a homeowner/buyer, the primary mental model is usually:

> “I know the clean internal room dimension. I want the room inside to be exactly 3550 mm.”

The editor must not require the user to think like a CAD/BIM professional unless they explicitly choose to.

The system should distinguish at least:

1. **internal / clear room dimension**;
2. **wall centreline length**;
3. **external face dimension**.

The UI must make the active dimension semantics explicit.

## 3. P0 — required before major new product layers

### P0.1 Dimension semantics

Wall editing must clearly communicate what dimension is being displayed and edited.

Preferred product direction to evaluate during design:

```text
Dimension mode
● Internal clear dimension
○ Wall centreline
○ External face
```

For ordinary users, **Internal clear dimension** is the preferred default candidate.

The inspector should avoid ambiguous wording such as simply `Точная длина`.

Possible explicit labels:

- `Чистый размер помещения`;
- `Длина по оси стены`;
- `Размер по внешней грани`.

An info affordance should explain how wall thickness affects room area.

### P0.2 Show related dimensions together

When useful, the selected wall/room should expose the relationship between:

- internal clear dimension;
- centreline dimension;
- external dimension;
- wall thickness.

Conceptual example:

```text
Inside room:     3550 mm
Wall centreline: 3650 mm
External faces:  3750 mm
```

The exact formulas depend on wall topology/alignment and must be deterministic rather than based on visual approximation.

### P0.3 Anchor when changing wall length

Changing wall length is currently potentially surprising because the user may not know which endpoint moves.

Required UX concept:

```text
Fixed while resizing
● Start / left endpoint
○ Centre
○ End / right endpoint
```

The visual editor should make the chosen anchor obvious.

This is especially important when restoring a real apartment from measured dimensions.

### P0.4 Wall thickness alignment

Changing thickness must explicitly define where the additional thickness goes.

Required semantic concept:

```text
Wall thickness alignment
Inside | Centre | Outside
```

The editor should visually indicate the relevant side/orientation.

This affects room area and therefore cannot remain an implicit implementation detail.

### P0.5 Dimension lines on canvas

The editor should be able to display measurement annotations directly on the plan.

Minimum desired behaviour:

- selected wall dimension;
- room internal dimensions where deterministically derivable;
- global show/hide dimensions toggle;
- dimensions rendered as derived annotations, never persisted as geometry authority.

Example:

```text
      ←──── 3550 mm ────→
┌────────────────────────┐
│                        │
│        11.70 m²        │ 3300 mm
│                        │
└────────────────────────┘
```

### P0.6 Measurement / tape tool

A dedicated `Измерить` tool is considered essential for practical apartment planning.

User selects two points and sees:

- direct distance;
- horizontal delta;
- vertical delta.

Typical use cases:

- corner → door distance;
- wall pier width;
- balcony opening offsets;
- bed/furniture clearance;
- arbitrary verification without modifying geometry.

Measurement results should be derived/ephemeral unless the product later intentionally introduces persistent annotations.

## 4. P1 — high-value precision features after the P0 semantics are correct

### P1.1 Door/window offsets from corners

For doors:

- opening width;
- offset from nearest/reference corner;
- swing direction;
- inward/outward;
- left/right hinge semantics.

For windows:

- opening width;
- offset from corner;
- optional sill height;
- optional window height.

The key requirement is deterministic positioning from a known endpoint, not approximate visual placement.

### P1.2 Target room area

Room inspector could support:

```text
Actual area: 11.38 m²
Target area:  11.70 m²
Difference:  -0.32 m²
```

Future assisted behaviour may calculate how much a selected dimension would need to change to approach the target area.

This must remain deterministic and explain assumptions.

### P1.3 Locked constraints

Potential future constraint UX:

- lock a wall/internal dimension;
- optionally lock a target room area;
- adjust another degree of freedom while preserving locked constraints.

Example:

```text
Locked width: 3.30 m
Target area: 11.70 m²
Suggested other dimension ≈ 3.545 m
```

This is powerful but should not be implemented before basic dimension semantics are unambiguous.

### P1.4 Wall type presets

Potential convenience presets:

- partition ~100 mm;
- reinforced partition ~120 mm;
- structural/monolithic ~200 mm;
- exterior ~400 mm;
- custom.

Any values shown must be clearly described as approximate defaults, not authoritative construction data.

### P1.5 Visual wall classes

Potential later wall semantics:

- partition;
- structural wall;
- exterior wall;
- column / shaft.

Visual distinction can use physical thickness, hatching or other non-destructive styling.

The UI must not imply that a wall is removable unless that fact is actually known.

## 5. Existing strengths explicitly validated by the feedback

The following current product decisions were positively validated and should be preserved:

- clean non-CAD interface;
- selected geometry highlighted clearly;
- focused inspector rather than many panels;
- exact millimetre input;
- explicit `Применить длину` commit action;
- real connected wall topology / shared vertices;
- immediate room-area feedback on canvas;
- undo/redo model;
- imported JPG/PDF reference workflow with metric calibration.

The goal is **not** to make Vlezet look like AutoCAD/Revit. The goal is to make the underlying precision understandable to normal users.

## 6. Known M4.5 recognition quality issue

The latest real-plan test still shows assisted recognition producing noisy/inaccurate geometry candidates.

Observed behaviour:

- local/cloud recognition can find some structural elements;
- candidate topology and positions remain noticeably inaccurate;
- cloud models vary significantly in quality;
- semantic filters prevent some gross hallucinations, but recognition is not yet reliable enough to reconstruct an apartment automatically.

Decision:

- record this as a **known bug / quality limitation**;
- keep recognition suggestions explicitly reviewable and non-authoritative;
- do not weaken deterministic validation to make the result look better;
- do not let recognition-quality tuning consume the next major product cycle;
- improve it later using a representative fixture set and measurable recognition-quality benchmarks.

M4.5 should be treated as **assisted/experimental recognition**, not automatic floor-plan reconstruction.

## 7. Recommended roadmap consequence

The previous roadmap moved directly from M4.5 to M5 3D.

This feedback changes the product priority.

Recommended order:

```text
M4.5 Assisted Recognition — stabilize and merge with known accuracy limitation
        ↓
M4.6 Precision Geometry UX — dimension semantics and measurement workflow
        ↓
M5 Spatial 3D
        ↓
M6 Intelligent Planning
```

Reason:

3D would visualize the same geometry more impressively, but it would not solve the more fundamental trust problem: the user must first understand exactly what `3550 mm`, wall thickness and `11.38 m²` mean.

## 8. Proposed M4.6 scope boundary

The next design cycle should focus first on:

1. internal vs centreline vs external dimension semantics;
2. wall-length anchor behaviour;
3. wall-thickness alignment semantics;
4. canvas dimension lines;
5. tape/measurement tool.

Target area, locked constraints, advanced wall classes and richer opening metadata should be designed as follow-up verticals only after the P0 interaction model is stable.

No implementation should start until the M4.6 UX/geometry semantics are explicitly designed and approved.
