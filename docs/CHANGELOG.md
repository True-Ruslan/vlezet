# Vlezet — Changelog

**Purpose:** preserve the development history, accepted product decisions, architecture boundaries, browser findings and verification evidence needed to reconstruct project context in a new chat.

This is a milestone changelog rather than a package-release log. Detailed acceptance records remain in `docs/milestones/`.

## 2026-07-30 — M6.3 Exact Spatial Constraints accepted and merged

PR #15 squash merge:

```text
724058fe57d769e7c1329f3536d6869405e6ac42
```

Final accepted head and CI:

```text
f3f093df2cc6dba2aa0f6590b2c0250287f7c6b8
GitHub Actions 30542599616 — PASS
```

### Why

M6.2 could express qualitative intent such as “closer” or “near a wall”, but ordinary users also need precise requirements such as:

> Between these two pieces of furniture there must be at least 800 mm.

The rule had to be exact, understandable, deterministic and visually provable without turning Canvas or Three.js into geometry authority.

### Delivered

Hard structured rule:

```text
pair-min-gap(objectA, objectB, minimumMm)
```

Accepted semantics:

- canonical millimetres;
- shortest Euclidean edge-to-edge distance between oriented furniture footprints;
- touching and overlap measure `0`;
- finite non-negative values only;
- `0` is a real rule; empty input means no rule;
- normalized unordered object pair;
- malformed, duplicate, self-pair and outside-selection rules fail closed;
- exact hard validity cannot be rescued by soft ranking;
- impossible requirements return no violating alternatives.

Geometry authority:

```ts
minimumGapWitnessBetweenOrientedRectangles()
minimumDistanceBetweenOrientedRectangles()
```

The numeric API delegates to the witness API. Planning validation, structured evidence and the 2D visualization therefore use one closest-distance calculation.

Structured evidence:

```ts
{
  kind: "pair-min-gap";
  objectIds: [string, string];
  requiredMm: number;
  actualMm: number;
  satisfied: boolean;
}
```

UX:

- input renamed to `↔ Минимальный зазор по контурам`;
- helper explains that this is not an object dimension or centre distance;
- result cards show `Фактически`, `Требуется: ≥` and contour semantics;
- Preview renders a violet dashed double-arrow between authoritative nearest contour points;
- endpoint markers, zero-contact marker and `↔ Зазор N мм` pill;
- one deterministic active exact pair at a time;
- explicit `Показывается на плане` / `Показать на плане` switching;
- fixed screen-space style and viewport-clamped label;
- stale invalid Preview uses danger semantics;
- overlay is non-interactive and uses the existing Konva object layer.

Browser regression fixed:

- furniture selection could widen root Grid min-content and push the right inspector outside the viewport;
- retained `.editor-app { grid-template-columns: minmax(0, 1fr); }`;
- optional toolbar copy collapses before desktop overflow;
- accepted at the previously failing viewport/browser scale.

Architecture preserved:

- no `VlezetDocument` schema or migration change;
- no persistent planning state in IndexedDB/autosave/backup/export;
- M2 remains fit/collision/door/clearance authority;
- Preview, active pair, exact evidence overlay and constraints remain ephemeral;
- Apply/history code path remains explicit, revalidated and one-step undoable;
- no generic rule engine, wall-gap rule, LLM correctness dependency, whole-apartment autonomy or direct 3D editing.

TDD gates covered:

1. missing exact geometry primitive;
2. exact `799 / 800 / 842` boundary;
3. stale Apply/direct-candidate revalidation;
4. misleading hard-constraint summary;
5. hidden later exact evidence;
6. inspector viewport overflow;
7. missing closest-point witness;
8. missing structured candidate evidence;
9. missing active-pair ephemeral state;
10. missing pure annotation view-model;
11. missing exact cards;
12. missing non-interactive canvas overlay and layer-budget integration.

Manual browser acceptance: **PASS**.

Product owner confirmed:

