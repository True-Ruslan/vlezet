# M7 Product UX Foundation — Design

**Date:** 2026-07-30  
**Status:** approved design; audit and implementation planning pending  
**Product:** Vlezet apartment planner

## 1. Decision

Vlezet will pause speculative feature expansion after accepted M6.4 and run a complete product, UI and UX review before selecting the next functional milestone.

The chosen direction is an **evolutionary redesign**:

- preserve the trusted document, geometry, persistence and planning architecture;
- preserve familiar product identity where it already works;
- substantially improve information architecture, interaction hierarchy, terminology, visual consistency, accessibility and ergonomics;
- avoid both superficial cosmetic changes and a high-risk UI rewrite.

M7 is a product-foundation programme, not one giant redesign pull request.

## 2. Why now

Vlezet has reached a coherent functional foundation through M6.4:

- precise apartment shell editing;
- furnishing and deterministic fit checks;
- local-first projects and export;
- reference-plan import and assisted recognition;
- clear-size geometry UX and tape measurement;
- read-only spatial 3D projection and inspection;
- deterministic layout alternatives;
- structured and exact planning constraints;
- reviewed natural-language intent.

The remaining product risk is no longer primarily missing capability. It is the growing cognitive cost of discovering, understanding and safely combining those capabilities.

Observed evidence already includes:

- ordinary users misunderstanding wall-length and area semantics before M4.6;
- the right inspector escaping the viewport before the M6.3 regression fix;
- labels and controls visually touching in the narrow planning inspector before the M6.4 polish;
- a dense editor shell with several simultaneous tools, modes and panels;
- terminology that must distinguish hard rules, soft preferences, dimensions, centre distances and contour gaps;
- powerful workflows that require explicit Preview, Apply, Undo and persistence boundaries to remain understandable.

Adding further planning or AI scope before addressing this foundation would increase interaction debt.

## 3. Product principles

The redesign must make the following product truths visible rather than merely technically correct:

1. The user always understands what is selected.
2. The user always understands which tool or mode is active.
3. The user can predict what an action will change.
4. Temporary Preview and persistent Apply are visibly different.
5. Hard constraints, soft preferences, warnings and errors have distinct semantics.
6. Measurements state exactly what is measured and from which geometry.
7. The editor remains local-first and usable without network services.
8. AI and recognition remain optional, reviewable assistance.
9. The canvas remains the primary work surface, not a background behind panels.
10. Common tasks are prominent; advanced functions are available without dominating the interface.
11. Precision is not hidden for the sake of visual simplicity.
12. Visual polish must never introduce a second source of product truth.

## 4. Primary users

### 4.1 Apartment owner or buyer

A non-professional user who wants to reproduce an apartment, place furniture, understand clear dimensions and test whether a layout works.

Needs:

- ordinary language;
- visible safety and reversibility;
- confidence that area and distances are correct;
- quick access to common furniture and measurements;
- explanations instead of CAD terminology.

### 4.2 Power user

A user who builds detailed plans, imports references, adjusts exact dimensions, uses planning constraints and compares alternatives.

Needs:

- efficient keyboard and pointer interactions;
- stable controls and deterministic behaviour;
- low-friction repetitive editing;
- inspectable numeric evidence;
- no loss of advanced capability during simplification.

### 4.3 Current platform priority

M7 is **desktop-first** because the editor requires a large spatial work surface and precise pointer interactions.

Required acceptance environments:

- Chromium / Yandex Browser on macOS and Windows;
- Safari on macOS for core editing regression;
- common desktop viewports and browser zoom levels.

Tablet and mobile editing are not promised by M7. Narrow layouts must fail gracefully, preserve project access and avoid broken or unreachable controls. A separate mobile strategy may be designed later from evidence.

## 5. Scope of the total review

The audit covers the complete product, not only the editor canvas.

### 5.1 Project lifecycle

- project dashboard;
- create, rename, duplicate and delete;
- open, autosave and save-state feedback;
- backup, import and recovery;
- PNG and project export;
- empty, loading, failure and recovery states.

### 5.2 Editor shell

