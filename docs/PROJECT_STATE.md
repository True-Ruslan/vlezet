# Vlezet — Project State

**Last updated:** 2026-07-22  
**Status:** M0–M4.5 are merged to `main`; M4.5 Assisted Recognition is accepted as a working assisted/experimental MVP with a documented quality backlog. Active development is **M4.6 Precision Geometry UX** in Draft PR #7.

> **Read this file first in a new chat.** It is the canonical short-form answer to what Vlezet is, what is already stable, what is currently being developed, what is knowingly imperfect, and what should happen next.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners/buyers.

Core promise:

> Draw or import a real apartment, work with real dimensions, place furniture/appliances and understand what fits, what collides and how much usable space remains — without learning professional CAD.

The product is deliberately:

- precision-first;
- geometry-first;
- editable rather than image-based;
- local-first for core editing;
- easier to understand than CAD/BIM;
- explicit about geometry semantics instead of hiding them behind a deceptively simple UI.

## 2. Non-negotiable architecture rules

1. TypeScript is the primary language.
2. Millimetres are the canonical world unit.
3. Canvas pixels are never persisted as apartment geometry.
4. `domain`, `geometry`, `editor-core` and recognition core remain framework-independent.
5. Konva/Canvas and future Three.js are projections of the domain model, never the source of truth.
6. Rooms, areas and user-facing dimensions are derived from structured geometry unless a semantic edit intent explicitly changes that geometry.
7. Do not persist duplicate internal/external dimensions that can disagree with vertices/walls.
8. Project formats are schema-versioned and migrated deterministically.
9. Undo/redo is semantic-command oriented.
10. Local editing must not depend on network latency.
11. AI/CV may create only editable suggestions; deterministic geometry validation is authoritative.
12. Existing user geometry must never be silently replaced by recognition/AI.
13. Optional subsystems such as recognition must never block core project startup.
14. Product simplicity must not hide ambiguous geometry semantics from normal users.
15. When geometry semantics are ambiguous, fail closed and explain the limitation rather than guessing.

## 3. Repository and stack

Repository: `True-Ruslan/vlezet`

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent apartment model and migrations
packages/geometry        framework-independent geometry/math/derived measurements
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

`main` contains **M0 through M4.5**.

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

### M4.5 — Assisted Recognition — MVP merged

PR #6 → squash merge:

```text
b63bdd613db4e13c07d2a961981799bd360f256d
```

Product acceptance on 2026-07-22:

> Recognition became noticeably better and works as an MVP acceleration layer, but accuracy is not perfect. Further accuracy work is refinement, not a blocker for moving the roadmap forward.

Delivered:

- framework-independent `@vlezet/recognition`;
- normalized image coordinates `[0,1]`;
- persistent recognition sessions outside `VlezetDocument`;
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
- tolerant per-candidate cloud parsing;
- local/cloud reconciliation;
- semantic cloud sanity filter;
- startup isolation from optional recognition restore;
- unfinished recognition sessions excluded from backup/duplicate/import.

Canonical MVP acceptance:

`docs/milestones/m4-5-mvp-acceptance.md`

## 5. M4.5 known quality backlog

Recognition remains explicitly **assisted / experimental**, not automatic floor-plan reconstruction.

Known limitations:

- wall candidates can still be misaligned or incomplete;
- openings can be noisy;
- topology/junction reconstruction is not reliable enough for authoritative automatic reconstruction;
- cloud model quality varies significantly;
- some plans still require substantial manual review/tracing.

These limitations do not compromise project geometry because recognition remains suggestions-only until explicit Apply and deterministic validation.

Future quality work should be evidence-driven:

1. representative real developer/realtor/BTI plan fixture corpus;
2. measurable wall/opening/topology quality metrics;
3. preprocessing/CV tuning against fixtures;
4. improved line merging/junction reconstruction;
5. cloud model quality/cost ranking;
6. stronger semantic validation from recorded failures;
7. custom ML only if metrics justify it.

Do **not** let recognition tuning consume the current M4.6 product cycle.

## 6. Active work — M4.6 Precision Geometry UX

Branch:

```text
feat/m4-6-precision-geometry-ux
```

Draft PR:

```text
#7 feat: M4.6 precision geometry UX
```

Base:

```text
main @ b63bdd613db4e13c07d2a961981799bd360f256d
```

Latest verified implementation head at this snapshot:

```text
7bf9d54bb0b40adddb41cbce334eaa67f3716043
```

Strict CI:

```text
GitHub Actions run 29913956019 — PASS
unit tests      PASS
typecheck       PASS
lint            PASS
production build PASS
```

### Why M4.6 precedes 3D

Real user feedback exposed a fundamental trust problem:

