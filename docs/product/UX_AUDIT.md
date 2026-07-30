# Vlezet — Product, UI and UX Audit

**Phase:** M7.0 Product and UX Audit  
**Status:** source-backed RC; representative browser verification remains an acceptance gate  
**Scope:** current product through accepted M6.4

## 1. Methodology

The audit combines source review, accepted M4.6–M6.4 browser evidence, supplied screenshots, heuristic evaluation and architecture-boundary review.

Evidence confidence:

- **high** — directly visible in source or supplied browser evidence;
- **medium** — strongly implied by source/common environments and requires browser confirmation;
- **low** — plausible risk retained only for test coverage.

No P0 finding was identified. Vlezet already has strong data-safety, local-first and fail-closed foundations. The dominant risks are comprehension, reachability, density, accessibility and cross-feature consistency.

## 2. Strengths to preserve

- Local editing and autosave do not depend on network services.
- `VlezetDocument` remains separate from Canvas, 3D and generated drafts.
- Clear dimensions and area share one geometry source.
- Fit status is structured and explainable.
- Recognition and language interpretation create reviewable drafts.
- Planning Preview is non-mutating and Apply is explicit/revalidated.
- Provider failure preserves manual workflows.
- 3D failure preserves the 2D path.
- Undo/Redo is semantic across high-impact operations.
- The current restrained visual direction is recognisably one product.

## 3. Structured findings

## UX-SHELL-001

**Title:** Global, tool, display and document actions compete in one toolbar row  
**Severity:** P2  
**Affected journey:** J01, J03, J04, J05, J06, J07, J08, J11  
**Affected surface:** `CMP-TOOLBAR`  
**Frequency:** high  
**Confidence:** high  
**Evidence:** `EV-M7-SOURCE-TOOLBAR`, `EV-M7-SOURCE-CSS`; project identity, nine tools/workflows, 2D/3D, status, fit, export and history share one row.  
**Root cause:** capabilities were added milestone by milestone to one command surface.  
**Recommended response:** separate global product actions, exclusive tools, display toggles and utilities while preserving shortcuts.  
**Architecture impact:** low  
**Acceptance criterion:** active tool plus project/save/history remain reachable at all required widths/zoom; lower-priority utilities use an understandable overflow.  
**Recommended slice:** M7.1 Editor Shell and Responsive Context

## UX-SHELL-002

**Title:** The right inspector becomes unreachable below 980 px  
**Severity:** P1  
**Affected journey:** J01, J02, J03, J04, J06, J07, J09, J10  
**Affected surface:** context, reference and recognition panels  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** `EV-M7-SOURCE-CSS`; panels use `display:none` below 980 px, including when browser zoom reduces effective width.  
**Root cause:** responsive handling protects Canvas by deleting task completion surfaces.  
**Recommended response:** use a resizable panel or accessible context drawer/sheet and explicit minimum-editor guidance only when necessary.  
**Architecture impact:** medium  
**Acceptance criterion:** selected-entity and active-workflow controls remain reachable at 1280×800 and required zoom; narrower layouts fail gracefully.  
**Recommended slice:** M7.1 Editor Shell and Responsive Context

## UX-SHELL-003

**Title:** Advanced workflows replace selection context without a shared navigation model  
**Severity:** P2  
**Affected journey:** J06, J07, J09, J10  
**Affected surface:** right-side panels  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** reference/recognition replace the inspector; planning replaces room context until closed.  
**Root cause:** each workflow independently owns the same physical slot.  
**Recommended response:** define shared workflow header, phase, back/close and return-context semantics.  
**Architecture impact:** medium  
**Acceptance criterion:** entering/exiting each workflow follows one predictable pattern and restores valid prior context.  
**Recommended slice:** M7.2 Context Inspector Foundation

## UX-SHELL-004

**Title:** Active modes use disconnected status locations  
**Severity:** P3  
**Affected journey:** J05, J06, J07, J09  
**Affected surface:** toolbar, Canvas, banners, inspector  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** tools, tracing, recognition and planning expose active state in different locations/patterns.  
**Root cause:** mode feedback was introduced per feature.  
**Recommended response:** define one mode/status hierarchy and shared Canvas workflow notice.  
**Architecture impact:** low  
**Acceptance criterion:** current tool/workflow and exit action are identifiable through a consistent pattern.  
**Recommended slice:** M7.4 Canvas Selection and Mode Feedback

