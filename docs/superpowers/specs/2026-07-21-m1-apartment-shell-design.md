# M1 — Apartment Shell Design

**Date:** 2026-07-21
**Status:** Approved design direction; implementation not started

## 1. Goal

Turn Vlezet from a wall-sketching canvas into a real apartment-shell editor that understands connected topology, enclosed rooms, usable interior area, doors, and windows.

M1 must support a practical homeowner workflow:

1. draw the apartment shell;
2. connect external and internal walls reliably;
3. close rooms;
4. see calculated usable room area;
5. name rooms;
6. place doors and windows on host walls;
7. edit dimensions without silently breaking topology.

The implementation must remain understandable to a non-CAD user and must preserve the architecture established in M0: domain data is the source of truth, geometry is deterministic, and Konva is only a projection.

## 2. Product principles for M1

1. **Physical meaning over drawing convenience.** A wall is not just a line; it has thickness, connectivity, and openings.
2. **Connected means actually connected.** Shared junctions must be represented in the model, not inferred from coincident pixels.
3. **Rooms are derived.** Room polygons and area come from wall topology and thickness; users never manually draw room polygons.
4. **Usable area means interior usable area.** Area is calculated from the inner finished boundary represented by wall geometry, not from wall centre-lines.
5. **No silent geometry corruption.** Unsupported intersections or ambiguous topology must be visible and actionable.
6. **Consumer-first UX.** Common apartment operations should work through snapping and direct manipulation without requiring CAD concepts.
7. **Stable semantic entities.** User-created walls remain meaningful wall runs even when topology requires derived subdivisions.

## 3. Scope

### 3.1 Included

- explicit vertices and connected wall topology;
- wall runs with internal junctions;
- T-junctions;
- closed-face room detection;
- inner usable-room polygons;
- room area in square metres;
- room naming/annotation;
- editable wall thickness;
- doors hosted by walls;
- windows hosted by walls;
- opening width and position;
- door hinge/swing metadata and 2D swing visualization;
- validation for unsupported crossings and invalid openings;
- schema migration from M0 document version 1;
- undo/redo for new semantic operations;
- rendering of physical wall thickness rather than centre-line-only walls.

### 3.2 Explicit non-goals

Deferred beyond M1:

- automatic X-intersection resolution;
- curved walls;
- columns and free-standing structural objects;
- stairs;
- wall layers/material assemblies;
- ceiling heights and complex vertical geometry;
- sloped walls in the vertical dimension;
- building-code compliance engine;
- branded doors/windows;
- multi-floor projects;
- AI recognition/import;
- furniture.

## 4. Architecture

```text
Persistent domain document
  ├── Vertex[]
  ├── Wall[]
  ├── Opening[]
  └── RoomAnnotation[]
          │
          ▼
Geometry derivation
  ├── atomic wall edges
  ├── planar topology
  ├── bounded centre-line faces
  ├── inner usable polygons
  └── topology diagnostics
          │
          ▼
Derived editor model
  ├── rooms + area
  ├── wall render segments
  ├── opening geometry
  └── validation overlays
          │
          ▼
Konva rendering / interaction
```

No derived room polygon, wall footprint, Konva node, or screen coordinate becomes persistent source data.

## 5. Domain schema v2

M1 introduces document schema version 2.

Conceptual API:

```ts
type Millimeters = number;

type Point2 = Readonly<{
  x: Millimeters;
  y: Millimeters;
}>;

type Vertex = Readonly<{
  id: string;
  position: Point2;
}>;

type Wall = Readonly<{
  id: string;
  startVertexId: string;
  endVertexId: string;
  junctionVertexIds: readonly string[];
  thickness: Millimeters;
}>;

type OpeningKind = "door" | "window";

type DoorSwing = Readonly<{
  hinge: "start" | "end";
  side: "left" | "right";
}>;

type Opening = Readonly<{
  id: string;
  wallId: string;
  kind: OpeningKind;
  offset: Millimeters;
  width: Millimeters;
  doorSwing?: DoorSwing;
}>;

type RoomAnnotation = Readonly<{
  id: string;
  name: string;
  anchor: Point2;
}>;

type VlezetDocumentV2 = Readonly<{
  schemaVersion: 2;
  vertices: readonly Vertex[];
  walls: readonly Wall[];
  openings: readonly Opening[];
  roomAnnotations: readonly RoomAnnotation[];
}>;
```

The concrete implementation may refine names, but these semantics are fixed by this spec.

## 6. Why walls remain wall runs

A long user-created wall must remain one semantic wall even when an interior partition joins it.

Example:

```text
A ─────────────── B
        │
        C
```

