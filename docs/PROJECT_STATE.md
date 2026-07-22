# Vlezet — Project State

**Last updated:** 2026-07-22  
**Status:** M0–M5.1 are merged to `main`. M5.1 Deterministic Spatial 3D Shell passed strict CI, real browser acceptance and final lifecycle review. The active next slice is **M5.2 Furniture in 3D**.

> **Read this file first in a new chat.** It is the canonical short-form answer to what Vlezet is, what is stable, what was just completed, what remains intentionally limited, and what should happen next.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners/buyers.

Core promise:

> Draw or import a real apartment, work with understandable real dimensions, place furniture/appliances and understand what fits, what collides and how much usable space remains — without learning professional CAD.

Product priorities:

- precision before decoration;
- structured editable geometry rather than image-only plans;
- millimetres as the canonical world unit;
- local-first core editing;
- understandable geometry semantics for ordinary users;
- AI/CV only as editable assistance;
- 3D as a projection of the same trusted document, never a second geometry source.

## 2. Non-negotiable architecture rules

1. TypeScript is the primary language.
2. Millimetres are the canonical world unit.
3. Canvas/WebGL pixels are never persisted as apartment geometry.
4. `domain`, `geometry`, `editor-core`, `recognition` core and `spatial` projection remain framework-independent where applicable.
5. Konva/Canvas/Three.js are projections of the domain model, never the source of truth.
6. Rooms/areas are derived from structured geometry.
7. Project formats are schema-versioned and migrated deterministically.
8. Undo/Redo is semantic-command oriented.
9. Local editing must not depend on network latency.
10. AI/CV may create only editable suggestions; deterministic geometry validation is authoritative.
11. Existing user geometry must never be silently replaced by recognition/AI.
12. Optional subsystems must never block core project startup.
13. Product simplicity must not hide ambiguous geometry semantics.
14. Derived dimensions/annotations/floors/3D meshes must never become a second persisted geometry source.
15. Ambiguous geometry semantics must fail closed or require explicit user intent instead of guessing.
16. 3D must project the same `VlezetDocument`; it must not introduce a parallel editor state.

## 3. Repository and stack

Repository: `True-Ruslan/vlezet`.

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent apartment model and migrations
packages/geometry        framework-independent geometry/math
packages/editor-core     semantic editor operations/history/snapping
packages/projects        local-first project/persistence abstraction
packages/recognition     assisted-recognition model/CV/reconciliation
packages/spatial         renderer-neutral deterministic 3D projection
```

Rendering:

- 2D: Konva / react-konva;
- 3D: plain Three.js over neutral `SpatialScene`.

State: Zustand.  
Persistence: IndexedDB through repository adapters.  
Workspace: pnpm + Turborepo.

The repository was made public on 2026-07-22. This restored standard GitHub-hosted Actions availability after the private-account included Actions minutes had been exhausted.

## 4. Stable milestones in `main`

### M0 — Foundation and Infinite Canvas

PR #1 → merge `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered monorepo/package boundaries, infinite canvas, mm world coordinates, pan/zoom/grid, wall drawing, snapping, semantic history and reproducible CI.

### M1 — Apartment Shell

PR #2 → merge `3944c7f9d668a645e1dc05805f476d2f3290eb94`.

Delivered topological walls/vertices, T-junctions, physical wall thickness, deterministic rooms/usable area, room names, host-wall openings and geometry diagnostics.

### M2 — Furnishing and Fit

PR #3 → merge `aa34f24572f2e67714604634587a1c41e4067cd8`.

Delivered furniture/appliance objects, exact dimensions/transforms, snapping/guides, collision/containment/door-swing/clearance evaluation and explainable fit statuses.

### M3 — Local-First Projects

PR #4 → merge `6c32249acc8e333e62fceee2ea4e76ca83890c77`.

Delivered dashboard/project lifecycle, IndexedDB persistence, autosave/retry, viewport restore, backup/import and PNG export.

### M4 — Reference Plan Import

PR #5 → merge `12e9696e11572ad5ec055f3dfad98ad7826184e2`.

Delivered local JPG/PNG/PDF import, safe validation/rasterization, calibration, alignment, local reference asset persistence, tracing, reference-aware fitting, portable backup and PNG export options.

### M4.5 — Assisted Recognition

PR #6 → squash merge `b63bdd613db4e13c07d2a961981799bd360f256d`.

**Product status:** accepted assisted/experimental MVP.

Delivered:

- framework-independent `@vlezet/recognition`;
- local OpenCV/Web Worker recognition;
- persistent `RecognitionDraft` separate from `VlezetDocument`;
- review/edit/accept/reject/bulk accept;
- deterministic image→millimetre apply;
- duplicate-existing protection;
- one applied batch = one Undo/Redo operation;
- stale handling by reference revision/engine version;
- optional OpenRouter BYOK refinement;
- tolerant structured parsing/reconciliation/sanity filtering;
- startup isolation and runtime-only provider secrets.

Known limitation intentionally deferred: recognition quality is useful but still noisy/inaccurate on some real plans. It requires representative fixtures and measurable metrics before deeper tuning.

### M4.6 — Precision Geometry UX

PR #7 → squash merge `a718bf605d8b3bde8dc87953c340b7b0e9565fdb`.

**Product status:** accepted and merged after strict CI and real browser verification.

Solved the ordinary-user trust problem where centreline wall lengths looked like clear room dimensions.

