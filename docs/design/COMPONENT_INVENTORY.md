# Vlezet — Current Interface and Component Inventory

**Audit phase:** M7.0 Product and UX Audit  
**Evidence type:** source review plus accepted browser evidence from M4.6–M6.4  
**Scope:** current `main` before redesign implementation

This document describes the interface that exists now. Values and patterns below are evidence, not the target design system.

## 1. Top-level surfaces

| ID | Surface | Source | Entry condition | Exit condition | Primary goal |
|---|---|---|---|---|---|
| `SUR-LOADING` | Startup loading | `components/projects/project-app.tsx` | application boot | repository loaded or recovery | understand that local projects are being opened |
| `SUR-RECOVERY` | Startup recovery | `components/projects/project-app.tsx` | IndexedDB/project startup failure | reload | recover from an unreadable local-project state |
| `SUR-DASHBOARD` | Project dashboard | `/`, `ProjectDashboard` | no active project | open/create/import project | manage local apartment projects |
| `SUR-EDITOR` | Editor shell | `ApartmentEditor` | active project loaded | back to dashboard | edit one apartment project |
| `SUR-EDITOR-2D` | 2D workspace | `EditorCanvas` | view mode `2d` | switch to 3D/project dashboard | draw, furnish, inspect and plan |
| `SUR-EDITOR-3D` | Spatial viewer | `SpatialViewer` | view mode `3d` | switch to 2D/project dashboard | inspect the same trusted document spatially |
| `SUR-DIALOG` | Modal workflow layer | confirm/cloud dialogs | destructive action or provider workflow | confirm/cancel | complete bounded high-attention action |
| `SUR-GLOBAL-FEEDBACK` | Toast/global error | `ProjectApp` | successful async action or global error | timeout/manual close | report cross-surface result |

### Top-level application state

`ProjectApp` owns four mutually exclusive modes:

```text
loading → dashboard | editor | recovery
```

It also owns project persistence, autosave status, reference assets, recognition sessions, global errors, transient toasts, delete confirmation and the OpenRouter recognition dialog.

**Observation `OBS-APP-001`:** `ProjectApp` is both lifecycle coordinator and integration point for multiple advanced workflows. This is not automatically a defect, but it makes global feedback and workflow ownership important audit areas.

## 2. Editor shell composition

Current 2D composition:

```text
CMP-TOOLBAR
└── CMP-WORKSPACE
    ├── CMP-FURNITURE-CATALOG (optional)
    ├── CMP-CANVAS
    └── exactly one right-side surface:
        ├── CMP-RECOGNITION-PANEL
        ├── CMP-REFERENCE-PANEL
        └── CMP-CONTEXT-INSPECTOR
            └── CMP-PLANNING-PANEL (room sub-workflow)
```

Current 3D composition:

```text
CMP-TOOLBAR
└── CMP-SPATIAL-VIEWER
    ├── camera controls
    ├── hover/selection inspector
    ├── help
    └── warning/error/empty state
```

Reference and recognition panels are mutually exclusive. Opening recognition closes the reference panel and tracing. Opening the reference panel closes recognition. Planning replaces the ordinary context inspector until closed.

## 3. Component inventory

### `CMP-TOOLBAR` — editor global/tool toolbar

**Source:** `components/editor/editor-toolbar.tsx`  
**Persistent data:** project name; save status derives from autosave  
**Transient data:** current tool, measurement state, dimension visibility, view mode, catalogue/panel visibility, selection shortcuts

Groups currently displayed in one horizontal row:

1. back, product mark, editable project name, save status;
2. select, wall, door, window, measurement, dimensions, furniture, reference and recognition;
3. 2D/3D mode;
4. selected-object shortcuts;
5. wall/opening/object counts;
6. fit whole plan;
7. export menu;
8. Undo/Redo.

Responsive behaviour hides status/shortcut text and utility controls before reflowing the toolbar. Essential controls remain in the same row.

**Keyboard:** V/W/D/O/F/M, Undo/Redo, rotation, duplicate, delete and Escape are implemented across toolbar/editor handlers.

