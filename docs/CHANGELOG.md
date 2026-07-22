# Vlezet — Changelog

**Purpose:** preserve the development history in a form that explains **when**, **why**, **how** and **what** changed, so a new chat can reconstruct project context without relying on conversation memory.

This is not a package-release changelog only. It also records milestone decisions and important RC failures that changed the architecture.

## 2026-07-22 — M4.5 Assisted Recognition — active RC, not merged

Branch: `feat/m4-5-assisted-recognition`  
PR: #6 `feat: M4.5 assisted recognition`

### Why

M4 made it possible to import and accurately calibrate a real plan, but tracing every wall manually remained repetitive. M4.5 was introduced to accelerate that work without sacrificing Vlezet's core trust model.

The central rule was approved before implementation:

> Recognition may propose editable structured geometry, but neither CV nor an LLM is allowed to become the geometry authority.

### Architecture chosen

Hybrid pipeline:

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

Local CV provides privacy-preserving baseline evidence. AI acts as an optional second expert through a provider abstraction. OpenRouter BYOK is the first provider; a future managed Vlezet provider can implement the same contract.

### Core implementation

- added `@vlezet/recognition`;
- normalized image-space candidate coordinates `[0,1]`;
- recognition sessions stored separately from `VlezetDocument`;
- IndexedDB persistence for drafts;
- Web Worker local analysis with OpenCV.js;
- strict and scale-aware adaptive wall recognition passes;
- conservative opening hypotheses;
- confidence/evidence/diagnostics;
- dedicated review mode and overlay;
- edit/accept/reject/bulk-accept workflow;
- deterministic image→world calibration transform;
- safe duplicate/existing-geometry handling;
- atomic apply with one semantic Undo/Redo entry;
- stale draft handling by reference revision and recognition engine version;
- OpenRouter BYOK with ephemeral API keys;
- compatible vision/structured-output model discovery;
- strict JSON Schema requests;
- local/cloud reconciliation;
- development diagnostics that never log secrets or image base64.

### RC hardening and lessons

#### Startup freeze

**Observed:** `Открываем Vlezet…` forever while Next dev server was already ready.

**Cause:** optional recognition restore was awaited before showing the editor.

**Change:** editor startup no longer depends on recognition storage. Optional subsystems cannot block the core product lifecycle.

#### OpenCV Promise/Emscripten module crash

**Observed:** `Promise.prototype.then called on incompatible receiver [object Module]`.

**Cause:** raw Emscripten module was treated as a Promise/thenable across an async boundary.

**Change:** explicit Promise-vs-ready-module loader handling; regression coverage added.

#### Turbopack Node builtin resolution

**Observed:** production build could not resolve `fs/path/crypto` through OpenCV.

**Cause:** browser package contains Node-capable UMD references.

**Change:** Next 16 browser-only Turbopack aliases; server runtime left untouched.

#### Too many Konva layers

**Observed:** Konva warning about 6+ physical layers and potential performance degradation.

**Change:** geometry-related rendering consolidated; maximum physical Stage layers reduced to 5 and regression-tested.

#### Local CV returned zero candidates

**Observed:** real developer plan produced `0 walls / 0 openings`.

**Cause:** first post-processing thresholds were too strict and tied to arbitrary pixels.

**Change:** calibrated millimetres-per-pixel now reaches the worker; adaptive thresholds derive from physical scale; fallback output stays medium-confidence/reviewable.

#### AI submit looked active but did nothing

**Cause:** UI required a selected `modelId`, but the user-facing button did not communicate that hidden prerequisite.

**Change:** paste-key → `Анализировать` can automatically discover/select a compatible model. Manual selection remains optional.

#### Browser fetch `Illegal invocation`

**Observed:** model discovery succeeded, but chat-completion request failed with `Failed to execute 'fetch' on 'Window': Illegal invocation`.

**Cause:** native `fetch` was stored and invoked with an incompatible receiver.

**Change:** safe `globalThis.fetch` wrapper plus categorized diagnostics.

#### One malformed cloud candidate killed the full response

**Observed:** `Ответ OpenRouter не прошёл проверку геометрического контракта.`

**Cause:** validation was all-or-nothing after schema parsing.

**Change:** tolerant per-candidate normalization. Bad individual walls/openings/labels are dropped with diagnostics; valid candidates survive.

#### Schema-valid AI hallucinated a giant frame

**Observed:** another vision model returned a large rectangle around the plan/empty area and false openings. Structurally valid JSON was semantically wrong.

**Cause:** JSON Schema guarantees shape, not architectural plausibility.

**Change:** semantic cloud sanity layer now:

- compares cloud-only walls with local-CV-confirmed bounds;
- removes long unsupported frame/page/bounding-box-like lines outside the confirmed plan area;
- drops openings hosted by removed/unknown cloud walls;
- records diagnostics;
- prompt explicitly forbids page/crop/image/bounding-box frames as walls.

### Current acceptance state

Automation is green on the current RC, but real-plan acceptance remains the merge gate.

Still to verify manually on the latest RC:

- local recognition quality on the same real plan;
- tolerant behavior of the previously contract-failing model;
- removal of the previously observed giant-frame artifact;
- meaningful reconciliation;
- apply + one-step Undo/Redo + reload;
- no regressions in M0–M4.

