# M7.3 — Design System and Content Components

**Date:** 2026-07-31  
**Status:** approved design; implementation not started  
**Branch:** `feat/m7-3-design-system-content-components`  
**Depends on:** accepted M7.1 editor shell and accepted M7.2 context inspector foundation

## 1. Product intent

M7.3 establishes a small governed visual and content system for Vlezet without rewriting domain workflows.

The product must remain recognisably Vlezet: precise, calm, local-first and approachable for a non-professional apartment owner. The design system exists to make the current product easier to read and more internally consistent, not to turn it into a generic component showcase or a dense CAD interface.

The selected density is **balanced**:

- body text: 14 px;
- compact inspector text: 13 px;
- labels, helpers, errors and important metadata: at least 12 px;
- standard fields and primary buttons: 40 px visible height;
- compact secondary controls: 32–36 px visible height with an adequate pointer target;
- density is achieved through grouping and progressive disclosure, never through essential 9–10 px microtext.

## 2. Owned UX findings

M7.3 primarily owns:

- `UX-FURN-004` — catalogue readability and inconsistent card details;
- `UX-REC-004` — recognition uses a large private visual implementation;
- `UX-PATTERN-002` — repeated controls and feedback lack one governed state model;
- `UX-PATTERN-003` — dialogs, notices and confirmations use parallel one-off structures;
- remaining `UX-CONTENT-001` — terminology and action language need systematic enforcement;
- `UX-SHELL-005` — residual essential microtext and inconsistent shell/content scale.

M7.3 may provide foundations used by later findings, but it does not claim to finish workflow redesign assigned to M7.4–M7.13.

## 3. Goals

1. Introduce semantic visual tokens for the current HTML UI.
2. Introduce small, store-free React primitives for common controls and feedback.
3. Make interactive states explicit and consistent.
4. Remove essential 9–10 px text from the representative migrated surfaces.
5. Apply canonical Russian terminology and unit formatting.
6. Prove the system through bounded representative migrations.
7. Preserve all M7.1 shell and M7.2 context/navigation behaviour.
8. Preserve all document, geometry, persistence, planner, recognition and history authority boundaries.
9. Provide blocking Chromium and WebKit acceptance for representative states.

## 4. Non-goals

M7.3 does not include:

- a complete redesign of wall, room, opening or furniture workflows;
- planning workflow simplification;
- recognition workflow restructuring;
- new Canvas modes or selection semantics;
- a new 3D camera or interior-readability solution;
- mobile-first editing;
- dark mode;
- Storybook or a separate documentation application;
- a mass replacement of all CSS and components in one pull request;
- new domain capabilities;
- changes to `VlezetDocument`, schema versions or migrations;
- changes to IndexedDB, backup/import/export formats or autosave authority;
- changes to geometry, fit, planner, recognition or semantic-history algorithms.

## 5. Design direction

The visual direction remains evolutionary:

- neutral light work environment;
- white context surfaces around a dominant Canvas;
- existing blue accent normalised into semantic roles;
- restrained borders and shadows;
- hierarchy through typography, grouping and spacing;
- semantic colour roles for success, warning, error, information and workflow state;
- visible focus and disabled reasons;
- no decorative visual complexity that competes with geometry.

## 6. CSS architecture

Two new top-level style layers will be introduced and loaded before feature-specific styles:

```text
apps/web/app/design-tokens.css
apps/web/app/ui-primitives.css
```

### 6.1 `design-tokens.css`

This file defines semantic custom properties only.

Required token families:

- app, Canvas, surface and elevated surfaces;
- default and strong borders;
- primary, secondary and muted text;
- accent default, hover, active, soft and border;
- success, warning, danger and info roles;
- Draft, Preview, Applied and selection roles;
- typography sizes, line heights and weights;
- spacing scale;
- radii;
- shadows;
- control heights and pointer targets;
- focus ring;
- motion durations.

