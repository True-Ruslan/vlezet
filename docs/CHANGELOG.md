# Vlezet — Changelog

**Purpose:** preserve development history in a form that explains **when**, **why**, **how** and **what** changed, so a new chat can reconstruct project context without relying on conversation memory.

This is not only a package-release changelog. It records milestone decisions, product feedback, RC failures and architecture changes that materially changed the roadmap.

## 2026-07-23 — M6.2 Constraint-Aware Planning accepted and merged

PR #13 squash merge:

```text
db68d697540ddb9901fbddad0763d769e7d16851
```

### Why

M6.1 proved that Vlezet could deterministically generate, preview and atomically apply valid furniture alternatives, but the planner did not yet know what the user actually cared about beyond geometry/fit validity.

M6.2 added explicit user intent without weakening product trust.

Product rule:

> User intent must be represented as structured, reviewable constraints. Hard constraints reject; soft preferences only affect deterministic ranking. M2 geometry/fit remains authoritative and Apply remains explicit.

### Delivered

Structured constraint vocabulary:

- hard `lock-object` → UI `Не двигать`;
- soft `prefer-room-boundary` → `Ближе к стене` / `Ближе к углу`;
- soft `pair-distance` → `Ближе друг к другу` / `Дальше друг от друга`;
- explicit centre-to-centre pair semantics in millimetres.

Validation and authority:

- maximum 9 constraints;
- malformed/unknown constraints fail closed;
- referenced objects must belong to the selected planning set;
- self-pairs are invalid;
- conflicting/duplicate boundary and pair preferences are invalid;
- duplicate locks are invalid;
- all selected objects locked is invalid;
- constraints normalize into stable deterministic order;
- shared `validatePlanningConstraintSet()` protects both request-generation and candidate/Apply boundaries;
- stale locked-object state invalidates the candidate atomically.

Deterministic scoring:

- M2 fit/collision/door/clearance remains hard authority;
- hard planning constraints reject before scoring;
- wall/corner/near/far metrics normalize by room diagonal;
- soft preference penalty ranks after M2 `tight`/recommendation quality and before rotation/movement tie-breaks;
- result reasons expose measured evidence in millimetres;
- candidate stable identity includes normalized user intent.

UX:

- existing M6.1 panel extended instead of creating a second planning mode;
- per-object `Не двигать` and boundary preference controls;
- per-pair near/far controls;
- changing any constraint clears stale result/preview;
- ghost preview remains non-mutating;
- Apply remains explicit, current-document-revalidated and one semantic Undo/Redo operation.

### TDD / RC findings fixed

1. missing structured constraint contracts → stable normalization and fail-closed validation;
2. canonical normalization-order mismatch → tests aligned to deliberate deterministic order;
3. M6.1 view fixtures exposed `preferencePenalty` contract evolution;
4. wording-only UI mismatch clarified explicit centre-to-centre semantics;
5. self-review found request/generator validation stronger than direct candidate Apply validation;
6. dedicated RED proved conflicting boundary preferences, self-pairs and all-locked direct candidates could bypass request validation;
7. shared `validatePlanningConstraintSet()` introduced for both request and candidate/Apply boundaries;
8. stale locked-object Apply regression added;
9. stable identity regression verifies constraint-order invariance and intent-sensitive identity.

### Verification

Final exact PR head before merge:

```text
a32b5f633ee5c36dafb5578d3c0c3f7eaa46d649
GitHub Actions 29962203961 — PASS
```

Passed frozen install, full unit suite, TypeScript typecheck, ESLint and production Next build.

### Manual browser acceptance

**PASS — 2026-07-23.**

The representative apartment passed the planned scenarios:

- baseline M6.1 behavior without constraints;
- hard object locking;
- wall/corner preferences and measured explanations;
- pair near/far preferences with centre-to-centre evidence;
- stale preview clearing when intent changes;
- non-mutating ghost preview;
- explicit Apply;
- one-step multi-object Undo/Redo;
- 2D→3D consistency;
- reload persistence only for applied ordinary transforms;
- no observed M2/M5/M6.1 regression.

Product owner explicitly confirmed:

> «Это работает настолько все гениально и четко как ты сказал, что я в восторге.»

Canonical evidence: `docs/milestones/m6-2-acceptance.md`.

### Roadmap consequence

M6.2 is complete and merged.

The next narrow slice is **M6.3 Exact Spatial Constraints**: add precise millimetre-based hard rules, beginning with a rigorously defined minimum edge-to-edge spacing between selected furniture objects, before attempting natural-language intent interpretation or broader autonomous planning.