### `CMP-FURNITURE-CATALOG` — left catalogue

**Source:** `components/editor/furniture-catalog.tsx`  
**Width evidence:** 250 px desktop, 220/210/205 px at narrower breakpoints  
**Visibility:** optional in 2D; hidden at narrow layouts

Categories:

- sleep;
- seating;
- storage;
- tables;
- chairs;
- kitchen;
- appliances;
- custom size.

Selecting a preset enters placement state. The panel explains “select an item, then a place on the plan” and exposes an explicit cancel button only while placement is active.

### `CMP-CANVAS` — primary 2D work surface

**Source:** `components/editor/editor-canvas.tsx` and supporting stores/layers  
**Responsibilities:** structured editing projection, pointer interaction, selection, handles, grid, reference image, recognition draft, dimensions, fit feedback, planning Preview and exact witness overlays.

Cursor communicates wall/door/window/object-placement and pan readiness. Canvas assistance uses bottom-left help, topology alert, transient mode banners and spatial overlays.

**Authority boundary:** Canvas pixels and overlays are never persistent geometry or measurement authority.

### `CMP-CONTEXT-INSPECTOR` — selected semantic entity

**Source:** `components/editor/wall-inspector.tsx`, `object-inspector.tsx`  
**Width evidence:** 330 px desktop, 300/290 px at narrower desktop breakpoints  
**Visibility:** hidden below 980 px in the current CSS

Priority:

```text
planning room
→ object
→ opening
→ room
→ wall
→ empty guidance
```

Inspector variants:

- `CMP-INSPECTOR-EMPTY` — selection instruction;
- `CMP-INSPECTOR-WALL` — axis length, anchor, thickness, physical alignment and wall facts;
- `CMP-INSPECTOR-ROOM` — name, clear dimensions, anchors, area and planning entry;
- `CMP-INSPECTOR-OPENING` — width, wall offset, door hinge/swing and deletion;
- `CMP-INSPECTOR-OBJECT` — fit, name, centre coordinates, dimensions, rotation, clearances, actions;
- `CMP-PLANNING-PANEL` — complete planning sub-workflow.

### `CMP-REFERENCE-PANEL` — reference-plan workflow

**Source:** `components/reference/reference-panel.tsx`  
**Visibility:** replaces context inspector; hidden below 980 px

States:

- idle/ready/failed;
- reading file;
- PDF page selection;
- raster normalization;
- calibration;
- saving;
- installed reference controls;
- missing asset;
- remove confirmation.

Installed reference controls include tracing, fit reference, visibility, lock, opacity, X/Y, rotation, replace and remove.

Calibration contains a pointer-driven image stage, two markers, magnifier, known-length input and alignment selector.

### `CMP-RECOGNITION-PANEL` — assisted-recognition workflow

**Source:** `components/recognition/recognition-panel.tsx`  
**Visibility:** replaces context inspector; hidden below 980 px

States:

- prerequisite warning;
- idle local start;
- local progress;
- stale draft;
- error with retry/provider alternative;
- empty result;
- candidate summary/list;
- selected candidate review;
- bulk accept;
- optional AI refinement;
- Apply/discard.

The panel uses a large inline CSS string rather than the shared app CSS files.

### `CMP-PLANNING-PANEL` — deterministic planning

**Source:** `components/planning/planning-panel.tsx`  
**Entry:** room inspector → “Варианты расстановки”  
**Exit:** explicit close

Sections:

1. natural-language intent;
2. object selection;
3. per-object lock and wall/corner preference;
4. pair near/far and exact contour-gap controls;
5. Generate;
6. error state;
7. ranked result cards;
8. Preview/evidence/Apply.

The panel can exceed one viewport height and therefore scrolls independently.

### `CMP-PLANNING-INTENT` — reviewed language draft

**Source:** `components/planning/planning-intent-section.tsx`

Contains request textarea, runtime-only OpenRouter key, model selector, Analyze, review clauses, explicit object resolution, unsupported-fragment acknowledgement, clause removal and transfer into manual controls.

