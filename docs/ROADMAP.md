# Vlezet — Roadmap

**Last updated:** 2026-08-17  
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
DONE        M8.3 Precision Reference Calibration — merged 01f520988a84291fb6e4f918e21f3403f17c4529, post-merge CI #5248 + CodeQL #608 GREEN
NOW         M8.4 Assisted Tracing
THEN        M8.5 Furniture + Materials 2.0
THEN        M8.6 Export + Presentation
THEN        M8.7 Public Beta Hardening
R&D         automatic whole-plan recognition (#27)
POST-BETA   richer walkthrough/3D, professional docs, structured exchange, mobile capture
```

M8.1 is product-owner accepted and protected squash-merged into `main` as `867ec54d21b1dcb94d519ace3bec0a3635717022`.

M8.2 is product-owner accepted and protected squash-merged into `main` as `e323e331a435ae356b91decbdea80dde95028d8a`; canonical acceptance record: `docs/milestones/m8-2-acceptance.md`.

Testing Policy Phase A is accepted and merged as `cc594bae218e9e16724d7574f48be8886852e7ad`. The measured coverage ratchet, changed-code thresholds, browser discovery/classification, runtime-error guard, evidence artifacts and debt registry are blocking engineering infrastructure.

P0 `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` is closed. PR #90 was product-owner accepted and protected squash-merged as `7cb9cfd2a8f809e6000209188b5fab99a2fabfb9`; post-merge CI #5175 and CodeQL #535 are GREEN. Its accepted coverage ratchet and persistence-recovery semantics are active on `main`.

M8.3 Precision Reference Calibration is **DONE**. Product Owner accepted the focused real-plan journey on 2026-08-17 with «Сценарий PASS.». Final acceptance/docs head `bcb38150e0e6b823e2679b751ae1d96ea84b7ea8` passed CI #5247, Browser Acceptance #1692 (Chromium 67/67, WebKit 57/57) and CodeQL #607. GitHub then protected squash-merged PR #92 as `01f520988a84291fb6e4f918e21f3403f17c4529`; post-merge `main` passed CI #5248 and CodeQL #608. Canonical acceptance record: `docs/milestones/m8-3-acceptance.md`. M8.4 is now unblocked.

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

Status: **DONE / PRODUCT-OWNER ACCEPTED / PROTECTED SQUASH-MERGED / POST-MERGE VERIFIED**. Tracker: #57. PR: #92. Merge: `01f520988a84291fb6e4f918e21f3403f17c4529`.

Why this precedes Assisted Tracing: image-assisted geometry is only trustworthy when image-to-world scale itself is auditable. World-grid snapping cannot solve calibration because millimetre authority is not yet known during the calibration gesture.

Accepted outcomes:

- calibration-specific fit, pan and pointer-centred zoom;
- stronger magnifier and crosshair;
- source-image edge, line-centre and intersection snapping;
- deterministic snapping hysteresis;
- keyboard source-pixel nudge with Shift coarse nudge;
- fractional image coordinates;
- explicit snap toggle and temporary Alt suppression;
- optional second known-distance verification;
- visible residual/error evidence;
- distortion/perspective warning when dimensions disagree materially;
- explicit Save through the existing reference persistence boundary;
- step-by-step guidance and inline validation for incomplete calibration;
- existing endpoint acquisition wins over creation of a missing endpoint, preventing B from being created on top of A;
- no false precision claim beyond raster/source quality.

Authority boundaries:

- `ReferencePlan` remains persistent reference authority;
- viewport/navigation/verification state remains runtime-only until explicit Save;
- source-image assistance does not create apartment geometry authority;
- no schema migration;
- no AI/network dependency.

Final evidence:

```text
accepted product/test head:     53ee9399f2496ff3847761b9290cef03d8aa4b7e
acceptance/docs head:           bcb38150e0e6b823e2679b751ae1d96ea84b7ea8
CI #5247:                       PASS through build
Browser Acceptance #1692:      PASS
Chromium:                       67/67 PASS
WebKit representative:         57/57 PASS
CodeQL #607:                    PASS
protected squash merge:         01f520988a84291fb6e4f918e21f3403f17c4529
post-merge CI #5248:            PASS through build
post-merge CodeQL #608:         PASS
workers:                        1
retries:                        0
```

Product-owner real-plan acceptance on 2026-08-17: **PASS — «Сценарий PASS.»**

Acceptance record: `docs/milestones/m8-3-acceptance.md`.

### M8.4 — Assisted Tracing

Status: **NOW / ACTIVE BETA-CRITICAL SLICE**. Tracker: #51.

Normal wall/door/window tools may optionally use high-confidence source-image assistance, but M8.4 must consume the accepted M8.3 source-coordinate/calibration substrate instead of inventing a second image/world transform.

Rules:

- explicit user intent wins;
- existing topology/host semantics win;
- ambiguous image evidence abstains;
- no AI/network dependency is required;
- traced output is ordinary editable Vlezet geometry;
- assistance may never create a second authoritative plan state;
- no whole-plan recognition requirement is reintroduced into the beta critical path.

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

## Public beta acceptance journeys

```text
BETA-01 Blank
BETA-02 Reference
BETA-03 Edit
BETA-04 Furnish
BETA-05 Export
```

No public beta until all five journeys have deterministic/unit coverage where possible plus representative Chromium/WebKit browser evidence and no known document-integrity blocker.

M8.1 materially advances `BETA-03`; M8.2 is the structural foundation for `BETA-01`; M8.3 establishes trustworthy reference calibration and M8.4 will complete the beta-critical assisted `BETA-02` tracing path.

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