# Vlezet — Project State

**Last updated:** 2026-07-22  
**Status:** M0–M5.2 are merged to `main`. M5.1 delivered the deterministic spatial shell/viewer, M5.2 added deterministic furniture projection and both passed strict CI plus real browser acceptance. The next product slice is **M5.4 Spatial Inspection**. The original M5.3 camera/navigation foundation was already delivered inside M5.1; remaining M5.3 work is evidence-driven polish, not a separate architectural milestone.

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
4. `domain`, `geometry`, `editor-core`, recognition core and `spatial` projection remain framework-independent where applicable.
5. Konva/Canvas/Three.js are projections of the domain model, never the source of truth.
6. Rooms/areas are derived from structured geometry.
7. Project formats are schema-versioned and migrated deterministically.
8. Undo/Redo is semantic-command oriented.
9. Local editing must not depend on network latency.
10. AI/CV may create only editable suggestions; deterministic validation remains authoritative.
11. Existing user geometry must never be silently replaced by recognition/AI.
12. Optional subsystems must never block core project startup.
13. Product simplicity must not hide ambiguous geometry semantics.
14. Derived dimensions/annotations/floors/3D meshes never become a second persisted geometry source.
15. Ambiguous geometry semantics must fail closed or require explicit user intent instead of guessing.
16. 3D projects the same `VlezetDocument`; it does not introduce a parallel editor state.
17. Three.js mesh collision is never product authority for fit/clearance decisions.

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

The repository was made public on 2026-07-22, restoring standard GitHub-hosted Actions after private-repository included minutes were exhausted.

## 4. Stable milestones in `main`

### M0 — Foundation and Infinite Canvas

PR #1 → `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered monorepo/package boundaries, infinite canvas, mm world coordinates, pan/zoom/grid, wall drawing, snapping, semantic history and reproducible CI.

### M1 — Apartment Shell

PR #2 → `3944c7f9d668a645e1dc05805f476d2f3290eb94`.

Delivered topological walls/vertices, T-junctions, physical wall thickness, deterministic rooms/usable area, room names, host-wall openings and geometry diagnostics.

### M2 — Furnishing and Fit

PR #3 → `aa34f24572f2e67714604634587a1c41e4067cd8`.

Delivered furniture/appliance objects, exact dimensions/transforms, snapping/guides, collision/containment/door-swing/clearance evaluation and explainable fit statuses.

### M3 — Local-First Projects

PR #4 → `6c32249acc8e333e62fceee2ea4e76ca83890c77`.

Delivered dashboard/project lifecycle, IndexedDB persistence, autosave/retry, viewport restore, backup/import and PNG export.

### M4 — Reference Plan Import

PR #5 → `12e9696e11572ad5ec055f3dfad98ad7826184e2`.

Delivered local JPG/PNG/PDF import, safe validation/rasterization, calibration, alignment, local reference asset persistence, tracing, reference-aware fitting, portable backup and PNG export options.

### M4.5 — Assisted Recognition

PR #6 → `b63bdd613db4e13c07d2a961981799bd360f256d`.

**Product status:** accepted assisted/experimental MVP.

Delivered local OpenCV/Web Worker recognition, persistent `RecognitionDraft`, review/edit/accept/reject, deterministic image→mm apply, duplicate/conflict protection, one-batch Undo/Redo, stale handling and optional OpenRouter BYOK refinement.

Known limitation intentionally deferred: recognition quality is useful but still noisy/inaccurate on some real plans. Future refinement requires representative fixtures and measurable metrics.

### M4.6 — Precision Geometry UX

PR #7 → `a718bf605d8b3bde8dc87953c340b7b0e9565fdb`.

Accepted after strict CI and real browser verification.

Delivered:

- explicit `Длина по оси стены` semantics;
- wall resize anchors;
- clear internal width/length editing for deterministic rectangular rooms;
- usable area from the same inner-face geometry;
- deterministic area rounding;
- wall-thickness fixed-face/alignment semantics;
- clear room dimension lines vs technical centreline dimensions;
- `Размеры` toggle;
- ephemeral `Измерить` / `M` tape tool;
- no duplicate persisted dimension authority.

Accepted regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

### M5.1 — Deterministic Spatial 3D Shell

PR #8 → squash merge `4acca82b04c87b3737eb87a03f9ee2ff360b5073`.

**Product status:** accepted and merged after strict CI, real browser acceptance and lifecycle review.

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

- framework-independent `@vlezet/spatial`;
- canonical `document x → scene X`, `document y → scene Z`, height → scene Y;
- millimetres remain millimetres;
- deterministic wall prisms and physical thickness;
- wall splitting via existing opening contracts;
- room floors from derived usable inner polygons;
- semantic schematic door/window placeholders without invented vertical authority;
- fail-closed spatial diagnostics;
- Three.js viewer with orbit/pan/zoom;
- Perspective / Isometric / Top / Fit;
- safe non-semantic 2D↔3D switching;
- WebGL failure isolation;
- explicit renderer/control/geometry/material/GridHelper cleanup.

