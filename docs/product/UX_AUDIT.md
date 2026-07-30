# Vlezet — Product, UI and UX Audit

**Phase:** M7.0 Product and UX Audit  
**Status:** source-backed audit draft; representative browser verification remains an acceptance gate  
**Scope:** current product through accepted M6.4

## 1. Methodology

The audit combines:

- source review of current routes, components, state ownership and CSS;
- accepted browser evidence from M4.6, M6.1–M6.4;
- product-owner screenshots and reports, including the inspector overflow and natural-language review workflow;
- heuristic evaluation for status visibility, ordinary language, error prevention, consistency, recognition over recall, accessibility and spatial-editor mode clarity;
- architecture review to preserve document, geometry, persistence, Preview and Apply authority.

Evidence confidence:

- **high** — directly visible in source and/or supplied browser evidence;
- **medium** — strongly implied by source and common target environments, requiring representative browser confirmation;
- **low** — plausible risk recorded for test coverage, not yet a redesign commitment.

No P0 finding was identified in the reviewed evidence. The product architecture has strong data-safety and fail-closed foundations. The dominant risks are comprehension, reachability, density and visual consistency.

## 2. Current strengths to preserve

- Local-first editing and autosave do not depend on network services.
- The authoritative apartment document is separate from Canvas, 3D and generated drafts.
- Clear room dimensions and area share one geometry source.
- Fit status is structured and explainable.
- Recognition and language interpretation create reviewable drafts.
- Planning Preview is non-mutating and Apply is explicit/revalidated.
- Network/provider failures preserve manual workflows.
- 3D failure explicitly preserves the 2D path.
- Undo/Redo is semantic and accepted across high-impact operations.
- Current visual direction is restrained and already recognisable as one product.

## UX-SHELL-001

**Title:** Global, tool, display and document actions compete in one toolbar row  
**Severity:** P2  
**Affected journey:** J01, J03, J04, J05, J06, J07, J08, J11  
**Affected surface:** `CMP-TOOLBAR`  
**Frequency:** high  
**Confidence:** high  
**Evidence:** `EV-M7-SOURCE-TOOLBAR`, `EV-M7-SOURCE-CSS`; the toolbar contains project identity, nine editing/workflow tools, 2D/3D, selection hints, document counts, fit, export and history. Responsive rules hide information and utilities rather than establishing a stable hierarchy.  
**Root cause:** product capabilities were added milestone by milestone to one horizontal command surface.  
**Recommended response:** split global product actions, exclusive tools and contextual/utility actions into explicit layers while preserving shortcuts.  
**Architecture impact:** low  
**Acceptance criterion:** at all required desktop widths/zoom, the active tool and project/save/history actions remain visible; lower-priority utilities collapse into an understandable menu rather than disappearing without replacement.  
**Recommended slice:** M7.1 Editor Shell and Command Hierarchy

## UX-SHELL-002

**Title:** The right inspector becomes unreachable below 980 px  
**Severity:** P1  
**Affected journey:** J01, J02, J03, J04, J06, J07, J09, J10  
**Affected surface:** `CMP-CONTEXT-INSPECTOR`, `CMP-REFERENCE-PANEL`, `CMP-RECOGNITION-PANEL`  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** `EV-M7-SOURCE-CSS`; current media rules set these panels to `display:none` below 980 px with no drawer/sheet replacement. Browser zoom can cross the same effective-width threshold on an otherwise desktop display.  
**Root cause:** responsive handling protects Canvas by removing side surfaces rather than preserving task completion through another presentation.  
**Recommended response:** introduce one viewport-safe contextual surface that becomes a resizable panel or accessible overlay/drawer; communicate minimum editing width where necessary.  
**Architecture impact:** medium  
**Acceptance criterion:** selected-object/room/opening controls and active reference/recognition/planning workflows remain reachable at 1280×800 and required zoom levels; narrower widths fail gracefully with an explicit supported-action path.  
**Recommended slice:** M7.1 Editor Shell and Command Hierarchy

## UX-SHELL-003

