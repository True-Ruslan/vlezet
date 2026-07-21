# Vlezet — Product and Architecture Design

**Date:** 2026-07-21
**Status:** Approved product direction; implementation not started

## 1. Product vision

**Vlezet** is a precise, approachable apartment planning tool that helps a person answer a practical question before buying furniture or starting renovation work: **“Will it fit, and will the space still be comfortable?”**

The product should feel easier than CAD software and more trustworthy than a decorative room visualizer. Its core value is accurate spatial planning with real dimensions.

### Product promise

> Draw or import your apartment, place real-sized furniture and appliances, and immediately understand what fits, what collides, and how much usable space remains.

### Primary user

A non-professional apartment owner or buyer who:

- has a floor plan from a developer, realtor, or measurement;
- wants to reproduce the apartment accurately;
- wants to test furniture and appliance layouts before purchasing;
- cares about exact dimensions, passages, clearances, and room area;
- does not want to learn professional CAD/BIM software.

## 2. Product principles

1. **Precision before decoration.** Real dimensions and geometry are more important than photorealistic rendering.
2. **Simple before powerful-looking.** Common actions should be understandable without CAD knowledge.
3. **The domain model is the source of truth.** Canvas objects are only a projection of apartment data.
4. **Millimetres are the canonical unit.** Geometry is never stored in screen pixels.
5. **2D first, 3D later.** The first useful product is a strong 2D planner.
6. **Editable results, not dead images.** Imported, generated, or AI-assisted layouts must remain structured and editable.
7. **Local-first editing experience.** Editing must feel immediate; persistence and collaboration must not make pointer interactions dependent on network latency.
8. **YAGNI for the first release.** No billing, marketplace, BIM, VR, photorealistic rendering, or generative decoration until the planning core is excellent.

## 3. What Vlezet is not

Vlezet is not initially intended to be:

- AutoCAD or a professional architectural drafting system;
- BIM software;
- a construction documentation suite;
- a photorealistic interior renderer;
- a furniture marketplace;
- a renovation cost estimator;
- an AI image generator.

These areas may become integrations or later product layers, but they must not distort the first architecture.

## 4. First validated user journey

The first complete product journey is:

1. Create a project.
2. Open a large 2D workspace.
3. Draw apartment walls.
4. Enter or correct exact wall dimensions.
5. Add doors and windows.
6. Detect enclosed rooms and calculate their areas.
7. Add furniture and appliances with real dimensions.
8. Move, rotate, resize, duplicate, and delete objects.
9. Snap objects to useful geometric references.
10. Show distances and clearances.
11. Detect obvious collisions and unusable placements.
12. Save the project.
13. Reopen it without losing geometry.

The user should reach a useful answer without touching 3D.

## 5. MVP scope

### 5.1 Project workspace

- create and rename a project;
- one floor per project for the first MVP;
- persistent project state;
- autosave with explicit save status;
- deterministic project serialization.

### 5.2 Infinite 2D canvas

- pan;
- zoom around pointer position;
- adaptive grid;
- world coordinates independent from viewport coordinates;
- fit project to viewport;
- stable rendering at common desktop zoom levels.

### 5.3 Wall editing

- draw connected wall segments;
- create standalone wall segments;
- precise length entry;
- configurable wall thickness;
- move wall endpoints;
- snap endpoints to endpoints and grid;
- horizontal/vertical angle assistance;
- delete and split walls where needed by later openings logic.

Curved walls are explicitly outside the first MVP.

### 5.4 Doors and windows

- place an opening on a wall;
- set width;
- move along the host wall;
- door swing direction/orientation metadata;
- preserve a clear relationship between opening and host wall.

### 5.5 Rooms and area

- derive enclosed room polygons from wall topology;
- display calculated room area in square metres;
- allow room naming;
- recalculate deterministically after geometry changes.

Room polygons are derived data, not hand-maintained duplicates of wall geometry.

### 5.6 Furniture and appliances

- built-in starter catalogue of generic objects;
- custom rectangular object with name, width, depth, and optional height;
- drag;
- rotate;
- precise position/size editing;
- duplicate;
- delete;
- basic category metadata.