---

## 2026-07-22 — M6.1 Deterministic Layout Alternatives accepted and merged

PR #11 squash merge:

```text
f2bbf1c4989ef4582ee86aba19c75a71679034be
```

### Why

After M0–M5 established trusted geometry, fit rules, persistence and spatial understanding, Vlezet still required users to manually discover furniture layouts. M6.1 introduced the first narrow Intelligent Planning capability without weakening the product's source-of-truth model.

Product rule:

> Planning may propose structured alternatives, but ordinary `VlezetDocument` geometry/furniture plus deterministic M2 validation remain authoritative. Preview is ephemeral; only explicit Apply may change the document.

### Delivered

- new framework-independent `@vlezet/planning`;
- one supported deterministic rectangular room;
- rearrangement of 1–3 selected existing objects;
- non-selected objects remain fixed ordinary obstacles;
- footprint-aware deterministic corner/side/center/current anchors;
- stable normalized orientation generation;
- bounded generation with `MAX_PLANNING_EVALUATIONS = 6000`;
- existing M2 `evaluateObjectFits()` used as hard authority;
- invalid containment/collision/door-obstruction candidates rejected;
- deterministic ranking by tight status, recommendations, rotation changes, movement and stable key;
- human-readable deterministic reasons;
- maximum three displayed alternatives;
- non-mutating 2D ghost preview;
- explicit revalidated Apply;
- canonical rotation normalization before persistence;
- one multi-object Apply = one semantic Undo/Redo step.

### TDD / RC findings fixed

1. missing planning request contracts → fail-closed request validation;
2. missing deterministic anchors/evaluation/planner → bounded generator and M2-authoritative ranking;
3. missing revalidated Apply/editor adapter → atomic structured Apply;
4. missing store-level planning command → one-command multi-object Undo/Redo;
5. missing ephemeral planning panel/preview → isolated UI-only planning state and ghost rendering;
6. persisted rotation invariant gap (`450°`) → canonical domain normalization (`90°`) before persistence.

### Verification

Final exact PR head before merge:

```text
acaa352545245ff079f55fb8ce85ba2a23f2312d
GitHub Actions 29953127208 — PASS
```

Passed frozen install, full unit suite, typecheck, lint and production build.

### Manual browser acceptance

**PASS — 2026-07-22.**

The representative apartment passed the planned scenario: room entry point, 1–3 object selection, bounded alternatives, explanations, non-mutating ghost preview, explicit Apply, 2D→3D consistency and one-step Undo/Redo.

Product owner explicitly confirmed:

> «Все работает строго по сценарию.»

Canonical evidence: `docs/milestones/m6-1-acceptance.md`.

### Roadmap consequence

M6.1 is complete and merged. The next slice is **M6.2 Constraint-Aware Planning**: add a deliberately small structured vocabulary of user goals/constraints with deterministic hard/soft semantics and explainable ranking before attempting any broad AI orchestration.

---

## 2026-07-22 — M5.4 Spatial Inspection accepted and merged

PR #10 squash merge:

```text
0bffe36d74d2ff0865d700b51b17ee08e7001094
```

### Why

M5.1 and M5.2 proved that Vlezet could deterministically project the trusted apartment shell and placed furniture into 3D. The remaining gap was usability: the 3D mode could be viewed, but not meaningfully inspected.

Product rule:

> 3D inspection must expose the same trusted semantic apartment data already owned by `VlezetDocument`, geometry and fit engines. Three.js meshes must never become a second source of measurements, collision truth or persistent state.

Architecture:

```text
Three.js ray hit
      ↓
stable semantic entity id / kind
      ↓
ephemeral hover / selection
      ↓
VlezetDocument + SpatialScene + deterministic geometry/fit engines
      ↓
read-only inspector
```

### Delivered

Semantic inspection:

- room floors resolve to stable `roomId`;
- wall meshes resolve to stable `wallId`;
- placed-object meshes resolve to stable `objectId`;
- schematic opening placeholders are intentionally not independent inspection authority;
- nearest inspectable hit skips non-authoritative placeholders;
- stale/unknown metadata fails closed.

Interaction:

- hover previews an inspectable entity;
- click selects persistently;
- empty click clears selection;
- pointer leave clears hover;
- drag-vs-click threshold protects OrbitControls interaction;
- selected entity takes precedence over hover.

Read-only inspector:

