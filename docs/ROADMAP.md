# Vlezet — Roadmap

**Last updated:** 2026-08-15  
**Rule:** deterministic product truth and user trust come before visual spectacle, feature count or speculative automation. Manual editing must remain a complete product path.

Read `docs/PROJECT_STATE.md` first. Detailed product programme design is in `docs/superpowers/specs/2026-08-08-public-beta-editor-program-design.md`. Product/market direction is additionally governed by `docs/product/COMPETITIVE_BENCHMARK.md`; implementation research policy is in `docs/research/OPEN_SOURCE_FLOOR_PLANNERS.md`; blocking engineering-quality rules are in `docs/testing/TESTING_POLICY.md` and `docs/testing/TEST_COVERAGE_AUDIT.md`.

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
DONE        M8.2 Precision Drawing / Direct Manipulation Foundation — merged e323e331a435ae356b91decbdea80dde95028d8a
DONE        Testing Policy Phase A — merged cc594bae218e9e16724d7574f48be8886852e7ad
DONE        P0 IndexedDB persistence/failure-path remediation — merged 7cb9cfd2a8f809e6000209188b5fab99a2fabfb9
NOW         M8.3 Precision Reference Calibration
THEN        M8.4 Assisted Tracing
THEN        M8.5 Furniture + Materials 2.0
THEN        M8.6 Export + Presentation
THEN        M8.7 Public Beta Hardening
R&D         automatic whole-plan recognition (#27)
POST-BETA   richer walkthrough/3D, professional docs, structured exchange, mobile capture
```

M8.1 is product-owner accepted and protected squash-merged into `main` as `867ec54d21b1dcb94d519ace3bec0a3635717022`.

M8.2 is product-owner accepted and protected squash-merged into `main` as `e323e331a435ae356b91decbdea80dde95028d8a`; canonical acceptance record: `docs/milestones/m8-2-acceptance.md`.

Testing Policy Phase A is accepted and merged as `cc594bae218e9e16724d7574f48be8886852e7ad`. The measured coverage ratchet, changed-code thresholds, browser discovery/classification, runtime-error guard, evidence artifacts and debt registry are blocking engineering infrastructure.

P0 `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` is closed. PR #90 was product-owner accepted and protected squash-merged as `7cb9cfd2a8f809e6000209188b5fab99a2fabfb9`; post-merge CI #5175 and CodeQL #535 are GREEN. Its accepted coverage ratchet and persistence-recovery semantics are now active on `main`. M8.3 is therefore unblocked and becomes the active beta-critical product milestone.

Market research makes RoomPlan the minimum practical interaction benchmark and uses Planner 5D, Floorplanner, RoomSketcher, Planoplan, RemPlanner and magicplan as secondary references. This does not create feature-count parity as a release gate; it prevents Vlezet from rediscovering mature planner interactions in isolation.

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

Product rules:

1. RoomPlan is the minimum practical interaction benchmark for the ordinary apartment-planning journey.
2. Planner 5D, Floorplanner, RoomSketcher and Planoplan are deeper references for editable import/AI, catalogue scale, output/presentation and professional workflows.
3. RemPlanner and magicplan are later references for renovation documentation and field/mobile capture.
4. Mature commercial products define UX expectations; open-source projects are implementation/architecture references only.
5. Before material new editor behavior, inspect a relevant mature UX flow and relevant open-source implementation where useful, then write the Vlezet contract and genuine RED tests.
6. Third-party code never weakens Vlezet topology, hosted-opening, M2, persistence or semantic-history authority.
7. Automatic recognition stays outside the beta critical path even though competitors offer AI conversion; recognized geometry must remain ordinarily editable.

## M8 Public Beta Editor programme

### M8.0 — Public Beta Product Contract / roadmap reset

Status: **DONE / MERGED**.

Target: a public free beta that an unfamiliar non-CAD user can use successfully.

> Familiar mature-canvas interaction quality + strict apartment semantics + millimetre accuracy + local-first deterministic authority.

General diagram freedom is not a goal. Walls/openings/rooms/furniture keep physical semantics and arbitrary structural group scale remains forbidden.

Tracker: #53.

### M8.1 — Editor Interaction Foundation

Status: **DONE / PRODUCT-OWNER ACCEPTED / MERGED**. Tracker: #54. PR: #85.

Accepted scope:

- unified semantic primary + multi-selection;
- click/modifier/marquee/select-all semantics;
- capability-aware commands;
- rigid multi-furniture movement;
- semantic furniture Copy/Cut/Paste/Duplicate with fresh IDs;
- central command registry;
- mature pan/zoom/navigation;
- fit-plan / fit-selection;
- compact multi-selection inspector and semantic context menu;
- fail-closed unsupported mixed/structural operations;
- no arbitrary group scale and no project-schema migration.

Acceptance record: `docs/milestones/m8-1-acceptance.md`.

### M8.2 — Precision Drawing and Direct Manipulation Foundation

Status: **DONE / PRODUCT-OWNER ACCEPTED / MERGED** as `e323e331a435ae356b91decbdea80dde95028d8a`. Tracker: #56. PR: #87.

Primary outcome:

> Draw, repair, select and directly manipulate exact apartment structure with mature-editor interaction quality while preserving topology and hosted-opening validity.

Accepted scope:

- named visible structural snap guides with deterministic priority/hysteresis;
- exact wall length/angle entry;
- direct endpoint/junction editing and topology-safe wall translation;
- atomic common-property editing for compatible walls;
- safe structural and whole-room Copy/Duplicate/Paste with hosted openings;
- strict dependency-closed Cut and fail-closed unsupported destructive room semantics;
- exact polygon-based room targeting and whole-room marquee semantics;
- explicit room + selected-furniture composite movement;
- full-footprint room furniture selection helper;
- bounded safe-nearby structural Paste preserving rigid composite delta;
- direct door/window drag along the current host wall with practical hit targets;
- compact room-label degradation;
- one semantic history operation per accepted structural/composite mutation;
- narrowly scoped dev-runtime action repair without replacing document/history state.

Authority remains separated:

- `@vlezet/geometry` owns pure geometry/derived-room calculations;
- `@vlezet/editor-core` owns complete structural candidate mutation/validation;
- Canvas/web owns intent, projection and transient gestures;
- `VlezetDocument` remains persistent truth;
- M2 remains fit/collision/clearance authority.

Acceptance record: `docs/milestones/m8-2-acceptance.md`.

### Testing Policy Phase A

Status: **DONE / ACCEPTED / MERGED** as `cc594bae218e9e16724d7574f48be8886852e7ad`. PR: #89.

Delivered blocking infrastructure:

- measured workspace coverage baseline generated from Istanbul evidence;
- non-decreasing coverage ratchet;
- changed-production-code thresholds;
- policy self-tests;
- Chromium wildcard discovery of every executable browser spec;
- explicit WebKit representative registry;
- shared runtime-error guard;
- rejection of focused/unregistered skip/fixme tests;
- evidence artifacts;
- canonical testing policy and debt audit.

Canonical contracts:

- `docs/testing/TESTING_POLICY.md`;
- `docs/testing/TEST_COVERAGE_AUDIT.md`.

### P0 IndexedDB persistence / failure-path remediation

Status: **DONE / PRODUCT-OWNER ACCEPTED / PROTECTED SQUASH-MERGED / POST-MERGE VERIFIED**. PR: #90. Merge: `7cb9cfd2a8f809e6000209188b5fab99a2fabfb9`.

Debt: `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` — **CLOSED**.

Delivered behavior/evidence:

- deterministic open/request/blocked/transaction failure contracts;
- native schema/index and v1/v2 -> v3 upgrade evidence;
- project/settings/asset/cascade lifecycle evidence;
- stable storage-boundary recovery errors for corrupted persisted projects/assets;
- current raw asset binary storage uses `ArrayBuffer` while the public asset contract remains `Blob`;
- legacy Blob-backed records remain readable;
- real reference import/save/reload/hydration runs through the production repository in Chromium and WebKit;
- Chromium separately proves a native historical v2 Blob-backed asset survives v3 upgrade;
- current WebKit path avoids the runtime's unreliable direct Blob/File IndexedDB write primitive;
- no database version/store/index change;
- no fake IndexedDB, memory substitute, production test hook, skip, fixme, retry or threshold weakening.

Final evidence:

```text
accepted implementation/policy head: 366ad1f880d5866264e94388412c6dfabf37f83b
final acceptance head:                8d2df0f442fed9193f256a41d7612750c312dda2
CI #5174:                             PASS
Browser Acceptance #1621:             PASS — Chromium 65/65, WebKit 57/57
CodeQL #534:                           PASS
protected squash merge:               7cb9cfd2a8f809e6000209188b5fab99a2fabfb9
post-merge CI #5175:                  PASS
post-merge CodeQL #535:                PASS
product-owner acceptance:              PASS — 2026-08-15 — «Принимаю P0»
```

Focused record: `docs/changelog/2026-08-15-p0-indexeddb-persistence-remediation.md`.

### M8.3 — Precision Reference Calibration

Status: **NOW / ACTIVE**. Tracker: #57.

Why this precedes Assisted Tracing: image-assisted geometry is only trustworthy when image-to-world scale itself is auditable. World-grid snapping cannot solve calibration because millimetre authority is not yet known during the calibration gesture.

Planned outcomes:

- calibration-specific pan/zoom interaction;
- stronger magnifier and crosshair;
- source-image edge, line-centre and intersection snapping;
- keyboard nudge;
- fractional image coordinates where source quality justifies them;
- explicit temporary snap disable;
- second known-distance verification;
- visible residual/error evidence;
- distortion/perspective warning when dimensions disagree materially;
- reference lock only after a valid calibration;
- no false precision claim beyond raster/source quality.

TDD requirements:

- deterministic source-feature fixtures;
- transform/image-coordinate round-trip contracts;
- genuine RED before behavior implementation;
- browser evidence for real pointer/magnifier/keyboard behavior;
- current testing-policy risk classification and coverage gates;
- canonical focused changelog before acceptance.

### M8.4 — Assisted Tracing

Tracker: #51.

After M8.3, normal wall/door/window tools may optionally use high-confidence source-image assistance.

Rules:

- explicit user intent wins;
- existing topology/host semantics win;
- ambiguous image evidence abstains;
- no AI/network dependency is required;
- traced output is ordinary editable Vlezet geometry;
- assistance may never create a second authoritative plan state.

The earlier Assisted Tracing design PR #52 remains closed without merge; useful concepts are retained, but implementation must be revalidated against the accepted editor/calibration substrate.

### M8.5 — Furniture + Materials 2.0

- scalable parameterised furniture/appliance catalogue;
- definition/preset data separated from placed instances;
- direct physical resize and rotation;
- live dimensions;
- richer snapping/alignment/distribution;
- specialist wall-relative actions where they prove useful;
- material/texture groundwork;
- inspector remains authority for exact numeric editing;
- user-imported assets only after explicit persistence/versioning design.

### M8.6 — Export + Presentation

- renderer-neutral `ExportScene` or equivalent authority-neutral export model;
- deterministic PNG + SVG;
- PDF later if low-risk after vector semantics are stable;
- whole-plan and selection export;
- presentation/background/reference visibility controls;
- transparent PNG;
- high-resolution deterministic output;
- plan appearance separate from application theme.

### M8.7 — Public Beta Hardening

- accessibility;
- responsive behavior;
- performance;
- persistence/recovery hardening;
- user-facing documentation;
- representative Chromium/WebKit journey evidence;
- basic tablet usability desirable, full phone/tablet parity not a beta blocker.

Public-beta acceptance journeys:

```text
BETA-01 Blank
BETA-02 Reference
BETA-03 Edit
BETA-04 Furnish
BETA-05 Export
```

No public beta until all five journeys have deterministic/unit coverage where possible, representative browser evidence and no known document-integrity blocker.

## Recognition R&D boundary

M7.8C+ automatic whole-plan recognition remains stopped as a product path because real-plan usefulness failed even when automation metrics looked good. PRs #42, #44 and #45 were closed without merge.

Issue #27 remains open as R&D only. Any future recognition work must prove product usefulness on real-plan evidence and must preserve manual editing as the correction path.

## Delivery rule for new editor behavior

1. inspect mature-product UX references;
2. inspect relevant open-source implementations only when useful;
3. write the explicit Vlezet authority/behavior contract;
4. record license/source note before adopting external implementation ideas;
5. create genuine RED evidence;
6. implement the smallest authority-preserving change;
7. focused tests -> full CI -> required Chromium/WebKit evidence;
8. product-owner acceptance;
9. protected integration and post-merge verification.

Preferred UX benchmark: RoomPlan first; Planner 5D, Floorplanner, RoomSketcher and Planoplan as secondary references.

Useful implementation references include MIT-licensed `blueprint3d-modern`, `arcada-planner`, `react-planner` and `floorplanner/polygon-tools`; Sweet Home 3D may inform architecture/behavior but GPL code must not be copied into Vlezet without an explicit licensing decision.
