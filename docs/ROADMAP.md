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
ACCEPTED    P0 IndexedDB persistence/failure-path remediation — PR #90; protected integration pending
NEXT        M8.3 Precision Reference Calibration — after P0 protected integration + post-merge verification
THEN        M8.4 Assisted Tracing
THEN        M8.5 Furniture + Materials 2.0
THEN        M8.6 Export + Presentation
THEN        M8.7 Public Beta Hardening
R&D         automatic whole-plan recognition (#27)
POST-BETA   richer walkthrough/3D, professional docs, structured exchange, mobile capture
```

M8.1 is product-owner accepted and protected squash-merged into `main` as `867ec54d21b1dcb94d519ace3bec0a3635717022`.

M8.2 is product-owner accepted and protected squash-merged into `main` as `e323e331a435ae356b91decbdea80dde95028d8a`; canonical acceptance record: `docs/milestones/m8-2-acceptance.md`.

Testing Policy Phase A is accepted and merged as `cc594bae218e9e16724d7574f48be8886852e7ad`. The measured coverage ratchet, changed-code thresholds, browser discovery/classification, runtime-error guard, evidence artifacts and debt registry are now blocking engineering infrastructure rather than an in-development branch experiment.

The first explicit P0 debt item, `TEST-DEBT-INDEXEDDB-FAILURE-PATHS`, is technically remediated and explicitly product-owner accepted in PR #90. Accepted implementation/policy head `366ad1f880d5866264e94388412c6dfabf37f83b` passed CI #5167, Browser Acceptance #1614 (Chromium 65/65, WebKit 57/57, retries 0) and CodeQL #527 before acceptance truth-sync. Protected integration and post-merge verification remain pending. M8.3 starts only after those repository gates complete.

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

Status: **TECHNICALLY COMPLETE / PRODUCT-OWNER ACCEPTED / PR #90 / PROTECTED INTEGRATION PENDING**.

Debt: `TEST-DEBT-INDEXEDDB-FAILURE-PATHS`.

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

Product-owner accepted implementation/policy evidence:

```text
head:                         366ad1f880d5866264e94388412c6dfabf37f83b
CI #5167 / run 31889155829:  PASS
CodeQL #527 / run 31889153986: PASS
Browser Acceptance #1614 / run 31889155832: PASS
  Chromium:                  65/65 PASS
  WebKit:                    57/57 PASS
  workers:                   1
  retries:                   0
browser artifact:            9248180775
artifact digest:             sha256:58d22159c0ab995ef2659c46977def0d4e32cee8ea354af7cf8770c73a95eb75
product-owner acceptance:    PASS — 2026-08-15 — «Принимаю P0»
```

Focused record: `docs/changelog/2026-08-15-p0-indexeddb-persistence-remediation.md`.

Acceptance truth-sync creates a later docs-only head. Fresh exact-head delivery verification is mandatory before PR #90 leaves Draft; after that the only remaining steps are protected squash integration and post-merge CI + CodeQL verification. CI alone did not create product acceptance; the product owner did.

### M8.3 — Precision Reference Calibration

Status: **PLANNED / NEXT AFTER P0 PROTECTED INTEGRATION**. Tracker: #57.

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

Optional high-confidence source-image snapping inside normal wall/door/window tools after M8.3. Explicit user intent and existing topology remain stronger than source-image assistance. Ambiguity abstains. No AI/network dependency required.

Any traced/recognized result must become ordinary editable Vlezet geometry. AI/image assistance accelerates the normal editor; it may never create a parallel opaque plan state.

### M8.5 — Furniture + Materials 2.0

Planned outcomes:

- scalable parameterised household furniture/appliance/sanitary catalogue;
- catalogue/preset definitions separated from placed document instances;
- direct physical resize/rotation on Canvas;
- live dimensions;
- richer wall/alignment snapping;
- multi-selection alignment/distribution;
- material/texture groundwork;
- inspector retained for exact numeric editing;
- user-imported assets only after explicit persistence/versioning design.

This milestone targets useful breadth and scalable architecture, not immediate catalogue-count parity with mature commercial planners.

### M8.6 — Export + Presentation

Planned outcomes:

- renderer-neutral export model;
- PNG + SVG;
- PDF after vector/export semantics are stable if low risk;
- whole plan + selection export;
- reference/background/presentation options;
- dimensions/furniture/zones visibility controls;
- high-resolution deterministic output;
- application theme separated from canonical plan appearance;
- architecture prepared for later 3D/share output without making it a beta blocker.

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

M8.1 materially advances `BETA-03`; M8.2 is the structural foundation for `BETA-01`; M8.3/M8.4 complete the beta-critical `BETA-02` reference/tracing journey.

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
- hiding browser incompatibility with unregistered skip/fixme/retry;
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
