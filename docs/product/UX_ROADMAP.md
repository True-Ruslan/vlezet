# Vlezet — M7 UX Implementation Roadmap

**Phase:** M7 Product UX Foundation  
**Last updated:** 2026-07-31  
**Rule:** trust, reachability and interaction hierarchy precede cosmetic consolidation  
**Evidence:** accepted M7.0 audit plus M7.1 and M7.2 acceptance records in `docs/milestones/`

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
M7.2 Context Inspector Foundation

NOW
M7.3 Design System and Content Components

THEN
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

Delivered separate project/tool command layers, readable local-save state, direct Undo/Redo, docked/compact side surfaces, preserved local form state, no required-matrix horizontal overflow and one-column 3D composition.

Final evidence:

```text
head:       8c68bd288cd3dda1133f09a469cd7afe6dab83d9
standard:   30586557182 — PASS
browser:    30586557394 — PASS
artifact:   8776737145
merge:      6b6f8751b520722a54bb94a6947dae1135e07859
```

Remaining `UX-ACCESS-002` end-to-end hardening stays with M7.9.

## 5. Completed slice — M7.2 Context Inspector Foundation

**Problems:** `UX-SHELL-003`, foundational `UX-PATTERN-001`, foundational `UX-CONTENT-001`  
**Result:** accepted and squash-merged through PR #23 as `66606356d69f96953f8afae7b914222a3f793777`.

Delivered:

- shared user-facing context identity and header anatomy;
- empty, wall, room, opening and object states using one frame;
- planning, reference and recognition workflows using the same semantic structure;
- explicit `К комнате…` / `К предмету…` return navigation;
- original ordinary context preserved through workflow-to-workflow transitions;
- stale/deleted return targets failing closed;
- compact close preserving workflow and uncommitted local drafts;
- consistent section, action and danger hierarchy;
- accurate Undo/reference-removal consequences;
- viewport-constrained context frame and independently scrollable body;
- Chromium/WebKit regression for scrolling to and opening `Варианты расстановки`.

Final evidence:

```text
head:       d3231a09541c2c4cf10a48e69f4e485d15a06a0a
standard:   30625797753 — PASS
browser:    30625797756 — PASS
artifact:   8791323487
digest:     sha256:e167a0944674de6a99fc07dfaa7d5bcc0eea3b1c1cce575ce1d5b1ef961dfb12
merge:      66606356d69f96953f8afae7b914222a3f793777
```

Product-owner acceptance:

> «Теперь все работает супер четко.»

Canonical evidence: `docs/milestones/m7-2-acceptance.md`.

## 6. NOW — M7.3 Design System and Content Components

**Problems:** `UX-FURN-004`, `UX-REC-004`, `UX-PATTERN-002`, `UX-PATTERN-003`, remaining `UX-CONTENT-001`, `UX-SHELL-005`  
**Goal:** implement a small governed system for readable typography, spacing, fields, notices, badges, cards, dialogs and canonical Russian terminology.

### Scope

- define essential typography, spacing, radius, border and elevation tokens;
- define reusable field, help, error, notice, badge, card and dialog primitives;
- define consistent focus, disabled, loading, success, warning and error states;
- establish canonical terminology and unit formatting;
- remove evidence-backed microtext below the target readable scale;
- migrate representative shell, context and workflow surfaces first;
- retain M7.1 shell and M7.2 context semantics;
- extend Chromium/WebKit evidence for representative component states.

### Dependencies

- accepted M7.0 information architecture and design/accessibility foundations;
- accepted M7.1 responsive shell;
- accepted M7.2 context anatomy and scrolling contract.

### Non-goals

- complete domain-specific workflow redesign;
- new geometry, persistence, planning or AI semantics;
- Canvas/Three.js rewrite;
- final whole-product visual consolidation;
- mobile-first editing.

### Acceptance

