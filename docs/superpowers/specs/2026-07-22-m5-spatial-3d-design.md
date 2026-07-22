# M5 Spatial 3D — Design

**Date:** 2026-07-22  
**Status:** Approved product direction / design frozen for planning  
**Branch:** `feat/m5-spatial-3d`

## 1. Problem

Vlezet now has a trusted 2D apartment model with millimetre geometry, physical wall thickness, derived rooms/areas, openings, furniture, import, assisted recognition, and explicit dimension semantics.

The next product step is spatial comprehension: let a non-CAD user see the same apartment in 3D without introducing a second geometry model or a second editor that can drift away from 2D.

The primary risk is architectural rather than visual. A fast Three.js implementation that rebuilds geometry inside React would make the renderer responsible for geometry decisions and create long-term divergence between 2D, 3D, fit logic, persistence and future AI planning.

## 2. Product goal

M5 must let a user switch from the trusted 2D plan to a clear spatial representation and answer:

- what the apartment shell looks like in space;
- whether walls, openings and furniture correspond to the same geometry seen in 2D;
- how rooms and furniture relate spatially;
- whether switching 2D ↔ 3D changes any project geometry.

Primary acceptance principle:

> The same `VlezetDocument` must deterministically produce both 2D and 3D representations with no hidden geometry drift and no second source of truth.

## 3. Architectural decision

### Chosen architecture: framework-independent spatial projection + thin Three.js renderer

Introduce a new package:

```text
packages/spatial
```

Data flow:

```text
VlezetDocument
      ↓
@vlezet/geometry + @vlezet/spatial
      ↓
neutral SpatialScene
      ↓
Three.js adapter/viewer in apps/web
```

`@vlezet/spatial` owns deterministic conversion from trusted apartment semantics into a renderer-neutral spatial scene description.

Three.js owns only:

- GPU meshes/materials;
- camera;
- controls;
- lighting;
- viewport lifecycle;
- rendering.

Three.js must not derive apartment truth that is unavailable to `@vlezet/spatial`.

## 4. Alternatives considered

### A. Framework-independent `@vlezet/spatial` + Three.js adapter

**Chosen.**

Pros:

- geometry/projection logic is unit-testable without WebGL;
- Three.js remains replaceable presentation infrastructure;
- preserves current package boundaries;
- future 3D exports, server-side geometry processing or alternate renderers can reuse the same scene model;
- future AI/planning continues to depend on `VlezetDocument`, not rendered meshes.

### B. Build meshes directly inside React/Three.js components

Rejected.

It would produce a faster demo but mix geometry policy, React lifecycle and WebGL. Exact wall/opening semantics would become difficult to test outside the browser and likely diverge from 2D.

### C. Start with React Three Fiber as the architectural centre

Rejected for the first M5 milestone.

R3F may be evaluated later as a rendering convenience, but it must not define the spatial model. The first implementation should prove deterministic projection before adding a richer React scene abstraction.

## 5. Coordinate and unit contract

Canonical document coordinates remain millimetres.

Spatial convention:

```text
document x → scene X
document y → scene Z
height     → scene Y
```

Rules:

- `@vlezet/spatial` uses millimetres directly;
- no implicit mm→m conversion in the domain/spatial projection;
- renderer camera/clipping parameters adapt to millimetre-scale scenes;
- optional renderer-only origin rebasing is allowed for numerical/render convenience only if all semantic coordinates remain unchanged and the transform is explicit;
- a top projection must preserve the same plan orientation rather than mirror the apartment.

This convention must be documented and covered by unit tests.

## 6. Persistent model policy

M5.1 introduces **no document schema migration**.

The existing document already contains authoritative horizontal geometry:

- vertices;
- wall centrelines;
- physical wall thickness;
- openings with host wall, offset and width;
- placed objects with position, width, depth, optional height and rotation.

Vertical properties not currently stored are presentation/projection policy, not silently persisted facts.

Initial constants live in `@vlezet/spatial`, not `VlezetDocument`:

```ts
DEFAULT_WALL_HEIGHT_MM = 2700
DEFAULT_OBJECT_HEIGHT_MM = 700
```

`DEFAULT_OBJECT_HEIGHT_MM` is used only when `PlacedObject.height` is absent and must be represented in the API as a defaulted projection value, never written back to the document.

A future schema migration for editable wall/opening heights is allowed only when the product exposes those values as explicit user-editable semantics.

## 7. Neutral spatial scene model

The first stable API should expose renderer-neutral readonly values similar to:

```ts
type Point3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

type SpatialWallSegment = Readonly<{
  id: string;
  wallId: string;
  startOffsetMm: number;
  endOffsetMm: number;
  center: Point3;
  lengthMm: number;
  thicknessMm: number;
  heightMm: number;
  rotationYRad: number;
}>;

type SpatialOpeningMarker = Readonly<{
  id: string;
  openingId: string;
  wallId: string;
  kind: "door" | "window";
  center: Point3;
  widthMm: number;
  wallHeightMm: number;
  rotationYRad: number;
}>;

type SpatialFloor = Readonly<{
  id: string;
  roomId: string;
  polygon: readonly Point3[];
}>;

type SpatialObject = Readonly<{
  id: string;
  objectId: string;
  name: string;
  center: Point3;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  rotationYRad: number;
  heightWasDefaulted: boolean;
}>;

type SpatialScene = Readonly<{
  wallSegments: readonly SpatialWallSegment[];
  openingMarkers: readonly SpatialOpeningMarker[];
  floors: readonly SpatialFloor[];
  objects: readonly SpatialObject[];
}>;
```

Exact names may be refined during implementation planning, but the separation of responsibilities is fixed:

- walls are deterministic spatial primitives;
- openings retain semantic identity;
- floors derive from room geometry;
- furniture preserves existing dimensions/rotation;
- no Three.js classes cross the package boundary.

## 8. M5.1 — Deterministic 3D shell

M5.1 is the first implementation milestone.

### Walls

Use existing topological wall endpoints and physical thickness.

For each wall:

1. resolve start/end world points;
2. derive opening-free visible intervals using the existing geometry opening contract;
3. project each visible interval to a rectangular wall prism;
4. preserve wall identity on every generated segment.

A wall segment length must exactly equal its corresponding 2D interval length.

Wall joins may overlap volumetrically at corners/T-junctions in the first implementation. Overlap is acceptable; visible gaps, dimensional drift or renderer-specific endpoint shortening are not.

This avoids premature constructive-solid-geometry/miter complexity while keeping the union of wall volumes geometrically faithful.

### Openings

The current document stores horizontal opening semantics but does not store authoritative sill/top/door height.

Therefore M5.1 must not invent construction dimensions.

Policy:

- opening width and horizontal position are authoritative;
- wall geometry is split horizontally around each opening, producing a full-height gap in the first shell projection;
- the gap receives a renderer-neutral semantic `SpatialOpeningMarker` preserving `door`/`window` identity;
- the web renderer visually distinguishes door/window markers and clearly treats them as schematic vertical placeholders;
- no default sill/door height is presented as authoritative project data.

Later vertical opening metadata can replace the placeholder policy without changing opening identity.

### Floors

Floors derive from existing deterministic room inner polygons.

`@vlezet/spatial` outputs floor polygons in X/Z at `Y = 0`.

Triangulation is a rendering concern for the first M5.1 implementation and may use Three.js `ShapeGeometry`, provided polygon coordinates come directly from the neutral scene model.

No separate persisted floor geometry is introduced.

### Shell bounds

Spatial bounds derive from the generated scene and are used for camera fitting.

Empty/partial documents must produce a valid empty scene rather than crash the viewer.

## 9. M5.2 — Furniture projection

Placed objects project from existing `PlacedObject` data:

```text
position.x → X
position.y → Z
width      → X extent
depth      → Z extent
height     → Y extent
rotation   → rotation around Y
```

Rules:

- `height` uses the stored value when present;
- missing height uses `DEFAULT_OBJECT_HEIGHT_MM` only as an explicit projection default;
- no 3D placement state is persisted separately;
- first renderer uses generic boxes/primitive geometry;
- catalogue-specific decorative 3D assets are out of scope;
- fit/collision status continues to come from existing deterministic logic, not mesh collisions.

## 10. M5.3 — Viewer, camera and 2D ↔ 3D switching

The web layer gets a dedicated `SpatialViewer` client component.

Rendering stack for the first milestone:

- plain Three.js;
- `OrbitControls`;
- dynamically/client loaded to avoid SSR/WebGL assumptions;
- no React Three Fiber dependency in the first slice.

Required camera behavior:

- orbit;
- pan;
- zoom;
- fit apartment;
- top preset;
- isometric preset;
- perspective/default preset.

2D/3D switching:

- switching view mode does not mutate `VlezetDocument`;
- no semantic history entry is created;
- autosave is not triggered solely by changing view mode;
- 2D editor state/history remains intact;
- 3D camera state may remain ephemeral for the first milestone.

