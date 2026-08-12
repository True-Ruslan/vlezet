# Vlezet — Open-Source Floor Planner Research

**Checked:** 2026-08-12  
**Purpose:** identify reusable engineering ideas, architecture patterns and implementation references without weakening Vlezet's domain guarantees or violating third-party licenses.

## 1. Research policy

Open-source projects are **engineering references, not drop-in architecture authorities**.

Before reusing code or a substantial implementation pattern:

1. verify the repository and exact source revision;
2. verify its license in the repository itself;
3. distinguish ideas/algorithms from copied code;
4. preserve required copyright/license notices for copied MIT-compatible material;
5. do not copy GPL/copyleft implementation into Vlezet unless the project deliberately adopts a compatible licensing strategy;
6. benchmark behavior through focused tests before replacing existing Vlezet geometry/editor-core code;
7. preserve Vlezet's authoritative boundaries: persistent document, millimetres, topology, hosted openings, M2 fit authority and semantic history.

A mature external implementation is evidence that a problem has been solved before; it is **not** evidence that its model is correct for Vlezet.

## 2. High-value references

### 2.1 `charmlinn/blueprint3d-modern`

Repository: https://github.com/charmlinn/blueprint3d-modern  
License: **MIT** (verified in repository).  
Stack: TypeScript, Three.js, Next.js demo, Zustand, IndexedDB.

Why it is especially relevant:

- unusually close to Vlezet's web/TypeScript/Three.js/local-persistence direction;
- explicit separation between model, 2D floorplanner, 3D renderer, item types and storage;
- wall/corner graph;
- 2D/3D toggle;
- furniture catalogue;
- room templates;
- item resize/rotate/lock;
- wall and in-wall item classes;
- material/texture selection;
- local IndexedDB project storage.

Important architectural ideas to inspect:

1. **Wall-bound item movement.** `WallItem` converts movement into wall-local coordinates, clamps the item to valid wall extents and converts back. This is a useful reference for Vlezet door/window drag, although Vlezet must keep `Opening.wallId` authoritative and must not silently re-host by nearest wall.
2. **Item taxonomy.** Floor, wall and in-wall item subclasses demonstrate how interaction behavior can follow semantic placement type rather than a generic transform object.
3. **2D/3D shared model.** The same floorplan model drives both projections, aligned with Vlezet's existing architecture principle.
4. **Catalogue/store separation.** Furniture catalogue growth does not need to contaminate geometry authority.
5. **Local project UX.** IndexedDB + thumbnail project list is a useful comparison with Vlezet's local-first project layer.

Do **not** inherit blindly:

- nearest-wall behavior if it permits surprising re-hosting;
- model structures that make rendered half-edges persistent interaction authority;
- generic item-validity rules that are weaker than Vlezet's M2/structural validation.

Verified source files/references:

- `README.md`
- `LICENSE`
- `src/items/wall_item.ts`
- `src/items/in_wall_item.ts`

### 2.2 `fedepaj/arcada-planner`

Repository: https://github.com/fedepaj/arcada-planner  
License: **MIT** (verified in repository).  
Stack: React, Konva/react-konva, Zustand, TypeScript, Vite.

Why it is relevant:

- close to Vlezet's 2D interaction stack;
- browser floor-plan editor with wall drawing, furniture, snapping, exact transforms, multiple floors, save/load and print;
- deliberately centralized manual hit-testing/drag state instead of relying fully on Konva's per-node gesture ownership.

Most useful idea:

> **central interaction arbitration before mutation**.

Its documented hit pipeline prioritizes handles, furniture, wall nodes and walls and then starts one explicit drag-state variant. This is directly relevant to the M8.2 regression where a selected `room + furniture` composite had no single gesture owner when drag began on a selected furniture member.

Vlezet should not copy Arcada's simplified document model or snapshot Undo stack. The reusable idea is the **centralized pointer-intent state machine**, not its geometry representation.

Other ideas worth benchmarking:

- visual grid independent from snap grid;
- explicit snap precision selection;
- manual rotated-rectangle hit testing;
- exact furniture size/rotation editing;
- multi-floor UX and print flow.

Verified source references:

- `README.md`
- `ARCHITECTURE.md`
- `LICENSE`

### 2.3 `cvdlab/react-planner`

Repository: https://github.com/cvdlab/react-planner  
License: **MIT** (declared in repository README).  
Stack: React ecosystem, Redux/immutable-era architecture, 2D→3D planner model, extensible catalogue/plugins.

Useful concepts:

- catalogue extensibility as a first-class API;
- properties/schema for configurable catalogue elements;
- plugin concepts for keyboard/autosave/debugging;
- 2D plan as a structured model rather than a bitmap composition;
- developer-supplied custom objects.

Caution:

The project is older and should not be used as a modern React architecture template. Study its domain/plugin/catalogue boundaries, not its runtime stack conventions.

### 2.4 `floorplanner/polygon-tools`

Repository: https://github.com/floorplanner/polygon-tools  
License: **MIT** (verified in repository).

Capabilities documented by the project:

- polygon area/centroid/winding;
- union/subtract/intersection;
- triangulation with holes;
- tesselation.

Why it matters:

Vlezet already owns geometry authority and must not replace working geometry code just because a library exists. However, this project is useful as:

- an algorithm/reference source for future polygon boolean operations;
- a differential-testing oracle candidate for non-authoritative test comparisons;
- an implementation reference for triangulation/holes if future complex room/export surfaces need it.

Adoption rule:

No geometry authority replacement without a benchmark corpus proving better correctness/performance and without regression coverage for Vlezet-specific epsilon/topology semantics.

## 3. Important behavior/reference project with license caution

### Sweet Home 3D

Website/source distribution: https://www.sweethome3d.com/  
License family: **GNU GPL** for the main application/source distribution.

Sweet Home 3D is valuable as a long-lived behavior and architecture reference for:

- wall/room/opening editing;
- large extensible furniture catalogue;
- simultaneous plan/3D mental model;
- blueprint/background import;
- materials/textures;
- object libraries;
- print/export and presentation workflows.

Because the main codebase is copyleft, Vlezet should treat it primarily as **behavioral/architectural inspiration**, not a source for copied implementation, unless licensing is reviewed explicitly for a future use case.

## 4. Reusable engineering patterns for Vlezet

### 4.1 Selection-aware gesture arbiter

Problem class:

- multiple selected semantic entity types;
- pointer starts on one member but should move the selected aggregate;
- nested/high-priority controls must still win.

Recommended Vlezet pattern:

```text
pointer down
→ resolve direct specialized handle/entity
→ inspect current semantic selection
→ choose exactly one gesture owner
→ begin one store/editor-core transaction
→ preview
→ commit/cancel once
```

Priority should be explicit and tested. Typical order:

1. transform/structural handles;
2. hosted-opening direct manipulation;
3. explicitly selected composite-member group movement;
4. direct entity movement/selection;
5. room interior group movement;
6. marquee/pan fallback.

The priority is a Vlezet product decision; external implementations are references only.

### 4.2 Host-local opening movement

Useful cross-project pattern:

```text
pointer world point
→ project to current host wall axis/local coordinates
→ clamp/propose offset
→ validate opening and collisions
→ preview
→ atomic commit
```

For the first Vlezet implementation:

- `wallId` remains unchanged during ordinary drag;
- no implicit nearest-wall switch;
- opening width/end clearances are respected;
- overlap/host invalidity is fail-closed;
- one drag = one semantic history entry.

Future explicit `Перенести на другую стену` behavior, if added, should be a separate intentional action.

### 4.3 Manual geometry hit-testing as an escape hatch

Arcada documents why relying on renderer hit canvases can become brittle in complex interaction stacks. Vlezet already has semantic geometry hit-testing for rooms and structural operations.

Rule:

Use renderer-native hit detection where simple and reliable, but keep deterministic geometry predicates for semantic selection where rendered node nesting/layering would otherwise decide product behavior accidentally.

### 4.4 Semantic object taxonomy

Blueprint3D's floor/wall/in-wall item separation reinforces a useful direction for Vlezet Furniture 2.0:

- free-standing floor object;
- wall-adjacent object;
- wall-hosted structural/opening-like object;
- sanitary/appliance objects with specialist clearance/connection semantics.

Do not encode this taxonomy purely as UI categories. If it affects placement/validation, it belongs in domain/editor semantics.

### 4.5 Catalogue scalability

Blueprint3D/react-planner show that catalogue data should be decoupled from document entity instances.

Vlezet direction:

- stable preset/catalogue IDs;
- parameterized physical defaults;
- placed instances remain ordinary `VlezetDocument` entities;
- catalogue search/category assets can evolve without document schema churn;
- user-imported assets require explicit persistence/versioning design before implementation.

### 4.6 Differential/reference testing

When an external MIT implementation solves similar geometry/placement behavior, it may be useful in tests as a **non-authoritative comparison**, especially for:

- polygon operations;
- wall-local projection;
- rotated rectangle hit/containment;
- triangulation.

A disagreement must be investigated; external output must never automatically override Vlezet's contract.

## 5. UI/UX study policy

Open-source code is often a better architecture reference than a polished UX reference. For interaction design:

- use RoomPlan / Planner 5D / Floorplanner / RoomSketcher / Planoplan as primary UX references;
- use open-source planners to understand how similar interactions can be implemented;
- prefer the best product behavior even if the easiest open-source implementation is weaker;
- record intentional deviations when Vlezet is stricter for structural safety.

## 6. Adoption ledger

For each material implementation inspired by an external project, add a short note in the active design/plan or focused changelog:

```text
External reference:
Observed behavior/pattern:
Why relevant:
What Vlezet adopts:
What Vlezet intentionally rejects:
License/copy status: idea only | adapted implementation | copied MIT-compatible fragment
Tests proving Vlezet contract:
```

This prevents accidental architectural drift and makes later license review possible.

## 7. Current M8.2 implications

The current selected-room-with-furniture drag failure is a strong example of where this research should affect design before code:

- current pointer ownership is split between room structural gesture and placed-object Konva drag;
- an explicitly selected mixed composite can therefore become visually selected but not directly draggable from a furniture member;
- the fix should introduce one selection-aware gesture decision rather than another isolated event workaround.

The requested door movement should likewise use host-local projection/validation rather than generic free-object dragging.

These corrections remain **product behavior work**, not a license-driven port of Arcada or Blueprint3D.

## 8. Future research candidates

Investigate when their roadmap dependency becomes active:

- robust polygon boolean/offset libraries for advanced export/zones;
- 2D→3D room mesh generation strategies;
- scalable GLTF/GLB furniture asset pipelines;
- floor/elevation/documentation generation;
- structured exchange formats such as DXF/FML/IFC only after Vlezet's schema/semantics are mature;
- mobile/RoomPlan/LiDAR capture as an optional source of editable geometry.

The default rule remains: **study first, specify Vlezet behavior second, write RED tests third, implementation last**.