**Title:** Advanced workflows replace selection context without a shared navigation model  
**Severity:** P2  
**Affected journey:** J06, J07, J09, J10  
**Affected surface:** right-side panels  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** `EV-M7-SOURCE-SHELL`; reference and recognition replace the ordinary inspector, while planning is nested inside the room inspector and replaces it until closed.  
**Root cause:** each workflow owns the same physical slot but panel hierarchy, back behaviour and context preservation were designed independently.  
**Recommended response:** define a single context-panel navigation model with clear title, context identity, close/back semantics and preserved selection.  
**Architecture impact:** medium  
**Acceptance criterion:** entering/exiting reference, recognition and planning follows one predictable navigation pattern and returns to the prior semantic context without unexplained state loss.  
**Recommended slice:** M7.2 Context Inspector Foundation

## UX-SHELL-004

**Title:** Active modes use several disconnected status locations  
**Severity:** P3  
**Affected journey:** J05, J06, J07, J09  
**Affected surface:** toolbar, Canvas, fixed banners, inspector  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** active tool styling is in the toolbar; tracing/recognition use bottom-centre banners; planning uses the inspector and Canvas overlays; errors may appear inline or globally.  
**Root cause:** mode/status feedback was introduced per feature.  
**Recommended response:** define a mode/status hierarchy and a shared Canvas status pattern.  
**Architecture impact:** low  
**Acceptance criterion:** the user can identify active tool/workflow and exit action from one consistent location plus relevant Canvas feedback.  
**Recommended slice:** M7.4 Canvas and Mode Feedback

## UX-SHELL-005

**Title:** Internal milestone labels appear in end-user planning UI  
**Severity:** P3  
**Affected journey:** J09, J10  
**Affected surface:** `CMP-PLANNING-PANEL`, `CMP-PLANNING-INTENT`  
**Frequency:** high within planning  
**Confidence:** high  
**Evidence:** visible copy includes `M6.4 · Проверяемые пожелания` and an `M6.4` badge.  
**Root cause:** development-stage identity leaked into production copy.  
**Recommended response:** replace milestone labels with user-facing workflow names; retain version history only in documentation.  
**Architecture impact:** none  
**Acceptance criterion:** no internal roadmap/milestone identifiers are visible in ordinary product workflows.  
**Recommended slice:** M7.3 Design System and Content Foundation

## UX-ONBOARD-001

**Title:** The first-room workflow relies on users discovering topology semantics  
**Severity:** P2  
**Affected journey:** J01  
**Affected surface:** dashboard, toolbar, Canvas, empty inspector  
**Frequency:** high for new users  
**Confidence:** medium  
**Evidence:** the blank editor exposes tools and generic Canvas help, while a room appears only after a valid closed wall topology. The empty inspector says what can be selected but does not guide the first complete task.  
**Root cause:** the interface starts as a capable editor rather than a goal-oriented first-run experience.  
**Recommended response:** add a dismissible first-project checklist and contextual next action without creating a blocking wizard.  
**Architecture impact:** low  
**Acceptance criterion:** a first-time user can create a rectangular room and recognise successful closure without prior explanation from documentation.  
**Recommended slice:** M7.5 Onboarding and Recovery

## UX-CANVAS-001

**Title:** Canvas help is compact, passive and not context-sensitive enough  
**Severity:** P2  
**Affected journey:** J01, J03, J04, J05  
**Affected surface:** `CMP-CANVAS`  
**Frequency:** high  
**Confidence:** medium  
**Evidence:** bottom-left help is 11 px, pointer-events disabled and partially hidden at narrower widths; tool-specific completion/cancel instructions are distributed across title attributes, banners and panel copy.  
**Root cause:** help is a static overlay rather than a semantic active-tool guide.  
**Recommended response:** show concise active-tool instruction, next click meaning and Escape/cancel in a consistent Canvas status area.  
**Architecture impact:** low  
**Acceptance criterion:** every exclusive tool exposes current state, expected next action and exit path without requiring hover tooltips.  
**Recommended slice:** M7.4 Canvas and Mode Feedback

## UX-CANVAS-002

**Title:** Semantic selection priority is not explained when entities overlap  
**Severity:** P2  
**Affected journey:** J02, J03, J04  
**Affected surface:** Canvas and context inspector  
**Frequency:** medium  
**Confidence:** medium  
**Evidence:** walls, room fills, openings, furniture, handles, reference and draft overlays can share screen space; the product provides selection outcomes but no visible cycling/selection breadcrumb model.  
**Root cause:** selection behaviour is implemented by rendering/hit rules rather than surfaced as an interaction contract.  
**Recommended response:** define semantic hit priority, selectable hover affordance and a way to reach obscured entities.  
**Architecture impact:** medium  
**Acceptance criterion:** representative overlaps allow users to predict/select wall, room, opening and object without repeated random clicking.  
**Recommended slice:** M7.4 Canvas and Mode Feedback

