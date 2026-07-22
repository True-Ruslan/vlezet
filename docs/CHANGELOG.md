# Vlezet — Changelog

**Purpose:** preserve development history in a form that explains **when**, **why**, **how** and **what** changed, so a new chat can reconstruct project context without relying on conversation memory.

This is not only a package-release changelog. It also records milestone decisions, product feedback and RC failures that changed architecture or roadmap.

## 2026-07-22 — Geometry/dimensions UX feedback changes roadmap priority

### Context

A detailed ordinary-user review exposed a fundamental trust problem in the current exact-wall workflow.

Observed real case:

```text
entered wall lengths: 3550 mm and 3300 mm
wall thickness: 50 mm
intuitive expected area: ≈ 11.72 m²
shown area: ≈ 11.38 m²
```

The geometry may be technically consistent because the editable wall length is effectively based around the **wall centreline**, while room area is calculated from **inner wall faces**.

The UX problem is that a non-CAD user naturally interprets `3550 mm` as the **clear internal room size**.

The interface currently does not explain:

- whether a dimension means internal size, centreline or external size;
- which endpoint moves when length changes;
- where added wall thickness grows;
- how these choices affect room area.

### Product conclusion

This is considered more important than starting 3D.

The roadmap was changed from:

```text
M4.5 → M5 3D → M6
```

to:

```text
M4.5 Assisted Recognition
→ M4.6 Precision Geometry UX
→ M5 Spatial 3D
→ M6 Intelligent Planning
```

### Accepted M4.6 P0 themes

- internal clear dimension vs wall centreline vs external dimension;
- explicit dimension mode/semantics;
- length-change anchor: start / centre / end;
- wall-thickness alignment: inside / centre / outside;
- dimension lines directly on canvas;
- tape/measurement tool.

High-value follow-ups:

- door/window offsets from corners;
- target room area;
- locked dimensional/area constraints;
- wall-type presets;
- visual wall classes.

Canonical feedback document:

`docs/product/2026-07-22-geometry-dimensions-ux-feedback.md`

### Important product lesson

Vlezet should remain simpler than CAD, but **simplicity must not hide geometry semantics**.

A user should never have to discover through area mismatch that `3550 mm` meant something different from what they thought.

---

## 2026-07-22 — M4.5 recognition quality recorded as known limitation

Latest real-plan testing after several RC hardening cycles still shows recognition output that is noticeably inaccurate/noisy.

Observed:

- misplaced/incomplete wall candidates;
- false/noisy openings;
- unreliable topology;
- large quality differences between cloud models;
- substantial manual review still required.

### Decision

Recognition quality is now explicitly recorded as a **known bug/quality limitation**, not a requirement to keep the whole roadmap blocked indefinitely.

M4.5 remains an **assisted/experimental** feature:

- suggestions only;
- explicit review;
- explicit apply;
- deterministic validation;
- one-step Undo/Redo;
- no automatic replacement of apartment geometry.

M4.5 may merge once safety/lifecycle behaviour is accepted even if recognition remains imperfect.

Future accuracy work should use:

1. representative real-plan fixtures;
2. measurable quality metrics;
3. CV tuning against fixtures;
4. better line/junction reconstruction;
5. model-quality ranking;
6. stronger semantic validation;
7. only then advanced/custom ML if justified.

---

## 2026-07-22 — M4.5 Assisted Recognition — active RC, not merged

Branch: `feat/m4-5-assisted-recognition`  
PR: #6 `feat: M4.5 assisted recognition`

### Why

M4 made it possible to import and accurately calibrate a real plan, but tracing every wall manually remained repetitive.

M4.5 was introduced to accelerate tracing without sacrificing Vlezet's trust model.

Approved central rule:

> Recognition may propose editable structured geometry, but neither CV nor an LLM is allowed to become the geometry authority.

### Architecture

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

Local CV is the privacy-preserving baseline. OpenRouter BYOK is the first optional cloud provider behind a provider abstraction.

### Core implementation

- `@vlezet/recognition` package;
- normalized image-space candidates `[0,1]`;
- recognition sessions outside `VlezetDocument`;
- IndexedDB draft persistence;
- OpenCV.js Web Worker analysis;
- strict + scale-aware adaptive wall passes;
- conservative opening hypotheses;
- confidence/evidence/diagnostics;
- dedicated review mode;
- edit/accept/reject/bulk accept;
- deterministic image→world calibration transform;
- duplicate-existing geometry protection;
- existing walls can host recognized openings;
- one recognition apply batch = one semantic history operation;
- stale handling by reference revision and engine version;
- OpenRouter BYOK with ephemeral keys;
- compatible vision/structured-output model discovery;
- structured JSON-schema requests;
- tolerant per-candidate cloud parsing;
- local/cloud reconciliation;
- semantic cloud sanity filtering;
- safe dev diagnostics without secrets or image base64.