Delivered:

- explicit `Длина по оси стены` semantics;
- wall resize anchors;
- clear internal width/length editing for deterministic rectangular rooms;
- usable area from the same inner-face geometry;
- deterministic `11.715 м² → 11.72 м²` display rounding;
- wall-thickness fixed-face/alignment semantics;
- clear room dimension lines vs technical centreline dimensions;
- `Размеры` visibility toggle;
- ephemeral `Измерить` / `M` tape tool;
- no duplicate persisted dimension authority.

Accepted regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

### M5.1 — Deterministic Spatial 3D Shell

PR #8 → squash merge `4acca82b04c87b3737eb87a03f9ee2ff360b5073`.

**Product status:** accepted and merged after strict CI, real browser acceptance and final lifecycle review.

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

Delivered:

- new framework-independent `@vlezet/spatial` package;
- canonical mapping `document x → scene X`, `document y → scene Z`, height → scene Y;
- millimetres remain unchanged through spatial projection;
- deterministic wall prisms using existing wall endpoints/thickness;
- wall splitting reuses existing `deriveVisibleWallIntervals` opening contract;
- room floors reuse existing derived usable inner polygons;
- semantic door/window placeholders preserve ID/kind/width/position without inventing authoritative vertical dimensions;
- invalid wall/opening projection fails closed through diagnostics;
- Three.js viewer with orbit/pan/zoom;
- `Перспектива`, `Изометрия`, `Сверху` and `Весь план`;
- separate non-semantic 2D/3D view-mode state;
- 3D never mutates geometry/history;
- 2D editor session remains authoritative and mounted;
- WebGL failure remains isolated from 2D;
- explicit disposal of renderer, controls, scene resources and `GridHelper` resources.

Intentional M5.1 boundaries:

- no furniture projection yet;
- door/window vertical geometry remains schematic because the document does not yet store authoritative sill/top/door heights;
- no direct geometry editing in 3D;
- no photorealism/material marketplace/R3F requirement/BIM/VR.

## 5. M5.1 acceptance evidence

### Automated

Primary accepted code head:

```text
bae06971e7969ee8324e540eb9d4a9e758fda1d8
29934171569 — PASS
```

Final lifecycle fix TDD cycle:

```text
ea672213f3554d7acf7c604be290718ae37da02f — RED disposal regression test
a0da8785c8793833c8ff0f66b65a19684f0457a0 — GREEN lifecycle fix
29936603959 — PASS
```

Final PR documentation head also passed strict CI before merge.

All required gates passed:

- frozen install;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

### Manual browser acceptance

**PASS — 2026-07-22.**

Real user project and screenshot confirmed:

- 3D viewer renders the apartment;
- walls/spatial structure are visible;
- schematic openings are visible;
- Perspective/Isometric/Top controls are present;
- orbit/pan/zoom and fit behavior are available;
- 2D/3D switching is present in the real editor UI.

User explicitly confirmed: **«Все есть»**.

Canonical detailed checklist: `docs/milestones/m5-acceptance.md`.

## 6. Current known limitations / technical debt

### Recognition

- M4.5 remains assisted/experimental, not authoritative reconstruction;
- quality varies by plan style/model;
- future work needs representative fixtures and measurable metrics.

### Precision geometry

Not yet generalized:

- editable clear dimensions beyond simple deterministic axis-aligned rectangles;
- arbitrary parametric constraints/locked dimensions;
- target-area solver;
- permanent associative CAD-like dimensions;
- advanced opening offsets/reference corners;
- structural/removability classification without authoritative data.

### Spatial 3D

Current limitations:

- M5.1 shell is intentionally schematic;
- furniture is not yet projected;
- vertical opening details are not authoritative;
- direct 3D editing is intentionally absent;
- no photorealism/material assets;
- advanced batching/LOD should be evidence-driven, not speculative.

### Product/infrastructure deferred

- accounts/auth;
- cloud sync/sharing/collaboration;
- managed AI/backend billing;
- mobile-first editor;
- multi-floor;
- curved walls;
- DWG/DXF/BIM;
- photorealism/VR.

## 7. Immediate roadmap — NOW

```text
M0–M4.6                  ✅ merged and accepted
M5.1 deterministic 3D    ✅ merged and accepted
        ↓
M5.2 Furniture in 3D     ← NOW
        ↓
M5.3 navigation polish   → existing foundation already partially delivered in M5.1
        ↓
M5.4 spatial inspection
        ↓
M6 Intelligent Planning
```

### Next implementation slice: M5.2 Furniture in 3D

Goal:

> Project the same existing `placedObjects` into 3D using their current position, width, depth, height and rotation, without creating parallel 3D placement state.

Rules:

- use the same `VlezetDocument.placedObjects`;
- project position to X/Z and rotation to Y;
- use stored height when present;
- use an explicit projection-only default height when height is absent, never persist it silently;
- generic deterministic primitives first;
- no decorative asset pipeline yet;
- fit/collision truth remains the existing deterministic 2D/domain logic, not mesh collision;
- 3D remains read-only in this slice.

## 8. Recommended next workflow

```text
M5.2 focused spec/plan
→ TDD spatial object projection
→ generic Three.js object primitives
→ browser acceptance on real apartment
→ strict exact-head CI
→ merge
→ M5.4 inspection / remaining M5 polish
```

Do not mix M6 planning/AI generation into M5.2.
