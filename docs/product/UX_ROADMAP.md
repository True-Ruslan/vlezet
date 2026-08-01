# Vlezet — M7 UX Implementation Roadmap

**Phase:** M7 Product UX Foundation  
**Last updated:** 2026-08-01  
**Rule:** trust, reachability and interaction hierarchy precede cosmetic consolidation. Only one slice is `NOW`.

## 1. Prioritisation model

Work is ordered by:

1. destructive/data-integrity or incorrect-understanding risk;
2. reach across journeys and surfaces;
3. observed frequency;
4. dependency value for later fixes;
5. implementation and regression risk;
6. confidence of evidence.

Later slices may be reordered from browser evidence, but only through explicit roadmap updates.

## 2. Current sequence

```text
DONE
M7.0 Product and UX Audit
M7.1 Editor Shell and Responsive Context
M7.2 Context Inspector Foundation
M7.3 Design System and Content Components
M7.4 Canvas Selection and Mode Feedback
M7.5 Onboarding, Status and Recovery
M7.6 Geometry and Opening Inspector

NOW
M7.7 Furniture and Fit Workflow

THEN
M7.8 Reference and Recognition Workflow
M7.9 Accessibility and Responsive Hardening
M7.10 2D/3D Context and Interior Readability
M7.11 Planning Workflow Simplification
M7.12 Dashboard and Project Lifecycle
M7.13 Visual Consolidation and Evidence-Driven Polish
```

## 3. Completed foundation

### M7.0 — Product and UX Audit

**Result:** accepted and merged through PR #19 as `0d5b9c1555ef85a0e271a52832cc3fd3cca4963e`.

Delivered 39 structured findings, target information architecture, interaction model, design/accessibility foundations and reproducible Chromium/WebKit browser evidence.

### M7.1 — Editor Shell and Responsive Context

**Problems:** `UX-SHELL-001`, `UX-SHELL-002`, `UX-DATA-001`, foundational `UX-ACCESS-002`  
**Result:** accepted and merged through PR #21 as `6b6f8751b520722a54bb94a6947dae1135e07859`.

Delivered separate project/tool command layers, readable local-save state, directly reachable Undo/Redo, docked/compact side surfaces, preserved form state, no required-matrix horizontal overflow and one-column 3D composition.

### M7.2 — Context Inspector Foundation

**Problems:** `UX-SHELL-003`, foundational `UX-PATTERN-001`, foundational `UX-CONTENT-001`  
**Result:** accepted and merged through PR #23 as `66606356d69f96953f8afae7b914222a3f793777`.

Delivered shared context identity, explicit workflow return, preserved ordinary targets across workflow transitions, fail-closed stale targets, compact close without state loss, consistent danger hierarchy and independently scrollable context bodies.

### M7.3 — Design System and Content Components

**Problems:** foundational `UX-FURN-004`, `UX-REC-004`, `UX-PATTERN-002`, `UX-PATTERN-003`, remaining `UX-CONTENT-001`, `UX-SHELL-005`  
**Result:** accepted and squash-merged through PR #26 as `509dfc02e17c87a58da8356894564a8f27bc5a9b`.

```text
head:       cabe8e44153d7a56ee23e6931ea204e2fbf82119
standard:   30654881419 — PASS
browser:    30654879141 — PASS
artifact:   8802854489
digest:     sha256:1f62c1695231d266a9e28e3a54b40402a85106e231c15ca6e53dc2d577b22b32
merge:      509dfc02e17c87a58da8356894564a8f27bc5a9b
```

Delivered governed semantic tokens, balanced-density typography, shared store-free controls/status primitives, canonical Russian unit formatting and representative migration of high-value surfaces.

Product-owner acceptance:

> «Подтверждаю все!»

### M7.4 — Canvas Selection and Mode Feedback

**Problems:** `UX-SHELL-004`, `UX-CANVAS-001`, `UX-CANVAS-002`  
**Result:** accepted and squash-merged through PR #29 as `399e1b439d478fb8b01cd39795213b42beece84f`.

```text
head:       cd9fe67fb5ea9a2d1647fce5bd7055f6a1c05408
standard:   30686372996 — PASS
browser:    30686372995 — PASS
artifact:   8814078535
digest:     sha256:38544ca0c259c83ddf1be36c484f207cbdb6723215b4fd922ae52e3e2c938926
merge:      399e1b439d478fb8b01cd39795213b42beece84f
```

