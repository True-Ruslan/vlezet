# Vlezet — Project State

**Last updated:** 2026-07-30  
**Status:** M0–M6.3 are merged and accepted in `main`. M6.3 added exact millimetre hard constraints and authoritative nearest-contour visualization without changing the persistent document, M2 fit authority or atomic Apply. The next deliberately narrow slice is **M6.4 Reviewed Natural-Language Intent**. M5.3 remains evidence-driven camera/navigation/performance polish only.

> Read this file first in a new chat. It is the canonical short-form state of the product, architecture, accepted milestones, limits and next step.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners and buyers.

Core promise:

> Draw or import a real apartment, work with understandable real dimensions, place furniture and appliances, and understand what fits, collides and remains usable — without learning professional CAD.

Priorities:

- precision before decoration;
- structured editable geometry rather than image-only plans;
- millimetres as the canonical world unit;
- local-first core editing;
- understandable semantics for ordinary users;
- AI/CV only as editable assistance;
- 3D as a projection of the same trusted document;
- planning as deterministic, explainable assistance with explicit Apply.

## 2. Non-negotiable architecture

1. TypeScript is the primary language.
2. Millimetres are the canonical world unit.
3. Canvas/WebGL pixels are never persisted as apartment geometry.
4. `domain`, `geometry`, `editor-core`, `projects`, `recognition`, `spatial` and `planning` remain framework-independent where applicable.
5. Konva and Three.js are projections, never geometry authority.
6. Rooms, areas, dimensions, floors and 3D meshes are derived from structured geometry.
7. `VlezetDocument` is the only persistent apartment/layout source of truth.
8. Project formats are schema-versioned and migrated deterministically.
9. Undo/Redo is semantic-command oriented.
10. Local editing must not depend on network latency.
11. AI/CV may create only editable suggestions; deterministic validation remains authoritative.
12. Existing user geometry is never silently replaced.
13. Ambiguous semantics fail closed or require explicit user intent.
14. 3D never introduces parallel editor state or mesh-based fit authority.
15. 3D hover/select/inspection is ephemeral and read-only.
16. Planning candidates, constraints, Preview, active evidence and overlays are ephemeral.
17. Only explicit Apply may mutate ordinary document entities.
18. M2 geometry/fit rules remain authoritative for containment, collisions, doors and clearances.
19. Hard planning constraints reject before scoring; soft preferences only influence deterministic ranking.
20. Request generation and candidate/Apply boundaries share fail-closed constraint validation.
21. Exact numeric validation and its visualization must use the same geometry authority.
22. Optional AI/LLM interpretation can never bypass structured validation or directly generate authoritative geometry.

## 3. Repository and stack