## UX-GEO-001

**Title:** Door swing uses wall-direction terminology that encourages trial and error  
**Severity:** P1  
**Affected journey:** J03  
**Affected surface:** `CMP-INSPECTOR-OPENING`, Canvas  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** controls say `Со стороны начала проёма`, `Влево от направления стены` and `Вправо от направления стены`; the directed wall is an internal geometric concept.  
**Root cause:** domain representation is exposed directly instead of translating to visual room-relative choices.  
**Recommended response:** use a visual four-way swing selector tied to the displayed door arc, with accessible text describing hinge side and opening direction in the room.  
**Architecture impact:** low  
**Acceptance criterion:** a non-technical user selects the intended hinge/swing on the first attempt in horizontal and vertical walls.  
**Recommended slice:** M7.6 Geometry and Opening Inspector

## UX-GEO-002

**Title:** Precision editing repeats label–input–anchor–Apply blocks without clear grouping  
**Severity:** P2  
**Affected journey:** J02  
**Affected surface:** room and wall inspectors  
**Frequency:** high  
**Confidence:** high  
**Evidence:** room width and length each repeat input, anchor select and Apply; wall length and thickness follow related but different patterns with multiple helper paragraphs.  
**Root cause:** controls mirror individual commands rather than one coherent geometry form with grouped semantics.  
**Recommended response:** introduce structured inspector sections, paired dimension rows, local commit/revert rules and contextual helper disclosure.  
**Architecture impact:** low  
**Acceptance criterion:** clear dimensions, axis length and thickness are visually separated concepts; each change has one obvious commit and error location.  
**Recommended slice:** M7.6 Geometry and Opening Inspector

## UX-GEO-003

**Title:** Room width/length labels depend on screen orientation rather than explicit axes  
**Severity:** P2  
**Affected journey:** J02  
**Affected surface:** `CMP-INSPECTOR-ROOM`, dimension overlays  
**Frequency:** medium  
**Confidence:** medium  
**Evidence:** rectangular dimensions are labelled `Ширина` and `Длина` with left/right and top/bottom anchors. The naming may become unstable for rotated/imported mental models even when geometry is axis-aligned.  
**Root cause:** ordinary-language labels and Cartesian implementation axes are not connected by a visible diagram.  
**Recommended response:** pair labels with a miniature orientation cue or explicit horizontal/vertical wording, preserving ordinary terms where unambiguous.  
**Architecture impact:** low  
**Acceptance criterion:** users can identify which physical room span changes before applying either dimension.  
**Recommended slice:** M7.6 Geometry and Opening Inspector

## UX-FURN-001

**Title:** Object inspector presents advanced coordinates before common furniture edits  
**Severity:** P2  
**Affected journey:** J04  
**Affected surface:** `CMP-INSPECTOR-OBJECT`  
**Frequency:** high  
**Confidence:** high  
**Evidence:** name is followed by `Центр X`, `Центр Y`, dimensions, height, rotation and four clearance fields in one long form.  
**Root cause:** all persistent object properties are given equal visual priority.  
**Recommended response:** prioritise name, dimensions and rotation; place exact coordinates and directional clearance tuning in an advanced section.  
**Architecture impact:** low  
**Acceptance criterion:** common resize/rotate actions are visible without scanning coordinate/clearance fields; advanced values remain reachable and precise.  
**Recommended slice:** M7.7 Furniture and Fit Workflow

## UX-FURN-002

**Title:** Object-relative clearance directions are not visually mapped after rotation  
**Severity:** P1  
**Affected journey:** J04  
**Affected surface:** object inspector and Canvas  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** fields `Спереди/Справа/Сзади/Слева` are edited as object-local margins, but the inspector has no orientation diagram connecting them to the rotated object.  
**Root cause:** correct domain semantics are expressed only through text labels.  
**Recommended response:** show a compact orientation diagram or directional chips synchronized with object rotation and Canvas selection.  
**Architecture impact:** low  
**Acceptance criterion:** at 0°, 90°, 180° and 270°, users correctly identify the physical clearance side without trial edits.  
**Recommended slice:** M7.7 Furniture and Fit Workflow

