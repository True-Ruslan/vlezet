# Vlezet — Roadmap

**Last updated:** 2026-07-30  
**Rule:** deterministic product truth and user trust come before visual spectacle, feature count or speculative AI layers.

For current truth, read `docs/PROJECT_STATE.md` first.

## Summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — quality refinement remains backlog
DONE        M4.6 Precision Geometry UX
DONE        M5.1 Deterministic Spatial 3D Shell + Viewer
DONE        M5.2 Furniture in 3D
POLISH      M5.3 evidence-driven camera/navigation/performance refinement
DONE        M5.4 Spatial Inspection
DONE        M6.1 Deterministic Layout Alternatives
DONE        M6.2 Constraint-Aware Planning
DONE        M6.3 Exact Spatial Constraints
DONE        M6.4 Reviewed Natural-Language Intent
NOW         evidence-driven next-slice prioritization
LATER       only the focused slice selected by that review
```

## Completed trust foundation

### M4.5 — Assisted Recognition

Merge: `b63bdd613db4e13c07d2a961981799bd360f256d`

Recognition accelerates tracing but is not authoritative floor-plan reconstruction. Candidates are editable, explicit Apply is required, deterministic geometry validation remains authoritative and existing geometry is never silently replaced.

Quality varies by drawing style and image quality. Future recognition work requires representative fixtures and measurable metrics rather than ad hoc threshold tuning.

### M4.6 — Precision Geometry UX

Merge: `a718bf605d8b3bde8dc87953c340b7b0e9565fdb`

Accepted clear-size semantics, area consistency, wall-thickness alignment, dimension annotations and tape measurement.

Verified regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

## Completed M5 spatial foundation

Principle:

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

### M5.1 — Spatial 3D Shell + Viewer

PR #8 → `4acca82b04c87b3737eb87a03f9ee2ff360b5073`

Delivered deterministic shell projection, physical wall thickness, opening segmentation, floors, semantic placeholders, fail-closed diagnostics, orbit/pan/zoom, camera presets, fit camera, safe 2D↔3D switching and GPU cleanup.

### M5.2 — Furniture in 3D

PR #9 → `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a`

Delivered projection of existing placed objects into `SpatialScene.objects`. The ordinary document remains the only furniture authority.

### M5.4 — Spatial Inspection

PR #10 → `0bffe36d74d2ff0865d700b51b17ee08e7001094`

Delivered semantic 3D hover/select and read-only authoritative inspection for rooms, walls and furniture.

Accepted head/run:

```text
head: e9980f63d574d1a9cb6614980788270a50cde47e
CI:   29948749864 — PASS
```

### M5.3 — Evidence-driven polish

The architectural camera/navigation foundation shipped in M5.1. M5.3 is not a blocking standalone milestone.

Only pursue when evidence requires:

- camera persistence;
- unusual-plan framing;
- accessibility/input refinements;
- measured performance budgets;
- batching/LOD.

## Completed M6 intelligent-planning foundation

Principle:

> Planning may propose structured alternatives and interpret user intent, but `VlezetDocument` plus deterministic geometry/fit validation remain authoritative. Preview is ephemeral and Apply is explicit.

### M6.1 — Deterministic Layout Alternatives

PR #11 → `f2bbf1c4989ef4582ee86aba19c75a71679034be`

Delivered:

- framework-independent `@vlezet/planning`;
- one supported rectangular room;
- 1–3 selected existing objects;
- fixed non-selected obstacles;
- deterministic footprint-aware anchors/orientations;
- bounded generation (`MAX_PLANNING_EVALUATIONS = 6000`);
- maximum three ranked alternatives;
- M2-authoritative validation;
- non-mutating ghost Preview;
- explicit revalidated Apply;
- one Apply = one Undo/Redo step.

Acceptance:

```text
head: acaa352545245ff079f55fb8ce85ba2a23f2312d
CI:   29953127208 — PASS
```

### M6.2 — Constraint-Aware Planning

PR #13 → `db68d697540ddb9901fbddad0763d769e7d16851`

Accepted structured vocabulary:

- hard `lock-object`;
- soft `prefer-room-boundary` for wall/corner;
- soft `pair-distance` for near/far.

Accepted contracts:

- shared fail-closed validation at request and candidate/Apply boundaries;
- normalized deterministic identity;
- hard rejection before scoring;
- soft ranking after M2 fit quality;
- measured evidence;
- stale Preview clearing;
- explicit atomic Apply;
- no LLM/API correctness dependency or persistent planning state.

Acceptance:

```text
head:  a32b5f633ee5c36dafb5578d3c0c3f7eaa46d649
CI:    29962203961 — PASS
merge: db68d697540ddb9901fbddad0763d769e7d16851
```

### M6.3 — Exact Spatial Constraints

PR #15 → `724058fe57d769e7c1329f3536d6869405e6ac42`

Accepted primary contract:

```text
pair-min-gap(objectA, objectB, minimumMm)
```

Accepted semantics:

- canonical millimetres;
- exact shortest edge-to-edge distance between oriented furniture footprints;
- touch/overlap = `0`;
- hard rejection below `minimumMm`;
- finite non-negative values only;
- `0` is a real rule; empty means absent;
- normalized unordered pair identity;
- malformed/self/duplicate/outside references fail closed;
- exact constraint composes with M6.2 soft intent;
- impossible minimum offers no violating alternatives.

Accepted authority:

```text
minimumGapWitnessBetweenOrientedRectangles()
        ↓
minimumDistanceBetweenOrientedRectangles()
        ↓
