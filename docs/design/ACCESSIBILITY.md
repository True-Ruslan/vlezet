# Vlezet — Accessibility and Responsive Foundation

**Phase:** M7.0 Product and UX Audit  
**Target:** WCAG 2.2 AA for applicable web UI, without claiming formal conformance before dedicated verification  
**Platform:** desktop-first spatial editor

## 1. Accessibility position

Vlezet is a visual spatial editor, but visual complexity does not remove the obligation to make controls, state and recovery understandable and operable.

M7 distinguishes:

- HTML application controls that should meet ordinary web accessibility expectations;
- Canvas/WebGL spatial operations that need semantic alternatives and status;
- advanced precision workflows where keyboard-equivalent numeric controls may be more appropriate than reproducing every pointer gesture.

The product must not claim complete screen-reader/CAD-equivalent editing until dedicated testing proves it. It must provide a coherent, improving path rather than silently excluding keyboard/zoom users.

## 2. Landmark and heading structure

### Dashboard

```text
main
├── header / product navigation
└── project content
    ├── h1
    ├── status/error region
    └── project list/grid
```

### Editor

```text
main
├── header / global product bar
└── workspace
    ├── navigation/tool region
    ├── main spatial work surface
    └── complementary context panel
```

Requirements:

- one meaningful page-level `h1` or equivalent accessible name;
- panel/workflow headings follow a consistent level hierarchy;
- `aside`/`complementary` surfaces have accessible names;
- repeated unnamed `div` groups do not replace landmarks where navigation benefits;
- modal dialogs use `role=dialog`, `aria-modal=true`, title and description relationships.

## 3. Labels and descriptions

- Every input/select/textarea has a visible label.
- Units are included in the accessible name/description, not only visual suffix.
- Required/optional meaning is explicit.
- Error text is associated with the field through `aria-describedby`; invalid state uses `aria-invalid`.
- Icon-only buttons have an accessible name and tooltip where helpful.
- Native title attributes are supplementary, not the only instruction.
- Internal IDs are not used as primary accessible labels.

## 4. Keyboard reachability

### Required global paths

Keyboard users can:

- move between global product actions;
- select editor tools;
- open/close catalogue/context/workflow surfaces;
- reach all form controls;
- invoke Undo/Redo/export;
- close dialogs/popovers;
- return to the dashboard;
- discover shortcuts without relying on hover.

### Focus order

Order follows the visual/task hierarchy:

```text
project/global
→ tools
→ Canvas/spatial surface
→ context panel
→ transient dialog/sheet
```

When a context drawer overlays Canvas, focus moves into it only when opened intentionally and returns to the invoking control on close.

### Shortcut safety

- shortcuts do not fire while typing in editable controls, except documented Escape behaviour;
- platform-specific Ctrl/Cmd alternatives are supported;
- shortcut hints are optional metadata and may collapse without removing the action;
- no single-letter shortcut is the only way to access a command.

## 5. Escape and cancellation

Accepted hierarchy:

1. cancel active drag/pointer gesture or incomplete measurement;
2. close transient popover/dialog/Preview;
3. exit active exclusive tool/workflow phase;
4. clear selection only when no higher-priority transient state exists.

Requirements:

- one Escape does not trigger multiple unrelated cancellations;
- focus returns to a logical element;
- dialogs state when Escape is disabled because an operation cannot be interrupted safely;
- 3D provides a keyboard route back to 2D.

## 6. Visible focus

Target focus style:

```text
2 px equivalent high-contrast outline/ring
3 px outer focus ring where component borders need separation
```

Requirements:

- focus is visible on light, accent, warning and danger surfaces;
- focus is not clipped by overflow containers;
- Canvas-adjacent controls preserve focus while the user pans/zooms;
- custom card/button controls show focus on the actual interactive boundary;
- focus-visible is not replaced by hover styling.

## 7. Canvas and spatial editing

### Accessible state

The 2D work surface exposes:

- current tool;
- selected entity type/name;
- active workflow/Preview/Draft status;
- blocking topology/fit state;
- concise instructions for next action;
- a route to the context panel.

### Keyboard alternatives

M7.x must provide practical alternatives for required tasks:

- exact wall/room/object fields remain keyboard-editable;
- reference calibration provides coordinate/point controls instead of drag-only requirement;
- object movement can use exact fields even if keyboard nudge is deferred;
- measurement may provide focusable point coordinates or a documented limited pointer dependency;
- 3D provides camera preset/fit commands and a semantic entity list/path.

### Canvas announcements

Do not announce continuous pointer movement. Announce meaningful transitions:

- tool changed;
- first point set;
- wall/measurement completed;
- entity selected;
- invalid topology prevents room derivation;
- Preview opened/closed;
- Apply completed.

## 8. 3D accessibility

- 3D section has an accessible name and explicit read-only description.
- Camera preset buttons are keyboard-operable.
- A fit-camera action is reachable.
- Hover-only details have click/focus/semantic alternatives.
- Selected room/wall/object details are available in structured HTML.
- WebGL failure has a visible and accessible 2D recovery action.
- Reduced motion disables non-essential camera animation if introduced later.

Direct keyboard geometry editing in 3D remains a non-goal.

## 9. Colour and non-colour signalling

Colour is never the only signal for:

- selection;
- fit status;
- recognition confidence/conflict;
- warning/error/success;
- Draft/Preview/Applied;
- mandatory constraint/preference;
- active tool.