## UX-FURN-003

**Title:** Furniture discovery is a long static list with no search or compact filtering  
**Severity:** P2  
**Affected journey:** J04  
**Affected surface:** `CMP-FURNITURE-CATALOG`  
**Frequency:** medium and increasing with catalogue growth  
**Confidence:** high  
**Evidence:** all presets are rendered by fixed category order in a 250 px scrollable panel; there is no search, recent items or collapse.  
**Root cause:** catalogue size was initially small and category browsing was sufficient.  
**Recommended response:** add search and category navigation after the shell/design-system foundation; preserve simple preset placement.  
**Architecture impact:** low  
**Acceptance criterion:** a known item can be found and selected without scanning unrelated categories; keyboard focus/order remains predictable.  
**Recommended slice:** M7.7 Furniture and Fit Workflow

## UX-FURN-004

**Title:** One generic Apply error represents many unrelated object fields  
**Severity:** P2  
**Affected journey:** J04  
**Affected surface:** `CMP-INSPECTOR-OBJECT`  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** all numeric fields are parsed on one Apply and one error paragraph reports the first failure; invalid fields are not individually marked.  
**Root cause:** form validation is command-oriented rather than field-oriented.  
**Recommended response:** validate/associate errors per field and preserve an atomic Apply for multi-property updates.  
**Architecture impact:** low  
**Acceptance criterion:** an invalid value identifies its exact field, keeps valid inputs intact and gives a corrective message.  
**Recommended slice:** M7.3 Design System and Content Foundation

## UX-REF-001

**Title:** Reference workflow mixes explicit Save with immediate transform changes  
**Severity:** P2  
**Affected journey:** J06  
**Affected surface:** `CMP-REFERENCE-PANEL`  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** calibration requires `Сохранить и открыть план`; installed visibility, opacity, X/Y and rotation mutate on change without a dedicated Apply/revert model.  
**Root cause:** import and post-install editing were designed as separate interaction styles inside one panel.  
**Recommended response:** state commitment rules explicitly and group immediate reversible display controls separately from high-impact calibration/replacement actions.  
**Architecture impact:** low  
**Acceptance criterion:** users can predict which reference changes are immediate, undoable/persistent and which require confirmation.  
**Recommended slice:** M7.8 Reference and Recognition Workflow

## UX-REF-002

**Title:** Calibration has no keyboard-equivalent point placement  
**Severity:** P1  
**Affected journey:** J06  
**Affected surface:** calibration stage  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** pointer events assign/drag points; visual handles are `aria-hidden`; no keyboard coordinate input or semantic point controls are exposed.  
**Root cause:** calibration was implemented as a visual pointer tool only.  
**Recommended response:** provide keyboard-operable point controls or coordinate fields with clear focus/announcement, while retaining pointer precision.  
**Architecture impact:** medium  
**Acceptance criterion:** calibration can be completed without drag-only interaction and focus remains visible at 200% zoom.  
**Recommended slice:** M7.9 Accessibility and Responsive Hardening

## UX-REC-001

**Title:** Recognition state vocabulary mixes Russian explanations with technical English values  
**Severity:** P2  
**Affected journey:** J07  
**Affected surface:** `CMP-RECOGNITION-PANEL`  
**Frequency:** high within recognition  
**Confidence:** high  
**Evidence:** candidate list exposes decision values such as `pending`; origin text includes `Local + AI`; confidence/conflict semantics use compact technical labels.  
**Root cause:** internal enum/provider vocabulary is rendered with partial translation.  
**Recommended response:** define canonical user-facing terms for source, confidence, conflict and decision state.  
**Architecture impact:** none  
**Acceptance criterion:** no internal enum value is displayed; every state has consistent Russian wording and non-colour status.  
**Recommended slice:** M7.8 Reference and Recognition Workflow

## UX-REC-002