Existing variables such as `--bg`, `--panel`, `--text`, `--muted`, `--line`, `--accent`, `--accent-soft` and `--danger` remain temporarily available as compatibility aliases. New primitives must consume semantic tokens. Existing feature styles may be migrated incrementally.

Feature-specific values do not belong in this file.

### 6.2 `ui-primitives.css`

This file owns shared anatomy and visual states for common primitives only.

It must not contain:

- room-specific layout;
- furniture-specific business logic;
- planning rule layout;
- recognition state-machine layout;
- Canvas geometry or overlay styling;
- store or data-state assumptions.

## 7. React primitive architecture

New store-free primitives live under:

```text
apps/web/components/ui/
```

Each primitive accepts explicit props, renders accessible HTML and has no access to Zustand, IndexedDB, geometry or domain commands.

### 7.1 `UiButton`

Variants:

- `primary`;
- `secondary`;
- `quiet`;
- `danger`;
- `icon`.

Supported states:

- default;
- hover;
- active;
- focus-visible;
- disabled;
- busy/loading.

Rules:

- at most one primary action per decision area;
- disabled important actions have a nearby human-readable reason;
- busy state preserves button width and exposes `aria-busy`;
- icon-only buttons require an accessible label.

### 7.2 `UiField`

Anatomy:

```text
label
optional description/status
control row
optional unit
helper or error
```

It associates label, description and error with the control through IDs and ARIA attributes. It does not own input state.

Supported use:

- text;
- numeric;
- select;
- textarea;
- checkbox/segmented wrapper;
- value with unit.

### 7.3 `UiFieldMessage`

Roles:

- helper;
- error;
- warning;
- success.

Error messages use `role="alert"` only when they appear as a result of an action or validation transition. Static helper text does not use live-region semantics.

### 7.4 `UiNotice`

Roles:

- info;
- success;
- warning;
- error;
- local;
- limitation.

Anatomy:

```text
role/icon
concise title
short explanation
optional recovery action
```

Colour is supplementary. The title and text communicate the actual state.

### 7.5 `UiBadge`

Roles:

- success/fit;
- warning/tight;
- danger/blocked;
- draft;
- preview;
- applied;
- mandatory;
- preference;
- confidence.

Badges always contain readable text. Draft, Preview, Applied, mandatory and preference states must not rely on colour alone.

### 7.6 `UiCard`

Variants:

- neutral;
- selectable;
- result;
- evidence.

A card has one primary interaction. Nested actions remain explicit buttons and do not compete with an ambiguous full-card click target.

### 7.7 `UiDialog`

Common modal foundation for project confirmation and optional OpenRouter recognition flow.

Required behaviour:

- `role="dialog"` and `aria-modal="true"`;
- title and optional description association;
- initial focus on the safest useful control;
- focus trap;
- Escape close when allowed;
- focus restoration to the opener;
- viewport-safe body scrolling;
- explicit primary/secondary/danger action hierarchy;
- busy mode may disable closing only when cancellation would be unsafe, otherwise cancellation remains available.

The primitive provides structure; each consumer owns domain callbacks and state.

### 7.8 `UiEmptyState`

Contains:

- current empty/prerequisite state;
- why it is empty;
- one primary next action when available;
- optional secondary explanation.

## 8. Typography and density contract

Required semantic levels:

| Role | Target |
|---|---|
| page/dialog title | 22 px / 28 px, 700 |
| panel/workflow title | 20 px / 24 px, 700 |
| section heading | 14 px / 19 px, 700 |
| body | 14 px / 20 px, 400 |
| compact body | 13 px / 18 px, 400 |
| label/helper/error/status | 12 px minimum |
| numeric fact | 13 px / 18 px, 650, tabular |
| keyboard hint | 11 px allowed only as optional secondary hint |

Essential state, unit, validation, confidence, save semantics or workflow meaning must not be rendered below 12 px.

Long Russian labels and names wrap or truncate with an accessible full value. They must not force document-level horizontal overflow.