- top toolbar;
- project identity and navigation;
- left furniture/catalog surface;
- central canvas;
- right contextual inspector;
- status, notifications and transient overlays;
- panel opening, closing and competition for space;
- 2D/3D switching.

### 5.3 Apartment geometry

- wall drawing and selection;
- snapping and active-tool feedback;
- wall thickness and alignment;
- room naming, area and clear dimensions;
- doors, windows and door swing;
- topology errors and recovery;
- dimension annotations and tape measurement.

### 5.4 Furniture and fit

- finding and placing furniture;
- object selection and multi-selection;
- position, rotation, dimensions and clearances;
- collision, containment, door and recommendation feedback;
- remove, undo and redo;
- furniture catalogue hierarchy and discoverability.

### 5.5 Reference and recognition

- image/PDF import;
- calibration and alignment;
- tracing mode;
- recognition start, progress and failure;
- candidate review, editing and Apply;
- clear distinction between reference, recognition draft and trusted geometry;
- runtime-only provider settings.

### 5.6 Spatial 3D

- discoverability of 3D;
- camera and mode transitions;
- semantic hover and selection;
- read-only inspector;
- consistency with 2D selection and product truth;
- empty, unsupported and rendering-failure states.

### 5.7 Intelligent planning

- entry point and prerequisite understanding;
- object selection;
- hard constraints and soft preferences;
- exact contour-gap semantics;
- reviewed natural-language intent;
- alternatives, evidence and ranking;
- Preview, exact witness overlays and Apply;
- stale result clearing and error recovery.

## 6. Audit methodology

The audit will combine several evidence types. No single heuristic score will be treated as product truth.

### 6.1 Interface inventory

Create a complete inventory of:

- routes and screens;
- persistent and transient panels;
- tools and modes;
- dialogs, menus and overlays;
- buttons, inputs, selects, toggles and cards;
- status, warning, error and success patterns;
- typographic styles and spacing values;
- colours, borders, shadows and radii;
- keyboard shortcuts and focus behaviour;
- duplicate components and one-off visual patterns.

### 6.2 Journey review

Evaluate representative end-to-end journeys:

1. create a project and draw a rectangular room;
2. enter real dimensions and verify area;
3. add and edit a door and a window;
4. place furniture and diagnose why it does not fit;
5. measure an arbitrary distance;
6. import and calibrate a reference plan;
7. run and review assisted recognition;
8. inspect the same project in 3D;
9. generate, preview and apply a layout alternative;
10. describe planning preferences in ordinary language;
11. undo, redo, reload, export and restore.

For every journey record:

- user goal;
- entry point;
- steps and mode transitions;
- required prior knowledge;
- unclear terminology;
- hidden state;
- errors and recovery;
- reversibility;
- completion evidence;
- accessibility and viewport risks.

### 6.3 Heuristic evaluation

Review against:

- visibility of system status;
- match with ordinary user language;
- user control and freedom;
- consistency and standards;
- error prevention;
- recognition rather than recall;
- flexibility and efficiency;
- minimal but sufficient presentation;
- understandable error recovery;
- contextual help;
- spatial-editor-specific mode clarity;
- source-of-truth and Preview/Apply clarity.

### 6.4 Accessibility review

Review:

- semantic labels and landmark structure;
- keyboard reachability;
- visible focus;
- tab order;
- checkbox/select/input labelling;
- contrast and non-colour signalling;
- touch target size where relevant;
- browser zoom at 100%, 125%, 150% and 200%;
- reduced-motion compatibility;
- screen-reader announcements for important async state;
- error association and recovery.

M7 does not claim formal WCAG conformance without dedicated verification, but the design system must target WCAG 2.2 AA for applicable web UI.

### 6.5 Responsive and density review

At minimum test:

- 1920×1080 at 100% and 125%;
- 1440×900 at 100% and 125%;
- 1366×768 at 100%;
- 1280×800 at 100%;
- narrower widths to verify graceful limitation rather than horizontal escape.

Check long Russian labels, long project/furniture names, multiple selected objects and expanded advanced panels.

