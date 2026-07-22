# Vlezet — Roadmap

**Last updated:** 2026-07-22  
**Rule:** roadmap order is intentional. Resolve product-trust and geometry-semantics problems before visually impressive later layers.

For current truth, read `docs/PROJECT_STATE.md` first.

## Roadmap summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — merged; quality refinement backlog remains
NOW/RC      M4.6 Precision Geometry UX — P0 implementation complete in Draft PR #7; browser acceptance pending
THEN        M5 Spatial 3D
AFTER       M6 Intelligent Planning
LATER       public-product infrastructure / optional expansion
```

## M4.5 — Assisted Recognition

**Status:** merged to `main` as an accepted assisted/experimental MVP.

Merge:

```text
b63bdd613db4e13c07d2a961981799bd360f256d
```

Product position:

- recognition accelerates tracing;
- it is not automatic floor-plan reconstruction;
- candidates are reviewable/editable suggestions;
- explicit Apply is required;
- deterministic geometry validation is authoritative;
- existing geometry is never silently replaced;
- accuracy/noise remains a separate evidence-driven backlog.

Do not reopen M4.5 as an endless threshold-tuning cycle while more fundamental product-trust work is pending.

## P0 — M4.6 Precision Geometry UX

**Status:** implementation RC in Draft PR #7.

Primary problem discovered through real user testing:

```text
user enters:      3550 × 3300 mm
user means:       clear room dimensions
old editor means: wall centreline dimensions
result:           technically consistent but surprising smaller usable area
```

The product must make all of these explicit:

```text
clear internal dimension
wall centreline dimension
wall physical thickness / reference face
usable area derived from inner faces
```

Persistent model remains:

```text
vertices + wall centrelines + thickness
              ↓
deterministic derived inner geometry
              ↓
rooms / areas / dimensions / annotations
```

No duplicate persistent `internalLength` / `externalLength` fields.

### M4.6.1 — Honest wall length semantics and anchors — IMPLEMENTED

- `Длина по оси стены` replaces ambiguous `Точная длина`;
- explicit explanation of centreline semantics;
- `Начало / Центр / Конец` fixed anchor;
- opening world-position preservation when wall start moves;
- junction/opening/host constraints fail atomically;
- one semantic edit = one Undo/Redo operation.

### M4.6.2 — Clear internal room dimensions — IMPLEMENTED FIRST CONSERVATIVE SLICE

Supported editable case: simple deterministic axis-aligned rectangular rooms.

- clear width/height derived from usable inner polygon;
- room inspector `Чистые внутренние размеры`;
- editable width and length;
- fixed side / centre anchors;
- edits canonical wall geometry;
- area and dimensions come from the same inner geometry;
- unsupported topology fails closed.

Regression:

```text
centreline:     3650 × 3400 mm
walls:          100 mm
clear internal: 3550 × 3300 mm
area:           11.715 m²
UI:             11.72 m²
```

### M4.6.3 — Wall thickness alignment — IMPLEMENTED

Core geometry:

```text
center | left-face | right-face
```

User-facing intent when exactly one adjacent room is unambiguous:

```text
Внутрь помещения | По центру | Наружу
```

Ambiguous/no-single-room-side wall:

```text
Левая грань | По центру | Правая грань
```

Requirements implemented:

- selected physical face remains deterministic;
- centreline shifts by half thickness delta where required;
- compatible connected topology moves atomically;
- affected opening offsets preserve world position;
- incompatible geometry rejects rather than distorts;
- no structural/removability meaning is inferred.

### M4.6.4 — Dimension lines — IMPLEMENTED

- room canvas label includes clear internal `Ш × Д мм внутри` for deterministic rectangles;
- selected room shows clear inner-face dimension lines;
- selected wall shows distinct `... мм по оси` dimension;
- labels/lines are derived projections only;
- stable screen-space annotation offset across zoom;
- toolbar show/hide `Размеры` toggle;
- no additional persisted dimension entities;
- no extra physical Konva Layer.

This slice was deliberately pulled ahead of thickness UX after real feedback showed that discoverability of dimension meaning was the immediate trust blocker.

### M4.6.5 — Tape / measurement tool — IMPLEMENTED FIRST SLICE

Two-point ephemeral measurement:

- direct distance;
- horizontal `ΔX`;
- vertical `ΔY`;
- snapping to vertices/walls/grid;
- first click/start, preview, second click/finish;
- next click starts a new measure;
- Escape clears;
- switching tool clears/deactivates;
- no persistence/history/autosave/backup.

Typical uses:

- corner → door;
- pier width;
- balcony opening offset;
- furniture clearance;
- arbitrary verification.

## M4.6 merge gate — NOW

Do not merge on CI alone.

Browser/manual acceptance on a real apartment workflow must verify:

1. centreline input is visibly distinguished from clear room size;
2. clear room `3550 × 3300` produces ≈ `11.72 m²`;
3. room clear-size anchors behave predictably;
4. selected wall dimension says `по оси`;
5. dimension-line visibility toggle works;
6. thickness `inside/centre/outside` behavior matches visible physical faces/area expectations;
7. ambiguous walls never guess inside/outside;
8. Undo/Redo is one semantic step per dimension/thickness edit;
9. tape measurement direct/ΔX/ΔY/snapping/Escape works;
10. zoom/pan does not alter measured values;
11. M0–M4.5 workflows remain usable;
12. exact final PR head passes frozen install/tests/typecheck/lint/build.

If accepted:

```text
mark PR #7 Ready for Review
→ verify exact head CI
→ squash merge M4.6 to main
→ update state/changelog with final merge SHA
→ begin fresh M5 design
```

If a browser test reveals a problem, fix the underlying geometry/mental-model cause. Do not hide it with copy or special-case display arithmetic.

## High-value precision follow-ups after M4.6 P0

These are useful but should not block the first trusted M4.6 merge unless real acceptance demonstrates they are necessary.

### Opening precision

- width;
- offset from selected/reference corner;
- door swing/hinge semantics;
- optional sill/window height metadata.

### Target room area

```text
Actual:     11.38 m²
Target:     11.70 m²
Difference: -0.32 m²
```

Potential later assistance may explain how far a boundary needs to move, but must remain deterministic and explicit.

### Locked constraints

Examples:

```text
🔒 clear width = 3300 mm
🎯 target area = 11.70 m²
```

Do not introduce a full parametric solver until simple dimension semantics are proven stable.

### Wall presets/classes

Possible later metadata/UX:

- partition/exterior presets;
- common thickness presets;
- richer visual classes.

Never infer structural/removability status without authoritative data.

## M5 — Spatial 3D

**Status:** planned; do not start until M4.6 is accepted/merged.

Principle:

> 3D is a projection of the same `VlezetDocument`, not a separate editor or geometry source.

### M5.1 — Deterministic 3D shell

- floor from derived plan bounds/rooms;
- wall extrusion with physical thickness;
- wall height metadata/default;
- openings represented in 3D;
- deterministic millimetre→3D mapping;
- no photorealism requirement.

### M5.2 — Furniture in 3D

- same placed objects;
- same dimensions/rotation;
- generic geometry first;
- no separate placement state.

### M5.3 — Camera/navigation

- orbit/pan/zoom;
- useful top/isometric/room presets;
- switch 2D↔3D without state loss;
- fit camera to apartment.

### M5.4 — Spatial inspection

- inspect rooms/walls/objects;
- surface dimensions/fit status from existing deterministic data;
- no silent document mutation from 3D.

### M5 non-goals

- photorealistic rendering;
- ray tracing;
- materials marketplace;
- generative interior images as authority;
- separate 3D editing model;
- VR;
- BIM.

### M5 acceptance

- 2D and 3D show the same structured model;
- no unexpected mutation when switching views;
- save/reload deterministic;
- 3D cannot corrupt `VlezetDocument`.

## M6 — Intelligent Planning

**Status:** planned after M5.

Architecture:

```text
constraints + VlezetDocument
        ↓
