# Vlezet — Roadmap

**Last updated:** 2026-07-30  
**Rule:** deterministic product truth and user trust come before visual spectacle, feature count or speculative AI layers.

Read `docs/PROJECT_STATE.md` first. Detailed UX sequencing is in `docs/product/UX_ROADMAP.md`.

## Summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — measurable refinement remains backlog
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
NOW         M7.1 Editor Shell and Responsive Context
LATER       M7.2+ in dependency-aware browser-tested slices
```

## Completed product foundation

### M0–M4.6 — trusted 2D planning

- millimetre-world Canvas and semantic history;
- topological walls, rooms, openings and usable area;
- furniture, transforms and explainable fit;
- local projects, autosave, backup/import and PNG;
- reference-plan calibration/tracing;
- editable assisted recognition;
- clear room dimensions, area trust, dimension annotations and tape.

Accepted regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

### M5 — deterministic read-only 3D

- renderer-neutral `SpatialScene`;
- shell, openings, floors and furniture;
- safe 2D↔3D switching;
- camera presets;
- semantic inspection;
- WebGL fallback and cleanup.

3D remains a projection of `VlezetDocument`. Browser evidence assigns default interior readability to M7.10.

### M6 — deterministic intelligent planning

- bounded alternatives for one rectangular room;
- M2-authoritative validation;
- lock, wall/corner and near/far rules;
- exact pair contour gap and evidence;
- reviewable natural-language intent;
- explicit transfer, Preview and Apply;
- one Apply = one Undo/Redo step.

M6.4 merge: `02f8b041341c86f0796011b0d2fd42cac56a4e02`.

## M7.0 — Product and UX Audit

Status: **DONE / ACCEPTED / MERGED**.

```text
PR:           #19
feature head: 2ae83fb4a09fd9313f2befe5d9c35fd0ecab1394
standard CI:  30572124031 — PASS
browser CI:   30572124032 — PASS
artifact:     8771245306
merge:        0d5b9c1555ef85a0e271a52832cc3fd3cca4963e
```

Delivered:

- product vision and 11 user journeys;
- current interface/component/style inventory;
- 39 structured UX findings;
- target information architecture and interaction model;
- design-system and canonical-content foundations;
- accessibility/viewport requirements;
- dependency-aware M7 programme;
- reproducible Chromium/WebKit browser harness.

Findings:

```text
P0  0
P1 10
P2 23
P3  6
P4  0
TOTAL 39
```

Browser evidence confirmed:

- toolbar and document overflow at common desktop widths;
- hidden inspector under effective zoom width;
- 9 px save state and 11 px Canvas help;
- provider-first dense planning panel;
- internal milestone labels in product UI;
- initial 3D interior occlusion;
- strong dashboard and destructive confirmation patterns.

M7.0 changed no product UI or authority boundary.

## NOW — M7.1 Editor Shell and Responsive Context

### Problems

- `UX-SHELL-001` — command responsibilities compete and clip;
- `UX-SHELL-002` — contextual controls disappear;
- `UX-DATA-001` — local-save status is too subtle;
- `UX-ACCESS-002` — zoom removes functionality instead of reflowing it.

### Goal

Create a stable project/tool/context hierarchy that preserves essential actions and selected-entity controls across supported desktop widths and browser zoom.

### Scope

- separate global product actions from exclusive tools/display toggles;
- preserve project identity, readable `Сохранено локально`, active tool and Undo/Redo;
- collapse secondary utilities into labelled overflow;
- replace disappearing inspector with a viewport-safe panel/drawer;
- preserve Canvas useful area and semantic workflow state;
- introduce only minimum shell tokens/primitives;
- reuse and extend browser evidence automation.

### Acceptance

- 1920×1080, 1440×900, 1366×768 and 1280×800;
- effective 125%, 150% and 200% zoom;
- no horizontal escape;
- no unreachable contextual/workflow controls;
- active tool, save status and history remain available;
- Canvas remains usable;
- Chromium full-flow;
- WebKit core smoke;
- native Safari core regression on macOS;
- full CI;
- product-owner browser acceptance.

### Non-goals

- redesign every inspector;
- change geometry, persistence or stores;
- mobile-first editing;
- new AI/planning capability;
- Canvas/3D rewrite.

## Later M7 programme

```text
M7.2  Context Inspector Foundation
M7.3  Design System and Content Components
M7.4  Canvas Selection and Mode Feedback
M7.5  Onboarding, Status and Recovery
M7.6  Geometry and Opening Inspector
M7.7  Furniture and Fit Workflow
M7.8  Reference and Recognition Workflow
M7.9  Accessibility and Responsive Hardening
M7.10 2D/3D Context and Interior Readability
M7.11 Planning Workflow Simplification
M7.12 Dashboard and Project Lifecycle
M7.13 Visual Consolidation and Evidence-Driven Polish
```

Only M7.1 is committed. Later slices may be reordered after evidence.

## Deferred infrastructure

Accounts, cloud sync, collaboration, managed AI and billing remain separate initiatives requiring independent security, privacy, migration and operational design.

## Delivery rule

Every slice requires focused design, implementation plan, TDD/layout contracts, Draft PR, full CI, browser evidence, product-owner acceptance, squash merge and canonical documentation sync.
