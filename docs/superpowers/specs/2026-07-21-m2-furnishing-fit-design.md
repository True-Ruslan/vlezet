# M2 — Furnishing and Fit Design

**Date:** 2026-07-21  
**Status:** Approved through delegated product and engineering autonomy

## 1. Goal

M2 turns Vlezet from an apartment-shell editor into a practical furnishing planner. A user must be able to place real-sized furniture and appliances, move and rotate them, enter exact dimensions, and receive a trustworthy answer to the core product question:

> **Влезет ли предмет, и останется ли пространство удобным?**

The result must remain geometry-first. Furniture is persistent structured data in millimetres; Konva shapes are only a projection.

## 2. Product outcome

At the end of M2 a user can:

1. Open a compact generic furniture catalogue.
2. Choose a bed, sofa, wardrobe, table, chair, kitchen module or appliance.
3. Preview the object on the plan before placement.
4. Place it with real dimensions.
5. Drag, rotate, resize, duplicate and delete it.
6. Create an arbitrary custom rectangular object.
7. See exact width, depth, position and rotation.
8. See dimensions and nearby clearances on the canvas.
9. Immediately understand whether the placement:
   - **влезает**;
   - **влезает вплотную**;
   - **не влезает**.
10. See concrete reasons rather than only a coloured outline.

## 3. Scope decomposition

### M2.1 — Object model and catalogue

- schema v3;
- deterministic migration v2 → v3;
- persistent `PlacedObject` model;
- starter catalogue of generic planning presets;
- custom object preset;
- pointer-following placement preview;
- click-to-place as one semantic undoable operation;
- object selection and inspector.

### M2.2 — Object transforms and editing ergonomics

- drag objects directly on the canvas;
- one history entry per completed drag;
- rotation through a selected-object handle and exact inspector input;
- precise width/depth/position editing;
- duplicate;
- delete;
- keyboard shortcuts;
- snapping to grid and useful nearby object alignments;
- visible alignment guides.

### M2.3 — Fit, collisions, clearances and measurements

- oriented-rectangle geometry;
- object-object collision;
- room containment / wall collision;
- door-swing obstruction;
- functional clearance zones;
- three-state fit result;
- selected-object dimensions;
- directional clearances;
- readable diagnostics in the inspector and on canvas.

## 4. Persistent domain model

M2 introduces schema version 3.

```ts
type ObjectCategory =
  | "sleep"
  | "seating"
  | "storage"
  | "table"
  | "chair"
  | "kitchen"
  | "appliance"
  | "custom";

type ClearanceMargins = Readonly<{
  front: Millimeters;
  right: Millimeters;
  back: Millimeters;
  left: Millimeters;
}>;

type PlacedObject = Readonly<{
  id: string;
  presetId: string | null;
  name: string;
  category: ObjectCategory;
  position: Point2;
  width: Millimeters;
  depth: Millimeters;
  height?: Millimeters;
  rotationDeg: number;
  clearance: ClearanceMargins;
}>;

type VlezetDocumentV3 = Readonly<{
  schemaVersion: 3;
  vertices: readonly Vertex[];
  walls: readonly Wall[];
  openings: readonly Opening[];
  roomAnnotations: readonly RoomAnnotation[];
  placedObjects: readonly PlacedObject[];
}>;
```

### 4.1 Anchor convention

`position` is the **centre of the object footprint**.

This convention is mandatory because it makes rotation stable and predictable. Rotating an object does not translate it.

### 4.2 Local axes

At `rotationDeg = 0`:

- local width axis points right;
- local depth axis points down in the current world-coordinate convention;
- `front` is the positive local depth side;
- `right`, `back`, and `left` follow clockwise around the footprint.

### 4.3 Catalogue snapshot rule

The catalogue is an insertion aid, not persistent authority.

When a preset is placed, its critical properties are copied into `PlacedObject`:

- name;
- category;
- dimensions;
- optional height;
- clearance margins.

`presetId` is retained only for provenance and UI. Future catalogue changes must not silently alter existing projects.

## 5. Starter catalogue

The first catalogue uses generic planning primitives, not branded products.

| Preset | Width × depth | Default functional clearance |
|---|---:|---|
| Односпальная кровать | 900 × 2000 | sides 500, front 600 |
| Двуспальная кровать | 1600 × 2000 | sides 600, front 700 |
| Диван | 2200 × 900 | front 700 |
| Шкаф | 1600 × 600 | front 800 |
| Комод | 1000 × 500 | front 700 |
| Прикроватная тумба | 450 × 400 | none |
| Рабочий стол | 1400 × 700 | front 800 |
| Обеденный стол | 1400 × 800 | all sides 700 |
| Стул | 500 × 500 | back 600 |
| Кухонный модуль | 600 × 600 | front 900 |
| Холодильник | 600 × 650 | front 900 |
| Стиральная машина | 600 × 600 | front 700 |
| ТВ-тумба | 1600 × 450 | front 600 |
| Свой предмет | 1000 × 600 | none |

