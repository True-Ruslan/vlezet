# Vlezet — Changelog

**Purpose:** preserve development history in a form that explains **when**, **why**, **how** and **what** changed, so a new chat can reconstruct project context without relying on conversation memory.

This is not only a package-release changelog. It records milestone decisions, product feedback, RC failures and architecture changes that materially changed the roadmap.

## 2026-07-22 — M5.2 Furniture in 3D accepted and merged

PR #9 squash merge:

```text
7f7e8dfd9c875145bfa3d307638cd8cd27051a3a
```

### Why

M5.1 proved the deterministic spatial shell/viewer, but the 3D mode still omitted the furniture/appliances already present in the trusted 2D document.

Product rule:

> Furniture in 3D must be a projection of the same existing `VlezetDocument.placedObjects`, never a parallel 3D placement model.

Architecture:

```text
PlacedObject
position x/y
width/depth/height?
rotationDeg
      ↓
@vlezet/spatial
      ↓
SpatialObject
center X/Y/Z
width/depth/height
rotationYRad
heightWasDefaulted
      ↓
Three.js generic primitive
```

### Delivered

Neutral spatial model:

- added `SpatialScene.objects`;
- added renderer-neutral `SpatialObject`;
- exact document `x/y → scene X/Z` mapping;
- exact `width` / `depth` millimetres;
- deterministic `rotationDeg → rotationYRad`;
- stored `height` remains authoritative when present;
- missing height uses projection-only `DEFAULT_OBJECT_HEIGHT_MM = 700`;
- projection default is never silently persisted;
- semantic object ID/name/category preserved for future inspection.

Fail-closed safety:

- invalid/non-finite object geometry is isolated per object;
- finite dimensions outside persistent domain bounds also fail closed;
- spatial validation reuses the same domain `MIN/MAX_PLACED_OBJECT_DIMENSION_MM` constants instead of duplicating limits.

Three.js renderer:

- generic deterministic box primitives;
- exact neutral width/height/depth mapping;
- exact center and Y-axis rotation mapping;
- semantic `userData` retained for later M5.4 inspection;
- object material/geometry participate in existing renderer disposal lifecycle.

Explicit non-goals preserved:

- no schema migration;
- no second 3D furniture state;
- no decorative/glTF asset pipeline;
- no direct 3D furniture editing;
- no mesh-collision product authority;
- deterministic M2 fit/collision/clearance logic remains authoritative.

### TDD / RC evidence

Observed RED→GREEN cycles:

1. object projection tests failed before `SpatialObject` implementation;
2. renderer object mesh test failed before Three.js box mapping;
3. out-of-domain finite-dimension test failed before persistent domain bounds were reused.

An intermediate integration failure also exposed that existing `SpatialScene` test fixtures needed the new mandatory `objects` field. The fixture contract was updated before renderer work continued.

### Automated verification

Pre-acceptance RC:

```text
94805c73116f97648ef22a701cfd1bb607d4bd87
GitHub Actions 29938901932 — PASS
```

Final exact accepted PR head:

```text
1b955e01a3092e11427258b563871800cf82206a
GitHub Actions 29940437536 — PASS
```

Required gates:

- `pnpm install --frozen-lockfile`;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

All PASS.

### Manual browser acceptance

**PASS — 2026-07-22.**

User provided paired screenshots from the same real project:

- toolbar shows `3 предметов`;
- all three objects appear in 3D;
- room placement matches the 2D view;
- one object appears in the left small room and two in the right small room in both views;
- M5.1 shell remains visually intact.

Canonical evidence:

```text
docs/milestones/m5-2-acceptance.md
```

### Roadmap consequence

M5.2 is complete.

The original M5.3 navigation foundation was already delivered in M5.1 (orbit/pan/zoom, camera presets, fit, 2D↔3D switching), so remaining M5.3 work is evidence-driven polish only.

Next active product slice:

```text
M5.4 Spatial Inspection
```

Goal: inspect semantic rooms/walls/objects in read-only 3D and surface already-authoritative dimensions/fit information without introducing a second geometry authority.

---

## 2026-07-22 — M5.1 Deterministic Spatial 3D Shell accepted and merged

PR #8 squash merge:

```text
4acca82b04c87b3737eb87a03f9ee2ff360b5073
```

### Why

After M4.6 fixed geometry-trust UX, users needed spatial understanding of the **same apartment** without creating a second geometry model or learning a second editor.

Rule:

> 3D is a projection of the same trusted `VlezetDocument`, never a second geometry source or parallel editor.

Architecture:

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

- new framework-independent `@vlezet/spatial`;
- document X/Y → scene X/Z, height → Y;
- millimetres remain millimetres;
- deterministic wall prisms with exact thickness;
- projection-only wall height `2700 mm` without schema migration;
- wall splitting around existing openings;
- room floors from derived usable polygons;
- schematic semantic door/window placeholders without invented vertical authority;
- fail-closed spatial diagnostics;
- plain Three.js viewer;
- orbit/pan/zoom;
- Perspective / Isometric / Top presets;
- fit camera;
- safe 2D↔3D switching;
- no document/history mutation from view mode;
- WebGL failure isolation.

