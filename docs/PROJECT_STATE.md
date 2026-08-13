# Vlezet — Project State

**Last updated:** 2026-08-13  
**Status:** M0–M8.2 are implemented, product-accepted and merged. M8.2 Precision Drawing / Direct Manipulation Foundation was protected squash-merged into `main` as `e323e331a435ae356b91decbdea80dde95028d8a` after final product-owner PASS, exact-head CI + Chromium/WebKit acceptance, and post-merge CI + CodeQL GREEN. Canonical acceptance record: `docs/milestones/m8-2-acceptance.md`. The next product milestone is M8.3 Precision Reference Calibration; before new product work, the active engineering priority is the project-wide testing-policy and coverage audit requested by the product owner.
**Target:** public free beta suitable for unfamiliar users.  
**Canonical rule:** read this file first, then `docs/ROADMAP.md`, `docs/product/UX_ROADMAP.md`, `docs/product/COMPETITIVE_BENCHMARK.md`, `docs/research/OPEN_SOURCE_FLOOR_PLANNERS.md`, the latest focused changelog and the active design/plan.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners and buyers.

> Draw or import a real apartment, work with understandable real dimensions, place furniture and appliances, understand fit/collisions/usability and export a clean plan — without learning professional CAD.

The beta product is intentionally **not** a generic diagram editor and **not** an AI-recognition product.

Target interaction quality should learn from mature floor planners, but architectural semantics remain stricter:

- walls remain topological physical walls;
- openings remain attached to validated host walls;
- rooms remain derived;
- furniture keeps physical millimetre dimensions;
- graphical group scaling may not destroy real-world semantics.

Current product benchmark policy:

- RoomPlan is the minimum practical interaction benchmark for ordinary apartment planning;
- Planner 5D, Floorplanner, RoomSketcher and Planoplan are secondary product/UX references;
- RemPlanner and magicplan inform later professional-documentation and capture directions;
- open-source projects are studied for architecture/implementation ideas only and never become authority automatically.

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
10. deterministic validation and semantic Undo/Redo;
11. mature direct-manipulation UX before catalogue/rendering breadth.

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
21. Renderer event bubbling/hit ownership may not define ambiguous product semantics for an already selected composite; pointer-down must resolve one semantic gesture owner.
22. Ordinary opening drag must preserve current host-wall semantics unless the user explicitly invokes a future re-host action.
23. Third-party/open-source implementation may be adopted only after license review and Vlezet-specific contract/tests; external code never bypasses the authorities above.
24. Dev-runtime/HMR state must not silently lose semantic editor actions; runtime compatibility repairs may restore missing actions only and must bind them to the live authoritative store rather than replace document/history state.
25. A marquee that fully encloses a derived room selects that room as one structural semantic root; backing walls/openings are not duplicated into the same selection merely because they lie inside the rectangle.

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
| M8.2 | product-owner accepted and protected squash-merged as `e323e331a435ae356b91decbdea80dde95028d8a` |

M8.2 manual acceptance is closed. The accepted correction suite includes selected-furniture composite drag, current-host opening movement, whole-room no-modifier marquee, practical window and door hit targeting, compact room-label degradation and preserved Turbopack/Fast Refresh live-store repair. Integration still requires fresh exact-head delivery gates after this acceptance truth-sync.

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

Market research performed on 2026-08-12 reinforces this decision: mature products that offer AI/scan conversion still rely on an ordinary editable plan as the correction path. Vlezet therefore treats AI/image assistance as acceleration into the normal editor, never as a second authoritative plan state.

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

### M8.2 structural precision / direct manipulation — accepted and merged

PR #87 implemented the approved structural precision design plus later product-owner corrections while preserving M8.1 runtime and structural authority boundaries. Product-owner acceptance was granted on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`; protected squash merge `e323e331a435ae356b91decbdea80dde95028d8a` is now in `main`. `docs/milestones/m8-2-acceptance.md` is the canonical acceptance record.