The horizontal wall remains one persistent `Wall(A, B)`.

The T-junction vertex is recorded in `junctionVertexIds` and the geometry engine derives atomic edges:

```text
A ───── J ───── B
        │
        C
```

This avoids a poor consumer experience where placing a partition unexpectedly turns one wall into several unrelated selectable walls.

It also gives openings a stable host: an opening references the semantic wall run and an offset along that run, not a temporary derived segment.

## 7. Topology rules

### 7.1 Vertex identity

Two visually coincident points are not automatically considered the same topological point unless the editor operation intentionally merges/snaps them.

When wall drawing snaps to an existing vertex, the new wall reuses that vertex ID.

### 7.2 T-junctions

When a wall endpoint snaps to the interior of another wall:

1. create or reuse a junction vertex at the snapped world position;
2. use that vertex as the endpoint of the joining wall;
3. add that vertex to the host wall's `junctionVertexIds`;
4. derive two atomic host edges around the junction.

T-junction creation is one semantic undoable command.

### 7.3 Internal junction ordering

`junctionVertexIds` are semantic membership, not trusted geometric ordering.

The geometry engine orders start, internal junctions, and end by projected distance along the wall centre-line every time it derives atomic edges.

### 7.4 Junction validity

Every internal junction vertex must lie on its host wall centre-line within the domain geometry tolerance.

A junction outside tolerance is invalid topology and must be surfaced rather than silently projected during load.

Interactive editor commands may intentionally project a user's snapped point onto the host wall before committing the valid junction.

### 7.5 Crossings

An undeclared X-crossing is unsupported in M1.

If two wall runs cross away from their registered vertices/junctions:

- room derivation for the affected topology is rejected;
- the crossing is visibly highlighted;
- the application must not invent connectivity silently.

Future functionality may offer “Create junction” to convert the crossing into an explicit shared topology node.

## 8. Wall editing semantics

### 8.1 Exact wall length

M0's deterministic rule remains:

- start vertex is the anchor;
- wall direction is preserved;
- end vertex moves to satisfy the exact length.

Internal junction vertices keep their absolute distance from the anchored start when the wall is extended or shortened along the same direction.

If shortening would place the end before an existing internal junction/opening extent, the operation is rejected with a clear message instead of reordering or deleting geometry.

### 8.2 Wall thickness

Wall thickness is editable per wall in millimetres.

Validation:

- finite;
- positive;
- constrained to a practical editor range chosen during implementation to prevent degenerate rendering/geometry.

Changing thickness recalculates room usable polygons and area but does not change centre-line topology.

### 8.3 Moving vertices

M1 should support moving shared vertices where the interaction can be made predictable.

Moving a vertex updates every wall endpoint that references it.

For a vertex registered as an internal junction on a host wall, the editor must preserve the on-wall constraint. Direct free movement that would detach it is not allowed.

## 9. Geometry derivation pipeline

### 9.1 Atomic wall edges

Each semantic wall run is expanded into atomic edges between consecutive ordered points:

```text
start -> junction* -> end
```

Each atomic edge carries:

- source `wallId`;
- start/end `vertexId`;
- thickness;
- parametric interval along the source wall.

These edges are derived only.

### 9.2 Planar graph

Atomic edges form the planar graph used for room detection.

Required invariants before face extraction:

- no undeclared crossings;
- no zero-length atomic edges;
- junctions lie on their host walls;
- referenced vertices/walls exist;
- no duplicate atomic edge with identical endpoints and source semantics.

### 9.3 Face detection

Use directed half-edge traversal (or an equivalent deterministic planar-face algorithm) to discover bounded faces from connected wall centre-lines.

The unbounded exterior face is excluded.

Derived face identity must be deterministic for identical document input.

## 10. Usable interior room geometry

Room area must represent usable interior space, not centre-line area.

For every bounded centre-line face:

1. determine traversal orientation;
2. offset each boundary edge toward the interior by half of that source wall's thickness;
3. resolve adjacent offset-edge joins deterministically;
4. create a valid inner polygon;
5. calculate area from that inner polygon.

This supports different thicknesses on different walls.

### 10.1 Geometry requirements

- straight wall segments only;
- convex and concave simple room faces must be handled;
- degenerate offsets that collapse a room are reported as invalid;
- self-intersecting usable polygons are rejected, never shown with a fabricated area;
- numerical tolerance is centralized in `packages/geometry`, not duplicated in UI code.

### 10.2 Area display

Canonical geometry remains millimetres.

Display area in square metres, normally to two decimal places:

```text
Спальня
13.42 м²
```

Internal calculations retain higher precision; display rounding must not mutate stored/derived geometry.

