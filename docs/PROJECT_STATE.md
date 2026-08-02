# Vlezet — Project State

**Last updated:** 2026-08-03  
**Status:** M0–M7.8B are implemented and product-accepted. M7.8A established the versioned recognition benchmark. M7.8B delivered region-first source normalisation, bounded wall topology and verification-only AI. PR #41 is in final exact-head verification before squash merge. The selected next implementation slice is M7.8C — opening classification and host-wall validation.  
**Canonical rule:** read this file first in a new chat, then `docs/product/UX_ROADMAP.md`, the latest milestone acceptance record and `docs/ROADMAP.md`.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners and buyers.

> Draw or import a real apartment, work with understandable real dimensions, place furniture and appliances, and understand what fits, collides and remains usable — without learning professional CAD.

Priorities:

1. precision and trust before decoration;
2. structured editable geometry rather than image-only plans;
3. millimetres as the canonical world unit;
4. local-first core editing;
5. understandable semantics for ordinary users;
6. AI/CV only as reviewable assistance;
7. 3D as a projection of the same document;
8. deterministic, explainable planning with explicit Apply;
9. reachability, hierarchy and accessibility before feature expansion.

## 2. Non-negotiable architecture

1. `VlezetDocument` is the only persistent apartment/layout source of truth.
2. Millimetres are canonical; Canvas/WebGL pixels are never persisted as geometry.
3. Framework-independent packages retain domain authority.
4. Konva and Three.js are projections, never geometry authority.
5. Rooms, areas, dimensions, floors and 3D meshes are derived.
6. Project formats are versioned and migrated deterministically.
7. Undo/Redo is semantic-command oriented.
8. Local editing never depends on network latency.
9. AI/CV create editable suggestions only; deterministic validation remains authoritative.
10. Existing geometry is never silently replaced.
11. 3D is read-only and has no parallel editor/fit state.
12. Planning constraints, candidates, Preview and evidence are ephemeral.
13. Only explicit Apply mutates ordinary document entities.
14. M2 remains containment/collision/door/clearance authority.
15. Optional LLM interpretation cannot generate authoritative coordinates or bypass validation.
16. Provider keys, raw responses and language drafts are runtime-only.
17. Responsive shell, workflow return targets and panel visibility are ephemeral UI state.
18. M7 presentation work must not create a second persistent product truth.
19. Geometry-inspector and furniture-workflow presentation state is runtime-only.
20. Recognition candidates must preserve editable Draft and explicit Apply authority.

## 3. Repository and stack

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent model and migrations
packages/geometry        geometry/math authority
packages/editor-core     semantic editing/history/snapping
packages/projects        local-first persistence
packages/recognition     assisted CV/reconciliation
packages/spatial         renderer-neutral 3D projection
packages/planning        deterministic planning + reviewed intent
```

- 2D: Konva / react-konva;
- 3D: plain Three.js over `SpatialScene`;
- state: Zustand plus local ephemeral React state;
- persistence: IndexedDB;
- workspace: pnpm + Turborepo;
- browser acceptance: Playwright Chromium full flow + WebKit representative suite.

## 4. Accepted milestones

| Milestone | Result |
|---|---|
| M0–M4.6 | trusted 2D shell, projects, reference import, editable recognition MVP and precision geometry UX |
| M5.1–M5.4 | deterministic read-only 3D shell, furniture and spatial inspection |
| M6.1–M6.4 | deterministic planning, exact constraints and reviewed language intent |
| M7.0–M7.7 | editor shell, context inspector, design system, feedback, recovery, geometry and furniture workflows |
| M7.8A | recognition benchmark foundation, deterministic corpus/scorer/evidence |
| M7.8B | region-first source normalisation, wall topology, bounded Draft and verification-only AI |

Canonical merge SHAs through M7.7 remain recorded in repository history and milestone acceptance records.

## 5. Current capability

### Editing and projects

- topological walls, rooms and openings;
- clear dimensions and usable area;
- furniture with exact transforms and clearances;
- explainable fit/collision/door diagnostics;
- semantic Undo/Redo;
- local projects, autosave, backup and PNG.

### Reference and recognition

- local JPG/PNG/PDF calibration and tracing;
- corrected calibration magnifier and direction-independent orientation;
- versioned nine-fixture recognition benchmark and evidence bundle;
- region-first extraction of thick architectural wall regions;
- bounded Canny/Hough fallback;
- fail-closed candidate-overload protection;
- editable local Draft candidates;
- verification-only OpenRouter review bound to exact local IDs and coordinates;
- rejection of cloud-only, moved, unbounded or overloaded geometry;
- explicit Apply; AI output remains non-authoritative.

### 3D and planning

- deterministic read-only shell/furniture projection and semantic inspection;
- bounded deterministic alternatives for one rectangular room and 1–3 objects;
- lock, wall/corner, near/far and exact pair-gap rules;
- reviewed natural-language intent;
- explicit Preview and revalidated atomic Apply.

## 6. M7.8B accepted evidence

Product-owner acceptance:

> Все работает. Вот результат проверок. Все еще не идеально как видишь.

Representative real-plan result:

```text
local wall candidates: 27
confirmed after AI:     19
remaining for review:   8
openings:               0 (deferred)
```

Exact accepted product head before documentation sync:

```text
head:                    d510621958004211f82545c1479c18a42262f510
Standard CI:             30764243357 / #2826 — PASS
Recognition Benchmark:  30764243366 / #161 — PASS
M7 Browser Audit:        30764243359 / #614 — PASS
Source geometry F1:      0.837989
Source topology F1:      0.837989
```

Canonical records:

- `docs/milestones/m7-8b-acceptance.md`;
- `docs/changelog/2026-08-02-m7-8b.md`.

## 7. Known limitations

- Recognition remains assistive and can miss or fragment true walls.
- Confidence classification is not yet perfect.
- Aggregate Source wall-topology F1 remains below the final M7.8 target of `0.90`.
- Perspective-photo recognition remains unresolved.
- Doors/windows, room faces, OCR labels and areas are not yet delivered by the M7.8 programme.
- Stronger provider models improve verification but cannot create missing geometry.
- Clear dimension editing remains limited to simple rectangular rooms.
- Planning remains one rectangular room / 1–3 objects and lacks whole-apartment autonomy.
- 3D remains schematic and read-only.

## 8. NOW — M7.8C Opening Classification and Host-Wall Validation

Goal:

> Classify door/window hypotheses, bind every accepted opening to a known host wall, preserve real gaps and improve room-facing structural correctness without weakening Draft, Apply or deterministic authority.

Required next work:

1. classify local opening hypotheses as door/window/unknown;
2. validate host-wall identity and bounded placement;
3. keep ambiguous openings pending or rejected fail-closed;
4. add opening-heavy and service-block regressions;
5. preserve zero unknown-host openings and zero stale decisions;
6. prepare room-face derivation for the following M7.8 slice;
7. run exact-head Core/Source benchmark, Chromium/WebKit and product-owner acceptance.

Non-goals:

- authoritative AI geometry;
- silent replacement of existing geometry;
- room OCR/area reconciliation before host-wall correctness;
- unrelated M7.9+ accessibility, 3D, planning or dashboard work.

## 9. Delivery workflow

Every M7.x slice requires focused design, implementation plan, TDD/layout contracts, Draft PR, full CI, benchmark evidence where applicable, browser evidence, product-owner acceptance, exact-head squash merge and canonical documentation sync.
