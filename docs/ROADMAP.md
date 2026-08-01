# Vlezet — Roadmap

**Last updated:** 2026-08-01  
**Rule:** deterministic product truth and user trust come before visual spectacle, feature count or speculative AI layers.

Read `docs/PROJECT_STATE.md` first. Detailed UX sequencing is in `docs/product/UX_ROADMAP.md`.

## Summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — measurable refinement remains issue #27
DONE        M4.6 Precision Geometry UX
DONE        M5.1 Deterministic Spatial 3D Shell + Viewer
DONE        M5.2 Furniture in 3D
POLISH      M5.3 evidence-driven spatial refinement
DONE        M5.4 Spatial Inspection
DONE        M6.1 Deterministic Layout Alternatives
DONE        M6.2 Constraint-Aware Planning
DONE        M6.3 Exact Spatial Constraints
DONE        M6.4 Reviewed Natural-Language Intent
DONE        M7.0 Product and UX Audit
DONE        M7.1 Editor Shell and Responsive Context
DONE        M7.2 Context Inspector Foundation
DONE        M7.3 Design System and Content Components
DONE        M7.4 Canvas Selection and Mode Feedback
NOW         M7.5 Onboarding, Status and Recovery
LATER       M7.6+ in dependency-aware browser-tested slices
```

## Completed product foundation

### M0–M4.6 — trusted 2D planning

- millimetre-world Canvas and semantic history;
- topological walls, rooms, openings and usable area;
- furniture, transforms and explainable fit;
- local projects, autosave, backup/import and PNG;
- reference-plan calibration and editable assisted recognition;
- clear room dimensions, area trust, annotations and tape.

### M5 — deterministic read-only 3D

- renderer-neutral `SpatialScene`;
- shell, openings, floors and furniture;
- safe 2D↔3D switching and semantic inspection;
- WebGL fallback and cleanup.

### M6 — deterministic intelligent planning

- bounded alternatives for one rectangular room;
- M2-authoritative validation;
- lock, wall/corner, near/far and exact contour-gap rules;
- reviewed natural-language intent;
- explicit Preview and atomic Apply.

## Completed M7 foundation

### M7.0 — Product and UX Audit

Status: **DONE / ACCEPTED / MERGED**.  
Merge: `0d5b9c1555ef85a0e271a52832cc3fd3cca4963e`.

Delivered 39 structured findings, target information architecture, interaction model, design/accessibility foundations and reproducible Chromium/WebKit evidence.

### M7.1 — Editor Shell and Responsive Context

Status: **DONE / ACCEPTED / MERGED**.  
Merge: `6b6f8751b520722a54bb94a6947dae1135e07859`.

Delivered separate project/tool bars, readable save state, direct Undo/Redo, responsive catalogue/context surfaces, preserved local drafts and one-column 3D composition.

### M7.2 — Context Inspector Foundation

Status: **DONE / ACCEPTED / MERGED**.  
Merge: `66606356d69f96953f8afae7b914222a3f793777`.

Delivered unified context anatomy, explicit workflow return, fail-closed stale targets, separated destructive actions and viewport-bounded panel scrolling.

### M7.3 — Design System and Content Components

Status: **DONE / ACCEPTED / MERGED**.

```text
PR:                  #26
final accepted head: cabe8e44153d7a56ee23e6931ea204e2fbf82119
standard CI:         30654881419 — PASS
browser CI:          30654879141 — PASS
artifact:            8802854489
digest:              sha256:1f62c1695231d266a9e28e3a54b40402a85106e231c15ca6e53dc2d577b22b32
merge:               509dfc02e17c87a58da8356894564a8f27bc5a9b
```

Delivered:

- semantic color, typography, spacing, radius, elevation and control-size tokens;
- balanced density: 14 px ordinary text, 13 px compact text, 12 px meaningful minimum;
- store-free `UiButton`, `UiField`, messages, notices, badges, cards, empty states and dialogs;
- consistent focus, disabled, busy, success, warning and error states;
- Russian presentation formatting for `мм`, `м²` and `°`;
- representative migration of room controls, furniture catalogue, fit statuses, dashboard, dialogs and recognition UI;
- Canvas helper text raised to the governed minimum;
- OpenRouter response healing for malformed structured output;
- stale decision cleanup when repeated AI checks replace recognition candidates.

Product owner confirmed:

> «Подтверждаю все!»

Recognition accuracy remains a known deferred limitation. The flow is editable and non-authoritative, but valid AI output can still reconstruct topology and areas incorrectly. Canonical future owner: issue #27 and `docs/product/RECOGNITION_QUALITY_REQUIREMENTS.md`.

### M7.4 — Canvas Selection and Mode Feedback

Status: **DONE / ACCEPTED / MERGED**.

```text
PR:                  #29
final accepted head: cd9fe67fb5ea9a2d1647fce5bd7055f6a1c05408
standard CI:         30686372996 — PASS
browser CI:          30686372995 — PASS
artifact:            8814078535
digest:              sha256:38544ca0c259c83ddf1be36c484f207cbdb6723215b4fd922ae52e3e2c938926
merge:               399e1b439d478fb8b01cd39795213b42beece84f
```

Delivered:

- one authoritative Canvas mode and next-action status;
- active-tool feedback for Select, Wall, openings, Measure, placement, tracing/review and read-only 3D;
- explicit first-point and second-point phases for walls and measurement;
- one-level `Escape` priority;
- distinct ordinary, hover, selected, valid-preview and invalid-preview presentation;
- cursor roles for selection, drawing, placement and panning;
- live opening-preview labels;
- Chromium full-flow and WebKit core-smoke regression coverage.

Product owner confirmed:

> «Все прошло строго и четко как ты описал.»

The acceptance correction changed only the browser-test pointer target from the edge of a snapped wall hit stroke to its centreline. Geometry, snapping, hit tolerance and selection ordering were not changed.

## NOW — M7.5 Onboarding, Status and Recovery

### Problems

- first-room success still relies on discovering that a valid room requires closed wall topology;
- the empty project does not guide a new user through the whole first successful task;
- important success evidence can disappear after a short-lived toast;
- high-impact completion or failure may not remain confirmable in the originating context.

Owned findings:

- `UX-ONBOARD-001`;
- `UX-DATA-003`.

### Goal

Guide the first successful room without a blocking wizard and make important completion or recovery evidence durable enough to verify after transient notifications disappear.

### Expected scope

- dismissible first-project checklist tied to existing state;
- contextual next action from empty project through closed-room success;
- explicit successful-room-closure feedback;
- durable in-context evidence for high-impact completion events;
- minor transient toasts retained for low-impact feedback;
- clear failure/recovery and retry copy where the existing operation supports recovery;
- compact-width and Chromium/WebKit coverage for first-project progress and post-toast evidence.

### Acceptance

- a first-time user can create and recognise a closed rectangular room without external instruction;
- onboarding is dismissible and does not block expert use;
- progress is derived from authoritative document/editor state rather than duplicated product data;
- important completion remains confirmable after a toast expires;
- failure/recovery copy identifies the originating action and a valid next step;
- M7.1–M7.4 shell, context, components and Canvas feedback do not regress;
- no geometry, topology, document, persistence or history authority changes;
- full CI, Chromium/WebKit and product-owner acceptance pass.

### Non-goals

- geometry or topology algorithm changes;
- automatic room generation;
- a blocking step-by-step wizard;
- document schema/migration changes for onboarding state;
- dashboard/project-lifecycle redesign;
- geometry, opening or furniture inspector redesign;
- recognition-quality hardening;
- M7.9 accessibility completion.

## Later M7 programme

```text
M7.6  Geometry and Opening Inspector
M7.7  Furniture and Fit Workflow
M7.8  Reference and Recognition Workflow + issue #27 quality hardening
M7.9  Accessibility and Responsive Hardening
M7.10 2D/3D Context and Interior Readability
M7.11 Planning Workflow Simplification
M7.12 Dashboard and Project Lifecycle
M7.13 Visual Consolidation and Evidence-Driven Polish
```

Later slices remain evidence-driven and may be reordered after accepted browser evidence.

## Deferred infrastructure

Accounts, cloud sync, collaboration, managed AI and billing remain separate initiatives requiring independent security, privacy, migration and operational design.

## Delivery rule

Every slice requires focused design, implementation plan, TDD/layout contracts, Draft PR, full CI, browser evidence, product-owner acceptance, exact-head squash merge and canonical documentation sync.
