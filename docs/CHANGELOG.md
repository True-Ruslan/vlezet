# Vlezet — Changelog

**Purpose:** preserve development history in a form that explains **when**, **why**, **how** and **what** changed, so a new chat can reconstruct project context without relying on conversation memory.

This is not only a package-release changelog. It also records milestone decisions, product feedback and RC failures that changed architecture or roadmap.

## 2026-07-22 — M4.6 Precision Geometry UX accepted and merged

PR #7 squash merge:

```text
a718bf605d8b3bde8dc87953c340b7b0e9565fdb
```

### Why M4.6 became P0

A real ordinary-user test exposed a geometry-trust problem.

The user entered wall lengths:

```text
3550 × 3300 mm
```

and naturally expected clear room dimensions and therefore:

```text
3.55 × 3.30 = 11.715 m² → 11.72 m²
```

The editor historically interpreted those values as **wall centreline lengths**, while useful room area was correctly derived from **inner wall faces**. With wall thickness, the room therefore became smaller than the user's mental model.

The math was internally consistent; the UX semantics were not.

Accepted product rule:

> Vlezet must remain simpler than CAD, but simplicity must never hide geometry semantics.

Roadmap changed from immediate 3D work to:

```text
M4.5 Assisted Recognition
→ M4.6 Precision Geometry UX
→ M5 Spatial 3D
→ M6 Intelligent Planning
```

### Architecture preserved

`VlezetDocument` remains the only persistent geometry source of truth:

```text
vertices + wall centrelines + physical thickness
→ deterministic inner faces / rooms / measurements
→ explicit semantic edit intents
→ updated VlezetDocument
```

No duplicate persistent `internalLength` / `externalLength` values were introduced.

### M4.6.1 — Honest wall-length semantics

Implemented:

- ambiguous `Точная длина` replaced by explicit `Длина по оси стены`;
- wall inspector explains that centreline length is not automatically clear room size;
- resize anchor:

```text
Начало | Центр | Конец
```

- legacy start-fixed behavior remains default;
- centre/end anchoring moves endpoints deterministically;
- opening offsets compensate when wall start moves so opening world position is preserved;
- invalid resize through openings/junction/host-wall constraints fails atomically;
- one wall resize remains one semantic Undo/Redo operation.

### M4.6.2 — Clear internal room dimensions

First conservative editable scope: simple axis-aligned rectangular rooms.

Implemented:

- clear width/height derived from the same usable inner polygon as room area;
- room inspector `Чистые внутренние размеры`;
- editable `Ширина` and `Длина`;
- anchors:

```text
width:  Левая сторона | Центр | Правая сторона
length: Верхняя сторона | Центр | Нижняя сторона
```

- clear-size edits move canonical wall geometry rather than storing duplicate dimensions;
- affected opening world positions are preserved where supported;
- complete edit is one semantic history command;
- complex/non-rectangular/T-junction cases fail closed instead of inventing width/length.

Regression contract:

```text
clear internal: 3550 × 3300 mm
area:           11.715 m²
UI:             11.72 m²
```

A separate trust bug was found during implementation: binary floating-point `toFixed(2)` could display `11.715` as `11.71`. Area display now rounds deterministically from canonical square millimetres.

### M4.6.4 — Dimension discoverability pulled forward

Real browser feedback showed that clear dimensions only in the inspector were not enough. A user could still enter centreline wall values and see a smaller area without understanding why.

Therefore dimension visibility was promoted ahead of the original sequence.

Implemented:

- rectangular room canvas label shows:
  - room name;
  - correctly rounded usable area;
  - `Ш × Д мм внутри`;
- selected rectangular room shows clear dimension lines between inner wall faces;
- selected wall shows a visually distinct technical `... мм по оси` dimension;
- dimension-line offset remains stable in screen pixels across zoom;
- annotations are derived projections only;
- no dimension annotation becomes geometry authority;
- no extra physical Konva Layer was added;
- toolbar `Размеры` toggles dimension-line visibility; default is visible.

### M4.6.3 — Wall thickness alignment

Implemented after dimension meaning became visible.

Core alignment contract:

```text
center | left-face | right-face
```

A face-fixed thickness edit shifts the centreline by half of the thickness delta so the selected physical face remains fixed.

For a wall with exactly one unambiguous adjacent room, UI intent is:

```text
Внутрь помещения | По центру | Наружу
```

For a wall with no single unambiguous room side, such as a partition:

```text
Левая грань | По центру | Правая грань
```

Safety behavior:

- compatible orthogonal/shared topology moves atomically;
- T-junction vertices remain coherent where supported;
- affected connected-wall opening offsets compensate to preserve world position;
- geometry that would skew/tear a connected wall is rejected instead of silently distorted;
- one thickness edit remains one semantic Undo/Redo operation;
- no structural/removability meaning is inferred.

### M4.6.5 — Tape / measurement tool

Implemented first ephemeral slice:

- toolbar `Измерить`;
- keyboard shortcut `M`;
- first click sets start;
- pointer movement previews snapped endpoint;
- second click commits measurement;
- next click starts a new measurement;
- snapping reuses vertices, wall projections and grid;
- shows:
  - direct distance;
  - horizontal `ΔX`;
  - vertical `ΔY`;
- Escape clears current measurement;
- switching to another tool/furniture placement deactivates and clears it;
- middle-button and `Space + drag` panning remain available even after the first measurement point;
- measurement never enters `VlezetDocument`, autosave, backup or semantic history;
- no extra physical Konva Layer was added.

Typical uses:

- corner → door;
- pier width;
- balcony opening offset;
- furniture clearance;
- arbitrary verification.

### M4.6 verification

Code-bearing head:

```text
ead57ae6081e00a6d589633d18d246e92df327de
```

Strict GitHub Actions:

```text
29922108775 — PASS
```

Final PR head including canonical docs:

```text
6dd0d63673d602697a3b17e821be40fc0a9c683d
```

Strict GitHub Actions:

```text
29922436070 — PASS
```

Passed:

- frozen dependency install;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

### Manual browser acceptance

**PASS — 2026-07-22.**

Real browser screenshots confirmed:

```text
Чистые внутренние размеры:
3550 × 3300 мм

Полезная площадь:
11.72 м²
```

Also visually confirmed:

- inner-face dimension lines;
- clear-size inspector values;
- dimension labels;
- tape measurement overlay with diagonal/direct distance and axis deltas;
- behavior matched the announced M4.6 contract.

The user explicitly confirmed that everything works as declared.

### Final decision

PR #7 was moved from Draft to Ready after manual acceptance and then squash-merged to `main`.

Next milestone:

```text
M5 Spatial 3D — fresh design/brainstorming first
```

M5 must remain a projection of the same trusted `VlezetDocument`, never a second geometry source.

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
- scale-aware adaptive fallback;
- persistent recognition session separate from document;
- review overlay;
- endpoint edit;
- accept/reject/bulk confident accept;
- opening reclassification;
- deterministic image→millimetre projection;
- duplicate-existing protection;
- accepted openings can attach to compatible existing walls;
- one applied batch = one Undo/Redo operation;
- stale reference/calibration/engine-version protection;
- OpenRouter BYOK, runtime-only key;
- model discovery;
- tolerant per-candidate structured parsing;
- local/cloud reconciliation;
- semantic sanity filtering;
- safe diagnostics without secrets/base64;
- unfinished sessions excluded from backup/duplicate/import.

### Important RC failures discovered and fixed

- editor startup could freeze while waiting for optional recognition restore;
- OpenCV Emscripten module was incorrectly treated as a normal Promise;
- browser build could resolve Node `fs/path/crypto` through OpenCV/Turbopack;
- excessive physical Konva Layer count;
- local CV could return zero candidates on thick/fragmented plans due pixel-based thresholds;
- AI submit looked active while a hidden model prerequisite blocked it;
- browser native `fetch` could fail with `Illegal invocation`;
- one malformed model candidate could kill the entire response;
- schema-valid cloud hallucinations could create giant page-frame walls/orphan openings.

### Accepted limitation

Real-plan testing showed recognition quality improved and is useful, but is not perfect.

Decision:

- accept as assisted/experimental MVP;
- document quality/noise as backlog;
- never auto-apply;
- do not weaken deterministic validators to improve apparent recall;
- later build a representative plan fixture corpus and measurable recognition metrics.

---

## Historical milestone summary

### M4 — Reference Plan Import

PR #5 → `12e9696e11572ad5ec055f3dfad98ad7826184e2`.

Delivered local JPG/PNG/PDF import, safe validation/rasterization, calibration, reference transform controls, tracing, reference-aware viewport fitting, embedded-reference backup and PNG export options.

### M3 — Local-First Projects

PR #4 → `6c32249acc8e333e62fceee2ea4e76ca83890c77`.

Delivered project dashboard/lifecycle, IndexedDB persistence, autosave/retry, viewport restore, backup/import and clean PNG export.

### M2 — Furnishing and Fit

PR #3 → `aa34f24572f2e67714604634587a1c41e4067cd8`.

Delivered furniture/appliance objects, exact dimensions/transforms, collision/containment/door-swing/clearance evaluation and explainable fit statuses.

### M1 — Apartment Shell

PR #2 → `3944c7f9d668a645e1dc05805f476d2f3290eb94`.

Delivered topological walls/vertices, thickness, T-junctions, deterministic rooms/usable area, room names and host-wall openings.

### M0 — Foundation and Infinite Canvas

PR #1 → `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered TypeScript monorepo boundaries, infinite canvas, mm world coordinates, pan/zoom/grid, wall drawing, snapping, semantic history and reproducible CI.

## Original product direction that remains valid

- precision before decoration;
- easier than professional CAD, but never misleading about geometry;
- millimetre structured truth;
- 2D trust before 3D;
- imported/AI results remain editable;
- local-first core;
- no speculative billing/marketplace/BIM/VR/photorealism before core value is proven.
