# Vlezet — Project State

**Last updated:** 2026-08-10  
**Status:** M0–M8.1 are implemented, product-accepted and merged. M8.2 Precision Drawing and Structural Editing is implemented in Draft PR #87 through its dedicated Chromium/WebKit automated acceptance gate; product-owner acceptance and protected delivery remain pending.  
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
| M8.1 | product-owner accepted and squash-merged as `867ec54d21b1dcb94d519ace3bec0a3635717022` |

M8.2 is **not** listed as accepted yet. Its automated implementation gates are green, while explicit product-owner acceptance remains a separate required state.

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

### M8.1 interaction foundation — accepted and merged

M8.1 replaced the former split single-entity interaction substrate with one deterministic runtime interaction model while keeping apartment semantics authoritative.

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

Integration evidence:

```text
product-accepted interaction head: db66de524783a43fa021db07a6b67808c4435e9b
final documentation head:          f8318182d3a9e7c835ebf079de2710d6106d7829
CI #4819:                           PASS
Recognition Benchmark #1155:       PASS
Browser Acceptance #1275:          PASS
  Chromium:                         PASS
  WebKit:                           PASS
product-owner retest:               PASS — 2026-08-09
protected squash merge:             867ec54d21b1dcb94d519ace3bec0a3635717022
```

Canonical acceptance record: `docs/milestones/m8-1-acceptance.md`.

### M8.2 structural precision — automated gates green, acceptance pending

Draft PR #87 implements the approved M8.2 design while preserving the M8.1 runtime and the structural authority boundaries above.

Implemented behavior includes:

- renderer-independent Canvas angle authority;
- named endpoint/junction/midpoint/intersection/wall-axis and construction-assistance snapping with deterministic priority/hysteresis;
- visible `Привязки` control and gesture-local Alt/Option suppression;
- exact near-cursor wall length/angle input with keyboard focus/Escape semantics;
- direct structural endpoint/junction handles with accessible hit targets;
- atomic structural candidate evaluation in `@vlezet/editor-core`;
- topology-safe vertex movement and wall-body translation;
- hosted-opening preservation/revalidation;
- atomic centred multi-wall thickness editing;
- strict dependency-closed structural Copy/Cut/Paste with fresh IDs;
- one semantic history command per valid structural commit and none for preview/cancel/reject;
- explicit valid/invalid structural feedback rather than colour-only signalling.

Dedicated Task 9 automated acceptance checkpoint:

```text
head:                         66d27a673679f26a4a414213415f1603a02aad6a
CI #4915:                     PASS
Browser Acceptance #1365:    PASS
  Chromium M8.2 flow:         PASS
  WebKit representative:      PASS
browser artifact:             9056208133
artifact digest:              sha256:00c34117d81ec257ad6f491df5781af0230fdb783e8bd8e2dbb48662d5bd740e
product-owner acceptance:     PENDING
protected merge:              PENDING
```

The browser hardening process intentionally produced several test-only RED iterations while the acceptance harness was aligned with actual product semantics (continued wall chaining after exact Enter, real endpoint closure, stable screen coordinates, onboarding isolation and avoiding the hosted-opening hit area). Those iterations did **not** establish a production defect and did not weaken structural validation.

### Reference/recognition

Accepted source import/calibration and M7.8A/B benchmark infrastructure remain available. Recognition is assistive/experimental and not a beta dependency.

### 3D/planning

Existing deterministic read-only 3D and bounded planning remain available, but they are not the next beta-critical investment.

## 7. Public beta programme

```text
DONE  M8.1  Editor Interaction Foundation
NOW   M8.2  Precision Drawing and Structural Editing
      automated implementation gates GREEN; product-owner acceptance pending
THEN  M8.3  Precision Reference Calibration
THEN  M8.4  Assisted Tracing
THEN  M8.5  Furniture 2.0
THEN  M8.6  Export, Appearance and Presentation
THEN  M8.7  Public Beta Hardening
TARGET PUBLIC FREE BETA
```

Programme tracker: #53. M8.2 tracker: #56. Implementation PR: #87.

## 8. CURRENT GATE — M8.2 product-owner acceptance

Primary M8.2 outcome:

> Make exact apartment structure creation and repair fast enough to stay on the Canvas instead of repeatedly creating geometry and correcting it through inspectors.

Automated implementation and browser gates are green. The next gate is focused product-owner acceptance on the exact M8.2 candidate. Acceptance should exercise at minimum:

1. exact wall creation by pointer and numeric length/angle;
2. visible snapping and expected endpoint/midpoint/wall-axis behaviour;
3. direct shared-endpoint editing with predictable Undo/Redo;
4. valid wall translation with hosted opening preserved;
5. invalid structural movement rejected without partial mutation/history;
6. compatible multi-wall thickness update as one atomic action;
7. structural Copy/Paste on a dependency-closed fragment and rejection of an unsafe connected fragment.

Do **not** mark M8.2 accepted, Ready or merged from CI alone. After explicit product-owner PASS, create the acceptance record, synchronize canonical state, run a fresh exact-head gate and only then perform the separately authorized protected squash merge.

## 9. Public beta acceptance journeys

- `BETA-01 Blank` — manually build a small exact apartment with walls/openings.
- `BETA-02 Reference` — import, calibrate, verify scale and trace a real plan.
- `BETA-03 Edit` — multi-select/move/copy/paste/duplicate with exact Undo/Redo.
- `BETA-04 Furnish` — place/edit common furniture and understand fit.
- `BETA-05 Export` — export the whole plan and selection to PNG/SVG.

M8.1 materially advances `BETA-03`; M8.2 is the structural foundation for `BETA-01` and later calibrated-reference tracing.

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

Canonical state/roadmap files must distinguish automated verification, product acceptance and actual integration truth. Merge identity is recorded only after GitHub reports the protected merge.

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
