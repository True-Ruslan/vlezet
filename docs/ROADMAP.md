# Vlezet — Roadmap

**Last updated:** 2026-08-03  
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
DONE        M6.1–M6.4 deterministic planning and reviewed intent
DONE        M7.0–M7.7 product and UX foundation
DONE        M7.8A Recognition Benchmark Foundation
DONE        M7.8B Source Normalisation and Wall Topology
NOW         M7.8C Opening Classification and Host-Wall Validation
LATER       remaining M7.8 recognition slices and M7.9–M7.13
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

### M7.0–M7.7 — product and UX foundation

- product/UX audit and structured findings;
- responsive editor shell and reachable project/tool commands;
- unified context inspector and workflow return;
- governed design tokens and shared components;
- authoritative Canvas mode, selection and preview semantics;
- state-derived onboarding, durable status and recovery;
- explicit room dimensions and accessible opening controls;
- searchable furniture catalogue and M2-derived fit workflow.

## Completed M7.8 foundation

### M7.8A — Recognition Benchmark Foundation

Status: **DONE / ACCEPTED / MERGED**.

Delivered:

- versioned anonymised fixture corpus;
- deterministic Core and Chromium/OpenCV Source scoring;
- geometry, topology, opening, room, confidence and reconciliation metrics;
- reviewed baseline and checksummed evidence bundle;
- production Worker/shared-engine equivalence;
- no live provider calls in merge-blocking CI.

### M7.8B — Source Normalisation and Wall Topology

Status: **DONE / PRODUCT-ACCEPTED WITH KNOWN PRECISION LIMITATIONS**.

Delivered:

- corrected calibration magnifier and direction-independent orientation;
- structural-mask normalisation and region-first wall extraction;
- bounded Hough fallback;
- deterministic transient wall topology;
- clutter-heavy candidate-overload protection;
- restore-time sanitisation of overloaded Drafts;
- verification-only AI bound to exact local IDs and coordinates;
- rejection of cloud-only, moved, unbounded and overloaded geometry;
- nine-fixture benchmark authority;
- experimental evidence-gated wall completion retained but disabled in runtime after neutral product evidence.

Representative product result:

```text
local wall candidates: 27
confirmed after AI:     19
remaining for review:   8
openings:               0 (deferred)
```

Accepted benchmark:

```text
Source geometry F1: 0.837989
Source topology F1: 0.837989
incorrect high-confidence: 0
unknown-host openings: 0
stale decisions: 0
```

Known accepted limitations:

- some true walls remain missed or fragmented;
- confidence classification remains imperfect;
- perspective-photo recognition remains unresolved;
- stronger models verify more candidates but cannot add missing geometry;
- the final M7.8 topology target of `0.90` is not yet reached.

## NOW — M7.8C Opening Classification and Host-Wall Validation

### Problem

M7.8B intentionally returns no accepted local openings. Gap hypotheses exist, but the system does not yet reliably determine:

- whether a gap represents a door, a window or noise;
- which wall hosts the opening;
- whether the opening lies fully within a valid wall span;
- whether applying it would corrupt topology or room derivation.

### Goal

Classify and validate openings while preserving fail-closed review and deterministic document authority.

### Required delivery order

1. versioned opening hypothesis representation;
2. deterministic door/window/unknown classification features;
3. host-wall matching and bounded placement validation;
4. conflict detection for corners, junctions and overlapping openings;
5. confidence calibration and explicit pending/rejected states;
6. opening-heavy and service-block regression expansion;
7. browser review UX for type and host-wall evidence;
8. exact-head Core/Source benchmark, Chromium/WebKit and product-owner acceptance.

### Acceptance targets

- door/window F1 at least `0.85` on the accepted corpus before M7.8C completion;
- zero accepted openings with unknown host walls;
- zero accepted openings outside their host-wall span;
- zero stale decisions after repeated local or AI checks;
- ambiguous gaps remain pending or rejected rather than guessed;
- AI may verify classification evidence but cannot create or reposition openings;
- Draft remains editable and only explicit Apply mutates the document;
- M7.8A/B, M2, history, persistence, planning and 3D do not regress.

### Non-goals

- authoritative AI geometry;
- silent replacement of existing walls/openings;
- room-face derivation before host-wall correctness;
- OCR/area reconciliation;
- unrelated accessibility, 3D, planning or dashboard work.

## Remaining M7.8 programme

```text
M7.8D  Room-Face Derivation
M7.8E  OCR, Labels and Area Constraints
M7.8F  Hybrid Reconciliation and Confidence Calibration
M7.8G  Room-Oriented Review Workflow and Final Acceptance
```

## Later M7 programme

```text
M7.9  Accessibility and Responsive Hardening
M7.10 2D/3D Context and Interior Readability
M7.11 Planning Workflow Simplification
M7.12 Dashboard and Project Lifecycle
M7.13 Visual Consolidation and Evidence-Driven Polish
```

## Delivery rule

Every slice requires focused design, implementation plan, TDD/layout contracts, Draft PR, full CI, benchmark evidence where applicable, browser evidence, product-owner acceptance, exact-head squash merge and canonical documentation sync.