> «Все работает супер идеально, ты гений величайший.»

Canonical evidence: `docs/milestones/m6-3-acceptance.md`.

Roadmap consequence: M6.3 is complete. Next is **M6.4 Reviewed Natural-Language Intent**, an optional translation layer that produces a user-reviewed structured constraint draft before the existing deterministic planner runs.

---

## 2026-07-23 — M6.2 Constraint-Aware Planning accepted and merged

PR #13 squash merge:

```text
db68d697540ddb9901fbddad0763d769e7d16851
```

Accepted head/run:

```text
a32b5f633ee5c36dafb5578d3c0c3f7eaa46d649
GitHub Actions 29962203961 — PASS
```

### Why

M6.1 generated valid alternatives but could not express what the user cared about. M6.2 added a deliberately small structured vocabulary without weakening M2 authority.

### Delivered

- hard `lock-object` → `Не двигать`;
- soft `prefer-room-boundary` → wall/corner;
- soft `pair-distance` → near/far;
- explicit centre-to-centre pair evidence;
- stable normalization and intent-sensitive candidate identity;
- shared `validatePlanningConstraintSet()` at request and candidate/Apply boundaries;
- hard rejection before deterministic soft ranking;
- stale result/Preview clearing;
- explicit current-document-revalidated atomic Apply;
- no LLM/API dependency or second persistent planning state.

Manual browser acceptance: **PASS**.

Product owner confirmed:

> «Это работает настолько все гениально и четко как ты сказал, что я в восторге.»

Canonical evidence: `docs/milestones/m6-2-acceptance.md`.

---

## 2026-07-22 — M6.1 Deterministic Layout Alternatives accepted and merged

PR #11 squash merge:

```text
f2bbf1c4989ef4582ee86aba19c75a71679034be
```

Accepted head/run:

```text
acaa352545245ff079f55fb8ce85ba2a23f2312d
GitHub Actions 29953127208 — PASS
```

### Delivered

- framework-independent `@vlezet/planning`;
- one supported deterministic rectangular room;
- 1–3 selected existing objects;
- fixed non-selected obstacles;
- footprint-aware deterministic anchors/orientations;
- bounded generation (`MAX_PLANNING_EVALUATIONS = 6000`);
- maximum three alternatives;
- M2-authoritative containment/collision/door/clearance validation;
- deterministic ranking and explanations;
- non-mutating 2D ghost Preview;
- explicit revalidated Apply;
- one multi-object Apply = one Undo/Redo operation.

Manual browser acceptance: **PASS**.

Product owner confirmed:

> «Все работает строго по сценарию.»

Canonical evidence: `docs/milestones/m6-1-acceptance.md`.

---

## 2026-07-22 — M5.4 Spatial Inspection accepted and merged

PR #10 squash merge:

```text
0bffe36d74d2ff0865d700b51b17ee08e7001094
```

Accepted head/run:

```text
e9980f63d574d1a9cb6614980788270a50cde47e
GitHub Actions 29948749864 — PASS
```

### Delivered

- semantic 3D hover/select for rooms, walls and placed objects;
- stable entity IDs across split meshes;
- read-only authoritative inspector;
- canonical room area and clear dimensions;
- wall centreline/thickness facts;
- M2 object fit status and reasons;
- whole-logical-wall highlighting;
- opening-placeholder skip logic;
- deterministic temporary material cleanup;
- no 3D mutation, mesh measurement authority or mesh collision authority.

Product owner confirmed:

> «Все работает круто как ты и описал.»

Canonical evidence: `docs/milestones/m5-4-acceptance.md`.

---

## 2026-07-22 — M5.2 Furniture in 3D accepted and merged

PR #9 squash merge:

```text
7f7e8dfd9c875145bfa3d307638cd8cd27051a3a
```

### Delivered

