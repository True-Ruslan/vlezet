# Vlezet — Project State

**Last updated:** 2026-08-15  
**Status:** M0–M8.2 are implemented, product-accepted and merged. Testing Policy Phase A is accepted and merged into `main` as `cc594bae218e9e16724d7574f48be8886852e7ad`. The P0 `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` remediation is technically complete and exact-head GREEN in Draft PR #90, but product-owner acceptance and protected integration are still pending. The next product milestone remains M8.3 Precision Reference Calibration after P0 protected integration.  
**Target:** public free beta suitable for unfamiliar users.  
**Canonical rule:** read this file first, then `docs/ROADMAP.md`, `docs/product/UX_ROADMAP.md`, `docs/product/COMPETITIVE_BENCHMARK.md`, `docs/research/OPEN_SOURCE_FLOOR_PLANNERS.md`, `docs/testing/TESTING_POLICY.md`, `docs/testing/TEST_COVERAGE_AUDIT.md`, the latest focused changelog and the active design/plan.

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
24. Dev-runtime/HMR state must not silently lose semantic editor actions; compatibility repair may restore missing actions only and must bind them to the live authoritative store rather than replace document/history state.
25. A marquee that fully encloses a derived room selects that room as one structural semantic root; backing walls/openings are not duplicated into the same selection merely because they lie inside the rectangle.
26. Public/domain project-asset API remains Blob-based; raw IndexedDB representation may use a browser-compatible binary representation as long as reads validate and hydrate into the same public contract and legacy data remains readable.

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
- browser acceptance: Playwright Chromium complete discovered suite + explicit representative WebKit registry, single worker, retries `0`.

## 4. Accepted milestones and engineering platform

| Milestone | Result |
|---|---|
| M0–M4.6 | trusted 2D shell, projects, reference import, editable recognition MVP and precision geometry UX |
| M5.1–M5.4 | deterministic read-only 3D shell, furniture and spatial inspection |
| M6.1–M6.4 | deterministic planning, exact constraints and reviewed language intent |
| M7.0–M7.7 | editor shell, context inspector, design system, feedback, recovery, geometry and furniture workflows |
| M7.8A | recognition benchmark foundation, deterministic corpus/scorer/evidence |
| M7.8B | region-first source normalisation, wall topology, bounded Draft and verification-only AI |
| M8.0 | public-beta product contract, roadmap reset and manual-editor-first direction |
| M8.1 | product-owner accepted and protected squash-merged as `867ec54d21b1dcb94d519ace3bec0a3635717022` |
| M8.2 | product-owner accepted and protected squash-merged as `e323e331a435ae356b91decbdea80dde95028d8a` |
| Testing Policy Phase A | accepted and merged as `cc594bae218e9e16724d7574f48be8886852e7ad`; measured coverage ratchet, changed-code thresholds, browser discovery/classification, runtime-error guard and evidence artifacts are blocking infrastructure |

Canonical M8.1/M8.2 acceptance records remain in `docs/milestones/`. Detailed historical RED→GREEN evidence remains in `docs/changelog/` and `docs/CHANGELOG.md`; this file records current truth rather than duplicating every checkpoint.

## 5. Recognition experiment outcome

M7.8C and its stacked experimental work were **not product-accepted**.

The final original-plan retest still showed insufficient usefulness:

- structural geometry remained incomplete/ambiguous;
- visible windows were not reliably recovered;
- service/sanitary notation still competed with structural geometry;
- AI verification largely confirmed/rejected existing candidates and did not solve missing geometry.

PRs #42, #44 and #45 were closed without merge. Their benchmark/safety work is preserved as R&D evidence. Automatic whole-plan recognition remains tracked under #27 but no longer controls the public-beta critical path.

The earlier Assisted Tracing design PR #52 is also closed without merge. Its concepts are preserved, while implementation is intentionally deferred to M8.4 after the editor/calibration foundation.

Market research performed on 2026-08-12 reinforces this decision: mature products that offer AI/scan conversion still rely on an ordinary editable plan as the correction path. Vlezet therefore treats AI/image assistance as acceleration into the normal editor, never as a second authoritative plan state.

## 6. Current product capability

### Editing/projects

- topological walls, rooms and hosted openings;
- clear dimensions and usable area;
- furniture with exact transforms and clearances;
- explainable fit/collision/door diagnostics;
- semantic Undo/Redo;
- local projects, autosave, portable backup and PNG export;
- versioned IndexedDB local persistence and recovery.

