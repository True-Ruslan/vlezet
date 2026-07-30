# Vlezet — Roadmap

**Last updated:** 2026-07-30  
**Rule:** deterministic product truth and user trust come before visual spectacle, feature count or speculative AI layers.

For current truth, read `docs/PROJECT_STATE.md` first. For detailed UX sequencing, read `docs/product/UX_ROADMAP.md`.

## Summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — measurable quality refinement remains backlog
DONE        M4.6 Precision Geometry UX
DONE        M5.1 Deterministic Spatial 3D Shell + Viewer
DONE        M5.2 Furniture in 3D
POLISH      M5.3 evidence-driven camera/navigation/performance refinement
DONE        M5.4 Spatial Inspection
DONE        M6.1 Deterministic Layout Alternatives
DONE        M6.2 Constraint-Aware Planning
DONE        M6.3 Exact Spatial Constraints
DONE        M6.4 Reviewed Natural-Language Intent
ACCEPTED    M7.0 Product and UX Audit — PR #19 integration pending
NOW         M7.1 Editor Shell and Responsive Context
LATER       M7.2+ only in dependency-aware, browser-tested slices
```

## Completed product foundation

### M0–M4.6 — trusted 2D apartment editing

Delivered:

- millimetre-world Canvas and semantic history;
- topological walls, rooms, openings and usable area;
- furniture, exact dimensions, rotation and fit diagnostics;
- local-first projects, autosave, backup/import and PNG;
- reference-plan import/calibration/tracing;
- assisted editable recognition;
- clear room dimensions, area consistency, dimension annotations and tape measurement.

Accepted geometry regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

### M5 — deterministic read-only 3D

Principle:

> 3D is a projection of the same trusted `VlezetDocument`, not a separate editor or geometry source.

Delivered:

- renderer-neutral `SpatialScene`;
- shell, openings, floors and ordinary furniture;
- safe 2D↔3D switching;
- camera presets and fit;
- semantic read-only room/wall/object inspection;
- explicit resource cleanup and WebGL fallback.

M5.3 remains evidence-driven polish. M7.0 browser evidence now records a concrete M7.10 issue: the default perspective can hide interior objects behind opaque exterior walls.

### M6 — deterministic intelligent planning

Principle:

> Planning may propose and interpret, but `VlezetDocument` plus deterministic geometry/fit validation remain authoritative. Preview is ephemeral and Apply is explicit.

Delivered:

- bounded deterministic alternatives for one rectangular room;
- 1–3 selected existing objects;
- M2-authoritative validation;
- lock, wall/corner and pair near/far intent;
- exact pair minimum contour gap;
- structured evidence and nearest-contour overlay;
- optional natural-language interpretation;
- exact/unique object resolution without fuzzy guessing;
- explicit ambiguity and unsupported-fragment review;
- explicit transfer into ordinary controls;
- non-mutating Preview and one-step Apply/Undo/Redo.

M6.4 merge: `02f8b041341c86f0796011b0d2fd42cac56a4e02`.

## M7.0 — Product and UX Audit

Status: **ACCEPTED; PR #19 pending final integration**.

Why feature expansion paused:

- product capability had grown faster than interface hierarchy;
- toolbar, Canvas, catalogue and inspector competed for finite desktop space;
- several concepts were technically safe but visually/prosaically difficult;
- continuing with M6.5 would increase UX debt before users could comfortably reach existing value.

Delivered:

- product vision;
- complete component and current-style inventory;
- eleven end-to-end user journeys;
- structured source-backed UX ledger;
- target information architecture and interaction model;
- design-system foundation;
- canonical Russian terminology;
- accessibility/viewport requirements;
- dependency-aware M7 programme;
- reproducible Chromium/WebKit browser-audit harness.

Combined findings:

```text
P0  0
P1 10
P2 23
P3  6
P4  0
TOTAL 39
```

Browser evidence:

```text
Chromium full-flow
run:      30570626203 — PASS
head:     e3602296cf4382b88443e67616a69978b3f3bab0
artifact: 8770651801

Chromium + WebKit final pass
run:      30571095361 — PASS
head:     7278a278f1a33d99d383a54139a20be987417c85
artifact: 8770860354
```

Confirmed priorities:

1. toolbar hierarchy and horizontal escape;
2. context-panel reachability under effective zoom width;
3. readable local-save state;
4. removal of essential 9–10 px semantics;
5. shared mandatory/preference/recommendation/Draft/Preview/Applied language;
6. keyboard/focus paths for pointer-first workflows;
7. useful interior-oriented initial 3D presentation.

Canonical evidence:

- `docs/milestones/m7-0-acceptance.md`;
- `docs/product/UX_AUDIT.md`;
- `docs/product/UX_BROWSER_EVIDENCE.md`;
- `docs/product/UX_ROADMAP.md`.

## NOW — M7.1 Editor Shell and Responsive Context

M7.1 is the only committed implementation slice.

### Problems owned

- `UX-SHELL-001` — global/project/tool/display/history actions compete and clip;
- `UX-SHELL-002` — contextual inspector disappears below 980 effective CSS px;
- `UX-DATA-001` — local save state is 9 px and too subtle;
- `UX-ACCESS-002` — browser zoom removes functionality rather than reflowing it.

### Goal

Create a stable project/tool/context hierarchy that preserves essential actions and selected-entity controls across supported desktop widths and browser zoom.

### Scope

- separate global product actions from exclusive tools and display toggles;
- preserve project identity, readable `Сохранено локально`, active tool and Undo/Redo;
- move lower-priority utilities into labelled overflow instead of hiding them;
- replace disappearing inspector with a viewport-safe panel/drawer presentation;
- preserve Canvas useful area;
- preserve semantic selection and active workflow during reflow;
- introduce only minimum shared tokens/primitives needed by the shell;
- extend automated layout and browser evidence.

### Acceptance

- 1920×1080, 1440×900, 1366×768 and 1280×800;
- effective 125%, 150% and 200% zoom;
- no document horizontal escape;
- no unreachable selected-entity/workflow controls;
- active tool, save status and history remain available;
- Canvas remains usable;
- full Chromium representative flow;
- WebKit core smoke;
- native Safari core regression on macOS;
- full unit/type/lint/build CI;
- product-owner browser acceptance.

### Non-goals

- redesign every inspector form;
- Canvas/Three.js rewrite;
- editor-store, schema, geometry or persistence changes;
- mobile-first editing;
- new AI/planning features;
- direct 3D editing.

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

These are candidates with dependencies, not an immutable promise. Only M7.1 is `NOW`.

## Deferred infrastructure

Accounts, cloud sync, collaboration, managed AI and billing remain separate initiatives requiring independent security, privacy, migration and operational design. They must not be bundled into M7 merely because the shell is changing.

## Delivery rule for every next slice

1. approved focused design;
2. implementation plan;
3. TDD/layout contracts where feasible;
4. Draft PR;
5. exact-head full CI;
6. representative browser evidence;
7. product-owner acceptance;
8. squash merge;
9. canonical state/roadmap/changelog update.
