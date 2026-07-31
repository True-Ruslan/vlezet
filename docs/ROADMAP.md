# Vlezet — Roadmap

**Last updated:** 2026-07-31  
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
NOW         M7.4 Canvas Selection and Mode Feedback
LATER       M7.5+ in dependency-aware browser-tested slices
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

## NOW — M7.4 Canvas Selection and Mode Feedback

### Problems

- active tools and temporary modes are not always visually obvious;
- the next required Canvas action can be unclear;
- selection, hover, placement preview and invalid targets need stronger distinction;
- Escape/cancellation behaviour is not consistently communicated.

Owned findings:

- `UX-SHELL-004`;
- `UX-CANVAS-001`;
- `UX-CANVAS-002`.

### Goal

Make active tool, next action, current selection and temporary spatial state obvious while preserving all existing geometry and command authority.

### Expected scope

- explicit active-tool and mode status;
- context-sensitive next-action guidance;
- consistent cursor feedback;
- distinct hover, selection, valid preview and invalid preview visuals;
- one documented Escape-priority model;
- status copy based on existing editor state;
- representative Chromium/WebKit tool-transition evidence.

### Acceptance

- users can identify the active tool without relying on memory;
- each exclusive tool communicates the next valid action;
- hover/selection/preview/error states are distinguishable without color alone;
- Escape exits the highest-priority temporary state consistently;
- M7.1–M7.3 shell, context, scrolling and component behaviour do not regress;
- no document, geometry, snapping, history or persistence authority changes;
- full CI, Chromium/WebKit and product-owner acceptance pass.

### Non-goals

- geometry or snapping algorithm changes;
- inspector redesign;
- onboarding implementation;
- recognition-quality hardening;
- mobile-first editor.

## Later M7 programme

```text
M7.5  Onboarding, Status and Recovery
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