planning hard validation + UI evidence + 2D overlay
```

Accepted UX:

- explicit minimum contour-gap input;
- helper distinguishes contour gap from dimensions and centre distance;
- structured actual/required evidence;
- nearest-contour double-arrow during Preview;
- endpoint/contact markers and viewport-clamped label;
- one active exact pair with explicit switching;
- no extra Konva layer;
- viewport-safe right inspector.

Acceptance evidence:

```text
head:  f3f093df2cc6dba2aa0f6590b2c0250287f7c6b8
CI:    30542599616 — PASS
merge: 724058fe57d769e7c1329f3536d6869405e6ac42
```

Product-owner confirmation:

> «Все работает супер идеально, ты гений величайший.»

Canonical checklist: `docs/milestones/m6-3-acceptance.md`.

### M6.4 — Reviewed Natural-Language Intent

PR #17 → `02f8b041341c86f0796011b0d2fd42cac56a4e02`

Status: **DONE / ACCEPTED / MERGED**.

Product goal achieved:

> Let a user describe supported planning intent in ordinary language, inspect exactly what was understood, resolve ambiguity and explicitly transfer the reviewed result into the already accepted deterministic controls.

Accepted architecture:

```text
natural-language request
        ↓ optional text-only interpreter
symbolic clauses + unsupported fragments
        ↓ deterministic local object resolution
reviewable draft + explicit choices
        ↓ acknowledgement and transfer
existing manual structured controls
        ↓ explicit Find alternatives
existing deterministic planner / Preview / Apply
```

Delivered:

- symbolic intent clauses for existing M6.2–M6.3 concepts;
- strict interpreter-payload normalization;
- mm/cm/m conversion to canonical millimetres;
- Unicode/case/punctuation/whitespace and `ё/е` normalization;
- exact object-name match followed by unique contiguous token match;
- no fuzzy object guessing;
- explicit ambiguous and unresolved references;
- visible unsupported fragments with acknowledgement gate;
- text-only OpenRouter structured output with runtime-only BYOK;
- review cards and clause removal;
- explicit transfer into existing selection/lock/boundary/pair/gap controls;
- no automatic planner execution after interpretation;
- provider failure leaves manual planning available;
- narrow-inspector control and pair-card spacing regression coverage.

Browser evidence:

- `Диван` resolved to `Не двигать`;
- `кресло` did not silently become `Стул`;
- `стол` remained ambiguous between two tables;
- `800 мм` exact gap transferred correctly;
- window-relative text stayed visibly unsupported;
- transfer populated ordinary controls without generating alternatives.

Product-owner confirmation:

> «Работает все четко и ровно так, как ты описал.»

Final evidence:

```text
head:  d8c35d88ad8e48dc53a156c08bfae60d0530e26f
CI:    30553594794 — PASS
merge: 02f8b041341c86f0796011b0d2fd42cac56a4e02
```

Canonical checklist: `docs/milestones/m6-4-acceptance.md`.

## NOW — Evidence-driven next-slice prioritization

M6.4 completes the current planned intelligent-planning foundation. No automatic M6.5 is committed.

The next cycle begins by comparing concrete product problems, not by extending AI vocabulary by default.

Evaluation criteria:

1. frequency and severity of the user problem;
2. measurable improvement to the core promise “understand what fits”;
3. ability to preserve deterministic geometry authority;
4. implementation and maintenance cost;
5. regression risk to trusted editing;
6. whether the work can form one narrow, browser-testable vertical slice.

Candidate directions, not commitments:

### A. Exact furniture-to-boundary rules

Examples:

- minimum distance from furniture contour to a room wall;
- explicit wall/corner clearance evidence;
- shared numeric and visual geometry authority.

Value: extends exact planning semantics naturally.  
Risk: wall identity and nearest-boundary semantics must remain clear for ordinary users.

### B. More deterministic room shapes

Extend planning beyond a single axis-aligned rectangular room only where containment, anchors and explanations remain deterministic.

Value: broader real-project coverage.  
Risk: candidate explosion and ambiguous placement semantics.

### C. Recognition quality measurement

Create representative fixtures, metrics and reproducible baselines for M4.5 before more threshold or model tuning.

Value: converts subjective recognition complaints into actionable evidence.  
Risk: fixture preparation effort without immediate visible feature breadth.

### D. Evidence-driven spatial polish

Camera persistence, unusual-plan framing or accessibility only where browser evidence shows a real blocker.

Value: usability improvement for existing 3D.  
Risk: lower core value if no representative problem is present.

### E. Product infrastructure

Accounts, cloud sync, collaboration and managed AI must remain separate initiatives with their own security, privacy, billing and migration design.

Value: multi-device and collaborative workflows.  
Risk: high operational scope; must not be bundled into planning features.

## Explicit non-goals until separately approved

- autonomous whole-apartment mutation;
- free-form model-generated coordinates;
- opaque model-only ranking;
- mandatory network dependency for editing/planning;
- direct 3D editing;
- photorealistic generation presented as product truth;
- generic rule engine without reviewed semantics;
- broad infrastructure mixed into a geometry milestone.

## Recommended workflow for the next slice

```text
review actual user evidence and known limits
→ compare 2–3 narrow product options
→ choose one explicit problem and acceptance scenario
→ focused design/spec
→ TDD implementation
→ strict CI
→ representative browser acceptance
→ merge and canonical documentation
```

Precision, recognition and M5 polish remain evidence-driven backlog. The roadmap advances only after the next prioritization decision is made explicitly.
