# Vlezet — Roadmap

**Last updated:** 2026-07-23  
**Rule:** roadmap order is intentional. Deterministic product truth and user trust come before visual spectacle or speculative AI layers.

For current truth, read `docs/PROJECT_STATE.md` first.

## Roadmap summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — merged; quality refinement backlog remains
DONE        M4.6 Precision Geometry UX — accepted and merged
DONE        M5.1 Deterministic Spatial 3D Shell + Viewer — accepted and merged
DONE        M5.2 Furniture in 3D — accepted and merged
DONE        M5.4 Spatial Inspection — accepted and merged
DONE        M6.1 Deterministic Layout Alternatives — accepted and merged
DONE        M6.2 Constraint-Aware Planning — accepted and merged
POLISH      M5.3 camera/navigation/performance refinements only where evidence requires them
NOW         M6.3 Exact Spatial Constraints
LATER       reviewed natural-language intent → structured constraints
LATER       broader planning / public-product infrastructure / optional expansion
```

## Completed trust foundation

### M4.5 — Assisted Recognition

Merge: `b63bdd613db4e13c07d2a961981799bd360f256d`.

Product position:

- recognition accelerates tracing;
- it is not automatic floor-plan reconstruction;
- candidates are editable/reviewable suggestions;
- explicit Apply is required;
- deterministic geometry validation is authoritative;
- existing geometry is never silently replaced;
- accuracy/noise remains a separate evidence-driven backlog.

### M4.6 — Precision Geometry UX

Merge: `a718bf605d8b3bde8dc87953c340b7b0e9565fdb`.

Accepted after strict CI and real browser verification.

Delivered explicit wall-length semantics, clear internal rectangular room dimensions, usable-area consistency, deterministic area rounding, wall-thickness alignment semantics, dimension annotations and tape measurement.

Verified regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

## Completed M5 spatial foundation

### M5 architecture principle

> 3D is a projection of the same trusted `VlezetDocument`, not a separate editor or geometry source.

```text
VlezetDocument
      ↓
@vlezet/geometry + @vlezet/spatial
      ↓
renderer-neutral SpatialScene
      ↓
plain Three.js viewer
```

### M5.1 — Deterministic Spatial 3D Shell + Viewer

PR #8 → squash merge `4acca82b04c87b3737eb87a03f9ee2ff360b5073`.

**Status:** DONE / ACCEPTED.

Delivered deterministic shell projection, wall thickness/opening segmentation, floors, semantic opening placeholders, fail-closed diagnostics, orbit/pan/zoom, camera presets, fit camera, reliable 2D↔3D switching and explicit GPU-resource cleanup.

### M5.2 — Furniture in 3D

PR #9 → squash merge `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a`.

**Status:** DONE / ACCEPTED.

Delivered projection of existing placed objects into `SpatialScene.objects` and generic Three.js primitives while preserving the ordinary document as the only furniture authority.

### M5.4 — Spatial Inspection

PR #10 → squash merge `0bffe36d74d2ff0865d700b51b17ee08e7001094`.

**Status:** DONE / ACCEPTED.

Delivered semantic 3D hover/select and read-only authoritative inspection for rooms, walls and furniture.

Acceptance:

```text
head: e9980f63d574d1a9cb6614980788270a50cde47e
CI:   29948749864 — PASS
```

Browser confirmation: `Все работает круто как ты и описал.`

### M5.3 — Camera/navigation/performance polish

The architectural foundation originally planned for M5.3 was delivered inside M5.1 because shell acceptance required real navigation.

M5.3 is therefore **not a blocking standalone milestone**.

Remaining work is evidence-driven only:

- camera persistence if users need it;
- unusual-plan framing;
- accessibility/input refinements;
- measured performance budgets;
- batching/LOD only when representative projects prove a need.

## Completed M6 intelligent-planning foundation

### M6 architecture principle

> Planning may propose structured alternatives and interpret explicit user intent, but `VlezetDocument` plus deterministic geometry/fit validation remain authoritative. Preview is ephemeral and Apply is explicit.

### M6.1 — Deterministic Layout Alternatives

PR #11 → squash merge `f2bbf1c4989ef4582ee86aba19c75a71679034be`.

**Status:** DONE / ACCEPTED.

Architecture:

```text
selected rectangular room + 1–3 existing objects
        ↓
@vlezet/planning bounded deterministic generator
        ↓
structured transform candidates
        ↓
existing M2 evaluateObjectFits() authority
        ↓
hard rejection + deterministic ranking/reasons
        ↓
ephemeral 2D ghost preview
        ↓ explicit Apply
one semantic VlezetDocument/history operation
```

Delivered:

- validated framework-independent planning contracts;
- one supported axis-aligned rectangular room;
- 1–3 selected existing objects;
- non-selected furniture remains fixed ordinary obstacles;
- deterministic footprint-aware anchors/orientations;
- search budget `MAX_PLANNING_EVALUATIONS = 6000`;
- maximum three ranked/displayed alternatives;
- M2-authoritative containment/collision/door-swing/clearance validation;
- deterministic ranking and explanations;
- non-mutating ghost preview;
- revalidated explicit Apply;
- canonical rotation persistence;
- one Apply = one Undo/Redo for all selected transforms.

Acceptance:

```text
head: acaa352545245ff079f55fb8ce85ba2a23f2312d
CI:   29953127208 — PASS
```

Browser confirmation: `Все работает строго по сценарию.`

### M6.2 — Constraint-Aware Planning

PR #13 → squash merge `db68d697540ddb9901fbddad0763d769e7d16851`.

**Status:** DONE / ACCEPTED.

Product result:

M6.2 made M6.1 intent-aware with a deliberately small, explicit and testable structured vocabulary.

Accepted constraints:

- hard `lock-object` → `Не двигать`;
- soft `prefer-room-boundary` → `Ближе к стене` / `Ближе к углу`;
- soft `pair-distance` → `Ближе друг к другу` / `Дальше друг от друга`.

Accepted architecture:

```text
VlezetDocument + selected room/objects + PlanningConstraint[]
        ↓