Repository: `True-Ruslan/vlezet`

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent model and migrations
packages/geometry        framework-independent geometry/math
packages/editor-core     semantic editing/history/snapping
packages/projects        local-first persistence abstraction
packages/recognition     assisted-recognition model/CV/reconciliation
packages/spatial         renderer-neutral deterministic 3D projection
packages/planning        framework-independent deterministic planning
```

Rendering:

- 2D: Konva / react-konva;
- 3D: plain Three.js over renderer-neutral `SpatialScene`.

State: Zustand.  
Persistence: IndexedDB through repository adapters.  
Workspace: pnpm + Turborepo.

The repository is public, so standard GitHub-hosted Actions are available.

## 4. Accepted milestones in `main`

| Milestone | Result | Merge |
|---|---|---|
| M0 Foundation + Infinite Canvas | monorepo, mm canvas, pan/zoom/grid, wall drawing, snapping, semantic history | `099a202413459674d2b50c33d2c1fa125a0fef6f` |
| M1 Apartment Shell | topological walls, junctions, thickness, rooms/areas, openings, diagnostics | `3944c7f9d668a645e1dc05805f476d2f3290eb94` |
| M2 Furnishing + Fit | placed objects, dimensions/transforms, containment/collision/door/clearance authority | `aa34f24572f2e67714604634587a1c41e4067cd8` |
| M3 Local-First Projects | dashboard, IndexedDB, autosave, backup/import, PNG export | `6c32249acc8e333e62fceee2ea4e76ca83890c77` |
| M4 Reference Import | JPG/PNG/PDF, calibration, alignment, tracing, local assets, portable backup | `12e9696e11572ad5ec055f3dfad98ad7826184e2` |
| M4.5 Assisted Recognition | editable assisted MVP; noisy accuracy remains backlog | `b63bdd613db4e13c07d2a961981799bd360f256d` |
| M4.6 Precision Geometry UX | clear-size semantics, area consistency, dimensions and tape tool | `a718bf605d8b3bde8dc87953c340b7b0e9565fdb` |
| M5.1 Spatial 3D Shell | deterministic shell/viewer, camera controls, safe mode switching | `4acca82b04c87b3737eb87a03f9ee2ff360b5073` |
| M5.2 Furniture in 3D | ordinary placed objects projected into `SpatialScene.objects` | `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a` |
| M5.4 Spatial Inspection | semantic hover/select and read-only room/wall/object inspector | `0bffe36d74d2ff0865d700b51b17ee08e7001094` |
| M6.1 Layout Alternatives | bounded deterministic alternatives, non-mutating Preview, atomic Apply | `f2bbf1c4989ef4582ee86aba19c75a71679034be` |
| M6.2 Constraint-Aware Planning | lock, wall/corner and pair near/far structured intent | `db68d697540ddb9901fbddad0763d769e7d16851` |
| M6.3 Exact Spatial Constraints | exact pair gap, structured evidence and nearest-contour overlay | `724058fe57d769e7c1329f3536d6869405e6ac42` |

### M4.6 accepted regression

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

### M6.3 accepted evidence

```text
final head: f3f093df2cc6dba2aa0f6590b2c0250287f7c6b8
CI:         30542599616 — PASS
merge:      724058fe57d769e7c1329f3536d6869405e6ac42
```

Browser acceptance:

> «Все работает супер идеально, ты гений величайший.»

Checklist: `docs/milestones/m6-3-acceptance.md`.

## 5. Current product capability

### Trusted apartment editing

- real millimetre world coordinates;
- structured walls, vertices, junctions and openings;
- deterministic rooms, usable area and clear dimensions;
- furniture/appliances with exact dimensions, rotation and clearances;
- explainable fit/collision/door/clearance diagnostics;
- semantic Undo/Redo;
- local-first projects, autosave, backup and export.

### Reference and recognition

- local image/PDF reference import and calibration;
- tracing against the reference;
- assisted recognition with editable candidates and explicit Apply;
- recognition remains experimental and never silently replaces geometry.

### Spatial 3D

- deterministic projection of shell and furniture;
- safe 2D↔3D switching;
- semantic read-only inspection of rooms, walls and objects;
- no direct 3D editing or mesh-based product authority.

### Intelligent planning

- one deterministic axis-aligned rectangular room;
- rearrangement of 1–3 existing selected objects;
- non-selected furniture remains fixed obstacles;
- bounded deterministic candidate generation;
- maximum three ranked alternatives;
- M2-authoritative hard validation;
- structured hard/soft intent:
  - `lock-object`;
  - `prefer-room-boundary`;
  - `pair-distance` near/far;
  - `pair-min-gap` exact millimetres;
- exact nearest-contour evidence for rotated furniture;
- contextual non-interactive 2D witness overlay;
- non-mutating Preview;
- explicit current-document-revalidated Apply;
- one multi-object Apply = one Undo/Redo step.

## 6. Known limits and technical debt

### Recognition

- M4.5 remains an assisted MVP, not authoritative reconstruction;
- quality varies by plan style and image quality;
- future work needs representative fixtures and measurable metrics.

### Precision geometry

Not yet generalized:

- editable clear dimensions beyond simple deterministic rectangles;
- arbitrary parametric or locked dimensions;
- target-area solver;
- permanent associative CAD dimensions;
- advanced opening reference offsets;
- structural/removability classification without authoritative building data.

### Planning

Intentional limits:

- one supported deterministic rectangular room;
- only 1–3 existing selected objects;
- exact numeric rule currently covers furniture-to-furniture minimum contour gap only;
- no furniture-to-wall exact rule yet;
- no whole-apartment orchestration;
- no autonomous geometry creation;
- no opaque AI scoring;
- no persistent planning session or second layout model;
- no natural-language interpretation yet.

### Spatial 3D

- schematic shell/furniture visuals;
- generic primitives rather than decorative assets;
- no direct 3D editing or photorealism;
- camera persistence/accessibility/unusual-plan framing remain evidence-driven polish;
- batching/LOD only when representative projects prove a need.

### Deferred infrastructure

- accounts/auth;
- cloud sync/sharing/collaboration;
- managed AI/backend billing;
- mobile-first editor;
- multi-floor;
- curved walls;
- DWG/DXF/BIM;
- photorealism/VR.

## 7. Immediate roadmap

```text
M0–M4.6                         ✅ merged and accepted
M5.1 spatial shell/viewer       ✅ merged and accepted
M5.2 furniture in 3D            ✅ merged and accepted
M5.4 spatial inspection         ✅ merged and accepted
M6.1 layout alternatives        ✅ merged and accepted
M6.2 constraint-aware planning  ✅ merged and accepted
M6.3 exact spatial constraints  ✅ merged and accepted
        ↓
M6.4 reviewed natural-language intent  ← NEXT
```

M5.3 is not a blocking standalone milestone. Its architectural foundation shipped in M5.1; remaining work is evidence-driven polish only.

## 8. Next slice — M6.4 Reviewed Natural-Language Intent

Goal:

> Let a user describe planning intent in ordinary language, convert it into a reviewable structured constraint draft, and require explicit confirmation before the existing deterministic planner runs.

Proposed narrow architecture:

```text
natural-language request
        ↓ optional interpreter
reviewable PlanningConstraint[] draft
        ↓ explicit user edit/confirmation
existing fail-closed constraint validation
        ↓
existing deterministic M6 planner
        ↓
Preview / explicit Apply
```

Recommended first scope:

1. support only concepts already accepted in M6.2–M6.3;
2. map language to `lock-object`, wall/corner preference, pair near/far and exact pair minimum gap;
3. resolve object references against the selected room and show ambiguities explicitly;
4. show the generated structured draft before generation;
5. require explicit user confirmation or editing;
6. reject unsupported, ambiguous or malformed intent without guessing;
7. keep the interpreter optional so manual structured planning always works;
8. never let model output bypass validation, candidate evaluation or Apply revalidation;
9. do not persist raw model state as a second planning document;
10. require exact-head CI and representative browser acceptance.

Explicit non-goals:

- free-form coordinate generation;
- autonomous whole-apartment design;
- direct document mutation from language;
- opaque ranking or model-only correctness;
- photorealistic interior generation;
- network dependency for core editing/planning;
- direct 3D editing.

## 9. Recommended workflow

```text
M6.4 focused design spec
→ define supported language and ambiguity rules
→ TDD pure structured intent draft contract
→ optional interpreter adapter behind that contract
→ explicit review/edit/confirm UX
→ existing deterministic planner integration
→ stale/error/non-network fallback tests
→ representative browser acceptance
→ exact-head strict CI
→ squash merge
```

Precision, recognition and M5 polish remain evidence-driven backlog and should not interrupt M6.4 unless they become real user blockers.