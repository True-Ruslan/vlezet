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
DONE        M5.4 Spatial Inspection — accepted and merged
POLISH      M5.3 camera/navigation/performance refinements only where evidence requires them
NOW         M6 Intelligent Planning
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

## Completed M5 spatial foundation

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

Delivered framework-independent spatial projection, deterministic wall prisms/thickness, opening-aware wall segmentation, usable room floors, schematic semantic opening markers, fail-closed diagnostics, plain Three.js viewer, orbit/pan/zoom, camera presets, fit camera, reliable 2D↔3D switching, WebGL isolation and explicit GPU-resource cleanup.

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
- deterministic position/rotation mapping;
- exact width/depth millimetres;
- stored height when present;
- projection-only `DEFAULT_OBJECT_HEIGHT_MM = 700` when height is absent;
- generic primitive boxes first;
- semantic object metadata preserved;
- existing fit/collision/clearance engine remains authoritative;
- invalid object geometry fails closed;
- renderer lifecycle disposes object resources;
- 3D remains read-only.

Acceptance:

- exact-head strict CI PASS: `1b955e01a3092e11427258b563871800cf82206a`, run `29940437536`;
- paired real-project 2D/3D screenshots PASS;
- all 3 placed objects appeared in matching room locations;
- no visible M5.1 shell regression.

Canonical checklist: `docs/milestones/m5-2-acceptance.md`.

### M5.4 — Spatial Inspection

PR #10 → squash merge `0bffe36d74d2ff0865d700b51b17ee08e7001094`.

**Status:** DONE / ACCEPTED.

Architecture contract:

```text
Three.js ray hit
      ↓ semantic id / entity kind
inspection state (ephemeral)
      ↓
read trusted VlezetDocument / SpatialScene / deterministic geometry+fit
      ↓
read-only inspection UI
```

Delivered:

- hover/select rooms, walls and placed objects using stable semantic IDs;
- nearest inspectable hit resolution that skips schematic opening placeholders;
- read-only inspector for authoritative dimensions/area/fit information;
- canonical M4.6 area rounding reused in 3D;
- semantic visual emphasis without geometry mutation;
- all split segments of one logical wall highlight together;
- deterministic fit statuses/reasons reused from M2;
- temporary highlight material lifecycle and disposal;
- stale/unknown IDs fail closed;
- no document/history/autosave mutation from inspection.

Acceptance:

- final exact PR head `e9980f63d574d1a9cb6614980788270a50cde47e`;
- GitHub Actions `29948749864` — PASS;
- real-browser acceptance PASS on the representative apartment;
- product owner confirmed: `Все работает круто как ты и описал.`

Canonical checklist: `docs/milestones/m5-4-acceptance.md`.

## M5.3 — Camera/navigation/performance polish

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
- improved framing on unusual plans;
- accessibility/input refinements;
- explicit performance budgets from representative projects;
- batching/LOD only after measurement proves a need.

## NOW — M6 Intelligent Planning

### Product goal

Turn Vlezet from a precise manual planner into an assistant that can propose, compare and explain valid furniture/layout alternatives while keeping deterministic geometry and fit rules authoritative.

The first M6 slice must stay deliberately narrow and explainable.

### Architecture direction

```text
user goals / constraints + VlezetDocument
        ↓
framework-independent planning engine
        ↓
structured candidate layout(s)
        ↓
deterministic M2 fit/collision/clearance evaluation
        ↓
ranked + explainable alternatives
        ↓
explicit review/apply into ordinary VlezetDocument entities
```

Optional AI may help generate or interpret structured constraints later, but it must never replace deterministic validation.

AI-generated images and Three.js meshes are never geometry authority.

### Recommended M6.1 scope

Start with one narrow user journey rather than a generic "AI designer".

Recommended first scenario:

> Given one room, existing walls/openings and a selected set of furniture objects, generate a small number of valid alternative placements that satisfy hard geometric constraints and explain why each candidate is good or rejected.

First-slice capabilities:

1. framework-independent planning contracts for constraints, candidates and evaluation;
2. deterministic candidate generation for a limited object/room case;
3. reuse existing object dimensions, room containment, collisions, door swing and clearances;
4. explicit hard-vs-soft constraints;
5. deterministic scoring/ranking with human-readable reasons;
6. preview alternatives without mutating the document;
7. explicit Apply as a semantic, undoable document operation;
8. no LLM required for the deterministic core.

### Acceptance for first planning slice

- same input produces deterministic candidates/evaluation;
- no invalid candidate bypasses M2 fit/collision/clearance rules;
- candidate data is structured, not image-only;
- preview does not mutate `VlezetDocument`;
- Apply is explicit and undoable;
- reasons explain important fit/rejection decisions;
- no second furniture/geometry authority;
- strict exact-head CI and representative browser acceptance.

### Explicit non-goals for the first slice

Do not begin M6 with:

- photorealistic generation;
- free-form AI geometry;
- direct 3D editing;
- a second layout state persisted independently of `VlezetDocument`;
- broad "design my whole apartment" orchestration;
- cloud/LLM dependency for core planning correctness.

## High-value follow-ups — evidence-driven backlog

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
- 3D semantic inspection consistency;
- planning candidate preview → compare → explicit apply → Undo.

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
- derived/UI/spatial/planning-preview state is not persisted merely for convenience.

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
9. Planning candidates are proposals until explicitly applied.
10. AI assistance never bypasses deterministic geometry/fit validation.