## UX-SHELL-005

**Title:** Internal milestone labels appear in production planning UI  
**Severity:** P3  
**Affected journey:** J09, J10  
**Affected surface:** planning panel and intent section  
**Frequency:** high within planning  
**Confidence:** high  
**Evidence:** visible `M6.4` kicker/badge.  
**Root cause:** development-stage identity leaked into user copy.  
**Recommended response:** replace milestone labels with user-facing workflow names.  
**Architecture impact:** none  
**Acceptance criterion:** ordinary UI contains no internal roadmap identifiers.  
**Recommended slice:** M7.3 Design System and Content Components

## UX-ONBOARD-001

**Title:** First-room success relies on discovering topology semantics  
**Severity:** P2  
**Affected journey:** J01  
**Affected surface:** dashboard, toolbar, Canvas, empty inspector  
**Frequency:** high for new users  
**Confidence:** medium  
**Evidence:** a room appears only after a valid closed wall topology; current empty guidance does not lead through that complete task.  
**Root cause:** the product starts as a capable editor rather than a goal-oriented first run.  
**Recommended response:** add a dismissible first-project checklist and contextual next action, not a blocking wizard.  
**Architecture impact:** low  
**Acceptance criterion:** a first-time user creates a rectangle and recognises successful closure without external instruction.  
**Recommended slice:** M7.5 Onboarding, Status and Recovery

## UX-CANVAS-001

**Title:** Canvas help is passive and insufficiently context-sensitive  
**Severity:** P2  
**Affected journey:** J01, J03, J04, J05  
**Affected surface:** `CMP-CANVAS`  
**Frequency:** high  
**Confidence:** medium  
**Evidence:** compact static help is partially hidden at narrower widths; next-action/cancel guidance is split among tooltips and feature banners.  
**Root cause:** help is a static overlay rather than an active-tool guide.  
**Recommended response:** expose current state, next click and Escape/cancel in a shared Canvas status area.  
**Architecture impact:** low  
**Acceptance criterion:** each exclusive tool explains the next action and exit without hover-only instructions.  
**Recommended slice:** M7.4 Canvas Selection and Mode Feedback

## UX-CANVAS-002

**Title:** Selection priority is unclear when semantic entities overlap  
**Severity:** P2  
**Affected journey:** J02, J03, J04  
**Affected surface:** Canvas and context inspector  
**Frequency:** medium  
**Confidence:** medium  
**Evidence:** rooms, walls, openings, furniture, handles, reference and draft overlays can overlap without a visible cycling/breadcrumb model.  
**Root cause:** hit-testing rules are implemented but not surfaced as an interaction contract.  
**Recommended response:** define hover affordance, semantic hit priority and a deterministic obscured-entity path.  
**Architecture impact:** medium  
**Acceptance criterion:** users can deliberately select wall, room, opening and object in representative overlap scenarios.  
**Recommended slice:** M7.4 Canvas Selection and Mode Feedback

## UX-GEO-001

**Title:** Door swing exposes directed-wall terminology  
**Severity:** P1  
**Affected journey:** J03  
**Affected surface:** opening inspector and Canvas  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** controls use `начало проёма` and `влево/вправо от направления стены`.  
**Root cause:** internal geometry representation is exposed directly.  
**Recommended response:** provide a visual four-way hinge/swing selector tied to the displayed door arc and accessible ordinary-language description.  
**Architecture impact:** low  
**Acceptance criterion:** intended swing is selected on the first attempt for horizontal and vertical walls.  
**Recommended slice:** M7.6 Geometry and Opening Inspector

## UX-GEO-002

**Title:** Precision editing repeats ungrouped input–anchor–Apply blocks  
**Severity:** P2  
**Affected journey:** J02  
**Affected surface:** room and wall inspectors  
**Frequency:** high  
**Confidence:** high  
**Evidence:** room width/length and wall length/thickness repeat related but visually fragmented command blocks.  
**Root cause:** controls mirror individual commands rather than one coherent geometry form.  
**Recommended response:** introduce semantic sections, paired dimension rows and clear local commit/error placement.  
**Architecture impact:** low  
**Acceptance criterion:** clear size, wall axis and thickness are visibly separate concepts with one obvious commit per change.  
**Recommended slice:** M7.6 Geometry and Opening Inspector

