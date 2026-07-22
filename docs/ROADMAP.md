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
DONE        M4.6 Precision Geometry UX — accepted in browser and merged
NOW         M5 Spatial 3D — fresh design/brainstorming first
AFTER       M6 Intelligent Planning
LATER       public-product infrastructure / optional expansion
```

## Completed trust foundation

### M4.5 — Assisted Recognition

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

Future recognition work should use representative real-plan fixtures and measurable metrics. Do not weaken validators merely to increase apparent recall.

### M4.6 — Precision Geometry UX

Merge:

```text
a718bf605d8b3bde8dc87953c340b7b0e9565fdb
```

Accepted after strict CI and real browser verification.

Solved the ordinary-user trust problem where wall centreline lengths looked like room dimensions.

Delivered:

- explicit `Длина по оси стены` semantics;
- start/center/end wall-length anchors;
- clear internal width/length editing for deterministic rectangular rooms;
- deterministic area display from the same inner geometry;
- canonical `11.715 м² → 11.72 м²` decimal rounding;
- wall thickness direction/fixed-face semantics;
- clear room dimension lines vs technical centreline wall dimensions;
- `Размеры` visibility toggle;
- ephemeral `Измерить`/`M` tape tool with direct distance + `ΔX` + `ΔY`;
- no duplicate persisted dimension authority;
- no new physical Konva Layer for the new annotation/measurement UX.

Verified real-browser acceptance included the regression case:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

## NOW — M5 Spatial 3D

**Status:** ready for fresh design/brainstorming. Implementation has not started yet.

Principle:

> 3D is a projection of the same trusted `VlezetDocument`, not a separate editor or geometry source.

### M5 design questions to resolve before coding

1. Exact 2D-mm → 3D coordinate convention and orientation.
2. Default wall height and where height metadata belongs.
3. How doors/windows cut wall meshes while preserving semantic opening identity.
4. How derived rooms/floors become deterministic floor geometry.
5. Furniture representation strategy: generic primitive geometry first vs optional richer assets.
6. Camera/navigation model and 2D↔3D switching behavior.
7. What editing is allowed in 3D, if any, without creating a second interaction model.
8. Browser performance budgets for realistic apartments.
9. Test strategy for deterministic mesh generation independent of Three.js rendering.

### M5.1 — Deterministic 3D shell

Planned:

- floor from existing derived rooms/plan bounds;
- wall extrusion with physical thickness;
- deterministic wall height/default metadata;
- doors/windows represented as true openings or safe deterministic wall segmentation;
- millimetre→3D mapping documented and tested;
- 3D generated from current `VlezetDocument` only.

Acceptance:

- 2D and 3D represent the same geometry;
- no unexplained wall/room dimensional drift;
- switching to 3D does not mutate document state;
- save/reload remains deterministic.

### M5.2 — Furniture in 3D

Planned:

- same placed objects;
- same width/depth/height/rotation;
- generic primitive geometry first;
- no parallel placement state;
- selected/fit status can be surfaced from existing deterministic data.

### M5.3 — Camera/navigation

Planned:

- orbit;
- pan;
- zoom;
- top/isometric/useful presets;
- fit camera to apartment;
- reliable 2D↔3D switching without state loss.

### M5.4 — Spatial inspection

Planned:

- inspect rooms/walls/objects;
- expose dimensions and fit state already known by the 2D/domain model;
- no silent document mutation from 3D interactions.

### M5 non-goals

Do not add in the first 3D milestone:

- photorealism;
- ray tracing;
- materials marketplace;
- generative interior images as geometry authority;
- separate 3D editing model;
- VR;
- BIM;
- speculative rendering architecture before deterministic shell quality is proven.

### M5 required workflow

```text
fresh brainstorming/design
→ approved M5 spec
→ implementation plan
→ TDD on framework-independent 3D projection/mesh semantics where possible
→ Draft PR
→ strict CI
→ browser visual/interaction acceptance
→ Ready for Review
→ exact-head verification
→ squash merge
```

## AFTER — M6 Intelligent Planning

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

- user goals/constraints;
- deterministic candidate generation/evaluation;
- AI-assisted alternatives;
- compare layouts;
- explain why something fits/does not fit.

## High-value precision follow-ups

These remain useful but should be scheduled by evidence rather than interrupting M5 unless real user testing reveals a blocker.

### Recognition quality

- representative fixture corpus;
- precision/recall-style metrics;
- preprocessing/merging improvements;
- model quality ranking/recommendations.

### Opening precision

- exact offset from selected/reference corner;
- richer door hinge/swing semantics;
- optional sill/window height metadata.

### Constraints and target area

Potential future UX:

```text
Actual:     11.38 m²
Target:     11.70 m²
Difference: -0.32 m²
```

Possible locks:

```text
🔒 clear width = 3300 mm
🎯 target area = 11.70 m²
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

Maintain/add high-value automated browser tests where practical, but never confuse them with final human visual acceptance.

Priority journeys:

- create project → draw shell → save/reload;
- import/calibrate/trace;
- clear-dimension edit → area update → Undo/Redo;
- thickness alignment;
- dimension lines/tape;
- backup/import;
- recognition safety/apply/undo;
- future 2D↔3D consistency.

### Observability/privacy

- no API keys/base64 in logs;
- optional subsystems isolated;
- useful product-readable diagnostics;
- local-first core editing remains usable offline.

### Performance

- keep Canvas Layer count bounded;
- avoid duplicating large raster state;
- deterministic geometry should remain responsive on realistic apartment plans;
- establish explicit 3D mesh/render budgets during M5 design.

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

1. Finish the current acceptance gate before starting the next major milestone.
2. Prefer real-user evidence over impressive demos.
3. Deterministic correctness beats AI/3D spectacle.
4. Fix root causes, not screenshots/symptoms.
5. Optional subsystems must stay isolated.
6. Local-first editing remains a core product property.
7. Add complexity only when the previous simpler model has been validated.
8. Start each major milestone with fresh design/brainstorming rather than carrying hidden assumptions forward.
