# 2026-08-12 — Market benchmark and roadmap correction

**Status:** documentation/product-direction correction only; no production behavior is claimed by this record. M8.2 remains Draft and not product-accepted.

## Why

Product-owner testing of M8.2 exposed another interaction gap after the automated room-translation work:

- a `room + furniture` composite can be visibly selected, but dragging from an already selected furniture member does not move the whole selected composite;
- the interaction falls into split room/object gesture ownership instead of one selection-aware gesture;
- product-owner explicitly requested direct door movement at least within the current host wall;
- the supplied screenshot also exposed room-label density/overflow that can obscure dimensions and geometry;
- all other focused product-owner tests in that round were reported PASS.

Separately, RoomPlan was identified as a strong direct competitor and product reference. This triggered a broader market and open-source review so Vlezet does not design mature planner interactions in isolation.

## Root-cause truth for the current M8.2 failure

The current direct room gesture intentionally begins only from a free room-interior point and refuses a direct higher-priority Konva entity hit. `PlacedObjectShape` owns its own drag and stops Canvas propagation. The object gesture can batch-move only an all-placed-object selection, so a mixed `room + placed-object` selection has no single drag authority when the drag begins on the selected furniture.

This is a gesture-arbitration/product-contract problem, not evidence that structural room translation itself is broken.

M8.2 therefore remains **not accepted** despite earlier Chromium/WebKit GREEN evidence.

## Product benchmark research

A market review was performed against current official product material for:

- RoomPlan;
- Planner 5D;
- Floorplanner;
- RoomSketcher;
- Planoplan;
- RemPlanner;
- magicplan.

The review is captured in:

- `docs/product/COMPETITIVE_BENCHMARK.md`.

Main conclusions:

1. mature floor planners make direct manipulation an ordinary interaction, not a special-case inspector workflow;
2. manual editing remains the durable correction path even when AI/scan/import automation exists;
3. strong products pair 2D editing with a coherent 3D/presentation projection of the same plan;
4. catalogue/material breadth, export quality and walkthrough/presentation are established market expectations but must follow reliable core editing;
5. professional products differentiate further through technical documentation, structured export and field/mobile capture;
6. Vlezet should treat RoomPlan as a minimum practical interaction benchmark while selectively learning from deeper capabilities in Planner 5D, Floorplanner, RoomSketcher, Planoplan, RemPlanner and magicplan.

## Open-source engineering review

Open-source references were reviewed separately so architecture/code study is not confused with UX benchmarking.

Research is captured in:

- `docs/research/OPEN_SOURCE_FLOOR_PLANNERS.md`.

High-value references:

- `charmlinn/blueprint3d-modern` — MIT, TypeScript/Three.js/Next.js/Zustand/IndexedDB; useful wall-bound item, shared 2D/3D model and catalogue architecture reference;
- `fedepaj/arcada-planner` — MIT, React/Konva/Zustand/TypeScript; useful centralized hit/drag arbitration reference;
- `cvdlab/react-planner` — MIT; useful extensible catalogue/plugin/property concepts;
- `floorplanner/polygon-tools` — MIT; useful future polygon boolean/triangulation reference and possible differential-test oracle;
- Sweet Home 3D — valuable mature behavior/architecture reference, but main code is GPL and therefore not a default source for copied implementation.

## Adopted engineering policy

For material new editor behavior:

```text
market UX reference
→ open-source architecture/code study where relevant
→ explicit Vlezet behavior contract
→ license/adoption note
→ genuine RED
→ minimal Vlezet implementation
→ browser/engine regression
→ product-owner acceptance
```

Open-source code is never allowed to bypass Vlezet's authoritative boundaries:

- `VlezetDocument` persistent truth;
- canonical millimetres;
- derived rooms;
- validated host-wall openings;
- M2 fit/collision/door/clearance authority;
- atomic structural mutation;
- semantic history.

## Roadmap correction

### M8.2 — Direct Manipulation Foundation

M8.2 cannot close until ordinary selected-structure interaction matches mature editor expectations. Remaining product correction scope now includes:

- selection-aware gesture arbitration so dragging a selected `room + furniture` composite from a selected furniture member moves the complete selected composite;
- specialized handles/openings remain higher-priority than generic selected-group drag;
- direct door/window host-wall-constrained movement, with `wallId` stable by default and fail-closed validation;
- room label/dimension collision/overflow hardening for common selected-room states;
- focused deterministic/browser regressions for the exact product-owner path.

No M8.3 work starts before this correction is accepted and M8.2 is protected-merged.

### M8.3 — Precision Reference Calibration

Unchanged in principle. Market evidence reinforces its importance because background/blueprint tracing is a standard mature workflow and must be auditable before assistance is added.

### M8.4 — Assisted Tracing

Strengthened product rule: assisted/recognized geometry must become ordinary editable Vlezet geometry. AI/image assistance accelerates the editor and never replaces it.

### M8.5 — Furniture + Materials 2.0

Expanded direction:

- scalable parameterized household catalogue;
- broader appliance/sanitary coverage;
- direct physical resize/rotation and live dimensions;
- stronger snapping/alignment/distribution;
- material/texture groundwork;
- catalogue architecture separated from placed document instances;
- user asset import only after explicit persistence/versioning design.

### M8.6 — Export + Presentation

Expanded direction:

- PNG + SVG as core;
- PDF after vector/export authority is reliable if low risk;
- whole-plan and selection output;
- presentation visibility/style controls;
- reference/dimensions/furniture/zones controls;
- deterministic export independent of application theme;
- prepare architecture for later 3D/share output without blocking beta.

### Post-beta opportunity set

Evidence-supported later directions:

- richer 3D/walkthrough/presentation parity;
- multi-floor depth;
- professional wall elevations/specifications/renovation documentation;
- structured exchange such as DXF/FML/IFC only after schema maturity;
- mobile/LiDAR/RoomPlan-style capture as an optional editable-geometry input channel.

## Non-decisions

This research does **not** authorize:

- feature-count chasing;
- importing a competitor's UX wholesale;
- replacing Vlezet geometry with a third-party library without benchmark evidence;
- copying GPL code into the current project;
- moving automatic whole-plan recognition back into the beta critical path;
- delaying M8.2 interaction correctness for catalogue/rendering breadth.

## Next design gate

Before production code for the remaining M8.2 correction, the interaction contract must explicitly define one gesture owner for mixed selected composites and a separate host-wall opening drag contract. These changes require focused RED evidence before implementation and a new product-owner retest before M8.2 can be accepted.