- essential text meets documented readable tokens;
- representative fields, errors and notices have understandable non-colour cues;
- focus/disabled/loading/success/warning/error states are consistent;
- migrated surfaces use canonical terminology and unit formatting;
- M7.1 shell and M7.2 context/scroll behaviour do not regress;
- no `VlezetDocument`, schema, migration, IndexedDB, geometry or planner-authority change;
- full CI, Chromium representative flow and WebKit core smoke pass;
- product-owner browser acceptance before merge.

**Risk:** medium. Shared presentation rules touch many surfaces, so migration must remain representative and incremental rather than a full rewrite.

## 7. Later candidate slices

### M7.4 — Canvas Selection and Mode Feedback

**Problems:** `UX-SHELL-004`, `UX-CANVAS-001`, `UX-CANVAS-002`  
**Goal:** make active tool, next action, selection target and temporary spatial state obvious.

### M7.5 — Onboarding, Status and Recovery

**Problems:** `UX-ONBOARD-001`, `UX-DATA-003`  
**Goal:** guide the first successful room and make important async completion/recovery durable.

### M7.6 — Geometry and Opening Inspector

**Problems:** `UX-GEO-001`, `UX-GEO-002`, `UX-GEO-003`  
**Goal:** make clear dimensions, wall-axis/thickness semantics and door swing visually predictable.

### M7.7 — Furniture and Fit Workflow

**Problems:** `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003`, remaining `UX-FURN-004`  
**Goal:** prioritise common edits, explain local orientation/clearances and improve catalogue discovery.

### M7.8 — Reference and Recognition Workflow

**Problems:** `UX-REF-001`, `UX-REC-001`, `UX-REC-003`, remaining `UX-REC-004`  
**Goal:** unify source-plan configuration and recognition review around clear phases and Draft/Applied semantics.

### M7.9 — Accessibility and Responsive Hardening

**Problems:** `UX-REF-002`, `UX-REC-002`, `UX-3D-002`, `UX-ACCESS-001`, residual `UX-ACCESS-002`  
**Goal:** close end-to-end keyboard/focus/non-colour/zoom gaps after foundational components exist.

### M7.10 — 2D/3D Context and Interior Readability

**Problems:** `UX-3D-001`, `UX-3D-003`  
**Goal:** align semantic inspection across 2D/3D and make the first read-only 3D frame useful for interior understanding.

### M7.11 — Planning Workflow Simplification

**Problems:** `UX-PLAN-001`, `UX-PLAN-002`, `UX-PLAN-003`, `UX-PLAN-004`  
**Goal:** organise planning into understandable intent, constraints and results phases while preserving deterministic authority.

### M7.12 — Dashboard and Project Lifecycle

**Problems:** `UX-DATA-002`, `UX-DASH-001`, `UX-DASH-002`  
**Goal:** make projects visually distinguishable and backup/restore understandable.

### M7.13 — Visual Consolidation and Evidence-Driven Polish

**Problem:** remaining P3 findings and later browser evidence  
**Goal:** final visual consistency, motion, spacing and refinement without hiding precision.

## 8. P0–P2 coverage matrix

| Finding | Primary slice |
|---|---|
| `UX-SHELL-001` | M7.1 — complete |
| `UX-SHELL-002` | M7.1 — complete |
| `UX-SHELL-003` | M7.2 — complete |
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
| `UX-PATTERN-001` | M7.2 foundation / M7.3 completion |
| `UX-PATTERN-002` | M7.3 |
| `UX-ACCESS-001` | M7.9 |
| `UX-ACCESS-002` | M7.1 foundation / M7.9 completion |
| `UX-CONTENT-001` | M7.2 foundation / M7.3 completion |

Every P1/P2 finding has an implementation owner. Findings become implementation work only through the focused slice workflow.

## 9. Programme safeguards

Each M7.x slice requires:

- focused design and implementation plan;
- explicit authority and persistence non-goals;
- TDD/layout/content contracts;
- Draft PR during implementation;
- full unit/type/lint/build CI;
- Chromium representative evidence and WebKit core smoke;
- product-owner acceptance;
- exact-head protected squash merge;
- post-merge canonical documentation sync.

No slice may silently change geometry semantics, create a second persistent UI truth, make optional AI authoritative or claim browser acceptance from unit tests alone.