**Title:** Recognition depends on very small text and colour-coded confidence  
**Severity:** P1  
**Affected journey:** J07  
**Affected surface:** recognition summary/candidate list  
**Frequency:** high within recognition  
**Confidence:** high  
**Evidence:** candidate secondary/status text uses 9 px; confidence dots change colour for high/medium/low/conflict; textual state exists but is not a consistent non-colour badge.  
**Root cause:** dense candidate review was optimised for compactness before accessibility consolidation.  
**Recommended response:** use readable status badges/icons with text, minimum typography tokens and explicit conflict messages.  
**Architecture impact:** low  
**Acceptance criterion:** candidate confidence/decision/conflict remains understandable in grayscale, at 200% zoom and without reading 9 px text.  
**Recommended slice:** M7.9 Accessibility and Responsive Hardening

## UX-REC-003

**Title:** Recognition’s source–draft–trusted geometry distinction is text-heavy  
**Severity:** P2  
**Affected journey:** J07  
**Affected surface:** recognition panel, Canvas banner/overlays  
**Frequency:** medium  
**Confidence:** medium  
**Evidence:** safety is explained through intro, banner, footer and helper text; candidates are coloured lines over the same work surface as trusted geometry.  
**Root cause:** strong architecture boundaries are not represented by one consistent visual state model.  
**Recommended response:** establish canonical Draft/Preview/Applied styling and a persistent legend during review.  
**Architecture impact:** low  
**Acceptance criterion:** users can identify source image, recognition draft and saved geometry without relying on long explanatory paragraphs.  
**Recommended slice:** M7.8 Reference and Recognition Workflow

## UX-REC-004

**Title:** Recognition has an isolated inline design system  
**Severity:** P3  
**Affected journey:** J07  
**Affected surface:** recognition component styles  
**Frequency:** continuous maintenance risk  
**Confidence:** high  
**Evidence:** a substantial CSS template string defines cards, fields, modal, banner, typography and responsive behaviour inside the component.  
**Root cause:** feature delivery preceded shared component/token foundations.  
**Recommended response:** migrate to shared tokens/components after visual contracts are defined, without combining it with recognition algorithm work.  
**Architecture impact:** low  
**Acceptance criterion:** recognition uses the same field, notice, badge, card, dialog and focus patterns as the rest of the product.  
**Recommended slice:** M7.3 Design System and Content Foundation

## UX-3D-001

**Title:** 3D context appears in a different interaction location than 2D context  
**Severity:** P2  
**Affected journey:** J08  
**Affected surface:** `CMP-SPATIAL-VIEWER`, `SpatialInspector`, 2D context inspector  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** 2D details use the fixed right inspector; 3D details are an overlay inside the viewer. Selection state is separate and reset by mode changes.  
**Root cause:** 3D was added as a self-contained read-only viewer.  
**Recommended response:** align semantic selection language and inspector anatomy across modes, while keeping 3D read-only and renderer-isolated.  
**Architecture impact:** medium  
**Acceptance criterion:** selecting the same entity in 2D and 3D produces recognisably consistent context and clear mode-specific limitations.  
**Recommended slice:** M7.10 2D/3D Context Consistency

## UX-3D-002

**Title:** Core 3D navigation and semantic selection are pointer-only  
**Severity:** P2  
**Affected journey:** J08  
**Affected surface:** spatial viewer  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** OrbitControls and raycasting handle orbit/pan/zoom/hover/click; no keyboard camera or semantic target navigation is exposed.  
**Root cause:** initial 3D scope prioritised deterministic projection and pointer inspection.  
**Recommended response:** add keyboard camera presets/fit and an accessible semantic entity list or navigation path; do not introduce direct 3D editing.  
**Architecture impact:** medium  
**Acceptance criterion:** essential 3D inspection can be reached without precise pointer-only interaction.  
**Recommended slice:** M7.9 Accessibility and Responsive Hardening

## UX-PLAN-001

**Title:** Provider configuration dominates the beginning of the planning workflow  
**Severity:** P2  
**Affected journey:** J09, J10  
**Affected surface:** `CMP-PLANNING-INTENT`, `CMP-PLANNING-PANEL`  
**Frequency:** high whenever planning is opened  
**Confidence:** high  
**Evidence:** natural-language textarea, API-key field and model selection appear before manual object/constraint controls, although manual deterministic planning is the core network-independent workflow.  
**Root cause:** M6.4 was appended as the first panel section to showcase language entry.  
**Recommended response:** make task selection/manual planning primary and move language interpretation into an optional “Describe wishes” expansion with provider settings progressively disclosed.  
**Architecture impact:** low  
**Acceptance criterion:** users can reach deterministic manual planning without scanning provider configuration; language remains discoverable and reviewable.  
**Recommended slice:** M7.11 Planning Workflow Simplification

