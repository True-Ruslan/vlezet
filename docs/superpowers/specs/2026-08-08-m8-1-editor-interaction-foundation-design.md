# M8.1 — Editor Interaction Foundation Design

**Date:** 2026-08-08  
**Status:** product direction approved; written design pending review  
**Programme:** M8 Public Beta Editor  
**Tracker:** #54

## 1. Goal

Build the interaction foundation that later precision drawing, calibration, assisted tracing and furniture editing can depend on without redesigning selection and commands again.

M8.1 should make the editor feel materially more mature even before structural-editing M8.2:

- navigation is predictable with mouse, trackpad and keyboard;
- selection is one coherent model rather than four unrelated nullable IDs;
- multiple furniture objects can be selected and moved as one rigid set;
- safe copy/cut/paste/duplicate operations work predictably;
- UI actions, context menu and keyboard shortcuts use one command registry;
- mixed/structural selections are allowed, but unsupported operations are visibly unavailable rather than silently approximated;
- no persistent project schema change is required.

## 2. Existing constraints and problems

The current web editor stores separate single selections (`selectedWallId`, `selectedRoomId`, `selectedOpeningId`, `selectedObjectId`) and single-object gesture state. This is sufficient for the accepted M7 inspector workflows but does not scale to marquee selection, bulk movement, clipboard or shared command availability.

Current Canvas navigation already has useful primitives — cursor-centred wheel zoom, Space+drag and middle-button pan — but wheel behaviour is not aligned with common modern canvas expectations for trackpads, where ordinary two-finger scroll should pan and pinch/modified wheel should zoom.

Existing geometry/history authority is good and must be preserved instead of replaced.

## 3. Scope decomposition

M8.1 establishes the substrate; M8.2 expands structural manipulation.

### In M8.1

- unified selection contract;
- primary selection;
- click/toggle/marquee/select-all selection;
- selection capability evaluator;
- multi-selection presentation;
- multi-object movement for placed furniture/appliances/custom objects;
- semantic furniture clipboard and duplicate;
- cut as copy + atomic semantic delete for supported selections;
- paste near current pointer/viewport with fresh IDs;
- central command registry;
- navigation contract and viewport commands;
- minimal right-click context menu implemented only as a registered-command surface;
- compatibility bridge for existing single-entity inspectors;
- TDD/browser coverage.

A floating selection toolbar is deliberately deferred so M8.1 introduces only one new secondary command surface.

### Deferred to M8.2

- direct vertex selection/editing;
- batch movement of structural walls/subgraphs;
- structural clipboard with topology dependency closure;
- copy/paste of openings across arbitrary host walls;
- wall split/merge/junction manipulation;
- exact inline wall length/angle entry;
- advanced snap types.

### Deferred to M8.5

- furniture group rotation;
- furniture alignment/distribution;
- advanced wall-relative furniture commands;
- rich resize handles for multiple furniture objects.

### Explicitly not supported

- arbitrary group scale;
- scaling wall thickness, opening width or furniture dimensions by a visual percentage;
- automatic mutation of an unsupported subset of a mixed selection;
- persisted selection state in `VlezetDocument`.

## 4. Unified selection model

Introduce a runtime semantic selection representation.

```ts
type EditorEntityKind =
  | "wall"
  | "vertex"
  | "room"
  | "opening"
  | "placed-object";

type EditorEntityRef = Readonly<{
  kind: EditorEntityKind;
  id: string;
}>;

type EditorSelection = Readonly<{
  refs: readonly EditorEntityRef[];
  primary: EditorEntityRef | null;
}>;
```

Rules:

1. `refs` contains no duplicate `(kind,id)` pair.
2. Ordering is deterministic insertion/selection order, not document array order.
3. `primary` is either null or present in `refs`.
4. Plain click replaces selection and makes the clicked entity primary.
5. Additive/toggle click updates membership and makes the newly added entity primary. Removing the primary chooses the last remaining ref, or null when empty.
6. Empty-Canvas plain click clears selection.
7. Selection is sanitised after every document history transition; refs to deleted/non-derived entities disappear deterministically.
8. Selection remains runtime-only and is not part of save/backup/project schema.

`vertex` exists in the type from the start so M8.2 does not require another selection-model redesign, but direct vertex selection remains disabled in M8.1.