shared fail-closed constraint validation
        ↓
bounded deterministic M6.1 generation
        ↓
M2 hard fit/collision/door/clearance authority
        ↓
hard constraint rejection
        ↓
deterministic soft preference penalties
        ↓
ranked measured explanations
        ↓
ephemeral preview
        ↓ explicit current-document-revalidated Apply
one semantic Undo/Redo operation
```

Important contracts:

- request generation and candidate/Apply share `validatePlanningConstraintSet()`;
- duplicate/conflicting/malformed constraints fail closed;
- all-selected-objects locked is invalid;
- pair relationship is an unordered pair with explicit centre-to-centre millimetre semantics;
- hard constraints cannot be rescued by soft scoring;
- soft preferences rank only after M2 fit/recommendation quality;
- candidate identity includes normalized user intent;
- changing constraint state clears stale result/preview;
- constraints are ephemeral and never become a second persisted layout state;
- no LLM/API dependency for correctness.

Acceptance:

```text
head:  a32b5f633ee5c36dafb5578d3c0c3f7eaa46d649
CI:    29962203961 — PASS
merge: db68d697540ddb9901fbddad0763d769e7d16851
```

Representative real-browser acceptance PASS.

Product owner confirmed:

> «Это работает настолько все гениально и четко как ты сказал, что я в восторге.»

Canonical checklist: `docs/milestones/m6-2-acceptance.md`.

## NOW — M6.3 Exact Spatial Constraints

### Product goal

M6.2 proved that explicit user intent can safely influence planning. The next step should add **precise millimetre-based hard requirements** rather than jumping directly to natural-language or autonomous whole-apartment design.

The user should be able to say not only “ближе”, but eventually “между этими предметами должно быть не меньше 800 мм” and understand exactly how that requirement was measured.

### Recommended deliberately narrow scope

Start with one primary contract:

#### Minimum furniture-to-furniture spacing

A structured hard constraint such as:

```text
pair-min-gap(objectA, objectB, minimumMm)
```

Semantics must be defined before UI implementation:

- value is in canonical millimetres;
- measurement is minimum **edge-to-edge distance between oriented furniture footprints**, not centre distance;
- overlapping/touching footprints produce zero/blocked semantics as defined by trusted geometry;
- requirement references two distinct selected objects;
- hard constraint rejects candidate when measured gap is below `minimumMm`;
- explanations show both required and actual values.

Only after that contract is proven should M6.3 consider a second exact rule such as minimum furniture-to-room-boundary gap.

### Architecture

```text
VlezetDocument + exact structured mm constraints
        ↓
shared fail-closed contract validation
        ↓
@vlezet/planning bounded deterministic candidates
        ↓
M2 authoritative fit/collision/door/clearance validation
        ↓
trusted 2D exact spacing measurement
        ↓
numeric hard-constraint rejection
        ↓
existing deterministic soft ranking + measured reasons
        ↓
ephemeral preview / explicit atomic Apply
```

### Acceptance requirements

- exact measurement semantics documented before implementation;
- unit is millimetres and no pixel/mesh measurement is used;
- same document + same exact constraints → same ordered alternatives;
- invalid/non-finite/negative/ambiguous numeric values fail closed;
- stale referenced objects fail closed;
- hard numeric constraint cannot be bypassed by scoring;
- result evidence shows `required` and `actual` measurements;
- existing M2 authority remains unchanged;
- existing M6.2 constraints compose deterministically with the numeric hard constraint;
- preview remains non-mutating;
- Apply revalidates against current document;
- one Apply remains one Undo/Redo operation;
- strict exact-head CI and representative browser acceptance required before merge.

### Explicit non-goals

Do not make M6.3:

- a generic rule/expression language;
- free-form LLM layout generation;
- whole-apartment autonomous design;
- opaque AI scoring;
- photorealistic/interior-style generation;
- direct 3D editing;
- a second persisted planning document.

## After M6.3

Once the deterministic constraint vocabulary contains both qualitative and exact numeric rules and has passed browser acceptance, a reasonable next experiment is:

```text
natural-language user intent
        ↓
optional interpreter
        ↓
reviewable structured PlanningConstraint[] draft
        ↓ explicit user confirmation/editing
existing deterministic M6 planner
```

The interpreter may suggest structured constraints but must never bypass validation or directly generate authoritative geometry.

## Recommended workflow

```text
M6.3 focused design spec
→ define exact edge-to-edge spacing math
→ TDD geometry measurement primitive
→ TDD structured hard-constraint validation
→ integrate into bounded planning/evaluation
→ measured explanations + compact numeric UI
→ stale/change/Apply revalidation tests
→ representative browser acceptance
→ exact-head strict CI
→ squash merge
```

High-value precision/recognition/M5 polish remains evidence-driven backlog and should not interrupt M6 unless it becomes a real user blocker.