- `SpatialScene.objects`;
- exact projection of ordinary placed objects;
- deterministic X/Y→X/Z mapping and rotation;
- stored/default projection height semantics;
- semantic metadata;
- generic Three.js primitives;
- fail-closed invalid-object projection;
- explicit resource disposal;
- no second 3D furniture state and no mesh collision authority.

---

## 2026-07-22 — M5.1 Deterministic Spatial 3D Shell accepted and merged

PR #8 squash merge:

```text
4acca82b04c87b3737eb87a03f9ee2ff360b5073
```

### Delivered

- framework-independent spatial projection;
- physical wall prisms and opening-aware segmentation;
- usable room floors;
- semantic schematic opening markers;
- fail-closed diagnostics;
- orbit/pan/zoom and camera presets;
- fit camera;
- safe 2D↔3D switching;
- WebGL isolation and explicit GPU cleanup.

Architecture decision: M5.3 camera/navigation foundation was effectively delivered here. Remaining M5.3 work is evidence-driven polish only.

---

## 2026-07-22 — M4.6 Precision Geometry UX accepted and merged

PR #7 merge:

```text
a718bf605d8b3bde8dc87953c340b7b0e9565fdb
```

### Why

Users interpreted entered wall lengths as clear room dimensions and reasonably expected `3550 × 3300 = 11.72 m²`. The prior centreline/thickness result appeared incorrect without explicit semantics.

### Delivered

- explicit centreline wall-length semantics;
- clear internal rectangular room dimensions;
- deterministic usable-area consistency and rounding;
- wall-thickness fixed-face/alignment semantics;
- dimension annotations and `Размеры` toggle;
- ephemeral tape measurement tool.

Accepted regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

---

## 2026-07-22 — M4.5 Assisted Recognition accepted as experimental MVP

PR #6 merge:

```text
b63bdd613db4e13c07d2a961981799bd360f256d
```

### Delivered

- local OpenCV/Web Worker recognition;
- persistent editable `RecognitionDraft`;
- review/edit/accept/reject workflow;
- deterministic image→mm Apply;
- duplicate/conflict protection;
- one-batch Undo/Redo;
- stale handling;
- optional OpenRouter BYOK refinement.

Product decision: recognition is assisted and experimental, not authoritative automatic reconstruction. Accuracy refinement remains a separate evidence-driven backlog.

---

## 2026-07-22 — Repository made public and CI restored

The private repository exhausted included GitHub-hosted Actions minutes. The repository was made public, standard hosted runners became available again and pipelines returned to green.

Self-hosted MacBook runners were considered but rejected as unnecessary operational complexity for the current stage.

---

## Earlier foundation milestones

### M4 — Reference Plan Import

PR #5 merge: `12e9696e11572ad5ec055f3dfad98ad7826184e2`

Delivered local JPG/PNG/PDF import, validation/rasterization, calibration, alignment, reference asset persistence, tracing, reference-aware fitting, portable backup and PNG export controls.

### M3 — Local-First Projects

PR #4 merge: `6c32249acc8e333e62fceee2ea4e76ca83890c77`

Delivered project dashboard/lifecycle, IndexedDB persistence, autosave/retry, viewport restoration, backup/import and PNG export.

### M2 — Furnishing and Fit

PR #3 merge: `aa34f24572f2e67714604634587a1c41e4067cd8`

Delivered placed furniture/appliances, exact dimensions/transforms, snapping, containment, collisions, door-swing obstruction, directional clearances and explainable fit statuses.

### M1 — Apartment Shell

PR #2 merge: `3944c7f9d668a645e1dc05805f476d2f3290eb94`

Delivered topological walls/vertices, T-junctions, physical thickness, deterministic room derivation/usable area, room names, host-wall doors/windows and geometry diagnostics.

### M0 — Foundation and Infinite Canvas

PR #1 merge: `099a202413459674d2b50c33d2c1fa125a0fef6f`

Delivered monorepo/package boundaries, millimetre world coordinates, infinite 2D canvas, pan/zoom/grid, wall drawing, snapping, semantic history and reproducible CI.