## 5. Selection interaction semantics

### 5.1 Click

In Select mode:

- plain primary click on an entity replaces selection;
- `Shift+click` toggles that entity;
- `Cmd+click` on macOS or `Ctrl+click` elsewhere uses the same toggle semantics;
- click empty Canvas clears unless an additive modifier is active;
- dragging a selected placed object begins a move gesture rather than a marquee.

### 5.2 Hit priority

Default click priority when rendered entities overlap:

```text
opening
> placed object
> wall
> room
```

Rooms are derived background regions and must not steal ordinary clicks from concrete editable entities.

Direct vertex hit priority is introduced only in M8.2.

An overlap-cycle gesture is not required in M8.1. If browser evidence later proves it necessary, it becomes an explicit follow-up rather than hidden repeated-click behaviour.

### 5.3 Marquee

A drag beginning on empty Canvas in Select mode starts marquee selection unless Space/middle-button pan is active.

M8.1 marquee considers:

- placed objects;
- walls;
- openings.

Derived rooms and vertices are excluded so background regions and hidden topology nodes are not selected unintentionally.

Semantics:

- plain marquee replaces current selection;
- `Shift+marquee` adds matching entities while preserving current selection;
- zero-area/near-click drag is treated as an empty click using a screen-pixel threshold;
- intersection with the marquee is sufficient; full containment is not required;
- result ordering is deterministic;
- the final newly added entity becomes primary.

Subtractive/toggle marquee is deferred.

### 5.4 Select all

`Cmd/Ctrl+A` selects all current concrete editable entities:

- walls;
- openings;
- placed objects.

Derived rooms and vertices are excluded.

The command is ignored while an editable text/control target has focus so native Select All wins.

## 6. Single-selection compatibility

M8.1 must not rewrite every accepted inspector at once.

Add selector helpers derived from unified selection:

- size `0` → all single-context projections null;
- size `1` → matching existing inspector receives that entity;
- size `>1` → single-entity inspector is replaced by multi-selection context.

No independent legacy selection truth remains writable after migration.

## 7. Multi-selection context UI

For selection size greater than one, the inspector shows:

- count and type summary, e.g. `Выбрано: 4 · мебель 3 · стена 1`;
- available commands;
- concise reason for important unavailable commands;
- no misleading shared dimension form for mixed objects.

Canvas presentation:

- every selected entity retains selected treatment;
- a group bounding rectangle is shown for orientation;
- group box has no resize handles;
- furniture-only move-compatible selection may show the rigid-set outline during drag;
- selection strokes remain screen-stable across zoom.

## 8. Capability model

Selection does not imply permission to transform.

Introduce a pure capability evaluator.

```ts
type SelectionCapability = Readonly<{
  enabled: boolean;
  reason?: string;
}>;

type SelectionCapabilities = Readonly<{
  copy: SelectionCapability;
  cut: SelectionCapability;
  duplicate: SelectionCapability;
  delete: SelectionCapability;
  move: SelectionCapability;
  rotate: SelectionCapability;
  scale: SelectionCapability;
}>;
```

M8.1 baseline:

| Selection | Copy/Cut | Duplicate | Batch move | Delete | Group rotate | Group scale |
|---|---|---|---|---|---|---|
| one placed object | yes | yes | yes | yes | existing single-object rotation | no |
| several placed objects | yes | yes | yes | yes | deferred | no |
| one wall/opening/room | existing single-item actions only | existing semantics only | existing semantics only | existing semantics only | n/a | no |
| several structural entities | no | no | no | no batch delete | no | no |
| mixed structure + furniture | no | no | no | no batch delete | no | no |

Rule:

> A command must not silently apply to only the compatible subset of a selection unless that command is explicitly designed as a subset command.

M8.1 defines no implicit subset commands.

`scale.enabled` is always `false`. Later furniture resize changes physical width/depth and is not group graphical scale.

## 9. Multi-object move

M8.1 completes rigid translation for furniture-only selections.

1. Select multiple placed objects.
2. Drag any selected object.
3. Dragged object becomes/retains primary and acts as snap anchor.
4. Entire selection receives one translation vector.
5. Relative positions and rotations remain exactly unchanged during preview.
6. Primary object uses existing object snapping to derive translation correction.
7. The same corrected translation is applied to every selected object.
8. Fit/collision feedback uses the preview set without committed mutation.
9. Pointer release commits one semantic batch command.
10. Escape/cancel restores exact pre-gesture state.

