# Vlezet — Design System Foundation

**Phase:** M7.0 Product and UX Audit  
**Status:** target foundation for later M7.x implementation  
**Direction:** evolutionary redesign, recognisably Vlezet

## 1. Visual objective

Vlezet should feel precise, calm and trustworthy without resembling dense professional CAD.

The redesign retains:

- a neutral light work environment;
- blue as the primary action/selection accent;
- restrained borders and shadows;
- white contextual surfaces around a dominant Canvas;
- compact desktop efficiency.

It improves:

- hierarchy instead of microtext;
- consistent component anatomy;
- visible interaction states;
- semantic colour roles;
- whitespace around complex decisions;
- Canvas/context balance;
- accessible focus and contrast.

## 2. Token principles

1. Components consume semantic tokens, not feature-specific hex values.
2. Essential information is not smaller than 12 px.
3. Density is achieved through layout and disclosure, not illegible text.
4. One token scale governs all M7 components.
5. Canvas overlays have separate spatial tokens but share semantic roles.
6. Dark mode is not part of M7.0; token naming must not prevent it later.
7. Numeric values below are target defaults and require browser acceptance before becoming code.

## 3. Colour tokens

### Neutral surfaces

```text
--color-app-bg             #F3F5F8
--color-canvas-bg          #FFFFFF
--color-surface            #FFFFFF
--color-surface-subtle     #F8FAFC
--color-surface-muted      #EEF2F6
--color-surface-elevated   #FFFFFF
--color-border             #DDE2E8
--color-border-strong      #C8D0D9
--color-text               #18202A
--color-text-secondary     #5F6B7A
--color-text-muted         #7B8794
--color-text-inverse       #FFFFFF
```

### Brand/interaction

The current recognisable blue is retained and normalised.

```text
--color-accent             #1769FF
--color-accent-hover       #0F5BDD
--color-accent-active      #0C4FC4
--color-accent-soft        #EAF1FF
--color-accent-border      #AFC8FF
--color-focus              #1769FF
```

### Semantic roles

```text
--color-success            #087A4B
--color-success-soft       #EAF8F1
--color-success-border     #A7E1C3

--color-warning            #A15C00
--color-warning-soft       #FFF6E5
--color-warning-border     #F2CE8A

--color-danger             #B42318
--color-danger-soft        #FFF0EF
--color-danger-border      #F3B8B3

--color-info               #2359B6
--color-info-soft          #EDF4FF
--color-info-border        #BDD2F6
```

### Workflow state roles

```text
--color-draft              #7A4CC2
--color-draft-soft         #F3ECFF
--color-preview            #6750D8
--color-preview-soft       #F0EDFF
--color-applied            #087A4B
--color-selection          #1769FF
--color-hover              #3D7EFF
--color-disabled           #AAB3BE
```

Draft and Preview are not distinguished by colour alone. Each includes a text badge and pattern/line style.

## 4. Typography

Font stack remains system-first for performance and local-first reliability:

```text
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

### Scale

| Token | Size / line-height | Use |
|---|---|---|
| `text-display` | 32/38, 700 | dashboard primary heading |
| `text-title` | 22/28, 700 | page/dialog title |
| `text-heading` | 17/22, 700 | panel/workflow title |
| `text-subheading` | 14/19, 700 | section heading |
| `text-body` | 14/20, 400 | explanatory text |
| `text-body-compact` | 13/18, 400 | dense inspector body |
| `text-label` | 12/16, 650 | fields, compact buttons, badges |
| `text-helper` | 12/17, 400 | helper/error/status copy |
| `text-numeric` | 13/18, 650, tabular | dimensions/evidence |
| `text-kbd` | 11/14, 650 | optional shortcut hint only |

No essential save state, confidence, error, unit or workflow meaning uses 9–10 px text.

### Numeric presentation

- enable tabular numerals for dimensions, coordinates and evidence;
- group unit with value;
- preserve decimal comma/period input compatibility;
- use non-breaking spaces before `мм`, `м`, `м²`, `°` where appropriate;
- do not imply more precision than geometry/product semantics support.

## 5. Spacing scale

```text
space-0   0
space-1   2 px
space-2   4 px
space-3   8 px
space-4   12 px
space-5   16 px
space-6   24 px
space-7   32 px
space-8   48 px
```

Rules:

- adjacent label/control: 6–8 px;
- controls inside one semantic group: 8–12 px;
- inspector sections: 20–24 px plus divider only when useful;
- panel padding: 16 px compact, 20 px standard;
- workflow phases/cards: 12–16 px internal padding;
- no arbitrary one-off gap unless Canvas geometry requires it.

## 6. Shape, border and elevation

```text
radius-sm       6 px
radius-md       8 px
radius-lg       12 px
radius-xl       16 px
radius-round    999 px

