# Vlezet — Roadmap

**Last updated:** 2026-08-09  
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
ACCEPTED*   M8.1 Editor Interaction Foundation
NEXT*       M8.2 Precision Drawing and Structural Editing
THEN        M8.3–M8.7 Public Beta Editor programme
R&D         automatic whole-plan recognition (#27)
```

`*` M8.1 is product-owner accepted in PR #85 and awaits protected integration into `main`. M8.2 is selected next but must not start until that merge completes.

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

Status: **PRODUCT-OWNER ACCEPTED / PROTECTED MERGE PENDING**. Tracker: #54. PR: #85.

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

The final selected-group drag/snap defect was reproduced through genuine RED tests and fixed at the Konva projection boundary without changing snap or fit authority. The regression now covers three deterministic cursor-jitter profiles plus exact Undo/Redo behavior in Chromium and WebKit.

Acceptance evidence:

```text
product-accepted head:        db66de524783a43fa021db07a6b67808c4435e9b
CI #4813:                     PASS
Recognition Benchmark #1149: PASS
Browser Acceptance #1269:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
product-owner retest:         PASS
```

Acceptance record: `docs/milestones/m8-1-acceptance.md`.

Structural clipboard/batch movement and common-property editing for selected walls are M8.2, not hidden extensions of M8.1.

### M8.2 — Precision Drawing and Structural Editing

Status: **SELECTED NEXT — DO NOT START BEFORE M8.1 MERGE**. Tracker: #56.

Primary outcome:

> Draw, repair and batch-edit exact apartment structure with fewer inspector round-trips while preserving topology and hosted-opening validity.

Planned outcomes:

- named visible snap guides;
- endpoint/wall-axis/midpoint/intersection snapping;
- parallel/perpendicular assistance;
- exact inline wall length and useful angle input;
- direct vertex/junction editing;
- topology-safe structural movement;
- atomic common-property editing for compatible selected walls, beginning with thickness;
- structural clipboard only with explicit dependency closure;
- opening preservation/revalidation;
- one semantic history command per committed gesture;
- fail closed rather than partially mutating an unsafe structural selection.

Before implementation, M8.2 requires an explicit design/spec and a task-by-task TDD implementation plan. Placed-object batch semantics from M8.1 may not be copied into structural editing without proving topology safety.

### M8.3 — Precision Reference Calibration

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
