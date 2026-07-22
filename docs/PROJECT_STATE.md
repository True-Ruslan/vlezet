# Vlezet — Project State

**Last updated:** 2026-07-22  
**Status:** M0–M6.1 are merged and accepted in `main`. M6.1 delivered the first deterministic Intelligent Planning slice: bounded, explainable furniture alternatives with non-mutating preview and atomic Apply/Undo/Redo. The next implementation slice is **M6.2 Constraint-Aware Planning**. M5.3 remains evidence-driven camera/navigation/performance polish only, not a blocking architectural milestone.

> **Read this file first in a new chat.** It is the canonical short-form answer to what Vlezet is, what is stable, what remains intentionally limited, and what should happen next.

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
18. 3D hover/select/inspection state is ephemeral and must never mutate document/history/autosave state.
19. Planning candidates/preview state are ephemeral structured suggestions; only explicit Apply may mutate ordinary `VlezetDocument` entities.
20. Planning validation/ranking must reuse deterministic geometry/fit authority; AI/LLM output can never bypass it.

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
packages/planning        framework-independent deterministic planning contracts/generation/evaluation
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

Delivered framework-independent spatial projection, deterministic wall prisms/thickness, opening-aware wall segmentation, usable room floors, schematic semantic opening markers, fail-closed diagnostics, orbit/pan/zoom, Perspective/Isometric/Top/Fit, safe 2D↔3D switching, WebGL isolation and explicit GPU-resource cleanup.

Real browser acceptance PASS. User explicitly confirmed: **«Все есть»**.

### M5.2 — Furniture in 3D

PR #9 → squash merge `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a`.

**Product status:** accepted and merged after TDD, strict exact-head CI and paired real-project 2D/3D browser verification.

Delivered:

- `SpatialScene.objects` / renderer-neutral `SpatialObject` contract;
- exact projection of existing `VlezetDocument.placedObjects`;
- deterministic X/Y → X/Z position and rotation mapping;
- exact width/depth and stored height;
- projection-only `DEFAULT_OBJECT_HEIGHT_MM = 700` when persistent height is absent;
- semantic object ID/name/category preservation;
- fail-closed invalid object projection;
- generic deterministic Three.js box primitives;
- explicit object resource disposal;
- no second 3D furniture state and no mesh-collision authority.

Browser acceptance PASS on the representative real project with three placed objects.

### M5.4 — Spatial Inspection

PR #10 → squash merge `0bffe36d74d2ff0865d700b51b17ee08e7001094`.

**Product status:** DONE / ACCEPTED after TDD, strict exact-head CI and representative real-browser acceptance.

Delivered:

- semantic Three.js ray-hit resolution to stable `roomId`, `wallId` and `objectId`;
- hover preview and click-to-select interaction;
- drag-vs-click protection for OrbitControls;
- read-only inspector for authoritative room, wall and furniture information;
- room usable area and clear rectangular dimensions from deterministic geometry;
- canonical M4.6 area rounding reused in 3D (`11.715 → 11.72 m²`);
- wall centreline length/thickness and split-segment count;
- object dimensions/rotation plus existing deterministic M2 fit status/reasons;
- semantic visual emphasis, including all rendered segments of one logical wall;
- non-inspectable schematic opening placeholders skipped during picking;
- temporary highlight materials restored/disposed deterministically;
- stale/unknown semantic IDs fail closed;
- no document/history/autosave mutation from inspection.

Final accepted PR head before merge:

```text
e9980f63d574d1a9cb6614980788270a50cde47e
GitHub Actions 29948749864 — PASS
```

Real-browser acceptance PASS. Product owner explicitly confirmed: **«Все работает круто как ты и описал.»**

Canonical checklist: `docs/milestones/m5-4-acceptance.md`.

### M6.1 — Deterministic Layout Alternatives

PR #11 → squash merge `f2bbf1c4989ef4582ee86aba19c75a71679034be`.

**Product status:** DONE / ACCEPTED after TDD, strict exact-head CI and representative real-browser acceptance.

