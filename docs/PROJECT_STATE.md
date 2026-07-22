# Vlezet — Project State

**Last updated:** 2026-07-22  
**Status:** M0–M4.5 are merged to `main`. M4.6 Precision Geometry UX is implemented as an active RC in Draft PR #7 and is waiting for browser acceptance on a real apartment workflow before merge.

> **Read this file first in a new chat.** It is the canonical short-form answer to what Vlezet is, what is stable, what is currently being tested, what is knowingly imperfect, and what should happen next.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners/buyers.

Core promise:

> Draw or import a real apartment, work with understandable real dimensions, place furniture/appliances and understand what fits, what collides and how much usable space remains — without learning professional CAD.

Vlezet is deliberately:

- precision-first;
- geometry-first;
- editable rather than image-based;
- local-first for core editing;
- easier to understand than CAD/BIM;
- explicit about geometry semantics instead of hiding CAD conventions behind a simple-looking UI.

## 2. Non-negotiable architecture rules

1. TypeScript is the primary language.
2. Millimetres are the canonical world unit.
3. Canvas pixels are never persisted as apartment geometry.
4. `domain`, `geometry`, `editor-core` and recognition core remain framework-independent.
5. Konva/Canvas and future Three.js are projections of the domain model, never the source of truth.
6. Rooms/areas are derived from structured geometry.
7. Project formats are schema-versioned and migrated deterministically.
8. Undo/redo is semantic-command oriented.
9. Local editing must not depend on network latency.
10. AI/CV may create only editable suggestions; deterministic geometry validation is authoritative.
11. Existing user geometry must never be silently replaced by recognition/AI.
12. Optional subsystems such as recognition must never block core project startup.
13. Product simplicity must not hide ambiguous geometry semantics from normal users.
14. Derived dimensions/annotations must never become a second persisted geometry source.
15. When geometry meaning is ambiguous, fail closed or ask for an explicit reference side instead of guessing.

## 3. Repository and stack

Repository: `True-Ruslan/vlezet`

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent apartment model and migrations
packages/geometry        framework-independent geometry/math
packages/editor-core     semantic editor operations/history/snapping
packages/projects        local-first project/persistence abstraction
packages/recognition     assisted-recognition model/CV/reconciliation
```

Rendering: Konva / react-konva.  
State: Zustand.  
Persistence: IndexedDB through repository adapters.  
Workspace: pnpm + Turborepo.  
Future 3D direction: Three.js / possibly React Three Fiber using the same `VlezetDocument`.

## 4. Stable `main`

### M0 — Foundation and Infinite Canvas

PR #1 → merge `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered:

- monorepo/package boundaries;
- infinite 2D canvas;
- pan/zoom/adaptive grid;
- millimetre world/screen transforms;
- wall drawing and exact-length editing;
- snapping;
- semantic undo/redo;
- frozen installs and CI.

### M1 — Apartment Shell

PR #2 → merge `3944c7f9d668a645e1dc05805f476d2f3290eb94`.

Delivered:

- topological walls/vertices;
- T-junctions and stable wall identity;
- physical wall thickness;
- deterministic rooms and usable-area calculation from inner wall faces;
- room names;
- doors/windows as host-wall openings;
- visible geometry diagnostics.

### M2 — Furnishing and Fit

PR #3 → merge `aa34f24572f2e67714604634587a1c41e4067cd8`.

Delivered:

- furniture/appliance catalogue and custom objects;
- real dimensions/position/rotation/height;
- drag/resize/rotate/duplicate/delete;
- snapping/guides;
- SAT collisions;
- room containment;
- door-swing blocking;
- functional-clearance hints;
- directional measurements;
- explainable `Влезает / Влезает вплотную / Не влезает` statuses.

### M3 — Local-First Projects

PR #4 → merge `6c32249acc8e333e62fceee2ea4e76ca83890c77`.

Delivered:

- project dashboard;
- create/open/rename/duplicate/delete;
- IndexedDB repository architecture;
- autosave/retry;
- last-project and viewport restore;
- `.vlezet.json` backup/import;
- clean PNG export;
- lifecycle/error/accessibility hardening.

### M4 — Reference Plan Import

PR #5 → merge `12e9696e11572ad5ec055f3dfad98ad7826184e2`.

Delivered:

- JPG/PNG/PDF local import;
- magic-byte validation;
- PDF page selection/local rasterization;
- normalization/size limits;
- two-point metric calibration;
- alignment;
- separate raster asset in IndexedDB;
- visibility/opacity/lock/position/rotation;
- exact manual tracing;
- reference-aware fit-to-plan;
- portable backup with raster;
- clean PNG / PNG with source reference.

### M4.5 — Assisted Recognition

