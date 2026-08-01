# M7.6 — Geometry and Opening Inspector Design

**Status:** approved design, implementation not started  
**Date:** 2026-08-01  
**Branch:** `feat/m7-6-geometry-opening-inspector`  
**Owned findings:** `UX-GEO-001`, `UX-GEO-002`, `UX-GEO-003`

## 1. Goal

Make room dimensions, wall-axis length, wall thickness, opening position and door swing visually predictable for an ordinary user without changing the existing geometry, topology, persistence or history authority.

M7.6 is a presentation and interaction slice. It translates the current authoritative geometry model into visible physical spans, surfaces, endpoints and door-swing choices. It does not introduce a second geometry model.

## 2. Current problems

### 2.1 Door controls expose directed-wall internals

The current door inspector asks the user to choose:

- hinge at `start` or `end` of the opening;
- opening to the `left` or `right` of wall direction.

These values are correct internal geometry semantics but are difficult to predict on horizontal, vertical and reverse-directed walls.

### 2.2 Precision controls are fragmented

Room clear dimensions and wall length/thickness are presented as repeated field, anchor and Apply blocks. Related concepts are not grouped into a coherent visual form, and errors are not consistently local to the affected geometry operation.

### 2.3 Room width and length lack a physical orientation cue

`Ширина` and `Длина` depend on screen orientation but are not visibly tied to the physical horizontal or vertical interior span that will change.

## 3. Chosen approach

Use a visual-semantic inspector layered over the existing command model.

A pure presentation module derives user-facing orientation, endpoint, surface, opening-reference and door-swing descriptions from authoritative current geometry. UI components use those descriptions and map user choices back to existing command values:

- `WallLengthAnchor`;
- `WallThicknessAlignment` and the existing adjacent-room intent resolver;
- `ClearRoomDimensionAnchor`;
- canonical `Opening.offset`;
- existing `doorSwing.hinge` and `doorSwing.side`.

No persistent representation changes.

## 4. Architecture

### 4.1 Pure presentation model

Add:

```text
apps/web/components/editor/geometry-inspector-presentation.ts
```

The module must remain React-free and store-free. It may depend only on stable domain/geometry types and pure helpers.

It owns:

1. wall visual orientation;
2. visible endpoint names;
3. visible physical-face names;
4. endpoint-to-command mappings;
5. opening offset display and canonical conversion;
6. four door swing choices and their accessible descriptions;
7. room horizontal/vertical span descriptions.

Representative types:

```ts
type WallVisualOrientation =
  | "horizontal-forward"
  | "horizontal-reverse"
  | "vertical-forward"
  | "vertical-reverse"
  | "diagonal-forward"
  | "diagonal-reverse";

type VisibleWallEndpoint = "visual-start" | "center" | "visual-end";

type OpeningOffsetReference = "visual-start" | "visual-end";

type DoorSwingChoice = Readonly<{
  id: string;
  hinge: "start" | "end";
  side: "left" | "right";
  label: string;
  description: string;
}>;
```

Exact type names may change in implementation, but the boundary and responsibilities must remain.

### 4.2 Visual inspector primitives

Add small store-free components rather than expanding `wall-inspector.tsx` with inline SVG/HTML logic:

```text
geometry-span-cue.tsx
wall-axis-cue.tsx
wall-thickness-cue.tsx
opening-position-cue.tsx
door-swing-selector.tsx
```

Each component receives an already-derived presentation model. It does not inspect the editor store, mutate the document or duplicate geometry calculations.

The primitives use the existing M7.3 design tokens, `UiField`, `UiFieldMessage`, `UiButton`, `UiCard` and context-section anatomy.

## 5. Room inspector

### 5.1 User model

Rename the section to `Внутренние размеры`.

For a supported rectangular room, render two independent cards:

- `По горизонтали`;
- `По вертикали`.

Each card shows:

- a compact room outline;
- the affected physical interior span;
- current and draft value in millimetres;
- the fixed side/centre choice;
- one local Apply action;
- one local error area.

Primary descriptions:

```text
По горизонтали — между внутренними поверхностями стен
По вертикали — между внутренними поверхностями стен
```

`Ширина` and `Длина` may appear as secondary compatibility wording, not as the sole orientation signal.

### 5.2 Command mapping

The horizontal card continues to call:

```ts
setSelectedRoomClearDimension("width", value, anchor)
```

The vertical card continues to call:

```ts
setSelectedRoomClearDimension("height", value, anchor)
```

Existing `min`, `center` and `max` anchors remain authoritative. Presentation labels are:

- horizontal: left side, centre, right side;
- vertical: top side, centre, bottom side.