- room name, usable area and deterministic clear rectangular dimensions;
- wall centreline length, thickness and rendered split-segment count;
- object dimensions, rotation and projection height semantics;
- existing deterministic M2 fit status/reasons reused directly.

Visual emphasis:

- temporary cloned materials only for matched semantic meshes;
- all rendered segments sharing one `wallId` highlight together;
- unrelated meshes remain untouched;
- base materials are restored when emphasis changes/clears;
- temporary materials are explicitly disposed;
- renderer disposal clears active emphasis first.

Non-negotiable boundaries preserved:

- no document/history/autosave mutation from hover/select;
- no direct 3D editing;
- no mesh-based measurement authority;
- no mesh collision replacing M2 deterministic fit logic;
- no decorative asset pipeline mixed into inspection;
- no M6 planning/AI scope mixed into M5.4.

### TDD / RC findings fixed

Observed RED→GREEN cycles and integration findings:

1. missing pure `spatial-inspection` semantic contract → authoritative resolver implemented;
2. renderer had no semantic emphasis lifecycle → multi-segment emphasis + disposal added;
3. missing read-only `SpatialInspector` → component contract implemented;
4. direct `11.715.toFixed(2)` reproduced `11.71` floating-point display regression → canonical M4.6 square-mm formatter reused, restoring `11.72`;
5. opening placeholders could intercept ray hits → nearest inspectable resolver skips them;
6. React lint rejected synchronous stale-selection state clearing in an effect → changed to derived fail-closed resolution without effect-driven state writes.

### Automated verification

Final exact PR head before merge:

```text
e9980f63d574d1a9cb6614980788270a50cde47e
GitHub Actions 29948749864 — PASS
```

Passed:

- `pnpm install --frozen-lockfile`;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

### Manual browser acceptance

**PASS — 2026-07-22.**

Acceptance was performed on the representative real apartment used for prior spatial milestones. Screenshots confirmed semantic furniture and wall selection with the read-only inspector in the real 3D scene.

Product owner explicitly confirmed:

> «Все работает круто как ты и описал.»

Canonical evidence:

```text
docs/milestones/m5-4-acceptance.md
```

### Roadmap consequence

M5.4 is complete and merged.

The original M5.3 camera/navigation foundation was already delivered inside M5.1. Remaining camera/navigation/performance work is evidence-driven polish only.

Next major product slice:

```text
M6 Intelligent Planning
```

M6 must begin with structured deterministic planning contracts and reuse existing geometry/fit authority rather than starting with photorealistic or free-form AI generation.

---

## 2026-07-22 — M5.2 Furniture in 3D accepted and merged

PR #9 squash merge:

```text
7f7e8dfd9c875145bfa3d307638cd8cd27051a3a
```

### Why

M5.1 proved the deterministic spatial shell/viewer, but the 3D mode still omitted furniture/appliances already present in the trusted 2D document.

Product rule:

> Furniture in 3D must be a projection of the same existing `VlezetDocument.placedObjects`, never a parallel 3D placement model.

Architecture:

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

### Delivered

- added `SpatialScene.objects` and renderer-neutral `SpatialObject`;
- exact document `x/y → scene X/Z` mapping;
- exact width/depth millimetres;
- deterministic `rotationDeg → rotationYRad`;
- stored height remains authoritative when present;
- missing height uses projection-only `DEFAULT_OBJECT_HEIGHT_MM = 700` and is never persisted;
- semantic object ID/name/category preserved;
- invalid/non-finite/out-of-domain geometry fails closed per object;
- Three.js uses deterministic generic box primitives;
- object materials/geometries participate in renderer disposal lifecycle;
- no schema migration, second 3D furniture state, direct 3D editing or mesh-collision authority.

### TDD / RC evidence

RED→GREEN cycles covered:

1. missing neutral `SpatialObject` projection;
2. missing Three.js placed-object mesh;
3. finite dimensions outside persistent domain limits.

An intermediate integration failure exposed stale `SpatialScene` fixtures missing the mandatory `objects` field; fixtures were corrected before proceeding.

### Verification

Final exact accepted PR head:

```text
1b955e01a3092e11427258b563871800cf82206a
GitHub Actions 29940437536 — PASS
```

All required gates PASS.

### Manual browser acceptance

**PASS — 2026-07-22.**

Paired 2D/3D screenshots from the same real project confirmed:

- toolbar showed `3 предметов`;
- all three objects appeared in 3D;
- room placement matched the 2D view;
- one object appeared in the left small room and two in the right small room in both views;
- no visible M5.1 shell regression.

