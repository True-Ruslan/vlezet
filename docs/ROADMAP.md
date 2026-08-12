# Vlezet — Roadmap

**Last updated:** 2026-08-12  
**Rule:** deterministic product truth and user trust come before visual spectacle, feature count or speculative automation. Manual editing must remain a complete product path.

Read `docs/PROJECT_STATE.md` first. Detailed product programme design is in `docs/superpowers/specs/2026-08-08-public-beta-editor-program-design.md`. Product/market direction is additionally governed by `docs/product/COMPETITIVE_BENCHMARK.md`; implementation research policy is in `docs/research/OPEN_SOURCE_FLOOR_PLANNERS.md`.

## Summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
DONE/MVP    M4.5 Assisted Recognition — automatic full-plan quality remains R&D #27
DONE        M4.6 Precision Geometry UX
DONE        M5.1–M5.4 deterministic read-only 3D
DONE        M6.1–M6.4 deterministic planning and reviewed intent
DONE        M7.0–M7.7 product/UX foundation
DONE        M7.8A Recognition Benchmark Foundation
DONE        M7.8B Source Normalisation and Wall Topology
STOPPED     M7.8C+ automatic-recognition product path — usefulness acceptance failed
DONE        M8.0 Public Beta Product Contract / roadmap reset
DONE        M8.1 Editor Interaction Foundation
NOW         M8.2 Precision Drawing / Direct Manipulation Foundation
            original product-owner scenarios PASS;
            clipboard/selection + free-interior room translation automated GREEN;
            latest product-owner retest found composite-drag FAIL;
            hosted-opening drag + label hardening added before acceptance
