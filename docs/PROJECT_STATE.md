# Vlezet — Project State

**Last updated:** 2026-08-09  
**Status:** M0–M7.8B are implemented, product-accepted and merged. M8.0 Public Beta Product Contract is merged. M8.1 Editor Interaction Foundation is fully implemented and product-owner accepted in PR #85; protected merge remains the final delivery gate. M8.2 Precision Drawing and Structural Editing is the selected next implementation slice after M8.1 reaches `main`.  
**Target:** public free beta suitable for unfamiliar users.  
**Canonical rule:** read this file first, then `docs/ROADMAP.md`, `docs/product/UX_ROADMAP.md`, the latest focused changelog and the active design/plan.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners and buyers.

> Draw or import a real apartment, work with understandable real dimensions, place furniture and appliances, understand fit/collisions/usability and export a clean plan — without learning professional CAD.

The beta product is intentionally **not** a generic diagram editor and **not** an AI-recognition product.

Target interaction quality may learn from mature canvas tools, but architectural semantics remain stricter:

- walls remain topological physical walls;
- openings remain attached to validated host walls;
- rooms remain derived;
- furniture keeps physical millimetre dimensions;
- graphical group scaling may not destroy real-world semantics.

Priorities:

1. precision and trust before decoration;
2. strong manual editing before speculative automation;
3. structured editable geometry rather than image-only plans;
4. millimetres as canonical world units;
5. local-first core editing;
6. familiar, predictable mouse/trackpad/keyboard interactions;
7. understandable semantics for ordinary users;
8. AI/CV only as optional reviewable assistance;
9. 3D as a projection of the same document;
10. deterministic validation and semantic Undo/Redo.

## 2. Non-negotiable architecture

1. `VlezetDocument` is the only persistent apartment/layout source of truth.
2. Millimetres are canonical; Canvas/WebGL pixels are never persisted as geometry.
3. Framework-independent packages retain domain authority.
4. Konva and Three.js are projections, never geometry authority.
5. Rooms, areas, dimensions, floors and 3D meshes are derived.
6. Project formats are versioned and migrated deterministically.
7. Undo/Redo is semantic-command oriented.
8. Local editing never depends on network latency.
9. AI/CV create suggestions only; deterministic validation remains authoritative.
10. Existing geometry is never silently replaced or repaired.
11. 3D is read-only and has no parallel editor/fit state.
12. Planning constraints, candidates, Preview and evidence are ephemeral.
13. Only explicit semantic editor commands mutate ordinary document entities.
14. M2 remains containment/collision/door/clearance authority.
15. Optional LLM interpretation cannot generate authoritative coordinates or bypass validation.
16. Provider keys/raw responses remain runtime-only.
17. Responsive shell, selection, viewport, workflow return targets and transient gesture state are UI/runtime state unless an explicit future persistence design proves otherwise.
18. Recognition/assistance must preserve explicit user authority and fail closed under ambiguity.
19. Arbitrary graphical group scaling is not a valid structural editing primitive.
20. Structural batch mutation must preserve topology and hosted-opening validity atomically; no partial mutation of mixed/unsupported selections.

## 3. Repository and stack

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent model and migrations
packages/geometry        geometry/math authority
packages/editor-core     semantic editing/history/snapping
packages/projects        local-first persistence
packages/recognition     experimental/assisted CV and benchmark work
packages/spatial         renderer-neutral 3D projection
packages/planning        deterministic planning + reviewed intent
```

- 2D: Konva / react-konva;
- 3D: plain Three.js over `SpatialScene`;
- state: Zustand plus local ephemeral React state;
- persistence: IndexedDB;
- workspace: pnpm + Turborepo;
- browser acceptance: Playwright Chromium full representative flow + WebKit representative suite.

## 4. Accepted milestones

| Milestone | Result |
|---|---|
| M0–M4.6 | trusted 2D shell, projects, reference import, editable recognition MVP and precision geometry UX |
| M5.1–M5.4 | deterministic read-only 3D shell, furniture and spatial inspection |
| M6.1–M6.4 | deterministic planning, exact constraints and reviewed language intent |
| M7.0–M7.7 | editor shell, context inspector, design system, feedback, recovery, geometry and furniture workflows |
| M7.8A | recognition benchmark foundation, deterministic corpus/scorer/evidence |
| M7.8B | region-first source normalisation, wall topology, bounded Draft and verification-only AI |
| M8.0 | public-beta product contract, roadmap reset and manual-editor-first direction |
| M8.1 | product-owner accepted in PR #85; protected merge pending |

## 5. Recognition experiment outcome

M7.8C and its stacked experimental work were **not product-accepted**.

The final original-plan retest still showed insufficient usefulness:

- structural geometry remained incomplete/ambiguous;
- visible windows were not reliably recovered;
- service/sanitary notation still competed with structural geometry;
- AI verification largely confirmed/rejected existing candidates and did not solve missing geometry.

PRs #42, #44 and #45 were therefore closed without merge. Their benchmark/safety work is preserved as R&D evidence.

Automatic whole-plan recognition remains tracked under #27 but no longer controls the public-beta critical path.

The earlier Assisted Tracing design PR #52 is also closed without merge. Its concepts are preserved, while implementation is intentionally deferred to M8.4 after the editor/calibration foundation.

## 6. Current product capability

### Editing/projects

- topological walls, rooms and hosted openings;
- clear dimensions and usable area;
- furniture with exact transforms and clearances;
- explainable fit/collision/door diagnostics;
- semantic Undo/Redo;
- local projects, autosave, portable backup and PNG export.

### M8.1 interaction foundation — product accepted

M8.1 replaces the former split single-entity interaction substrate with one deterministic runtime interaction model while keeping apartment semantics authoritative.

Accepted behavior:

- unified semantic selection with primary + multiple refs;
- click/modifier toggle, marquee and Select All semantics;
- capability-aware actions with fail-closed mixed/structural operations;
- rigid multi-object movement for placed furniture/appliances/custom objects;
- semantic placed-object Copy/Cut/Paste/Duplicate with fresh IDs and atomic history;
- central command registry shared by keyboard/UI/context-menu consumers;
- ordinary wheel/two-finger pan;
- modified pointer-centred zoom;
- Space+drag and middle-button pan;
- fit-plan and fit-selection;
- compact multi-selection inspector and semantic context menu;
- existing single-entity inspector compatibility;
- no arbitrary group scaling;
- no document/project schema migration.

The final product-owner correction addressed selected-furniture group drag around grid snap thresholds. The fix reconciles the imperative Konva node from authoritative preview state before paint without changing snap policy, M2 fit authority or semantic history.

Acceptance evidence:

```text
product-accepted head:       db66de524783a43fa021db07a6b67808c4435e9b
CI #4813:                    PASS
Recognition Benchmark #1149: PASS
Browser Acceptance #1269:   PASS
  Chromium:                  PASS
  WebKit:                    PASS