Validation:

- IDs never change during move;
- relative geometry never drifts;
- one Undo/Redo replays entire move;
- zero-delta commit creates no history command;
- one invalid authoritative object patch rejects the whole commit atomically.

## 10. Clipboard model

M8.1 clipboard supports placed-object selections only.

```ts
type VlezetClipboardPayloadV1 = Readonly<{
  version: 1;
  kind: "placed-objects";
  copiedAtOrigin: Point2;
  objects: readonly PlacedObject[];
}>;
```

Rules:

- semantic object data only; no Konva nodes/pixels;
- source IDs are never reused on paste;
- destination IDs come from normal editor ID factory;
- relative positions, rotations, dimensions, clearances and names are preserved;
- no source project ID is required, allowing same-session cross-project paste;
- clipboard is runtime-only and does not alter project schema;
- system Clipboard API is not required for correctness; editor Copy/Paste uses deterministic internal semantic clipboard;
- future system-clipboard interoperability must wrap this versioned payload rather than invent a second semantic format.

## 11. Copy, cut, paste and duplicate

### Copy

`Cmd/Ctrl+C` over a copy-capable selection updates internal clipboard and does not mutate document.

### Cut

`Cmd/Ctrl+X`:

1. creates clipboard payload;
2. deletes supported furniture selection through one semantic batch command;
3. deletion failure leaves document unchanged; clipboard may remain copied and UI reports cut failure;
4. one Undo restores all cut objects exactly.

### Paste

`Cmd/Ctrl+V` requires a valid payload.

Anchor priority:

1. last Canvas pointer world position while pointer is inside Canvas;
2. otherwise viewport world centre.

Copied group origin translates to anchor. All pasted objects receive fresh IDs and become selection; final stable payload object is primary.

Repeated paste at the same anchor adds deterministic `+200 mm,+200 mm` per repetition. Moving pointer or changing the effective viewport anchor resets the repetition series.

Paste is one semantic history command.

### Duplicate

`Cmd/Ctrl+D` duplicates supported selection at `+200 mm,+200 mm`, assigns fresh IDs, selects duplicates and commits one history command.

Offset is physical and zoom-independent.

## 12. Command registry

Shortcut parsing is replaced incrementally by a shared command surface.

Actual geometry mutation remains in editor-core/authoritative store actions; registry orchestrates actions only.

```ts
type EditorCommandContext = Readonly<{
  document: VlezetDocument;
  selection: EditorSelection;
  activeTool: EditorTool;
  editableTargetFocused: boolean;
}>;

type EditorCommand = Readonly<{
  id: string;
  label: string;
  shortcut?: string;
  availability: (context: EditorCommandContext) => SelectionCapability;
  execute: () => void;
}>;
```

Initial IDs:

```text
history.undo
history.redo
selection.selectAll
selection.copy
selection.cut
selection.paste
selection.duplicate
selection.delete
selection.clear
view.zoomIn
view.zoomOut
view.actualSize
view.fitPlan
view.fitSelection
tool.select
tool.wall
tool.door
tool.window
object.rotate90
```

Buttons, shortcuts and context menu call the same registered command path.

## 13. Keyboard focus safety

Editor shortcuts never override native editing inside:

- `input`;
- `textarea`;
- `select`;
- contenteditable;
- explicitly marked editable widgets.

`Cmd/Ctrl+C/X/V/A` remains native when an editable control is focused.

## 14. Navigation contract

### Wheel/trackpad stream

- unmodified wheel/two-finger delta → pan by reported `deltaX/deltaY`;
- `Shift+wheel` may map vertical delta to horizontal pan when device/browser provides no horizontal delta;
- `Ctrl+wheel` or `Cmd+wheel` → zoom around pointer;
- browser-synthesised modified-wheel pinch therefore zooms around gesture/pointer location;
- zoom factor is normalised and clamped to existing min/max scale;
- `preventDefault()` only while Canvas consumes the gesture.

### Drag pan

- Space + primary drag → pan;
- middle-button drag → pan;
- right-drag pan is deferred because right click belongs to context menu.