THEN        M8.3 Precision Reference Calibration
THEN        M8.4 Assisted Tracing
THEN        M8.5 Furniture + Materials 2.0
THEN        M8.6 Export + Presentation
THEN        M8.7 Public Beta Hardening
R&D         automatic whole-plan recognition (#27)
POST-BETA   richer walkthrough/3D, professional docs, structured exchange, mobile capture
```

M8.1 is product-owner accepted and squash-merged into `main` as `867ec54d21b1dcb94d519ace3bec0a3635717022`.

M8.2 remains the active Draft delivery slice in PR #87 and is **not product-accepted**. The originally requested scenarios passed and later clipboard/selection/direct-room work reached automated GREEN, but the 2026-08-12 product-owner retest found a real direct-manipulation gap: a visibly selected `room + furniture` composite cannot be dragged as one group when the drag begins on an already selected furniture member. The product owner also requested direct door movement constrained to its host wall; the screenshot exposed room-label density/overflow. All other focused scenarios in that retest were reported PASS.

Market research now makes RoomPlan the minimum practical interaction benchmark and uses Planner 5D, Floorplanner, RoomSketcher, Planoplan, RemPlanner and magicplan as secondary references. This does not create feature-count parity as a release gate; it prevents Vlezet from rediscovering mature planner interactions in isolation.

## Completed product foundation

### M0–M4.6 — trusted 2D planning

- millimetre-world Canvas and semantic history;
- topological walls, rooms, openings and usable area;
- furniture, transforms and explainable fit;
- local projects, autosave, backup/import and PNG;
- reference-plan calibration and editable assisted recognition;
- clear room dimensions, area trust, annotations and tape.

### M5 — deterministic read-only 3D

- renderer-neutral `SpatialScene`;
- shell, openings, floors and furniture;
- safe 2D↔3D switching and semantic inspection;
- WebGL fallback and cleanup.

### M6 — deterministic intelligent planning

- bounded alternatives for one rectangular room;
- M2-authoritative validation;
- lock, wall/corner, near/far and exact contour-gap rules;
- reviewed natural-language intent;
- explicit Preview and atomic Apply.

### M7.0–M7.7 — product and UX foundation

- responsive editor shell and context inspector;
- design system and feedback hierarchy;
- onboarding/recovery;
- geometry/opening inspector;
- furniture catalogue and fit workflow;
- accepted Chromium/WebKit regression foundation.

### M7.8A/B — recognition measurement and safe local wall assistance

Accepted and merged. These remain useful infrastructure/R&D evidence, but no longer define the beta critical path.

## Recognition decision — 2026-08-08

The unaccepted M7.8C automatic-recognition stack passed deterministic benchmark gates but failed real product usefulness acceptance on the original plan.

Observed failure class:

- incomplete/fragmented structural reconstruction;
- visible windows still missed;
- service/sanitary notation still ambiguous;
- verification-only AI could not recover missing geometry.

Consequences:

- PRs #42, #44 and #45 closed without merge;
- automatic recognition remains R&D under #27;
- PR #52 Assisted Tracing design preserved but closed without merge;
- #51 reframed as **M8.4 Assisted Tracing** after the editor/calibration foundation;
- public beta prioritises a strong manual editor.

## Market benchmark decision — 2026-08-12

Canonical research:

- `docs/product/COMPETITIVE_BENCHMARK.md`;
- `docs/research/OPEN_SOURCE_FLOOR_PLANNERS.md`;
- `docs/changelog/2026-08-12-market-benchmark-roadmap-correction.md`.

Product rules introduced by this evidence:

1. RoomPlan is the minimum practical interaction benchmark for the ordinary apartment-planning journey.
2. Planner 5D, Floorplanner, RoomSketcher and Planoplan are deeper references for editable import/AI, catalogue scale, output/presentation and professional workflows.
3. RemPlanner and magicplan are later references for renovation documentation and field/mobile capture.
4. Mature commercial products define UX expectations; open-source projects are implementation/architecture references only.
5. Before material new editor behavior, inspect a relevant mature UX flow and relevant open-source implementation where useful, then write the Vlezet contract and RED tests.
6. Third-party code never weakens Vlezet topology, hosted-opening, M2, persistence or semantic-history authority.
7. Automatic recognition stays outside the beta critical path even though competitors offer AI conversion; market evidence instead reinforces that recognized geometry must remain ordinarily editable.

## M8 Public Beta Editor programme

### M8.0 — Public Beta Product Contract / roadmap reset

Status: **DONE / MERGED**.

Target: a public free beta that an unfamiliar non-CAD user can use successfully.

Product formula:

> Familiar mature-canvas interaction quality + strict apartment semantics + millimetre accuracy + local-first deterministic authority.

General diagram freedom is not a goal. Walls/openings/rooms/furniture keep physical semantics and arbitrary structural group scale remains forbidden.

Tracker: #53.

### M8.1 — Editor Interaction Foundation

Status: **DONE / PRODUCT-OWNER ACCEPTED / MERGED**. Tracker: #54. PR: #85.

Accepted behavior:

- unified semantic runtime selection with primary + multi-selection;
- click/modifier/marquee/select-all semantics;
- capability-aware commands;
- rigid multi-furniture movement;
- semantic furniture Copy/Cut/Paste/Duplicate with fresh IDs;
- central command registry;
- wheel/trackpad pan + modified pointer-centred zoom;
- Space+drag and middle-button pan;
- fit-plan / fit-selection;
- compact multi-selection inspector and semantic context menu;
- existing single-inspector compatibility;
- fail-closed mixed/structural batch operations;
- no arbitrary group scale;
- no project-schema migration.

The final selected-group drag/snap defect was reproduced through genuine RED tests and fixed at the Konva projection boundary without changing snap or fit authority. The regression covers three deterministic cursor-jitter profiles plus exact Undo/Redo behavior in Chromium and representative WebKit.

Integration evidence:

```text
product-accepted interaction head: db66de524783a43fa021db07a6b67808c4435e9b
final documentation head:          f8318182d3a9e7c835ebf079de2710d6106d7829
CI #4819:                           PASS
Recognition Benchmark #1155:       PASS
Browser Acceptance #1275:          PASS
  Chromium:                         PASS
  WebKit:                           PASS
product-owner retest:               PASS
protected squash merge:             867ec54d21b1dcb94d519ace3bec0a3635717022
```

Acceptance record: `docs/milestones/m8-1-acceptance.md`.

### M8.2 — Precision Drawing and Direct Manipulation Foundation

Status: **IN DEVELOPMENT / ORIGINAL MANUAL SCENARIOS PASS / PRIOR AUTOMATION GREEN / LATEST PRODUCT RETEST HAS ONE REAL COMPOSITE-DRAG FAIL**. Tracker: #56. Draft PR: #87.

Primary outcome:

> Draw, repair, select and directly manipulate exact apartment structure with mature-editor interaction quality while preserving topology and hosted-opening validity.

Implemented scope before the latest feedback:

- named visible snap guides;
- deterministic endpoint/junction/midpoint/intersection/wall-axis snapping;
- horizontal/vertical/parallel/perpendicular assistance with acquisition/release hysteresis;
- visible `Привязки` control plus gesture-local Alt/Option suppression;
- exact near-cursor wall length and angle input;
- Canvas angle convention `0° right / 90° down / 180° left / 270° up`;
- direct endpoint/junction editing;
- topology-safe wall-body translation;
- atomic common-property editing for compatible selected walls, beginning with centred thickness;
- non-destructive wall Copy/Duplicate through safe detached structural projection, including hosted openings;
- strict dependency-closed Cut for connected structure;
- whole-room Copy/Duplicate from the exact derived room boundary, including split backing-wall segments, boundary openings and explicit room name;
- room Cut deliberately disabled because shared-topology destructive semantics are ambiguous;
- polygon-based room targeting with deterministic ordering for concave and adjacent rooms;
- room hover discoverability over empty room interiors through geometry fallback;
- approved explicit mixed Copy for structural room/wall content plus explicitly selected placed furniture, while unsupported mixes fail closed;
- no implicit copying of furniture merely because it is spatially inside a selected room;
- bounded safe-nearby structural Paste when the requested position intersects existing topology, with every candidate revalidated through the unchanged structural authority;
- composite structural + furniture Paste keeps the entire group rigid by applying the actual accepted structural fallback delta to furniture;
- Paste uses the latest Canvas world pointer as its ordinary anchor;
- rejected explicit Copy clears stale clipboard state and exposes a non-modal reason;
- direct selected-room drag from a **free room-interior point**, with room structure translated rigidly through `@vlezet/editor-core`;
- room-only drag leaves unselected furniture fixed;
- free-interior-started `room + explicitly selected furniture` movement applies one identical delta and one atomic history commit;
- `Выбрать мебель в комнате` adds only furniture whose full physical footprint is contained by the derived room polygon; boundary crossing is never captured implicitly;
- higher-priority furniture/wall/opening/handle pointer gestures currently stay authoritative over room drag;
- room snap targets exclude the room's moving structure; Alt/Option suppresses snapping only for the current gesture;
- unsafe shared/connected room topology rejects visibly and fail-closed, with no partial structure/furniture mutation;
- accepted room movement is one semantic `room/translate` command; invalid/no-op/cancel/stale movement creates no history;
- exact source-origin wall overlap remains fail-closed;
- hosted-opening preservation/revalidation;
- one semantic history operation per committed structural/composite operation;
- fail-closed rejection instead of partial structural mutation;
- accessible structural handles and explicit valid/invalid feedback.

Whole-room Copy by itself remains **structural shell + hosted doors/windows + explicit room name**. Placed furniture is included only when explicitly selected as part of an approved composite selection; room containment alone never implies clipboard membership. Room movement follows the same explicit-membership rule: unselected furniture stays put unless the user explicitly selects it or invokes `Выбрать мебель в комнате`.

Authority remains separated:

- `@vlezet/geometry` owns pure angle/snap calculations, derived room/face geometry and full-footprint polygon containment;
- `@vlezet/editor-core` owns complete structural candidate mutation/validation, room-translation closure, room-boundary clipboard projection and destructive closure rules;
- Canvas/web owns intent, projection and transient runtime coordination;
- `VlezetDocument` remains persistent truth;
- no room-ownership field, project-schema migration or recognition behavior change is introduced.

Prior wall/room clipboard extension evidence:

```text
projection RED:               5b6409c319afadbe18b2b11cf02ad3773d2ae331 / CI #4921 — EXPECTED FAIL
room-paste RED:               5146252c253fa9490060cfb68b05567aa0ad1ba4 / CI #4930 — EXPECTED FAIL
browser placement RED:        68c30b062e20b38c3340ccacc4d21fcdb7694737 / Browser #1381 — 32 PASS / 1 FAIL
focused wall-paste RED:       ac031fecfba326a4c472db7ebbc3b3e04c4173ae / CI #4935 — EXPECTED FAIL
GREEN head:                   beb25379e0b6a25af0a8af84da878a62c5692e08
CI #4936:                     PASS
Browser Acceptance #1386:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
```

Precise-selection/composite-clipboard evidence:

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

Direct room-translation evidence before the latest manual finding:

```text
design:                       31075d42841c706d5d8f07839b1e4e946e412e3c
plan:                         feb930e279edeb5a3546a71008f2d1b03b041a8f
editor-core RED:              38876ad1b6d92f719b1a1e26a72c8fbcf2f02720 / CI #4993 — EXPECTED FAIL
editor-core GREEN:            4dd9c65324bcc110569a394208fa759c68b32cac / CI #4995 PASS
footprint RED:                ad4116f8d808618609c517de4aa12017634a57e7 / CI #4996 — EXPECTED FAIL
selection-helper RED:         7ec10b6c40e1a115b866d7db68466d5c15b8e25f / CI #4998 — EXPECTED FAIL
selection/helper GREEN:       8759ceb4ddc083c044293c228dc8944e7c096e3a / CI #5000 PASS
store gesture RED:            eaa39b02ac93d067b5d09d55ea78cad65c9328c8 / CI #5001 — EXPECTED FAIL
store gesture GREEN:          57ada4bc285f1a940a40d2b192e58a305582925e / CI #5003 PASS
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

The room-translation browser RED exposed one real product issue and separate harness defects. The real issue was silent rejection when unsafe topology prevented gesture start; the focused RED required preservation of an invalid gesture with an explicit structural reason, now rendered as visible fail-closed feedback. The harness was separately hardened to use Stage-relative coordinates and a deterministic connected-topology fixture. Structural validation was not weakened.

### Latest product-owner correction gate — 2026-08-12

Product-owner feedback after the automated GREEN found:

- **FAIL:** `room + furniture` visibly selected, drag begins on selected furniture, but the complete composite does not move;
- requested: direct movement of doors, and by extension hosted openings, constrained to the current host wall;
- observed UX debt: room name/area/dimension text can overlap and become unreadable in compact room geometry;
- **PASS:** all other focused tests in this retest round.

Root-cause class for the composite FAIL:

```text
selected room + selected furniture
→ furniture owns Konva pointer/drag
→ room gesture refuses higher-priority direct entity hit
→ object batch gesture requires all-placed-object selection
→ mixed selection has no single gesture owner
```

Required correction contract before M8.2 acceptance:

1. introduce one **selection-aware gesture arbiter** so a drag that starts on any already selected ordinary composite member can move the explicit selected composite;
2. specialized handles/openings remain higher priority than generic group movement;
3. one accepted composite move remains one atomic semantic history operation;
4. opening drag projects cursor movement onto the existing host wall, preserves `wallId` by default and validates/clamps/fails closed rather than silently re-hosting;
5. room labels use deterministic wrapping/ellipsis/hiding priority and must not obscure basic dimensions;
6. add genuine focused RED tests for the exact screenshot/user flow before production correction;
7. rerun full Chromium and representative WebKit acceptance and obtain explicit product-owner PASS.

M8.3 remains blocked until this correction is accepted and PR #87 is protected-merged.

### M8.3 — Precision Reference Calibration

Status: **PLANNED / BLOCKED BY M8.2 ACCEPTANCE + MERGE**. Tracker: #57.

Planned outcomes:

- calibration pan/zoom;
- stronger magnifier/crosshair;
- source edge/line-centre/intersection snapping;
- keyboard nudge;
- fractional image coordinates where justified;
- second known-distance verification;
- visible residual/error and distortion warning;
- no false claim of precision beyond raster/source quality.

Market evidence reinforces M8.3 rather than changing its architecture: background/blueprint tracing is a standard mature-planner journey and requires trustworthy calibration before any assistance is allowed to feel precise.

### M8.4 — Assisted Tracing

Tracker: #51.

Optional high-confidence source-image snapping inside normal wall/door/window tools after M8.1–M8.3. Explicit user intent and existing topology remain stronger than source-image assistance. Ambiguity abstains. No AI/network dependency required.

Additional market rule: any traced/recognized result must become ordinary editable Vlezet geometry. AI/image assistance accelerates the normal editor; it may never create a parallel opaque plan state.

### M8.5 — Furniture + Materials 2.0

Planned outcomes:

- scalable parameterised household furniture/appliance/sanitary catalogue;
- catalogue/preset definitions separated from placed document instances;
- direct physical resize/rotation on Canvas;
- live dimensions;
- richer wall/alignment snapping;
- multi-selection alignment/distribution;
- material/texture groundwork for objects and surfaces;
- wall-relative specialist actions where useful;
- inspector retained for exact numeric editing;
- user-imported assets only after explicit persistence/versioning design.

This milestone targets **useful breadth and scalable architecture**, not immediate catalogue-count parity with Floorplanner/Planner 5D.

### M8.6 — Export + Presentation

Planned outcomes:

- renderer-neutral `ExportScene` concept;
- PNG + SVG;
- PDF after vector/export semantics are stable if low risk;
- whole plan + selection export;
- reference/background/presentation options;
- dimensions/furniture/zones visibility controls;
- transparent PNG where applicable;
- high-resolution deterministic output;
- application Light/Dark/System theme separated from canonical plan appearance;
- export result independent of UI theme;
- architecture prepared for later 3D/share output without making that a beta blocker.

### M8.7 — Public Beta Hardening

Complete accessibility/responsive/performance/recovery/documentation hardening across the beta-critical path. Tablet basic usability is desirable; full phone/tablet editing parity is not a public-beta blocker.

## Public beta acceptance journeys

```text
BETA-01 Blank
BETA-02 Reference
BETA-03 Edit
BETA-04 Furnish
BETA-05 Export
```

No public beta until all five journeys have deterministic/unit coverage where possible plus representative Chromium/WebKit browser evidence and no known document-integrity blocker.

M8.1 materially advances `BETA-03`. M8.2 is the current dependency for reliable `BETA-01` structural creation and mature direct manipulation, then M8.3/M8.4 complete `BETA-02` reference tracing.

## Implementation research rule

For material new editor behavior:

```text
relevant mature-product UX review
→ relevant open-source code/architecture review where useful
→ explicit Vlezet contract and authority boundaries
→ license/adoption note
→ genuine focused RED
→ minimal implementation
→ focused/full/browser GREEN
→ product-owner acceptance
```

Preferred current references:

- UX/product: RoomPlan first; Planner 5D, Floorplanner, RoomSketcher, Planoplan as deeper references;
- code/architecture: `charmlinn/blueprint3d-modern`, `fedepaj/arcada-planner`, `cvdlab/react-planner`, `floorplanner/polygon-tools` where relevant;
- Sweet Home 3D: behavior/architecture reference with GPL caution, not a default code-copy source.

No external implementation may become geometry/history authority merely because it is mature or open-source.

## Mandatory TDD delivery rule

Every deterministic M8 behaviour:

```text
contract
→ focused failing test (RED)
→ verify intended failure
→ minimal correct implementation
→ focused GREEN
→ adjacent/full regression
→ refactor while green
→ reviewable commit
```

Forbidden:

- weakening existing validation/tests/thresholds merely for green CI;
- treating a pre-existing passing test as RED evidence;
- replacing real browser interaction tests with source-string assertions where behavior can be exercised directly;
- claiming product acceptance from CI alone.

## Mandatory CHANGELOG rule

Every accepted M8 slice must maintain:

- focused `docs/changelog/YYYY-MM-DD-<slice>.md`;
- concise `docs/CHANGELOG.md` entry;
- truthful canonical `PROJECT_STATE`/roadmap sync;
- final merge identity only after GitHub reports the protected integration.

Focused history must explain why, user-visible behaviour, architecture boundaries, meaningful RED/GREEN evidence, regressions fixed, intentional deferrals, exact-head automated evidence, product-owner acceptance and merge identity.

## Deliberate pre-beta non-goals

- realtime collaboration;
- mandatory accounts/cloud sync;
- generic diagram shapes/arrows/freehand/rich text parity;
- plugin ecosystem;
- automatic whole-plan reconstruction as a release gate;
- autonomous AI layout design;
- photorealistic 3D;
- BIM/DXF/DWG as beta gates;
- arbitrary user layer stacks;
- full phone/tablet editor parity;
- matching competitor catalogue counts before interaction quality is accepted.

## Evidence-supported post-beta directions

After public-beta manual/editor trust is established, current market evidence supports evaluating:

- richer deterministic 3D and walkthrough/presentation parity;
- deeper multi-floor workflows;
- wall elevations/specifications and renovation documentation;
- structured external exchange such as DXF/FML/IFC after schema maturity;
- mobile/LiDAR/RoomPlan-style capture as an optional source of ordinary editable geometry.

These are opportunities, not commitments, and may be reprioritized only from user evidence.