The provider configuration is presented inside the primary planning workflow.

### `CMP-SPATIAL-VIEWER` — read-only 3D

**Source:** `components/spatial/spatial-viewer.tsx`

Controls:

- perspective;
- isometric;
- top view;
- orbit/pan/zoom by pointer;
- hover/click semantic inspection.

Feedback:

- help line;
- projection diagnostic warning;
- WebGL failure message that preserves 2D availability;
- empty state;
- contextual `SpatialInspector`.

### `CMP-DASHBOARD` — project lifecycle

**Source:** `components/projects/project-dashboard.tsx`

Contains product header, import/create actions, local-first explanation, empty state, project cards, open, rename, duplicate and delete.

Rename can be entered through an explicit action or double-clicking the title. Opening occurs through both preview and title.

### `CMP-CONFIRM-DIALOG`

**Source:** `components/projects/confirm-dialog.tsx`

Used for project deletion. Reference removal uses a separate inline confirmation pattern inside the reference panel.

### `CMP-CLOUD-DIALOG`

**Source:** `components/recognition/cloud-dialog.tsx`

Provider-specific recognition refinement with API key, compatible model selection, privacy/external-service explanation and busy/cancel states.

## 4. Repeated control and feedback patterns

| ID | Pattern | Current implementations |
|---|---|---|
| `PAT-ACTION-PRIMARY` | main action | blue full-width inspector buttons; dashboard create actions |
| `PAT-ACTION-SECONDARY` | reversible/supporting action | inspector, catalogue, dialogs, workflow panels |
| `PAT-ACTION-DANGER` | destructive action | project delete, reference remove, opening/object delete |
| `PAT-TOOL-ACTIVE` | active exclusive or display tool | blue soft background in toolbar |
| `PAT-ICON-BUTTON` | compact history/back/close | several different dimensions and visual treatments |
| `PAT-FIELD-NUMERIC` | value + unit | wall, room, opening, object, planning |
| `PAT-FIELD-SELECT` | structured choice | anchors, alignment, swing, preference, models |
| `PAT-FIELD-ERROR` | inline validation | red text below fields/sections |
| `PAT-STATUS-INLINE` | save/progress state | toolbar, inspector workflow cards |
| `PAT-NOTICE-WARNING` | recoverable risk | topology, reference, recognition, 3D diagnostics |
| `PAT-NOTICE-ERROR` | failed operation | field, panel, global bottom notice, recovery page |
| `PAT-TOAST` | transient success | fixed bottom-right toast |
| `PAT-BANNER-MODE` | active tracing/review mode | fixed bottom-centre banners |
| `PAT-CARD-RESULT` | generated/review result | recognition candidates, planning alternatives/evidence |
| `PAT-PREVIEW` | temporary proposed state | recognition draft and planning ghost/witness overlays |
| `PAT-CONFIRM` | destructive confirmation | modal project delete vs inline reference remove |
| `PAT-EMPTY` | no content/prerequisite | dashboard, inspector, recognition, planning, 3D |

## 5. Current visual implementation evidence

### Root tokens

```text
background       #f4f5f7
panel            #ffffff
text             #171a1f
muted            #6e7681
line             #e2e5e9
accent           #1769ff
accent soft      #eaf1ff
danger           #c33434
```

### Geometry and density

```text
toolbar height          64 px
tool buttons            minimum 38 px
icon buttons            38 × 38 px
form controls           36 px
catalog desktop width   250 px
inspector desktop width 330 px
catalog compact width   220/210/205 px
inspector compact width 300/290 px
inspector padding       18 px
common gaps             4/5/6/7/8/9/10/12/13/14/16/18/22/24 px
common radii            7/8/9/10/11/12/14/15/16/18 px
```

### Typography evidence

Essential and supporting text currently spans approximately 9–16 px in editor UI:

- save status: 9 px;
- preset secondary dimensions: 9 px;
- catalogue group labels and many helpers: 10 px;
- field labels/status/facts: 11 px;
- inputs and actions: 12 px;
- toolbar tools: 13 px;
- primary inspector headings: 14 px;
- dashboard title/card hierarchy: 15–48 px.

