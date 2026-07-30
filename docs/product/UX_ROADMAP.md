# Vlezet — M7 UX Implementation Roadmap

**Phase:** M7 Product UX Foundation  
**Last updated:** 2026-07-31  
**Rule:** trust, reachability and interaction hierarchy precede cosmetic consolidation  
**Evidence:** accepted source/browser audit plus M7.1 acceptance in `docs/milestones/m7-1-acceptance.md`

## 1. Prioritisation model

Work is ordered by:

1. destructive/data-integrity or incorrect-understanding risk;
2. reach across journeys and surfaces;
3. observed/reasonable frequency;
4. dependency value for later fixes;
5. implementation and regression risk;
6. confidence of evidence.

No false-precision numeric score is used. Later slices may be reordered from browser evidence, but only one slice is `NOW`.

## 2. Programme tiers

| Tier | Meaning |
|---|---|
| Critical correction | P0/P1 trust, reachability or accessibility blocker |
| Foundation | cross-surface P2 and prerequisite system work |
| Workflow improvement | bounded journey-level P1/P2 |
| Accessibility hardening | keyboard, semantics, zoom and non-colour gaps |
| Visual consolidation | P3 consistency after structure is correct |
| Optional polish | P4 evidence-driven refinements |

## 3. Current sequence

```text
DONE
M7.0 Product and UX Audit
M7.1 Editor Shell and Responsive Context

NOW
M7.2 Context Inspector Foundation

THEN
M7.3 Design System and Content Components
M7.4 Canvas Selection and Mode Feedback
M7.5 Onboarding, Status and Recovery
M7.6 Geometry and Opening Inspector
M7.7 Furniture and Fit Workflow
M7.8 Reference and Recognition Workflow
M7.9 Accessibility and Responsive Hardening
M7.10 2D/3D Context and Interior Readability
M7.11 Planning Workflow Simplification
M7.12 Dashboard and Project Lifecycle
M7.13 Visual Consolidation and Evidence-Driven Polish
```

The sequence is dependency-aware, not a promise to implement every later slice unchanged.

## 4. Completed slice — M7.1 Editor Shell and Responsive Context

**Problems:** `UX-SHELL-001`, `UX-SHELL-002`, `UX-DATA-001`, foundational part of `UX-ACCESS-002`  
**Result:** accepted and squash-merged through PR #21 as `6b6f8751b520722a54bb94a6947dae1135e07859`.

Delivered:

- separate project and editing command layers;
- readable `Сохранено локально` state;
- directly reachable Undo/Redo;
- labelled secondary-actions disclosure;
- docked side surfaces on wide layouts;
- non-modal left/right sheets at compact effective widths;
- preserved selection and uncommitted form state;
- no horizontal document escape across required viewports/zoom equivalents;
- dedicated one-column 3D composition;
- strict Chromium/WebKit blocking browser gate.

Final evidence:

```text
head:       8c68bd288cd3dda1133f09a469cd7afe6dab83d9
standard:   30586557182 — PASS
browser:    30586557394 — PASS
artifact:   8776737145
merge:      6b6f8751b520722a54bb94a6947dae1135e07859
```

Remaining `UX-ACCESS-002` end-to-end hardening stays with M7.9.

## 5. NOW — M7.2 Context Inspector Foundation

**Problems:** `UX-SHELL-003`, `UX-PATTERN-001`, part of `UX-CONTENT-001`  
**Goal:** one predictable context/workflow panel anatomy with selection identity, shared header, back/close behaviour, sections, action hierarchy and safe workflow return context.

### Scope

- define a shared context header with entity/workflow identity;
- establish empty, wall, room, opening and object shell states;
- unify close/back behaviour between context and embedded workflows;
- define reusable section anatomy and spacing;
- place primary, secondary and destructive actions predictably;
- preserve selection and uncommitted drafts across M7.1 docked/sheet presentation;
- retain existing domain components and commands during the anatomy migration;
- extend Chromium/WebKit evidence for representative context transitions.

### Dependencies

- accepted M7.0 information architecture and interaction model;
- accepted M7.1 responsive context container;
- existing selection/workflow stores and commands.

### Non-goals

- complete domain-specific form redesign;
- broad token/component migration assigned to M7.3;
- new geometry, persistence, planning or AI semantics;
- Canvas/Three.js rewrite;
- mobile-first editing.

### Acceptance

- selection identity is always visible and understandable;
- existing wall/room/opening/object actions remain reachable;
- workflow close/back returns to the correct underlying context;
- drafts survive presentation close/reopen where the current component already owns them;
- destructive actions are visually separated and explicit;
- docked and compact surfaces share one semantic anatomy;
- no `VlezetDocument`, schema, migration, IndexedDB, geometry or planner-authority change;
- full CI, Chromium representative flow and WebKit core smoke pass;
- product-owner browser acceptance before merge.

**Risk:** medium. Context composition is broad, but domain commands and stores remain authoritative and unchanged.

## 6. Later candidate slices

### M7.3 — Design System and Content Components

**Problems:** `UX-FURN-004`, `UX-REC-004`, `UX-PATTERN-002`, `UX-PATTERN-003`, `UX-CONTENT-001`, `UX-SHELL-005`  
**Goal:** implement shared readable typography, tokens, fields, notices, badges, cards, dialogs and canonical Russian terminology.  
**Dependencies:** M7.1–M7.2 shell/context contracts.  
**Acceptance:** essential text meets target tokens; representative focus/error/state and browser regression pass.

### M7.4 — Canvas Selection and Mode Feedback