product-owner retest:        PASS — 2026-08-09
```

Canonical acceptance record: `docs/milestones/m8-1-acceptance.md`.

### Reference/recognition

Accepted source import/calibration and M7.8A/B benchmark infrastructure remain available. Recognition is assistive/experimental and not a beta dependency.

### 3D/planning

Existing deterministic read-only 3D and bounded planning remain available, but they are not the next beta-critical investment.

## 7. Public beta programme

```text
DONE* M8.1  Editor Interaction Foundation
NOW*  M8.2  Precision Drawing and Structural Editing
THEN  M8.3  Precision Reference Calibration
THEN  M8.4  Assisted Tracing
THEN  M8.5  Furniture 2.0
THEN  M8.6  Export, Appearance and Presentation
THEN  M8.7  Public Beta Hardening
TARGET PUBLIC FREE BETA
```

`*` M8.1 is product-owner accepted but not yet integrated into `main`; M8.2 is selected next and must not begin until the protected M8.1 merge completes.

Programme tracker: #53.

## 8. NEXT — M8.2 Precision Drawing and Structural Editing

Tracker: #56.

Primary goal:

> Make exact apartment structure creation and repair fast enough to stay on the Canvas instead of repeatedly creating geometry and correcting it through inspectors.

Required design direction:

1. named visible snap guides;
2. endpoint, wall-axis, midpoint and intersection snapping;
3. parallel/perpendicular assistance;
4. exact inline wall length and useful angle input;
5. direct vertex/junction editing;
6. topology-safe structural movement;
7. atomic multi-wall common-property editing, starting with wall thickness where valid;
8. structural clipboard only with explicit dependency closure;
9. hosted-opening preservation/revalidation;
10. one semantic history operation per committed structural gesture;
11. no partial mutation when a structural selection cannot be transformed safely.

The M8.1 product-owner request for changing common properties of multiple selected walls, at minimum wall thickness, is explicitly owned by this slice.

Before product implementation begins, M8.2 requires its own written design and task-by-task TDD plan. It must not reuse placed-object batch semantics blindly for topology-sensitive structures.

## 9. Public beta acceptance journeys

- `BETA-01 Blank` — manually build a small exact apartment with walls/openings.
- `BETA-02 Reference` — import, calibrate, verify scale and trace a real plan.
- `BETA-03 Edit` — multi-select/move/copy/paste/duplicate with exact Undo/Redo.
- `BETA-04 Furnish` — place/edit common furniture and understand fit.
- `BETA-05 Export` — export the whole plan and selection to PNG/SVG.

M8.1 materially advances `BETA-03`; M8.2 is the next dependency for `BETA-01` and later calibrated-reference tracing.

## 10. Mandatory engineering policy — TDD

Every deterministic M8 behaviour is developed through genuine **RED → GREEN → regression/refactor**.

- focused failing contract before production behaviour;
- verify the intended RED failure;
- smallest correct GREEN implementation;
- focused + adjacent/full regression gates;
- no weakening tests, validation or thresholds merely to make CI green;
- browser gesture/interaction changes require real Chromium coverage and representative WebKit coverage where engine behaviour can differ;
- manual acceptance is for genuinely observational evidence only, not as a substitute for automatable tests.

## 11. Mandatory documentation policy — CHANGELOG

Every accepted M8 slice must maintain both:

- focused `docs/changelog/YYYY-MM-DD-<slice>.md` history;
- concise canonical `docs/CHANGELOG.md` entry.

The focused record must state:

1. why the work was required;
2. user-visible changes;
3. architecture/authority decisions;
4. meaningful RED/GREEN evidence;
5. regressions found/fixed;
6. intentional deferrals/non-goals;
7. exact-head CI/browser evidence;
8. product-owner acceptance when required;
9. final protected merge identity.

Canonical state/roadmap files must distinguish product acceptance from actual integration truth. Merge identity is recorded only after GitHub reports the protected merge.

## 12. Delivery workflow

Every M8 slice requires:

```text
approved written design
→ task-by-task implementation plan
→ isolated Draft PR
→ TDD RED/GREEN work
→ focused regressions
→ full CI + browser evidence
→ product-owner acceptance where defined
→ canonical acceptance sync
→ fresh exact-head gate
→ protected squash merge
→ post-merge identity/state verification
```

A green pipeline alone never implies product acceptance, and product acceptance alone never implies merge.