### View command shortcuts

```text
+ / =          zoom in
-              zoom out
0              restore canonical editor default viewport scale
1              fit plan/document
2              fit selection
```

`0` must reuse the existing default viewport scale authority discovered during implementation planning; no second magic zoom constant may be introduced.

## 15. Viewport runtime state

Viewport is ephemeral and separate from semantic history/document.

M8.1 may move it from component-local state into a focused runtime store/controller if command access requires it.

Required operations:

```text
panBy(screenDelta)
zoomAt(screenPoint, factor)
zoomByCommand(factor)
fitWorldBounds(bounds, padding)
fitDocument()
fitSelection()
```

No view command creates geometry history.

## 16. Fit plan and fit selection

`fitPlan` uses renderer-neutral document/reference bounds, screen padding and existing zoom clamps.

`fitSelection`:

- unavailable for empty selection;
- derives world bounds from actual semantic geometry;
- room uses derived polygon bounds;
- opening uses host/opening geometry;
- mixed selections union bounds;
- never mutates document/history.

## 17. Marquee geometry authority

Marquee hit testing uses semantic world geometry, not Konva node bounding boxes as persistent truth.

- placed object: oriented physical rectangle intersects marquee;
- wall: physical wall band/visible segment intersects marquee;
- opening: host-derived opening interval/symbol geometry intersects marquee.

Selection result must be reproducible from document + marquee rectangle.

## 18. Context menu

A minimal right-click context menu **is required in M8.1** and is only a presentation of registered commands.

For furniture-only selections it exposes applicable commands among:

- Copy;
- Cut;
- Paste;
- Duplicate;
- Rotate 90° for single object;
- Delete.

For mixed/unsupported selections it renders only enabled commands or a concise disabled reason where omission would be confusing.

The menu never mutates geometry directly.

Keyboard invocation of the context menu is required where browser/platform support provides the standard Context Menu key or `Shift+F10` path.

Floating selection toolbar is deferred.

## 19. Escape priority

Deterministic hierarchy:

1. cancel active move/drag/placement gesture;
2. cancel drawing/opening preview;
3. close context menu/transient popup;
4. clear selection;
5. leave exclusive tool/workflow according to existing accepted semantics.

Integration with current M7 Escape behaviour must have regression tests before production change.

## 20. State/data flow

```text
Pointer/keyboard event
        ↓
interaction resolver
        ↓
command / selection / viewport action
        ↓
preview runtime state (for gestures)
        ↓
existing editor-core semantic command on commit
        ↓
HistoryState / VlezetDocument
```

Selection, marquee, viewport, clipboard and gesture previews remain outside persistent document truth.

## 21. Failure behaviour

- stale selection after Undo/delete → sanitise ref, never crash;
- unsupported mixed clipboard/move/delete → disabled, no mutation;
- malformed clipboard payload → reject, document unchanged;
- paste ID collision → reject whole command atomically;
- one invalid member in batch movement/paste/delete → reject whole semantic command;
- unavailable view bounds → command unavailable/safe fallback, never geometry mutation;
- interrupted drag follows a deterministic cancel policy covered by browser tests;
- system clipboard permission cannot break core editor Copy/Paste because internal semantic clipboard is authoritative for M8.1.

## 22. TDD strategy — mandatory

Every task follows RED → GREEN → regression/refactor.

### Pure selection tests

1. replace selection;
2. toggle add/remove;
3. primary reassignment;
4. stable deduplication;
5. sanitise deleted refs;
6. marquee replace/add ordering;
7. Select All excludes room/vertex;
8. text-input focus preserves native Select All.

### Capability tests

1. one/many placed objects support copy/cut/duplicate/move/delete;
2. mixed selection disables batch mutation;
3. structural multi-selection disables M8.1 clipboard/move;
4. group scale always unavailable;
5. capability reasons deterministic/presentation-safe.

### Clipboard/history tests

1. copied payload preserves semantic fields;
2. paste creates fresh IDs;
3. relative geometry exact;
4. anchor translation deterministic;
5. repeated-paste offset deterministic;
6. duplicate offset exactly 200 mm on both axes;
7. paste/duplicate one Undo/Redo command;
8. cut one delete history command and exact restore;
9. malformed payload no mutation;
10. atomic failure on any invalid entity.

