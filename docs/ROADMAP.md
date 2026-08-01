# Vlezet — Roadmap

**Last updated:** 2026-08-01  
**Rule:** deterministic product truth and user trust come before visual spectacle, feature count or speculative AI layers.

Read `docs/PROJECT_STATE.md` first. Detailed UX sequencing is in `docs/product/UX_ROADMAP.md`.

> **Repository maintenance note (2026-08-01):** README canonical portfolio link rollout completed through PR #36 (`5ac744c` → squash `accbf57`), exact-head CI #2318 / run `30714871143` PASS. This does not alter roadmap sequencing; M7.7 remains `NOW`.


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
NOW         M7.7 Furniture and Fit Workflow
LATER       M7.8+ in dependency-aware browser-tested slices
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

Delivered governed design tokens, balanced-density typography, shared UI/status primitives, Russian unit formatting and representative migration of high-value surfaces.

Product owner confirmed:

> «Подтверждаю все!»

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

Delivered authoritative Canvas mode/next-action feedback, gesture phases, one-level Escape, distinct hover/selection/preview states, cursor roles and compact-width equivalence.

Product owner confirmed:

> «Все прошло строго и четко как ты описал.»

### M7.5 — Onboarding, Status and Recovery

Status: **DONE / ACCEPTED / MERGED**.

```text
PR:                  #31
final accepted head: d59273615ea2f08a4a364b91fe3e3cc408ba9090
standard CI:         30692400878 — PASS
browser CI:          30692400874 — PASS
artifact:            8816130412
digest:              sha256:530ebca7ee8f20d5e79fb592a7f80a1c43044bbe750ddec752e24f98c6165581
merge:               62413d91ebc5cef335b772e46ebbc1dae18b1acc
```

Delivered state-derived onboarding, browser-local dismissal, durable runtime-only completion/recovery evidence, stale evidence clearing, valid backup retry and compact overlay placement.

Product owner confirmed:

> «Все работает четко как надо и как ты описал.»

### M7.6 — Geometry and Opening Inspector

Status: **DONE / ACCEPTED / MERGED**.

```text
PR:                  #33
final accepted head: 29b631fe43ba1a00e0ad48c71ee5429371d1faa8
standard CI:         30701887262 / #2212 — PASS
browser CI:          30701887265 / #330 — PASS
artifact:            8819106567
digest:              sha256:069a3f8105d5123152f12e07b1a62c96809ac2caf02ab65b0fdee4d8a8569669
merge:               315828052edb483c34a68464acb70458bf4ff80d
```

Delivered:

- explicit horizontal/vertical room clear dimensions;
- wall-axis length separated from wall thickness;
- visible fixed endpoints and physical surfaces independent of wall direction;
- equivalent opening offsets from either visible wall end;
- four accessible and distinct door-swing previews;
- fail-closed invalid drafts;
- compact layout without horizontal overflow;
- one-step semantic Undo for accepted geometry edits.

Product owner confirmed:

> «Все работает четко строго по описанным тобой шага.»

No schema, topology, area, persistence, history, recognition, planning or 3D authority changed.

## NOW — M7.7 Furniture and Fit Workflow

### Problems

- catalogue discovery requires too much scanning for common objects;
- selected-furniture editing distributes identity, dimensions, rotation and actions across dense controls;
- shortest contour distance can be mistaken for furniture dimensions;
- collision, door and clearance evidence needs clearer prioritisation and next actions;
- placement and later editing do not yet feel like one continuous workflow.

Owned findings:

- `UX-FURN-001`;
- `UX-FURN-002`;
- `UX-FURN-003`;
- remaining `UX-FURN-004`.

### Goal

Make furniture discovery, placement, orientation, exact editing and fit/clearance explanation feel like one predictable workflow without weakening M2 fit authority.

### Expected scope

- simplify catalogue categories, search and common/recent object discovery;
- prioritise common actions immediately after placement and later selection;
- make object identity, exact dimensions and rotation easy to scan;
- preserve existing transform commands and semantic Undo/Redo;
- visually distinguish contour distance from furniture dimensions;
- group fit, collision, door and clearance diagnostics by severity;
- provide valid manual next actions without auto-moving objects;
- preserve Canvas and controls at compact widths;
- add focused content/layout contracts and Chromium/WebKit representative flows.

### Acceptance

- common furniture can be found and placed without scanning the full catalogue;
- selected-object dimensions, orientation and primary actions are understandable;
- contour distance cannot be confused with object dimensions;
- fit evidence is prioritised and actionable;
- invalid edits fail closed without mutating authoritative geometry;
- accepted transforms retain one-step semantic Undo/Redo;
- compact widths preserve Canvas and inspector reachability;
- M7.1–M7.6 do not regress;
- full CI, Chromium/WebKit and product-owner acceptance pass.

### Non-goals

- changing M2 containment, collision, door or clearance algorithms;
- silent auto-move/auto-rotation or autonomous furnishing;
- new persistent furniture/fit authority in React or Zustand;
- recognition-quality hardening owned by M7.8;
- whole-product accessibility completion owned by M7.9;
- visual-only consolidation owned by M7.13.

## Later M7 programme

```text
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