### Responsive breakpoints

```text
1680  hide document status and selection shortcuts
1450  compact project identity/tools
1250  shrink side panels, hide toolbar utilities
1050  further compact identity and side panels
980   hide right inspector/reference/recognition; reduce workspace columns
760   hide furniture catalogue and project title stack; single-column dashboard
```

**Critical structural evidence:** `.editor-app { grid-template-columns: minmax(0, 1fr); }` was added after the inspector could be pushed outside the viewport by toolbar min-content.

## 6. Keyboard and focus inventory

Implemented keyboard paths:

- selection and creation tools;
- measurement;
- furnishing catalogue;
- object rotate/duplicate/delete;
- Undo/Redo;
- Escape cancellation and 3D→2D;
- Enter/Escape for selected rename/property inputs.

Source review shows native buttons, inputs, selects and textareas in most panels. Canvas and calibration workflows are pointer-first and need separate keyboard-equivalence review.

## 7. Current strengths to preserve

1. Persistent geometry and temporary workflow states are architecturally separated.
2. Save status is always attached to project identity.
3. Active toolbar tools use visible state and keyboard hints.
4. Inspector labels generally include explicit units.
5. M4.6 distinguishes wall axis length from clear room dimensions.
6. Fit results distinguish fits/tight/blocked and provide reasons.
7. Recognition and planning require review and explicit Apply.
8. Network/provider failures leave local editing available.
9. 3D is read-only and reports that 2D remains available on failure.
10. Destructive project deletion has a confirmation dialog.

## 8. Structural observations for the audit

These observations require journey/browser validation before becoming prioritised findings:

- `OBS-SHELL-001`: the toolbar combines project, tool, display, export and history layers in one row.
- `OBS-SHELL-002`: the right side is hidden below 980 px rather than transformed into another reachable presentation.
- `OBS-SHELL-003`: advanced workflow panels and ordinary selection inspection compete for the same slot.
- `OBS-CONTENT-001`: small 9–10 px support text is used extensively for essential state and semantics.
- `OBS-CONTENT-002`: internal milestone labels such as `M6.4` are visible in production UI.
- `OBS-PATTERN-001`: confirmation, notices, panel headers and close buttons have several one-off implementations.
- `OBS-PATTERN-002`: recognition injects a substantial private CSS string, reducing visual-system traceability.
- `OBS-PLANNING-001`: OpenRouter key/model configuration appears before the structured manual planning workflow.
- `OBS-INPUT-001`: coordinates and physical-side language expose technical model concepts that may require progressive disclosure.
- `OBS-ACCESS-001`: pointer-driven Canvas, calibration and 3D need explicit keyboard/focus acceptance.

## 9. Evidence index

| Evidence | Source |
|---|---|
| `EV-M7-SOURCE-APP` | `project-app.tsx` lifecycle and feedback ownership |
| `EV-M7-SOURCE-SHELL` | `apartment-editor.tsx` shell/panel composition |
| `EV-M7-SOURCE-TOOLBAR` | `editor-toolbar.tsx` action inventory |
| `EV-M7-SOURCE-INSPECTOR` | wall/room/opening/object inspector sources |
| `EV-M7-SOURCE-REFERENCE` | `reference-panel.tsx` state machine UI |
| `EV-M7-SOURCE-RECOGNITION` | `recognition-panel.tsx` review workflow |
| `EV-M7-SOURCE-PLANNING` | planning panel and intent section |
| `EV-M7-SOURCE-3D` | spatial viewer and inspector |
| `EV-M7-SOURCE-CSS` | current app and viewport CSS |
| `EV-M7-BROWSER-M4.6` | accepted clear-dimension and area workflow |
| `EV-M7-BROWSER-M6.3` | accepted inspector/viewport and exact witness workflow |
| `EV-M7-BROWSER-M6.4` | supplied language-review/transfer screenshots and narrow-panel polish |
