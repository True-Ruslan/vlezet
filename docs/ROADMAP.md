# Vlezet — Roadmap

**Last updated:** 2026-07-30  
**Rule:** deterministic product truth and user trust come before visual spectacle or speculative AI layers.

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
NOW         M6.4 Reviewed Natural-Language Intent
LATER       broader planning and optional product infrastructure
```

## Completed trust foundation

### M4.5 — Assisted Recognition

Merge: `b63bdd613db4e13c07d2a961981799bd360f256d`

Recognition accelerates tracing but is not authoritative floor-plan reconstruction. Candidates are editable, explicit Apply is required, deterministic geometry validation remains authoritative and existing geometry is never silently replaced.

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

> Planning may propose structured alternatives and interpret explicit user intent, but `VlezetDocument` plus deterministic geometry/fit validation remain authoritative. Preview is ephemeral and Apply is explicit.

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

Status: **DONE / ACCEPTED / MERGED**.

Primary contract:

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
- exact constraint composes with M6.2 soft near/far intent;
- impossible minimum offers no violating alternatives.

Accepted authority:

```text
minimumGapWitnessBetweenOrientedRectangles()
        ↓
minimumDistanceBetweenOrientedRectangles()
        ↓
planning hard validation + UI evidence + 2D overlay
```

The numeric result and visualization share one framework-independent geometry calculation.

Accepted UX:

- `↔ Минимальный зазор по контурам` input;
- helper distinguishes contour gap from object dimensions and centre distance;
- structured cards show `Фактически`, `Требуется` and contour semantics;
- violet nearest-contour double-arrow during Preview;
- `↔ Зазор N мм` pill;
- endpoint/contact markers;
- one active exact pair with explicit switching;
- viewport-clamped, non-interactive overlay;
- no sixth Konva Layer;
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

## NOW — M6.4 Reviewed Natural-Language Intent

### Product goal

Let a user describe supported planning intent in ordinary language, convert it into a transparent structured draft, and require explicit review before the existing deterministic planner runs.

The feature is not autonomous design. It is an optional translation layer over already accepted M6.2–M6.3 contracts.

### Narrow first scope

Support only accepted concepts:

- keep an object fixed;
- prefer an object near a wall;
- prefer an object near a corner;
- place two objects nearer/farther;
- require an exact minimum contour gap between two objects.

Example:

```text
“Диван не двигать, стол поставить ближе к окну,
между столом и креслом оставить минимум 800 мм.”
```

Possible reviewed draft:

```ts
[
  { kind: "lock-object", objectId: "sofa" },
  { kind: "prefer-room-boundary", objectId: "table", target: "wall" },
  { kind: "pair-min-gap", objectIds: ["chair", "table"], minimumMm: 800 }
]
```

### Required architecture

```text
natural-language request
        ↓ optional interpreter adapter
structured intent draft + ambiguities + unsupported fragments
        ↓ explicit user review/edit/confirmation
existing validatePlanningConstraintSet()
        ↓
existing deterministic M6 planner/evaluator
        ↓
Preview / explicit Apply
```

Requirements:

1. interpreter output is never authoritative;
2. object references resolve only within the selected room/planning set;
3. ambiguous names produce explicit choices, not guesses;
4. unsupported intent is shown and rejected or omitted only with user acknowledgement;
5. numeric units normalize explicitly to canonical millimetres;
6. the draft is editable using ordinary structured controls;
7. generation requires explicit confirmation;
8. manual structured planning remains available when the interpreter/network is unavailable;
9. existing hard validation and Apply revalidation remain unchanged;
10. no raw model response becomes persistent project state.

### Acceptance requirements

- same confirmed structured draft → same ordered alternatives;
- interpreter cannot bypass hard validation;
- ambiguous object references fail closed;
- unsupported language is visible and controlled;
- confirmed draft exactly matches controls shown to the user;
- editing the draft clears stale results and Preview;
- network/model failure never blocks manual planning or core editing;
- Preview remains non-mutating;
- Apply remains explicit and one-step undoable;
- exact-head strict CI and representative browser acceptance before merge.

### Explicit non-goals

Do not make M6.4:

- free-form coordinate or geometry generation;
- autonomous whole-apartment design;
- direct document mutation from text;
- opaque model-only scoring;
- open-ended generic rule language;
- photorealistic interior generation;
- direct 3D editing;
- mandatory network dependency.

## Later directions

Only after M6.4 is accepted:

- broader structured planning vocabulary;
- more room types where semantics remain deterministic;
- optional exact furniture-to-boundary rules;
- whole-apartment coordination as an explicitly reviewed multi-room workflow;
- accounts/cloud collaboration and managed AI as separate infrastructure initiatives;
- decorative 3D assets/photorealism only after the precision workflow is mature.

## Recommended workflow

```text
M6.4 focused product/design spec
→ define supported phrases, references and ambiguity policy
→ TDD pure structured intent-draft contract
→ optional interpreter adapter
→ explicit review/edit/confirm UI
→ existing deterministic planner integration
→ stale/error/offline fallback tests
→ representative browser acceptance
→ exact-head strict CI
→ squash merge
```

Precision, recognition and M5 polish remain evidence-driven backlog and should not interrupt M6.4 unless they become actual user blockers.