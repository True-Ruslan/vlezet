# Vlezet — Changelog

**Purpose:** preserve development history in a form that explains **when**, **why**, **how** and **what** changed, so a new chat can reconstruct project context without relying on conversation memory.

This is not only a package-release changelog. It records milestone decisions, product feedback, RC failures and architecture changes that materially changed the roadmap.

## 2026-07-22 — M5.1 Deterministic Spatial 3D Shell accepted and merged

PR #8 squash merge:

```text
4acca82b04c87b3737eb87a03f9ee2ff360b5073
```

### Why

After M4.6 fixed the geometry-trust UX, the next product need was spatial understanding: users should be able to look at the **same apartment** in 3D without creating a second geometry model or learning a second editor.

Non-negotiable rule:

> 3D is a projection of the same trusted `VlezetDocument`, never a second geometry source or parallel editor.

Chosen architecture:

```text
VlezetDocument
      ↓
@vlezet/geometry + @vlezet/spatial
      ↓
renderer-neutral SpatialScene
      ↓
plain Three.js viewer
```

### Delivered

New framework-independent package:

```text
@vlezet/spatial
```

Projection contract:

```text
document x → scene X
document y → scene Z
height     → scene Y
units      → millimetres remain millimetres
```

Implemented:

- deterministic wall prisms from existing topological wall endpoints;
- exact physical wall thickness;
- projection-only default wall height `2700 mm` without schema migration;
- wall splitting around openings through existing `deriveVisibleWallIntervals`;
- semantic door/window markers preserving ID/kind/width/position;
- no invented authoritative sill/top/door heights;
- floors from the same derived usable inner-room polygons as 2D;
- fail-closed projection diagnostics for invalid wall/opening geometry;
- neutral spatial model with no Three.js classes crossing the package boundary.

Three.js viewer:

- plain Three.js, intentionally not R3F as the architectural centre;
- orbit/pan/zoom via OrbitControls;
- `Перспектива`;
- `Изометрия`;
- `Сверху`;
- toolbar `Весь план` fits the active 3D camera;
- grid and simple lighting;
- WebGL initialization failure remains isolated from the 2D editor.

2D↔3D safety:

- view mode stored in a separate non-semantic Zustand store;
- 3D reads the existing editor document;
- 3D never writes geometry/history;
- editing tools and Undo/Redo are disabled while 3D is active;
- 2D editor remains the authoritative session;
- switching view mode does not create a second persistence model or schema migration.

### Tests

`@vlezet/spatial` coverage includes:

- empty document + input immutability;
- exact `3550 mm` wall projection;
- exact wall thickness;
- deterministic wall rotation;
- multiple opening interval splitting;
- opening semantic markers;
- invalid opening outside host wall fails closed;
- derived floor polygon mapping;
- invalid wall isolation.

Web/spatial tests include:

- non-semantic 2D/3D mode state;
- no editor document/history mutation from view switching;
- Three.js wall primitive dimensions;
- opening placeholder semantic identity;
- floor rendering contract;
- camera fit/preset math.

### RC / review issue found before merge

Final self-review identified a Three.js resource lifecycle gap:

```text
GridHelper geometry/material
created on every 3D mount
→ not explicitly disposed on unmount
→ potential GPU resource leak after repeated 2D↔3D switching
```

TDD regression cycle:

```text
ea672213f3554d7acf7c604be290718ae37da02f — RED disposal test
7d037ae7ecfc544a2efde4aedcfaa4c7ff9d9799 — disposal helper
a0da8785c8793833c8ff0f66b65a19684f0457a0 — viewer cleanup wired
```

The fix adds explicit disposal of renderer helper geometry/material resources.

### Automated verification

Accepted code head:

```text
bae06971e7969ee8324e540eb9d4a9e758fda1d8
29934171569 — PASS
```

Final lifecycle-fix code head:

```text
a0da8785c8793833c8ff0f66b65a19684f0457a0
29936603959 — PASS
```