Use combinations of:

- text label;
- icon;
- line pattern;
- border/fill;
- shape/badge;
- accessible state.

Target contrast:

- normal text: at least 4.5:1;
- large text: at least 3:1;
- UI component boundaries/focus/meaningful graphics: at least 3:1 where applicable;
- muted text remains readable and is not used for essential state below contrast requirements.

## 10. Typography and zoom

- essential UI text minimum target: 12 px at 100% browser zoom;
- body/helper copy uses readable line height;
- numeric evidence uses tabular digits where helpful;
- text can enlarge to 200% without clipping or loss of action;
- the UI does not prevent browser zoom;
- controls reflow rather than hide purely because zoom reduces effective width.

## 11. Pointer targets

Desktop target sizes:

- standard control: at least 40 px visible height where practical;
- compact control: at least 36 px pointer target;
- icon-only controls: at least 36×36 px;
- calibration/Canvas handles: visually precise but pointer hit area at least 24×24 px and preferably larger;
- adjacent destructive/primary controls have sufficient separation.

## 12. Dialogs, menus and sheets

### Dialog

- focus enters dialog;
- focus is trapped while modal;
- title/description are announced;
- Escape/cancel is predictable;
- focus returns to invoker;
- background is inert;
- action order is consistent;
- destructive action is explicit and not accidental default.

### Menu/popover

- trigger state is announced;
- keyboard arrows/Tab follow the selected interaction pattern;
- click outside/Escape close;
- focus returns to trigger;
- menu remains inside viewport at zoom.

### Context drawer/sheet

- accessible title and close;
- preserves selected entity/workflow state;
- no off-screen primary action;
- internal scrolling does not trap page/editor navigation unexpectedly.

## 13. Async status and live regions

### Polite announcements

- saving/saved;
- recognition progress phase changes at meaningful intervals;
- provider interpretation completed;
- export completed;
- non-blocking result count.

### Assertive alerts

- save failed;
- project startup/recovery failure;
- blocking import error;
- Apply failure that leaves document unchanged.

Avoid repeated announcements on every render/progress percentage.

## 14. Error recovery

Each actionable error provides:

- what failed;
- whether project data remains safe;
- recovery action;
- associated field/context;
- focus movement only when necessary.

Examples:

- failed save: persistent global status + retry;
- invalid numeric field: inline association;
- stale recognition/planning: context notice + regenerate/close;
- WebGL: return/use 2D;
- missing reference asset: replace/remove while apartment remains.

## 15. Responsive and viewport acceptance matrix

### Required environments

| Viewport / zoom | Dashboard | Editor shell | Context/inspector | Dialogs/workflows | Canvas |
|---|---|---|---|---|---|
| 1920×1080 100% | full | full | persistent | viewport-safe | primary area preserved |
| 1920×1080 125% | full | compact | persistent/resizable | viewport-safe | usable |
| 1440×900 100% | full | compact | persistent | viewport-safe | usable |
| 1440×900 125% | compact | overflow utilities | persistent/drawer | no clipped actions | usable |
| 1366×768 100% | compact | overflow utilities | persistent/drawer | internal scroll | usable |
| 1280×800 100% | compact | compact | persistent/drawer | internal scroll | usable |
| any supported 150% | reflow | core actions preserved | drawer if needed | all actions reachable | minimum useful area |
| any supported 200% | reflow | no functional disappearance | accessible overlay or explicit limitation | focus/action reachable | not horizontally escaped |
| narrower width | project access | graceful limitation | not silently lost | safe close/export | no broken half-layout |

### Failure criteria

Any of the following fails acceptance:

- horizontal inspector escape;
- primary action outside reachable scroll/focus;
- essential label clipped with no accessible name;
- selected entity cannot be edited because the inspector disappeared;
- toolbar loses active tool or save/history without replacement;
- dialog exceeds viewport with inaccessible footer;
- focus is invisible or lost after close;
- Canvas becomes a negligible strip while non-essential panels remain;
- long Russian names force the application wider than viewport.

## 16. Screen-reader review scope

M7.x should test at least:

- VoiceOver + Safari on macOS for dashboard, global bar, inspector fields and dialogs;
- one Chromium screen-reader path where available;
- announcements for save state and representative async workflow;
- heading/landmark navigation;
- form error association.

Canvas drawing equivalence is documented separately and cannot be claimed complete from ordinary HTML review.

## 17. Reduced motion

Under `prefers-reduced-motion: reduce`:

- remove hover lift/transform effects;
- replace spinners with accessible static/progress alternatives where appropriate;
- avoid animated panel slides or camera motion;
- retain immediate state changes and focus;
- do not delay Apply/validation feedback.

## 18. Finding coverage

This foundation directly governs:

- `UX-SHELL-002`;
- `UX-REF-002`;
- `UX-REC-002`;
- `UX-3D-002`;
- `UX-DATA-001`;
- `UX-PATTERN-002`;
- `UX-ACCESS-001`;
- `UX-ACCESS-002`.

It also provides acceptance requirements for every M7.x UI slice.

## 19. Non-goals

This document does not claim:

- formal WCAG conformance;
- complete keyboard-only free-form floor-plan drawing;
- mobile-first editing;
- direct 3D editing;
- accessibility through a separate simplified document that can diverge from `VlezetDocument`.