Delivered one authoritative Canvas mode and next-action status, explicit gesture phases, one-level `Escape`, distinct hover/selection/preview states, cursor roles and compact-width equivalence.

Product-owner acceptance:

> «Все прошло строго и четко как ты описал.»

### M7.5 — Onboarding, Status and Recovery

**Problems:** `UX-ONBOARD-001`, `UX-DATA-003`  
**Result:** accepted and squash-merged through PR #31 as `62413d91ebc5cef335b772e46ebbc1dae18b1acc`.

```text
head:       d59273615ea2f08a4a364b91fe3e3cc408ba9090
standard:   30692400878 — PASS
browser:    30692400874 — PASS
artifact:   8816130412
digest:     sha256:530ebca7ee8f20d5e79fb592a7f80a1c43044bbe750ddec752e24f98c6165581
merge:      62413d91ebc5cef335b772e46ebbc1dae18b1acc
```

Delivered state-derived first-project guidance, per-project browser-local dismissal, durable runtime-only completion/recovery evidence, stale evidence clearing, valid backup retry and compact overlay placement.

Product-owner acceptance:

> «Все работает четко как надо и как ты описал.»

### M7.6 — Geometry and Opening Inspector

**Problems:** `UX-GEO-001`, `UX-GEO-002`, `UX-GEO-003`  
**Result:** accepted and squash-merged through PR #33 as `315828052edb483c34a68464acb70458bf4ff80d`.

Final evidence:

```text
head:       29b631fe43ba1a00e0ad48c71ee5429371d1faa8
standard:   30701887262 / #2212 — PASS
browser:    30701887265 / #330 — PASS
artifact:   8819106567
digest:     sha256:069a3f8105d5123152f12e07b1a62c96809ac2caf02ab65b0fdee4d8a8569669
merge:      315828052edb483c34a68464acb70458bf4ff80d
```

Delivered:

- separate horizontal and vertical clear-room dimension cards;
- wall-axis length distinct from wall thickness;
- visible fixed endpoints and physical surfaces independent of directed-wall internals;
- correct mapping for forward, reverse-directed and diagonal walls;
- opening offsets measured from either visible wall end without moving the opening;
- four accessible and visually distinct runtime-only door-swing previews;
- fail-closed invalid opening drafts;
- compact single-column controls without horizontal overflow;
- one-step semantic Undo for applied room, wall and opening edits.

Product-owner acceptance:

> «Все работает четко строго по описанным тобой шага.»

No schema, persistence, topology, area, snapping, hit-testing, command, recognition, planning or 3D authority changed.

## 4. NOW — M7.7 Furniture and Fit Workflow

**Problems:** `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003`, remaining `UX-FURN-004`  
**Goal:** make furniture discovery, placement, orientation, exact editing and fit/clearance explanation feel like one predictable workflow without weakening M2 authority.

### Product questions to resolve in design

- Which actions should be primary immediately after placement and after later selection?
- How should categories, search, common items and recently used items reduce catalogue scanning?
- How should exact width, depth, rotation and object identity be grouped without recreating a dense property table?
- How should the shortest distance between rotated contours be distinguished from object dimensions?
- How should collisions, door conflicts, hard minimums and recommendations be prioritised?
- Which edits can apply immediately and which need an explicit Apply boundary?
- How can diagnostics lead to valid manual actions without auto-moving furniture?
- How should the workflow behave with a docked panel, compact width, zoom and keyboard navigation?

### Expected scope

- simplify catalogue discovery and selected-object inspector hierarchy;
- prioritise common post-placement actions;
- make object identity, exact dimensions and rotation easy to scan;
- preserve existing transform commands and one-step semantic Undo/Redo;
- visually explain contour-to-contour distance and clearance semantics;
- group fit diagnostics by severity and provide valid next actions;
- preserve Canvas visibility and controls at compact widths;
- use accepted M7.2–M7.6 context, components, feedback and preview patterns;
- add focused content/layout contracts and representative Chromium/WebKit flows.

### Dependencies

- M2 remains containment/collision/door/clearance authority;
- M7.2 owns context anatomy and workflow return;
- M7.3 owns components, typography and status hierarchy;
- M7.4 owns Canvas mode/preview feedback;
- M7.6 provides physical presentation mapping patterns for dimensions and distances.

