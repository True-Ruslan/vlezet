# Vlezet — UX Roadmap

**Phase:** M8 Public Beta Editor  
**Last updated:** 2026-08-12  
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

That evidence broadened M8.2 from “structural precision implementation awaiting acceptance” into a **Direct Manipulation Foundation**. The correction is now implemented and automated GREEN: selected mixed-composite gesture ownership, current-host door/window drag and deterministic compact room-label degradation all have focused tests plus real Chromium/WebKit acceptance. M8.2 still cannot advance until the focused product-owner correction retest explicitly passes.

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

NOW
M8.2 Precision Drawing / Direct Manipulation Foundation
  - direct-manipulation/opening/label correction AUTOMATED GREEN
  - focused product-owner correction retest PENDING
  - Draft / not accepted

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
M8.2: #56 / Draft PR #87. M8.3: #57. M8.4: #51. M8.5: #58. M8.6: #59. M8.7: #60. Final beta acceptance: #61.

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
- rooms/vertices remain excluded from default marquee/select-all in M8.1;
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

**Status:** IN DEVELOPMENT — DIRECT-MANIPULATION CORRECTION AUTOMATED GREEN / PRODUCT-OWNER CORRECTION RETEST PENDING.

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
- unselected furniture and specialized structural/opening/Transformer handles retain their own gesture priority;
- direct door/window movement constrained to the current host wall with stable `wallId`, valid-span clamping/validation and no silent re-host;
- overlap/invalid opening drag shows fail-closed feedback and commits nothing;
- deterministic compact room-label degradation with non-overlapping slots, bounded wrap/ellipsis and keyed renderer fragments;
- fail-closed structural validation/history semantics.

### Product-owner failure that triggered the correction

The 2026-08-12 retest exposed this exact missing gesture owner:

```text
room + furniture visibly selected
→ user drags selected furniture
→ furniture owned direct Konva drag
→ room gesture refused higher-priority entity hit
→ object batch path rejected mixed selection
→ no single composite gesture owner
```

This was treated as a product behavior defect, not an acceptable limitation. The implementation now resolves one semantic gesture owner before mutation: an ordinary selected furniture body in the selected room composite delegates to the same room-composite movement as free room interior. Unselected furniture and specialized handles keep their independent semantics.

### Correction contract now implemented / automated GREEN

1. **Selection-aware gesture arbitration.** If `room + furniture` is explicitly selected, dragging the free room interior or any ordinary already selected furniture member moves the same explicit selected composite.
2. **Specialized controls keep priority.** Resize/rotate handles, structural handles and opening-specific direct manipulation are not swallowed by generic group movement.
3. **One gesture owner.** Pointer-down resolves one semantic movement transaction before preview; renderer bubbling is not the product contract.
4. **Atomic movement.** Structural room closure and selected furniture apply the same accepted delta and commit as one history operation.
5. **No implicit furniture ownership.** Only explicit selection or `Выбрать мебель в комнате` adds furniture to the move.
6. **Hosted-opening direct drag.** Doors and windows move along the current host wall. Cursor motion is projected onto that wall, `wallId` remains stable, invalid overlap/extents fail closed and no silent re-hosting occurs.
7. **Readable room labels.** Room name/area/dimensions degrade deterministically so compact rooms do not become unreadable; dimensions are removed before area, then the name can compact/hide only when safe fit requires it.
8. **TDD/browser coverage.** The exact selected-furniture-origin composite path, free-interior equivalent path, ordinary unselected furniture behavior, Transformer behavior, hosted door/window drag, invalid opening collision and compact-label smoke/evidence are covered in the dedicated real browser suite.
9. **Product gate still open.** Fresh Chromium + representative WebKit GREEN is necessary but not sufficient; explicit product-owner correction PASS remains required.

Verified implementation-head evidence before canonical truth-sync:

```text
head:                         ee5f923346251e759d99d9bcda3cb6cc0a019980
CI #5058 / run 31605042971:  PASS
Browser Acceptance #1508:   PASS — Chromium + WebKit
browser artifact:            9145064452
artifact digest:             sha256:978b5493ac309ca52b45d0555a0a5c11615ef5e933ea8c8684d63362ed4b8646
review threads:              0
```

Focused provenance: `docs/changelog/2026-08-12-m8-2-direct-manipulation-opening-drag-correction.md`.

The first dedicated correction Browser #1503 failed only because its new room fixture disabled snapping required to close the contour and opening drag began outside the actual listening door/window geometry. Those harness defects were corrected without weakening product validation, and later browser hardening asserts rendered interaction bounds and persisted furniture transforms.

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
Create a small exact apartment manually with walls, doors and windows, then directly correct structure/opening positions without fighting gesture ownership.

### BETA-02 — Reference
Import a real source, calibrate, verify scale and trace it reliably.

### BETA-03 — Edit
Multi-select, move, copy, paste, duplicate and Undo/Redo without semantic corruption, including supported mixed room/furniture composites.

### BETA-04 — Furnish
Place/edit representative household furniture/appliances and understand fit/conflicts.

### BETA-05 — Export
Export correct whole-plan and selection PNG/SVG with explicit presentation controls.

M8.1 materially advanced BETA-03. M8.2 now has automated-green coverage for the latest direct-manipulation correction but remains the current dependency until product-owner correction PASS. M8.3/M8.4 then complete the dependable BETA-02 path.

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

## 15. Mandatory TDD policy

Every deterministic M8 interaction change uses genuine RED → GREEN → regression/refactor.

- test the exact missing behaviour/regression first;
- verify failure for the expected reason;
- add minimal correct production behaviour;
- run focused GREEN and adjacent/full regressions;
- do not lower validation/thresholds or weaken accepted tests for green CI;
- use real Chromium tests for pointer/keyboard/layout flows;
- use representative WebKit coverage for engine-sensitive gesture/input/storage behaviour.

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
| `UX-CANVAS-001` | M7.4 foundation + M8.1 accepted; M8.2 closes structural/mixed direct manipulation |
| `UX-CANVAS-002` | M7.4 foundation + M8.1 navigation/selection accepted; M8.2 closes direct structural gestures |
| `UX-ONBOARD-001` | M7.5 — complete; final beta discoverability revisited in M8.7 |
| `UX-GEO-001` | M7.6 — complete; M8.2 direct precision editing |
| `UX-GEO-002` | M7.6 — complete; M8.2 direct precision editing |
| `UX-GEO-003` | M7.6 — complete; M8.2 opening direct manipulation correction |
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
- copy incompatible third-party licensed code without explicit review;
- claim product acceptance solely from green automated checks;
- claim integration before the protected merge is observable on `main`.