# Vlezet — Roadmap

**Last updated:** 2026-07-22  
**Rule:** roadmap order is intentional. Do not start a later major milestone while a more fundamental product-trust problem is unresolved.

For current truth, read `docs/PROJECT_STATE.md` first.

## Roadmap summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
NOW         M4.5 Assisted Recognition — stabilize/merge as assisted experimental feature
NEXT        M4.6 Precision Geometry UX — dimension semantics + measurement workflow
THEN        M5 Spatial 3D
AFTER       M6 Intelligent Planning
LATER       public-product infrastructure / optional expansion
```

## P0 — Finish M4.5 Assisted Recognition safely

**Status:** Draft PR #6, RC tested on a real developer plan.

### Product position

M4.5 is **assisted recognition**, not automatic apartment reconstruction.

It may accelerate tracing, but every result remains:

- editable;
- reviewable;
- non-authoritative;
- explicitly applied by the user;
- protected by deterministic validation.

### Known quality limitation

Real-plan testing still shows inaccurate/noisy recognition:

- some walls are misplaced/incomplete;
- openings can be false/noisy;
- topology is not reliable enough for automatic reconstruction;
- cloud model quality varies strongly.

This is now a documented **known bug/quality limitation**, not an endless blocker for the entire roadmap.

Do not weaken validators just to increase candidate count.

### Final merge gate

M4.5 may be merged when safety and lifecycle are proven, even if recognition accuracy remains imperfect.

Required:

1. project startup/reload stable;
2. recognition failures never corrupt projects;
3. suggestions remain separate from `VlezetDocument` until explicit apply;
4. edit/accept/reject works;
5. apply creates ordinary Vlezet walls/openings;
6. one Undo removes the full applied batch;
7. Redo restores it;
8. valid current-version draft restores after reload;
9. M0–M4 workflows remain intact;
10. exact merge head has green strict CI.

### Post-merge recognition-quality backlog

Improve later in this order:

1. representative real-plan fixture corpus;
2. measurable recognition metrics;
3. preprocessing/CV tuning against fixtures;
4. better line merging/junction reconstruction;
5. cloud model quality ranking;
6. stronger semantic validation;
7. only then consider custom ML/advanced recognition.

Any future recognition must still produce editable candidates and pass deterministic apply.

### Completion action

```text
safety/smoke acceptance
→ Ready for Review
→ verify exact head + CI
→ squash merge PR #6
→ record merge SHA/date
→ begin M4.6 brainstorming/design
```

---

## P1 — M4.6 Precision Geometry UX

**Status:** accepted product priority; detailed design not yet approved/implemented.

Canonical feedback:

`docs/product/2026-07-22-geometry-dimensions-ux-feedback.md`

### Why this milestone was inserted before 3D

Real user test:

```text
entered walls: 3550 mm × 3300 mm
wall thickness: 50 mm
expected intuitively: ≈ 11.72 m²
actual displayed area: ≈ 11.38 m²
```

The geometry can be technically consistent because wall length is based around the centreline while room area is derived from inner faces.

The product problem is more serious:

> a normal user interprets `3550 mm` as the clear internal room size, but the interface does not explain that this is not necessarily what is being edited.

This creates a trust problem: the editor looks simple enough to understand while hiding CAD-like geometric semantics.

3D would make the same ambiguous geometry prettier, not more trustworthy.

### M4.6 product goal

Make exact apartment reconstruction understandable for a person who does not know CAD/BIM conventions.

A user should always understand:

- what dimension they are editing;
- which part of the geometry will move;
- where wall thickness grows;
- how displayed dimensions relate to room area;
- how to verify arbitrary distances.

### P0 design topics

#### M4.6.1 Dimension semantics

Explicitly distinguish:

- internal clear dimension;
- wall centreline dimension;
- external-face dimension.

Preferred direction to validate in design:

```text
Dimension mode
● Internal clear dimension
○ Wall centreline
○ External dimension
```

For normal users, **Internal clear dimension** is the leading default candidate.

Ambiguous label `Точная длина` should be replaced with explicit semantics.

#### M4.6.2 Related dimension explanation

Selected wall/room should explain the relation between:

- clear internal size;
- centreline size;
- external size;
- wall thickness.

The exact formulas must be topology-aware and deterministic.

#### M4.6.3 Length-change anchor

Changing wall length must explicitly define what stays fixed:

```text
Fixed anchor
● Start
○ Centre
○ End
```

The chosen anchor should be visible on canvas.

#### M4.6.4 Thickness alignment

Changing wall thickness must define direction:

```text
Inside | Centre | Outside
```

The editor must visually indicate the side because area changes depend on it.

#### M4.6.5 Dimension lines

Add derived plan annotations:

- selected-wall dimensions;
- room/internal dimensions where deterministic;
- show/hide dimensions toggle;
- annotations are not geometry source-of-truth.

#### M4.6.6 Tape / measurement tool

Two-point measurement should show:

- direct distance;
- horizontal delta;
- vertical delta.

Typical cases:

- corner → door;
- pier width;
- balcony opening;
- furniture clearance;
- arbitrary verification.

### High-value follow-up verticals after P0

#### M4.6.x Opening precision

- door/window width;
- offset from selected/reference corner;
- door swing/hinge semantics;
- optional sill/window height metadata.

#### M4.6.x Target area

```text
Actual: 11.38 m²
Target: 11.70 m²
Difference: -0.32 m²
```

Potential deterministic suggestion for how a selected dimension must change.

#### M4.6.x Locked constraints

Potential future constraints:

- locked dimension;
- locked target area;
- adjust another degree of freedom while preserving locks.

Do not implement before base dimension semantics are stable.

#### M4.6.x Wall presets/classes

Potential convenience:

- partition presets;
- structural/exterior classes;
- visual distinction.

Never imply removability/structural status without actual data.

### M4.6 non-goals for first slice

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

## P2 — M5 Spatial 3D

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

## P3 — M6 Intelligent Planning

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

### Scope direction

- constraint model;
- deterministic candidate generation/evaluation;
- AI-assisted alternatives;
- compare variants using measurable differences.

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

This is why M4.6 now precedes 3D.