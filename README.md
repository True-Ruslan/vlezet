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

## Current milestone — M0

The first editor slice includes:

- infinite 2D canvas with adaptive grid;
- pointer-centred zoom;
- pan with `Space + drag` or the middle mouse button;
- millimetre-based world coordinates;
- wall drawing with endpoint, axis, and grid snapping;
- exact wall-length editing;
- command-oriented undo/redo;
- framework-independent domain, geometry, and editor-core packages.

### Run locally

Requirements: Node.js `>=22.13` and Corepack/pnpm.

```bash
corepack enable
pnpm install
pnpm dev
```

Then open the URL printed by Next.js.

### Editor controls

| Action | Control |
| --- | --- |
| Select tool | `V` |
| Wall tool | `W` |
| Place wall points | Left click |
| Pan | `Space + drag` or middle mouse drag |
| Zoom | Mouse wheel |
| Cancel wall chain / select tool | `Esc` |
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` |

## Quality commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Roadmap

- **M0 — Foundation and Infinite Canvas:** editor shell, pan/zoom, grid, world coordinates, wall drawing, exact length, snapping, undo/redo.
- **M1 — Apartment Shell:** connected walls, doors/windows, room detection and area.
- **M2 — Furnishing:** furniture catalogue, custom objects, measurements, collisions, clearance hints.
- **M3 — Usable Personal Product:** persistence, autosave, polished UX, export, first real apartment end-to-end.
- **M4 — Plan Import:** image/PDF calibration and tracing, followed by assisted recognition.
- **M5 — Spatial 3D:** deterministic 3D projection of the 2D model.
- **M6 — Intelligent Planning:** editable AI-assisted layout suggestions with deterministic geometry validation.

## Design and plans

- [`docs/superpowers/specs/2026-07-21-vlezet-product-design.md`](docs/superpowers/specs/2026-07-21-vlezet-product-design.md)
- [`docs/superpowers/plans/2026-07-21-m0-foundation-infinite-canvas.md`](docs/superpowers/plans/2026-07-21-m0-foundation-infinite-canvas.md)