### Authority boundaries

M7.7 may reorganise catalogue, furniture inspector, fit presentation and command routing around existing operations. It must not:

- change M2 containment, collision, door or clearance algorithms;
- silently auto-move or auto-rotate furniture;
- create a second persistent furniture or fit model in React/Zustand;
- alter `VlezetDocument` or migrations without an independently approved need;
- expand deterministic planning or autonomous furnishing;
- implement recognition-quality work owned by M7.8;
- claim whole-product accessibility completion owned by M7.9;
- perform visual-only consolidation owned by M7.13.

### Acceptance

- ordinary users can find and place common furniture without scanning the full catalogue;
- selected-object identity, dimensions, rotation and primary actions are easy to understand;
- contour distance cannot be mistaken for furniture dimensions;
- fit/collision/door/clearance evidence is prioritised and actionable;
- invalid edits fail closed and preserve authoritative geometry;
- accepted transforms remain one-step semantic Undo/Redo operations;
- compact widths preserve Canvas and inspector reachability;
- M7.1–M7.6 regressions remain green;
- full unit/type/lint/build CI, Chromium full flow, WebKit core smoke and product-owner acceptance pass.

## 5. Later candidate slices

### M7.8 — Reference and Recognition Workflow

**Problems:** `UX-REF-001`, `UX-REC-001`, `UX-REC-003`, remaining `UX-REC-004`, issue #27  
**Goal:** unify source-plan setup and recognition review, then measurably improve wall/opening/room/area accuracy with a versioned benchmark corpus.

### M7.9 — Accessibility and Responsive Hardening

**Problems:** `UX-REF-002`, `UX-REC-002`, `UX-3D-002`, `UX-ACCESS-001`, residual `UX-ACCESS-002`.

### M7.10 — 2D/3D Context and Interior Readability

**Problems:** `UX-3D-001`, `UX-3D-003`.

### M7.11 — Planning Workflow Simplification

**Problems:** `UX-PLAN-001`, `UX-PLAN-002`, `UX-PLAN-003`, `UX-PLAN-004`.

### M7.12 — Dashboard and Project Lifecycle

**Problems:** `UX-DATA-002`, `UX-DASH-001`, `UX-DASH-002`.

### M7.13 — Visual Consolidation and Evidence-Driven Polish

**Goal:** final visual consistency and evidence-driven refinement after workflow and accessibility work.

## 6. Coverage matrix

| Finding | Primary slice |
|---|---|
| `UX-SHELL-001` | M7.1 — complete |
| `UX-SHELL-002` | M7.1 — complete |
| `UX-SHELL-003` | M7.2 — complete |
| `UX-SHELL-004` | M7.4 — complete |
| `UX-SHELL-005` | M7.3 — complete |
| `UX-CANVAS-001` | M7.4 — complete |
| `UX-CANVAS-002` | M7.4 — complete |
| `UX-ONBOARD-001` | M7.5 — complete |
| `UX-GEO-001/002/003` | M7.6 — complete |
| `UX-FURN-001/002/003` | M7.7 — NOW |
| `UX-FURN-004` | M7.3 foundation / M7.7 completion |
| `UX-REF-001` | M7.8 |
| `UX-REC-001/003` | M7.8 |
| `UX-REC-002` | M7.9 |
| issue #27 recognition quality | M7.8 |
| `UX-ACCESS-001` | M7.9 |
| residual `UX-ACCESS-002` | M7.9 |
| `UX-3D-001/003` | M7.10 |
| `UX-PLAN-001/002/003/004` | M7.11 |
| `UX-DATA-003` | M7.5 — complete |
| `UX-DATA-002`, `UX-DASH-001/002` | M7.12 |
| `UX-PATTERN-001` | M7.2/M7.3 — complete |
| `UX-PATTERN-002/003` | M7.3 — complete |
| `UX-CONTENT-001` | M7.2/M7.3 — complete |

## 7. Programme safeguards

Each slice requires focused design, implementation plan, explicit authority non-goals, TDD/layout/content contracts, Draft PR, full CI, Chromium/WebKit evidence, product-owner acceptance, exact-head protected squash merge and post-merge documentation sync.

No slice may silently change geometry semantics, create a second persistent UI truth, make optional AI authoritative or claim browser acceptance from unit tests alone.