## UX-GEO-003

**Title:** Room width/length labels lack an explicit orientation cue  
**Severity:** P2  
**Affected journey:** J02  
**Affected surface:** room inspector and dimensions  
**Frequency:** medium  
**Confidence:** medium  
**Evidence:** `Ширина/Длина` and left/right/top/bottom anchors rely on screen orientation.  
**Root cause:** ordinary labels are not connected to a visible physical span.  
**Recommended response:** pair fields with a miniature orientation cue or explicit horizontal/vertical meaning.  
**Architecture impact:** low  
**Acceptance criterion:** the changed physical room span is predictable before Apply.  
**Recommended slice:** M7.6 Geometry and Opening Inspector

## UX-FURN-001

**Title:** Advanced object coordinates precede common furniture edits  
**Severity:** P2  
**Affected journey:** J04  
**Affected surface:** object inspector  
**Frequency:** high  
**Confidence:** high  
**Evidence:** centre X/Y, dimensions, height, rotation and four clearances receive similar priority in one long form.  
**Root cause:** all persistent properties are given equal visual weight.  
**Recommended response:** prioritise name, dimensions and rotation; move coordinates and clearance tuning into advanced disclosure.  
**Architecture impact:** low  
**Acceptance criterion:** common resize/rotate actions are reachable without scanning advanced fields.  
**Recommended slice:** M7.7 Furniture and Fit Workflow

## UX-FURN-002

**Title:** Object-local clearance directions are not visually mapped after rotation  
**Severity:** P1  
**Affected journey:** J04  
**Affected surface:** object inspector and Canvas  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** `Спереди/Справа/Сзади/Слева` have no orientation diagram tied to rotated furniture.  
**Root cause:** correct local-axis semantics are expressed only through text.  
**Recommended response:** show a compact orientation diagram/directional chips synchronized with rotation.  
**Architecture impact:** low  
**Acceptance criterion:** physical clearance sides are identified correctly at 0°, 90°, 180° and 270°.  
**Recommended slice:** M7.7 Furniture and Fit Workflow

## UX-FURN-003

**Title:** Furniture discovery is a long static list  
**Severity:** P2  
**Affected journey:** J04  
**Affected surface:** furniture catalogue  
**Frequency:** medium and increasing  
**Confidence:** high  
**Evidence:** fixed category order in a 250 px scroll panel; no search, recents or category navigation.  
**Root cause:** catalogue size initially made scrolling sufficient.  
**Recommended response:** add search and compact category navigation while preserving simple preset placement.  
**Architecture impact:** low  
**Acceptance criterion:** a known item is found without scanning unrelated categories and remains keyboard reachable.  
**Recommended slice:** M7.7 Furniture and Fit Workflow

## UX-FURN-004

**Title:** One generic Apply error represents many unrelated object fields  
**Severity:** P2  
**Affected journey:** J04  
**Affected surface:** object inspector  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** all numeric fields parse on one Apply and one paragraph reports the first failure.  
**Root cause:** validation is command-oriented rather than field-oriented.  
**Recommended response:** associate errors with exact fields while preserving atomic Apply.  
**Architecture impact:** low  
**Acceptance criterion:** the invalid field is identified, entered values remain, and recovery copy is specific.  
**Recommended slice:** M7.3 Design System and Content Components

## UX-REF-001

**Title:** Reference workflow mixes explicit Save with immediate transform edits  
**Severity:** P2  
**Affected journey:** J06  
**Affected surface:** reference panel  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** calibration uses explicit Save; opacity, X/Y and rotation update immediately.  
**Root cause:** import and installed-reference editing use different commitment models in one panel.  
**Recommended response:** group immediate reversible display controls separately from high-impact calibration/replacement actions.  
**Architecture impact:** low  
**Acceptance criterion:** users can predict which changes are immediate/persistent and which require confirmation.  
**Recommended slice:** M7.8 Reference and Recognition Workflow

## UX-REF-002

