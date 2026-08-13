# M8.2 Room Translation Design

**Status:** Product-owner approved design; implementation pending written-spec review  
**Date:** 2026-08-12  
**Milestone:** M8.2 — precision drawing and structural editing  
**PR:** #87 (`feat/m8-2-precision-structural-editing`)

## Problem

M8.2 already supports direct structural wall/vertex editing, rigid furniture movement, room selection, room/structure clipboard operations, and explicit composite structure + furniture Copy/Paste. A selected room, however, cannot yet be moved directly by dragging its interior.

That breaks an otherwise consistent editor interaction model: a user can select a room as a first-class derived entity, but cannot grab it and translate it in the same way as furniture or a selected wall.

The new behavior must remain predictable, topology-safe and consistent with the existing explicit-selection clipboard contract. In particular, furniture must never become an implicit child of a room merely because its geometry happens to lie inside the room polygon.

## Product contract

### 1. Dragging a selected room

When exactly one room is selected and the user presses and drags from a free area inside that selected room, Vlezet attempts to translate the complete structural boundary of that room by one rigid delta `(dx, dy)`.

The room is derived geometry, not persistent state. The operation therefore translates the dependency-closed set of structural vertices/walls required to reproduce that room boundary; it never writes a persistent room container or parent-child relationship.

### 2. Furniture is explicit, never implicit

Dragging a selected room by itself moves only the room structure.

Placed furniture whose center or bounds happen to lie inside the room remains at its original world coordinates unless that furniture is explicitly part of the current selection.

There is no geometry-based implicit ownership rule such as “all furniture inside the room moves with it”.

### 3. Room + explicitly selected furniture

If the current selection contains exactly one room plus one or more placed objects, dragging the selected room translates the structural room boundary and every explicitly selected placed object by the exact same applied delta.

The composite move is atomic:

- one preview transaction;
- one commit;
- one semantic history entry;
- one Undo restores both structure and furniture;
- one Redo reapplies both;
- if structural validation rejects the candidate, neither structure nor furniture commits.

Selection may have been formed through modifier-click, marquee selection or an explicit helper command. The source of selection does not change move semantics.

### 4. `Выбрать мебель в комнате`

Add an explicit convenience command for a single selected room: `Выбрать мебель в комнате`.

The command expands the current selection with placed objects contained by the selected room according to the editor's authoritative room/object containment predicate. It does not move anything and does not create persistent ownership.

After expansion, the normal composite room drag contract applies. The user can visibly inspect and modify the selection before moving it.

The command is disabled when there is no single selected room.

### 5. Hit priority

Direct room drag begins only when the pointer-down resolves to the selected room interior and is not claimed by a higher-priority interactive entity.

Higher-priority entities include at least:

- placed furniture;
- openings;
- walls;
- structural vertex/junction handles;
- active editor overlays/controls.

This preserves the existing entity-selection/hit-testing hierarchy and prevents a room from stealing drag gestures from furniture or structural handles.

### 6. Topology safety and rejection

Room translation is fail-closed.

The implementation must derive the structural boundary closure and reject a move when translating that closure independently would require unsafe topology repair or would mutate connected structure outside the intended room closure.

Examples of rejection include:

- a room shares a structural vertex/wall dependency with neighboring geometry that cannot remain valid under an isolated rigid translation;
- the candidate would collapse/reverse a connected wall;
- topology validation fails;
- a hosted opening becomes invalid;
- the document changes concurrently during the gesture.

On rejection:

- preview may show the invalid candidate using existing invalid-preview treatment;
- a concise reason is exposed to the user;
- pointer release commits nothing;
- no partial furniture move occurs;
- no history entry is created;
- no silent vertex splitting, wall duplication, opening re-hosting or topology repair is attempted.

### 7. Exact drag semantics

Room drag follows the pointer delta directly, subject only to the same explicit structural snapping contract used by other M8.2 structural gestures.

The room move must not use clipboard-style “safe nearby” search. If the requested drag target is invalid, the gesture is rejected rather than silently moving the room somewhere else.

Alt/Option suppression and the global `Привязки` toggle apply consistently with existing structural gestures.

### 8. History and cancellation

A valid room/composite translation creates exactly one semantic history operation.

Preview, Escape/cancel, invalid candidates, zero-distance movement and rejected commits create no history operation.

Undo/Redo must preserve exact structural/furniture relative geometry.

## Architecture

### `@vlezet/editor-core`

Editor-core owns the structural transaction authority.

Add a pure room-translation evaluator that:

1. resolves the exact derived room boundary to a deterministic structural closure;
2. identifies the vertices/walls that must move rigidly;
3. identifies external structural dependencies that make isolated movement unsafe;
4. produces a candidate document translated by one delta;
5. validates topology and hosted openings through the existing structural validator;
6. returns accepted/rejected result plus affected entity identifiers.