Delivered:

- framework-independent `@vlezet/planning`;
- deliberately narrow supported scope: one deterministic axis-aligned rectangular room and 1–3 existing selected objects;
- non-selected furniture remains fixed obstacle context;
- deterministic footprint-aware placement anchors and normalized orientations;
- bounded search (`MAX_PLANNING_EVALUATIONS = 6000`);
- existing M2 `evaluateObjectFits()` remains authoritative for containment, collisions, door swing and clearances;
- deterministic hard rejection, ranking and human-readable reasons;
- maximum three displayed alternatives;
- ephemeral 2D ghost preview that does not mutate document/history/autosave;
- explicit revalidated Apply changing only selected-object position/canonical rotation;
- one semantic `planning/apply-candidate` history operation for multi-object Undo/Redo;
- no LLM/API dependency or second persisted layout authority.

Final accepted PR head before merge:

```text
acaa352545245ff079f55fb8ce85ba2a23f2312d
GitHub Actions 29953127208 — PASS
```

Real-browser acceptance PASS. Product owner explicitly confirmed: **«Все работает строго по сценарию.»**

Canonical checklist: `docs/milestones/m6-1-acceptance.md`.

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

- shell and furniture remain visually schematic;
- door/window vertical details are not authoritative because the document does not yet store those semantics;
- furniture uses generic primitives rather than decorative 3D assets;
- no direct 3D geometry/furniture editing;
- no photorealism/material pipeline;
- spatial inspection is read-only and intentionally does not edit geometry;
- camera persistence/accessibility/unusual-plan framing remain evidence-driven polish;
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
M0–M4.6                    ✅ merged and accepted
M5.1 spatial shell/viewer  ✅ merged and accepted
M5.2 furniture in 3D       ✅ merged and accepted
M5.4 spatial inspection    ✅ merged and accepted
M6.1 layout alternatives   ✅ merged and accepted
        ↓
M6.2 constraint-aware planning  ← NEXT
```

M5.3 is not a separate blocking milestone. Its architectural camera/navigation foundation was delivered in M5.1. Remaining work is evidence-driven polish only.

## 7. Next implementation slice — M6.2 Constraint-Aware Planning

Goal:

> Let users express explicit planning intent and constraints so alternatives optimize for what the user actually cares about, while keeping M2 deterministic fit/geometry rules as hard authority.

Recommended narrow scope:

1. structured framework-independent planning constraint/goal contracts;
2. explicit hard vs soft semantics;
3. support a small safe set first, such as fixed/locked objects, preferred wall/corner proximity, pairwise near/far relationships and minimum user-defined spacing where semantics are unambiguous;
4. deterministic scoring/ranking evidence for every supported soft preference;
5. unsupported/ambiguous constraints fail closed instead of being guessed;
6. preview remains ephemeral and Apply remains explicit/atomic;
7. no LLM required for correctness — optional natural-language interpretation can come only after structured contracts are stable.

Architecture direction:

```text
VlezetDocument + explicit structured goals/constraints
        ↓
@vlezet/planning deterministic generator/evaluator
        ↓
M2 authoritative fit/collision/door/clearance validation
        ↓
constraint-aware deterministic ranking + reasons
        ↓
ephemeral compare/preview
        ↓ explicit Apply
ordinary VlezetDocument entities + one semantic history step
```

Do **not** jump directly to whole-apartment AI orchestration, photorealistic generation, free-form geometry or opaque LLM scoring.

## 8. Recommended workflow

```text
M6.2 focused product/design spec
→ define the minimal constraint vocabulary and hard/soft semantics
→ TDD pure validation/scoring contracts
→ extend bounded candidate ranking without duplicating M2 authority
→ explainable constraint-aware comparison UI
→ explicit preview/apply
→ representative browser acceptance
→ strict exact-head CI
→ merge
```

High-value precision/recognition/M5 polish remains evidence-driven backlog and should not interrupt M6 unless it becomes a real user blocker.