## 11. Room annotations and identity

Room geometry is derived and must not be persisted as a polygon.

User-authored room information is stored separately as `RoomAnnotation` with a world-space anchor point.

When rooms are derived:

- an annotation belongs to the room whose usable polygon contains its anchor;
- the annotation provides the room name;
- an unassigned room receives a generated display label such as `Комната 1` without requiring persistent metadata;
- an annotation whose anchor is no longer inside any room becomes an orphan diagnostic instead of being silently attached to a different room.

When a user renames a derived room for the first time, create/update an annotation anchored at a robust interior point of the usable polygon.

This keeps room naming stable through ordinary wall resizing without persisting duplicate room geometry.

## 12. Openings

### 12.1 Host relationship

Every opening belongs to exactly one semantic wall run by `wallId`.

Position is measured as `offset` from the wall's start vertex along the wall centre-line.

This makes openings stable even when T-junctions subdivide the wall into derived atomic edges.

### 12.2 Validation

For an opening to be valid:

- host wall exists;
- width is finite and positive;
- offset is finite and non-negative;
- `offset + width <= wallLength` within tolerance;
- openings on the same wall do not overlap;
- an opening may not straddle an internal T-junction in M1.

Invalid opening edits are rejected before document mutation.

### 12.3 Doors

Door representation includes:

- width;
- offset;
- hinge at opening start or end;
- swing side relative to the host wall direction.

2D rendering shows:

- wall gap;
- door leaf;
- swing arc.

The swing arc is planning information and later becomes useful for collision/clearance checks.

### 12.4 Windows

Window representation includes:

- width;
- offset.

M1 2D rendering shows a conventional clear window symbol in the wall opening.

Vertical attributes such as sill height are deferred until a feature needs them, but the model must remain extensible.

## 13. Wall and opening rendering

M1 stops representing a wall as only a thin centre-line.

Wall visual thickness must reflect real wall thickness at current scale.

Rendering layers:

1. grid/background;
2. room fills;
3. wall bodies;
4. openings;
5. wall centre-lines/vertices only as editing overlays when useful;
6. room labels;
7. selection/snapping/validation overlays.

Openings create true visual gaps in wall bodies rather than drawing decorative symbols over an unbroken wall.

## 14. Editor UX

### 14.1 Wall tool

Consumer-first behavior:

- click empty space -> new vertex/start wall;
- click existing vertex -> connect to that vertex;
- click/snap onto wall interior -> create T-junction;
- continue drawing connected wall chain;
- click starting vertex to close a contour;
- `Esc` cancels current draft without mutating history.

The UI should make snap intent visible before commit.

### 14.2 Room feedback

As soon as valid topology creates an enclosed room:

- subtle room fill appears;
- name and area appear near a robust interior label point;
- no explicit “calculate rooms” button is required.

Room derivation should be local and responsive for normal apartment-size documents.

### 14.3 Door/window tools

Toolbar adds `Дверь` and `Окно`.

User flow:

1. choose tool;
2. hover a wall and see projected placement preview;
3. click to place at a default practical width;
4. edit exact offset/width and door orientation in inspector.

Placing on empty canvas is not allowed.

### 14.4 Selection/inspector

Selecting:

- wall -> length, thickness and topology summary;
- opening -> type, width, offset and orientation;
- room label/fill -> room name and calculated area.

The inspector should use homeowner language rather than graph/topology terminology.

## 15. Commands and undo/redo

New mutations remain semantic commands.

Expected command families:

- `vertex/move`;
- `wall/add-connected`;
- `wall/add-t-junction`;
- `wall/set-length`;
- `wall/set-thickness`;
- `opening/add`;
- `opening/update`;
- `opening/delete`;
- `room-annotation/set-name`.

A user action that creates a T-junction plus a joining wall is one history entry, not several implementation-detail entries.

Derived rooms never appear in history because they are recomputed from the persistent document.

## 16. Schema migration from M0

M0 schema v1 stores each wall with inline start/end coordinates.

The v1 -> v2 migration must be deterministic:

1. collect all wall endpoints;
2. merge endpoints only when coordinates are exactly equal according to the serialized v1 model (do not introduce proximity-based topology during migration);
3. create stable v2 vertices for unique endpoint positions;
4. convert walls to vertex references;
5. set `junctionVertexIds = []`;
6. initialize `openings = []` and `roomAnnotations = []`;
7. output `schemaVersion: 2`.

Migration must preserve wall dimensions exactly.

Proximity snapping remains an interactive user operation, not a hidden migration behavior.

## 17. Error handling and diagnostics

M1 introduces explicit geometry diagnostics.

