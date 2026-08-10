# Vlezet — Roadmap

**Last updated:** 2026-08-10  
**Rule:** deterministic product truth and user trust come before visual spectacle, feature count or speculative automation. Manual editing must remain a complete product path.

Read `docs/PROJECT_STATE.md` first. Detailed product programme design is in `docs/superpowers/specs/2026-08-08-public-beta-editor-program-design.md`.

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
NOW         M8.2 Precision Drawing and Structural Editing
            original product-owner scenarios PASS;
            wall/whole-room clipboard extension automated GREEN;
            focused clipboard retest / protected delivery PENDING
THEN        M8.3–M8.7 Public Beta Editor programme
R&D         automatic whole-plan recognition (#27)
```

M8.1 is product-owner accepted and squash-merged into `main` as `867ec54d21b1dcb94d519ace3bec0a3635717022`. M8.2 is the active Draft delivery slice in PR #87; the originally requested acceptance scenarios passed, but product-owner feedback added ordinary wall and whole-room Copy/Paste before acceptance. That extension is automated-green and awaits focused retest.

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

### M8.2 — Precision Drawing and Structural Editing

Status: **IN DEVELOPMENT / ORIGINAL MANUAL SCENARIOS PASS / CLIPBOARD EXTENSION AUTOMATED GREEN / FOCUSED RETEST PENDING**. Tracker: #56. Draft PR: #87.

Primary outcome:

> Draw, repair and batch-edit exact apartment structure with fewer inspector round-trips while preserving topology and hosted-opening validity.

Implemented scope:

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
- bounded safe-nearby structural Paste when the normal offset would intersect existing topology, with every candidate revalidated through the unchanged structural authority;
- exact source-origin wall overlap remains fail-closed;
- hosted-opening preservation/revalidation;
- one semantic history operation per committed structural gesture/paste;
- fail-closed rejection instead of partial structural mutation;
- accessible structural handles and explicit valid/invalid feedback.

Current whole-room clipboard scope is structural shell + hosted doors/windows + explicit room name. Furniture is not implicitly captured; placed furniture remains a separate clipboard entity family.

Authority remains separated:

- `@vlezet/geometry` owns pure angle/snap calculations and derived room/face geometry;
- `@vlezet/editor-core` owns complete candidate mutation/validation, room-boundary clipboard projection and destructive closure rules;
- Canvas/web owns intent, projection and transient runtime coordination;
- `VlezetDocument` remains persistent truth.

Latest extension evidence:

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
browser artifact:             9059253821
artifact digest:              sha256:219d08315515c1264a66f287cf7d21a2e01d8e6d304075d5c9be7619634dbc71
product-owner clipboard retest: PENDING
protected merge:              PENDING
```

The first expanded Chromium run already proved whole-room Copy/Paste while exposing one real placement defect for a connected single-wall copy: the ordinary +200 mm offset crossed the neighbouring wall and the validator rejected it. A focused unit RED reproduced that exact condition. The final correction changed placement policy only; no topology/opening/M2/recognition validation policy was weakened.

The next action for M8.2 is **focused product-owner clipboard retest**, not M8.3 implementation. After explicit PASS: create the M8.2 acceptance record, synchronize canonical acceptance truth including the concise `docs/CHANGELOG.md` entry, run a fresh accepted-head gate, then perform the separately authorized protected squash merge.

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

### M8.4 — Assisted Tracing

Tracker: #51.

Optional high-confidence source-image snapping inside normal wall/door/window tools after M8.1–M8.3. Explicit user intent and existing topology remain stronger than source-image assistance. Ambiguity abstains. No AI/network dependency required.

### M8.5 — Furniture 2.0

Planned outcomes:

- parameterised household furniture/appliance/sanitary library;
- direct physical resize/rotation on Canvas;
- live dimensions;
- richer snapping;
- multi-selection alignment/distribution;
- wall-relative specialist actions where useful;
- inspector retained for exact numeric editing.

### M8.6 — Export, Appearance and Presentation

Planned outcomes:

- renderer-neutral `ExportScene` concept;
- PNG + SVG;
- whole plan + selection export;
- reference/background/presentation options;
- transparent PNG where applicable;
- application Light/Dark/System theme separated from canonical light plan appearance;
- export result independent of UI theme.

PDF is included only if it is low-risk once vector export exists; it is not allowed to delay beta by itself.

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

M8.1 materially advances `BETA-03`. M8.2 is the next dependency for reliable `BETA-01` structural creation and later `BETA-02` reference tracing.

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
- BIM/DXF/DWG;
- arbitrary user layer stacks;
- full phone/tablet editor parity.

## Delivery workflow

Every slice requires focused design, user-reviewed written spec, task-by-task TDD implementation plan, isolated Draft PR, genuine RED/GREEN evidence, full CI, browser evidence, product-owner acceptance where defined, canonical acceptance sync, fresh exact-head verification, protected squash merge and post-merge identity/state verification.