**Title:** Calibration has no keyboard-equivalent point placement  
**Severity:** P1  
**Affected journey:** J06  
**Affected surface:** calibration stage  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** pointer events assign/drag points; visual handles are `aria-hidden`; no coordinate controls exist.  
**Root cause:** calibration was implemented as a visual drag workflow only.  
**Recommended response:** provide keyboard-operable point/coordinate controls while retaining pointer precision.  
**Architecture impact:** medium  
**Acceptance criterion:** calibration completes without drag-only interaction and focus remains visible at 200% zoom.  
**Recommended slice:** M7.9 Accessibility and Responsive Hardening

## UX-REC-001

**Title:** Recognition mixes Russian UI with technical English state values  
**Severity:** P2  
**Affected journey:** J07  
**Affected surface:** recognition panel  
**Frequency:** high within recognition  
**Confidence:** high  
**Evidence:** visible decision/origin vocabulary includes `pending` and `Local + AI`.  
**Root cause:** internal enum/provider vocabulary is partially translated.  
**Recommended response:** define canonical Russian source, confidence, conflict and decision states.  
**Architecture impact:** none  
**Acceptance criterion:** no raw enum value is displayed and every state has a non-colour label.  
**Recommended slice:** M7.8 Reference and Recognition Workflow

## UX-REC-002

**Title:** Recognition relies on microtext and colour-coded confidence  
**Severity:** P1  
**Affected journey:** J07  
**Affected surface:** recognition summary and candidate list  
**Frequency:** high within recognition  
**Confidence:** high  
**Evidence:** 9 px metadata plus coloured high/medium/low/conflict dots.  
**Root cause:** candidate review density preceded accessibility consolidation.  
**Recommended response:** use readable text/icon badges and shared typography tokens.  
**Architecture impact:** low  
**Acceptance criterion:** status remains understandable in grayscale and at 200% zoom without 9 px text.  
**Recommended slice:** M7.9 Accessibility and Responsive Hardening

## UX-REC-003

**Title:** Source, recognition draft and trusted geometry are distinguished mainly by prose  
**Severity:** P2  
**Affected journey:** J07  
**Affected surface:** recognition panel and Canvas  
**Frequency:** medium  
**Confidence:** medium  
**Evidence:** safety is repeated in intro/banner/footer while coloured draft lines share the trusted work surface.  
**Root cause:** architecture boundaries lack one canonical visual state model.  
**Recommended response:** establish shared Draft/Preview/Applied styling and a review legend.  
**Architecture impact:** low  
**Acceptance criterion:** source image, draft and applied geometry are identifiable without long paragraphs.  
**Recommended slice:** M7.8 Reference and Recognition Workflow

## UX-REC-004

**Title:** Recognition maintains an isolated inline design system  
**Severity:** P3  
**Affected journey:** J07  
**Affected surface:** recognition component styles  
**Frequency:** continuous maintenance risk  
**Confidence:** high  
**Evidence:** a substantial component-local CSS string defines fields, cards, modal, banner, typography and responsive rules.  
**Root cause:** feature delivery preceded shared primitives.  
**Recommended response:** migrate to shared tokens/components after contracts are defined.  
**Architecture impact:** low  
**Acceptance criterion:** recognition uses product-wide field, notice, badge, card, dialog and focus patterns.  
**Recommended slice:** M7.3 Design System and Content Components

## UX-3D-001

**Title:** 3D context appears in a different interaction location than 2D context  
**Severity:** P2  
**Affected journey:** J08  
**Affected surface:** 3D viewer/inspector and 2D context panel  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** 2D uses a fixed right inspector; 3D uses an internal overlay with separate selection state.  
**Root cause:** 3D was delivered as a self-contained read-only viewer.  
**Recommended response:** align semantic selection language and inspector anatomy while preserving renderer isolation/read-only authority.  
**Architecture impact:** medium  
**Acceptance criterion:** the same entity produces recognisably consistent context in 2D and 3D.  
**Recommended slice:** M7.10 2D/3D Context Consistency

## UX-3D-002