planning engine / optional AI
        ↓
structured candidate layout
        ↓
deterministic fit/collision/clearance evaluation
        ↓
editable alternatives
```

AI-generated images are never geometry authority.

Potential scope:

- user constraints/goals;
- deterministic candidate generation/evaluation;
- AI-assisted alternatives;
- compare layouts;
- explain why something fits/does not fit.

## Cross-cutting roadmap

### Browser journeys

Add/maintain high-value automated browser tests where practical, but never confuse them with final human visual acceptance.

Priority journeys:

- create project → draw shell → save/reload;
- import/calibrate/trace;
- clear-dimension edit → area update → Undo/Redo;
- thickness alignment;
- dimension lines/tape;
- backup/import;
- recognition safety/apply/undo.

### Observability/privacy

- no API keys/base64 in logs;
- optional subsystems isolated;
- useful product-readable diagnostics;
- local-first core editing remains usable offline.

### Performance

- keep Canvas Layer count bounded;
- avoid duplicating large raster state;
- deterministic geometry work should remain responsive on realistic apartment plans.

### Migration discipline

- schema changes only when persistent semantics actually require them;
- migrations deterministic;
- derived/UI state is not persisted merely for convenience.

## Deferred / optional future

- accounts/auth;
- cloud sync/sharing/collaboration;
- managed AI/backend billing;
- mobile-first editor;
- multi-floor;
- curved walls;
- perspective-photo reconstruction;
- authoritative OCR;
- DWG/DXF/BIM;
- renovation estimates;
- photorealism/VR.

## Decision rules

1. Finish current acceptance gate before starting the next major milestone.
2. Prefer real-user evidence over impressive demos.
3. Deterministic correctness beats AI/3D spectacle.
4. Fix root causes, not screenshots/symptoms.
5. Optional subsystems must stay isolated.
6. Local-first editing remains a core product property.
7. Add complexity only when the previous simpler model has been validated.
8. Start each major milestone with fresh design/brainstorming rather than carrying hidden assumptions forward.
