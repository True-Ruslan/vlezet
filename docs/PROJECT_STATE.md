# Vlezet — Project State

**Last updated:** 2026-07-22  
**Status:** M0–M4 merged to `main`; M4.5 Assisted Recognition is an active Draft PR #6; the next product priority after stabilizing M4.5 is **M4.6 Precision Geometry UX**, before 3D.

> **Read this file first in a new chat.** It is the canonical short-form answer to: what is Vlezet, what is already done, what is currently being tested, what is known to be imperfect, and what should be developed next?

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners/buyers.

Core promise:

> Draw or import a real apartment, work with real dimensions, place furniture/appliances and understand what fits, what collides and how much usable space remains — without learning professional CAD.

The product is deliberately:

- precision-first;
- geometry-first;
- editable rather than image-based;
- local-first for core editing;
- easier to understand than CAD/BIM.

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
Future 3D direction: Three.js / possibly React Three Fiber using the same domain model.

## 4. Stable `main`

`main` currently contains **M0 through M4**.

Current M4 merge commit:

```text
12e9696e11572ad5ec055f3dfad98ad7826184e2
```

### M0 — Foundation and Infinite Canvas

PR #1 → merge `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered:

- TypeScript monorepo/package boundaries;
- infinite 2D canvas;
- pan/zoom/adaptive grid;
- millimetre world/screen transforms;
- wall drawing and exact-length editing;
- snapping;
- semantic undo/redo;
- reproducible frozen installs and CI.

### M1 — Apartment Shell

PR #2 → merge `3944c7f9d668a645e1dc05805f476d2f3290eb94`.

Delivered:

- topological walls with explicit vertices;
- T-junctions and stable wall identity;
- physical wall thickness;
- deterministic room detection;
- usable-area calculation from inner wall faces;
- room names;
- doors/windows as real host-wall openings;
- visible geometry diagnostics.

### M2 — Furnishing and Fit

PR #3 → merge `aa34f24572f2e67714604634587a1c41e4067cd8`.

Delivered:

- furniture/appliance catalogue and custom objects;
- real dimensions/position/rotation/height;
- drag/resize/rotate/duplicate/delete;
- snapping and guides;
- SAT collisions;
- room containment;
- door-swing blocking;
- functional-clearance hints;
- directional measurements;
- explainable `Влезает / Влезает вплотную / Не влезает` statuses.

### M3 — Local-First Projects

PR #4 → merge `6c32249acc8e333e62fceee2ea4e76ca83890c77`.

Delivered:

- `Мои проекты` dashboard;
- create/open/rename/duplicate/delete;
- IndexedDB repository architecture;
- autosave/retryable save state;
- last-project and viewport restore;
- `.vlezet.json` backup/import;
- clean PNG renderer;
- lifecycle/error/accessibility hardening.

### M4 — Reference Plan Import

PR #5 → merge `12e9696e11572ad5ec055f3dfad98ad7826184e2`.

Delivered:

- JPG/PNG/PDF import in browser;
- magic-byte validation;
- PDF page selection and local rasterization;
- safe normalization/size limits;
- two-point metric calibration;
- horizontal/vertical alignment;
- separate raster asset in IndexedDB;
- visibility/opacity/lock/position/rotation;
- exact manual tracing mode;
- reference-aware fit-to-plan;
- portable backup v2 with normalized raster;
- clean PNG and PNG with source reference.

## 5. Active work — M4.5 Assisted Recognition

Branch:

```text
feat/m4-5-assisted-recognition
```

Draft PR:

```text
#6 feat: M4.5 assisted recognition
```

Last important code-bearing RC line has passed strict CI; documentation commits may move the live head afterwards. **Always inspect PR #6 live head and latest CI before merge.**

### Architecture

```text
calibrated reference plan
        │
        ├── local OpenCV/Web Worker
        ├── optional OpenRouter vision model (BYOK)
        └── deterministic reconciliation/sanity
                    │
             RecognitionDraft
                    │
                review/edit
                    │
          deterministic apply
                    │
          normal Vlezet entities
```

Recognition is deliberately **assisted**, not automatic reconstruction.

### Implemented

- framework-independent `@vlezet/recognition`;
- normalized image coordinates `[0,1]`;
- separate persistent recognition sessions;
- local OpenCV.js Web Worker pipeline;
- strict + scale-aware adaptive wall recognition;
- conservative opening hypotheses;
- confidence/evidence/diagnostics;
- review overlay;
- endpoint edit, accept/reject, bulk accept;
- opening reclassification;
- deterministic image→millimetre projection;
- duplicate-existing protection;
- existing manual walls can host accepted recognized openings;
- one applied recognition batch = one Undo/Redo operation;
- stale handling by reference revision and engine version;
- OpenRouter BYOK with runtime-only API key;
- compatible vision/structured-output model discovery;
- one-step AI submit flow;
- tolerant per-candidate cloud parsing;
- local/cloud reconciliation;
- semantic cloud sanity filter;
- safe `[Vlezet:RECOGNITION]` diagnostics without keys/base64;
- unfinished recognition sessions excluded from backup/duplicate/import.

## 6. Important M4.5 RC bugs already discovered and fixed

### Startup freeze

`Открываем Vlezet…` could stay forever because optional recognition restore blocked editor startup.

Fix: show the editor first; restore recognition afterwards; recognition failure is isolated.

### OpenCV Promise/Emscripten crash

`Promise.prototype.then called on incompatible receiver [object Module]`.

Fix: explicit Promise-vs-Module loading contract.

### OpenCV/Turbopack Node builtins

`fs/path/crypto` resolution broke browser build.

Fix: browser-only Next/Turbopack aliases without replacing server Node builtins.

### Excess Konva layers