Implemented/automated-green behavior includes:

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
- a no-modifier marquee that fully encloses a room now selects **one derived room root + explicitly hit furniture**, not the room's backing walls/openings as separate members;
- partial marquee behavior remains concrete wall/opening/furniture selection when no whole room is enclosed;
- approved explicit mixed Copy can combine structural room/wall content with **explicitly selected** placed furniture while unsupported mixes remain fail-closed;
- furniture merely located inside a copied room is not implicitly captured;
- ordinary structural Paste can search a bounded deterministic nearby valid position when the requested position intersects existing topology, without weakening validation;
- composite structural + furniture Paste applies the actual accepted structural delta to the complete group so safe-nearby fallback stays rigid and atomic;
- Paste is anchored to the latest Canvas world pointer; a deterministic clipboard-origin fallback is used only before any Canvas pointer has been observed;
- rejected explicit Copy clears stale clipboard content and reports a non-modal status reason instead of leaving an older payload silently pasteable;
- direct drag of a selected isolated room from a **free room-interior point** moves the room structure as one rigid structural gesture;
- room-only drag does **not** move unselected furniture;
- room + explicitly selected furniture movement applies one identical delta and commits atomically whether the gesture begins on free room interior or on an ordinary already-selected furniture body;
- `Выбрать мебель в комнате` expands selection only with furniture whose full physical footprint is contained by the derived room polygon; boundary touch is accepted, boundary crossing is excluded;
- an unselected furniture hit and specialized structural/opening/transform handles keep their own higher-priority semantics instead of being captured by generic room-composite movement;
- room translation snapping excludes the moving room's own structure, while Alt/Option suppresses snapping only for the current gesture;
- shared/connected unsafe room topology rejects fail-closed with a visible reason and no partial structural/furniture mutation;
- accepted room movement is exactly one semantic `room/translate` history command; reject/no-op/cancel/stale gesture creates none;
- doors/windows can be dragged directly along their **current** host wall; `wallId` is preserved, movement is constrained to the valid host span and overlap/invalid positions reject visibly with no partial commit;
- door direct manipulation now treats the full host-wall opening span, the visible leaf and the swing arc as practical pointer targets with a minimum 12 px listening stroke; the complete swing sector deliberately remains non-listening so room/furniture clicks are not stolen;
- both window visual lines now retain their thin appearance but expose a practical 12 px listening hit stroke for ordinary pointer drag;
- missing hosted-opening actions in a preserved Turbopack/Fast Refresh live Zustand singleton are repaired narrowly and bound to the live store before use, without replacing document/history state;
- room labels use deterministic screen-space degradation (`name + area + dimensions` → `name + area` → compact `name + area` → `name only` → hidden) with non-overlapping slots, bounded wrap/ellipsis and keyed React fragments;
- exact wall paste at the source origin still fails closed on overlap;
- one semantic history command per valid structural/composite commit and none for preview/cancel/reject;
- explicit valid/invalid structural feedback rather than colour-only signalling.

Current room clipboard scope remains structural when the room is copied alone: **room shell + hosted openings + explicit room name**. Furniture is included only when the user explicitly selects it as part of an approved composite selection; spatial containment alone never implies Copy. Direct room movement follows the same explicit-membership rule.

Product-owner pre-acceptance result on 2026-08-10:

- all original seven requested M8.2 manual scenarios: **PASS**;
- follow-up usability finding: connected walls and whole rooms were not copy/pasteable in the ordinary editor flow;
- acceptance remained open while that gap, precise-selection/composite-clipboard behavior and direct-room movement were implemented and tested.

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