**Problems:** `UX-SHELL-004`, `UX-CANVAS-001`, `UX-CANVAS-002`  
**Goal:** make active tool, next action, selection target and temporary spatial state obvious.  
**Acceptance:** overlap scenarios, all tools, measurement, tracing, recognition and planning Preview remain deterministic and non-mutating.

### M7.5 — Onboarding, Status and Recovery

**Problems:** `UX-ONBOARD-001`, `UX-DATA-003`  
**Goal:** guide the first successful room and make important async completion/recovery durable.  
**Acceptance:** first-room and failure/retry browser paths pass without obstructing experienced editing.

### M7.6 — Geometry and Opening Inspector

**Problems:** `UX-GEO-001`, `UX-GEO-002`, `UX-GEO-003`  
**Goal:** make clear dimensions, wall-axis/thickness semantics and door swing visually predictable.  
**Acceptance:** existing 3550×3300→11.72 m² regression, anchors/alignment, door swing and Undo/Redo pass.

### M7.7 — Furniture and Fit Workflow

**Problems:** `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003`, `UX-FURN-004`  
**Goal:** prioritise common edits, explain local orientation/clearances and improve catalogue discovery.  
**Acceptance:** rotate/local-direction, fit diagnostics, long names, search keyboard path and M2 authority pass.

### M7.8 — Reference and Recognition Workflow

**Problems:** `UX-REF-001`, `UX-REC-001`, `UX-REC-003`, `UX-REC-004`  
**Goal:** unify source-plan configuration and recognition review around clear phases and Draft/Applied semantics.  
**Acceptance:** import/calibration/tracing/local/cloud/stale/empty/Apply/discard scenarios; no silent geometry replacement.

### M7.9 — Accessibility and Responsive Hardening

**Problems:** `UX-REF-002`, `UX-REC-002`, `UX-3D-002`, `UX-ACCESS-001`, residual `UX-ACCESS-002`  
**Goal:** close end-to-end keyboard/focus/non-colour/zoom gaps after foundational components exist.  
**Acceptance:** documented accessibility matrix and WCAG 2.2 AA checks for applicable HTML UI.

### M7.10 — 2D/3D Context and Interior Readability

**Problems:** `UX-3D-001`, `UX-3D-003`  
**Goal:** align semantic inspection across 2D/3D and make the first read-only 3D frame useful for interior understanding.  
**Acceptance:** paired room/wall/object scenarios and representative furnished-room interior visibility pass.

### M7.11 — Planning Workflow Simplification

**Problems:** `UX-PLAN-001`, `UX-PLAN-002`, `UX-PLAN-003`, `UX-PLAN-004`  
**Goal:** organise planning into understandable intent, constraints and results phases while preserving deterministic authority.  
**Acceptance:** M6.1–M6.4 scenarios, Preview/Apply/Undo/Redo, exact witness and offline/manual path pass.

### M7.12 — Dashboard and Project Lifecycle

**Problems:** `UX-DATA-002`, `UX-DASH-001`, `UX-DASH-002`  
**Goal:** make projects visually distinguishable and backup/restore understandable.  
**Acceptance:** empty/many projects, long names, duplicate/delete/import/export/recovery and local-first messaging pass.

### M7.13 — Visual Consolidation and Evidence-Driven Polish

**Problem:** remaining P3 findings and later browser evidence.  
**Goal:** final visual consistency, motion, spacing and refinement without hiding precision.  
**Acceptance:** visual/browser regression and no functionality regression.

## 7. P0–P2 coverage matrix

| Finding | Primary slice |
|---|---|
| `UX-SHELL-001` | M7.1 — complete |
| `UX-SHELL-002` | M7.1 — complete |
| `UX-SHELL-003` | M7.2 |
| `UX-ONBOARD-001` | M7.5 |
| `UX-CANVAS-001` | M7.4 |
| `UX-CANVAS-002` | M7.4 |
| `UX-GEO-001` | M7.6 |
| `UX-GEO-002` | M7.6 |
| `UX-GEO-003` | M7.6 |
| `UX-FURN-001` | M7.7 |
| `UX-FURN-002` | M7.7 |
| `UX-FURN-003` | M7.7 |
| `UX-FURN-004` | M7.3/M7.7 |
| `UX-REF-001` | M7.8 |
| `UX-REF-002` | M7.9 |
| `UX-REC-001` | M7.8 |
| `UX-REC-002` | M7.9 |
| `UX-REC-003` | M7.8 |
| `UX-3D-001` | M7.10 |
| `UX-3D-002` | M7.9 |
| `UX-3D-003` | M7.10 |
| `UX-PLAN-001` | M7.11 |
| `UX-PLAN-002` | M7.11 |
| `UX-PLAN-003` | M7.11 |
| `UX-PLAN-004` | M7.11 |
| `UX-DATA-001` | M7.1 — complete |
| `UX-DATA-002` | M7.12 |
| `UX-DASH-001` | M7.12 |
| `UX-PATTERN-001` | M7.2/M7.3 |
| `UX-PATTERN-002` | M7.3 |
| `UX-ACCESS-001` | M7.9 |
| `UX-ACCESS-002` | M7.1 foundation / M7.9 completion |
| `UX-CONTENT-001` | M7.2/M7.3 |

Every P1/P2 finding has an implementation owner. Findings become implementation work only through the focused slice workflow.

## 8. Programme safeguards

Each M7.x slice requires:

- focused design and implementation plan;
- explicit authority and persistence non-goals;
- TDD/layout contracts;
- Draft PR during implementation;
- full unit/type/lint/build CI;
- Chromium representative evidence and WebKit core smoke;
- product-owner acceptance;
- exact-head protected squash merge;
- post-merge canonical documentation sync.

No slice may silently change geometry semantics, create a second persistent UI truth, make optional AI authoritative or claim browser acceptance from unit tests alone.
