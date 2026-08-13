# Vlezet — UX Roadmap

**Phase:** M8 Public Beta Editor  
**Last updated:** 2026-08-13  
**Rule:** trust, precision, interaction quality and complete manual workflows precede cosmetic breadth or speculative automation. Only one implementation slice is `NOW`.

Read together with `docs/product/COMPETITIVE_BENCHMARK.md` and `docs/research/OPEN_SOURCE_FLOOR_PLANNERS.md`.

## 1. Prioritisation model

Work is ordered by:

1. document-integrity or incorrect-understanding risk;
2. dependency value for the primary edit/trace/furnish/export journey;
3. reach across users and editor surfaces;
4. frequency of use;
5. automation potential for reliable regression testing;
6. implementation/regression risk;
7. market-parity value for familiar mature interactions;
8. visual polish after interaction correctness.

Market references do not override this order. A large catalogue or photorealistic render does not outrank a broken selection/drag contract.

## 2. Completed UX foundation

```text
DONE
M7.0 Product and UX Audit
M7.1 Editor Shell and Responsive Context
M7.2 Context Inspector Foundation
M7.3 Design System and Content Components
M7.4 Canvas Selection and Mode Feedback
M7.5 Onboarding, Status and Recovery
M7.6 Geometry and Opening Inspector
M7.7 Furniture and Fit Workflow
M7.8A Recognition Benchmark Foundation
M7.8B Source Normalisation and Wall Topology
M8.0 Public Beta Product Contract / roadmap reset
M8.1 Editor Interaction Foundation
```

These remain accepted foundations. The new market benchmark does not invalidate them.

## 3. Product evidence that changed the sequence

The automatic M7.8C recognition experiment passed its deterministic benchmark gates but failed product-owner usefulness acceptance on the original apartment plan. Local recognition remained incomplete and AI verification did not recover missing geometry.

This exposed a higher-value dependency:

> An unfamiliar user must be able to create a trustworthy plan manually, quickly and comfortably even when all recognition/AI assistance is unavailable.

Therefore the previous M7.8 recognition continuation and later M7.9–M7.13 order are superseded for the beta critical path.