PR #6 → squash merge `b63bdd613db4e13c07d2a961981799bd360f256d`.

**Product status:** accepted working assisted/experimental MVP.

Delivered:

- framework-independent `@vlezet/recognition`;
- local OpenCV/Web Worker recognition;
- persistent `RecognitionDraft` separate from `VlezetDocument`;
- review/edit/accept/reject/bulk accept;
- deterministic image→millimetre apply;
- duplicate-existing protection;
- one applied recognition batch = one Undo/Redo operation;
- stale handling by reference revision/engine version;
- optional OpenRouter BYOK refinement;
- model discovery;
- tolerant per-candidate cloud parsing;
- local/cloud reconciliation and semantic sanity filtering;
- startup isolation from optional recognition restore;
- runtime-only provider secrets;
- unfinished recognition sessions excluded from backup/duplicate/import.

Known limitation intentionally deferred:

- recognition quality is useful but still noisy/inaccurate on some real plans;
- walls/openings/topology may need manual review;
- model quality varies;
- it is **not** automatic floor-plan reconstruction.

Further recognition work must be evidence-driven using representative real-plan fixtures and measurable metrics. Do not weaken deterministic validation just to increase candidate count.

## 5. Active work — M4.6 Precision Geometry UX

Branch:

```text
feat/m4-6-precision-geometry-ux
```

Draft PR:

```text
#7 feat: M4.6 precision geometry UX
```

### Why M4.6 became P0

Real-user feedback exposed a trust problem:

```text
entered wall lengths: 3550 × 3300 mm
wall thickness:        50/150 mm depending scenario
user mental model:     clear room size 3550 × 3300
expected area:         ≈ 11.72 m²
old UI result:         smaller area because lengths were centreline lengths
```

The old geometry could be internally consistent, but the UI made a normal user believe wall length meant clear room size.

Product conclusion:

> Before 3D, Vlezet must make dimensions and area semantics obvious enough that a non-CAD user can trust every number.

### M4.6 architecture

Persistent authority remains:

```text
VlezetDocument
vertices + wall centrelines + wall thickness
        ↓
deterministic inner-face geometry
        ↓
rooms + usable area + derived clear dimensions
        ↓
semantic edit intents
        ↓
updated VlezetDocument
```

Do **not** persist duplicate `internalLength`/`externalLength` values.

## 6. Implemented M4.6 slices

### M4.6.1 — Honest wall length semantics and anchors

Implemented:

- ambiguous `Точная длина` replaced by `Длина по оси стены`;
- explanatory copy that centreline length is not automatically clear room size;
- resize anchor `Начало / Центр / Конец`;
- legacy start-fixed behavior remains default;
- opening offsets compensate when the wall start moves so openings preserve world position;
- invalid resize through openings/junction/host constraints fails atomically;
- one resize = one semantic Undo/Redo operation.

### M4.6.2 — Clear internal room dimensions

First conservative editable scope: simple axis-aligned rectangular rooms.

Implemented:

- clear width/height derived from the same usable inner polygon as room area;
- room inspector section `Чистые внутренние размеры`;
- editable `Ширина` / `Длина`;
- fixed-side anchors:
  - width: `Левая сторона / Центр / Правая сторона`;
  - length: `Верхняя сторона / Центр / Нижняя сторона`;
- editing changes canonical wall geometry, not duplicate stored dimensions;
- openings preserve world positions where affected geometry moves;
- complete clear-dimension edit is one semantic history command;
- complex/non-rectangular/T-junction cases fail closed rather than guessing.

Regression contract:

```text
centreline rectangle: 3650 × 3400 mm
walls:                100 mm
clear internal:       3550 × 3300 mm
area:                 11.715 m²
UI decimal rounding:  11.72 m²
```

Area display is rounded deterministically from canonical square millimetres, avoiding binary floating-point `toFixed` surprises such as `11.715 → 11.71`.

### M4.6.3 — Wall thickness alignment

Implemented:

- core alignment contract:
  - `center`;
  - `left-face`;
  - `right-face`;
- face-fixed edits shift the centreline by half of the thickness delta;
- compatible orthogonal/shared topology moves atomically;
- openings on affected connected walls compensate offsets to preserve world position;
- incompatible geometry that would skew/tear a connected wall is rejected atomically;
- one thickness edit remains one semantic Undo/Redo operation.

UX semantics:

When exactly one adjacent room makes inside/outside unambiguous:

```text
Внутрь помещения | По центру | Наружу
```

When the wall has no single unambiguous room side (for example a partition between rooms):

```text
Левая грань | По центру | Правая грань
```

Vlezet never guesses structural/removability meaning.

### M4.6.4 — Dimension lines and honest canvas labels