Examples:

- undeclared wall crossing;
- junction not on host wall;
- zero-length wall/edge;
- collapsed usable room polygon;
- self-intersecting derived polygon;
- opening outside wall bounds;
- overlapping openings;
- opening crossing a T-junction;
- orphan room annotation.

Diagnostics have severity:

- **error:** prevents a derived result or mutation from being treated as valid;
- **warning:** geometry remains valid but user attention is useful.

Errors must be visible near the affected geometry when possible and summarized in the UI without blocking unrelated editing.

## 18. Testing strategy

### 18.1 Domain tests

Cover:

- schema v1 -> v2 migration;
- exact coordinate preservation;
- wall/opening invariants;
- semantic command inversion.

### 18.2 Geometry tests

Highest priority:

- atomic-edge derivation;
- ordered T-junctions;
- undeclared crossing detection;
- half-edge face extraction;
- outer-face exclusion;
- concave rooms;
- variable wall thickness;
- usable interior offsets;
- area calculation;
- point-in-polygon for room annotations;
- opening intervals along walls.

Use exact synthetic fixtures with known expected geometry and area.

### 18.3 Editor-core tests

Cover complete semantic operations:

- draw connected walls;
- close a contour;
- create/undo/redo a T-junction;
- reject invalid wall shortening;
- add/update/delete opening;
- preserve opening host across junction subdivision;
- rename room through annotation.

### 18.4 Browser acceptance

Critical journeys:

1. draw a rectangular room and see area;
2. add a partition from one wall to another and get two rooms;
3. change wall thickness and see area update;
4. place a door and change swing;
5. place a window;
6. undo/redo topology and openings;
7. create an invalid crossing and see a clear diagnostic instead of a fake room.

## 19. Acceptance scenarios

### Scenario A — simple room

Create four connected walls forming a rectangle.

Expected:

- one room detected;
- walls display real thickness;
- inner usable polygon is visible through room fill;
- area equals the interior dimensions implied by centre-lines and wall thickness within defined numerical tolerance.

### Scenario B — apartment partition

Add an internal wall whose endpoints snap to interiors of two opposite host walls.

Expected:

- two T-junctions created explicitly;
- host walls remain semantic wall runs;
- two rooms detected;
- each room has correct usable area;
- undo removes the partition and both junction memberships as one operation.

### Scenario C — opening stability

Add a door to a long wall, then add a T-junction elsewhere on the same wall.

Expected:

- door still references the same wall ID and remains at the same offset;
- room topology uses derived atomic wall edges;
- opening does not drift or become re-hosted.

### Scenario D — real apartment readiness

The editor must be capable of reconstructing the shell of the user's real apartment with:

- external contour;
- internal partitions;
- doors;
- windows;
- named rooms;
- believable usable room areas.

This scenario becomes the benchmark before moving to furniture in M2.

## 20. Implementation decomposition

M1 should be implemented in three reviewable sub-milestones.

### M1.1 — Topological Walls

- schema v2 + migration;
- vertices;
- semantic wall runs;
- junctions/T-junctions;
- atomic-edge derivation;
- topology diagnostics;
- wall thickness rendering/editing;
- connected-wall UX.

### M1.2 — Rooms

- planar face detection;
- usable interior polygons;
- area calculation;
- room fills/labels;
- room annotations/naming;
- invalid-room diagnostics.

### M1.3 — Openings

- opening domain model;
- door/window tools;
- wall interval validation;
- physical wall gaps;
- door swing/window rendering;
- inspectors and undo/redo.

Each sub-milestone must finish with a working, testable editor state. Do not batch all M1 implementation into one giant unreviewed change.

## 21. Architectural invariants added by M1

1. Wall runs remain stable semantic entities; topology subdivision is derived.
2. Shared connectivity uses explicit vertex identity.
3. T-junctions are explicit and undoable.
4. Undeclared X-crossings never silently create topology.
5. Rooms are derived from wall topology.
6. Room area is calculated from usable inner wall boundaries.
7. Persistent room data is annotation metadata, not duplicated polygons.
8. Openings reference semantic wall runs by `wallId + offset`.
9. Openings remain stable across derived wall subdivision.
10. Geometry errors are surfaced; invalid geometry never produces authoritative fake area.

## 22. Definition of done for M1

M1 is complete when a first-time user can reconstruct a realistic apartment shell using connected walls, internal partitions, doors, and windows, while Vlezet automatically derives rooms and usable areas accurately enough to trust for furniture-planning decisions in M2.

The benchmark is not visual polish alone. The same saved document must produce deterministic topology, room polygons, areas, and opening positions after reload/recomputation.