---

## 2026-07-21 — M4 Reference Plan Import — merged

PR #5  
Merge commit: `12e9696e11572ad5ec055f3dfad98ad7826184e2`

### Why

Users often already have a developer/realtor/BTI plan. Rebuilding it from a blank canvas wastes time and makes exact reproduction harder.

### How

The imported plan was deliberately implemented as a **separate calibrated project asset**, not apartment geometry.

```text
source JPG/PNG/PDF
→ normalize raster
→ calibrate with known length
→ render below semantic geometry
→ manual tracing creates ordinary Vlezet entities
```

### Delivered

- JPG/PNG/PDF import;
- magic-byte validation;
- PDF page selection and local rasterization;
- safe raster limits/normalization;
- two-point calibration in mm/metres;
- horizontal/vertical alignment;
- reference visibility/opacity/lock/position/rotation;
- tracing mode;
- IndexedDB binary asset store;
- storage migration to v2;
- independent duplicate assets;
- portable `.vlezet.json` v2 with normalized raster;
- backward import of v1 backups;
- clean PNG and PNG with source.

### Deliberately deferred

OCR, automatic recognition, perspective correction, DWG/BIM, cloud processing and multi-floor support were kept out of M4 and moved to later milestones.

---

## 2026-07-21 — M3 Local-First Projects — merged

PR #4  
Merge commit: `6c32249acc8e333e62fceee2ea4e76ca83890c77`

### Why

The editor had become useful, but a useful planning product must survive browser closes/reloads and support multiple independent apartments.

### How

Persistence was isolated behind a framework-independent repository abstraction so IndexedDB is an adapter rather than a React concern.

### Delivered

- project dashboard;
- create/open/rename/duplicate/delete;
- `@vlezet/projects` package;
- IndexedDB repositories;
- autosave with visible status/retry;
- last-project and viewport restoration;
- independent project UI state;
- JSON backup/import with migrations;
- clean PNG renderer;
- lifecycle/error/accessibility hardening.

---

## 2026-07-21 — M2 Furnishing and Fit — merged

PR #3  
Merge commit: `aa34f24572f2e67714604634587a1c41e4067cd8`

### Why

The product promise is not only to draw an apartment but answer the practical question **“Влезет?”** before furniture purchases or renovation decisions.

### How

Furniture is persistent structured geometry with real dimensions. Fit evaluation is deterministic geometry rather than visual guessing.

### Delivered

- generic furniture/appliance catalogue;
- custom objects;
- real width/depth/height/rotation/position;
- drag/resize/rotate/duplicate/delete;
- object/grid/edge/centre snapping;
- SAT collisions;
- room containment;
- door-swing blocking;
- functional clearance hints;
- directional measurements;
- explainable fit statuses and reasons;
- semantic undo/redo for gestures.

---

## 2026-07-21 — M1 Apartment Shell — merged

PR #2  
Merge commit: `3944c7f9d668a645e1dc05805f476d2f3290eb94`

### Why

A trustworthy planner needs real topology and areas, not disconnected decorative lines.

### How

Walls were redesigned around explicit vertices/topological relationships. Rooms became deterministic derived geometry rather than manually maintained polygons.

### Delivered

- explicit topological wall graph;
- stable wall identity and T-junctions;
- physical wall thickness;
- connected editing and exact lengths;
- derived half-edge room detection;
- usable inner polygons and areas;
- room naming metadata;
- doors/windows as host-wall openings;
- wall gaps, door swings and opening constraints;
- visible diagnostics for ambiguous geometry.

---

## 2026-07-21 — M0 Foundation and Infinite Canvas — merged

PR #1  
Merge commit: `099a202413459674d2b50c33d2c1fa125a0fef6f`

### Why

Before adding product features, Vlezet needed a geometry-safe editor foundation that would not later collapse under 3D/import/AI requirements.

### How

The initial architecture separated domain, geometry, editor behavior and visual rendering from day one.

### Delivered

- TypeScript/pnpm/Turborepo monorepo;
- Next.js application shell;
- domain/geometry/editor-core boundaries;
- schema-versioned millimetre document;
- infinite canvas;
- pointer-centred zoom/pan;
- adaptive grid;
- wall creation and exact length;
- deterministic snapping;
- command-oriented undo/redo;
- tests, frozen installs and CI.

---

## Original product direction — approved 2026-07-21

Core strategic decisions:

- precision before decoration;
- easier than CAD, more trustworthy than decorative planners;
- millimetres and structured domain model as truth;
- 2D useful product before 3D;
- imported/AI-generated results remain editable;
- local-first editing;
- no speculative billing/marketplace/BIM/VR/photorealistic scope in early product.

Canonical original design:

`docs/superpowers/specs/2026-07-21-vlezet-product-design.md`

## How to maintain this changelog

For every future milestone or significant RC incident, add:

1. **date/status/PR/merge SHA**;
2. **why** the change existed;
3. **how** the architecture solved it;
4. **what** users gained;
5. any important rejected alternatives or deliberate non-goals;
6. acceptance/verification state;
7. root cause and architectural lesson for serious regressions.

Do not rewrite history to make an RC look cleaner than it was. The failure history is valuable project context.