## 7. Finding model

Every finding receives:

- stable ID;
- affected journey and surface;
- evidence;
- severity;
- frequency estimate;
- confidence;
- root cause;
- proposed response;
- architecture impact;
- acceptance criterion;
- recommended milestone.

Severity:

- **P0** — data loss, project corruption, destructive surprise or core task blocker;
- **P1** — likely incorrect user understanding or materially wrong decision;
- **P2** — repeated friction, hidden capability or unnecessary work;
- **P3** — ergonomic or visual inconsistency;
- **P4** — optional polish.

Priority must not be derived from severity alone. Frequency, reach, implementation risk and strategic value are also considered.

## 8. Target information architecture

The target architecture is based on four stable layers.

### 8.1 Global product layer

Contains only project-level actions:

- back to projects;
- project name and save state;
- undo/redo;
- export/backup;
- global settings and help;
- 2D/3D mode.

### 8.2 Tool layer

Contains creation and measurement tools:

- select;
- walls;
- doors/windows;
- furniture;
- reference;
- measurement.

Only one exclusive canvas tool is active at a time. The active tool is visible in the toolbar and canvas.

### 8.3 Context layer

The right inspector shows the current context:

- no selection / guidance;
- wall;
- room;
- opening;
- furniture;
- reference;
- recognition;
- planning;
- 3D inspection.

It must not become an unrelated accumulation of all product settings.

### 8.4 Canvas feedback layer

Contains only spatially relevant ephemeral feedback:

- selection and handles;
- snapping guides;
- dimensions;
- fit/collision cues;
- Preview ghosts;
- exact witnesses;
- concise contextual labels.

Detailed forms and long explanations belong in the inspector, not on the canvas.

## 9. Interaction model

### 9.1 Selection

- Click selects the most relevant semantic entity.
- Shift-modified selection is reserved for supported multi-selection.
- Clicking empty canvas clears selection without changing the active creation tool unless explicitly designed otherwise.
- Selection appearance is consistent in 2D, 3D and inspectors.

### 9.2 Modes

- Exclusive creation modes have persistent visible state and a clear exit.
- Temporary actions use commands or dialogs rather than hidden modes.
- Mode changes clear or preserve selection according to an explicit rule documented per tool.
- Escape has a predictable hierarchy: cancel transient action, exit tool, clear selection.

### 9.3 Preview and Apply

Preview is required when an operation proposes multiple or externally generated changes:

- recognition;
- planning alternatives;
- future high-impact transformations.

Preview must:

- be visually distinguishable from saved geometry;
- state that it is temporary;
- provide explicit Apply and Cancel/close;
- clear safely when inputs become stale;
- never be persisted as ordinary project geometry.

Direct property edits may remain immediate when they are local, deterministic and covered by Undo/Redo.

### 9.4 Progressive disclosure

- common controls remain visible;
- advanced numeric and diagnostic controls are grouped but discoverable;
- explanatory text appears when ambiguity is real, not under every field;
- dangerous or destructive actions are visually separated;
- provider/API configuration never dominates the primary workflow.

## 10. Visual direction

The redesign remains recognisably Vlezet but becomes calmer, more systematic and more spatially efficient.

### 10.1 Desired character

- precise;
- trustworthy;
- contemporary;
- restrained;
- technical without looking like professional CAD;
- visually clean without hiding semantics.

### 10.2 Design-system requirements

Define tokens for:

- typography scale;
- spacing scale;
- control heights;
- radii;
- borders and elevations;
- semantic colours;
- focus rings;
- panel widths and density;
- canvas overlays;
- motion durations.

Define reusable patterns for:

- section headers;
- fields and helper/error text;
- cards;
- segmented controls;
- toggles and checkboxes;
- buttons and icon buttons;
- notices;
- empty states;
- dialogs and confirmations;
- inspector groups;
- result/evidence cards.

Typography must not rely on 9–10 px text for essential information. Dense desktop UI may use compact sizes only where readability remains demonstrably acceptable.

## 11. Content and terminology

Create one canonical glossary for user-visible Russian terminology.