**Title:** Core 3D navigation and semantic selection are pointer-only  
**Severity:** P2  
**Affected journey:** J08  
**Affected surface:** spatial viewer  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** OrbitControls/raycasting handle camera, hover and click; no keyboard semantic navigation exists.  
**Root cause:** initial 3D scope prioritised deterministic projection and pointer inspection.  
**Recommended response:** add reachable camera commands and an accessible semantic entity path without direct 3D editing.  
**Architecture impact:** medium  
**Acceptance criterion:** essential 3D inspection is reachable without precise pointer-only interaction.  
**Recommended slice:** M7.9 Accessibility and Responsive Hardening

## UX-PLAN-001

**Title:** Provider configuration dominates planning entry  
**Severity:** P2  
**Affected journey:** J09, J10  
**Affected surface:** planning intent and planning panel  
**Frequency:** high whenever planning opens  
**Confidence:** high  
**Evidence:** text, API-key and model controls appear before network-independent manual planning.  
**Root cause:** M6.4 was appended as the first section.  
**Recommended response:** keep manual planning primary and move language/provider settings into optional progressive disclosure.  
**Architecture impact:** low  
**Acceptance criterion:** deterministic manual planning is reachable without scanning provider settings; language remains discoverable.  
**Recommended slice:** M7.11 Planning Workflow Simplification

## UX-PLAN-002

**Title:** Planning combines configuration, review, results and evidence in one long scroll  
**Severity:** P2  
**Affected journey:** J09, J10  
**Affected surface:** planning inspector  
**Frequency:** high within planning  
**Confidence:** high  
**Evidence:** intent, objects, pairs, gaps, Generate and result cards share a 290–330 px scrolling surface.  
**Root cause:** each planning milestone added a section without phase architecture.  
**Recommended response:** organise intent, constraints and results into clear phases with sticky context/actions.  
**Architecture impact:** medium  
**Acceptance criterion:** phase, selected objects and primary action remain visible for three-object scenarios.  
**Recommended slice:** M7.11 Planning Workflow Simplification

## UX-PLAN-003

**Title:** Hard constraints and soft preferences are distinguished mainly by prose  
**Severity:** P1  
**Affected journey:** J09, J10  
**Affected surface:** planning controls and results  
**Frequency:** high within planning  
**Confidence:** high  
**Evidence:** locks/exact gaps and wall/corner/near/far controls have similar treatment; helper text carries authority semantics.  
**Root cause:** precise domain types lack a shared visual language.  
**Recommended response:** use explicit `Обязательно` and `Желательно` grouping/badges consistently in controls and results.  
**Architecture impact:** low  
**Acceptance criterion:** users correctly predict rejection versus ranking influence.  
**Recommended slice:** M7.11 Planning Workflow Simplification

## UX-PLAN-004

**Title:** Alternative comparison competes with Canvas and configuration context  
**Severity:** P2  
**Affected journey:** J09  
**Affected surface:** result cards and Canvas Preview  
**Frequency:** medium  
**Confidence:** medium  
**Evidence:** alternatives are below configuration in the narrow panel while Preview/evidence is spatial.  
**Root cause:** result comparison reuses the configuration layout.  
**Recommended response:** preserve a compact constraint summary and direct previous/next comparison with sticky Preview/Apply controls.  
**Architecture impact:** medium  
**Acceptance criterion:** up to three alternatives can be compared without losing constraints or active Preview orientation.  
**Recommended slice:** M7.11 Planning Workflow Simplification

## UX-DATA-001

**Title:** Local save state is too visually subtle  
**Severity:** P1  
**Affected journey:** J11  
**Affected surface:** project identity/save status  
**Frequency:** high  
**Confidence:** high  
**Evidence:** save state is 9 px muted metadata despite local persistence being central to product trust.  
**Root cause:** status was designed as compact toolbar metadata.  
**Recommended response:** create readable persistent `Сохранено локально` / saving / failed-retry states.  
**Architecture impact:** low  
**Acceptance criterion:** save state is distinguishable without hover at all required zoom levels.  
**Recommended slice:** M7.1 Editor Shell and Responsive Context

## UX-DATA-002