Real browser acceptance PASS. User explicitly confirmed: **«Все есть»**.

Canonical checklist: `docs/milestones/m5-acceptance.md`.

### M5.2 — Furniture in 3D

PR #9 → squash merge `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a`.

**Product status:** accepted and merged after TDD, strict exact-head CI and paired real-project 2D/3D browser verification.

Delivered:

- `SpatialScene.objects` / renderer-neutral `SpatialObject` contract;
- exact existing `VlezetDocument.placedObjects` projection;
- document X/Y → scene X/Z position mapping;
- exact width/depth millimetres;
- deterministic `rotationDeg → rotationYRad`;
- stored height preserved exactly;
- missing height uses projection-only `DEFAULT_OBJECT_HEIGHT_MM = 700` and is never persisted;
- semantic object ID/name/category preserved for later inspection;
- invalid/non-finite/out-of-domain object geometry fails closed per object;
- generic deterministic Three.js box primitives;
- renderer lifecycle disposes object geometry/material;
- no second 3D furniture state;
- no mesh-collision authority;
- 3D remains read-only.

TDD RED→GREEN evidence covered:

1. missing neutral `SpatialObject` projection;
2. missing Three.js placed-object mesh;
3. finite object dimensions outside persistent domain limits.

Final accepted exact head before merge:

```text
1b955e01a3092e11427258b563871800cf82206a
GitHub Actions 29940437536 — PASS
```

All required gates passed:

- frozen install;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

Browser acceptance PASS on a real project with `3 предметов`:

- all three objects are visible in 3D;
- paired 2D/3D screenshots show matching room placement;
- one object is in the left small room and two are in the right small room in both views;
- no visible M5.1 shell regression.

Canonical checklist: `docs/milestones/m5-2-acceptance.md`.

## 5. Current known limitations / technical debt

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

Current intentional limits:

- shell and furniture are deterministic but visually schematic;
- door/window vertical details are not authoritative because the document does not yet store those semantics;
- furniture uses generic primitives rather than decorative 3D assets;
- no direct 3D geometry/furniture editing;
- no photorealism/material pipeline;
- no hover/select/inspection UI yet;
- advanced batching/LOD must be evidence-driven, not speculative.

### Product/infrastructure deferred

- accounts/auth;
- cloud sync/sharing/collaboration;
- managed AI/backend billing;
- mobile-first editor;
- multi-floor;
- curved walls;
- DWG/DXF/BIM;
- photorealism/VR.

## 6. Immediate roadmap — NOW

```text
M0–M4.6                  ✅ merged and accepted
M5.1 spatial shell/viewer ✅ merged and accepted
M5.2 furniture in 3D     ✅ merged and accepted
        ↓
M5.4 Spatial Inspection  ← NOW
        ↓
M5 polish/perf only where evidence requires it
        ↓
M6 Intelligent Planning
```

### Why M5.3 is not a separate blocking milestone

The original M5.3 camera/navigation foundation was intentionally delivered in M5.1 because the shell could not be meaningfully accepted without it:

- orbit;
- pan;
- zoom;
- Perspective / Isometric / Top presets;
- fit camera;
- reliable 2D↔3D switching.

Remaining camera/navigation work is evidence-driven polish only: persistence, unusual-plan framing, accessibility/input refinements and measured performance budgets.

## 7. Next implementation slice — M5.4 Spatial Inspection

Goal:

> Make the read-only 3D view useful for understanding the apartment, not only viewing it, by inspecting the same semantic rooms/walls/objects and surfacing already-authoritative information.

Recommended scope:

- hover/select semantic room/wall/object entities in 3D;
- preserve stable IDs already carried by `SpatialScene`/Three.js `userData`;
- show dimensions already known by the trusted document/spatial model;
- show existing furniture fit status/reasons from the deterministic fit engine;
- keep inspection non-semantic/read-only;
- no direct geometry edits from Three.js;
- no silent document/history/autosave mutation from 3D interaction;
- no new geometry authority;
- no decorative asset pipeline mixed into inspection.

## 8. Recommended next workflow

```text
M5.4 focused UX/design spec
→ choose inspection interaction model
→ TDD semantic hit/selection contracts
→ read-only inspector using existing authoritative values
→ browser acceptance on the same representative apartment
→ strict exact-head CI
→ merge
→ evidence-driven M5 polish or M6 Intelligent Planning
```

Do not mix M6 planning/AI generation or decorative 3D assets into M5.4.