Required distinctions include:

- длина стены;
- внутренний размер комнаты;
- площадь по внутреннему контуру;
- толщина стены;
- размер предмета;
- расстояние между центрами;
- минимальный зазор между контурами;
- рекомендация;
- предпочтение;
- обязательное ограничение;
- черновик распознавания;
- проверяемый черновик пожеланий;
- вариант расстановки;
- предпросмотр;
- применённое изменение.

The same concept must not use different names across toolbar, inspector, canvas and documentation without a documented reason.

## 12. Deliverables

The M7 audit and foundation phase will create:

```text
docs/product/PRODUCT_VISION.md
docs/product/USER_JOURNEYS.md
docs/product/UX_AUDIT.md
docs/product/INFORMATION_ARCHITECTURE.md
docs/product/INTERACTION_MODEL.md
docs/product/UX_ROADMAP.md
docs/design/DESIGN_SYSTEM.md
docs/design/COMPONENT_INVENTORY.md
docs/design/CONTENT_AND_TERMINOLOGY.md
docs/design/ACCESSIBILITY.md
```

Canonical project documents will also be updated:

```text
docs/PROJECT_STATE.md
docs/ROADMAP.md
docs/CHANGELOG.md
```

The audit must remain reconstructable in a new chat: findings, decisions, alternatives, evidence and rejected approaches are documented rather than held only in conversation.

## 13. Programme structure

### M7.0 — Product and UX audit

Deliver the complete inventory, journeys, findings, target architecture, design principles, component system and prioritised roadmap.

M7.0 is primarily documentation and evidence. It must not mix broad UI implementation into the audit PR.

### Subsequent implementation slices

The audit may recommend slices such as:

- editor shell and navigation;
- contextual inspector system;
- forms and component foundations;
- canvas selection and tool affordances;
- feedback, errors and onboarding;
- accessibility and responsive hardening;
- dashboard and project lifecycle;
- visual polish.

These names and order are provisional. The accepted audit determines the actual sequence.

Each implementation slice requires:

- a focused design;
- explicit non-goals;
- TDD where behaviour can be specified automatically;
- visual/browser acceptance;
- exact-head CI;
- no geometry or persistence authority regression.

## 14. Success criteria for M7.0

M7.0 is complete when:

1. every current product surface and primary journey is inventoried;
2. findings use stable IDs and the severity model;
3. P0–P2 findings have evidence and acceptance criteria;
4. target information architecture and interaction model are internally consistent;
5. design-system foundations cover current component needs;
6. terminology has one canonical source;
7. accessibility and viewport requirements are explicit;
8. a prioritised, dependency-aware implementation roadmap exists;
9. no speculative feature milestone bypasses the audit;
10. the product owner reviews and accepts the audit package.

## 15. Non-goals

M7.0 does not:

- rewrite the editor;
- change `VlezetDocument` or geometry semantics;
- change persistence, migrations or project format;
- add cloud, accounts or collaboration;
- add new autonomous AI capability;
- promise mobile-first editing;
- introduce decorative 3D assets or photorealism;
- implement all audit recommendations in one pull request;
- replace evidence with aesthetic preference.

## 16. Risks and controls

### Risk: redesign becomes subjective

Control: every material change maps to a journey, finding and acceptance criterion.

### Risk: visual consistency work causes functional regression

Control: preserve product contracts, use incremental slices, regression tests and browser acceptance.

### Risk: simplification hides precision

Control: progressive disclosure, explicit terminology and inspectable measurements rather than removal of detail.

### Risk: audit expands indefinitely

Control: fixed journey list, stable finding schema, prioritisation gate and explicit M7.0 completion criteria.

### Risk: giant documentation becomes unusable

Control: separate canonical documents by purpose and keep `PROJECT_STATE.md` as the short entry point.

## 17. Next step after approval

Create an implementation plan for M7.0 only. The plan will inventory the repository and product, produce the audit documents, define evidence collection and browser-review checkpoints, and open a documentation-first Draft PR.

No redesign code is written until the M7.0 audit package identifies and prioritises the first implementation slice.