Canonical evidence: `docs/milestones/m5-2-acceptance.md`.

---

## 2026-07-22 — M5.1 Deterministic Spatial 3D Shell accepted and merged

PR #8 squash merge:

```text
4acca82b04c87b3737eb87a03f9ee2ff360b5073
```

### Why

After M4.6 fixed geometry-trust UX, users needed spatial understanding of the **same apartment** without creating a second geometry model or learning a second editor.

Rule:

> 3D is a projection of the same trusted `VlezetDocument`, never a second geometry source or parallel editor.

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

### Delivered

- framework-independent `@vlezet/spatial`;
- document X/Y → scene X/Z, height → Y;
- millimetres remain millimetres;
- deterministic wall prisms with exact thickness;
- projection-only wall height without schema migration;
- wall splitting around existing openings;
- room floors from derived usable polygons;
- schematic semantic door/window placeholders without invented vertical authority;
- fail-closed spatial diagnostics;
- plain Three.js viewer;
- orbit/pan/zoom;
- Perspective / Isometric / Top presets;
- fit camera;
- safe 2D↔3D switching;
- no document/history mutation from view mode;
- WebGL failure isolation and explicit renderer/control/resource cleanup.

### RC issue found before merge

Self-review found a `GridHelper` GPU-resource lifecycle gap.

TDD cycle added disposal regression coverage, a shared disposal helper and viewer cleanup wiring before merge.

### Manual acceptance

**PASS — 2026-07-22.**

Real apartment screenshot confirmed 3D shell, openings, camera presets and 2D/3D switching.

User explicitly confirmed:

> «Все есть»

Canonical checklist: `docs/milestones/m5-acceptance.md`.

---

## 2026-07-22 — GitHub Actions availability restored

During M5.1 development the account exhausted included private-repository GitHub Actions minutes.

Observed state:

```text
2000 / 2000 included Actions minutes used
Actions budget = $0
Stop usage = Yes
```

Decision: make `True-Ruslan/vlezet` public instead of enabling paid overage.

Result: standard GitHub-hosted CI runners became available again and strict verification resumed.

Engineering lesson: avoid unnecessary duplicate workflow runs even when public runners are available; CI concurrency/cancellation remains a useful future optimization.

---

## 2026-07-22 — M4.6 Precision Geometry UX accepted and merged

PR #7 squash merge:

```text
a718bf605d8b3bde8dc87953c340b7b0e9565fdb
```

### Why M4.6 became P0

A real ordinary-user test exposed a geometry-trust problem.

User entered:

```text
3550 × 3300 mm
```

and naturally expected:

```text
3.55 × 3.30 = 11.715 m² → 11.72 m²
```

The editor historically interpreted wall values as **centreline lengths**, while usable room area was correctly derived from **inner wall faces**. The math was internally consistent, but UX semantics were not.

Accepted rule:

> Vlezet must remain simpler than CAD, but simplicity must never hide geometry semantics.

### Delivered

#### Honest wall-length semantics

- `Длина по оси стены`;
- wall resize anchors `Начало / Центр / Конец`;
- opening world positions preserved when wall start moves;
- invalid topology/host cases fail atomically;
- one resize = one semantic history operation.

#### Clear internal room dimensions

First conservative editable scope: deterministic axis-aligned rectangular rooms.

- width/height derived from the same usable inner polygon as area;
- inspector `Чистые внутренние размеры`;
- editable `Ширина` and `Длина`;
- fixed-side/centre anchors;
- canonical wall geometry moves instead of duplicate persistent dimensions;
- unsupported geometry fails closed.

Regression:

```text
clear internal: 3550 × 3300 mm
area:           11.715 m²
UI:             11.72 m²
```

#### Dimension discoverability

- room labels show name + usable area + clear `Ш × Д`;
- selected room inner-face dimension lines;
- selected wall technical centreline dimension;
- `Размеры` toggle;
- derived/non-persistent annotations.

#### Wall thickness alignment

Core contract:

```text
center | left-face | right-face
```

For one unambiguous adjacent room:

```text
Внутрь помещения | По центру | Наружу
```

Ambiguous topology uses explicit left/right-face semantics.

#### Tape tool

- toolbar `Измерить`;
- shortcut `M`;
- snapped two-point measurement;
- direct distance + `ΔX` + `ΔY`;
- ephemeral only.

### Verification

Strict CI PASS and real browser acceptance PASS.

User-confirmed regression:

```text
3550 × 3300 мм
11.72 м²
```

---

## 2026-07-22 — M4.5 Assisted Recognition accepted and merged as MVP

