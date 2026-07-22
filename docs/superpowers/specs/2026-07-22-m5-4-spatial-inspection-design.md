# M5.4 Spatial Inspection Design

**Date:** 2026-07-22  
**Status:** approved for implementation under delegated product/engineering autonomy

## Goal

Turn the existing read-only 3D projection into a useful inspection surface without creating a second geometry authority.

A user must be able to point at or select a room, wall, or placed object in 3D and see trusted information that already exists in `VlezetDocument`, `@vlezet/geometry`, and `@vlezet/spatial`.

## Product principles

1. 3D remains a projection of the same `VlezetDocument`.
2. Hover/selection state is ephemeral UI state only.
3. Three.js meshes are never measurement, fit, collision, or persistence authority.
4. Inspection must not mutate document/history/autosave state.
5. The first slice inspects rooms, walls, and placed objects only.
6. Openings remain visible semantic placeholders but are not independently inspected in this slice.
7. No decorative asset pipeline, direct 3D editing, or M6 planning/AI work is mixed into M5.4.

## Chosen architecture

```text
Three.js ray hit
      ↓
semantic userData → SpatialInspectionTarget
      ↓
ephemeral hovered / selected target
      ↓
resolve against VlezetDocument + SpatialScene
      ↓
@vlezet/geometry authoritative derivations
      ↓
read-only SpatialInspectionDetails
      ↓
compact inspector UI + visual emphasis
```

## Why this approach

### Rejected: derive information from mesh geometry

This would make renderer details a second authority and could drift from domain geometry.

### Rejected: persist 3D selection in the project/editor store

Selection is view-only interaction and must not create autosave/history noise or document migrations.

### Chosen: semantic IDs + pure resolver

Existing spatial primitives already carry stable semantic IDs in Three.js `userData`. A small pure inspection resolver can map these IDs back to authoritative domain/spatial data. The viewer owns only ephemeral hover/selection state.

## Inspection target contract

```ts
type SpatialInspectionTarget =
  | { kind: "room"; id: string }
  | { kind: "wall"; id: string }
  | { kind: "placed-object"; id: string };
```

Mapping rules:

- `userData.kind === "floor"` → room target using `roomId`;
- `userData.kind === "wall"` → wall target using `wallId`;
- `userData.kind === "placed-object"` → placed-object target using `objectId`;
- opening placeholders and unknown objects → no inspection target.

Wall segments sharing one `wallId` resolve to the same wall target.

## Read-only detail model

The inspector exposes a discriminated union.

### Room

- room name from derived room/annotation semantics;
- usable area from `deriveRooms`;
- clear rectangular width/length only when `deriveRectangularRoomDimensions` can determine them safely.

### Wall

- canonical wall ID;
- centreline length derived from authoritative wall endpoints;
- wall thickness from the domain wall;
- number of spatial segments shown after opening splits.

### Placed object

- object name/category;
- exact width/depth and stored height when available;
- rotation;
- existing deterministic fit status from `evaluateObjectFits`;
- existing diagnostic messages/reasons;
- projection-only height is labelled as such when `heightWasDefaulted` is true.

## Interaction

### Hover

Pointer movement raycasts against the spatial scene group. The nearest inspectable semantic entity becomes the hovered target.

Hover is lightweight and temporary. Pointer leave clears it.

### Selection

Click selects the currently hit inspectable target. Clicking empty space clears selection.

Selected target takes precedence over hover in the inspector. Hover may still visually emphasize another entity only when no selection is active in the first slice; this avoids competing emphasis states.

### Visual emphasis

Renderer resources expose an imperative `emphasize(target, mode)` method.

The renderer must not permanently mutate shared base materials. It temporarily clones only materials for matched inspectable meshes, applies emissive emphasis, and restores/disposes those temporary clones when emphasis changes or the viewer unmounts.

For a wall target all visible wall segments with the same `wallId` are emphasized together.

## Viewer state boundaries

`SpatialViewer` owns:

- `hoveredTarget`;
- `selectedTarget`;
- current camera preset;
- Three.js runtime references.

It does not write inspection state into `editorStore`.

`editorStore.history.document` remains read-only input to the projection and detail resolver.

## Error/fail-closed behavior

- Unknown/stale semantic ID resolves to `null` details rather than guessing.
- Missing room/wall/object data clears the inspector safely.
- Invalid plan fit results are surfaced through existing fit diagnostics.
- Raycasting failure must not affect 2D or document state.
- WebGL failure behavior remains unchanged.

## UI

A compact inspector card is positioned on the right side of the 3D viewport.

States:

1. no target: no inspector card;
2. hover target and no selection: preview card;
3. selected target: persistent card with a visible close/clear action.

Russian copy stays concise and factual.

Fit labels reuse existing semantics:

- `fits` → `Влезает`;
- `tight` → `Влезает вплотную`;
- `blocked` → `Не влезает`.

## Testing strategy

### Pure inspection tests

Test semantic target extraction and authoritative detail resolution without WebGL.

Required cases:

- floor maps to room target;
- wall segment maps to wall target;
- placed object maps to object target;
- opening placeholder is ignored;
- room details use derived usable area;
- wall details use canonical centreline length/thickness;
- object details reuse deterministic fit status and diagnostics.

### Renderer tests

- existing semantic `userData` remains intact;
- emphasis affects all segments of one wall target;
- emphasis does not affect unrelated entities;
- changing/clearing emphasis restores base materials;
- temporary highlight materials are disposed.

### Viewer acceptance

Manual browser acceptance on the representative apartment:

1. hover/select a room;
2. hover/select a wall;
3. hover/select each placed object;
4. verify shown values match trusted 2D/domain values;
5. verify fit status/reasons match existing fit logic;
6. switch 2D↔3D and confirm no document/history/autosave mutation;
7. verify camera controls still work.

## Acceptance criteria

- semantic hover/select works for rooms, walls, and placed objects;
- selected entity maps reliably to the same domain/spatial ID;
- displayed dimensions/area come from authoritative source values;
- furniture fit data comes from `evaluateObjectFits`;
- inspection interaction does not mutate `VlezetDocument`, history, or autosave state;
- 2D↔3D consistency and existing M5.1/M5.2 rendering remain intact;
- strict exact-head CI passes;
- real browser smoke acceptance passes before merge.
