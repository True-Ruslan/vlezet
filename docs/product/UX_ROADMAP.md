# Vlezet — M7 UX Implementation Roadmap

**Phase:** M7 Product UX Foundation  
**Rule:** trust, reachability and interaction hierarchy precede cosmetic consolidation  
**Evidence:** source audit plus accepted Chromium/WebKit evidence in `UX_BROWSER_EVIDENCE.md`

## 1. Prioritisation model

Work is ordered by:

1. destructive/data-integrity or incorrect-understanding risk;
2. reach across journeys and surfaces;
3. observed/reasonable frequency;
4. dependency value for later fixes;
5. implementation and regression risk;
6. confidence of evidence.

No false-precision numeric score is used. Later slices may be reordered from browser evidence, but only one slice is `NOW` after M7.0 acceptance.

## 2. Programme tiers

| Tier | Meaning |
|---|---|
| Critical correction | P0/P1 trust, reachability or accessibility blocker |
| Foundation | cross-surface P2 and prerequisite system work |
| Workflow improvement | bounded journey-level P1/P2 |
| Accessibility hardening | keyboard, semantics, zoom and non-colour gaps |
| Visual consolidation | P3 consistency after structure is correct |
| Optional polish | P4 evidence-driven refinements |

## 3. Recommended sequence