The first catalogue focuses on planning primitives rather than branded SKUs.

### 5.7 Measurement and fit feedback

- selected-object dimensions;
- distance to nearby walls/objects when useful;
- collision indication;
- simple clearance warnings;
- no claim that every warning is a building-code rule.

The product language should distinguish **hard collision** from **comfort recommendation**.

### 5.8 Editing ergonomics

- selection;
- multi-selection when justified by implementation stage;
- keyboard shortcuts;
- copy/paste;
- undo/redo;
- visible snapping guides;
- predictable escape/cancel behaviour.

## 6. Explicit non-goals for MVP

The following are deferred:

- automatic AI floor-plan recognition;
- PDF/image tracing workflow;
- 3D mode;
- photorealistic rendering;
- multi-user collaboration;
- mobile editing;
- multi-floor buildings;
- stairs;
- curved walls;
- electrical/plumbing plans;
- materials and finishes;
- renovation estimates;
- branded furniture marketplace;
- payment and subscription systems.

The architecture must not block these features, but no MVP code should be written solely for speculative future requirements.

## 7. Recommended technical architecture

### 7.1 Repository structure

Use a TypeScript monorepo with pnpm workspaces and Turborepo.

```text
vlezet/
├── apps/
│   └── web/
├── packages/
│   ├── domain/
│   ├── geometry/
│   ├── editor-core/
│   ├── ui/
│   └── config/
├── docs/
│   ├── superpowers/
│   │   ├── specs/
│   │   └── plans/
│   └── adr/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### 7.2 Web application

**Next.js + React + TypeScript**.

Responsibilities:

- application shell;
- project pages;
- editor composition;
- persistence API;
- future auth integration;
- deployment boundary.

The editor itself is a client-side application module and must not depend on server round-trips for pointer interactions.

### 7.3 Rendering

**Konva + react-konva** for the initial 2D canvas.

Konva is a rendering/input layer, not the domain model.

Recommended visual layering:

1. grid/background;
2. derived room fills;
3. walls;
4. openings;
5. furniture/appliances;
6. dimensions/measurements;
7. selection/snapping/debug overlays.

### 7.4 State

**Zustand** for editor/application client state.

Separate state categories:

- persistent project document;
- ephemeral editor state;
- viewport/camera state;
- current selection;
- active tool/mode;
- history/commands;
- UI state.

Ephemeral UI state must not pollute the serialized project document.

### 7.5 Domain model

`packages/domain` contains framework-independent TypeScript types and domain operations.

Canonical concepts:

```text
Project
└── Floor
    ├── Wall[]
    ├── Opening[]
    ├── PlacedObject[]
    └── Room metadata
```

Example direction, not a frozen API:

```ts
type Millimeters = number;

type Point2 = {
  x: Millimeters;
  y: Millimeters;
};

type Wall = {
  id: string;
  start: Point2;
  end: Point2;
  thickness: Millimeters;
};
```

Persistent entities use stable IDs. Derived geometry should be recomputable from persistent data.

### 7.6 Geometry engine

`packages/geometry` must remain independent from React, Konva, Next.js, and persistence.

Responsibilities:

- vector/segment math;
- distances;
- intersections;
- projections;
- point-on-segment calculations;
- polygons and area;
- transforms;
- snapping candidate calculations;
- collision primitives;
- room-boundary support.

This package receives the strongest unit-test coverage because geometry defects corrupt user trust.

### 7.7 Editor core

`packages/editor-core` coordinates domain operations for interactive editing without owning visual components.

Responsibilities:

- tools/modes;
- selection semantics;
- commands;
- undo/redo;
- snapping orchestration;
- document mutations;
- editor invariants.

React/Konva adapters translate pointer and keyboard input into editor-core commands.

### 7.8 Persistence

Start with a simple server persistence boundary suitable for a single-user MVP.

Recommended production direction:

- PostgreSQL;
- Prisma ORM;
- Zod validation at serialization/API boundaries.

The persisted project document should use an explicit schema version so future migrations are possible.

During the earliest editor milestone, local persistence may be used to reduce infrastructure scope, but the project format must already be serializable and versioned.

## 8. Source-of-truth rule

This is a non-negotiable architecture rule:

```text
Domain project document
        │
        ├──> 2D Konva projection
        ├──> future 3D projection
        ├──> export projection
        └──> future AI/input pipelines