## UX-PLAN-002

**Title:** Planning panel accumulates configuration, review, results and evidence in one long scroll  
**Severity:** P2  
**Affected journey:** J09, J10  
**Affected surface:** planning inspector  
**Frequency:** high within planning  
**Confidence:** high  
**Evidence:** intent review, 1–3 object controls, pair cards, exact gaps, Generate, errors and result cards share a 290–330 px scroll surface.  
**Root cause:** each planning milestone added a section without a step/progressive-disclosure architecture.  
**Recommended response:** organise planning into clear phases (intent, constraints, results) with sticky context/actions and preserved Canvas area.  
**Architecture impact:** medium  
**Acceptance criterion:** the current phase, selected objects and primary action remain visible; configuring three objects does not require losing orientation in the panel.  
**Recommended slice:** M7.11 Planning Workflow Simplification

## UX-PLAN-003

**Title:** Hard constraints and soft preferences are distinguished mainly by prose  
**Severity:** P1  
**Affected journey:** J09, J10  
**Affected surface:** planning object/pair controls and results  
**Frequency:** high within planning  
**Confidence:** high  
**Evidence:** `Не двигать` and exact contour gap are hard; wall/corner and near/far are soft. Controls share similar fields/cards and helper paragraphs explain the difference.  
**Root cause:** semantic types are precise in code but not encoded in one visual language.  
**Recommended response:** introduce explicit `Обязательно`/`Предпочтительно` grouping, icons/badges and result evidence that uses the same semantics.  
**Architecture impact:** low  
**Acceptance criterion:** users correctly predict whether an unmet request rejects a candidate or only changes ranking.  
**Recommended slice:** M7.11 Planning Workflow Simplification

## UX-PLAN-004

**Title:** Comparing alternatives competes with Canvas and configuration context  
**Severity:** P2  
**Affected journey:** J09  
**Affected surface:** result cards, Canvas Preview  
**Frequency:** medium  
**Confidence:** medium  
**Evidence:** alternatives are stacked below configuration in the narrow inspector; Preview evidence appears on Canvas, requiring repeated visual movement and scrolling.  
**Root cause:** result comparison reuses the configuration panel rather than a comparison-focused layout.  
**Recommended response:** preserve a compact constraint summary and support direct previous/next comparison with sticky Preview/Apply controls.  
**Architecture impact:** medium  
**Acceptance criterion:** users compare up to three alternatives without scrolling back to remember selected constraints or losing the active Preview.  
**Recommended slice:** M7.11 Planning Workflow Simplification

## UX-DATA-001

**Title:** Save state is visually too subtle for a local-first product  
**Severity:** P1  
**Affected journey:** J11  
**Affected surface:** project identity/save status  
**Frequency:** high  
**Confidence:** high  
**Evidence:** save state is 9 px below the project name; normal states are muted, while the product promise depends on local persistence and there is no explicit manual Save.  
**Root cause:** save state was designed as compact toolbar metadata.  
**Recommended response:** create a readable persistent save indicator with clear local wording, last-saved detail and prominent failed/retry state.  
**Architecture impact:** low  
**Acceptance criterion:** at all required zoom levels, users can distinguish saving, saved locally and not saved without hovering.  
**Recommended slice:** M7.1 Editor Shell and Command Hierarchy

## UX-DATA-002

**Title:** Export format choices require technical interpretation  
**Severity:** P2  
**Affected journey:** J11  
**Affected surface:** export menu, dashboard import  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** options are `PNG`, `PNG с подложкой`, `Vlezet JSON`; helper text calls JSON a backup but the file-extension/restore relationship is not represented as one lifecycle action.  
**Root cause:** export actions are grouped by technical output format.  
**Recommended response:** group as `Изображение` and `Резервная копия проекта`, with restore/import language mirrored on dashboard.  
**Architecture impact:** none  
**Acceptance criterion:** users select the editable backup and know how to restore it without understanding JSON.  
**Recommended slice:** M7.12 Dashboard and Project Lifecycle

## UX-DATA-003