## 9. Spacing and control contract

Core spacing scale:

```text
2, 4, 8, 12, 16, 24, 32, 48 px
```

Usage:

- label to control: 6–8 px;
- controls in one group: 8–12 px;
- section separation: 20–24 px;
- panel padding: 16 px compact, 18–20 px standard;
- card internal padding: 12–16 px.

Controls:

- primary fields/buttons: 40 px;
- compact secondary controls: 32–36 px;
- icon-only pointer target: at least 36 × 36 px;
- dialog/high-attention controls: 40–44 px.

## 10. Canonical content and formatting

The existing `docs/design/CONTENT_AND_TERMINOLOGY.md` remains the canonical glossary.

M7.3 enforces the following terms on migrated surfaces:

- `Длина по оси стены`;
- `Чистые внутренние размеры`;
- `Полезная площадь` with `По внутреннему контуру стен`;
- `Рекомендуемые зазоры`;
- `Обязательное ограничение`;
- `Предпочтение`;
- `Черновик`;
- `Предпросмотр`;
- `Применено`;
- `Сохранено локально`;
- `Исходный план` where onboarding clarity is needed and `Подложка` where the established editor concept is already understood.

Pure presentation formatters will be added for:

```text
3550 мм
11,72 м²
90°
```

Formatting rules:

- use Russian locale display;
- use a non-breaking space between value and unit;
- use a decimal comma in display text;
- retain current input compatibility with comma and period;
- do not alter canonical millimetre storage;
- do not imply unsupported precision.

## 11. Representative migration scope

M7.3 proves the primitives through bounded migrations rather than a whole-product rewrite.

### 11.1 Room context

Migrate representative room fields and facts to:

- `UiField`;
- `UiFieldMessage`;
- `UiButton`;
- shared numeric formatting.

Preserve existing rename, dimension, anchor and planning-entry commands.

### 11.2 Furniture catalogue

Migrate:

- catalogue introduction;
- category headings;
- preset cards;
- placement cancellation;
- preset dimension text.

Essential preset names and dimensions must be at least 12 px. Placement behaviour and preset definitions remain unchanged.

### 11.3 Furniture fit state

Render current authoritative outcomes through `UiBadge` and shared supporting copy:

- `Влезает`;
- `Влезает, но тесно`;
- `Не влезает`.

M2 fit logic, thresholds and reason generation remain unchanged.

### 11.4 Global feedback

Migrate representative success/error/local-first feedback to `UiNotice` or a shared toast/notice anatomy. Do not change autosave timing or error ownership.

### 11.5 Dialogs

Migrate:

- project-delete confirmation;
- optional OpenRouter recognition dialog.

Both use `UiDialog`, shared buttons, fields and notices. Project deletion remains irreversible. Provider key/model state remains runtime-only.

### 11.6 Recognition shared visuals

Move common recognition fields, notices, badges, buttons and cards away from the private inline visual implementation. Recognition state-machine behaviour, local/cloud algorithms, Apply and draft persistence remain unchanged.

Workflow-specific restructuring remains M7.8.

### 11.7 Canvas helper typography

Raise essential Canvas helper copy from 11 px to the 12 px helper token. Do not redesign active-mode messaging or Canvas interaction; those remain M7.4.

## 12. Accessibility contract

M7.3 must preserve or improve:

- native keyboard operation;
- visible `:focus-visible` state;
- labels and error association;
- disabled reason discoverability;
- semantic notice roles;
- dialog focus trap and focus restoration;
- non-colour state communication;
- 200% effective zoom without hidden essential controls;
- `prefers-reduced-motion` for non-essential transitions.

M7.3 is not the final end-to-end accessibility milestone; Canvas, calibration and 3D keyboard equivalence remain M7.9.

## 13. State model

Every migrated interactive primitive must define applicable states from:

```text
default
hover
active/pressed/selected
focus-visible
disabled + reason
loading/busy
error
warning
success
empty
stale
```