```

Never persist `Konva.Rect`, `Konva.Line`, pixel coordinates, DOM measurements, or Three.js objects as the project model.

World geometry is stored in millimetres.

Viewport transform converts:

```text
world millimetres <-> screen pixels
```

This rule protects future 3D, import/export, AI planning, and collaboration features.

## 9. Command and history model

Undo/redo must be designed early rather than bolted on later.

Mutating user actions should map to explicit operations/commands, for example:

- `AddWall`;
- `MoveWallEndpoint`;
- `DeleteWall`;
- `AddOpening`;
- `MovePlacedObject`;
- `RotatePlacedObject`;
- `ResizePlacedObject`.

Pointer dragging may produce many visual updates, but history should normally commit one meaningful command at the end of a gesture rather than hundreds of history entries.

## 10. Snapping model

Snapping is a product-defining capability.

Initial priority:

1. grid;
2. wall endpoints;
3. horizontal/vertical alignment;
4. nearby object edges/centres where useful;
5. wall attachment for openings.

Snapping calculations belong in geometry/editor-core; snapping guides belong in rendering.

The system should expose the winning snap candidate and guide metadata so UI rendering does not need to reimplement geometry decisions.

## 11. Room detection strategy

Room detection is one of the technically risky areas and should not be hidden inside UI code.

Preferred direction:

- treat connected walls as a planar graph;
- derive closed boundaries/faces;
- calculate polygons and signed area;
- associate room metadata separately from derived geometry.

The first implementation may constrain valid wall topology to keep behaviour predictable. Unsupported/ambiguous topology should fail visibly rather than silently calculate a wrong area.

## 12. Fit and clearance semantics

Vlezet should model two distinct concepts:

### Collision

A geometric overlap or invalid placement that is objectively detectable.

Examples:

- furniture intersects another furniture footprint;
- furniture overlaps a wall footprint;
- an opening is outside its host wall.

### Recommendation

A configurable or heuristic comfort rule.

Examples:

- narrow passage;
- insufficient space in front of a cabinet;
- poor door clearance.

Recommendations must be presented as guidance unless backed by a clearly identified normative source.

## 13. Import roadmap

After the manual editor is reliable, add plan import:

### Phase 1: manual tracing

1. Upload PNG/JPEG/PDF plan.
2. Place it as a locked background reference.
3. Calibrate scale using one known dimension.
4. Trace walls with snapping.
5. Hide/remove the source image when complete.

### Phase 2: assisted recognition

Detect likely:

- walls;
- doors;
- windows;
- room labels/dimensions.

Recognition produces editable suggestions, never an opaque flattened result.

## 14. 3D roadmap

3D is a projection of the same domain model, not a second editor model.

Future stack direction: **Three.js**, potentially through React Three Fiber if React integration is beneficial at implementation time.

The first 3D release should focus on spatial comprehension, not photorealism.

## 15. AI roadmap

AI is useful only after reliable structured geometry exists.

Potential capabilities:

- suggest furniture layouts from user constraints;
- generate several editable planning alternatives;
- explain trade-offs;
- detect suspicious/awkward arrangements;
- assist floor-plan recognition.

AI outputs must resolve to normal domain entities with coordinates and dimensions.

Example conceptual output:

```json
{
  "objectId": "bed-1",
  "x": 1250,
  "y": 340,
  "width": 1800,
  "depth": 2000,
  "rotationDeg": 90
}
```

The LLM is never the geometry authority. Geometry validation remains deterministic.

## 16. Quality strategy

### Unit tests

Highest priority:

- geometry primitives;
- unit conversion;
- transforms;
- snapping;
- serialization/migrations;
- command history;
- room area/detection.

### Integration tests

Cover complete editor operations such as:

- draw a wall and undo it;
- move an endpoint and preserve connected geometry;
- add a door to a wall;
- save and reload a project;
- place an object and detect collision.

### Browser tests

Use Playwright for critical user journeys once the canvas interaction layer exists.

### Visual regression

Add only where it provides clear value. Geometry correctness must not rely solely on screenshots.

## 17. Error-handling principles

- Never silently corrupt project geometry.
- Invalid operations should be rejected or explicitly surfaced.
- Project schema validation happens at load/save boundaries.
- Unknown future schema versions fail safely.
- Autosave failures must be visible and retryable.
- Derived data can be rebuilt; persistent source data must be protected.

## 18. Milestones

### M0 — Foundation and Infinite Canvas

Deliverable: a technically sound editor shell.

- monorepo/tooling;
- Next.js application shell;
- domain/geometry/editor-core package boundaries;
- infinite canvas;
- pan/zoom;
- adaptive grid;
- world/screen transforms;
- first wall creation flow;
- exact wall length editing;
- basic snapping;
- undo/redo;
- automated tests for core math/history.

### M1 — Apartment Shell

- connected walls;
- wall editing;
- doors/windows;
- room detection;
- room naming and area;
- project serialization.

### M2 — Furnishing

- object catalogue;
- custom objects;
- selection/transform controls;
- dimensions;
- collision detection;
- clearance hints;
- copy/paste/duplicate.

### M3 — Usable Personal Product

- project list;
- persistence;
- autosave;
- polished editing ergonomics;
- onboarding/help;
- export/shareable image;
- first real apartment reconstructed end-to-end.

### M4 — Plan Import

- image/PDF source upload;
- scale calibration;
- tracing workflow;
- assisted recognition experiments.

### M5 — Spatial 3D

- deterministic 2D-to-3D projection;
- walls/openings/furniture visualization;
- camera/navigation;
- no separate 3D document model.

### M6 — Intelligent Planning

- constraint-based layout suggestions;
- AI-assisted alternatives;
- deterministic geometry validation;
- editable results.

## 19. First real acceptance case

Use a real apartment plan as the product benchmark rather than synthetic rectangles.

The first acceptance case should prove that a user can:

1. reproduce the apartment dimensions;
2. see correct room areas within an explicitly defined tolerance;
3. place kitchen, bedroom, storage, work-space, and living-room objects;
4. inspect clearances;
5. compare at least two layouts;
6. save and reopen the project unchanged.

This becomes the reference scenario for product decisions and regression testing.

## 20. Product language and identity

Brand: **Vlezet** (`vlezet`).

The tone should be direct and human rather than architectural or corporate.

Useful recurring product language:

- “Влезет?”
- “Влезет.”
- “Не влезет — не хватает 17 см.”
- “Проход: 84 см.”
- “Проверим другой вариант.”

The brand joke should support usability, not turn the interface into a meme.

## 21. Success criteria for the first public-quality version

A first-time user with a developer/realtor floor plan should be able to build a useful editable apartment model without reading documentation or learning CAD conventions.

The product is successful when the user can confidently answer practical purchasing/layout questions from the model:

- Will this sofa fit?
- Can a 180 cm bed fit with usable passages?
- Can two desks fit in this room?
- How much clearance remains after adding storage?
- Which of two layouts uses the space better?

## 22. Architectural invariants

These rules should be treated as project invariants unless an ADR deliberately replaces them:

1. TypeScript is the primary implementation language.
2. Millimetres are the canonical world unit.
3. Screen pixels are never persisted as apartment geometry.
4. Domain and geometry packages do not depend on React/Konva/Next.js.
5. Canvas/3D objects are projections, not source data.
6. Derived room geometry is recomputable.
7. Project documents are schema-versioned.
8. Undo/redo is command-oriented.
9. Pointer interactions remain local and low-latency.
10. AI suggestions never bypass deterministic geometry validation.

## 23. Next implementation step

After this design is reviewed, create a detailed implementation plan specifically for **M0 — Foundation and Infinite Canvas**. Do not plan the entire roadmap as one giant implementation batch.

M0 should end with a demonstrable editor where a user can pan/zoom, draw a wall in world coordinates, set its exact real-world length, receive basic snapping assistance, and undo/redo the operation.