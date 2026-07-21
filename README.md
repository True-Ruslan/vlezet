# Vlezet

**Vlezet** is a precise, approachable apartment planner for answering a practical question before buying furniture or starting renovation work: **will it fit?**

The product is designed for people who want to reproduce a real apartment with exact dimensions, arrange furniture and appliances at real scale, inspect clearances, and compare layouts without learning professional CAD software.

## Product direction

The first product is a strong 2D planner:

1. Create an apartment project.
2. Draw walls using real dimensions.
3. Add doors and windows.
4. Detect rooms and calculate area.
5. Place furniture and appliances at real size.
6. Measure clearances and detect collisions.
7. Save, reopen, and iterate on layouts.

3D, plan recognition, and AI-assisted layouts are later layers built on top of the same structured apartment model.

## Core architecture principles

- TypeScript-first.
- Millimetres are the canonical world unit.
- The domain model is the source of truth; Canvas/3D objects are projections.
- Geometry stays independent from React, Konva, and Next.js.
- 2D editing comes before 3D rendering.
- Undo/redo, snapping, serialization, and deterministic geometry are first-class concerns.

## Roadmap

- **M0 — Foundation and Infinite Canvas:** editor shell, pan/zoom, grid, world coordinates, wall drawing, exact length, snapping, undo/redo.
- **M1 — Apartment Shell:** connected walls, doors/windows, room detection and area.
- **M2 — Furnishing:** furniture catalogue, custom objects, measurements, collisions, clearance hints.
- **M3 — Usable Personal Product:** persistence, autosave, polished UX, export, first real apartment end-to-end.
- **M4 — Plan Import:** image/PDF calibration and tracing, followed by assisted recognition.
- **M5 — Spatial 3D:** deterministic 3D projection of the 2D model.
- **M6 — Intelligent Planning:** editable AI-assisted layout suggestions with deterministic geometry validation.

## Design

The current product and architecture specification is documented in:

[`docs/superpowers/specs/2026-07-21-vlezet-product-design.md`](docs/superpowers/specs/2026-07-21-vlezet-product-design.md)

The next implementation planning scope is intentionally limited to **M0 — Foundation and Infinite Canvas**.