**Title:** Export choices require technical interpretation  
**Severity:** P2  
**Affected journey:** J11  
**Affected surface:** export menu and dashboard import  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** `PNG`, `PNG с подложкой`, `Vlezet JSON` are organised by file format rather than user lifecycle.  
**Root cause:** export actions mirror technical output types.  
**Recommended response:** group as image and editable project backup, with mirrored restore language.  
**Architecture impact:** none  
**Acceptance criterion:** users choose/restores an editable backup without needing JSON knowledge.  
**Recommended slice:** M7.12 Dashboard and Project Lifecycle

## UX-DATA-003

**Title:** Important success feedback may exist only as a short toast  
**Severity:** P3  
**Affected journey:** J07, J09, J11  
**Affected surface:** global toast  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** toasts expire after approximately 2.6 seconds for copy/apply/export events.  
**Root cause:** one transient success mechanism serves actions of different importance.  
**Recommended response:** retain minor toasts but keep high-impact completion evidence in the originating context.  
**Architecture impact:** low  
**Acceptance criterion:** high-impact completion remains confirmable after the toast expires.  
**Recommended slice:** M7.5 Onboarding, Status and Recovery

## UX-DASH-001

**Title:** Project previews do not represent saved plans  
**Severity:** P2  
**Affected journey:** J11  
**Affected surface:** dashboard project cards  
**Frequency:** high with multiple projects  
**Confidence:** high  
**Evidence:** every project uses the same decorative CSS floor-plan placeholder.  
**Root cause:** local thumbnails were outside M3 scope.  
**Recommended response:** derive a lightweight local thumbnail or stronger structured preview from authoritative geometry.  
**Architecture impact:** low  
**Acceptance criterion:** multiple projects are visually distinguishable without opening; thumbnails remain derived/non-authoritative.  
**Recommended slice:** M7.12 Dashboard and Project Lifecycle

## UX-DASH-002

**Title:** Rename has redundant and partially hidden paths  
**Severity:** P3  
**Affected journey:** J11  
**Affected surface:** project card  
**Frequency:** low  
**Confidence:** high  
**Evidence:** title click opens, double-click renames and an explicit rename action also exists.  
**Root cause:** convenience interaction was added beside explicit controls.  
**Recommended response:** retain one discoverable action and only a clearly hinted direct-edit shortcut.  
**Architecture impact:** none  
**Acceptance criterion:** rename is keyboard-operable and does not conflict with opening.  
**Recommended slice:** M7.12 Dashboard and Project Lifecycle

## UX-PATTERN-001

**Title:** Destructive confirmation patterns are inconsistent  
**Severity:** P2  
**Affected journey:** J03, J04, J06, J11  
**Affected surface:** project dialog, reference confirmation, object/opening deletion  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** project delete uses a modal, reference remove an inline confirmation, object/opening deletion is immediate/undoable.  
**Root cause:** patterns were designed per entity instead of risk/reversibility.  
**Recommended response:** define immediate+Undo, inline confirm and modal confirm rules with consistent consequence copy.  
**Architecture impact:** low  
**Acceptance criterion:** confirmation level matches reversibility and Undo availability is explicit.  
**Recommended slice:** M7.2 Context Inspector Foundation

## UX-PATTERN-002

**Title:** Essential interface meaning frequently uses 9–10 px text  
**Severity:** P1  
**Affected journey:** J01, J02, J03, J04, J05, J06, J07, J08, J09, J10, J11  
**Affected surface:** toolbar, catalogue, dashboard, reference, recognition, planning  
**Frequency:** high  
**Confidence:** high  
**Evidence:** save state, preset dimensions, helpers and candidate metadata use 9–10 px CSS.  
**Root cause:** space pressure was solved through typography reduction.  
**Recommended response:** define readable tokens and achieve density through hierarchy/progressive disclosure.  
**Architecture impact:** low  
**Acceptance criterion:** no essential semantic depends on 9–10 px text; 200% zoom keeps labels/actions reachable.  
**Recommended slice:** M7.3 Design System and Content Components

## UX-PATTERN-003

**Title:** Shared controls use many one-off sizes and treatments  
**Severity:** P3  
**Affected journey:** J01, J02, J03, J04, J05, J06, J07, J08, J09, J10, J11  
**Affected surface:** toolbar, inspectors, panels, dialogs and cards  
**Frequency:** high maintenance cost  
**Confidence:** high  
**Evidence:** many radii/gaps/header/close variants; recognition maintains private component CSS.  
**Root cause:** no explicit token/component system governed feature delivery.  
**Recommended response:** introduce shared tokens/primitives before broad visual polish.  
**Architecture impact:** low  
**Acceptance criterion:** component families map to documented primitives with intentional density variants.  
**Recommended slice:** M7.3 Design System and Content Components

