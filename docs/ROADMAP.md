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
DONE        M7.2 Context Inspector Foundation
NOW         M7.3 Design System and Content Components
LATER       M7.4+ in dependency-aware browser-tested slices
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
final verified head: 8c68bd288cd3dda1133f09a469cd7afe6dab83d9
standard CI:         30586557182 — PASS
browser CI:          30586557394 — PASS
artifact:            8776737145
merge:               6b6f8751b520722a54bb94a6947dae1135e07859
```

Delivered separate project/tool bars, readable save state, direct Undo/Redo, responsive catalogue/context surfaces, preserved local drafts and a clean one-column 3D composition.

Product owner confirmed:

> «Я все проверил. Выглядит уже лучше и понятнее.»

Canonical evidence: `docs/milestones/m7-1-acceptance.md`.

## M7.2 — Context Inspector Foundation

Status: **DONE / ACCEPTED / MERGED**.

```text
PR:                  #23
final verified head: d3231a09541c2c4cf10a48e69f4e485d15a06a0a
standard CI:         30625797753 — PASS
browser CI:          30625797756 — PASS
artifact:            8791323487
digest:              sha256:e167a0944674de6a99fc07dfaa7d5bcc0eea3b1c1cce575ce1d5b1ef961dfb12
merge:               66606356d69f96953f8afae7b914222a3f793777
```

Resolved:

- `UX-SHELL-003` — workflows now preserve and restore one ordinary context;
- foundational `UX-PATTERN-001` — shared header, sections, actions and danger hierarchy;
- foundational `UX-CONTENT-001` — understandable entity/workflow identity and action language;
- right-side context clipping — long panels now scroll within the viewport.

Delivered:

- one context anatomy for empty, wall, room, opening, object and bounded workflows;
- explicit `К комнате…` and `К предмету…` return actions;
- workflow-to-workflow preservation of the original ordinary target;
- fail-closed stale-target handling;
- compact close that hides presentation without destroying workflow or draft state;
- separated destructive actions and accurate consequences;
- viewport-constrained context frame with independent body scrolling;
- Chromium/WebKit regression that scrolls to and opens `Варианты расстановки`.

Product owner confirmed:

> «Теперь все работает супер четко.»

Canonical evidence: `docs/milestones/m7-2-acceptance.md`.

## NOW — M7.3 Design System and Content Components

### Problems

- essential typography and spacing remain partially duplicated;
- fields, helper text, errors, notices, badges, cards and dialogs do not yet share one governed state model;
- residual microtext and terminology inconsistencies reduce readability;
- later workflow-specific redesigns need stable primitives first.

Owned findings:

- `UX-FURN-004`;
- `UX-REC-004`;
- `UX-PATTERN-002`;
- `UX-PATTERN-003`;
- remaining `UX-CONTENT-001`;
- `UX-SHELL-005`.

### Goal

Create a small, explicit visual/content system for readable typography, spacing, common controls, statuses and canonical Russian terminology while preserving M7.1 shell and M7.2 context semantics.

### Scope

- typography, spacing, radius, border and elevation tokens needed by current HTML UI;
- shared field, help, error, notice, badge, card and dialog primitives;
- consistent focus, disabled, loading, success, warning and error states;
- canonical terminology and unit formatting;
- representative migration across shell, context and workflow surfaces;
- remove evidence-backed microtext below the target readable scale;
- Chromium/WebKit coverage for representative states.

### Acceptance

- essential text meets documented readable tokens;
- representative fields and notices expose non-colour state cues;
- focus and error states remain visible at required effective widths;
- terminology is consistent across migrated surfaces;
- M7.1 shell and M7.2 context/scroll behaviour do not regress;
- no project/domain/geometry/persistence authority change;
- full CI and Chromium/WebKit representative flow pass;
- product-owner acceptance before merge.

### Non-goals

- complete geometry/furniture/reference/recognition/planning workflow redesign;
- new geometry, persistence, AI or planning semantics;
- Canvas/3D rewrite;
- final whole-product visual polish;
- mobile-first editor.

## Later M7 programme

```text
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