### Multi-move tests

1. relative positions invariant;
2. primary snap changes only common translation;
3. zero movement creates no history;
4. commit one semantic command;
5. Undo/Redo exact replay;
6. cancel restores original objects;
7. fit evaluation uses preview document.

### Viewport tests

1. unmodified wheel pans;
2. modified wheel zooms around pointer;
3. Space+drag pans;
4. middle drag pans;
5. fit-plan centres correct bounds;
6. fit-selection unions selected geometry;
7. zoom clamps;
8. view actions do not alter semantic history.

### Command/context tests

1. shortcut and context menu resolve the same command ID;
2. command availability comes from shared capability logic;
3. context menu cannot invoke disabled command;
4. `Shift+F10`/keyboard context path is reachable in browser coverage where supported;
5. native text Copy/Paste/Select All wins while text control is focused.

### Browser acceptance

Chromium must cover:

1. place at least three furniture objects;
2. modifier multi-select;
3. marquee selection;
4. rigid multi-object drag;
5. Copy/Paste near pointer;
6. Duplicate;
7. context-menu command execution;
8. Undo/Redo batch operations;
9. ordinary wheel pan;
10. modified-wheel zoom around pointer;
11. Space+drag and middle-button pan;
12. fit plan and fit selection;
13. text input retains native shortcuts;
14. mixed structure/furniture selection refuses unsafe batch mutation;
15. compact layout keeps essential actions reachable.

Representative WebKit independently covers:

- selection modifiers/marquee;
- multi-object move;
- Copy/Paste/Duplicate;
- ordinary wheel pan + modified-wheel zoom;
- IndexedDB document continuity after semantic operations.

## 23. Performance constraints

- selection/capability helpers are allocation-conscious;
- marquee uses bounded/memoised resolved geometry where practical;
- multi-object pointer preview is runtime-only;
- semantic commit happens once per gesture;
- no persistence write per pointer move;
- view navigation does not trigger unnecessary document derivation;
- performance regressions are investigated rather than hidden by weakened tests.

## 24. Accessibility/discoverability

M8.1 does not claim final M8.7 accessibility completion, but new controls must have:

- keyboard reachability;
- visible focus;
- correct menu/pressed semantics;
- non-colour command availability feedback;
- readable selection count/reason text;
- keyboard context-menu path;
- command alternatives for fit/copy/duplicate/delete/select-all.

## 25. CHANGELOG requirements

Final accepted M8.1 focused changelog must include:

- why single-selection/old navigation was insufficient;
- final selection/navigation/clipboard semantics;
- compatibility migration details;
- meaningful TDD RED/GREEN checkpoints;
- browser regressions found/fixed;
- exact final head and CI/browser evidence;
- structural batch transform/clipboard and group scale deferrals;
- product-owner acceptance statement;
- protected squash merge SHA.

`docs/CHANGELOG.md` receives a concise canonical entry referencing the focused record. Failures and intentional deferrals must remain visible.

## 26. Acceptance criteria

M8.1 is complete only when all are true:

1. unified selection is the only writable editor selection truth;
2. single-entity inspectors remain correct for size-one selection;
3. click/toggle/marquee/select-all semantics pass deterministic/browser tests;
4. multi-furniture move is rigid, snap-corrected by one translation and atomic in history;
5. furniture Copy/Cut/Paste/Duplicate uses fresh IDs and atomic Undo/Redo;
6. mixed/structural unsupported batch operations fail closed and are visibly unavailable;
7. ordinary wheel/trackpad pan and modified-wheel/pinch zoom are stable in Chromium and representative WebKit;
8. fit-plan/fit-selection work without semantic history mutation;
9. minimal context menu consumes the same registered commands as shortcuts;
10. project schema/portable backup remains unchanged;
11. full unit/type/lint/build and relevant M7 regressions pass;
12. focused Chromium + representative WebKit M8.1 acceptance passes;
13. focused/canonical changelogs are accurate;
14. explicit product-owner browser acceptance occurs before protected merge.

## 27. Non-goal reminder

M8.1 is intentionally not the final editor. It creates the reliable interaction foundation that makes M8.2 precision structural editing and M8.3 reference calibration safe to build.