## 11. M5.4 — Spatial inspection

After shell/viewer stability:

- hover/selection may expose semantic IDs for wall/room/object;
- dimensions shown in 3D must come from existing spatial/domain values;
- fit status comes from existing deterministic fit engine;
- no direct geometry editing in 3D for the first M5 milestone.

3D editing is intentionally deferred until a separate interaction design proves it can reuse semantic edit commands rather than create a second editing model.

## 12. Error handling and fail-closed rules

Projection must fail locally and diagnostically rather than corrupt project state.

Examples:

- missing wall vertex: report projection diagnostic for that entity and do not mutate document;
- invalid/non-finite geometry: skip/reject the affected primitive with a deterministic diagnostic;
- invalid room polygon: omit that floor and retain walls/other valid entities;
- WebGL unavailable: keep 2D editor fully usable and show a product-readable 3D-unavailable state;
- renderer initialization failure: never block project startup or autosave.

Optional 3D remains isolated in the same way recognition is isolated from core startup.

## 13. Performance policy

The first performance target is normal single-apartment projects, not city-scale scenes.

Design constraints:

- one neutral scene projection per relevant document change, memoized in the web layer;
- do not duplicate raster reference assets into 3D;
- do not create one React component/state store per primitive;
- renderer disposes geometries/materials/controls on teardown;
- wall primitives may initially be individual meshes, but architecture must permit later batching/instancing without changing `SpatialScene`;
- establish explicit browser budgets during implementation acceptance using a representative apartment.

No speculative LOD/CSG/worker architecture before measured need.

## 14. Testing strategy

### Framework-independent unit tests

`@vlezet/spatial` must cover:

- coordinate mapping: document `(x, y)` → scene `(x, 0, y)`;
- 3550 mm wall interval projects to exactly `3550` mm length;
- wall thickness is preserved exactly;
- wall rotation derives deterministically from endpoints;
- multiple openings split a wall into deterministic visible intervals;
- opening markers preserve ID/kind/width/position;
- room inner polygon becomes the same floor polygon in X/Z;
- placed object dimensions and rotation are preserved;
- missing object height is explicitly marked as defaulted;
- empty document produces empty scene;
- projection never mutates input document.

### Web tests

Cover pure helpers/component contracts where practical:

- 2D/3D mode switching is non-semantic UI state;
- switching view does not invoke document update/history operations;
- Three.js scene rebuild consumes only `SpatialScene` data;
- renderer cleanup disposes controls/resources.

### Regression gate

Every M5 code-bearing head must pass:

- frozen install;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

### Manual browser acceptance

Use a real apartment project and verify:

1. 3D opens without changing project geometry;
2. wall layout/orientation matches the 2D plan;
3. wall thickness is visibly consistent;
4. openings occur at the same horizontal positions/widths as 2D;
5. floors match detected rooms;
6. furniture position/size/rotation match 2D when M5.2 is included;
7. top/isometric/perspective navigation works;
8. repeated 2D ↔ 3D switching preserves document, selection/history semantics and save state;
9. reload remains deterministic;
10. M0–M4.6 workflows remain usable.

CI is not a substitute for browser visual acceptance.

## 15. First implementation boundary

The first implementation plan should deliver a coherent vertical slice:

```text
@vlezet/spatial package
→ deterministic walls/opening markers/floors
→ Three.js viewer
→ 2D/3D toggle
→ camera controls/presets
→ strict CI
→ browser acceptance
```

Furniture projection may be included immediately after the shell in the same PR if the shell architecture and CI remain stable; it must remain a separate implementation task and must not delay proving the deterministic shell.

## 16. Non-goals

Not in the first M5 milestone:

- photorealism;
- texture/material marketplace;
- ray tracing;
- generative interior rendering as geometry authority;
- detailed BIM/construction semantics;
- authoritative door/window sill/top heights without stored data;
- curved walls;
- multi-floor buildings;
- VR/AR;
- direct 3D geometry editing;
- physics-based collision as a replacement for the existing fit engine;
- separate 3D persistence model;
- React Three Fiber as a required architectural dependency.

## 17. Roadmap after M5

```text
M5.1 deterministic spatial shell
→ M5.2 furniture projection
→ M5.3 camera/navigation + stable 2D↔3D
→ M5.4 spatial inspection
→ M5 browser acceptance / merge
→ M6 Intelligent Planning
```

M6 must continue to consume structured `VlezetDocument` and deterministic constraints. Rendered 3D meshes and generated images never become planning authority.
