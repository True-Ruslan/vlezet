# Vlezet — Roadmap

**Last updated:** 2026-07-22  
**Rule:** roadmap order is intentional. Deterministic product truth and user trust come before visual spectacle or speculative AI layers.

For current truth, read `docs/PROJECT_STATE.md` first.

## Roadmap summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — merged; quality refinement backlog remains
DONE        M4.6 Precision Geometry UX — accepted in browser and merged
DONE        M5.1 Deterministic Spatial 3D Shell + Viewer — accepted and merged
DONE        M5.2 Furniture in 3D — accepted and merged
NOW         M5.4 Spatial Inspection
POLISH      M5.3 camera/navigation refinements only where evidence requires them
AFTER       M6 Intelligent Planning
LATER       public-product infrastructure / optional expansion
```

## Completed trust foundation

### M4.5 — Assisted Recognition

Merge: `b63bdd613db4e13c07d2a961981799bd360f256d`.

Product position:

- recognition accelerates tracing;
- it is not automatic floor-plan reconstruction;
- candidates are editable/reviewable suggestions;
- explicit Apply is required;
- deterministic geometry validation is authoritative;
- existing geometry is never silently replaced;
- accuracy/noise remains a separate evidence-driven backlog.

### M4.6 — Precision Geometry UX

Merge: `a718bf605d8b3bde8dc87953c340b7b0e9565fdb`.

Accepted after strict CI and real browser verification.

Delivered:

- explicit `Длина по оси стены` semantics;
- start/center/end wall-length anchors;
- clear internal width/length editing for deterministic rectangular rooms;
- deterministic usable area display from the same inner geometry;
- canonical `11.715 м² → 11.72 м²` rounding;
- wall thickness direction/fixed-face semantics;
- clear room dimension lines vs technical centreline dimensions;
- `Размеры` visibility toggle;
- ephemeral `Измерить`/`M` tape tool;
- no duplicate persisted dimension authority.

Verified real-browser regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

## Completed M5 foundation

### M5 architecture principle

> 3D is a projection of the same trusted `VlezetDocument`, not a separate editor or geometry source.

Architecture:

```text
VlezetDocument
      ↓
@vlezet/geometry + @vlezet/spatial
      ↓
renderer-neutral SpatialScene
      ↓
plain Three.js viewer
```

### M5.1 — Deterministic Spatial 3D Shell + Viewer

PR #8 → squash merge `4acca82b04c87b3737eb87a03f9ee2ff360b5073`.

**Status:** DONE / ACCEPTED.

Delivered:

- framework-independent `@vlezet/spatial`;
- documented/tested 2D mm → 3D coordinate convention;
- deterministic wall prisms with physical thickness;
- projection-only wall height without schema migration;
- wall segmentation around openings using existing geometry contracts;
- room floors from existing derived usable polygons;
- semantic schematic door/window markers without invented vertical authority;
- fail-closed projection diagnostics;
- plain Three.js viewer;
- orbit/pan/zoom;
- Perspective / Isometric / Top presets;
- fit camera to apartment;
- safe 2D↔3D switching;
- no document/history mutation from view mode;
- WebGL failure isolation;
- explicit renderer/control/geometry/material/GridHelper cleanup.

Acceptance:

- strict CI PASS;
- real browser acceptance PASS on a user apartment project;
- user confirmed: `Все есть`;
- lifecycle review found and fixed a GridHelper resource leak before merge.

### M5.2 — Furniture in 3D

PR #9 → squash merge `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a`.

**Status:** DONE / ACCEPTED.

Architecture contract:

```text
PlacedObject
position x/y
width/depth/height?
rotationDeg
      ↓
@vlezet/spatial
      ↓
SpatialObject
center X/Y/Z
width/depth/height
rotationYRad
heightWasDefaulted
      ↓