Final PR heads also passed strict CI before merge.

Required gate:

- `pnpm install --frozen-lockfile`;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

All PASS.

### Manual browser acceptance

**PASS — 2026-07-22.**

A real apartment project was opened in the new 3D mode.

User screenshot and confirmation verified:

- 3D spatial shell renders;
- apartment walls/structure are visible;
- schematic opening markers are visible;
- 2D/3D switch exists in the real editor;
- Perspective/Isometric/Top controls exist;
- orbit/pan/zoom navigation is available.

User explicitly confirmed:

> «Все есть»

Detailed canonical checklist: `docs/milestones/m5-acceptance.md`.

### Accepted boundaries

M5.1 intentionally does not include:

- furniture projection;
- authoritative vertical door/window geometry;
- direct 3D geometry editing;
- photorealism/material asset pipeline;
- BIM/VR;
- separate 3D persistence.

### Next

```text
M5.2 Furniture in 3D
```

The same existing `placedObjects` must be projected into neutral spatial data and rendered as generic deterministic primitives before any decorative asset pipeline.

---

## 2026-07-22 — GitHub Actions availability restored by making repository public

During M5.1 development the account exhausted its included private-repository GitHub Actions minutes.

Observed symptom:

```text
workflow created
→ job ended before Checkout
→ no runner steps / no useful logs
```

The account billing page confirmed:

```text
2000 / 2000 included Actions minutes used
Actions budget = $0
Stop usage = Yes
```

Decision: repository `True-Ruslan/vlezet` was made public rather than enabling paid overage.

Result: standard GitHub-hosted CI runners became available again and M5.1 strict verification completed successfully.

Engineering follow-up: avoid unnecessary duplicate workflow runs even when public runners are free; add concurrency/cancellation optimization when touching CI next.

---

## 2026-07-22 — M4.6 Precision Geometry UX accepted and merged

PR #7 squash merge:

```text
a718bf605d8b3bde8dc87953c340b7b0e9565fdb
```

### Why M4.6 became P0

A real ordinary-user test exposed a geometry-trust problem.

The user entered:

```text
3550 × 3300 mm
```

and naturally expected:

```text
3.55 × 3.30 = 11.715 m² → 11.72 m²
```

The editor historically interpreted wall values as **centreline lengths**, while useful room area was correctly derived from **inner wall faces**. The math was internally consistent, but the UX semantics were not.

Accepted product rule:

> Vlezet must remain simpler than CAD, but simplicity must never hide geometry semantics.

### Delivered

#### Honest wall-length semantics

- `Длина по оси стены` replaces ambiguous length wording;
- wall resize anchors `Начало / Центр / Конец`;
- opening world positions preserved where wall start moves;
- invalid topology/host cases fail atomically;
- one resize remains one semantic history operation.

#### Clear internal room dimensions

First conservative editable scope: deterministic axis-aligned rectangular rooms.

- width/height derived from the same usable inner polygon as area;
- inspector `Чистые внутренние размеры`;
- editable `Ширина` and `Длина`;
- fixed-side/centre anchors;
- canonical wall geometry moves instead of duplicate persistent dimensions;
- unsupported geometry fails closed.

Regression contract:

```text
clear internal: 3550 × 3300 mm
area:           11.715 m²
UI:             11.72 m²
```

A separate floating-point display bug was fixed so canonical square-millimetre rounding does not show `11.715` as `11.71`.

#### Dimension discoverability

- room labels show name + usable area + clear `Ш × Д`;
- selected room shows inner-face dimension lines;
- selected wall shows technical `... мм по оси` dimension;
- `Размеры` toggle;
- annotations remain derived and non-persistent.

#### Wall thickness alignment

Core contract:

```text
center | left-face | right-face
```

For one unambiguous adjacent room the UI presents:

```text
Внутрь помещения | По центру | Наружу
```

Ambiguous topology uses explicit left/right-face semantics.

