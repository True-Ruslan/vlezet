# Vlezet — Project State

**Last updated:** 2026-07-30  
**Status:** M0–M6.3 are merged and accepted in `main`. **M6.4 Reviewed Natural-Language Intent has passed representative browser acceptance in PR #17.** The browser-found narrow-inspector spacing issue has regression coverage and is fixed. Remaining integration gates are final exact-head strict CI, Ready for Review and squash merge. M5.3 remains evidence-driven camera/navigation/performance polish only.

> Read this file first in a new chat. It is the canonical short-form state of the product, architecture, accepted milestones, active integration gate, known limits and next decision point.

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
21. Exact numeric validation and its visualization use the same geometry authority.
22. Optional AI/LLM interpretation cannot bypass structured validation, generate authoritative coordinates or mutate the document directly.
23. Natural-language interpretation must produce a reviewable symbolic draft; ordinary structured controls remain the final user-visible intent before generation.
24. Provider keys, raw responses and language drafts are runtime-only and never become project state.

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
packages/planning        deterministic planning + reviewed intent contracts
```

Rendering:

- 2D: Konva / react-konva;
- 3D: plain Three.js over renderer-neutral `SpatialScene`.

State: Zustand and local React state for ephemeral workflows.  
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

### Intelligent planning through accepted M6.3

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

## 6. Browser-accepted RC — M6.4 Reviewed Natural-Language Intent

Branch and PR:

```text
feat/m6-4-reviewed-natural-language-intent
#17 feat: M6.4 reviewed natural-language intent
```

### Product position

M6.4 is an optional translation/review layer over M6.2–M6.3. It is not autonomous design and does not introduce another planner, layout model or source of geometry truth.

```text
ordinary-language request
        ↓ optional OpenRouter structured-output interpreter
symbolic clauses + unsupported fragments
        ↓ deterministic local object resolution
reviewable draft + explicit ambiguity choices
        ↓ explicit acknowledgement and transfer
existing manual structured controls
        ↓ explicit Find alternatives
existing deterministic planner / Preview / Apply
```

### Implemented

#### Pure planning contract

- framework-independent symbolic intent clause types;
- strict interpreter-payload normalization;
- canonical mm/cm/m conversion to millimetres;
- Unicode/case/punctuation/whitespace/`ё→е` reference normalization;
- exact object-name match, then unique contiguous token-sequence match;
- no fuzzy guessing;
- stable ambiguous candidate lists;
- resolved draft conversion through existing `validatePlanningConstraintSet()`;
- fail-closed object limit, conflicts and all-locked handling.

#### Optional OpenRouter adapter

- text-only structured-output request;
- compatible text-model discovery;
- runtime-only BYOK;
- safe native fetch receiver;
- categorized provider errors;
- malformed clauses surfaced as unsupported fragments rather than silently changing meaning;
- no image, coordinate, position, rotation, placement or geometry payload;
- no direct planner call or document mutation.

#### Review and transfer UX

- natural-language input above ordinary manual constraints;
- review cards preserving source fragments;
- explicit selects for ambiguous/unresolved references;
- unsupported-fragment acknowledgement gate;
- clause removal;
- normalized exact-gap values shown in millimetres;
- explicit `Перенести в ограничения` action;
- exact transfer into existing selected/lock/boundary/pair/gap controls;
- no automatic generation after transfer;
- provider failure leaves manual planning available;
- transfer/manual edits clear stale result, Preview and active exact-gap annotation;
- inspector-scoped viewport-safe styling;
- selected-object controls and pair cards retain readable spacing in the narrow inspector.

### Authority preserved

- no document schema or migration change;
- no IndexedDB, project format, backup/import/export change;
- no planner, evaluator, M2 fit or Apply/history authority change;
- confirmed intent is validated by the existing constraint validator;
- generation remains explicit;
- Preview remains non-mutating;
- Apply remains explicit and one-step undoable;
- raw model/provider state is not persisted.

### Browser acceptance evidence

Test room contained `Диван`, `Стул`, `Рабочий стол` and `Обеденный стол`.

The supplied browser screenshots and user report confirm:

- `Диван` resolved and received `Не двигать`;
- `кресло` was not fuzzy-guessed as `Стул` and required an explicit selection;
- `стол` was explicitly ambiguous between two tables;
- the pair minimum gap normalized to `800 мм`;
- window-relative language remained in `Не поддержано`;
- explicit choices and acknowledgement enabled transfer;
- transfer populated ordinary selected/lock/corner/gap controls;
- no alternatives were generated before separate `Найти варианты`;
- the full workflow stayed inside the right inspector.

User acceptance:

> «Работает все четко и ровно так, как ты описал.»

The unchanged downstream Preview/Apply/Undo/Redo authority remains covered by the accepted M6.3 browser evidence and the full regression suite; it is not falsely attributed to the supplied M6.4 screenshots.

### TDD and CI evidence

Four primary RED/GREEN slices and the browser-found responsive polish are recorded in:

`docs/milestones/m6-4-acceptance.md`

Latest verified polish head before this state update:

```text
4980d062d33848a82584881eddeadff70b74a0b1
GitHub Actions 30553207256 — PASS
```

Passed:

- frozen install;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

## 7. Known limits and technical debt

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
- M6.4 language vocabulary is deliberately limited to existing M6.2–M6.3 concepts;
- no whole-apartment orchestration;
- no autonomous geometry creation;
- no opaque AI scoring;
- no persistent planning session or second layout model;
- no mandatory network dependency.

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

## 8. Immediate roadmap

```text
M0–M4.6                         ✅ merged and accepted
M5.1 spatial shell/viewer       ✅ merged and accepted
M5.2 furniture in 3D            ✅ merged and accepted
M5.4 spatial inspection         ✅ merged and accepted
M6.1 layout alternatives        ✅ merged and accepted
M6.2 constraint-aware planning  ✅ merged and accepted
M6.3 exact spatial constraints  ✅ merged and accepted
        ↓
M6.4 reviewed language intent   ✅ browser accepted in PR #17
        ↓
final exact-head CI → Ready for Review → squash merge
        ↓
select next slice from actual user evidence
```

M5.3 is not a blocking standalone milestone. Its architectural foundation shipped in M5.1; remaining work is evidence-driven polish only.

No later major milestone should begin before M6.4 merge. The next product slice after M6.4 must be selected from actual user evidence rather than speculative AI scope.

## 9. Current workflow

```text
M6.4 design/spec                     ✅
implementation plan                  ✅
RED/GREEN pure intent contract       ✅
RED/GREEN provider boundary          ✅
RED/GREEN review/transfer model      ✅
RED/GREEN UI integration             ✅
representative browser acceptance    ✅
responsive browser finding           ✅ fixed with regression coverage
implementation/polish-head CI        ✅ 30553207256
acceptance + canonical state          ✅
final exact-head CI                   ⏳
Ready for Review / squash merge       ⏳
post-merge canonical SHA/changelog    ⏳
```

Precision, recognition and M5 polish remain evidence-driven backlog and should not interrupt the current M6.4 integration gate unless they become actual user blockers.
