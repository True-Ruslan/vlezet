# M7.1 Editor Shell and Responsive Context — Design

**Status:** approved direction derived from accepted M7.0 evidence  
**Date:** 2026-07-30  
**Branch:** `feat/m7-1-editor-shell-responsive-context`  
**Depends on:** accepted M7.0 Product and UX Audit (`0d5b9c1555ef85a0e271a52832cc3fd3cca4963e`)

## 1. Purpose

M7.1 rebuilds the editor shell so existing Vlezet capabilities remain understandable and reachable across supported desktop widths and browser zoom.

It owns four accepted findings:

- `UX-SHELL-001` — project, tool, display, workflow, export and history actions compete and clip in one toolbar row;
- `UX-SHELL-002` — contextual controls disappear below the current effective-width breakpoint;
- `UX-DATA-001` — local-save state is rendered as low-priority 9 px metadata;
- `UX-ACCESS-002` — browser zoom removes functions rather than presenting them through a reachable alternative.

M7.1 changes composition and presentation only. It does not change apartment geometry, command semantics, persistence, planning, recognition or rendering authority.

## 2. Evidence

Accepted M7.0 browser evidence on the current product recorded:

- toolbar overflow in 12 captured editor states;
- document horizontal overflow in 12 states;
- contextual inspector present but hidden in 3 reduced-width states;
- save status below 12 px in 13 states;
- Canvas help below 12 px in 13 states.

Representative failures are visible at:

- 1440×900;
- 1366×768;
- 1280×800;
- effective 150% zoom width;
- effective 200% zoom width.

Evidence source: `docs/product/UX_BROWSER_EVIDENCE.md` and artifact `8771245306`.

## 3. Product goals

The user must always be able to answer:

1. Which project is open?
2. Is it saved locally?
3. Which editing tool or view is active?
4. Where are Undo and Redo?
5. How do I reach secondary project actions?
6. Where are the controls for the selected entity or active workflow?
7. How do I close or reopen a compact side surface?

The shell must preserve these answers without relying on hidden browser-width assumptions.

## 4. Non-goals

M7.1 does not:

- redesign wall, room, opening, object, planning, reference or recognition forms;
- change the Canvas drawing or hit-testing engine;
- change editor stores, commands, Undo/Redo semantics or keyboard mappings;
- change `VlezetDocument`, migrations, IndexedDB or project file formats;
- add mobile-first editing;
- add new AI, recognition, planning or 3D capability;
- solve the M7.10 default 3D interior-visibility finding;
- complete the full M7.3 design-system migration;
- claim full keyboard-only spatial editing or WCAG conformance.

## 5. Approaches considered

### 5.1 Keep one toolbar and hide more controls

Rejected. It reproduces the root cause and fails the accepted requirement that functions remain reachable rather than disappearing.

### 5.2 Replace the toolbar with an icon-only vertical rail

Not selected for M7.1. A vertical rail cleanly separates tools, but an icon-only first redesign would increase recognition burden for non-CAD users and require a broader icon/onboarding programme. It may be reconsidered after M7.3/M7.4 evidence.

### 5.3 Two-level header plus adaptive side surfaces

Selected.

Reasons:

- separates global/project responsibility from editing tools;
- preserves ordinary-language labels on normal desktop widths;
- allows compact icon presentation only when necessary;
- keeps the existing horizontal editing mental model;
- requires no editor-state rewrite;
- supports a reusable docked/sheet presentation for both catalogue and context;
- can be verified directly by the accepted browser harness.

## 6. Target shell composition

```text
EditorApp
├── Global project bar
│   ├── Back
│   ├── Project identity
│   ├── Readable local-save status
│   ├── Compact-context trigger when needed
│   ├── Project actions overflow
│   └── Undo / Redo
├── Tool bar
│   ├── Exclusive editing tools
│   ├── Workflow surfaces
│   └── View/display controls
└── Workspace
    ├── Furniture catalogue surface
    ├── Canvas or read-only 3D
    └── Context surface
```

Target shell rows:

```text
Global project bar: 52 px
Tool bar:           48 px
Workspace:          remaining height
```