border-default  1 px
border-strong   1 px
focus-ring      0 0 0 3 px rgba(23,105,255,.22)
shadow-panel    0 8px 24px rgba(20,30,45,.08)
shadow-dialog   0 24px 64px rgba(15,23,42,.22)
shadow-float    0 12px 32px rgba(15,23,42,.14)
```

Shadows communicate layer/elevation, not decoration. Persistent side panels normally use borders, not floating shadows.

## 7. Control sizes and targets

| Density | Visible height | Minimum pointer target | Use |
|---|---:|---:|---|
| compact | 32 px | 36 px | secondary toolbar/inspector controls on desktop |
| standard | 40 px | 40 px | primary fields/buttons |
| comfortable | 44 px | 44 px | dialogs, onboarding, accessibility-sensitive actions |

Icon-only actions have at least 36×36 px desktop targets and visible tooltip/accessible label. Destructive/close controls are not reduced below the surrounding standard.

## 8. Layout tokens

```text
--global-bar-height            56 px default
--tool-bar-width-or-height     48–56 px compact / content-driven expanded
--context-panel-width-min      288 px
--context-panel-width-default  336 px
--context-panel-width-max      408 px
--catalog-width-min            232 px
--catalog-width-default        264 px
--canvas-min-useful-width      560 px target for full editing
--dialog-width-sm              400 px
--dialog-width-md              560 px
--dialog-width-lg              720 px
```

The context panel may be resizable within min/max. At constrained width it becomes a drawer/sheet rather than disappearing.

## 9. Component families

### Global product bar

Anatomy:

- project navigation;
- project identity;
- save status;
- representation mode;
- flexible spacer;
- project utilities/overflow;
- Undo/Redo.

States:

- normal;
- saving;
- saved locally;
- failed with retry;
- reduced-width overflow.

### Tool action

Variants:

- exclusive tool;
- display toggle;
- workflow entry;
- command.

States:

- default;
- hover;
- pressed/active;
- focus-visible;
- disabled with prerequisite;
- tool in-progress marker where relevant.

Exclusive tool active state uses accent fill/border plus `aria-pressed` and a spatial status message.

### Context panel

Anatomy:

```text
header
├── breadcrumb/back (workflow only)
├── title + entity/workflow status
└── close/more
body
├── primary status
├── common sections
├── advanced disclosure
└── destructive section
sticky footer (only when needed)
└── primary/secondary action
```

The panel does not expose internal IDs by default. Diagnostic IDs may appear in an advanced technical section/copy action.

### Inspector section

- heading;
- optional concise description;
- fields/content;
- optional summary/status.

Section headings are not simulated by repeated large margins alone.

### Field

Anatomy:

- label;
- optional status/required indicator;
- control and unit;
- helper or associated error.

Variants:

- text;
- numeric;
- select;
- checkbox;
- segmented choice;
- textarea;
- slider with numeric output;
- coordinate pair;
- orientation/direction selector.

### Button

Variants:

- primary;
- secondary;
- quiet/tertiary;
- danger;
- icon;
- split/menu trigger.

Primary buttons are limited to one per decision area. Full-width is used in narrow panels when it strengthens hierarchy, not automatically for every action.

### Status badge

Roles:

- success/fit;
- warning/tight;
- blocked/error;
- Draft;
- Preview;
- Applied;
- mandatory;
- preference;
- source/confidence.

Badge contains text and optional icon; colour is supplementary.

### Notice

Variants:

- info;
- warning;
- error;
- success;
- privacy/local-first;
- unsupported/limitation.

Anatomy:

- icon/role;
- concise title;
- one short explanation;
- recovery/action when applicable.

### Card

Variants:

- project;
- furniture preset;
- recognition candidate;
- planning rule;
- planning alternative;
- evidence.

Cards have one primary interaction. Avoid making the full card, title and nested controls compete as separate click targets without clear semantics.

### Dialog/sheet

- semantic title/description;
- close/cancel;
- focus trap/return;
- action hierarchy;
- viewport-safe scrolling;
- no essential action below unreachable fold.

### Empty state

Contains:

- current state;
- why it is empty/prerequisite;
- one primary next action;
- optional secondary learning action.

### Result/evidence card

Planning/recognition results distinguish:

- source/state;
- mandatory validity;
- preferences/ranking;
- measured evidence;
- Preview state;
- Apply action.

## 10. Canvas visual language

### Selection

- primary selected entity: solid accent outline plus handles;
- hover: lighter accent outline;
- multi/workflow selection: accent plus numbered/checkbox identity where needed;
- selected entity stays readable over reference/draft overlays.

### Draft

- purple-toned dashed/striped line or fill;
- `Черновик` badge/legend;
- never identical to applied geometry.

### Preview

- translucent violet ghost with dashed outline;
- `Предпросмотр` status;
- no standard selection handles that imply direct applied editing.

### Invalid/blocking

- danger outline plus icon/pattern;
- associated reason in context;
- avoid large opaque red overlays that hide geometry.

### Measurement

Each measurement type has explicit label:

- `Внутренний размер`;
- `Расстояние`;
- `Между центрами`;
- `Зазор между контурами`.

Numeric validation and drawn witness share one geometry source.

## 11. Motion

```text
motion-fast       100 ms
motion-standard   160 ms
motion-slow       240 ms
```

Use for hover, focus, panel entry and Preview transitions. Do not animate geometry positions in ways that obscure exact placement. Under `prefers-reduced-motion`, remove non-essential transforms and spinning transitions; retain state changes without delay.

## 12. Responsive density

### Full desktop

Persistent global bar, tool layer, optional catalogue, Canvas and context panel.

### Compact desktop/high zoom

- hide shortcut hints before labels;
- collapse utilities into overflow;
- preserve project/save/history and active tool;
- allow context drawer/sheet;
- catalogue becomes a temporary panel if necessary.

### Narrow unsupported editing

- preserve dashboard/projects;
- preserve read-only project summary/export where possible;
- communicate that precise editing requires a larger viewport;
- never show a broken half-editor with unreachable state.

## 13. State matrix

All components must define:

```text
default
hover (pointer-capable)
active/pressed/selected
focus-visible
loading/busy
disabled + reason
error
warning
success
empty
stale (workflow components)
```

Visual regression/browser acceptance must include long Russian labels, long project/object names and 200% zoom.

## 14. Implementation sequence constraint

Do not mass-replace current CSS before:

1. M7.1 validates shell hierarchy and responsive context;
2. shared tokens/primitives have tests and browser examples;
3. one representative inspector is migrated end to end;
4. recognition/planning private styles are migrated in focused workflow slices.

This avoids a visually uniform but behaviourally regressed rewrite.