Direct room-translation evidence before latest manual feedback:

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
```

The browser RED distinguished a genuine product issue from acceptance-harness defects. Unsafe topology originally caused the store to silently refuse gesture start; the focused RED reproduced that missing feedback and the production fix preserved an invalid room gesture with the structural reason. Browser checks were separately corrected to use stable Stage-relative coordinates and a deterministic connected-topology fixture. No production validator was weakened.

### Product-owner direct-manipulation correction — 2026-08-12

The manual round originally reported:

- **FAIL:** complete `room + furniture` selection did not move when the user started dragging an already selected furniture item;
- requested: doors should be directly movable at least along their current host wall;
- screenshot finding: room label/name/area/dimension content could overlap badly in compact geometry;
- **PASS:** all other focused tests in the round.

The mixed-composite root cause was isolated as a missing semantic gesture owner: the room gesture rejected a direct furniture hit, `PlacedObjectShape` stopped propagation and ordinary object movement only supports an all-placed-object selection. The correction now resolves one selection-aware gesture owner before mutation, so an ordinary selected furniture body in a selected room composite delegates to the room-composite gesture while unselected furniture and specialized handles retain their own semantics.

Focused correction scope was implemented and automated GREEN:

1. selection-aware mixed-composite gesture arbitration;
2. hosted door/window movement constrained to the current wall with no silent re-hosting;
3. deterministic compact room-label degradation and keyed renderer fragments;
4. dedicated browser acceptance for selected-furniture-origin composite drag, free-interior equivalent movement, ordinary unselected furniture behavior, Transformer behavior, door/window host movement, invalid overlap rejection and compact-label smoke/evidence.

Correction provenance: `docs/changelog/2026-08-12-m8-2-direct-manipulation-opening-drag-correction.md`.

That checkpoint was later superseded by the additional product-owner runtime/marquee/window findings below; historical evidence is retained but is not treated as final acceptance evidence.

### Latest runtime / marquee / window product-owner regressions — 2026-08-13

The next real product-owner round found three additional failures that the earlier GREEN suite did not honestly protect:

1. **Runtime FAIL:** selecting/dragging a hosted door in a Turbopack development session could throw `beginStructuralOpeningGesture is not a function` even though current source declared the action.
2. **Selection UX gap:** a normal no-modifier marquee around a room and furniture selected backing walls/openings instead of one semantic room root plus furniture, making ordinary group movement unnecessarily depend on modifier-assisted selection.
3. **Window UX FAIL:** a window did not move reliably in normal pointer use because its listening lines were visually and interactively only about 1.5–2 px wide.

The correction used genuine product/user-flow RED rather than source assertions:

```text
regression RED head:               08efe070df59fc1c9a0d661a42130ae98875c2e7
CI #5064:                          EXPECTED FAIL — 2 focused unit failures
Browser Acceptance #1514:         EXPECTED FAIL — 53 PASS / 2 FAIL
first partial candidate:           e2d80f581471e68f33f9c08a14b7c40ccabf6295
marquee/runtime GREEN candidate:   bf04db8a5cd75818891849e7d05742e80eea8211
CI #5066:                          PASS
Browser Acceptance #1516:         54 PASS / 1 FAIL — window only
final product-code head:           357c92c36fc6c72b3e727b00f4b342b742efeb72
CI #5067 / run 31648753553:        PASS
Browser Acceptance #1517:         PASS — Chromium + WebKit
browser run:                       31648753509
browser artifact:                  9161930810
artifact digest:                   sha256:dfbf78d25fa4b6ce32d7ce5f25ca01746ebe9b7c332575776f1953a4466b74ab
```

The first production candidate was deliberately **not** called GREEN: it revealed that copying action closures from a temporary store mutates that temporary store, not the preserved live singleton. The final runtime repair therefore binds narrowly scoped opening handlers directly to the live `editorStore`. The same intermediate evidence isolated the window as the only remaining browser failure before its 12 px hit target was added.

The new browser regression file runs in both Chromium and WebKit and covers:

- no-modifier whole-room marquee → `room + 2 furniture` semantic selection → group drag → Undo/Redo;
- ordinary door select/drag with global `pageerror` and `console.error` guards;
- user-like window drag beginning a few pixels away from the exact thin line.

Focused provenance: `docs/changelog/2026-08-13-m8-2-runtime-marquee-window-regressions.md`.

**Acceptance state:** these regressions are fixed, automated GREEN and product-owner accepted. The later door hit-target correction below completed the final manual gate; only integration delivery gates remain.

### Final door hit-target product-owner usability correction — 2026-08-13

The next focused product-owner check reported:

- hosted door movement/runtime: **functional PASS**, but acquiring the door still required pixel-precise aim at the thin leaf;
- room + furniture no-modifier marquee/movement: **PASS**;
- representative window movement: **PASS**.

The remaining door issue was treated as a real UX finding. A permanent Playwright regression now starts drag from the **centre of the wall opening span**, not from the leaf. The clean RED proved the pointer fell into ordinary selection/marquee handling instead of opening movement:

```text
harness-only syntax failure:       9e037fce958d91f07a504756922de4b5c8389b3b / Browser #1523 — excluded from product RED
valid RED head:                    e41c695b193a9e20ec0173453cd23d093f1bfaab
CI #5074:                          PASS
Browser Acceptance #1524:         EXPECTED FAIL — 54 PASS / 1 FAIL (door opening-span drag only)
production patch:                  9f37c7c0db394e7f924c732e4d191d3bff724ecf
clean product-code head:           8f9317db650bd076df957028035f6a643d0ec470
CI #5082 / run 31679924606:        PASS
Browser Acceptance #1532:         PASS — Chromium + WebKit
browser run:                       31679924617
browser artifact:                  9173229566
artifact digest:                   sha256:14ff9ba47d708c881adfdccf89f11218efac4af9f54862f332ebd0f487b65ea3
```

The interaction target is intentionally limited to the wall opening, leaf and arc. The full quarter-circle swing sector is not clickable because it could intercept surrounding room/furniture interaction. Visual geometry, `wallId`, host-wall projection, validation and semantic history are unchanged.

Focused provenance: `docs/changelog/2026-08-13-m8-2-door-hit-target-correction.md`.

**Product-owner result:** the final focused retest passed all three requested door-UX scenarios. Manual acceptance is closed. Remaining work is delivery-only: synchronize acceptance state, run fresh exact-head CI + Chromium/WebKit Browser Acceptance, mark PR #87 Ready and perform the protected squash merge.

### Reference/recognition

Accepted source import/calibration and M7.8A/B benchmark infrastructure remain available. Recognition is assistive/experimental and not a beta dependency.

### 3D/planning

Existing deterministic read-only 3D and bounded planning remain available, but they are not the current beta-critical investment. Market evidence supports richer walkthrough/presentation later, after the manual editor reaches parity-quality interaction.

## 7. Product / open-source research policy

Canonical documents:

- `docs/product/COMPETITIVE_BENCHMARK.md`;
- `docs/research/OPEN_SOURCE_FLOOR_PLANNERS.md`;
- `docs/changelog/2026-08-12-market-benchmark-roadmap-correction.md`.

Current high-value engineering references:

- `charmlinn/blueprint3d-modern` — MIT; wall-local/in-wall movement, shared 2D/3D model, catalogue architecture;
- `fedepaj/arcada-planner` — MIT; centralized hit/drag arbitration in a React/Konva/Zustand editor;
- `cvdlab/react-planner` — MIT; catalogue/plugin/property extensibility;
- `floorplanner/polygon-tools` — MIT; future polygon operations/differential testing;
- Sweet Home 3D — mature behavior/architecture reference, GPL caution for code reuse.

When an external implementation materially influences a design, the active design/plan/changelog must record what was observed, adopted, rejected, its license/copy status and Vlezet-specific tests.

## 8. Public beta programme

```text
DONE  M8.1  Editor Interaction Foundation
DONE  M8.2  Precision Drawing / Direct Manipulation Foundation — merged e323e331a435ae356b91decbdea80dde95028d8a
NOW   Engineering testing-policy + coverage audit
THEN  M8.3  Precision Reference Calibration
THEN  M8.4  Assisted Tracing
THEN  M8.5  Furniture + Materials 2.0
THEN  M8.6  Export + Presentation
THEN  M8.7  Public Beta Hardening
TARGET PUBLIC FREE BETA
```

Post-beta opportunity set, subject to later evidence:

- richer deterministic 3D/walkthrough/presentation;
- deeper multi-floor workflows;
- wall elevations/specifications/renovation documentation;
- structured exchange such as DXF/FML/IFC after schema maturity;
- mobile/LiDAR/RoomPlan-style capture as optional editable-geometry input.

Programme tracker: #53. M8.2 tracker: #56. Implementation PR: #87.