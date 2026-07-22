# Vlezet — Roadmap

**Last updated:** 2026-07-22  
**Rule:** roadmap order is intentional. Resolve product-trust and geometry-semantics problems before visually impressive later layers.

For current truth, read `docs/PROJECT_STATE.md` first.

## Roadmap summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — merged; quality refinement backlog remains
NOW         M4.6 Precision Geometry UX — active Draft PR #7
THEN        M5 Spatial 3D
AFTER       M6 Intelligent Planning
LATER       public-product infrastructure / optional expansion
```

---

## Completed — M4.5 Assisted Recognition MVP

PR #6 was squash-merged to `main`:

```text
b63bdd613db4e13c07d2a961981799bd360f256d
```

### Product position

M4.5 is **assisted / experimental recognition**, not automatic apartment reconstruction.

It is accepted as an MVP because it can accelerate tracing while preserving the trust boundary:

- candidates are editable/reviewable;
- suggestions remain separate from `VlezetDocument` until explicit Apply;
- deterministic validation is authoritative;
- existing geometry is never silently replaced;
- one applied batch is one semantic Undo/Redo operation.

Real-plan accuracy is improved but still imperfect. That is now a quality backlog, not a blocker for M4.6.

### Recognition quality backlog

Improve later in this order:

1. representative real-plan fixture corpus;
2. measurable wall/opening/topology metrics;
3. preprocessing/CV tuning against fixtures;
4. better line merging/junction reconstruction;
5. cloud model quality/cost ranking;
6. stronger semantic validation;
7. only then consider custom ML/advanced recognition.

Any future recognition must still produce editable candidates and pass deterministic apply.

Canonical acceptance:

`docs/milestones/m4-5-mvp-acceptance.md`

---

## P0 — M4.6 Precision Geometry UX

**Status:** active development in Draft PR #7 `feat: M4.6 precision geometry UX`.

Canonical feedback:

`docs/product/2026-07-22-geometry-dimensions-ux-feedback.md`

Canonical design:

`docs/superpowers/specs/2026-07-22-m4-6-precision-geometry-ux-design.md`

### Why M4.6 precedes 3D

Real user test:

```text
entered walls: 3550 mm × 3300 mm
wall thickness: 50 mm
expected intuitively: ≈ 11.72 m²
old UX could show: ≈ 11.38 m²
```

The old geometry could be internally consistent because editable wall length was a centreline length while room area came from inner wall faces.

The product problem was more serious:

> a normal user interprets `3550 mm` as the clear internal room size, while the UI did not explain that the edited value was a different geometric concept.

3D would make the same ambiguity prettier, not more trustworthy.

### M4.6 product goal

Make exact apartment reconstruction understandable for a person who does not know CAD/BIM conventions.

A user should always understand:

- what dimension they are editing;
- which geometry remains fixed;
- which geometry moves;
- where wall thickness grows;
- how displayed dimensions relate to room area;
- how to verify arbitrary distances.

### M4.6 architecture rule

Keep one geometry source of truth:

```text
VlezetDocument
(vertices + wall centrelines + physical thickness)
        ↓
deterministic inner faces / rooms / measurements
        ↓
explicit semantic edit intents
        ↓
updated VlezetDocument
```

Do **not** persist duplicate `internalLength` / `externalLength` values that can disagree with geometry.

### Implemented — M4.6.1 Honest wall-length semantics

Already implemented in PR #7:

- `Точная длина` replaced by explicit `Длина по оси стены`;
- helper explanation that centreline length is not automatically clear internal size;
- length anchor:

```text
Начало | Центр | Конец
```

- `Начало` keeps start fixed;
- `Конец` keeps end fixed;
- `Центр` keeps midpoint fixed;
- legacy behavior remains start-fixed by default;
- opening offsets compensate when wall start moves, preserving opening world position;
- invalid resize through opening/junction/host constraints fails atomically;
- one resize = one semantic Undo/Redo operation.

### Implemented — first M4.6.2 Clear internal room dimensions slice

For simple axis-aligned rectangular rooms:

- clear width/height are derived from the same usable inner polygon as area;
- room inspector exposes `Чистые внутренние размеры`;
- editable `Ширина` and `Длина`;
- horizontal fixed side:

```text
Левая сторона | Центр | Правая сторона
```

- vertical fixed side:

```text
Верхняя сторона | Центр | Нижняя сторона
```

Regression target:

```text
centreline:     3650 × 3400 mm
walls:          100 mm
clear internal: 3550 × 3300 mm
area:           11.715 m²
```

This directly addresses the original user expectation: clear dimensions and displayed area now come from the same inner geometry.

The first edit scope intentionally supports only simple deterministic rectangles. Complex/non-rectangular/T-junction rooms fail closed rather than inventing a width/length.

### Next — M4.6.3 Wall thickness alignment

Changing thickness must explicitly define where the new thickness goes:

```text
Внутрь | По центру | Наружу
```

Requirements:

- selected reference face/side remains deterministic;
- centreline shifts when required;
- area changes are predictable;
- UI visually indicates the relevant side;
- no structural/removability meaning is inferred without authoritative data.

### Next — M4.6.4 Dimension lines

Add derived Canvas annotations:

- selected-wall centreline dimension;
- deterministic room clear dimensions;
- show/hide dimensions toggle;
- annotations are projections only, never geometry authority.

Example:

```text
       ←────── 3550 mm ──────→