### 5.3 Unsupported rooms

For non-rectangular rooms, retain the fail-closed limitation. Do not estimate or expose ambiguous spans. Show concise copy explaining that exact interior dimension editing is available only for a simple rectangular room.

## 6. Wall inspector

### 6.1 Axis length

Render an explicit axis cue with two endpoint markers and the measured centre line.

The section title remains `Длина по оси` and explains that this is the distance between wall nodes, not the room clear dimension.

The fixed-point choice uses visible physical labels derived from current wall orientation:

- horizontal: `Левый конец`, `Центр`, `Правый конец`;
- vertical: `Верхний конец`, `Центр`, `Нижний конец`;
- diagonal: combinations such as `Верхний левый конец` and `Нижний правый конец`.

The presentation module maps these choices back to existing `start`, `center` and `end` command values. Reversing a wall’s internal endpoint order must not reverse the user-facing screen labels.

### 6.2 Thickness

Render two physical faces and a dashed wall axis.

When `deriveSingleAdjacentRoomSide()` returns one unambiguous adjacent room side, the fixed-face choices are:

- `Внутренняя поверхность`;
- `Ось стены`;
- `Наружная поверхность`.

The UI asks `Что оставить на месте`, not `Куда меняется толщина`.

The existing `resolveWallThicknessAlignment()` remains the only mapping from inside/centre/outside intent to canonical alignment.

When there is no unambiguous adjacent room, do not guess inside/outside. Use visible physical face labels based on orientation, such as:

- `Верхняя поверхность` / `Ось стены` / `Нижняя поверхность`;
- `Левая поверхность` / `Ось стены` / `Правая поверхность`;
- diagonal equivalents where needed.

The selection maps directly to existing `left-face`, `center` or `right-face` alignment.

## 7. Opening inspector

### 7.1 Sections

Split the form into:

1. `Размер проёма`;
2. `Положение на стене`;
3. `Направление двери` for doors only;
4. destructive action.

### 7.2 Width

Keep canonical opening width in millimetres and existing validation.

Use `Ширина проёма` as the field label.

### 7.3 Position reference

Show a compact wall strip with the opening and both visible wall ends.

The user chooses the reference end:

- visible first end;
- visible opposite end.

Labels are physical and orientation-aware, for example:

- `От левого конца` / `От правого конца`;
- `От верхнего конца` / `От нижнего конца`;
- diagonal equivalents.

The numeric field label becomes explicit, for example:

- `До проёма слева`;
- `До проёма сверху`.

Canonical conversion:

- from the wall’s internal start: displayed offset equals `opening.offset`;
- from the wall’s internal end: displayed offset equals `wallLength - opening.offset - opening.width`;
- on Apply from the internal end: canonical offset equals `wallLength - displayedOffset - opening.width`.

The presentation model first maps the selected visible end to the corresponding internal end, then uses these formulas. Reversing internal wall endpoints therefore never changes the meaning of the visible labels.

Conversion must be pure, finite and fail closed. Existing opening validation remains authoritative for width, boundaries and overlap.

### 7.4 Door swing selector

Replace the two internal-value selects with a four-choice visual selector.

Each choice renders:

- wall/opening baseline;
- hinge marker;
- door leaf in the open position;
- swing arc;
- selected state;
- complete accessible name and description.

The four choices are generated from the existing Cartesian product:

```text
hinge=start, side=left
hinge=start, side=right
hinge=end, side=left
hinge=end, side=right
```

User-facing copy is based on the actual visible result, for example:

```text
Петли слева, открывание вверх
Петли справа, открывание вниз
Петли сверху, открывание вправо
```

Diagonal walls use ordinary eight-direction wording such as `вверх-вправо` or `вниз-влево`; internal `left/right` is never shown.

The selector must behave correctly for horizontal, vertical, reverse-directed and representative diagonal walls.

The document continues to store only the existing `doorSwing` pair.

## 8. Runtime preview

Add:

```text
apps/web/components/editor/geometry-inspector-preview-store.ts
```

The ephemeral store contains only presentation intent:

- active room span identity (`horizontal` or `vertical`) for emphasis of the existing authoritative dimension annotation;
- draft door swing pair for the currently selected door.

It must not contain apartment geometry, calculated room dimensions, command results or persisted values.

Preview lifecycle:

- created from current inspector focus/selection or door-swing draft;
- cleared after successful Apply;
- cleared when selected entity changes or disappears;
- cleared on project switch;
- cleared when a bounded workflow or 3D replaces ordinary editing context;
- never serialized;
- never used to determine whether Apply succeeded.

