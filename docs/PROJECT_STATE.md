# Vlezet — Project State

**Last updated:** 2026-07-22  
**Status:** M0–M4.6 are merged to `main`. M4.6 Precision Geometry UX passed strict CI and real browser acceptance. The next major milestone is M5 Spatial 3D design/implementation.

> **Read this file first in a new chat.** It is the canonical short-form answer to what Vlezet is, what is stable, what was just completed, what remains intentionally limited, and what should happen next.

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
16. Future 3D must project the same `VlezetDocument`; it must not introduce a second geometry source/editor.

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

## 4. Stable milestones in `main`

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

### M4.6 — Precision Geometry UX

PR #7 → squash merge `a718bf605d8b3bde8dc87953c340b7b0e9565fdb`.

**Product status:** accepted and merged after automated and real browser verification.

Why it existed:

A real ordinary-user test exposed a trust problem:

```text
entered wall lengths: 3550 × 3300 mm
user mental model:     clear room size 3550 × 3300
expected area:         ≈ 11.72 m²
old UI result:         smaller area because entered values were centreline lengths
```

The old geometry was internally consistent, but the product mental model was not.

M4.6 fixed this without introducing duplicate persistent dimensions.

Architecture remains:

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

#### M4.6.1 — Honest wall-length semantics

Implemented:

- `Длина по оси стены` instead of ambiguous `Точная длина`;
- explicit explanation that centreline length is not automatically clear room size;
- resize anchors `Начало / Центр / Конец`;
- opening world-position preservation when wall start moves;
- invalid opening/junction/host cases fail atomically;
- one resize = one semantic Undo/Redo operation.

#### M4.6.2 — Clear internal room dimensions

For simple deterministic axis-aligned rectangular rooms:

- clear width/height derived from the same inner polygon as usable area;
- inspector `Чистые внутренние размеры`;
- editable `Ширина` and `Длина`;
- fixed-side/centre anchors;
- canonical wall geometry changes rather than duplicate stored dimensions;
- unsupported complex geometry fails closed instead of guessing.

Verified regression:

```text
clear internal: 3550 × 3300 mm
area:           11.715 m²
UI:             11.72 m²
```

Area display is rounded deterministically from canonical square millimetres, avoiding floating-point `11.715 → 11.71` surprises.

#### M4.6.3 — Wall thickness alignment

Core contract:

```text
center | left-face | right-face
```

For one unambiguous adjacent room the UI shows:

```text
Внутрь помещения | По центру | Наружу
```

For ambiguous walls/partitions:

```text
Левая грань | По центру | Правая грань
```

Implemented:

- deterministic fixed-face behavior;
- centreline shift by half thickness delta;
- compatible connected topology moves atomically;
- affected opening offsets preserve world position;
- incompatible geometry rejects rather than silently distorts;
- no structural/removability meaning is inferred.

#### M4.6.4 — Dimension lines and honest canvas labels

Implemented:

- rectangular room labels show name + usable area + `Ш × Д мм внутри`;
- selected room shows clear inner-face dimensions;
- selected wall shows distinct `... мм по оси` dimension;
- screen-space annotation offset remains readable across zoom;
- `Размеры` toolbar visibility toggle;
- annotations remain derived projections only;
- no extra physical Konva Layer or persisted dimension objects.

#### M4.6.5 — Tape / measurement tool

Implemented:

- toolbar `Измерить` and shortcut `M`;
- two-click measurement with snapped preview;
- snapping to vertices, wall projections and grid;
- direct distance + `ΔX` + `ΔY`;
- Escape clears;
- switching tools/furniture clears/deactivates;
- middle-button and `Space + drag` pan remain usable even after the first point;
- measurement never enters `VlezetDocument`, autosave, backup or semantic history;
- no extra physical Konva Layer.

## 5. M4.6 acceptance evidence

### Automated

Verified code-bearing head:

```text
ead57ae6081e00a6d589633d18d246e92df327de
```

Run:

```text
29922108775 — PASS
```

Exact PR head including canonical docs:

```text
6dd0d63673d602697a3b17e821be40fc0a9c683d
```

Run:

```text
29922436070 — PASS
```

Both passed:

- frozen install;
- unit tests;
- typecheck;
- lint;
- production build.

### Manual browser acceptance

**PASS — 2026-07-22.**

Real browser screenshots and user confirmation verified:

- room clear dimensions `3550 × 3300 мм`;
- usable area displays `11.72 м²`;
- clear inner dimension lines display correctly;
- room inspector shows and edits clear dimensions;
- tape measurement renders direct/axis measurements correctly;
- overall behavior matched the declared M4.6 acceptance expectations.

User explicitly confirmed: all tested behavior works as declared.

## 6. Current known limitations / technical debt

### Recognition

- M4.5 recognition remains assisted/experimental, not authoritative reconstruction;
- quality varies by real-plan style and model;
- future tuning needs representative fixtures and measurable metrics.

### Precision geometry

Not yet generalized:

- editable clear width/height beyond simple deterministic axis-aligned rectangles;
- arbitrary parametric constraints/locked dimensions;
- target-area solver;
- permanent associative CAD-like dimension objects;
- advanced opening offsets from arbitrary reference corners;
- structural/removability classification without authoritative data.

Face-fixed thickness edits intentionally reject geometry that cannot be moved without skewing/tearing connected topology.

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
M0–M4.6               ✅ merged and accepted
        ↓
M5 Spatial 3D design  ← NOW
        ↓
M5 deterministic implementation
        ↓
M5 browser acceptance
        ↓
M6 Intelligent Planning
```

### Next optimal step

Start **fresh M5 Spatial 3D design/brainstorming** before implementation.

M5 must obey:

> 3D is a projection of the same trusted `VlezetDocument`, not a separate editor or geometry source.

First planned scope:

1. deterministic 3D shell from existing wall/room/opening geometry;
2. same furniture dimensions/rotation in 3D;
3. orbit/pan/zoom and useful camera presets;
4. 2D↔3D switching without state loss or document mutation;
5. spatial inspection using existing deterministic dimensions/fit state.

M5 non-goals for the first milestone:

- photorealism;
- ray tracing;
- generative interior images as geometry authority;
- separate 3D editing model;
- VR;
- BIM.

## 8. Workflow rules

For every major milestone:

```text
brainstorm/design
→ approved spec
→ implementation plan
→ TDD slices
→ Draft PR
→ strict CI
→ real browser/manual acceptance
→ Ready for Review
→ exact-head verification
→ squash merge
→ canonical docs update
```

Never claim browser acceptance from CI alone.