┌────────────────────────────┐
│                            │
│          11.72 m²          │ 3300 mm
│                            │
└────────────────────────────┘
```

### Next — M4.6.5 Tape / measurement tool

Two-point measurement should show:

- direct distance;
- horizontal delta;
- vertical delta.

Typical uses:

- corner → door;
- pier width;
- balcony opening offset;
- furniture clearance;
- arbitrary verification.

Measurement is ephemeral/derived in the first slice.

### High-value follow-ups after P0

#### Opening precision

- door/window width;
- offset from selected/reference corner;
- door swing/hinge semantics;
- optional sill/window height metadata.

#### Target room area

```text
Actual: 11.38 m²
Target: 11.70 m²
Difference: -0.32 m²
```

Potential deterministic suggestion for how a selected dimension must change.

#### Locked constraints

Potential later constraints:

- locked dimension;
- locked target area;
- adjust another degree of freedom while preserving locks.

Do not implement before base dimension semantics are stable.

#### Wall presets/classes

Potential convenience:

- partition presets;
- structural/exterior classes;
- visual distinction.

Never imply removability/structural status without actual data.

### M4.6 non-goals

- full parametric CAD constraint solver;
- BIM semantics;
- automatic structural engineering conclusions;
- construction-code compliance engine;
- 3D implementation;
- redesigning the entire editor UI.

### M4.6 acceptance principle

A normal user should be able to recreate a rectangular room from known **internal dimensions** and predict the resulting area without understanding wall centreline mathematics.

The user must be able to answer:

> “I entered 3550 mm. What exactly is 3550 mm, what moves if I change it, and why is the room area what it is?”

without external explanation.

---

## P1 — M5 Spatial 3D

**Status:** planned direction; postponed until M4.6 precision semantics are stable.

### Product goal

Give spatial comprehension of the **same structured apartment model**.

3D remains a projection:

```text
VlezetDocument
   ├── 2D Konva projection
   └── 3D Three.js projection
```

Never create separate 2D and 3D sources of truth.

### Recommended first scope

#### M5.1 Deterministic 3D shell

- floor plane;
- wall extrusion with real thickness;
- wall height metadata/default;
- doors/windows represented consistently;
- deterministic mm→3D mapping;
- no photorealism requirement.

#### M5.2 Furniture projection

- existing placed objects from width/depth/height/rotation;
- generic geometry first;
- shared selection identity where practical.

#### M5.3 Camera/navigation

- orbit/pan/zoom;
- top/isometric/perspective presets;
- 2D↔3D without losing state;
- fit apartment to camera.

#### M5.4 Spatial inspection

- selected room/object highlight;
- dimensions/fit status from existing deterministic logic;
- optional simple cutaway/visibility controls.

### Non-goals

- photorealism;
- ray tracing;
- material marketplace;
- generative interior images;
- separate 3D editor model;
- VR;
- BIM/construction documentation.

---

## P2 — M6 Intelligent Planning

**Status:** planned direction.

### Product goal

Help users answer:

- where should furniture go;
- can required objects fit;
- which layout is more usable;
- what trade-offs exist.

### Architecture

```text
constraints + VlezetDocument
        ↓
planning engine / AI
        ↓
structured candidate layout
        ↓
deterministic geometry/fit validation
        ↓
editable alternative
```

No generated image is an authoritative plan.

---

## Later product/infrastructure backlog

Only after the core planning experience is trustworthy:

- cloud sync/auth;
- collaboration/sharing;
- mobile/limited touch workflows;
- multi-floor;
- richer object assets;
- managed AI provider/billing;
- advanced import/OCR;
- DWG/DXF/BIM integrations where justified.

## Roadmap decision rule

When choosing the next feature, prefer:

```text
trust / precision / predictability
before
visual impressiveness / feature count
```

This is why M4.6 precedes 3D and why recognition quality refinement remains a separate measured backlog rather than blocking the main product path.