The Canvas reuses the existing door leaf/arc renderer with a presentation-only override for the selected door. Existing document geometry remains the source for all other openings.

Room-span emphasis reuses existing dimension annotations and visibility controls. It highlights the already-derived annotation and never calculates or previews a different room size before Apply.

## 9. Apply, validation and errors

Keep separate explicit operations:

- `Применить горизонтальный размер`;
- `Применить вертикальный размер`;
- `Применить осевую длину`;
- `Применить толщину`;
- `Применить параметры проёма`.

Each operation:

1. parses its own fields;
2. retains draft input after failure;
3. displays error near the affected card/section;
4. invokes the existing editor-store action;
5. relies on existing editor-core/domain validation;
6. produces one existing semantic history command on success;
7. remains undoable in one Undo step.

Do not silently clamp, move, resize or repair invalid geometry.

Do not claim the project changed when the existing command throws or returns without mutation.

## 10. Responsive and accessibility contract

At docked and compact widths:

- visual cues must remain inside the context column;
- no document-level horizontal overflow;
- controls may stack but must retain the same meaning and actions;
- door choices remain at least 40 px interactive targets;
- selected state is not colour-only;
- every visual selector has ordinary-language labels;
- keyboard focus remains visible;
- the door selector implements radio-group semantics and supports arrow-key selection plus Space/Enter activation.

M7.6 improves accessible descriptions for its new controls but does not claim completion of the broader M7.9 spatial keyboard programme.

## 11. Authority boundaries

M7.6 must not change:

- `VlezetDocument`;
- schema or migrations;
- IndexedDB project records;
- portable backup format;
- wall topology or room derivation;
- clear-dimension calculations;
- area calculation;
- wall length or thickness command semantics;
- opening validation;
- snapping or hit testing;
- semantic-history grouping;
- recognition or planning algorithms;
- Three.js geometry authority;
- read-only 3D behavior.

M7.6 must not add:

- automatic room repair or generation;
- Canvas drag handles for dimension editing;
- complex-room dimension guessing;
- furniture/fit redesign;
- recognition-quality changes;
- dashboard/project lifecycle work;
- persistent UI preference fields.

## 12. Expected implementation slices

Use explicit RED/GREEN slices:

1. wall orientation and visible endpoint naming;
2. opening offset conversion from either visible end;
3. door choice generation and accessible descriptions;
4. room span presentation model;
5. store-free visual cue components;
6. room inspector migration;
7. wall inspector migration;
8. opening inspector migration;
9. runtime preview and stale-state cleanup;
10. compact layout contracts;
11. Chromium and WebKit acceptance flow;
12. milestone documentation and exact-head verification.

## 13. Test contract

### Unit tests

Cover:

- horizontal and vertical walls in both internal directions;
- representative diagonal walls;
- visible endpoint to `start/end/center` mapping;
- visible physical-face labels;
- opening offsets from both ends;
- boundary conversion with opening width;
- four door swing choices for each wall orientation class;
- room horizontal/vertical span descriptions;
- stale preview clearing;
- local parse/error behavior;
- no internal enum copy in rendered user-facing output.

### Component/layout tests

Cover:

- room cards and local Apply actions;
- wall axis and thickness sections;
- opening width/position sections;
- radio-group semantics for door choices;
- selected state, arrow keys and Space/Enter activation;
- compact-width stacking and no overflow;
- use of existing M7.3 primitives and tokens.

### Browser acceptance

Use Chromium full flow and WebKit core smoke for:

1. horizontal room dimension change;
2. vertical room dimension change;
3. each fixed-side option and one-step Undo;
4. horizontal and vertical wall axis length changes;
5. thickness relative to an unambiguous room side;
6. no-room-side physical-face selection;
7. opening position measured from both visible ends;
8. all four door swing choices on horizontal and vertical walls;
9. reverse-directed wall correctness;
10. draft door preview before Apply and cleanup afterward;
11. invalid opening edit remains uncommitted and recoverable;
12. compact context reachability and no horizontal overflow;
13. M7.1–M7.5 regression paths remain green.

## 14. Acceptance criteria

M7.6 is acceptable when:

- a user can predict the changed room span before Apply;
- a user can predict which wall endpoint or face remains fixed;
- opening position can be understood from either visible wall end;
- intended door swing is selected on the first attempt in representative horizontal and vertical cases;
- reverse-directed walls do not expose reversed or misleading labels;
- Apply remains explicit, validated and one-step undoable;
- no persistent or geometry authority changes are introduced;
- unit, typecheck, lint and production build pass;
- Chromium full flow and WebKit core smoke pass;
- product-owner browser acceptance passes on the exact release-candidate head.