Stage exceeded recommended physical Layer count.

Fix: consolidate geometry rendering; max 5 physical layers with regression coverage.

### Local CV returned zero candidates

First thresholds were too strict/pixel-based for a real developer plan.

Fix: calibrated `millimetersPerPixel`, scale-aware adaptive fallback and honest empty-state.

### AI submit looked active but did nothing

Hidden `modelId` prerequisite.

Fix: automatic compatible-model discovery/selection when needed.

### Browser `fetch` Illegal invocation

Native fetch was invoked with the wrong receiver.

Fix: safe `globalThis.fetch` wrapper.

### One malformed AI candidate killed the full response

Fix: tolerant per-candidate parsing; valid candidates survive.

### Schema-valid AI hallucinated a giant frame

Fix: prompt hardening + semantic cloud sanity filter + orphan-opening rejection.

## 7. Known M4.5 bug / limitation intentionally deferred

### Recognition quality is still inaccurate/noisy on the real apartment plan

Latest real-plan testing still shows:

- wall candidates can be misaligned or incomplete;
- openings can be noisy;
- topology is not reliable enough for automatic reconstruction;
- model quality varies significantly;
- some cloud results require heavy manual review.

Decision on 2026-07-22:

- record as a **known quality bug/limitation**;
- keep recognition explicitly experimental/assisted;
- never auto-apply it;
- do not weaken deterministic validators to improve apparent recall;
- do not let recognition tuning consume the next major product cycle;
- later improve it using representative real-plan fixtures and measurable quality benchmarks.

This limitation is **not by itself a reason to block the entire roadmap**, provided safety semantics work: review, explicit apply, Undo/Redo, reload and no geometry corruption.

Canonical feedback record:

`docs/product/2026-07-22-geometry-dimensions-ux-feedback.md`

## 8. New fundamental UX issue discovered — dimension semantics

A real user test exposed a more important product-trust problem.

Observed scenario:

```text
entered: 3550 mm × 3300 mm
wall thickness: 50 mm
user expects: ≈ 11.72 m²
Vlezet shows: ≈ 11.38 m²
```

The current geometry can be technically consistent because wall length is effectively interpreted around the **wall centreline**, while room area is derived from **inner wall faces**.

The UX failure is that a normal user interprets `3550 mm` as the clear internal room size.

This means the UI currently looks simpler than the geometry semantics actually are, creating a false sense of understanding.

### Accepted product conclusion

Before 3D, Vlezet must make precision understandable to a non-CAD user.

The next major product priority is therefore **M4.6 Precision Geometry UX**.

P0 topics to design:

1. internal clear dimension vs wall centreline vs external dimension;
2. clear default dimension semantics for normal users;
3. anchor/fixed endpoint when changing wall length;
4. wall-thickness alignment: inside/centre/outside;
5. dimension lines directly on the plan;
6. tape/measurement tool.

High-value follow-ups after the P0 semantics:

- door/window offsets from a known corner;
- target room area;
- locked dimensional/area constraints;
- wall type presets;
- richer visual wall classes.

Detailed accepted feedback:

`docs/product/2026-07-22-geometry-dimensions-ux-feedback.md`

## 9. Current acceptance / merge gate for M4.5

### Proven automatically

The implementation has repeatedly passed:

- frozen install;
- full unit suite;
- TypeScript;
- ESLint;
- production Next build.

### Proven manually during RC debugging

- project startup works after the startup fix;
- local recognition UI runs;
- OpenCV loader works in browser;
- OpenRouter model discovery works with a real key;
- cloud request reaches model execution;
- review overlay displays candidates;
- safety filters reject some malformed/hallucinated cloud output.

### Still required before merge

M4.5 no longer needs near-perfect recognition accuracy to merge.

Required final smoke/safety acceptance:

1. latest branch opens/reloads reliably;
2. local/cloud failures never corrupt the project;
3. recognition remains review-only until explicit apply;
4. accept/edit/reject works;
5. `Применить выбранное` creates ordinary Vlezet geometry;
6. one Undo removes the applied batch;
7. Redo restores it;
8. reload restores a valid current-version draft;
9. M0–M4 workflows are not regressed;
10. exact merge head has green strict CI.

Recognition accuracy/noise remains a documented post-M4.5 quality bug.

## 10. Immediate roadmap

```text
1. Finish M4.5 safety/smoke acceptance
2. Mark PR #6 Ready for Review
3. Verify exact head + strict CI
4. Squash-merge M4.5
5. Update state/changelog with final merge SHA
6. Start M4.6 Precision Geometry UX brainstorming/design
7. Only after M4.6 is stable, start M5 Spatial 3D
8. Then M6 Intelligent Planning
```

Do **not** jump directly from M4.5 to 3D anymore. The dimension-semantics problem is more fundamental to product trust.

## 11. Development workflow

For each milestone:

```text
brainstorm/design approval
→ written spec
→ self-review
→ implementation plan
→ TDD / vertical slices
→ Draft PR
→ strict CI
→ manual browser acceptance
→ Ready for Review
→ final verification
→ squash merge
```

Never claim browser acceptance from CI alone.

## 12. Canonical documents

Read in this order:

1. `docs/PROJECT_STATE.md` — current truth;
2. `docs/ROADMAP.md` — ordered future work;
3. `docs/CHANGELOG.md` — chronological history and reasons;
4. `docs/product/2026-07-22-geometry-dimensions-ux-feedback.md` — accepted geometry/dimensions feedback;
5. original/milestone specs under `docs/superpowers/specs/`;
6. implementation plans under `docs/superpowers/plans/`;
7. acceptance checklists under `docs/milestones/`.

When a future chat asks **«что сделано и что осталось?»**, answer from these documents plus the live PR/CI state.