PR #6 squash merge:

```text
b63bdd613db4e13c07d2a961981799bd360f256d
```

### Why

M4 imported/calibrated real source plans, but exact manual tracing remained repetitive.

Recognition was introduced to accelerate tracing without sacrificing trust.

Rule:

> CV/LLM may suggest editable structured geometry; they are never geometry authority.

Pipeline:

```text
reference raster
→ local CV
→ optional cloud vision BYOK
→ reconciliation / semantic sanity
→ RecognitionDraft
→ review/edit
→ explicit Apply
→ ordinary Vlezet geometry
```

### Delivered

- local OpenCV/Web Worker recognition;
- persistent recognition session separate from document;
- review/edit/accept/reject;
- opening reclassification;
- deterministic image→millimetre projection;
- duplicate/conflict protection;
- one Apply batch = one Undo/Redo operation;
- stale reference/calibration/engine protection;
- optional OpenRouter BYOK;
- tolerant candidate parsing/reconciliation;
- safe diagnostics;
- unfinished sessions excluded from backup/duplicate/import.

### Important RC failures found and fixed

- optional recognition restore could block editor startup;
- OpenCV/Emscripten Promise-vs-Module lifecycle mismatch;
- browser build could resolve Node-only dependencies;
- excessive Konva layer use;
- local CV pixel thresholds could return zero candidates;
- hidden cloud-model prerequisite made submit appear active but do nothing;
- native `fetch` binding issue;
- malformed cloud candidate could kill an entire response;
- schema-valid cloud hallucinations could create giant page-frame/orphan geometry.

### Accepted limitation

Recognition is useful but not perfect.

Decision:

- accept as assisted/experimental MVP;
- keep explicit review/apply;
- never weaken deterministic validators for apparent recall;
- tune later against representative fixtures and measurable metrics.

---

## 2026-07-22 — M4 Reference Plan Import merged

PR #5 → `12e9696e11572ad5ec055f3dfad98ad7826184e2`.

### Why

Users needed to work from real developer/contract floor plans rather than redraw everything from scratch.

### Delivered

- local JPG/PNG/PDF import;
- magic-byte/type validation and safe limits;
- local PDF rasterization;
- metric two-point calibration;
- reference alignment/transform;
- separate local raster asset rather than embedding pixels into geometry;
- opacity/lock/position/rotation controls;
- exact tracing over the calibrated reference;
- reference-aware fit-to-plan;
- portable backup/import support;
- clean/source PNG export options.

Architecture rule established:

> Raster/reference data may assist editing, but structured geometry remains the source of truth.

---

## M3 — Local-First Projects merged

PR #4 → `6c32249acc8e333e62fceee2ea4e76ca83890c77`.

Delivered:

- dashboard project CRUD;
- IndexedDB-backed persistence abstraction;
- autosave/retry;
- viewport restore;
- JSON backup/import;
- PNG export;
- local-first editing independent of network latency.

---

## M2 — Furnishing and Fit merged

PR #3 → `aa34f24572f2e67714604634587a1c41e4067cd8`.

Delivered:

- catalogue/custom placed objects;
- exact dimensions, move/resize/rotate;
- snapping/guides;
- SAT-style object collision evaluation;
- room containment;
- door-swing obstruction;
- clearance recommendations;
- directional measurements;
- explainable `fits / tight / blocked` results.

Architecture consequence:

> Deterministic fit/collision/clearance evaluation is product authority and must remain reusable by later 3D and planning layers.

---

## M1 — Apartment Shell merged

PR #2 → `3944c7f9d668a645e1dc05805f476d2f3290eb94`.

Delivered:

- true wall topology with shared vertices;
- connected walls and T-junctions;
- physical wall thickness;
- deterministic planar-face/room derivation;
- usable area from inner wall faces;
- room annotations/names;
- host-wall doors/windows;
- topology/geometry diagnostics.

Architecture consequence:

> Rooms and areas are derived from structured wall geometry; they are not independently persisted drawing artifacts.

---

## M0 — Foundation and Infinite Canvas merged

PR #1 → `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered:

- TypeScript pnpm/Turborepo monorepo;
- package boundaries for domain/geometry/editor-core;
- infinite canvas;
- millimetres as canonical world coordinates;
- pan/zoom/grid;
- wall drawing and exact lengths;
- snapping;
- semantic Undo/Redo;
- reproducible CI.

Foundational rule:

> Pixels are rendering coordinates only; real apartment geometry is stored in millimetres.
