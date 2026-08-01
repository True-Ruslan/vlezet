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

Later slices may be reordered from browser or benchmark evidence, but only through explicit roadmap updates.

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
M7.7 Furniture and Fit Workflow

NOW
M7.8 Reference and Recognition Workflow

THEN
M7.9 Accessibility and Responsive Hardening
M7.10 2D/3D Context and Interior Readability
M7.11 Planning Workflow Simplification
M7.12 Dashboard and Project Lifecycle
M7.13 Visual Consolidation and Evidence-Driven Polish
```

## 3. Completed foundation

### M7.0 — Product and UX Audit

**Result:** accepted and merged through PR #19 as `0d5b9c1555ef85a0e271a52832cc3fd3cca4963e`.

Delivered 39 structured findings, target information architecture, interaction model, design/accessibility foundations and reproducible Chromium/WebKit evidence.

### M7.1 — Editor Shell and Responsive Context

**Problems:** `UX-SHELL-001`, `UX-SHELL-002`, `UX-DATA-001`, foundational `UX-ACCESS-002`  
**Result:** accepted and merged through PR #21 as `6b6f8751b520722a54bb94a6947dae1135e07859`.

### M7.2 — Context Inspector Foundation

**Problems:** `UX-SHELL-003`, foundational `UX-PATTERN-001`, foundational `UX-CONTENT-001`  
**Result:** accepted and merged through PR #23 as `66606356d69f96953f8afae7b914222a3f793777`.

### M7.3 — Design System and Content Components

**Problems:** foundational `UX-FURN-004`, `UX-REC-004`, `UX-PATTERN-002`, `UX-PATTERN-003`, remaining `UX-CONTENT-001`, `UX-SHELL-005`  
**Result:** accepted and merged through PR #26 as `509dfc02e17c87a58da8356894564a8f27bc5a9b`.

### M7.4 — Canvas Selection and Mode Feedback

**Problems:** `UX-SHELL-004`, `UX-CANVAS-001`, `UX-CANVAS-002`  
**Result:** accepted and merged through PR #29 as `399e1b439d478fb8b01cd39795213b42beece84f`.

### M7.5 — Onboarding, Status and Recovery

**Problems:** `UX-ONBOARD-001`, `UX-DATA-003`  
**Result:** accepted and merged through PR #31 as `62413d91ebc5cef335b772e46ebbc1dae18b1acc`.

### M7.6 — Geometry and Opening Inspector

**Problems:** `UX-GEO-001`, `UX-GEO-002`, `UX-GEO-003`  
**Result:** accepted and merged through PR #33 as `315828052edb483c34a68464acb70458bf4ff80d`.

### M7.7 — Furniture and Fit Workflow

**Problems:** `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003`, remaining `UX-FURN-004`  
**Result:** accepted and squash-merged through PR #35 as `4514950b35922e7a757c523baafd4c1287dfe2a6`.

Final evidence:

```text
head:       65c5fca7cbf75620e1411a7463811848009257a8
standard:   30715144250 / #2324 — PASS
browser:    30715144281 / #376 — PASS
artifact:   8823120889
digest:     sha256:a1e5e799679f5f4ea2aa9f52fe13576bfb3375f2c003874e94e6dc27d63a2656
merge:      4514950b35922e7a757c523baafd4c1287dfe2a6
```

Delivered:

- deterministic Russian-aware catalogue search and compact category navigation;
- runtime-only filters, stable counts/order and empty-state recovery;
- M2-derived placement fit labels;
- selected-object hierarchy centred on fit, common parameters, use zones and exact position;
- one atomic Apply operation and one-step semantic Undo;
- field-local fail-closed validation with reveal/focus recovery;
- exact-angle local-side explanation including diagonal directions;
- distinct Canvas meanings for dimensions, recommended zones and actual free distances;
- `Кратчайший зазор` terminology for nearest rotated contours;
- compact-width Chromium/WebKit coverage.

Product-owner acceptance:

> Все проверки прошли, все круто.

No schema, persistence, M2 fit, snapping, history, planning, recognition or 3D authority changed.

## 4. NOW — M7.8 Reference and Recognition Workflow

**Problems:** `UX-REF-001`, `UX-REC-001`, `UX-REC-003`, remaining `UX-REC-004`, issue #27  
**Goal:** unify source-plan setup and recognition review, then measurably improve wall/opening/room/area accuracy with a versioned benchmark corpus while preserving editable Draft and explicit Apply authority.

### Product questions to resolve in design

- How should import, calibration, recognition, AI check and review feel like one understandable workflow?
- Which source-quality problems must be shown before recognition starts?
- How should users review walls, openings, rooms and area relationships rather than dozens of isolated candidates?
- Which benchmark fixtures and metrics prove actual quality improvement?
- How should local CV, optional OpenRouter interpretation and deterministic post-processing divide responsibility?
- How should confidence communicate uncertainty without hiding structural errors?
- How should repeated AI checks preserve valid decisions and discard stale candidate references?
- How can the workflow remain compact, keyboard-reachable and fail closed?

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

### Dependencies

- M4/M4.5 provide source import, calibration and editable recognition Draft;
- M7.2 owns context anatomy and workflow return;
- M7.3 owns shared components, feedback and content hierarchy;
- M7.4 owns Canvas mode/preview semantics;
- M7.5 owns durable operation status and recovery;
- M7.6 provides geometry/opening presentation patterns;
- issue #27 and `docs/product/RECOGNITION_QUALITY_REQUIREMENTS.md` define measurable recognition requirements.

### Authority boundaries

M7.8 may improve benchmark tooling, recognition algorithms, reconciliation, confidence and review presentation. It must not:

- make AI or CV output authoritative;
- silently replace existing geometry;
- bypass deterministic topology/opening validation;
- persist provider keys, raw model responses or transient review state;
- weaken editable Draft and explicit Apply;
- claim whole-product accessibility completion owned by M7.9;
- perform 3D, planning, dashboard or visual-only consolidation work.

### Acceptance

- source setup and recognition review form one understandable workflow;
- benchmark corpus and scoring harness are versioned and reproducible;
- required topology/opening/room/area metrics meet or exceed accepted thresholds;
- the M7.3 observed real-plan failure becomes an anonymised regression fixture;
- invalid openings never reference unknown host walls;
- repeated AI checks leave no stale decisions;
- candidates remain editable and only explicit Apply mutates the document;
- compact widths and keyboard navigation preserve workflow reachability;
- M7.1–M7.7 regressions remain green;
- full unit/type/lint/build CI, benchmark report, Chromium/WebKit and product-owner acceptance pass.

## 5. Later candidate slices

### M7.9 — Accessibility and Responsive Hardening

**Problems:** `UX-REF-002`, `UX-REC-002`, `UX-3D-002`, `UX-ACCESS-001`, residual `UX-ACCESS-002`.

### M7.10 — 2D/3D Context and Interior Readability

**Problems:** `UX-3D-001`, `UX-3D-003`.

### M7.11 — Planning Workflow Simplification

**Problems:** `UX-PLAN-001`, `UX-PLAN-002`, `UX-PLAN-003`, `UX-PLAN-004`.

### M7.12 — Dashboard and Project Lifecycle

**Problems:** `UX-DATA-002`, `UX-DASH-001`, `UX-DASH-002`.

### M7.13 — Visual Consolidation and Evidence-Driven Polish

Final visual consistency and evidence-driven refinement after workflow and accessibility work.

## 6. Coverage matrix

| Finding | Primary slice |
|---|---|
| `UX-SHELL-001/002` | M7.1 — complete |
| `UX-SHELL-003` | M7.2 — complete |
| `UX-SHELL-004` | M7.4 — complete |
| `UX-SHELL-005` | M7.3 — complete |
| `UX-CANVAS-001/002` | M7.4 — complete |
| `UX-ONBOARD-001` | M7.5 — complete |
| `UX-GEO-001/002/003` | M7.6 — complete |
| `UX-FURN-001/002/003/004` | M7.7 — complete |
| `UX-REF-001` | M7.8 — NOW |
| `UX-REC-001/003/004` | M7.8 — NOW |
| issue #27 recognition quality | M7.8 — NOW |
| `UX-REF-002`, `UX-REC-002` | M7.9 |
| `UX-ACCESS-001`, residual `UX-ACCESS-002` | M7.9 |
| `UX-3D-001/003` | M7.10 |
| `UX-PLAN-001/002/003/004` | M7.11 |
| `UX-DATA-003` | M7.5 — complete |
| `UX-DATA-002`, `UX-DASH-001/002` | M7.12 |
| `UX-PATTERN-001/002/003` | M7.2/M7.3 — complete |
| `UX-CONTENT-001` | M7.2/M7.3 — complete |

## 7. Programme safeguards

Each slice requires focused design, implementation plan, explicit authority non-goals, TDD/layout/content contracts, Draft PR, full CI, Chromium/WebKit evidence, product-owner acceptance, exact-head protected squash merge and post-merge documentation sync.

No slice may silently change geometry semantics, create a second persistent UI truth, make optional AI authoritative or claim browser acceptance from unit tests alone.