```text
NOW
M7.1 Editor Shell and Responsive Context

THEN
M7.2 Context Inspector Foundation
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

## 4. First selected slice

### M7.1 — Editor Shell and Responsive Context

**Problem:** `UX-SHELL-001`, `UX-SHELL-002`, `UX-DATA-001`, `UX-ACCESS-002`  
**Goal:** establish a stable project/tool/context hierarchy that preserves essential actions and selected-entity controls across supported desktop widths and browser zoom.  
**Scope:**

- separate global product actions from exclusive tools/display toggles;
- keep project name, readable `Сохранено локально`, Undo/Redo and active tool visible;
- collapse lower-priority utilities into labelled overflow rather than removing them;
- replace `display:none` inspector loss with a viewport-safe context panel/drawer model;
- preserve Canvas minimum useful area and current selection/workflow state during layout changes;
- reuse the M7.0 Chromium/WebKit browser harness for layout evidence;
- introduce only the minimum design tokens/primitives required by the shell.

**Dependencies:** accepted M7.0 target IA, interaction model, design tokens, accessibility matrix and browser evidence.  
**Non-goals:** redesign every inspector form, rewrite Canvas, alter editor stores, implement mobile editing, add new product features, migrate recognition/planning visual details.  
**Acceptance:**

- 1920×1080, 1440×900, 1366×768 and 1280×800 required views;
- 100%, 125%, 150% and 200% zoom scenarios;
- no horizontal escape;
- no unreachable selected-entity/workflow controls;
- active tool and save/history remain available;
- Canvas remains usable;
- Chromium representative flow and WebKit core smoke pass;
- native Safari core regression on macOS is recorded before merge;
- existing M0–M6.4 functional regression suite and exact-head CI pass;
- product-owner browser acceptance before merge.

**Risk:** medium; shell layout is broad, therefore behaviour/store ownership remains unchanged and the slice is limited to composition/presentation/reachability.

## 5. Later candidate slices

### M7.2 — Context Inspector Foundation

**Problem:** `UX-SHELL-003`, `UX-PATTERN-001`, part of `UX-CONTENT-001`  
**Goal:** one predictable context/workflow panel anatomy with back/close, selection identity, sections, sticky actions and destructive hierarchy.  
**Scope:** empty/wall/room/opening/object shell; shared panel header; workflow return context; section and action patterns.  
**Dependencies:** M7.1 responsive context container.  
**Non-goals:** complete domain-specific form redesign.  
**Acceptance:** selection/context remains stable, all existing actions reachable, no persistence/geometry authority change.  
**Risk:** medium.

### M7.3 — Design System and Content Components

**Problem:** `UX-FURN-004`, `UX-REC-004`, `UX-PATTERN-002`, `UX-PATTERN-003`, `UX-CONTENT-001`, `UX-SHELL-005`  
**Goal:** implement shared readable typography, tokens, fields, notices, badges, cards, dialogs and canonical Russian terminology.  
**Scope:** reusable presentation primitives, focus/error states, internal enum/milestone copy removal, representative component migration.  
**Dependencies:** M7.1–M7.2 shell/context contracts.  
**Non-goals:** migrate every advanced workflow in one PR.  
**Acceptance:** essential text meets target tokens; focus/error/state examples and visual/browser regression cover representative inspector and dialog.  
**Risk:** medium.

### M7.4 — Canvas Selection and Mode Feedback

**Problem:** `UX-SHELL-004`, `UX-CANVAS-001`, `UX-CANVAS-002`  
**Goal:** make active tool, next action, selection target and temporary spatial state obvious.  
**Scope:** active-tool status, Escape guidance, semantic hover/selection affordance, obscured-entity path, unified Canvas notice/legend.  
**Dependencies:** shell/tool/context anatomy.  
**Non-goals:** new geometry or drawing engine.  
**Acceptance:** overlap scenarios, all tools, measurement, tracing, recognition and planning Preview remain deterministic and non-mutating.  
**Risk:** medium/high due hit-testing and Canvas interaction; geometry authority unchanged.

### M7.5 — Onboarding, Status and Recovery

**Problem:** `UX-ONBOARD-001`, `UX-DATA-003`  
**Goal:** guide the first successful room and make important async completion/recovery durable.  
**Scope:** dismissible first-project checklist, context empty states, completion evidence, save/export/apply recovery copy.  
**Dependencies:** shell/context/content primitives.  
**Non-goals:** blocking tutorial wizard or account analytics.  
**Acceptance:** first-room scenario and failure/retry paths pass browser test without obscuring power-user editing.  
**Risk:** low.

### M7.6 — Geometry and Opening Inspector

**Problem:** `UX-GEO-001`, `UX-GEO-002`, `UX-GEO-003`  
**Goal:** make clear dimensions, wall-axis/thickness semantics and door swing visually predictable.  
**Scope:** grouped geometry form, orientation cue, room span labels, visual door hinge/swing selector, field-associated validation.  
**Dependencies:** context/design components.  
**Non-goals:** arbitrary parametric CAD constraints or new geometry semantics.  
**Acceptance:** existing 3550×3300→11.72 m² regression, wall anchors/alignment, horizontal/vertical door swing, Undo/Redo.  
**Risk:** medium; commands remain unchanged.

### M7.7 — Furniture and Fit Workflow

**Problem:** `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003`, `UX-FURN-004`  
**Goal:** prioritise common furniture edits, explain local orientation/clearances and improve catalogue discovery.  
**Scope:** common/advanced sections, orientation diagram, per-field errors, search/category navigation.  
**Dependencies:** context/design components.  
**Non-goals:** decorative 3D assets or cloud catalogue.  
**Acceptance:** rotate/local-direction scenarios, fit diagnostics, long names, search keyboard path and existing M2 authority.  
**Risk:** medium.

### M7.8 — Reference and Recognition Workflow

**Problem:** `UX-REF-001`, `UX-REC-001`, `UX-REC-003`, `UX-REC-004`  
**Goal:** unify source-plan configuration and recognition review around clear phases and Draft/Applied semantics.  
**Scope:** reference commitment grouping, workflow step hierarchy, translated status, shared cards/notices, draft legend, inline-CSS migration.  
**Dependencies:** context/design/content components.  
**Non-goals:** recognition accuracy changes.  
**Acceptance:** import/calibration/tracing/local/cloud/stale/empty/Apply/discard scenarios; no silent geometry replacement.  
**Risk:** medium.

### M7.9 — Accessibility and Responsive Hardening

**Problem:** `UX-REF-002`, `UX-REC-002`, `UX-3D-002`, `UX-ACCESS-001`, residual `UX-ACCESS-002`  
**Goal:** close end-to-end keyboard/focus/non-colour/zoom gaps after foundational components exist.  
**Scope:** calibration alternatives, candidate badges, dialog focus, live regions, Canvas status, semantic 3D path, required browser/screen-reader matrix.  
**Dependencies:** M7.1–M7.8 components as applicable.  
**Non-goals:** claim complete keyboard-only CAD equivalence.  
**Acceptance:** documented accessibility matrix and WCAG 2.2 AA checks for applicable HTML UI.  
**Risk:** medium/high; specialised testing required.

### M7.10 — 2D/3D Context and Interior Readability

**Problem:** `UX-3D-001`, `UX-3D-003`  
**Goal:** align semantic inspection across 2D/3D and make the first read-only 3D frame useful for interior understanding.  
**Scope:** shared inspector anatomy/names/status; mode transition; preserved identity where valid; clear read-only state; deterministic interior-oriented camera or wall visibility/cutaway treatment; evidence-tested perspective/isometric/top presets.  
**Dependencies:** context/design/accessibility foundations.  
**Non-goals:** direct 3D editing, photorealism or a second spatial source of truth.  
**Acceptance:** paired room/wall/object 2D/3D scenarios; a representative furnished closed room exposes floor and major interior objects on entry; camera presets remain deterministic; WebGL recovery preserves 2D.  
**Risk:** medium/high because camera and wall presentation affect visual comprehension while renderer/document authority must remain isolated.

### M7.11 — Planning Workflow Simplification

**Problem:** `UX-PLAN-001`, `UX-PLAN-002`, `UX-PLAN-003`, `UX-PLAN-004`  
**Goal:** organise planning into understandable intent, constraints and results phases while preserving deterministic authority.  
**Scope:** manual-first entry, optional language expansion, mandatory/preference visual roles, sticky selected-object summary, direct alternative comparison.  
**Dependencies:** context/design/content/Canvas foundations.  
**Non-goals:** new planning vocabulary, window-aware rules or broader autonomy.  
**Acceptance:** M6.1–M6.4 representative scenarios, Preview/Apply/Undo/Redo, exact witness and offline/manual path.  
**Risk:** medium.

### M7.12 — Dashboard and Project Lifecycle

**Problem:** `UX-DATA-002`, `UX-DASH-001`, `UX-DASH-002`  
**Goal:** make projects visually distinguishable and backup/restore understandable.  
**Scope:** derived local thumbnail or structured preview, lifecycle-oriented export/import wording, predictable rename.  
**Dependencies:** design/content components.  
**Non-goals:** cloud accounts or collaboration.  
**Acceptance:** empty/many projects, long names, duplicate/delete/import/export/recovery and local-first messaging.  
**Risk:** low/medium.

### M7.13 — Visual Consolidation and Evidence-Driven Polish

**Problem:** remaining P3 findings and browser evidence after structural slices.  
**Goal:** deliver final visual consistency, motion, spacing and refinement without hiding precision.  
**Scope:** `UX-SHELL-004`, `UX-SHELL-005`, `UX-REC-004`, `UX-DATA-003`, `UX-DASH-002`, `UX-PATTERN-003` only where not already resolved.  
**Dependencies:** prior accepted M7 slices.  
**Non-goals:** speculative animation or aesthetic rewrite.  
**Acceptance:** visual regression/browser review and no functionality regression.  
**Risk:** low.

## 6. P0–P2 coverage matrix

| Finding | Primary slice |
|---|---|
| `UX-SHELL-001` | M7.1 |
| `UX-SHELL-002` | M7.1 |
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
| `UX-DATA-001` | M7.1 |
| `UX-DATA-002` | M7.12 |
| `UX-DASH-001` | M7.12 |
| `UX-PATTERN-001` | M7.2/M7.3 |
| `UX-PATTERN-002` | M7.3 |
| `UX-ACCESS-001` | M7.9 |
| `UX-ACCESS-002` | M7.1/M7.9 |
| `UX-CONTENT-001` | M7.3 |

Every P1/P2 finding has an implementation owner. Findings are not equivalent to GitHub issues until the corresponding slice design is approved.

## 7. Programme safeguards

Each M7.x slice requires:

- focused design and implementation plan;
- explicit non-goals;
- source-of-truth/persistence impact statement;
- behavioural tests before implementation where feasible;
- browser acceptance at affected viewports/zoom;
- accessibility checks appropriate to the slice;
- exact-head full CI;
- Draft PR until product-owner acceptance;
- canonical state/changelog update after merge.

No slice may combine unrelated algorithm/feature development with UX redesign merely because the same panel is touched.
