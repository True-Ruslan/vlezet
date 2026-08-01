# Vlezet — Roadmap

**Last updated:** 2026-08-01  
**Rule:** deterministic product truth and user trust come before visual spectacle, feature count or speculative AI layers.

Read `docs/PROJECT_STATE.md` first. Detailed UX sequencing is in `docs/product/UX_ROADMAP.md`.

> **Repository maintenance note (2026-08-01):** README canonical portfolio link rollout completed through PR #36 (`5ac744c` → squash `accbf57`), exact-head CI #2318 / run `30714871143` PASS and canonical sync `1aa82a3`. This does not alter roadmap sequencing; M7.8 is `NOW`.

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
DONE        M7.5 Onboarding, Status and Recovery
DONE        M7.6 Geometry and Opening Inspector
DONE        M7.7 Furniture and Fit Workflow
NOW         M7.8 Reference and Recognition Workflow
LATER       M7.9–M7.13 in dependency-aware browser-tested slices
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

### M7.0–M7.6

The accepted UX foundation includes:

- product/UX audit and structured findings;
- responsive editor shell and reachable project/tool commands;
- unified context inspector and workflow return;
- governed design tokens and shared content/status components;
- authoritative Canvas mode, selection and preview semantics;
- state-derived onboarding, durable status and recovery;
- explicit room dimensions, wall-axis/thickness separation and accessible opening controls.

Canonical merge commits are recorded in `docs/PROJECT_STATE.md` and `docs/product/UX_ROADMAP.md`.

### M7.7 — Furniture and Fit Workflow

Status: **DONE / ACCEPTED / MERGED**.

```text
PR:                  #35
final accepted head: 65c5fca7cbf75620e1411a7463811848009257a8
standard CI:         30715144250 / #2324 — PASS
browser CI:          30715144281 / #376 — PASS
artifact:            8823120889
digest:              sha256:a1e5e799679f5f4ea2aa9f52fe13576bfb3375f2c003874e94e6dc27d63a2656
merge:               4514950b35922e7a757c523baafd4c1287dfe2a6
```

Delivered:

- deterministic Russian-aware catalogue search and compact categories;
- runtime-only filtering, stable counts/order and empty-state recovery;
- M2-derived non-colour placement fit labels;
- selected-object hierarchy for fit, common parameters, use zones and exact position;
- one atomic Apply operation and one-step semantic Undo;
- field-local fail-closed validation with reveal/focus recovery;
- exact-angle orientation explanation including diagonal directions;
- Canvas legend for dimensions, recommended zones and actual free distances;
- `Кратчайший зазор` terminology for nearest rotated contours;
- compact-width Chromium/WebKit coverage.

Product owner confirmed:

> Все проверки прошли, все круто.

No schema, persistence, M2 fit, snapping, history, planning, recognition or 3D authority changed.

## NOW — M7.8 Reference and Recognition Workflow

### Problems

- source-plan setup, calibration, recognition, optional AI check and review still feel like separate technical stages;
- valid structured responses can produce incorrect wall topology, openings, rooms and area relationships;
- confidence currently does not guarantee structural correctness;
- recognition quality lacks an accepted versioned benchmark corpus and reproducible score report;
- review remains candidate-oriented rather than room/topology-oriented;
- repeated AI checks must never leave stale decisions or unknown-host openings.

Owned findings and issue:

- `UX-REF-001`;
- `UX-REC-001`;
- `UX-REC-003`;
- remaining `UX-REC-004`;
- issue #27.

### Goal

Unify source-plan setup and recognition review, then measurably improve wall topology, openings, rooms and area accuracy with a versioned benchmark corpus while preserving editable Draft and explicit Apply authority.

### Required delivery order

1. versioned anonymised benchmark corpus and scoring harness;
2. source normalisation and architectural-line filtering;
3. wall topology graph;
4. door/window classification and host-wall validation;
5. room-face derivation;
6. OCR/room-label and area constraints;
7. hybrid reconciliation and confidence calibration;
8. room-oriented review UX;
9. exact-head benchmark report plus Chromium/WebKit and product-owner acceptance.

### Initial measurable targets

- exact spatial-zone count on at least 90% of benchmark plans;
- median total-area error no greater than 5%;
- median room-area error no greater than 10% and no greater than 0.5 m² where practical;
- wall topology F1 at least 0.90;
- door/window detection F1 at least 0.85;
- incorrect high-confidence candidates at most 2%;
- zero unknown-host openings after post-processing;
- zero stale decisions referencing removed candidates.

### Acceptance

- source setup and recognition review form one understandable workflow;
- benchmark corpus and scoring harness are versioned and reproducible;
- accepted benchmark thresholds are met;
- the plan observed during M7.3 manual acceptance becomes an anonymised regression fixture;
- invalid openings never reference unknown host walls;
- repeated AI checks leave no stale decisions;
- candidates remain editable and only explicit Apply mutates the document;
- compact widths and keyboard navigation preserve workflow reachability;
- M7.1–M7.7 do not regress;
- full CI, benchmark report, Chromium/WebKit and product-owner acceptance pass.

### Non-goals

- making AI/CV output authoritative;
- silently replacing existing geometry;
- bypassing deterministic validation or explicit Apply;
- persisting provider keys, raw model responses or transient review state;
- whole-product accessibility completion owned by M7.9;
- 3D, planning, dashboard or visual-only consolidation work.

## Later M7 programme

```text
M7.9  Accessibility and Responsive Hardening
M7.10 2D/3D Context and Interior Readability
M7.11 Planning Workflow Simplification
M7.12 Dashboard and Project Lifecycle
M7.13 Visual Consolidation and Evidence-Driven Polish
```

Later slices remain evidence-driven and may be reordered after accepted browser or benchmark evidence.

## Deferred infrastructure

Accounts, cloud sync, collaboration, managed AI and billing remain separate initiatives requiring independent security, privacy, migration and operational design.

## Delivery rule

Every slice requires focused design, implementation plan, TDD/layout contracts, Draft PR, full CI, benchmark evidence where applicable, browser evidence, product-owner acceptance, exact-head squash merge and canonical documentation sync.