Clearance values are product recommendations, not building-code claims. UI copy must say “рекомендуемый зазор”, never “норма”, unless a future rule explicitly cites an authoritative source.

## 6. Object lifecycle and commands

All persistent mutations use semantic history operations.

Required command labels:

- `object/add`;
- `object/move`;
- `object/rotate`;
- `object/resize`;
- `object/update`;
- `object/duplicate`;
- `object/delete`.

Pointer gestures may update ephemeral previews many times, but only one history entry is committed when the gesture ends.

### 6.1 Placement

1. User selects a catalogue preset.
2. A semi-transparent object preview follows the pointer.
3. Preview uses the same geometry and fit engine as the final object.
4. A click creates the object.
5. The object becomes selected.
6. The editor returns to the selection tool.

A placement is allowed even when invalid. Vlezet must show **why it does not fit** instead of preventing the user from exploring alternatives.

### 6.2 Dragging

- Drag begins from a selected or directly grabbed object.
- Rendering updates immediately through ephemeral transform state.
- Snapping may adjust the preview.
- Drag end commits exactly one `object/move` operation.
- Escape cancels the in-progress gesture and restores the original transform.

### 6.3 Rotation

Rotation supports:

- a visible rotation handle;
- exact inspector value;
- quick `R` rotation by 90°;
- normalization to `[0, 360)` in persistent data.

Rotation snapping:

- 15° increments during handle rotation;
- stronger snap at 0°, 90°, 180°, 270°.

### 6.4 Resize

- Exact width and depth fields are authoritative.
- Transformer resize may be supported for selected objects.
- Width and depth must remain positive finite values.
- Minimum dimension is 50 mm; maximum dimension is 20,000 mm.
- Resizing commits one semantic operation.

## 7. Geometry model

`packages/geometry` remains framework-independent.

### 7.1 Oriented rectangle

Every object footprint is represented as four world-space corners derived from:

- centre position;
- width;
- depth;
- rotation.

Required primitives:

- `orientedRectangleCorners`;
- `orientedRectangleAxes`;
- `pointInOrientedRectangle`;
- `orientedRectanglesIntersect` using the separating-axis theorem;
- polygon/segment minimum distance;
- ray-to-polygon distance;
- local/world transform helpers.

Touching at exactly zero gap is not treated as geometric overlap, but it yields a zero clearance and therefore a tight result.

### 7.2 Room containment

An object is physically inside a room only when:

- all footprint corners are inside or on the usable room polygon;
- no footprint edge crosses the usable room boundary.

If no derived room fully contains the footprint, the object receives a hard `outside-room` diagnostic.

This is the first wall-collision authority. The fit engine must not depend on pixels or Konva hit testing.

### 7.3 Object collisions

Two object footprints produce a hard collision when their interiors overlap.

Diagnostics are emitted symmetrically and reference stable object IDs.

### 7.4 Door obstruction

A door opening produces a deterministic swing-sector polygon from:

- hinge endpoint;
- leaf width;
- opening side.

The sector is approximated by a fixed number of segments for deterministic tests.

Object overlap with the door leaf/swing area is a hard `door-obstructed` diagnostic because the door cannot operate normally.

Windows do not create a hard floor-footprint collision in M2.

### 7.5 Functional clearance zones

Clearance margins produce a larger asymmetric oriented rectangle around an object.

The zone excludes the object footprint itself and represents recommended operating space.

A recommendation is emitted when a required clearance zone intersects:

- another object footprint;
- the usable room boundary;
- a door swing area.

Clearance zones do not create hard collisions.

## 8. Fit result

Each object receives one aggregate result.

```ts
type FitStatus = "fits" | "tight" | "blocked";

type FitDiagnostic = Readonly<{
  code:
    | "outside-room"
    | "object-collision"
    | "door-obstructed"
    | "clearance-wall"
    | "clearance-object"
    | "clearance-door";
  severity: "collision" | "recommendation";
  objectId: string;
  relatedObjectId?: string;
  relatedOpeningId?: string;
  message: string;
}>;
```

Aggregation:

- any collision → `blocked`;
- no collision, at least one recommendation → `tight`;
- no diagnostics → `fits`.

Product labels:

- `fits` → **Влезает**;
- `tight` → **Влезает вплотную**;
- `blocked` → **Не влезает**.

Colours are supplemental:

- fits: green;
- tight: amber;
- blocked: red.

The textual label and reasons must always be available for accessibility and trust.

## 9. Measurements

### 9.1 Object dimensions

When selected, the canvas shows:

- width along the local width side;
- depth along the local depth side.

Labels remain in millimetres and rotate/reposition for readability rather than rotating text upside down.

### 9.2 Directional clearances

For the selected object, measure the nearest obstacle from each local side:

- front;
- right;
- back;
- left.

The measurement algorithm casts deterministic rays from three sample points on each side and returns the minimum positive intersection distance to:

- the containing room boundary;
- other object footprints;
- door swing polygons.