The additional vertical cost is accepted because it removes horizontal clipping and creates stable semantic hierarchy. Essential controls remain at least 36–40 px high.

## 7. Global project bar

### 7.1 Left identity group

Contains:

- back to projects;
- compact Vlezet mark where space permits;
- editable project name;
- save status directly associated with the project name.

### 7.2 Save-state language

Canonical visible states:

| Internal state | UI copy |
|---|---|
| idle/local | `Локальный проект` |
| saving | `Сохраняем локально…` |
| saved | `Сохранено локально` |
| failed | `Не сохранено — повторить` |

Rules:

- minimum target font size: 12 px;
- success is not encoded by colour alone;
- failed status remains an actionable button;
- existing `aria-live` behaviour is retained;
- no cloud/account implication is introduced.

### 7.3 History

Undo and Redo remain visible in the global bar at every supported width.

They retain:

- existing command callbacks;
- disabled semantics;
- existing shortcuts;
- no new history state.

### 7.4 Project actions overflow

A labelled `Действия` control replaces independent low-priority toolbar items.

It contains the existing actions without semantic changes:

- show the whole plan;
- export PNG;
- export PNG with reference when available;
- export editable Vlezet JSON;
- current plan counts as secondary information.

No action may disappear because of a breakpoint.

### 7.5 Compact context trigger

When the context surface is no longer docked, the global bar exposes a labelled trigger.

Examples:

```text
Свойства · Комната
Свойства · Предмет
Панель · Подложка
Панель · Распознавание
Панель · Расстановка
```

The trigger:

- has `aria-controls`;
- exposes open/closed state;
- remains keyboard reachable;
- does not clear selection or workflow state;
- is hidden only while the context surface is permanently docked or while 3D owns the workspace.

## 8. Tool bar

### 8.1 Exclusive editing tools

One semantic group:

- Selection;
- Wall;
- Door;
- Window;
- Measurement.

Rules:

- exactly one exclusive editing mode is active;
- measurement continues to map internally to Selection plus measurement state;
- existing keyboard shortcuts remain authoritative;
- active state uses icon, background/border and `aria-pressed` where appropriate;
- text labels remain visible at ordinary desktop widths.

### 8.2 Workflow surfaces

Second group:

- Furniture;
- Reference plan;
- Recognition.

These open existing workflows. They do not become new editor tools or persistent document state.

At compact widths:

- Furniture opens the catalogue sheet;
- Reference and Recognition open the context sheet;
- opening one compact side surface visually replaces the other without mutating the underlying project/UI preference unnecessarily;
- selecting/placing an entity may bring the context surface forward while preserving the selected furniture preset and existing project state.

### 8.3 View and display controls

Third group:

- Dimensions visibility;
- 2D;
- 3D.

The existing 2D/3D store and dimensions store remain unchanged.

### 8.4 Responsive labels

At ordinary desktop widths, buttons display icon plus Russian label.

At compact effective widths:

- stable, tested icons remain visible;
- labels may collapse visually;
- complete accessible names and tooltips remain;
- the active state remains visually distinguishable;
- the tool bar may use internal scrolling only below the supported editing width and must never widen the document.

M7.1 introduces only the shell icon set required for these commands. It does not establish the complete M7.3 icon library.

## 9. Workspace and side surfaces

### 9.1 Wide mode

At sufficient effective width:

```text
catalogue (when open) | Canvas | context inspector
```

Targets:

- catalogue: current effective width near 250 px;
- context: approximately 340 px;
- Canvas: `minmax(0, 1fr)` and never allowed to widen the document.

The ordinary inspector, planning, reference and recognition continue to use the same semantic slot.

### 9.2 Compact mode

At reduced effective width, the workspace becomes Canvas-first:

```text
Canvas
+ optional left catalogue sheet
+ optional right context sheet
```

Side sheets are non-modal workspace surfaces:

- no blocking backdrop;
- Canvas remains visible and usable outside the sheet;
- each sheet has an explicit close control;
- a closed sheet remains reopenable from the tool/global bar;
- hiding presentation does not unmount the active inspector and lose uncommitted local form state;
- hidden content is removed from keyboard/accessibility traversal;
- selection and workflow state remain unchanged.