Implemented:

- rectangular room canvas labels include:
  - room name;
  - correctly rounded usable area;
  - `Ш × Д мм внутри`;
- selecting a supported rectangular room shows two clear dimension lines based on inner faces;
- selecting a wall shows a distinct technical `... мм по оси` dimension;
- dimension-line visual offset is stable in screen pixels across zoom;
- dimension annotations are derived projections only;
- no new physical Konva Layer was introduced;
- toolbar `Размеры` toggles dimension-line visibility; default is visible.

Important real-user consequence:

If a user draws centreline walls `3550 × 3300` with 150 mm walls, the canvas now makes the actual clear result visible instead of silently implying those are room dimensions. The user can then select the room and set the desired clear `3550 × 3300`, after which area becomes approximately `11.72 m²`.

### M4.6.5 — Tape / measurement tool

Implemented first ephemeral slice:

- toolbar `Измерить` tool;
- first click = start;
- pointer movement = snapped preview;
- second click = completed measurement;
- next click starts a new measurement;
- snapping reuses vertices, wall projections and grid;
- direct distance;
- `ΔX` horizontal delta;
- `ΔY` vertical delta;
- Escape clears current measurement;
- switching to another editor tool/furniture placement deactivates and clears it;
- middle-button panning is not intercepted;
- measurement is not persisted and does not enter history/autosave/backup;
- interaction is implemented without adding a new physical Konva Layer.

## 7. Automated verification status

Last code-bearing head before this documentation update:

```text
fcb4e1b306cd59244ababe73da40a664de3361b3
```

GitHub Actions run:

```text
29921081469 — PASS
```

Passed:

- frozen install;
- unit tests;
- TypeScript typecheck;
- ESLint;
- production Next build.

Documentation-only commits may move the live PR head afterwards. Always verify the exact final PR head before merge.

## 8. M4.6 limitations / deliberate conservative boundaries

Not yet generalized:

- editable clear room width/height beyond simple deterministic axis-aligned rectangles;
- arbitrary parametric constraints/locked dimensions;
- target-area solver;
- rich permanent dimension objects;
- advanced opening offset workflows from arbitrary reference corners;
- structural/removability classification without authoritative source data.

Face-fixed thickness edits intentionally reject geometry that cannot be moved without skewing/tearing connected topology. This is safer than silently distorting the plan.

## 9. Remaining M4.6 merge gate

Automated correctness is green, but browser interaction/visual acceptance is still required.

Manual acceptance must cover at least:

1. draw a simple rectangular room using wall centreline lengths;
2. confirm canvas label clearly distinguishes actual clear dimensions and area;
3. select room and confirm clear inner dimension lines;
4. edit clear room size to `3550 × 3300` and confirm area ≈ `11.72 m²`;
5. verify room clear-size anchors (`left/center/right`, `top/center/bottom`);
6. select a wall and confirm dimension is explicitly `... мм по оси`;
7. toggle `Размеры` off/on;
8. change wall thickness using `Внутрь / По центру / Наружу` on an unambiguous boundary wall;
9. verify ambiguous walls use explicit physical face choices instead of guessed inside/outside;
10. verify Undo/Redo for clear-size/thickness edits;
11. use `Измерить` for corner→wall/opening/arbitrary points and verify direct/ΔX/ΔY values;
12. verify Escape clears measurement and tool switching deactivates it;
13. verify zoom and middle-button pan do not change measured values;
14. smoke-test M0–M4.5 workflows for regression;
15. verify exact merge head passes strict CI.

Do **not** claim browser acceptance from CI alone.

## 10. Immediate roadmap

```text
M0–M4.5               ✅ merged
M4.6 implementation   ✅ P0 slices implemented in Draft PR #7
M4.6 automated gate   ✅ green
M4.6 browser acceptance  ← NOW
        ↓
PR #7 Ready for Review
        ↓
exact-head strict CI
        ↓
squash merge M4.6 → main
        ↓
update final merge SHA in docs
        ↓
M5 Spatial 3D design/implementation
        ↓
M6 Intelligent Planning
```

Do not start M5 before M4.6 browser acceptance/merge. 3D must project the same trusted `VlezetDocument`; it must not become a second geometry editor/source of truth.

## 11. Deferred / later

- recognition quality benchmark corpus and evidence-driven tuning;
- opening precision/reference-corner workflows;
- target room area;
- locked dimensional/area constraints;
- wall type presets / richer visual classes;
- accounts/auth/cloud sync/sharing/collaboration;
- managed AI backend/billing;
- mobile-first editor;
- multi-floor;
- curved walls;
- DWG/DXF/BIM;
- photorealism/VR;
- AI layout generation before deterministic constraints are mature.