Three.js generic primitive
```

Delivered:

- same persistent placed objects as 2D;
- no separate 3D object state;
- position maps to X/Z;
- rotation maps deterministically to Y-axis rotation;
- width/depth remain exact millimetres;
- stored height is used when present;
- missing height uses projection-only `DEFAULT_OBJECT_HEIGHT_MM = 700`, never persisted;
- generic primitive boxes first;
- semantic object ID/name/category remain available for later inspection;
- existing fit/collision/clearance engine remains authoritative;
- mesh collision does not replace deterministic evaluation;
- invalid/non-finite/out-of-domain object geometry fails closed;
- renderer lifecycle disposes object resources;
- 3D remains read-only.

Acceptance:

- exact-head strict CI PASS: `1b955e01a3092e11427258b563871800cf82206a`, run `29940437536`;
- paired real-project 2D/3D screenshots PASS;
- all 3 placed objects appeared in matching room locations;
- no visible M5.1 shell regression.

Canonical checklist: `docs/milestones/m5-2-acceptance.md`.

## M5.3 — Camera/navigation

The architectural foundation originally planned for M5.3 was intentionally delivered inside M5.1 because shell acceptance required real navigation:

- orbit;
- pan;
- zoom;
- top/isometric/perspective presets;
- fit camera;
- reliable 2D↔3D switching.

Therefore M5.3 is **not a blocking standalone milestone**.

Remaining work is evidence-driven polish only:

- camera persistence only if users need it;
- improved preset framing on unusual plans;
- accessibility/input refinements;
- explicit performance budgets from representative projects.

## NOW — M5.4 Spatial Inspection

### Goal

Turn the read-only 3D view from a visual projection into a useful inspection surface while preserving the same trusted document and deterministic engines.

### Recommended scope

- hover/select rooms, walls and placed objects using semantic IDs already carried by spatial primitives;
- expose dimensions already known by `VlezetDocument` / `SpatialScene`;
- show existing object fit status and reasons from the deterministic fit engine;
- provide a compact read-only inspector/panel;
- visually indicate hovered/selected 3D entities without modifying source geometry;
- keep 3D interaction non-semantic unless an explicit future editing milestone is designed;
- no document/history/autosave mutation from hover/select/camera interaction.

### Architecture contract

```text
Three.js hit
      ↓ semantic id / entity kind
inspection state (ephemeral)
      ↓
read trusted document / spatial values / deterministic fit engine
      ↓
read-only inspection UI
```

Must not introduce:

- mesh geometry as measurement authority;
- duplicate 3D object/wall state;
- direct geometry editing;
- implicit persistence;
- decorative asset pipeline;
- M6 planning/AI generation.

### Acceptance

- semantic hover/select works for the intended entity set;
- selected entity maps reliably to the same domain/spatial ID;
- shown dimensions match authoritative source values;
- furniture fit information matches existing deterministic 2D logic;
- 3D inspection does not mutate `VlezetDocument`, history or autosave state;
- 2D↔3D consistency remains intact;
- strict exact-head CI + real browser acceptance.

## AFTER — M6 Intelligent Planning

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

- user goals/constraints;
- deterministic candidate generation/evaluation;
- AI-assisted alternatives;
- compare layouts;
- explain why something fits/does not fit.

## High-value precision follow-ups

These remain useful but should be scheduled by evidence instead of interrupting M5.4 unless a real user blocker appears.

### Recognition quality

- representative fixture corpus;
- measurable quality metrics;
- preprocessing/merging improvements;
- model quality ranking/recommendations.

### Opening precision

- exact offset from selected/reference corner;
- richer door hinge/swing semantics;
- optional authoritative sill/window/door height metadata when product semantics are defined.

### Constraints and target area

Potential future UX:

```text
Actual:     11.38 m²
Target:     11.70 m²
Difference: -0.32 м²
```

Do not introduce a full parametric solver until simple dimension semantics remain stable under real usage.

### Wall classes/presets

Potential later metadata:

- partition/exterior presets;
- common thickness presets;
- richer visual classes.

Never infer structural/removability status without authoritative source data.

## Cross-cutting roadmap

### Browser journeys

Priority journeys:

- create project → draw shell → save/reload;
- import/calibrate/trace;
- clear-dimension edit → area update → Undo/Redo;
- thickness alignment;
- dimension lines/tape;
- backup/import;
- recognition safety/apply/undo;
- 2D↔3D geometry consistency;
- furniture 2D↔3D consistency;
- 3D semantic inspection consistency.

### Observability/privacy

- no API keys/base64 in logs;
- optional subsystems isolated;
- useful product-readable diagnostics;
- local-first core editing remains usable offline.

### Performance

- keep Konva Layer count bounded;
- avoid duplicating large raster state;
- deterministic geometry should remain responsive on realistic apartment plans;
- measure 3D scene/render cost before adding batching/LOD complexity;
- dispose all Three.js-owned GPU resources on teardown.

### Migration discipline

- schema changes only when persistent semantics actually require them;
- migrations deterministic;
- derived/UI/spatial state is not persisted merely for convenience.

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

1. Finish the current acceptance gate before starting the next major slice.
2. Prefer real-user evidence over impressive demos.
3. Deterministic correctness beats AI/3D spectacle.
4. Fix root causes, not screenshots/symptoms.
5. Optional subsystems stay isolated.
6. Local-first editing remains a core product property.
7. Add complexity only when the previous simpler model has been validated.
8. No second geometry authority in 3D.