**Title:** Important success feedback exists only as short-lived toasts  
**Severity:** P3  
**Affected journey:** J07, J09, J11  
**Affected surface:** global toast  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** toasts disappear after approximately 2.6 seconds and report copy/apply/export events; there is no notification history or persistent completion location.  
**Root cause:** a single transient success mechanism serves actions of different importance.  
**Recommended response:** keep minor toasts but place high-value completion evidence near the originating workflow and expose accessible live-region timing.  
**Architecture impact:** low  
**Acceptance criterion:** users can confirm high-impact completion after the toast disappears.  
**Recommended slice:** M7.5 Onboarding and Recovery

## UX-DASH-001

**Title:** Project previews do not represent the actual saved plan  
**Severity:** P2  
**Affected journey:** J11  
**Affected surface:** dashboard project cards  
**Frequency:** high with multiple projects  
**Confidence:** high  
**Evidence:** every project card uses the same decorative CSS floor-plan placeholder; differentiation relies on text name/facts/date.  
**Root cause:** dashboard thumbnails were not part of the local-first project milestone.  
**Recommended response:** generate a lightweight local thumbnail from authoritative geometry or use meaningful structured facts when thumbnail generation is unavailable.  
**Architecture impact:** low  
**Acceptance criterion:** users visually distinguish multiple projects without opening them; thumbnail remains derived and non-authoritative.  
**Recommended slice:** M7.12 Dashboard and Project Lifecycle

## UX-DASH-002

**Title:** Rename interaction has redundant and partially hidden paths  
**Severity:** P3  
**Affected journey:** J11  
**Affected surface:** project card  
**Frequency:** low  
**Confidence:** high  
**Evidence:** title click opens, double-click starts rename, and an explicit `Переименовать` action also exists.  
**Root cause:** convenience interaction was added alongside explicit controls.  
**Recommended response:** retain one discoverable action and optional clearly hinted direct edit; avoid overloading title click/double-click.  
**Architecture impact:** none  
**Acceptance criterion:** rename is discoverable and keyboard-operable without conflicting with open.  
**Recommended slice:** M7.12 Dashboard and Project Lifecycle

## UX-PATTERN-001

**Title:** Confirmation and destructive-action patterns are inconsistent  
**Severity:** P2  
**Affected journey:** J03, J04, J06, J11  
**Affected surface:** dashboard dialog, inline reference confirmation, immediate object/opening deletion  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** project deletion uses a modal and is irreversible; reference removal uses inline confirmation; object/opening deletion is immediate but undoable. The UI does not consistently explain why confirmation differs.  
**Root cause:** deletion patterns were designed per domain action rather than by reversibility/risk.  
**Recommended response:** define a destructive-action matrix: immediate+Undo, confirm-inline, confirm-modal, with consistent copy and placement.  
**Architecture impact:** low  
**Acceptance criterion:** confirmation level matches reversibility and users can tell whether Undo is available.  
**Recommended slice:** M7.3 Design System and Content Foundation

## UX-PATTERN-002

**Title:** Essential interface text frequently uses 9–10 px typography  
**Severity:** P1  
**Affected journey:** J01–J11  
**Affected surface:** toolbar, catalogue, dashboard facts, reference, recognition, planning  
**Frequency:** high  
**Confidence:** high  
**Evidence:** save state, preset dimensions, helper text, status labels and candidate metadata use 9–10 px sizes in CSS.  
**Root cause:** dense desktop layout solved space pressure through typography reduction.  
**Recommended response:** define readable typography tokens and reduce density through hierarchy/progressive disclosure rather than essential microtext.  
**Architecture impact:** low  
**Acceptance criterion:** essential labels/status/helpers remain readable at 100% and do not become clipped/unreachable at 200% zoom; no essential semantic depends on 9–10 px text.  
**Recommended slice:** M7.3 Design System and Content Foundation

## UX-PATTERN-003

**Title:** Shared controls have many one-off sizes, headers and close treatments  
**Severity:** P3  
**Affected journey:** J01–J11  
**Affected surface:** toolbar, inspectors, panels, dialogs, cards  
**Frequency:** high maintenance cost  
**Confidence:** high  
**Evidence:** repeated radii/gaps/sizes vary across CSS; panel headers and close buttons use different classes; recognition defines private variants.  
**Root cause:** no explicit token/component system governed milestone delivery.  
**Recommended response:** introduce tokens and shared primitives before broad visual polish.  
**Architecture impact:** low  
**Acceptance criterion:** current component families map to documented primitives with consistent states and intentional density variants.  
**Recommended slice:** M7.3 Design System and Content Foundation

