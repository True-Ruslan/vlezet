# Vlezet — Changelog

**Purpose:** preserve development history in a form that explains **when**, **why**, **how** and **what** changed, so a new chat can reconstruct project context without relying on conversation memory.

This is not only a package-release changelog. It also records milestone decisions, product feedback and RC failures that changed architecture or roadmap.

## 2026-07-22 — M4.6 Precision Geometry UX — active Draft PR #7

### Why

A real ordinary-user test exposed a fundamental geometry-trust problem:

```text
entered wall lengths: 3550 mm and 3300 mm
wall thickness: 50 mm
intuitive expected area: ≈ 11.72 m²
old displayed area: ≈ 11.38 m²
```

The old geometry could be technically consistent because the editable wall length was effectively the **wall centreline**, while room area was derived from **inner wall faces**.

The UX failure was that a non-CAD user naturally interpreted `3550 mm` as the clear internal room size.

Product conclusion:

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

No duplicate persisted `internalLength` / `externalLength` fields were introduced.

### M4.6.1 — Honest wall-length semantics

Implemented:

- ambiguous `Точная длина` replaced by explicit `Длина по оси стены`;
- inspector explains that centreline length is not always the clear internal room size;
- explicit fixed anchor:

```text
Начало | Центр | Конец
```

- `Начало` keeps start fixed;
- `Конец` keeps end fixed;
- `Центр` keeps midpoint fixed;
- legacy start-fixed behavior remains the default;
- opening offsets are compensated when the wall start moves, preserving opening world position;
- shrinking through an opening/junction or violating a host-wall constraint fails atomically;
- one resize remains one semantic Undo/Redo operation.

### M4.6.2 — First clear internal room-dimension vertical slice

Implemented for simple axis-aligned rectangular rooms:

- `deriveRectangularRoomDimensions()` derives clear width/height from the same usable inner polygon used for area;
- room inspector exposes `Чистые внутренние размеры`;
- editable `Ширина` and `Длина` in millimetres;
- horizontal anchor:

```text
Левая сторона | Центр | Правая сторона
```

- vertical anchor:

```text
Верхняя сторона | Центр | Нижняя сторона
```

- edits transform canonical walls/vertices rather than storing a duplicate annotation;
- affected opening offsets are compensated to preserve world position;
- the full room-dimension edit is one semantic history command;
- complex/non-rectangular/T-junction rooms fail closed rather than guessing.

Regression example:

```text
centreline rectangle: 3650 × 3400 mm
wall thickness:       100 mm
clear inside:         3550 × 3300 mm
area:                 11.715 m²
```

Thus the clear dimensions and area are derived from the same inner geometry.

### Verification

Latest verified snapshot for this changelog entry:

```text
HEAD: 7a80e1bbc5ab1f8bc0193d489c64033ae7574931
GitHub Actions run: 29914228688
```

- unit tests — PASS;
- TypeScript typecheck — PASS;
- ESLint — PASS;
- production Next build — PASS.

### Next

- browser acceptance of M4.6.1/M4.6.2 on the real apartment workflow;
- wall thickness alignment `inside / centre / outside`;
- dimension lines directly on Canvas;
- tape/measurement tool;
- broaden clear-dimension editing only where semantics remain deterministic.

---

## 2026-07-22 — M4.5 Assisted Recognition accepted as MVP and merged

PR #6 `feat: M4.5 assisted recognition` was squash-merged to `main`:

```text
b63bdd613db4e13c07d2a961981799bd360f256d
```

### Final product feedback

Recognition became noticeably better and useful, but remained imperfect.

Decision:

- accept M4.5 as a working assisted-recognition MVP;
- treat further accuracy work as refinement rather than a roadmap blocker;
- keep the feature explicitly **assisted / experimental**, not automatic reconstruction;
- require broader future testing on representative developer/realtor/BTI plans.

Canonical acceptance:

`docs/milestones/m4-5-mvp-acceptance.md`

### Trust boundary preserved

- recognition creates editable suggestions only;
- `RecognitionDraft` stays separate from `VlezetDocument` until explicit Apply;
- deterministic validation remains authoritative;
- existing geometry is never silently replaced;
- one applied recognition batch = one semantic Undo/Redo operation;
- provider API keys remain runtime-only;
- unfinished recognition sessions do not enter backup/duplicate/import flows.

### Known post-M4.5 quality backlog

- representative real-plan fixture corpus;
- measurable wall/opening/topology quality metrics;
- CV preprocessing/tuning against fixtures;
- better line merging/junction reconstruction;
- cloud model quality/cost ranking;
- stronger semantic validation;
- custom ML only if metrics justify it.

Recognition quality must not consume the M4.6 product cycle.

---

## 2026-07-22 — M4.5 RC hardening history

M4.5 was introduced after M4 made calibrated real-plan import possible but manual tracing remained repetitive.

Approved rule:

> Recognition may propose editable structured geometry, but neither CV nor an LLM is allowed to become the geometry authority.

Architecture:

```text
reference raster
→ local CV first
→ optional cloud vision refinement
→ reconciliation / semantic sanity
→ editable RecognitionDraft
→ user review
→ deterministic apply
→ ordinary Vlezet walls/openings
```

### Major RC defects discovered and fixed

#### Infinite startup loading

**Observed:** `Открываем Vlezet…` could remain forever.

**Cause:** optional recognition restore blocked editor startup.

**Fix:** editor becomes visible first; recognition restore happens afterwards and errors are isolated.

#### OpenCV Promise/Emscripten crash

**Observed:** `Promise.prototype.then called on incompatible receiver [object Module]`.

**Cause:** Emscripten Module was treated as a normal Promise/thenable.

**Fix:** explicit Promise-vs-ready-module handling.

#### Turbopack Node builtin resolution

**Observed:** browser build could not resolve `fs/path/crypto` through OpenCV.

**Fix:** browser-only Next/Turbopack aliases; server runtime unchanged.

#### Too many Konva layers

**Observed:** 6+ physical Layer warning and performance risk.

**Fix:** geometry rendering consolidated to at most 5 physical layers and regression-tested.

#### Local CV returned zero candidates

**Observed:** a real developer plan produced `0 walls / 0 openings`.

**Cause:** first thresholds were too strict and tied to arbitrary pixels.

**Fix:** calibrated `millimetersPerPixel`, scale-aware adaptive fallback and explicit empty-state.

#### AI submit looked active but did nothing

**Cause:** hidden requirement for a selected `modelId`.

**Fix:** one-step key → analyze flow can discover/select a compatible model automatically.

#### Browser fetch `Illegal invocation`

**Cause:** native fetch invoked with incompatible receiver.

**Fix:** safe `globalThis.fetch` wrapper.

#### One malformed cloud candidate killed the full response

**Cause:** all-or-nothing normalization.

**Fix:** tolerant per-candidate parsing; good candidates survive.

#### Schema-valid AI hallucinated a giant frame

**Observed:** model returned page/image bounding-box walls and false openings.

**Cause:** JSON schema validates structure, not architectural plausibility.

**Fix:** prompt hardening + semantic sanity filter + orphan-opening rejection.

### Lesson

Structured output is not the same as trustworthy geometry. Cloud/CV output must remain non-authoritative and pass deterministic semantic boundaries.

---

## 2026-07-22 — Geometry/dimensions UX feedback changes roadmap priority

Detailed feedback established that the next major priority after M4.5 must be precision semantics rather than 3D.

Accepted M4.6 P0 themes:

- internal clear dimension vs wall centreline vs external dimension;
- explicit dimension semantics;
- length-change anchor;
- wall-thickness alignment;
- dimension lines directly on Canvas;
- tape/measurement tool.

High-value follow-ups:

- door/window offsets from corners;
- target room area;
- locked dimensional/area constraints;
- wall-type presets;
- visual wall classes.

Canonical feedback:

`docs/product/2026-07-22-geometry-dimensions-ux-feedback.md`

---

## 2026-07-21 — M4 Reference Plan Import — merged

PR #5  
Merge commit: `12e9696e11572ad5ec055f3dfad98ad7826184e2`

### Why

Users often already have a developer/realtor/BTI plan. Rebuilding it from a blank canvas wastes time and makes exact reproduction harder.

### Delivered

- JPG/PNG/PDF import;
- magic-byte validation;
- PDF page selection/local rasterization;
- safe raster limits/normalization;
- two-point metric calibration;
- horizontal/vertical alignment;
- reference visibility/opacity/lock/position/rotation;
- tracing mode;
- IndexedDB binary asset store;
- independent duplicate assets;
- portable `.vlezet.json` v2 with raster;
- backward import of v1 backups;
- clean PNG and PNG with source.

The source plan remains a separate calibrated asset, not apartment geometry.

---

## 2026-07-21 — M3 Local-First Projects — merged

PR #4  
Merge commit: `6c32249acc8e333e62fceee2ea4e76ca83890c77`

Delivered:

- project dashboard;
- create/open/rename/duplicate/delete;
- `@vlezet/projects`;
- IndexedDB repositories;
- autosave with visible retryable status;
- last-project/viewport restoration;
- JSON backup/import with migrations;
- clean PNG renderer;
- lifecycle/error/accessibility hardening.

---

## 2026-07-21 — M2 Furnishing and Fit — merged

PR #3  
Merge commit: `aa34f24572f2e67714604634587a1c41e4067cd8`

Delivered:

- generic furniture/appliance catalogue;
- custom objects;
- real dimensions/position/rotation/height;
- drag/resize/rotate/duplicate/delete;
- snapping/guides;
- SAT collisions;
- room containment;
- door-swing blocking;
- functional clearance hints;
- directional measurements;
- explainable fit statuses;
- semantic undo/redo.

---

## 2026-07-21 — M1 Apartment Shell — merged

PR #2  
Merge commit: `3944c7f9d668a645e1dc05805f476d2f3290eb94`

Delivered:

- explicit topological wall graph;
- stable wall identity/T-junctions;
- physical wall thickness;
- connected editing/exact lengths;
- derived room detection;
- usable inner polygons/areas;
- room naming;
- doors/windows as host-wall openings;
- wall gaps/door swings/opening constraints;
- visible diagnostics for ambiguous geometry.

---

## 2026-07-21 — M0 Foundation and Infinite Canvas — merged

PR #1  
Merge commit: `099a202413459674d2b50c33d2c1fa125a0fef6f`

Delivered:

- TypeScript/pnpm/Turborepo monorepo;
- Next.js shell;
- domain/geometry/editor-core boundaries;
- schema-versioned millimetre document;
- infinite canvas;
- pointer-centred pan/zoom;
- adaptive grid;
- wall creation/exact length;
- snapping;
- semantic undo/redo;
- tests/frozen installs/CI.

---

## Original product direction — approved 2026-07-21

Core strategic decisions:

- precision before decoration;
- easier than CAD, more trustworthy than decorative planners;
- millimetres and structured domain model as truth;
- useful 2D product before 3D;
- imported/AI-generated results remain editable;
- local-first editing;
- no speculative billing/marketplace/BIM/VR/photorealistic scope early.

Canonical original design:

`docs/superpowers/specs/2026-07-21-vlezet-product-design.md`

## How to maintain this changelog

For every future milestone, major product decision or serious RC incident, record:

1. date/status/PR/merge SHA;
2. why the change was needed;
3. architecture/product decision;
4. what was actually delivered;
5. failures discovered and their root causes;
6. what remains intentionally deferred;
7. verification evidence where relevant.