The component API must not manufacture domain state. Consumers explicitly select the visual role based on existing authoritative state.

## 14. Error and recovery language

Migrated errors follow:

```text
what failed
what remains safe
what to do next
```

Provider and network errors must state that local/manual editing remains available when true. Raw provider codes may appear secondarily, not as the primary message.

## 15. Testing strategy

Implementation will use RED/GREEN slices.

Planned slices:

1. semantic token contract;
2. typography/control-size contract;
3. `UiButton`, `UiField` and `UiFieldMessage`;
4. `UiNotice` and `UiBadge`;
5. `UiCard`;
6. `UiDialog` and focus behaviour;
7. formatting and terminology helpers;
8. room/furniture/fit representative migration;
9. global feedback/dialog/recognition representative migration;
10. Canvas helper typography;
11. strict Chromium/WebKit acceptance.

Unit/source tests verify:

- token presence and compatibility aliases;
- component semantics and accessible associations;
- no store/domain imports in primitives;
- canonical copy and units;
- no essential migrated text below 12 px;
- preserved callbacks and command wiring;
- no persistence/schema/authority changes.

## 16. Browser acceptance

Chromium full-flow and WebKit core smoke must cover:

- ordinary desktop;
- compact side sheet;
- effective 150% and 200% zoom widths;
- long Russian project, room and furniture names;
- helper, error, warning and success field states;
- disabled action with visible reason;
- fit badges;
- catalogue card readability;
- project-delete dialog keyboard/focus behaviour;
- OpenRouter dialog fields, privacy notice, busy and error states;
- recognition representative cards/notices;
- Canvas helper at 12 px;
- no document-level horizontal overflow;
- preserved M7.2 context scrolling;
- preserved workflow return navigation;
- no loss of uncommitted form state on compact sheet close/reopen.

Browser assertions must measure computed font sizes for the specifically migrated essential elements. Optional keyboard hints may remain 11 px.

## 17. Architecture preservation

The implementation must not change:

- `VlezetDocument`;
- domain schema or migrations;
- project/asset repositories;
- IndexedDB or backup formats;
- autosave authority;
- editor semantic history;
- geometry or fit algorithms;
- planner generation/evaluation/Apply authority;
- recognition algorithms or draft persistence;
- Canvas or Three.js geometry authority.

UI primitives are presentation-only. Presentation state remains ephemeral.

## 18. Risks and controls

### Risk: mass migration creates a large unreviewable PR

Control: representative surfaces only; later workflows retain ownership of their full redesign.

### Risk: tokens change old components unexpectedly

Control: compatibility aliases and explicit browser comparison across M7.1/M7.2 scenarios.

### Risk: generic components hide domain meaning

Control: primitives own anatomy and state visuals only; domain components continue to own labels, values, validation and commands.

### Risk: improved typography reduces Canvas area

Control: balanced density, compact variants, viewport assertions and no automatic full-width primary button rule.

### Risk: dialog unification regresses focus or provider cancellation

Control: explicit focus tests and browser keyboard scenarios for both migrated dialogs.

## 19. Acceptance criteria

M7.3 is complete only when:

1. semantic tokens and compatibility aliases are implemented;
2. approved store-free primitives exist with tested states;
3. selected representative surfaces use the primitives;
4. essential migrated text is at least 12 px;
5. terminology and unit formatting match the canonical glossary;
6. project-delete and OpenRouter dialogs share the dialog foundation without behaviour regression;
7. recognition common visual patterns no longer depend solely on its private style implementation;
8. M7.1 shell and M7.2 context/return/scroll behaviour remain intact;
9. no domain, geometry, persistence, planner, recognition or history authority changes occur;
10. standard CI passes on the exact head;
11. Chromium full-flow and WebKit core smoke pass on the exact head;
12. the product owner completes browser acceptance before merge;
13. acceptance, project state, roadmap and changelog are synchronised after merge.