## UX-ACCESS-001

**Title:** Focus, keyboard and semantic coverage is not defined across Canvas workflows  
**Severity:** P1  
**Affected journey:** J01, J03, J05, J06, J07, J08, J09  
**Affected surface:** Canvas, calibration, 3D, dialogs/panels  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** many native controls are labelled, but pointer-driven drawing, point measurement, calibration and 3D lack a complete keyboard/focus contract; Canvas feedback is primarily visual.  
**Root cause:** accessibility was implemented locally for HTML controls rather than as an end-to-end interaction model.  
**Recommended response:** define keyboard reachability, focus order, Escape hierarchy, semantic announcements and alternative paths per workflow.  
**Architecture impact:** medium  
**Acceptance criterion:** accessibility matrix passes required keyboard/focus scenarios and important async state is announced.  
**Recommended slice:** M7.9 Accessibility and Responsive Hardening

## UX-ACCESS-002

**Title:** Browser zoom can trigger functional disappearance rather than reflow  
**Severity:** P1  
**Affected journey:** J01–J11  
**Affected surface:** editor shell and side panels  
**Frequency:** medium  
**Confidence:** high  
**Evidence:** responsive breakpoints hide status, utility actions, right inspector and catalogue; zoom reduces effective CSS viewport and can activate those rules.  
**Root cause:** layout breakpoints are width-oriented and not tied to task reachability.  
**Recommended response:** test zoom as a first-class matrix, reflow/collapse controls into reachable surfaces and show explicit minimum-editor guidance only as a last resort.  
**Architecture impact:** medium  
**Acceptance criterion:** at 100%, 125%, 150% and 200%, no primary action or selected-entity control disappears without an accessible replacement.  
**Recommended slice:** M7.9 Accessibility and Responsive Hardening

## UX-CONTENT-001

**Title:** Canonical terms exist in code but are not governed across all surfaces  
**Severity:** P2  
**Affected journey:** J02, J04, J05, J07, J09, J10, J11  
**Affected surface:** toolbar, inspector, Canvas labels, workflow panels, export  
**Frequency:** high  
**Confidence:** high  
**Evidence:** the product must distinguish wall-axis length, clear size, object dimensions, centre distance, contour gap, recommendation, preference, hard rule, draft, Preview and applied change; wording is feature-local.  
**Root cause:** terminology was corrected milestone by milestone without one content source.  
**Recommended response:** create and enforce one Russian glossary with preferred/prohibited alternatives and helper copy.  
**Architecture impact:** none  
**Acceptance criterion:** each semantic concept uses the same user-facing term across toolbar, inspector, Canvas and documentation unless a documented contextual variant exists.  
**Recommended slice:** M7.3 Design System and Content Foundation

## 3. Finding summary

| Severity | Count | Interpretation |
|---|---:|---|
| P0 | 0 | no evidenced data-loss/core blocker |
| P1 | 11 | comprehension, reachability or accessibility risk |
| P2 | 22 | repeated friction, hidden capability or structural debt |
| P3 | 9 | consistency and polish after foundations |
| P4 | 0 | optional polish intentionally not expanded during foundation audit |

The counts above reflect the structured findings in this document and must be recalculated during final validation if findings are merged or split.

## 4. Highest-priority themes

1. Preserve inspector/action reachability across viewport and zoom.
2. Rebuild toolbar and context-panel hierarchy before visual polish.
3. Establish readable typography, shared components and canonical content.
4. Make hard/soft/temporary/persistent semantics visible rather than prose-dependent.
5. Provide end-to-end keyboard/focus alternatives for pointer-driven workflows.
6. Simplify advanced workflows through progressive disclosure without removing precision.

## 5. Browser verification matrix for acceptance

Source-backed findings must be validated against representative states at:

- 1920×1080 at 100% and 125%;
- 1440×900 at 100% and 125%;
- 1366×768 at 100%;
- 1280×800 at 100%;
- browser zoom 150% and 200%;
- a narrower width to confirm graceful limitation;
- Chromium/Yandex Browser and Safari core regression.

The existing M6.3/M6.4 screenshots already confirm the value of this matrix: inspector overflow and narrow-panel spacing were real browser-only findings that automated functional tests did not reveal.