### RC hardening history

#### Infinite startup loading

**Observed:** `Открываем Vlezet…` forever while Next was already ready.

**Cause:** optional recognition restore blocked editor startup.

**Fix:** editor becomes visible first; recognition restore happens afterwards and errors are isolated.

#### OpenCV Promise/Emscripten crash

**Observed:** `Promise.prototype.then called on incompatible receiver [object Module]`.

**Cause:** Emscripten Module was treated as a Promise/thenable.

**Fix:** explicit Promise-vs-ready-module handling.

#### Turbopack Node builtin resolution

**Observed:** browser build could not resolve `fs/path/crypto` through OpenCV.

**Fix:** browser-only Next/Turbopack aliases; server runtime unchanged.

#### Too many Konva layers

**Observed:** 6+ physical layers warning and performance risk.

**Fix:** geometry rendering consolidated to at most 5 physical layers and regression-tested.

#### Local CV returned zero candidates

**Observed:** real developer plan produced `0 walls / 0 openings`.

**Cause:** first thresholds were too strict and tied to arbitrary pixels.

**Fix:** calibrated `millimetersPerPixel`, scale-aware adaptive fallback and explicit empty-state.

#### AI submit looked active but did nothing

**Cause:** hidden requirement for a selected `modelId`.

**Fix:** one-step key → analyze flow can discover/select a compatible model automatically.

#### Browser fetch `Illegal invocation`

**Observed:** model discovery succeeded, but chat request failed.

**Cause:** native fetch invoked with incompatible receiver.

**Fix:** safe `globalThis.fetch` wrapper and categorized diagnostics.

#### One malformed cloud candidate killed the full response

**Observed:** `Ответ OpenRouter не прошёл проверку геометрического контракта.`

**Cause:** all-or-nothing normalization.

**Fix:** tolerant per-candidate parsing; good candidates survive.

#### Schema-valid AI hallucinated a giant frame

**Observed:** model returned a large rectangle around plan/empty image area and false openings.

**Cause:** JSON schema validates structure, not architectural plausibility.

**Fix:** prompt hardening + semantic sanity filter + orphan-opening rejection.

### Current M4.5 merge philosophy

Recognition accuracy is no longer expected to be production-perfect before merge.

Required before merge:

- startup/reload stable;
- no project corruption on CV/cloud failures;
- review-only until explicit apply;
- edit/accept/reject usable;
- apply creates normal geometry;
- one-step Undo/Redo works;
- current-version draft reload works;
- M0–M4 regression smoke passes;
- exact merge head has green strict CI.

Recognition noise remains a known post-merge quality bug.

---

## 2026-07-21 — M4 Reference Plan Import — merged

PR #5  
Merge commit: `12e9696e11572ad5ec055f3dfad98ad7826184e2`

### Why

Users often already have a developer/realtor/BTI plan. Rebuilding it from a blank canvas wastes time and makes exact reproduction harder.

### Architecture

The source plan is a **separate calibrated project asset**, not apartment geometry.

```text
JPG/PNG/PDF
→ normalize raster
→ calibrate with known length
→ render below semantic geometry
→ tracing creates ordinary Vlezet entities
```

### Delivered

- JPG/PNG/PDF import;
- magic-byte validation;
- PDF page selection/local rasterization;
- safe raster limits/normalization;
- two-point mm/metre calibration;
- horizontal/vertical alignment;
- reference visibility/opacity/lock/position/rotation;
- tracing mode;
- IndexedDB binary asset store;
- independent duplicate assets;
- portable `.vlezet.json` v2 with raster;
- backward import of v1 backups;
- clean PNG and PNG with source.

Deferred: OCR, automatic recognition, perspective correction, DWG/BIM, cloud processing and multi-floor support.

---

## 2026-07-21 — M3 Local-First Projects — merged

PR #4  
Merge commit: `6c32249acc8e333e62fceee2ea4e76ca83890c77`

### Why

A useful planner must survive reload/browser close and support multiple independent apartments.

### Delivered

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

### Why

The product promise is not only to draw an apartment but answer **«Влезет?»** before furniture purchases/renovation decisions.

### Delivered

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

### Why

A trustworthy planner needs real topology and areas, not disconnected decorative lines.

### Delivered

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

### Why

Before product features, Vlezet needed a geometry-safe editor foundation that would survive import, 3D and AI expansion.

### Delivered

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
2. why the change existed;
3. architecture/UX decision;
4. what users gained;
5. rejected alternatives/non-goals where important;
6. acceptance/verification state;
7. root cause and lesson for serious regressions.

Do not rewrite history to make an RC look cleaner than it was. Failure history is useful project context.