### M8.1 interaction foundation — accepted and merged

- unified semantic primary + multi-selection;
- click/modifier/marquee/select-all semantics;
- capability-aware commands;
- rigid multi-furniture movement;
- semantic placed-object Copy/Cut/Paste/Duplicate with fresh IDs;
- central command registry;
- wheel/trackpad pan + modified pointer-centred zoom;
- Space+drag and middle-button pan;
- fit-plan / fit-selection;
- compact multi-selection inspector and semantic context menu;
- fail-closed mixed/structural operations;
- no arbitrary group scale and no project-schema migration.

### M8.2 precision drawing / direct manipulation — accepted and merged

Accepted scope includes:

- deterministic structural snapping with visible guides and hysteresis;
- exact wall length/angle input;
- direct endpoint/junction/wall translation under editor-core validation;
- atomic multi-wall thickness editing;
- topology-safe structural/room Copy/Duplicate/Paste and dependency-closed Cut rules;
- whole-room semantic marquee and derived-room targeting;
- explicit room + selected-furniture composite movement;
- full-footprint room furniture selection helper;
- safe-nearby structural paste with rigid composite delta;
- direct hosted door/window movement along the current host wall;
- practical opening hit targets;
- compact room-label degradation;
- semantic single-command history and visible fail-closed rejection;
- narrowly scoped HMR live-store compatibility repair without replacing document/history authority.

Canonical acceptance record: `docs/milestones/m8-2-acceptance.md`.

### Reference/recognition

Accepted source import/calibration and M7.8A/B benchmark infrastructure remain available. Recognition is assistive/experimental and is not a beta dependency.

### 3D/planning

Existing deterministic read-only 3D and bounded planning remain available, but they are not the current beta-critical investment.

## 7. Testing platform and P0 IndexedDB remediation

Testing Policy Phase A is **accepted and merged** as `cc594bae218e9e16724d7574f48be8886852e7ad`.

Canonical testing contracts:

- `docs/testing/TESTING_POLICY.md`;
- `docs/testing/TEST_COVERAGE_AUDIT.md`.

Blocking policy includes:

- measured non-decreasing coverage baseline/ratchet;
- changed-code coverage thresholds;
- fail-safe browser-spec discovery/classification;
- shared browser runtime-error guard;
- no unregistered skip/fixme;
- single-worker, retry-free representative browser evidence;
- generated evidence artifacts instead of hand-authored measurements.

### P0 `TEST-DEBT-INDEXEDDB-FAILURE-PATHS`

Status: **TECHNICALLY REMEDIATED in Draft PR #90; product-owner acceptance and protected integration pending.**

The remediation proved native IndexedDB lifecycle/failure behavior and found real persisted-read boundary defects. Persisted project/asset corruption is now translated into stable `ProjectStorageError` recovery semantics while direct writes retain strict domain validation.

WebKit evidence additionally demonstrated that native Blob/File writes are not a reliable current raw IndexedDB primitive in the tested runtime. The public asset API remains `Blob`, while current raw IndexedDB records store `blobBytes: ArrayBuffer` and hydrate back to Blob before validation. Database name/version/store/index schema remains unchanged, and legacy Blob-backed records remain readable.

Browser authority is explicit rather than hidden behind retries/skips:

- Chromium full discovery proves the native historical v2 Blob-backed asset survives v3 upgrade;
- Chromium + WebKit prove current ArrayBuffer-backed real reference import/save/reload/hydration, v1/v2 metadata upgrades, project lifecycle/cascade and corruption recovery;
- workers remain `1`, retries remain `0`.

Pre-canonical-sync technical checkpoint:

```text
technical head:              25bf1dea0b823dbec92538cf06f9c178581b5424
CI #5159:                    PASS
CodeQL #512:                 PASS
Browser Acceptance #1606:    PASS
  Chromium:                  65/65 PASS
  WebKit:                    57/57 PASS
browser artifact:            9245027204
artifact digest:             sha256:6a841f0f21bef3df7e7afbe3eac9094b4e1385218b423904efc2f0213bce026b
```

Focused record: `docs/changelog/2026-08-15-p0-indexeddb-persistence-remediation.md`.

These results establish technical completion only. PR #90 remains Draft until explicit product-owner acceptance, and no protected merge may be inferred from CI.

## 8. Current programme sequencing