The UI may suppress very large distances at distant zoom levels but the underlying result remains available in the inspector.

## 10. Snapping

M2 object snapping priority:

1. nearby object edge alignment;
2. nearby object centre alignment;
3. room/wall inner boundary proximity;
4. grid;
5. unsnapped pointer position.

Snapping returns both the adjusted position and guide metadata. Rendering only displays guides; it never recalculates the winning snap.

Snap tolerance is screen-derived and converted to world millimetres, preserving consistent pointer feel across zoom levels.

## 11. Editor UI

### 11.1 Workspace layout

Desktop M2 layout:

```text
┌──────────────────────── top toolbar ────────────────────────┐
│ catalogue │                 canvas                 │ inspector│
└─────────────────────────────────────────────────────────────┘
```

- left catalogue: approximately 250 px;
- right inspector: approximately 320 px;
- canvas keeps the remaining width;
- panels may collapse at narrower desktop widths;
- mobile editing remains out of scope.

### 11.2 Catalogue

The catalogue contains:

- a clear “Мебель и техника” heading;
- compact category groups;
- preset name and dimensions;
- simple semantic thumbnails;
- a `Свой предмет` entry.

Clicking an entry activates placement mode. HTML drag-and-drop is intentionally not required for M2 because click-preview-click is more predictable across browser input devices.

### 11.3 Canvas rendering

Layer order becomes:

1. grid;
2. room fills;
3. walls;
4. openings;
5. placed objects;
6. selected-object clearance zones;
7. dimensions and measurements;
8. transformer, snapping and diagnostic overlays.

Furniture should remain visually quiet and legible. It must not imitate photorealistic top-down rendering.

### 11.4 Inspector

Selected object inspector includes:

- name;
- category;
- fit badge;
- diagnostic reasons;
- X/Y centre position;
- width;
- depth;
- optional height;
- rotation;
- four recommended clearance margins;
- duplicate action;
- delete action.

Changes through inspector fields commit on Enter or an explicit Apply action.

## 12. Selection and shortcuts

Selection is mutually exclusive across walls, rooms, openings and placed objects.

Required shortcuts:

- `V` — selection tool;
- `W` — wall tool;
- `D` — door tool;
- `O` — window tool;
- `F` — open/focus furnishing catalogue;
- `R` — rotate selected object 90°;
- `Ctrl/Cmd + D` — duplicate selected object;
- `Delete` / `Backspace` — delete selected object;
- `Escape` — cancel placement/gesture, otherwise return to selection;
- existing undo/redo shortcuts remain unchanged.

Shortcuts do not fire while editing text fields, except Escape.

## 13. Error handling

- Invalid numeric inspector input is rejected without mutating the document.
- Geometry functions reject NaN, Infinity and non-positive dimensions.
- Invalid apartment topology suppresses authoritative room containment, and furniture receives a clear “Планировка содержит ошибку” state rather than misleading fit feedback.
- Missing preset IDs never break existing objects because placed objects contain complete geometry snapshots.
- Orphaned selected IDs are cleared after undo/redo.

## 14. Testing strategy

### Domain tests

- schema v3 empty document;
- v2 → v3 migration;
- exact placed-object preservation;
- dimension and rotation validation.

### Geometry tests

- rotated corners at 0°, 45°, 90°;
- SAT overlap and exact-touch behaviour;
- concave room containment;
- object-object collisions;
- door swing obstruction;
- asymmetric clearance zones;
- directional clearance rays;
- deterministic snapping priority.

### Editor-core tests

- add/update/move/rotate/resize/duplicate/delete;
- one history entry per semantic operation;
- undo/redo restores exact geometry;
- duplicate offsets object predictably;
- invalid values do not mutate state.

### Web store tests

- catalogue placement commits one object;
- selection is mutually exclusive;
- drag preview does not create history;
- drag end creates one history entry;
- rotation shortcut and duplication;
- fit status updates after transforms.

### Browser acceptance

- furnish one room with a double bed, wardrobe and desk;
- deliberately create collision and see a concrete blocked reason;
- resolve collision and see fit status update;
- create a tight wardrobe-front clearance warning;
- drag/rotate/resize/duplicate/delete;
- undo and redo each operation;
- create and edit a custom object.

## 15. Non-goals

M2 does not include:

- branded product SKUs or marketplace links;
- textures or photorealistic furniture;
- 3D furniture models;
- automatic layout generation;
- multi-selection/grouping;
- accessibility/building-code certification;
- persistence/autosave infrastructure;
- import/export;
- freeform non-rectangular custom objects.

These remain later milestones.

## 16. Acceptance gate

M2 is complete only when:

1. a real apartment shell can be furnished end-to-end;
2. every object remains persistent structured millimetre geometry;
3. all transforms are undoable as semantic operations;
4. collisions and recommendations are deterministic and explainable;
5. the final clean CI run passes frozen install, unit tests, typecheck, lint and production build;
6. manual browser acceptance confirms placement, transforms and fit feedback feel predictable.