#### Tape / measurement tool

- toolbar `Измерить`;
- shortcut `M`;
- snapped two-point measurement;
- direct distance + `ΔX` + `ΔY`;
- ephemeral only, never persisted/history authority.

### Verification

Strict CI PASS and real browser acceptance PASS.

User-confirmed regression:

```text
3550 × 3300 мм
11.72 м²
```

---

## 2026-07-22 — M4.5 Assisted Recognition accepted and merged as MVP

PR #6 squash merge:

```text
b63bdd613db4e13c07d2a961981799bd360f256d
```

### Why

M4 imported/calibrated real source plans, but exact manual tracing remained repetitive.

Recognition was introduced to accelerate tracing without sacrificing trust.

Rule:

> CV/LLM may suggest editable structured geometry; they are never geometry authority.

Pipeline:

```text
reference raster
→ local CV
→ optional cloud vision BYOK
→ reconciliation / semantic sanity
→ RecognitionDraft
→ review/edit
→ explicit Apply
→ ordinary Vlezet geometry
```

### Delivered

- local OpenCV/Web Worker recognition;
- persistent recognition session separate from document;
- review/edit/accept/reject;
- opening reclassification;
- deterministic image→millimetre projection;
- duplicate/conflict protection;
- one Apply batch = one Undo/Redo operation;
- stale reference/calibration/engine protection;
- optional OpenRouter BYOK;
- tolerant per-candidate parsing and reconciliation;
- safe diagnostics;
- unfinished sessions excluded from backup/duplicate/import.

### Important RC failures found and fixed

- optional recognition restore could block editor startup;
- OpenCV Emscripten module lifecycle mismatch;
- browser build could resolve Node-only dependencies;
- excessive Konva layer use;
- local CV thresholds could return zero candidates;
- hidden cloud-model prerequisites made submit misleading;
- native `fetch` binding issue;
- malformed cloud candidate could kill entire response;
- schema-valid cloud hallucinations could create giant page-frame/orphan geometry.

### Accepted limitation

Recognition is useful but not perfect.

Decision:

- accept as assisted/experimental MVP;
- keep explicit review/apply;
- never weaken deterministic validators for apparent recall;
- later tune against representative fixtures and measurable metrics.

---

## Historical milestone summary

### M4 — Reference Plan Import

PR #5 → `12e9696e11572ad5ec055f3dfad98ad7826184e2`.

Delivered local JPG/PNG/PDF import, safe validation/rasterization, calibration, reference transforms, local asset persistence, tracing, reference-aware fitting, embedded-reference backup and PNG export options.

### M3 — Local-First Projects

PR #4 → `6c32249acc8e333e62fceee2ea4e76ca83890c77`.

Delivered dashboard/project lifecycle, IndexedDB persistence, autosave/retry, viewport restore, backup/import and clean PNG export.

### M2 — Furnishing and Fit

PR #3 → `aa34f24572f2e67714604634587a1c41e4067cd8`.

Delivered furniture/appliance objects, exact dimensions/transforms, collision/containment/door-swing/clearance evaluation and explainable fit statuses.

### M1 — Apartment Shell

PR #2 → `3944c7f9d668a645e1dc05805f476d2f3290eb94`.

Delivered topological walls/vertices, thickness, T-junctions, deterministic rooms/usable area, room names and host-wall openings.

### M0 — Foundation and Infinite Canvas

PR #1 → `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered TypeScript monorepo boundaries, infinite canvas, mm world coordinates, pan/zoom/grid, wall drawing, snapping, semantic history and reproducible CI.

## Product direction that remains valid

- precision before decoration;
- easier than professional CAD, but never misleading about geometry;
- millimetre structured truth;
- 2D trust before 3D spectacle;
- 3D is a projection, not a second model;
- imported/AI results remain editable;
- local-first core;
- deterministic validation before AI convenience;
- no speculative billing/marketplace/BIM/VR/photorealism before core value is proven.
