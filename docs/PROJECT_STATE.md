# Vlezet — Project State

**Last updated:** 2026-08-12  
**Status:** M0–M8.1 are implemented, product-accepted and merged. M8.2 Precision Drawing and Structural Editing is implemented in Draft PR #87. Its original product-owner acceptance scenarios passed; the wall/whole-room clipboard extension, precise-selection/composite-clipboard correction and direct room-translation correction are automated-green in Chromium and representative WebKit. A focused product-owner retest of the latest M8.2 behavior and protected delivery remain pending.  
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

M8.2 is **not** listed as accepted yet. Its original manual scenarios passed, but product-owner feedback expanded clipboard usability, precise room/composite selection semantics and direct room movement. All three follow-up corrections are automated-green; focused product-owner retest of the latest combined behavior remains pending.

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

### M8.2 structural precision — automated room-translation green, focused product-owner retest pending

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
- copy-safe wall structural projection: a connected wall can be copied/duplicated as a detached self-contained fragment with hosted openings;
- strict dependency-closed structural Cut remains fail-closed for connected topology;
- whole-room Copy/Duplicate projects the exact derived room boundary, including atomic segments of longer backing walls, its hosted doors/windows and explicit room name;
- room Cut remains disabled because destructive shared-topology semantics are ambiguous;
- exact room point-hit uses polygon containment with deterministic smallest/canonical-area ordering, including concave-room cut-outs;
- empty room interiors expose hover/selectability through a geometry fallback without overriding higher-priority Konva entities;
- approved explicit mixed Copy can combine structural room/wall content with **explicitly selected** placed furniture while unsupported mixes remain fail-closed;
- furniture merely located inside a copied room is not implicitly captured;
- ordinary structural Paste can search a bounded deterministic nearby valid position when the requested position intersects existing topology, without weakening validation;
- composite structural + furniture Paste applies the actual accepted structural delta to the complete group so safe-nearby fallback stays rigid and atomic;
- Paste is anchored to the latest Canvas world pointer; a deterministic clipboard-origin fallback is used only before any Canvas pointer has been observed;
- rejected explicit Copy clears stale clipboard content and reports a non-modal status reason instead of leaving an older payload silently pasteable;
- direct drag of a selected isolated room from a free room-interior point moves the room structure as one rigid structural gesture;
- room-only drag does **not** move unselected furniture;
- room + explicitly selected furniture moves by one identical delta and commits atomically;
- `Выбрать мебель в комнате` expands selection only with furniture whose full physical footprint is contained by the derived room polygon; boundary touch is accepted, boundary crossing is excluded;
- higher-priority furniture/wall/opening/structural-handle hits are never stolen by room drag;
- room translation snapping excludes the moving room's own structure, while Alt/Option suppresses snapping only for the current gesture;
- shared/connected unsafe room topology rejects fail-closed with a visible reason and no partial structural/furniture mutation;
- accepted room movement is exactly one semantic `room/translate` history command; reject/no-op/cancel/stale gesture creates none;
- exact wall paste at the source origin still fails closed on overlap;
- one semantic history command per valid structural/composite commit and none for preview/cancel/reject;
- explicit valid/invalid structural feedback rather than colour-only signalling.

Current room clipboard scope remains structural when the room is copied alone: **room shell + hosted openings + explicit room name**. Furniture is included only when the user explicitly selects it as part of an approved composite selection; spatial containment alone never implies Copy. Direct room movement follows the same explicit-membership rule: room-only movement leaves furniture fixed unless it is explicitly selected or added through `Выбрать мебель в комнате`.

Product-owner pre-acceptance result on 2026-08-10:

- all original seven requested M8.2 manual scenarios: **PASS**;
- follow-up usability finding: connected walls and whole rooms were not copy/pasteable in the ordinary editor flow;
- acceptance remained open while that gap, the precise-selection/composite-clipboard correction and the later direct-room-movement requirement were implemented and tested.

Prior wall/room clipboard extension evidence:

```text
initial projection RED:       5b6409c319afadbe18b2b11cf02ad3773d2ae331 / CI #4921 — EXPECTED FAIL
room placement RED:           5146252c253fa9490060cfb68b05567aa0ad1ba4 / CI #4930 — EXPECTED FAIL
browser placement RED:        68c30b062e20b38c3340ccacc4d21fcdb7694737 / Browser #1381 — 32 PASS / 1 FAIL
focused wall placement RED:   ac031fecfba326a4c472db7ebbc3b3e04c4173ae / CI #4935 — EXPECTED FAIL
GREEN head:                   beb25379e0b6a25af0a8af84da878a62c5692e08
CI #4936:                     PASS
Browser Acceptance #1386:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
```

Precise-selection/composite-clipboard correction evidence:

```text
concave room hit RED:         14dc065e3e73de66a6c7b2b89364ce28ac97b744 / CI #4942 — EXPECTED FAIL
mixed-copy capability RED:    96d929a44c483e23ee5409161e8584a6c0993a94 / CI #4954 — EXPECTED FAIL
pointer/composite Paste RED:  50256b799685d0e55e2170bbd2cbf42442206102 / CI #4968 — EXPECTED FAIL
rejected-Copy feedback RED:   23e54361d97b9917b1badf9b2a42cf9eeecee718 / CI #4974 — EXPECTED FAIL
browser interaction RED:      bf5230f7acb03b06fe0b47370d6937bf57c55e2f / CI #4979 PASS / Browser #1429 FAIL
room-hover fallback RED:      601fbd1d281159edc2eac76b9fb561542c49b660 / CI #4980 — EXPECTED FAIL
final automated GREEN head:   fbc5c6ef299aba4daf2257730c99f2c39966c0ab
CI #4986:                     PASS
Browser Acceptance #1436:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser artifact:             9115252220
artifact digest:              sha256:df067068672383db97cead6b75c224f26ad5adea63ffc513ef6c572ca281d7df
```

Direct room-translation correction evidence:

```text
design:                       31075d42841c706d5d8f07839b1e4e946e412e3c
plan:                         feb930e279edeb5a3546a71008f2d1b03b041a8f
editor-core RED:              38876ad1b6d92f719b1a1e26a72c8fbcf2f02720 / CI #4993 — EXPECTED FAIL
editor-core GREEN:            4dd9c65324bcc110569a394208fa759c68b32cac / CI #4995 PASS
footprint containment RED:    ad4116f8d808618609c517de4aa12017634a57e7 / CI #4996 — EXPECTED FAIL
selection-helper RED:         7ec10b6c40e1a115b866d7db68466d5c15b8e25f / CI #4998 — EXPECTED FAIL
selection/helper GREEN:       8759ceb4ddc083c044293c228dc8944e7c096e3a / CI #5000 PASS
room gesture RED:             eaa39b02ac93d067b5d09d55ea78cad65c9328c8 / CI #5001 — EXPECTED FAIL
room gesture GREEN:           57ada4bc285f1a940a40d2b192e58a305582925e / CI #5003 PASS
capability RED:               8a88f0a0263f73803469fcebfeeb68d20baa9f0f / CI #5004 — EXPECTED FAIL
command/UI RED:               6671579fb56669a3c8bdd9ab0ea5fb0281a2a251 / CI #5006 — EXPECTED FAIL
command/UI GREEN:             6fd107fe8c2646433bb372cca865cb8a1cb0539a / CI #5010 PASS
Canvas routing RED:           acead652c019906ccc7d6e8870cb4c5878a7d374 — EXPECTED FAIL
Canvas GREEN:                 61c5dd0a81df7425df52cf247941310a669bfe58 / CI #5012 PASS
browser interaction RED:      e1eb2c81457a6d1b003ab1b1b6cf8fe7fc693d5a / Browser #1463 FAIL
focused feedback RED:         81beec015cf1194d421d7dd4b4473a10d3ffa22f / CI #5016 — EXPECTED FAIL
feedback GREEN:               501059e69c87583ff6f06b3a283f1e9effe42a6d / CI #5017 PASS
implementation/test head:     00cfae03ca66610414ef7451f37f67192efa1f97
CI #5018:                     PASS
Browser Acceptance #1468:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser artifact:             9122287038
artifact digest:              sha256:b6683f810bb9c9a07d44b8b46118b8be9776d52eec81a8e201584c76ebcc114b
review threads:                0
product-owner latest retest:   PENDING
protected merge:               PENDING
```

The browser RED distinguished a genuine product issue from acceptance-harness defects. Unsafe topology originally caused the store to silently refuse gesture start; the focused RED reproduced that missing feedback and the production fix now preserves an invalid room gesture with the structural reason so Canvas can show a fail-closed rejection. Separately, browser checks were corrected to use stable Stage-relative coordinates and a deterministic connected-topology fixture. No production validator was weakened for those harness corrections.

Scope review from the pre-room-translation documentation head `1eda34b409247ddb1a6509c09221ea87b57b8f68` to implementation head `00cfae03ca66610414ef7451f37f67192efa1f97` changes only room translation/selection/editor-core/geometry/browser/spec-plan surfaces. `packages/domain`, persistent schema and recognition behavior are unchanged.

No topology/opening/M2/recognition threshold was weakened. Safe-nearby placement remains a bounded candidate search over the unchanged structural validator, not auto-repair.

### Reference/recognition

Accepted source import/calibration and M7.8A/B benchmark infrastructure remain available. Recognition is assistive/experimental and not a beta dependency.

### 3D/planning

Existing deterministic read-only 3D and bounded planning remain available, but they are not the next beta-critical investment.

## 7. Public beta programme

```text
DONE  M8.1  Editor Interaction Foundation
NOW   M8.2  Precision Drawing and Structural Editing
      clipboard/selection + direct room translation automated GREEN;
      focused product-owner latest-behavior retest pending
THEN  M8.3  Precision Reference Calibration
THEN  M8.4  Assisted Tracing
THEN  M8.5  Furniture 2.0
THEN  M8.6  Export, Appearance and Presentation
THEN  M8.7  Public Beta Hardening
TARGET PUBLIC FREE BETA
```

Programme tracker: #53. M8.2 tracker: #56. Implementation PR: #87.