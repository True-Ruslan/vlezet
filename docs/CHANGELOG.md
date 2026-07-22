# Vlezet — Changelog

**Purpose:** preserve development history in a form that explains **when**, **why**, **how** and **what** changed, so a new chat can reconstruct project context without relying on conversation memory.

This is not only a package-release changelog. It also records milestone decisions, product feedback and RC failures that changed architecture or roadmap.

## 2026-07-22 — M4.6 Precision Geometry UX reaches implementation RC in PR #7

### Why M4.6 became the immediate priority

A real ordinary-user test exposed a fundamental geometry-trust problem.

The user entered wall lengths such as:

```text
3550 × 3300 mm
```

and naturally expected these to describe the **clear room dimensions**, therefore expecting approximately:

```text
3.55 × 3.30 = 11.715 m² → 11.72 m²
```

The existing editor actually treated the values as **wall centreline lengths**, while room area was derived from **inner wall faces**. With wall thickness, the usable room became smaller.

The old math could be internally consistent, but the product mental model was not.

Accepted conclusion:

> Vlezet must remain simpler than CAD, but simplicity must not hide geometry semantics.

Roadmap changed to:

```text
M4.5 Assisted Recognition — MVP
→ M4.6 Precision Geometry UX
→ M5 Spatial 3D
→ M6 Intelligent Planning
```

### Architecture decision

`VlezetDocument` remains the only geometry source of truth:

```text
vertices + wall centrelines + physical thickness
→ deterministic inner faces / rooms / measurements
→ explicit semantic edit intents
→ updated VlezetDocument
```

No duplicate persistent `internalLength` / `externalLength` fields were introduced.

### M4.6.1 — Honest wall-length semantics

Implemented:

- ambiguous `Точная длина` replaced by explicit `Длина по оси стены`;
- inspector explicitly explains that centreline length is not automatically clear room size;
- wall-length anchor:

```text
Начало | Центр | Конец
```

- legacy start-fixed behavior remains default;
- centre/end anchoring moves endpoints deterministically;
- opening offsets compensate when the wall start moves so opening world position is preserved;
- invalid resize through openings/junction/host-wall constraints fails atomically;
- one wall resize remains one semantic Undo/Redo operation.

### M4.6.2 — Clear internal room dimensions

First conservative editable scope: simple axis-aligned rectangular rooms.

Implemented:

- clear width/height derived from the same usable inner polygon as room area;
- room inspector `Чистые внутренние размеры`;
- editable `Ширина` and `Длина`;
- fixed-side anchors:

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
centreline rectangle: 3650 × 3400 mm
wall thickness:        100 mm
clear internal:        3550 × 3300 mm
area:                  11.715 m²
UI:                    11.72 m²
```

A separate trust bug was found while implementing this: binary floating-point `toFixed(2)` could display `11.715` as `11.71`. Area display is now rounded deterministically from canonical square millimetres.

### M4.6.4 — Dimension discoverability was pulled forward by user feedback

The real screenshot showed that implementing clear dimensions only in the inspector was insufficient: a user could still draw `3550 × 3300` as wall lengths and see a smaller area without immediately understanding why.

Therefore dimension visibility was moved ahead of the originally planned order.

Implemented:

- room canvas labels show, for deterministic rectangles:
  - room name;
  - correctly rounded usable area;
  - `Ш × Д мм внутри`;
- selected rectangular room shows two dimension lines measured between inner wall faces;
- selected wall shows a visually distinct technical dimension `... мм по оси`;
- dimension-line offset stays visually stable in screen pixels while zoom changes;
- annotations are derived every render/state update;
- no dimension annotation becomes geometry authority;
- no extra physical Konva Layer was added;
- toolbar `Размеры` toggle shows/hides dimension lines; default is visible.

Resulting user mental model:

```text
entered as wall centrelines: 3550 × 3300
canvas immediately shows actual clear room size + area
→ select room
→ enter desired clear 3550 × 3300
→ Vlezet updates canonical geometry
→ displayed usable area ≈ 11.72 m²
```

### M4.6.3 — Wall thickness alignment

Implemented after the dimension meaning became visible.

Core alignment contract:

```text
center | left-face | right-face
```

A face-fixed thickness edit shifts the centreline by half of the thickness delta so the selected physical face remains fixed.

For a wall with exactly one unambiguous adjacent room, the UI exposes user-oriented intent:

```text
Внутрь помещения | По центру | Наружу
```

For a wall with no single unambiguous room side, such as a partition between two rooms:

```text
Левая грань | По центру | Правая грань
```

Implemented safety behavior:

- compatible orthogonal/shared topology moves atomically;
- T-junction vertices remain coherent where supported;
- affected connected-wall opening offsets compensate to preserve world position;
- geometry that would skew/tear a connected wall is rejected instead of silently distorted;
- one thickness edit remains one semantic Undo/Redo operation;
- no structural/removability meaning is inferred.

### M4.6.5 — Tape / measurement tool

Implemented first ephemeral slice:

- toolbar `Измерить`;
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
- switching to another editor tool/furniture placement deactivates and clears it;
- middle-button panning remains available;
- measurement never enters `VlezetDocument`, autosave, backup or semantic history;
- no extra physical Konva Layer was added.

Typical supported uses:

- corner → door;
- pier width;
- balcony opening offset;
- furniture clearance;
- arbitrary verification.

### M4.6 automated verification

Last code-bearing head before canonical documentation synchronization:

```text
fcb4e1b306cd59244ababe73da40a664de3361b3
```

Strict GitHub Actions run:

```text
29921081469 — PASS
```

Passed:

- frozen dependency install;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

M4.6 remains Draft until browser/manual visual acceptance on a real apartment workflow. CI is not browser acceptance.

### Known M4.6 conservative boundaries

- clear width/height editing is intentionally limited to deterministic simple axis-aligned rectangles;
- complex room dimensions are not guessed;
- face-fixed thickness edits reject incompatible geometry rather than skewing topology;
- permanent associative CAD dimension objects are not introduced;
- full parametric constraints/target-area solver are deferred;
- advanced opening offsets from arbitrary reference corners are a follow-up.

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