Automatic recognition remains R&D (#27). Assisted Tracing becomes M8.4 and waits for the editor/calibration foundation.

A second product-evidence correction occurred on 2026-08-12. After M8.2 room/composite clipboard and free-interior room translation reached automated GREEN, product-owner retesting found that a visibly selected `room + furniture` composite did not move as a group when drag started on an already selected furniture member. The user also requested direct door movement constrained to its host wall. The supplied screenshot exposed room-label overlap/density.

That evidence broadened M8.2 from “structural precision implementation awaiting acceptance” into a **Direct Manipulation Foundation**. The selected-composite, current-host opening and compact-label correction was implemented and automated, but product acceptance correctly remained open.

A third product-evidence correction occurred on 2026-08-13. A real Turbopack development session exposed `beginStructuralOpeningGesture is not a function`, ordinary no-modifier marquee could not select one room + its furniture as a semantic movable group, and visible windows remained difficult to drag because their listening stroke was too narrow. These failures were reproduced with genuine unit and Playwright REDs. They are now fixed and automated GREEN on the product-code head in Chromium and representative WebKit. This evidence further strengthens the rule that **fresh-process browser GREEN is not sufficient when a real preserved dev-runtime state or ordinary pointer tolerance is part of the user journey**.

A fourth focused usability correction followed immediately after the product owner confirmed marquee **PASS**, window movement **PASS** and functional door movement/runtime **PASS**: the door was still unpleasant to acquire because the pointer had to land on the thin leaf. Vlezet now treats the wall opening, leaf and swing arc as the practical door target while deliberately leaving the full swing sector non-listening. This preserves ordinary room/furniture selection around the door.

## 4. Market benchmark policy

RoomPlan is now the minimum practical UX benchmark for the ordinary apartment-planning journey. Planner 5D, Floorplanner, RoomSketcher and Planoplan are secondary mature-product references; RemPlanner and magicplan inform later professional/capture directions.

The policy is:

```text
mature-product UX review
→ open-source architecture/code review where useful
→ explicit Vlezet interaction contract
→ license/adoption note
→ RED
→ implementation
→ browser regression
→ product-owner acceptance
```

Open-source implementation references currently include:

- `charmlinn/blueprint3d-modern` — MIT, close TypeScript/Three.js stack;
- `fedepaj/arcada-planner` — MIT, close React/Konva/Zustand stack and centralized drag arbitration;
- `cvdlab/react-planner` — MIT, catalogue/plugin concepts;
- `floorplanner/polygon-tools` — MIT, future polygon reference/differential test candidate.

Sweet Home 3D is a useful behavior/architecture reference but its GPL licensing means it is not a default source for copied implementation.

The benchmark is not feature-count chasing. Vlezet may deliberately be stricter than competitors where topology, host-wall validity, physical dimensions or semantic Undo/Redo require it.

## 5. Current beta sequence

```text
DONE
M8.1 Editor Interaction Foundation

DONE
M8.2 Precision Drawing / Direct Manipulation Foundation
  - product-owner PASS
  - protected squash merge e323e331a435ae356b91decbdea80dde95028d8a
  - post-merge CI + CodeQL GREEN

NOW
Engineering testing-policy + coverage audit

THEN
M8.3 Precision Reference Calibration
M8.4 Assisted Tracing
M8.5 Furniture + Materials 2.0
M8.6 Export + Presentation
M8.7 Public Beta Hardening

POST-BETA CANDIDATES
richer 3D/walkthrough
professional documentation/elevations/estimates
structured exchange
mobile/LiDAR capture

TARGET
Public free beta
```

Programme tracker: #53.  
M8.0 tracker: #55.  
M8.1 tracker: #54 / PR #85.  
M8.2: #56 / PR #87 — accepted and merged as `e323e331a435ae356b91decbdea80dde95028d8a`. M8.3: #57. M8.4: #51. M8.5: #58. M8.6: #59. M8.7: #60. Final beta acceptance: #61.

M8.3 may not start until M8.2 is product-owner accepted and protected-merged into `main`.

## 6. M8.1 — Editor Interaction Foundation

**Status:** PRODUCT-OWNER ACCEPTED / MERGED.

### Accepted interaction contract

Selection:

- click replaces selection;
- Shift/Cmd/Ctrl click toggles membership;
- drag from empty Canvas creates a marquee;
- plain marquee replaces;
- Shift marquee adds;
- Cmd/Ctrl+A selects concrete editable entities while respecting native text-input Select All;
- rooms/vertices were excluded from default marquee/select-all in M8.1; M8.2 deliberately extends whole-room marquee semantics without retroactively changing the accepted M8.1 furniture-only contract;
- direct room click remains supported;
- single selection retains accepted single-entity inspectors;
- multiple selection shows dedicated summary/actions.

Safe batch editing:

- one/many placed objects move rigidly;
- relative geometry remains invariant;
- one object acts as group snap anchor;
- commit is one semantic command;
- unsupported mixed/structural batch transforms are disabled rather than partially applied;
- graphical group scale is unavailable.

Clipboard:

- one/many placed objects support Copy/Cut/Paste/Duplicate;
- pasted/duplicated objects receive fresh IDs;
- relative geometry and physical dimensions remain exact;
- paste uses last Canvas pointer, otherwise viewport centre;
- repeated paste and duplicate use deterministic offsets;
- each paste/duplicate/cut is atomic in semantic history;
- structural clipboard moved to M8.2.

Navigation:

- ordinary wheel/two-finger delta pans;
- modified wheel/trackpad pinch zooms around pointer;
- Space + primary drag pans;
- middle-button drag pans;
- fit plan and fit selection use registered view commands;
- view changes never create geometry history.

The M8.1 acceptance correction fixed selected-furniture group drag around snap thresholds by reconciling imperative Konva projection from authoritative preview state. Product-owner retest passed and the milestone was squash-merged as `867ec54d21b1dcb94d519ace3bec0a3635717022`.

Acceptance record: `docs/milestones/m8-1-acceptance.md`.

## 7. M8.2 — Precision Drawing / Direct Manipulation Foundation

**Status:** PRODUCT-OWNER ACCEPTED / PROTECTED SQUASH-MERGED as `e323e331a435ae356b91decbdea80dde95028d8a`. Post-merge CI and CodeQL GREEN. Canonical record: `docs/milestones/m8-2-acceptance.md`.

Primary UX goal:

> draw, repair, select and directly manipulate exact apartment structure with the predictability of a mature spatial editor while preserving topology and hosted-opening validity.

### Delivered/automated-green foundation

- named visible structural snap guides;
- endpoint/wall-axis/midpoint/intersection and construction assistance;
- hysteresis and Alt/Option local suppression;
- exact near-pointer wall length/angle input;
- direct endpoint/junction editing;
- topology-safe wall movement;
- compatible multi-wall thickness editing;
- dependency-aware structural clipboard;
- whole-room Copy/Duplicate;
- correct concave-room point targeting and room hover fallback;
- explicit mixed structure + furniture Copy/Paste;
- pointer-anchored Paste;
- direct selected-room translation when drag starts from free room interior;
- `Выбрать мебель в комнате` explicit helper;
- atomic room + explicitly selected furniture translation from free room interior **or an ordinary already-selected furniture body**;
- **ordinary whole-room marquee:** a no-modifier marquee that fully encloses a derived room selects one semantic room root plus the furniture hit by the marquee, not the room's backing walls/openings as separate members;
- partial marquee remains concrete wall/opening/furniture selection when a full room is not enclosed;
- unselected furniture and specialized structural/opening/Transformer handles retain their own gesture priority;
- direct door/window movement constrained to the current host wall with stable `wallId`, valid-span clamping/validation and no silent re-host;
- practical door acquisition from the complete host-wall opening span, visible leaf or swing arc, each with a minimum 12 px listening target where needed; the full swing sector remains non-listening;
- overlap/invalid opening drag shows fail-closed feedback and commits nothing;
- missing hosted-opening actions in a preserved Turbopack/Fast Refresh live store are restored narrowly and rebound directly to the live editor singleton before use;
- window lines keep their thin visual appearance while exposing a practical 12 px pointer hit stroke;
- deterministic compact room-label degradation with non-overlapping slots, bounded wrap/ellipsis and keyed renderer fragments;
- fail-closed structural validation/history semantics.

### Previous mixed-composite failure

The 2026-08-12 retest exposed this missing gesture owner:

```text
room + furniture visibly selected
→ user drags selected furniture
→ furniture owned direct Konva drag
→ room gesture refused higher-priority entity hit
→ object batch path rejected mixed selection
→ no single composite gesture owner
```

This was treated as a product behavior defect. The implementation now resolves one semantic gesture owner before mutation: an ordinary selected furniture body in the selected room composite delegates to the same room-composite movement as free room interior. Unselected furniture and specialized handles keep their independent semantics.

### Latest runtime / marquee / window correction

The 2026-08-13 product-owner retest identified three additional concrete UX/runtime defects:

1. selecting/dragging a hosted door could throw `beginStructuralOpeningGesture is not a function` in a preserved Turbopack/Fast Refresh session;
2. selecting a room + furniture by ordinary marquee required an unintuitive modifier-assisted workaround because the marquee selected the room's backing structure instead of the room semantic root;
3. a user could see a window but miss its 1.5–2 px listening line during drag.

The correction is deliberately backed by user-level tests rather than idealized source geometry:

- live-store unit regression removes the hosted-opening actions from the actual singleton and verifies document load repairs them and a real `translate-opening` gesture starts;
- Playwright marquee test draws a room, places two chairs, selects the whole group with an ordinary no-modifier rectangle, drags the group and verifies Undo/Redo;
- Playwright door test performs ordinary selection/drag with global `pageerror` / `console.error` guards;
- Playwright window test begins several pixels away from the exact visual line so the test proves practical pointer tolerance rather than mathematical aim.

Transparent TDD evidence:

```text
RED head:                      08efe070df59fc1c9a0d661a42130ae98875c2e7
CI #5064:                     EXPECTED FAIL — 2 new unit failures
Browser #1514:               EXPECTED FAIL — 53 PASS / 2 FAIL
first partial fix:             e2d80f581471e68f33f9c08a14b7c40ccabf6295
marquee/runtime GREEN head:    bf04db8a5cd75818891849e7d05742e80eea8211
CI #5066:                     PASS
Browser #1516:               54 PASS / 1 FAIL — window only
final product-code head:       357c92c36fc6c72b3e727b00f4b342b742efeb72
CI #5067 / run 31648753553:   PASS
Browser #1517:               PASS — Chromium + WebKit
browser artifact:             9161930810
artifact digest:              sha256:dfbf78d25fa4b6ce32d7ce5f25ca01746ebe9b7c332575776f1953a4466b74ab
```

The failed first fix remains part of the evidence: copied action closures were bound to a temporary store. The corrected repair binds directly to the live singleton. The following browser checkpoint isolated the window as the only remaining failure before its hit target was widened. No product validator or assertion was weakened to force GREEN.

Focused provenance: `docs/changelog/2026-08-13-m8-2-runtime-marquee-window-regressions.md`.

### Final door hit-target usability correction

The product owner confirmed the latest three scenarios as follows:

- door movement/runtime: **functional PASS**, with a remaining acquisition UX complaint;
- room + furniture marquee/movement: **PASS**;
- window movement: **PASS**.

The permanent Playwright door scenario was therefore strengthened to begin drag from the **centre of the wall opening span**. The first test-only commit had a syntax typo and is excluded from product evidence. The clean RED then produced 54 PASS / 1 FAIL in Chromium, with only the new door opening-span interaction failing. After the Canvas hit-area correction, the same complete Chromium/WebKit suite passed.

```text
valid RED:                      e41c695b193a9e20ec0173453cd23d093f1bfaab
CI #5074:                      PASS
Browser #1524:                EXPECTED FAIL — 54 PASS / 1 FAIL
production patch:               9f37c7c0db394e7f924c732e4d191d3bff724ecf
clean product-code head:        8f9317db650bd076df957028035f6a643d0ec470
CI #5082:                      PASS
Browser #1532:                PASS — Chromium + WebKit
artifact:                       9173229566
artifact digest:                sha256:14ff9ba47d708c881adfdccf89f11218efac4af9f54862f332ebd0f487b65ea3
```

Interaction decision: wall opening + leaf + arc are clickable; the filled quarter-circle sector is not. This is intentionally narrower than “everything inside the door swing” so furniture and room interaction remain reachable.

Focused provenance: `docs/changelog/2026-08-13-m8-2-door-hit-target-correction.md`.

### Current correction contract

1. **Selection-aware gesture arbitration.** If `room + furniture` is explicitly selected, dragging the free room interior or any ordinary already selected furniture member moves the same explicit selected composite.
2. **Whole-room marquee.** A normal rectangle around a full room and furniture can create the same semantic room-composite selection without Shift.
3. **Specialized controls keep priority.** Resize/rotate handles, structural handles and opening-specific direct manipulation are not swallowed by generic group movement.
4. **One gesture owner.** Pointer-down resolves one semantic movement transaction before preview; renderer bubbling is not the product contract.
5. **Atomic movement.** Structural room closure and selected furniture apply the same accepted delta and commit as one history operation.
6. **No implicit clipboard ownership.** Furniture enters room clipboard/movement only through explicit selection, marquee hit or `Выбрать мебель в комнате`; mere containment remains insufficient for Copy.
7. **Hosted-opening direct drag.** Doors and windows move along the current host wall. Cursor motion is projected onto that wall, `wallId` remains stable, invalid overlap/extents fail closed and no silent re-hosting occurs.
8. **Practical hit targets.** Thin visual geometry may use a larger invisible interaction target so the ordinary pointer journey is usable without pixel-perfect aim. For doors, the host-wall opening span, leaf and swing arc are targets; the filled swing sector is not. Windows retain thin visuals with a 12 px interaction stroke.
9. **Dev-runtime resilience.** A preserved HMR singleton may repair missing editor actions, but repair cannot replace document/history state or introduce a second authority.
10. **Readable room labels.** Room name/area/dimensions degrade deterministically so compact rooms do not become unreadable.
11. **Product gate closed.** Chromium + representative WebKit GREEN remained necessary but not sufficient; explicit product-owner PASS was received on 2026-08-13. Only protected delivery/integration remains.

### Interaction reference direction

- RoomPlan: ordinary direct wall/opening/furniture manipulation baseline;
- Arcada Planner: centralized hit/drag arbitration architecture reference;
- Blueprint3D Modern: wall-local/in-wall object movement architecture reference.

Vlezet adopts the interaction principle, not external geometry authority. `fedepaj/arcada-planner` and `charmlinn/blueprint3d-modern` are MIT references; copied code for this correction: **none**.

## 8. M8.3 — Precision Reference Calibration

Primary UX goal:

> make scale setup auditable rather than visually approximate.

Planned:

- pan/zoom while calibrating;
- strong magnifier/crosshair;
- source edge/line-centre/intersection snapping;
- keyboard nudge;
- fractional source coordinates where justified;
- second known-distance verification;
- residual/error display;
- source distortion/perspective warning;
- explicit source/reference lock after successful setup.

Before calibration there is no authoritative world scale, so calibration cannot honestly snap to a millimetre world grid. It must snap to source features instead.

Market evidence strengthens this milestone: substrate/blueprint tracing is a normal mature-planner workflow, but Vlezet must expose uncertainty rather than imitate false raster precision.

## 9. M8.4 — Assisted Tracing

Primary UX goal:

> make ordinary drawing faster over a calibrated reference without creating a second editor mode that guesses the whole apartment.

- normal wall/door/window tools remain primary;
- reference assistance is an optional extra snap source;
- user intent and existing topology outrank source-image assistance;
- ambiguous source evidence abstains;
- no network/AI dependency required;
- assisted/recognized geometry becomes ordinary editable Vlezet geometry immediately;
- no opaque AI-owned plan state.

Tracker: #51.

RoomSketcher's editable AI Convert and Planner 5D's recognized editable projects are useful market confirmation of the editable-result pattern, but Vlezet's deterministic validation remains stricter.

## 10. M8.5 — Furniture + Materials 2.0

Primary UX goal:

> furnish a normal apartment without fighting a demo catalogue or form-only transforms, while creating catalogue architecture that can scale later.

Planned:

- scalable parameterised household catalogue;
- broader appliance/sanitary coverage;
- catalogue definitions separated from placed document instances;
- direct physical resize/rotation on Canvas;
- live dimensions;
- better wall/alignment snapping;
- multi-selection alignment/distribution;
- exact inspector remains available;
- specialist wall-relative actions where materially useful;
- material/texture groundwork for furniture and surfaces;
- user-imported assets only after explicit persistence/versioning design.

The goal is useful breadth and quality, not immediate 100k+ catalogue parity with large commercial services.

## 11. M8.6 — Export + Presentation

Primary UX goal:

> turn a finished plan into a clean reusable output with explicit presentation controls.

Required beta direction:

- PNG and SVG;
- whole document and selection;
- reference on/off;
- dimensions/furniture/zones presentation controls;
- transparent background where applicable;
- high-resolution raster export;
- renderer-neutral export scene so formats do not drift semantically;
- PDF after vector/export semantics are stable if low risk;
- export result independent of UI theme.

Planoplan/Floorplanner/RoomPlan are presentation references. Their breadth does not justify creating a second render truth.

Application theme is independent of plan appearance. Dark UI may surround a canonical light plan sheet; export is independent of UI theme.

## 12. M8.7 — Public Beta Hardening

Owns beta-wide:

- accessibility closure;
- responsive/compact desktop hardening;
- performance profiling of common editor gestures;
- error/recovery polish;
- onboarding/help/shortcut discoverability;
- documentation and beta release checklist;
- final BETA-01…BETA-05 browser/product acceptance.

## 13. Beta journeys

### BETA-01 — Blank
Create a small exact apartment manually with walls, doors and windows, then directly correct structure/opening positions without fighting gesture ownership or pixel-perfect opening hit targets.

### BETA-02 — Reference
Import a real source, calibrate, verify scale and trace it reliably.

### BETA-03 — Edit
Multi-select, including whole-room marquee selection, move, copy, paste, duplicate and Undo/Redo without semantic corruption, including supported mixed room/furniture composites.

### BETA-04 — Furnish
Place/edit representative household furniture/appliances and understand fit/conflicts.

### BETA-05 — Export
Export correct whole-plan and selection PNG/SVG with explicit presentation controls.

M8.1 materially advanced BETA-03. M8.2 now has product-code automated-green coverage for the latest runtime/direct-manipulation correction but remains the current dependency until exact docs-head gates and product-owner PASS. M8.3/M8.4 then complete the dependable BETA-02 path.

## 14. Interaction principles

1. Familiar mature-canvas gestures are preferred where they do not conflict with apartment semantics.
2. Physical dimensions are never arbitrary visual scale.
3. A disabled/unsupported operation is better than a silent partial mutation.
4. One user gesture produces one semantic history operation when committed.
5. Transient previews may be rich; committed geometry remains deterministic.
6. Ordinary editing works without network access.
7. Context controls, shortcuts and menus converge on one command implementation.
8. Selection, viewport and transient gesture state remain runtime-only.
9. Browser behaviour is part of the product contract and is tested as browser behaviour.
10. Structural batch editing must preserve topology and hosted openings atomically.
11. An already visibly selected composite must have a predictable drag owner; renderer event bubbling may not define product semantics accidentally.
12. Openings remain host-wall semantic entities, not free-floating furniture.
13. Labels may never obscure core geometry indefinitely; presentation degrades deterministically in tight space.
14. Whole-room marquee should produce a meaningful semantic room selection rather than exposing backing topology as accidental selection membership.
15. Thin rendered entities need usable interaction hit targets; visual stroke width and pointer hit width are separate UX concerns.
16. Dev-runtime hot-reload state may not invalidate the action contract expected by current UI code.

## 15. Mandatory TDD policy

Every deterministic M8 interaction change uses genuine RED → GREEN → regression/refactor.

- test the exact missing behaviour/regression first;
- verify failure for the expected reason;
- add minimal correct production behaviour;
- run focused GREEN and adjacent/full regressions;
- do not lower validation/thresholds or weaken accepted tests for green CI;
- use real Chromium tests for pointer/keyboard/layout flows;
- use representative WebKit coverage for engine-sensitive gesture/input/storage behaviour;
- when a bug depends on preserved runtime/HMR state, add a state-shape regression that a fresh store/process cannot accidentally satisfy;
- pointer tests must exercise realistic hit tolerance rather than only mathematically exact coordinates.

External open-source code or competitor behavior does not waive TDD. If a pattern is adapted, tests must prove the Vlezet contract rather than merely mirror upstream output.

## 16. Mandatory CHANGELOG / research adoption policy

Every accepted M8 UX slice has a focused changelog and canonical changelog entry containing:

- problem/evidence;
- final interaction semantics;
- architecture/authority boundaries;
- meaningful TDD RED/GREEN evidence;
- browser regressions/fixes;
- intentional deferrals;
- exact-head CI/browser evidence;
- explicit product-owner acceptance when required;
- final merge SHA only after actual integration.

When external implementation research materially influences a design, record:

```text
External reference:
Observed behavior/pattern:
What Vlezet adopts:
What Vlezet rejects:
License/copy status:
Tests proving Vlezet contract:
```

Do not replace this with commit-title lists or vague “editor improvements”.

## 17. Original M7 UX finding coverage

The M7.0 finding ledger remains part of repository history and must not disappear when roadmap priorities change.

| Finding | Current ownership/status |
|---|---|
| `UX-SHELL-001` | M7.1 — complete |
| `UX-SHELL-002` | M7.1 — complete |
| `UX-SHELL-003` | M7.2 — complete |
| `UX-SHELL-004` | M7.4 — complete |
| `UX-SHELL-005` | M7.3 — complete |
| `UX-CANVAS-001` | M7.4 foundation + M8.1 accepted; M8.2 closes structural/mixed direct manipulation and whole-room marquee |
| `UX-CANVAS-002` | M7.4 foundation + M8.1 navigation/selection accepted; M8.2 closes direct structural gestures and practical opening hit targets |
| `UX-ONBOARD-001` | M7.5 — complete; final beta discoverability revisited in M8.7 |
| `UX-GEO-001` | M7.6 — complete; M8.2 direct precision editing |
| `UX-GEO-002` | M7.6 — complete; M8.2 direct precision editing |
| `UX-GEO-003` | M7.6 — complete; M8.2 opening direct manipulation / runtime correction |
| `UX-FURN-001` | M7.7 foundation complete; M8.5 Furniture + Materials 2.0 |
| `UX-FURN-002` | M7.7 foundation complete; M8.5 Furniture + Materials 2.0 |
| `UX-FURN-003` | M7.7 foundation complete; M8.5 Furniture + Materials 2.0 |
| `UX-FURN-004` | M7.3/M7.7 foundation complete; M8.5 catalogue/direct manipulation depth |
| `UX-REF-001` | M7.8 source workflow foundation; M8.3 calibration + M8.4 tracing |
| `UX-REF-002` | M8.3/M8.7 |
| `UX-REC-001` | recognition product path de-emphasised; #27 R&D + M8.4 bounded assistance |
| `UX-REC-002` | M8.7 for any beta-visible residual recognition surface |
| `UX-REC-003` | #27 R&D; M8.4 only bounded reference assistance |
| `UX-REC-004` | M7.3 foundation; any residual beta presentation owned by M8.4/M8.7 |
| `UX-3D-001` | accepted M5 foundation; richer 3D/walkthrough post-beta unless evidence reprioritises |
| `UX-3D-002` | M8.7 only for beta-critical accessibility; deeper 3D work post-beta |
| `UX-3D-003` | post-beta unless beta evidence reprioritises |
| `UX-PLAN-001` | accepted M6 foundation; simplification post-beta unless beta evidence reprioritises |
| `UX-PLAN-002` | post-beta unless beta evidence reprioritises |
| `UX-PLAN-003` | accepted M6 foundation; residual simplification post-beta |
| `UX-PLAN-004` | post-beta unless beta evidence reprioritises |
| `UX-DATA-001` | M7.1 — complete |
| `UX-DATA-002` | project lifecycle refinement post-beta unless release evidence requires M8.7 action |
| `UX-DATA-003` | M7.5 — complete |
| `UX-DASH-001` | dashboard refinement post-beta unless release evidence requires M8.7 action |
| `UX-DASH-002` | dashboard refinement post-beta unless release evidence requires M8.7 action |
| `UX-PATTERN-001` | M7.2 — complete |
| `UX-PATTERN-002` | M7.3 — complete |
| `UX-PATTERN-003` | M7.3 — complete |
| `UX-ACCESS-001` | M8.7 public-beta hardening |
| `UX-ACCESS-002` | M7.1 foundation; residual beta closure M8.7 |
| `UX-CONTENT-001` | M7.2/M7.3 — complete; beta discoverability review M8.7 |

Changing the critical path does not mark unresolved findings complete. Items explicitly moved post-beta remain visible here and can be promoted only by evidence-driven roadmap updates.

## 18. Evidence-supported post-beta directions

Current market evidence supports evaluating, after public-beta core trust:

- richer deterministic 3D and walkthrough/presentation parity;
- deeper multi-floor workflows;
- wall elevations/specifications and renovation documentation;
- structured exchange such as DXF/FML/IFC after schema maturity;
- mobile/LiDAR/RoomPlan-style capture as an optional source of editable geometry.

These are candidates, not commitments.

## 19. Programme safeguards

No M8 UX slice may:

- create a second persistent geometry truth;
- make UI/Canvas geometry authoritative over `VlezetDocument`;
- bypass topology/opening/M2 validation;
- make network/AI availability necessary for core editing;
- silently apply an operation to only part of a mixed selection;
- let renderer event ownership define an ambiguous selected-group mutation contract;
- silently re-host an opening while the user intends to move it on the current wall;
- make pixel-perfect pointer placement a hidden requirement for ordinary opening manipulation;
- replace live document/history state merely to repair a dev-runtime action-surface mismatch;
- copy incompatible third-party licensed code without explicit review;
- claim product acceptance solely from green automated checks;
- claim integration before the protected merge is observable on `main`.