```text
DONE  M8.1  Editor Interaction Foundation
DONE  M8.2  Precision Drawing / Direct Manipulation Foundation — merged e323e331a435ae356b91decbdea80dde95028d8a
DONE  Testing Policy Phase A — merged cc594bae218e9e16724d7574f48be8886852e7ad
NOW   P0 IndexedDB persistence/failure-path remediation — technically GREEN in Draft PR #90; acceptance/integration pending
NEXT  M8.3  Precision Reference Calibration — begin only after P0 protected integration
THEN  M8.4  Assisted Tracing
THEN  M8.5  Furniture + Materials 2.0
THEN  M8.6  Export + Presentation
THEN  M8.7  Public Beta Hardening
TARGET PUBLIC FREE BETA
```

Programme tracker: #53. M8.3 tracker: #57.

## 9. M8.3 next product milestone

Status: **PLANNED / WAITING FOR P0 PROTECTED INTEGRATION**.

Planned outcomes:

- calibration pan/zoom;
- stronger magnifier/crosshair;
- source edge/line-centre/intersection snapping;
- keyboard nudge;
- fractional image coordinates where justified;
- second known-distance verification;
- visible residual/error and distortion warning;
- no false claim of precision beyond raster/source quality.

M8.3 must preserve the current reference-plan/project persistence model and may not bypass the testing policy established in Phase A.

## 10. Later public-beta programme

### M8.4 — Assisted Tracing

Optional high-confidence source-image snapping inside normal wall/door/window tools. Explicit user intent and existing topology remain stronger than source-image assistance. Ambiguity abstains. No AI/network dependency is required.

Any traced/recognized result must become ordinary editable Vlezet geometry; assistance may never create a parallel opaque authoritative state.

### M8.5 — Furniture + Materials 2.0

- scalable parameterised household catalogue;
- catalogue/preset definitions separated from placed instances;
- direct physical resize/rotation and live dimensions;
- richer alignment/snapping;
- material/texture groundwork;
- inspector retained for exact numeric editing;
- user-imported assets only after explicit persistence/versioning design.

### M8.6 — Export + Presentation

- renderer-neutral export model;
- PNG + SVG;
- PDF after vector/export semantics are stable if low risk;
- whole plan + selection export;
- reference/background/presentation options;
- deterministic high-resolution output independent of UI theme.

### M8.7 — Public Beta Hardening

Accessibility, responsive behavior, performance, recovery and documentation hardening across the beta-critical path. Tablet basic usability is desirable; full phone/tablet parity is not a beta blocker.

Public beta acceptance journeys remain:

```text
BETA-01 Blank
BETA-02 Reference
BETA-03 Edit
BETA-04 Furnish
BETA-05 Export
```

No public beta until all five journeys have deterministic/unit coverage where possible plus representative Chromium/WebKit evidence and no known document-integrity blocker.

## 11. Product / open-source research policy

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

When external implementation materially influences a design, the active design/plan/changelog must record what was observed, adopted, rejected, its license/copy status and Vlezet-specific tests.

## 12. Mandatory delivery rule

For material deterministic behavior:

```text
relevant mature-product UX review where useful
→ relevant open-source architecture/code review where useful
→ explicit Vlezet contract and authority boundaries
→ focused failing test (genuine RED)
→ verify intended failure
→ minimal correct implementation
→ focused GREEN
→ adjacent/full regression
→ Chromium/WebKit evidence according to policy
→ refactor while green
→ canonical truth sync
→ product-owner acceptance
→ protected integration
```

Forbidden:

- weakening validation, coverage thresholds or assertions merely for green CI;
- treating a pre-existing passing test as RED evidence;
- replacing real browser behavior with source-string assertions where behavior can be exercised directly;
- hiding unsupported browser behavior with unregistered skips/fixmes/retries;
- claiming product acceptance, merge or release from CI alone.

Every accepted M8 slice must maintain a focused changelog, concise `docs/CHANGELOG.md` entry, truthful canonical state/roadmap, exact-head automated evidence, explicit product-owner acceptance and the real protected merge identity only after GitHub reports it.

## 13. Deliberate pre-beta non-goals

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

## 14. Evidence-supported post-beta directions

After public-beta manual/editor trust is established, current market evidence supports evaluating:

- richer deterministic 3D and walkthrough/presentation parity;
- deeper multi-floor workflows;
- wall elevations/specifications and renovation documentation;
- structured external exchange such as DXF/FML/IFC after schema maturity;
- mobile/LiDAR/RoomPlan-style capture as an optional source of ordinary editable geometry.

These are opportunities, not commitments, and may be reprioritized only from user evidence.
