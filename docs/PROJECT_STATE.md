# Vlezet — Project State

**Last updated:** 2026-07-22  
**Status:** M0–M4 merged to `main`; M4.5 Assisted Recognition is an active release candidate in Draft PR #6.

> **Read this file first in a new chat.** It is the canonical short-form context for answering: **what is Vlezet, what is already done, what is currently being tested, what is not finished, and what should be developed next?**

## 1. Product in one paragraph

**Vlezet** is a precise, approachable apartment planner for non-professional owners/buyers. A user can draw or import a real apartment plan, work in millimetres, add walls/doors/windows, derive rooms and usable area, place real-sized furniture/appliances, inspect collisions and clearances, save/reopen projects, export them, and progressively use assisted recognition to reduce manual tracing.

Core promise:

> Draw or import your apartment, place real-sized furniture and appliances, and understand what fits, what collides, and how much usable space remains.

The product is deliberately **geometry-first**, not CAD/BIM and not a decorative 3D renderer.

## 2. Non-negotiable architecture rules

1. TypeScript is the primary language.
2. Millimetres are the canonical world unit.
3. Canvas pixels are never persisted as apartment geometry.
4. `domain`, `geometry`, `editor-core` and recognition core remain framework-independent.
5. Konva/Canvas and future Three.js are projections of the domain model, never the source of truth.
6. Rooms/areas are derived from structured geometry.
7. Project documents are schema-versioned and migrated deterministically.
8. Undo/redo is command/semantic-operation oriented.
9. Local editing must never depend on network latency.
10. AI/CV can only create **editable suggestions**; deterministic geometry validation remains authoritative.
11. Existing user geometry must never be silently replaced by recognition/AI.
12. Optional subsystems such as recognition must never block core project startup.

## 3. Repository and stack

Repository: `True-Ruslan/vlezet`

Current architecture:

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent apartment model and migrations
packages/geometry        framework-independent geometry/math
packages/editor-core     semantic editor operations/history/snapping
packages/projects        local-first project/persistence abstraction
packages/recognition     M4.5 recognition model, CV post-processing, reconciliation
```

Rendering: Konva / react-konva.  
State: Zustand.  
Persistence: IndexedDB through repository adapters.  
Workspace: pnpm + Turborepo.  
Future 3D direction: Three.js / possibly React Three Fiber, using the same domain model.

## 4. Stable `main` state

`main` currently contains **M0 through M4**.

Current M4 merge commit on `main`:

```text
12e9696e11572ad5ec055f3dfad98ad7826184e2
```

### M0 — Foundation and Infinite Canvas — merged 2026-07-21

PR #1 → merge commit `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered:

- TypeScript monorepo and package boundaries;
- infinite 2D canvas;
- pan/zoom and adaptive grid;
- millimetre world/screen transforms;
- wall drawing and exact length editing;
- snapping;
- command-oriented undo/redo;
- reproducible frozen installs and CI.

### M1 — Apartment Shell — merged 2026-07-21

PR #2 → merge commit `3944c7f9d668a645e1dc05805f476d2f3290eb94`.

Delivered:

- topological walls with explicit vertices;
- T-junctions and stable semantic wall identity;
- physical wall thickness;
- deterministic room detection;
- usable-area calculation from inner wall surfaces;
- room names;
- real wall openings;
- doors/windows with host-wall relationship and door swing;
- geometry diagnostics rather than silent repair.

### M2 — Furnishing and Fit — merged 2026-07-21

PR #3 → merge commit `aa34f24572f2e67714604634587a1c41e4067cd8`.

Delivered:

- furniture/appliance catalogue and custom objects;
- real dimensions, position, rotation and height metadata;
- drag/resize/rotate/duplicate/delete;
- object/grid/edge/centre snapping and guides;
- SAT collision detection;
- room containment checks;
- door-swing blocking;
- functional-clearance zones;
- directional measurements;
- explainable statuses: `Влезает`, `Влезает вплотную`, `Не влезает`.

### M3 — Local-First Projects — merged 2026-07-21

PR #4 → merge commit `6c32249acc8e333e62fceee2ea4e76ca83890c77`.

Delivered:

- `Мои проекты` dashboard;
- create/open/rename/duplicate/delete;
- IndexedDB repository architecture;
- autosave and retryable save status;
- last-project and viewport restoration;
- local-first privacy messaging;
- `.vlezet.json` backup/import;
- clean PNG renderer independent from UI screenshots;
- project lifecycle/error/accessibility hardening.

### M4 — Reference Plan Import — merged 2026-07-21

PR #5 → merge commit `12e9696e11572ad5ec055f3dfad98ad7826184e2`.

Delivered:

- JPG/PNG/PDF import fully in browser;
- magic-byte format validation;
- PDF page selection and local PDF.js rasterization;
- safe normalization/size limits;
- two-point metric calibration;
- optional horizontal/vertical alignment;
- separate reference raster asset in IndexedDB;
- visibility/opacity/lock/position/rotation;
- manual tracing mode;
- reference-aware fit-to-plan;
- independent asset copying on project duplicate;
- portable `.vlezet.json` file format v2 with embedded normalized raster;
- clean PNG and optional PNG with source reference.

## 5. Current active work — M4.5 Assisted Recognition

Branch:

```text
feat/m4-5-assisted-recognition
```

Draft PR:

```text
#6 feat: M4.5 assisted recognition
```

Last **code-bearing** RC head before the context-documentation commits:

```text
a531d25b933166ac418b178b8abd3926091fc81e
```

Strict CI that verified that implementation head:

```text
GitHub Actions run 29906135283
pnpm install --frozen-lockfile PASS
pnpm test                    PASS
pnpm typecheck               PASS
pnpm lint                     PASS
pnpm build                    PASS
```

Documentation-only commits may move the live PR head beyond that SHA. **Always check PR #6 live head and latest CI before merge or further development.**

**Important:** M4.5 is **not merged yet**. PR remains Draft until browser acceptance on a real developer/realtor plan is satisfactory.

### 5.1 What M4.5 is intended to do

Hybrid recognition architecture:

```text
calibrated reference plan
        │
        ├── local CV / OpenCV.js
        │
        ├── optional OpenRouter vision model (BYOK)
        │
        └── deterministic reconciliation / sanity validation
                    │
             RecognitionDraft
                    │
                review/edit
                    │
          ApplyRecognitionDraft
                    │
          ordinary Vlezet entities
```

Recognition is intentionally not a one-click replacement of apartment geometry.

### 5.2 Implemented M4.5 capabilities

- new framework-independent `@vlezet/recognition` package;
- candidates stored in normalized reference-image coordinates `[0,1]`;
- separate persistent recognition session outside `VlezetDocument`;
- local OpenCV.js analysis in a Web Worker;
- line extraction, wall candidate building and conservative opening hypotheses;
- strict pass plus scale-aware adaptive fallback for thick/fragmented plans;
- confidence/evidence/diagnostics;
- review overlay on Canvas;
- endpoint editing, accept/reject and `Принять уверенные`;
- door/window/unknown-opening reclassification;
- deterministic projection back to calibrated millimetres;
- duplicate-existing-wall protection;
- existing manual walls can host accepted recognized openings;
- atomic semantic apply: one batch = one Undo/Redo operation;
- persistent draft restore after reload;
- stale protection when reference raster/calibration changes;
- engine-version stale protection for incompatible recognition drafts;
- OpenRouter BYOK provider;
- API key stays runtime-only and is not stored in project/IndexedDB/backup;
- runtime discovery of compatible vision + structured-output models;
- one-step AI UX: paste key → `Анализировать`, model discovery can happen automatically;
- strict JSON-schema request;
- tolerant per-candidate response parsing;
- local/cloud reconciliation;
- semantic cloud sanity filter before review;
- safe development diagnostics `[Vlezet:RECOGNITION]` without API keys or image base64;
- unfinished recognition sessions excluded from backup/duplicate/import.

## 6. M4.5 RC bugs discovered during real browser testing

These are important historical context because they explain why PR #6 has many hardening commits.

### 6.1 Infinite `Открываем Vlezet…`

Observed: Next dev server was ready, but UI stayed forever in project loading.

Root cause: optional `recognition.restore()` was awaited before `setMode("editor")`.

Fix: core project/editor becomes visible first; recognition restore happens afterwards and recognition-storage failures are isolated from startup.

### 6.2 OpenCV `Promise.prototype.then ... [object Module]`

Observed while starting local recognition.

Root cause: Emscripten OpenCV module was treated as a normal Promise/thenable.

Fix: explicit Promise-vs-Module loader contract; never return raw thenable-like module from an async boundary.

### 6.3 OpenCV/Turbopack `Can't resolve fs/path/crypto`

Root cause: browser OpenCV package contains Node-capable references.

Fix: browser-only Next 16 Turbopack aliases, without replacing server-side Node builtins.

### 6.4 Konva layer warning

Observed: Stage exceeded recommended physical Layer count.

Fix: merged geometry-related drawing into fewer physical layers; maximum reduced to 5 and protected by regression test.

### 6.5 Local CV returned `0 стен / 0 проёмов`

Observed on a real developer floor-plan image.

Root cause: first CV post-processing thresholds were too strict and pixel-based for thick/fragmented plan graphics.

Fix:

- calibrated `millimetersPerPixel` passed to worker;
- scale-aware adaptive fallback;
- fallback candidates remain reviewable rather than authoritative;
- empty result now has explicit retry/AI UX;
- recognition engine version bumped so obsolete drafts become stale.