```text
entered: 3550 mm × 3300 mm
wall thickness: 50 mm
user expects: ≈ 11.72 m²
old UX could show: ≈ 11.38 m²
```

The old editor exposed wall **centreline** length as if it were simply “the length”. A normal user naturally interpreted it as the clear internal room size.

3D would only make the same ambiguous geometry prettier. M4.6 therefore fixes geometry semantics before M5.

Canonical feedback:

`docs/product/2026-07-22-geometry-dimensions-ux-feedback.md`

Canonical design:

`docs/superpowers/specs/2026-07-22-m4-6-precision-geometry-ux-design.md`

## 7. M4.6 implemented so far

### M4.6.1 — Honest wall-length semantics and anchors

Implemented in PR #7:

- ambiguous `Точная длина` replaced by explicit `Длина по оси стены`;
- inspector explains that centreline length is not always the clear internal room size;
- explicit fixed anchor:

```text
Начало | Центр | Конец
```

- `start`: start vertex stays fixed;
- `end`: end vertex stays fixed;
- `center`: midpoint stays fixed and both endpoints move symmetrically;
- legacy calls keep `start` as default;
- openings preserve physical world position when the wall start moves by compensating offset;
- invalid shrink through openings/junctions fails atomically;
- moved endpoints still respect host-wall constraints;
- one resize = one semantic history operation.

### M4.6.2 — First clear internal room-dimension vertical slice

Implemented for **simple axis-aligned rectangular rooms**:

- `deriveRectangularRoomDimensions()` derives clear width/height from the same usable inner polygon used for area;
- no duplicate `internalLength` values are persisted;
- example regression:

```text
centreline rectangle: 3650 × 3400 mm
wall thickness:       100 mm
clear inside:         3550 × 3300 mm
area:                 11.715 m²
```

- room inspector now exposes `Чистые внутренние размеры`;
- editable `Ширина` and `Длина` in millimetres;
- horizontal anchor:

```text
Левая сторона | Центр | Правая сторона
```

- vertical anchor:

```text
Верхняя сторона | Центр | Нижняя сторона
```

- edits transform canonical walls/vertices, not a stored annotation;
- affected opening offsets are compensated so openings keep world position;
- the complete room-dimension edit is one semantic Undo/Redo operation;
- complex/non-rectangular/T-junction rooms fail closed instead of guessing.

This conservative first scope is intentional. Broaden it only when the geometry semantics remain deterministic and explainable.

## 8. M4.6 next work

Ordered next steps:

1. browser acceptance of M4.6.1/M4.6.2 on the real apartment workflow;
2. **M4.6.3 wall thickness alignment** — `inside / centre / outside`, with a clearly visible side and deterministic centreline shift;
3. **M4.6.4 dimension lines** — selected-wall and deterministic room dimensions directly on Canvas;
4. **M4.6.5 tape/measurement tool** — arbitrary two-point distance + horizontal/vertical deltas;
5. precise door/window offsets from a known corner;
6. only then consider target room area / locked constraints / richer wall classes.

## 9. M4.6 acceptance principle

A normal user must be able to answer without external explanation:

> “I entered 3550 mm. What exactly is 3550 mm, what moves if I change it, and why is the room area what it is?”

For the first supported rectangular-room path, entering clear dimensions `3550 × 3300` must correspond to approximately `11.72 m²` after display rounding because both dimensions and area come from the same inner geometry.

## 10. Roadmap

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — merged; quality refinement backlog remains
NOW         M4.6 Precision Geometry UX — Draft PR #7
THEN        M5 Spatial 3D
AFTER       M6 Intelligent Planning
LATER       public-product infrastructure / optional expansion
```

Decision rule:

```text
trust / precision / predictability
before
visual impressiveness / feature count
```

## 11. Intentionally deferred

Do not add casually during M4.6:

- full parametric CAD constraint solver;
- BIM semantics;
- structural/removability conclusions without authoritative data;
- cloud sync/auth/collaboration;
- mobile-first editor rewrite;
- multi-floor;
- curved walls;
- DWG/DXF/BIM;
- photorealistic 3D;
- generative interior images;
- AI layouts that bypass deterministic geometry validation.

## 12. Context files

Read in this order when continuing development:

1. `docs/PROJECT_STATE.md`
2. `docs/ROADMAP.md`
3. `docs/CHANGELOG.md`
4. `docs/product/2026-07-22-geometry-dimensions-ux-feedback.md`
5. `docs/superpowers/specs/2026-07-22-m4-6-precision-geometry-ux-design.md`
6. `docs/superpowers/plans/2026-07-22-m4-6-1-wall-length-semantics.md`
7. `docs/milestones/m4-5-mvp-acceptance.md`

Always inspect live PR #7 head and exact-head CI before further development or merge.