## UX-ACCESS-001

**Title:** End-to-end keyboard/focus semantics are undefined for spatial workflows  
**Severity:** P1  
**Affected journey:** J01, J03, J05, J06, J07, J08, J09  
**Affected surface:** Canvas, calibration, 3D, dialogs and panels  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** many HTML controls are labelled, but drawing, point measurement, calibration and 3D lack one keyboard/focus/announcement contract.  
**Root cause:** accessibility was implemented locally rather than end to end.  
**Recommended response:** define reachability, focus order, Escape, announcements and practical numeric/semantic alternatives per workflow.  
**Architecture impact:** medium  
**Acceptance criterion:** the documented keyboard/focus matrix passes and important async transitions are announced.  
**Recommended slice:** M7.9 Accessibility and Responsive Hardening

## UX-ACCESS-002

**Title:** Browser zoom can trigger functional disappearance instead of reflow  
**Severity:** P1  
**Affected journey:** J01, J02, J03, J04, J05, J06, J07, J08, J09, J10, J11  
**Affected surface:** editor shell and side panels  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** width breakpoints hide status, utilities, inspector and catalogue; zoom reduces effective CSS viewport.  
**Root cause:** breakpoints are width-oriented rather than task-reachability-oriented.  
**Recommended response:** reflow/collapse into reachable surfaces and test zoom as a first-class matrix.  
**Architecture impact:** medium  
**Acceptance criterion:** at 100/125/150/200%, no primary action or selected-entity control disappears without replacement.  
**Recommended slice:** M7.1 Editor Shell and Responsive Context

## UX-CONTENT-001

**Title:** Critical terminology is feature-local rather than canonically governed  
**Severity:** P2  
**Affected journey:** J02, J04, J05, J07, J09, J10, J11  
**Affected surface:** toolbar, Canvas, inspectors, workflows and export  
**Frequency:** high  
**Confidence:** high  
**Evidence:** axis length, clear size, dimensions, centre distance, contour gap, recommendation, preference, hard rule, Draft, Preview and Applied require stable distinctions.  
**Root cause:** terminology was corrected milestone by milestone without one content source.  
**Recommended response:** enforce one Russian glossary with preferred/prohibited alternatives and helper copy.  
**Architecture impact:** none  
**Acceptance criterion:** each concept uses the same term across toolbar, Canvas, inspector and docs unless a contextual variant is explicitly documented.  
**Recommended slice:** M7.3 Design System and Content Components

## 4. Finding summary

| Severity | Count | Interpretation |
|---|---:|---|
| P0 | 0 | no evidenced data-loss/core blocker |
| P1 | 10 | comprehension, reachability or accessibility risk |
| P2 | 22 | repeated friction, hidden capability or structural debt |
| P3 | 6 | consistency and polish after foundations |
| P4 | 0 | optional polish intentionally not expanded during foundation audit |
| **Total** | **38** | structured findings |

## 5. Highest-priority themes

1. Preserve inspector/action reachability across viewport and zoom.
2. Rebuild toolbar/context hierarchy before cosmetic polish.
3. Establish readable typography, shared components and canonical content.
4. Make hard/soft/temporary/persistent semantics visible rather than prose-dependent.
5. Provide practical keyboard/focus alternatives for pointer-driven workflows.
6. Simplify advanced workflows through progressive disclosure without removing precision.

## 6. Browser acceptance matrix

The source-backed findings require representative review at:

- 1920×1080 at 100% and 125%;
- 1440×900 at 100% and 125%;
- 1366×768 at 100%;
- 1280×800 at 100%;
- representative 150% and 200% zoom;
- a narrower width for graceful limitation;
- Yandex/Chromium full-product review;
- Safari core dashboard/editor/form/dialog regression.

Browser evidence may confirm, merge, reduce or reprioritise findings. It must not be represented as completed until recorded in `docs/milestones/m7-0-acceptance.md`.