### 9.3 Compact surface arbitration

A transient shell state chooses which side surface is in front:

```ts
type CompactEditorSurface = "catalogue" | "context" | null;
```

This state is:

- ephemeral;
- not part of `VlezetDocument`;
- not stored in IndexedDB or backup;
- reset safely on project or 2D/3D changes.

Rules:

1. Furniture action opens `catalogue`.
2. Reference/Recognition actions open `context`.
3. A new semantic selection or planning context opens `context`.
4. Closing a sheet does not clear its underlying state.
5. Switching to 3D closes compact 2D sheets visually.
6. Returning to 2D restores ordinary selection; the user can reopen the relevant sheet.

### 9.4 Context identity

A pure helper derives the current context identity from existing state:

```ts
type EditorContextKind =
  | "empty"
  | "wall"
  | "room"
  | "opening-door"
  | "opening-window"
  | "object"
  | "planning"
  | "reference"
  | "recognition";
```

Precedence remains consistent with current rendering:

```text
recognition
reference
planning
object
opening
room
wall
empty
```

The helper is presentation-only and never changes selection.

## 10. 3D shell behaviour

When 3D is active:

- catalogue and ordinary 2D context surfaces are not rendered as docked columns;
- the workspace uses one full-width spatial surface;
- the global bar and tool bar remain available;
- editing tools remain disabled exactly as today;
- 2D remains a visible return action;
- M7.10 interior readability is not implemented here.

This also removes accidental dependence on the persisted catalogue-open flag when composing the 3D grid.

## 11. Responsive policy

Breakpoints are implementation values, not product semantics. The product contract is reachability.

Initial design policy:

| Effective CSS width | Presentation |
|---|---|
| wide desktop | catalogue and context may be docked |
| compact desktop / zoom | Canvas-first with side sheets |
| narrower than supported editing width | compact controls, sheets and explicit graceful limitation; no silent loss |

The implementation may choose the exact transition near 1080–1120 CSS px after browser evidence.

Requirements at all tested widths:

- document `scrollWidth <= clientWidth`;
- global and tool bars do not widen the document;
- save state, Undo/Redo and active tool remain reachable;
- every open workflow has a reachable presentation;
- selected-entity controls are docked or reopenable in a context sheet;
- Furniture remains reopenable as a catalogue sheet;
- no horizontal escape of the right panel;
- dialogs remain viewport-contained.

## 12. Accessibility

M7.1 establishes shell-level accessibility only:

- semantic header/navigation/complementary regions;
- labelled action groups;
- visible focus states;
- complete accessible names when visual labels collapse;
- `aria-controls` and expanded/pressed state for sheet triggers;
- hidden sheets excluded from focus order;
- close controls at least 36 px;
- save failures remain actionable;
- no status conveyed by colour alone;
- reduced-width reflow preserves controls.

Native Safari core regression is required before merge because M7.1 changes real shell presentation. Automated WebKit remains a fast proxy, not the final Safari claim.

## 13. Visual direction

M7.1 is an evolutionary redesign.

Preserve:

- restrained neutral surfaces;
- current blue accent;
- recognisable Vlezet mark;
- compact professional desktop character;
- light Canvas emphasis.

Improve:

- semantic grouping;
- readable save status;
- consistent 36–40 px command targets;
- spacing between command groups;
- stable focus/active states;
- subtle elevation for overlay sheets;
- no decorative gradients or animation-heavy chrome.

Motion is limited to short sheet transitions and must respect reduced-motion preferences.

## 14. State and architecture impact

### No change

- `VlezetDocument`;
- project schema/migrations;
- repository adapters/IndexedDB;
- editor command implementations;
- keyboard command mapping;
- geometry/fit/planning authority;
- recognition/LLM contracts;
- 2D/3D renderer authority;
- Preview/Apply lifecycle.

### New ephemeral presentation state

- compact-layout match;
- active compact side surface;
- context sheet open/closed presentation;
- action-menu presentation where React state is required.

