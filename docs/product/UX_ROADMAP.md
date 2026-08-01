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

NOW
M7.5 Onboarding, Status and Recovery

THEN
M7.6 Geometry and Opening Inspector
M7.7 Furniture and Fit Workflow
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

**Problems:** `UX-FURN-004`, `UX-REC-004`, `UX-PATTERN-002`, `UX-PATTERN-003`, remaining `UX-CONTENT-001`, `UX-SHELL-005`  
**Result:** accepted and squash-merged through PR #26 as `509dfc02e17c87a58da8356894564a8f27bc5a9b`.

Final evidence:

```text
head:       cabe8e44153d7a56ee23e6931ea204e2fbf82119
standard:   30654881419 — PASS
browser:    30654879141 — PASS
artifact:   8802854489
digest:     sha256:1f62c1695231d266a9e28e3a54b40402a85106e231c15ca6e53dc2d577b22b32
merge:      509dfc02e17c87a58da8356894564a8f27bc5a9b
```

Delivered:

- governed semantic tokens and balanced-density typography;
- store-free buttons, fields, messages, notices, badges, cards, empty states and dialogs;
- consistent focus, disabled, busy, success, warning and error states;
- canonical Russian number/unit formatting;
- representative migration of room, catalogue, fit, dashboard, dialogs and recognition UI;
- Canvas helper text at the governed minimum;
- strict Chromium/WebKit coverage preserving M7.1/M7.2;
- OpenRouter response healing and stale recognition-decision cleanup discovered during manual acceptance.

Product-owner acceptance:

> «Подтверждаю все!»

Recognition detection accuracy is explicitly not claimed as complete. The future contract is `docs/product/RECOGNITION_QUALITY_REQUIREMENTS.md`; issue #27 is owned by M7.8.

### M7.4 — Canvas Selection and Mode Feedback

**Problems:** `UX-SHELL-004`, `UX-CANVAS-001`, `UX-CANVAS-002`  
**Result:** accepted and squash-merged through PR #29 as `399e1b439d478fb8b01cd39795213b42beece84f`.

Final evidence:

```text
head:       cd9fe67fb5ea9a2d1647fce5bd7055f6a1c05408
standard:   30686372996 — PASS
browser:    30686372995 — PASS
artifact:   8814078535
digest:     sha256:38544ca0c259c83ddf1be36c484f207cbdb6723215b4fd922ae52e3e2c938926
merge:      399e1b439d478fb8b01cd39795213b42beece84f
```

Delivered:

- one authoritative Canvas mode and next-action status;
- active-tool feedback for selection, wall/opening drawing, measurement, placement, tracing/review and read-only 3D;
- explicit first-point and second-point phases;
- one-level `Escape` priority;
- distinct hover, selection, valid-preview and invalid-preview treatments;
- state-derived cursor feedback;
- live opening-preview labels;
- compact-width equivalence plus Chromium/WebKit regression coverage.

Product-owner acceptance:

> «Все прошло строго и четко как ты описал.»

Geometry, snapping, hit tolerance, selection ordering, history and persistence authority were unchanged.

## 4. NOW — M7.5 Onboarding, Status and Recovery

**Problems:** `UX-ONBOARD-001`, `UX-DATA-003`  
**Goal:** guide the first successful closed room without a blocking wizard and keep important completion or recovery evidence available after transient notifications disappear.

### Product questions to resolve in design

- What is the smallest dismissible checklist that leads from an empty project to a valid closed room?
- Which progress steps can be derived directly from existing document/editor state?
- How is successful room closure acknowledged without duplicating room/topology authority?
- Which events are minor enough for a toast, and which require durable in-context evidence?
- Where should durable completion evidence live so it remains attributable to the originating action?
- What recovery action is valid for each selected high-impact failure state?
- How should dismissed onboarding behave across project reopen without changing `VlezetDocument`?

### Expected scope

- dismissible first-project checklist;
- contextual next action from empty project through closed-room success;
- explicit successful-room-closure feedback;
- progress derived from existing editor/document state;
- durable in-context evidence for selected high-impact completion events;
- minor toasts retained for low-impact feedback;
- clear retry/recovery copy where an existing operation supports recovery;
- representative Chromium/WebKit flows including compact width and post-toast verification.

### Dependencies

- accepted M7.1 project/tool hierarchy and readable save status;
- accepted M7.2 context anatomy and workflow return;
- accepted M7.3 component/status primitives;
- accepted M7.4 active-mode and next-action feedback.

### Authority boundaries

M7.5 may derive presentation progress and completion state from existing authoritative operations. It must not:

- alter wall topology, room derivation or geometry algorithms;
- create an onboarding copy of apartment geometry;
- auto-generate or silently close rooms;
- change semantic history or command grouping;
- add onboarding fields to `VlezetDocument`;
- replace project lifecycle, export/import or recovery authority;
- implement later inspector, recognition or accessibility slices.

### Acceptance

- a first-time user can create and recognise a closed rectangular room without external instruction;
- onboarding is dismissible and does not block expert use;
- checklist progress follows authoritative state and cannot become a second product truth;
- room-closure success is understandable without relying only on a short toast;
- selected high-impact completion remains confirmable after the toast expires;
- failure/recovery evidence identifies the originating action and valid next step;
- switching project or restoring state does not leave misleading onboarding/completion evidence;
- compact widths preserve task reachability;
- M7.1–M7.4 regressions remain green;
- full unit/type/lint/build CI, Chromium full flow, WebKit core smoke and product-owner acceptance pass.

## 5. Later candidate slices

### M7.6 — Geometry and Opening Inspector

**Problems:** `UX-GEO-001`, `UX-GEO-002`, `UX-GEO-003`  
**Goal:** make clear dimensions, wall-axis/thickness semantics and door swing visually predictable.

### M7.7 — Furniture and Fit Workflow

**Problems:** `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003`, remaining `UX-FURN-004`  
**Goal:** prioritise common edits, explain orientation/clearances and improve catalogue discovery.

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
| `UX-ONBOARD-001` | M7.5 |
| `UX-GEO-001/002/003` | M7.6 |
| `UX-FURN-001/002/003` | M7.7 |
| `UX-FURN-004` | M7.3 foundation / M7.7 completion |
| `UX-REF-001` | M7.8 |
| `UX-REC-001/003` | M7.8 |
| `UX-REC-002` | M7.9 |
| issue #27 recognition quality | M7.8 |
| `UX-ACCESS-001` | M7.9 |
| residual `UX-ACCESS-002` | M7.9 |
| `UX-3D-001/003` | M7.10 |
| `UX-PLAN-001/002/003/004` | M7.11 |
| `UX-DATA-003` | M7.5 |
| `UX-DATA-002`, `UX-DASH-001/002` | M7.12 |
| `UX-PATTERN-001` | M7.2/M7.3 — complete |
| `UX-PATTERN-002/003` | M7.3 — complete |
| `UX-CONTENT-001` | M7.2/M7.3 — complete |

## 7. Programme safeguards

Each slice requires focused design, implementation plan, explicit authority non-goals, TDD/layout/content contracts, Draft PR, full CI, Chromium/WebKit evidence, product-owner acceptance, exact-head protected squash merge and post-merge documentation sync.

No slice may silently change geometry semantics, create a second persistent UI truth, make optional AI authoritative or claim browser acceptance from unit tests alone.
