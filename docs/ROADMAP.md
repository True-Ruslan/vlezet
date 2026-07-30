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
DONE        M7.1 Editor Shell and Responsive Context
NOW         M7.2 Context Inspector Foundation
LATER       M7.3+ in dependency-aware browser-tested slices
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

3D remains a projection of `VlezetDocument`. Interior readability remains owned by M7.10.

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

Delivered 39 structured findings, target information architecture, interaction model, design/accessibility foundations and reproducible Chromium/WebKit browser evidence.

## M7.1 — Editor Shell and Responsive Context

Status: **DONE / ACCEPTED / MERGED**.

```text
PR:                  #21
implementation head: 6c21653b30e627a9bf160baf6f3f8d0a4d058f16
final verified head: 8c68bd288cd3dda1133f09a469cd7afe6dab83d9
standard CI:         30586557182 — PASS
browser CI:          30586557394 — PASS
artifact:            8776737145
merge:               6b6f8751b520722a54bb94a6947dae1135e07859
```

Resolved:

- `UX-SHELL-001` — command hierarchy no longer competes in one clipping row;
- `UX-SHELL-002` — contextual controls remain reachable through docked surfaces or compact sheets;
- `UX-DATA-001` — local-save state is readable;
- foundational part of `UX-ACCESS-002` — zoom reflows shell controls rather than removing them.

Delivered:

- separate project and tool bars;
- visible project identity, save state, Undo and Redo;
- labelled `Действия` overflow;
- responsive left catalogue and right context sheets;
- preserved selection and uncommitted form state;
- no horizontal document escape in the required viewport/zoom matrix;
- clean one-column 3D composition;
- strict Chromium/WebKit blocking acceptance.

Product owner confirmed:

> «Я все проверил. Выглядит уже лучше и понятнее.»

Canonical evidence: `docs/milestones/m7-1-acceptance.md`.

## NOW — M7.2 Context Inspector Foundation

### Problems

- `UX-SHELL-003` — context/workflow anatomy is inconsistent;
- `UX-PATTERN-001` — headers, sections and actions vary by panel;
- part of `UX-CONTENT-001` — selection identity and action language need one predictable structure.

### Goal

Create one predictable context/workflow panel anatomy with shared identity, back/close behaviour, sections, action hierarchy and safe workflow return context.

### Scope

- shared panel header and selected-entity identity;
- empty/wall/room/opening/object shell states;
- consistent back/close semantics for embedded workflows;
- reusable section hierarchy;
- predictable primary/secondary/destructive action placement;
- preserve drafts and selection across M7.1 docked/sheet presentation;
- extend browser tests for representative context states.

### Acceptance

- existing context actions remain reachable;
- selection and uncommitted drafts remain stable;
- embedded workflow close/back returns to the correct context;
- destructive actions remain separated and explicit;
- docked and compact layouts use the same semantic anatomy;
- no project/domain/geometry/persistence authority change;
- full CI and Chromium/WebKit representative flow pass;
- product-owner acceptance before merge.

### Non-goals

- complete geometry/furniture/reference/planning form redesign;
- broad design-system migration assigned to M7.3;
- new geometry or planning semantics;
- Canvas/3D rewrite;
- mobile-first editor.

## Later M7 programme

```text
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

Later slices remain evidence-driven and may be reordered after accepted browser evidence.

## Deferred infrastructure

Accounts, cloud sync, collaboration, managed AI and billing remain separate initiatives requiring independent security, privacy, migration and operational design.

## Delivery rule

Every slice requires focused design, implementation plan, TDD/layout contracts, Draft PR, full CI, browser evidence, product-owner acceptance, squash merge and canonical documentation sync.