### RC issue found before merge

Self-review found a `GridHelper` GPU-resource lifecycle gap.

TDD cycle:

```text
ea672213f3554d7acf7c604be290718ae37da02f — RED disposal regression test
7d037ae7ecfc544a2efde4aedcfaa4c7ff9d9799 — disposal helper
a0da8785c8793833c8ff0f66b65a19684f0457a0 — viewer cleanup wired
29936603959 — PASS
```

### Manual acceptance

**PASS — 2026-07-22.**

Real apartment screenshot confirmed 3D shell, openings, camera presets and 2D/3D switching.

User explicitly confirmed:

> «Все есть»

Canonical checklist: `docs/milestones/m5-acceptance.md`.

---

## 2026-07-22 — GitHub Actions availability restored

During M5.1 development the account exhausted included private-repository GitHub Actions minutes.

Observed state:

```text
2000 / 2000 included Actions minutes used
Actions budget = $0
Stop usage = Yes
```

Decision: make `True-Ruslan/vlezet` public instead of enabling paid overage.

Result: standard GitHub-hosted CI runners became available again and strict verification resumed.

Engineering lesson: avoid unnecessary duplicate workflow runs even when public runners are available; CI concurrency/cancellation remains a useful future optimization.

---

## 2026-07-22 — M4.6 Precision Geometry UX accepted and merged

PR #7 squash merge:

```text
a718bf605d8b3bde8dc87953c340b7b0e9565fdb
```

### Why M4.6 became P0

A real ordinary-user test exposed a geometry-trust problem.

User entered:

```text
3550 × 3300 mm
```

and naturally expected:

```text
3.55 × 3.30 = 11.715 m² → 11.72 m²
```

The editor historically interpreted wall values as **centreline lengths**, while usable room area was correctly derived from **inner wall faces**. The math was internally consistent, but UX semantics were not.

Accepted rule:

> Vlezet must remain simpler than CAD, but simplicity must never hide geometry semantics.

### Delivered

#### Honest wall-length semantics

- `Длина по оси стены`;
- wall resize anchors `Начало / Центр / Конец`;
- opening world positions preserved when wall start moves;
- invalid topology/host cases fail atomically;
- one resize = one semantic history operation.

#### Clear internal room dimensions

First conservative editable scope: deterministic axis-aligned rectangular rooms.

- width/height derived from the same usable inner polygon as area;
- inspector `Чистые внутренние размеры`;
- editable `Ширина` and `Длина`;
- fixed-side/centre anchors;
- canonical wall geometry moves instead of duplicate persistent dimensions;
- unsupported geometry fails closed.

Regression:

```text
clear internal: 3550 × 3300 mm
area:           11.715 m²
UI:             11.72 m²
```

#### Dimension discoverability

- room labels show name + usable area + clear `Ш × Д`;
- selected room inner-face dimension lines;
- selected wall technical centreline dimension;
- `Размеры` toggle;
- derived/non-persistent annotations.

#### Wall thickness alignment

Core contract:

```text
center | left-face | right-face
```

For one unambiguous adjacent room:

```text
Внутрь помещения | По центру | Наружу
```

Ambiguous topology uses explicit left/right-face semantics.

#### Tape tool

- toolbar `Измерить`;
- shortcut `M`;
- snapped two-point measurement;
- direct distance + `ΔX` + `ΔY`;
- ephemeral only.

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
- tolerant candidate parsing/reconciliation;
- safe diagnostics;
- unfinished sessions excluded from backup/duplicate/import.

### Important RC failures found and fixed

- optional recognition restore could block editor startup;
- OpenCV/Emscripten lifecycle mismatch;
- browser build could resolve Node-only dependencies;
- excessive Konva layer use;
- local CV thresholds could return zero candidates;
- hidden cloud-model prerequisites made submit misleading;
- native `fetch` binding issue;
- malformed cloud candidate could kill an entire response;
- schema-valid cloud hallucinations could create giant page-frame/orphan geometry.

### Accepted limitation

Recognition is useful but not perfect.

Decision:

- accept as assisted/experimental MVP;
- keep explicit review/apply;
- never weaken deterministic validators for apparent recall;
- tune later against representative fixtures and measurable metrics.

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

Delivered topological walls, physical thickness, T-junctions, deterministic rooms/area, room naming, wall-hosted openings and geometry diagnostics.

### M0 — Foundation + Infinite Canvas

PR #1 → `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered monorepo boundaries, mm world model, infinite canvas, pan/zoom/grid, snapping, wall drawing, semantic Undo/Redo and reproducible CI.