This logic must not live in Canvas and must not introduce persistent room state.

### Web editor store

Extend the existing structural gesture model rather than creating a second history/runtime path.

A room gesture stores the immutable `before` document, the selected room identity/boundary identity needed to reject stale gestures, preview document, validity/reason and changed state.

For room + placed-object selection, the store also records the explicit selected object IDs and projects their preview positions by the exact structural applied delta. Commit replaces the complete document atomically through one semantic history command.

The store remains the single transaction/history authority for the gesture.

### Canvas

Canvas owns pointer intent and projection only.

It may start room drag when:

- tool is `select`;
- exactly one room is part of the relevant selection;
- pointer-down is in that selected room's free interior;
- no higher-priority entity consumed the gesture;
- editing is otherwise allowed.

Canvas computes raw pointer delta, applies existing structural snap resolution to the room anchor, asks the store/editor-core to preview, and renders the resulting preview document/furniture positions.

Canvas never decides topology validity itself.

### Selection helper

`Выбрать мебель в комнате` is a selection-only command. It derives contained placed objects deterministically and adds their refs to the current room selection. It does not alter the document or history.

The containment rule must be implemented/tested in a focused reusable helper rather than duplicated in command/UI code.

## Containment semantics for `Выбрать мебель в комнате`

A placed object is considered contained when its physical footprint is fully inside or on the room polygon within existing geometry epsilon tolerance.

Using full footprint rather than center-point containment avoids silently selecting large furniture that visibly crosses a room boundary.

Objects that intersect/cross the room boundary are not selected automatically. The user can still add them explicitly through normal selection controls.

## UI/feedback

- Selected-room interior shows the existing selectable/drag affordance when room drag is available.
- During valid room drag, the complete room boundary previews at the candidate location.
- Explicitly selected furniture previews with the exact same delta.
- Invalid structural preview uses existing danger feedback and a short reason such as `Комната связана с соседней конструкцией и не может быть перемещена отдельно`.
- The helper command is exposed through the room context/selection UI where selection commands already live; no new modal is introduced.

## TDD acceptance matrix

### Editor-core

1. isolated rectangular room translates every boundary vertex by exact delta;
2. room wall lengths/thicknesses and hosted openings remain structurally equivalent after rigid translation;
3. neighboring unrelated structure remains byte/coordinate unchanged;
4. unsafe shared topology rejects without partial document mutation;
5. invalid opening/topology candidate rejects through the unchanged validator;
6. zero delta is a no-op;
7. source document is never mutated.

### Store

1. room-only gesture previews and commits structure only;
2. room + explicitly selected furniture applies one exact delta to both;
3. furniture inside room but not selected remains unchanged;
4. invalid structural candidate leaves furniture unchanged;
5. commit creates one history entry;
6. Undo/Redo is exact for the complete composite move;
7. cancel/no-op/reject creates no history entry;
8. stale/concurrent document mutation rejects fail-closed.

### Selection helper

1. fully contained furniture is selected;
2. partially crossing furniture is not implicitly selected;
3. furniture in another room is not selected;
4. command requires exactly one selected room;
5. helper changes selection only and creates no history/document mutation.

### Browser acceptance — Chromium

1. click room interior, then drag selected room from its free interior;
2. isolated room follows pointer and commits in requested position;
3. room-only move leaves unselected interior furniture visually and semantically unchanged;
4. room + two explicitly selected furniture items moves as one rigid group;
5. `Выбрать мебель в комнате` visibly expands selection, after which room drag moves the selected contents;
6. dragging from furniture still moves/selects furniture rather than stealing gesture for room;
7. unsafe connected-room move visibly rejects and commits nothing;
8. one Undo/Redo reverses/restores complete valid composite move;
9. snapping toggle and Alt/Option suppression remain consistent.

### Browser acceptance — WebKit representative subset

Cover at minimum:

- room-only drag;
- room + explicit furniture drag;
- higher-priority furniture hit behavior;
- unsafe rejection;
- Undo/Redo.

## Non-goals

This correction does not add:

- persistent room ownership or room containers;
- automatic ownership of furniture by room;
- moving multiple rooms as one structural group;
- arbitrary structural rotation or scale;
- silent detach/split/repair of shared topology;
- automatic relocation to a nearby valid position;
- recognition changes;
- persistent document schema changes.

## Completion gate

This correction is complete only when:

1. genuine RED evidence exists for the new core/store/browser contracts;
2. implementation reaches GREEN without weakening existing topology/opening validation;
3. existing unit, typecheck, lint, build and recognition benchmark gates remain green;
4. Chromium and representative WebKit browser acceptance are green on the exact head;
5. focused docs/changelog/PR tracker truth are synchronized;
6. product owner explicitly accepts the new room-translation scenarios;
7. PR #87 remains unmerged until that acceptance and the subsequent accepted-head gate.