### 6.6 AI button appeared to do nothing

Root cause: UI required a selected model ID before submit, while `Анализировать` visually appeared usable.

Fix: one-step flow can discover compatible models automatically and select a usable candidate; errors are visible.

### 6.7 OpenRouter `Illegal invocation`

Observed after compatible model discovery succeeded.

Root cause: native browser `fetch` was stored as an object field and invoked with an incompatible receiver.

Fix: default fetch now calls `globalThis.fetch(...)` through a safe wrapper; regression coverage added.

### 6.8 One model failed the geometry contract

Observed: `Ответ OpenRouter не прошёл проверку геометрического контракта.`

Root cause: one malformed candidate caused the whole structured response to fail.

Fix: tolerant per-candidate parsing. Valid walls/openings/labels survive; malformed individual candidates are dropped with diagnostics. Only a structurally unusable response remains a hard error.

### 6.9 Another model produced a nonsensical giant rectangle / frame

Observed: schema-valid AI result drew large lines around the plan/empty image area and false openings.

Root cause: JSON schema validates shape, not semantic architectural plausibility.

Fix:

- prompt explicitly forbids image/page/crop/bounding-box frames as walls;
- new cloud semantic sanity filter compares cloud-only geometry to local-CV-confirmed plan bounds;
- long unsupported frame-like lines outside the confirmed region are dropped;
- openings hosted by dropped/unknown cloud walls are dropped;
- diagnostics record the rejection rather than silently accepting garbage.

## 7. Current manual acceptance status

### Proven automatically

On the latest verified implementation head:

- frozen dependency install;
- full unit suite;
- TypeScript;
- ESLint;
- production Next build.

### Proven manually during RC debugging

- project opens after startup-regression fix;
- local recognition UI launches;
- OpenCV loader reaches recognition instead of Promise/Node-module crashes;
- OpenRouter model discovery works with a real API key;
- cloud request reaches model execution after fetch receiver fix;
- recognition review overlay can display returned candidates.

### Still required before merging M4.5

Re-run the same real plan on the latest RC and verify:

1. fresh engine/local recognition result after stale invalidation;
2. local candidates are useful enough to accelerate tracing rather than create mostly noise;
3. first previously failing AI model now keeps valid candidates instead of failing the entire response;
4. second previously bad model no longer passes the giant frame/bounding-box artifact into normal review;
5. AI/local reconciliation produces understandable candidates;
6. accept/edit/reject works;
7. `Применить выбранное` creates correct ordinary walls/openings;
8. one Undo removes the whole applied batch;
9. reload restores the current draft correctly;
10. no regression in M0–M4 editing, persistence, import/export and reference-plan workflow.

Browser checklist: `docs/milestones/m4-5-acceptance.md`.

## 8. What is deliberately NOT done yet

- M4.5 is not merged to `main` yet;
- recognition accuracy is not considered production-proven until latest RC passes real-plan acceptance;
- no custom trained CV/ML model;
- no authoritative OCR dimension extraction;
- no Vlezet-managed AI backend/billing;
- no cloud project sync/auth/collaboration;
- no mobile-first editor;
- no multi-floor support;
- no curved walls;
- no DWG/DXF/BIM import;
- no 3D mode yet;
- no AI furniture-layout generation yet.

## 9. Immediate next action

**Do not start M5 while M4.5 RC is still unaccepted.**

Next sequence:

```text
1. git pull latest feat/m4-5-assisted-recognition
2. rerun real-plan local recognition
3. rerun the same OpenRouter models that exposed RC defects
4. inspect review quality and diagnostics
5. test apply + Undo/Redo + reload
6. if accepted: mark PR #6 Ready for Review
7. verify final head + strict CI
8. squash-merge PR #6 into main
9. update PROJECT_STATE/CHANGELOG if final merge SHA differs
10. only then start M5 design/brainstorming
```

## 10. Development workflow that has worked well

For each milestone:

```text
brainstorm/design approval
→ written spec
→ self-review
→ implementation plan
→ TDD / incremental vertical slices
→ Draft PR
→ strict CI
→ manual browser acceptance
→ Ready for Review
→ final verification
→ squash merge
```

Never claim browser acceptance from CI alone.

## 11. Canonical documents

Read in this order:

1. `docs/PROJECT_STATE.md` — current truth and active work;
2. `docs/ROADMAP.md` — ordered future work;
3. `docs/CHANGELOG.md` — chronological history and reasons;
4. `docs/superpowers/specs/2026-07-21-vlezet-product-design.md` — original product/architecture direction;
5. milestone specs/plans under `docs/superpowers/specs/` and `docs/superpowers/plans/`;
6. acceptance checklists under `docs/milestones/`.

When a future chat asks **“что сделано и что осталось?”**, base the answer primarily on these three top-level state documents plus the latest PR/CI state.