No new state is serialized.

## 15. Implementation boundaries

Expected primary files:

```text
apps/web/components/editor/apartment-editor.tsx
apps/web/components/editor/editor-toolbar.tsx
apps/web/components/editor/editor-command-icon.tsx
apps/web/components/editor/editor-context-kind.ts
apps/web/components/editor/use-compact-editor-layout.ts
apps/web/app/globals.css
apps/web/app/editor-viewport.css
```

Existing inspectors/catalogue may receive only minimal presentation hooks or wrapper props. Their domain-specific forms remain unchanged.

Browser tooling is extended under:

```text
tools/m7-browser-audit/
```

## 16. TDD and automated contracts

### Slice A — pure context identity

RED tests cover:

- recognition/reference/planning precedence;
- object/opening/room/wall precedence;
- door/window distinction;
- empty context;
- no state mutation.

### Slice B — project/save/action shell

RED tests cover:

- canonical save copy;
- 12 px-or-greater rendered save status contract;
- always-reachable Undo/Redo;
- secondary actions retained in labelled overflow;
- existing callbacks called exactly once.

### Slice C — tool hierarchy

RED tests cover:

- exclusive tool actions and existing shortcuts;
- measurement behaviour unchanged;
- workflow/view controls retained;
- complete accessible names in compact presentation;
- no product milestone labels introduced.

### Slice D — docked/context sheet presentation

RED tests cover:

- wide context docked;
- compact context trigger present;
- selected object controls reachable in compact mode;
- hidden sheet excluded from accessibility traversal;
- closing presentation does not clear selection;
- reference/recognition/planning use the same shell slot.

### Slice E — catalogue sheet

RED tests cover:

- compact Furniture action opens catalogue;
- close/reopen works;
- selected preset state survives presentation changes;
- placing furniture promotes the context sheet without corrupting catalogue/project state.

### Slice F — 3D composition

RED tests cover:

- 3D workspace is one-column/full-width;
- editing tools disabled as before;
- 2D return remains visible;
- compact 2D sheets do not remain over the spatial view.

### Slice G — browser evidence

The accepted M7 browser harness becomes an assertion gate.

Required assertions after implementation:

- no document horizontal overflow at 1920×1080, 1440×900, 1366×768 and 1280×800;
- no document horizontal overflow at effective 150% and 200% widths;
- save status is at least 12 px and readable;
- active tool, Undo/Redo and `Действия` are reachable;
- room/object inspector is docked or reopenable;
- catalogue is docked or reopenable;
- context form state survives sheet close/reopen;
- planning and reference remain reachable;
- Chromium full representative flow passes;
- WebKit core smoke passes;
- native Safari core regression passes before merge.

## 17. Manual browser acceptance

Representative acceptance scenario:

1. Open a project at 1440×900.
2. Confirm project name, `Сохранено локально`, Undo/Redo, tool row and `Действия` are visible without clipping.
3. Draw a room and select it.
4. Open Furniture, place a sofa and inspect it.
5. Repeat at 1280×800.
6. Repeat at effective 150% and 200% zoom widths.
7. Confirm the context sheet opens automatically for the new selection and can close/reopen without losing field drafts.
8. Confirm the catalogue can close/reopen and furniture placement remains usable.
9. Open Reference and Planning through the same context presentation.
10. Switch to 3D and back without stale sheets or state loss.
11. Verify `Действия` retains fit and all export options.
12. Verify native Safari dashboard/editor/form/context-sheet/dialog behaviour on macOS.

## 18. Acceptance gate

M7.1 is complete only when:

- approved implementation plan is executed;
- all RED/GREEN slices are documented;
- full unit/type/lint/build CI passes on exact head;
- the M7 documentation contract passes;
- Chromium full-flow passes on exact head;
- WebKit core smoke passes on exact head;
- native Safari core regression is recorded;
- changed-file scope contains no authority/schema/persistence change;
- product owner confirms browser behaviour and visual direction;
- PR is marked Ready and squash-merged;
- canonical state, roadmap, changelog and acceptance evidence are synchronized.
