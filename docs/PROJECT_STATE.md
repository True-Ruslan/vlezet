# Vlezet — Project State

**Last updated:** 2026-08-22  
**Status:** M0–M8.3 are implemented, product-accepted and merged. Testing Policy Phase A is accepted and merged as `cc594bae218e9e16724d7574f48be8886852e7ad`. P0 `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` is product-owner accepted, protected squash-merged as `7cb9cfd2a8f809e6000209188b5fab99a2fabfb9` and post-merge verified by CI #5175 + CodeQL #535. **M8.3 Precision Reference Calibration is product-owner accepted, protected squash-merged as `01f520988a84291fb6e4f918e21f3403f17c4529` and post-merge verified by CI #5248 + CodeQL #608.** **M8.4 Wall Assisted Tracing is SHELVED as of 2026-08-22: it failed real-plan Product Owner acceptance a third time (corner-adjacent snap fell to the wall's edge instead of its axis) on the same root-cause class as its first two fails; no benchmarked competitor performs this live pixel-snap mechanism; Draft PR #94 is closed without merge and preserved as R&D evidence, matching the M7.8C precedent in §5. Product priority resets to core structural/editing behavior and interaction/UI/UX quality.** Two follow-on fixes are merged: Delete/Backspace honest-feedback for walls (PR #95, `2f3469e55e1ae2a84564a01044623f3523516501`) and a dependency-security patch resolving 25 advisories (PR #96, `91cadaceba011f1865423365d45e1c9c8e31ba0d`).  
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
27. Reference calibration before a known world scale is a **source-image coordinate problem**: source-image features may assist calibration, but world-grid or AI output may not become calibration authority.
28. M8.4 wall source assistance is transient evidence only: it may influence the ordinary wall preview under explicit precedence rules, but may never persist source metadata, synthesize topology authority or create a parallel document state.

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
| M8.3 | **product-owner accepted, protected squash-merged as `01f520988a84291fb6e4f918e21f3403f17c4529`, post-merge CI #5248 + CodeQL #608 GREEN**; canonical acceptance record: `docs/milestones/m8-3-acceptance.md` |
| M8.4 wall slice | **SHELVED — third real-plan Product Owner FAIL (2026-08-22); not accepted, not merged; Draft PR #94 closed without merge, branch preserved as R&D evidence** |
| Testing Policy Phase A | accepted and merged as `cc594bae218e9e16724d7574f48be8886852e7ad`; measured coverage ratchet, changed-code thresholds, browser discovery/classification, runtime-error guard and evidence artifacts are blocking infrastructure |
| P0 IndexedDB persistence | product-owner accepted, protected squash-merged as `7cb9cfd2a8f809e6000209188b5fab99a2fabfb9`, post-merge CI #5175 + CodeQL #535 GREEN |
| Selection Delete honest-feedback | product-owner accepted, protected squash-merged as `2f3469e55e1ae2a84564a01044623f3523516501` |
| Dependency security patch | protected squash-merged as `91cadaceba011f1865423365d45e1c9c8e31ba0d`; `pnpm audit` clean (0 known vulnerabilities, down from 25) |

Canonical M8.1/M8.2/M8.3 acceptance records remain in `docs/milestones/`. Detailed RED→GREEN evidence remains in `docs/changelog/` and `docs/CHANGELOG.md`; this file records current truth rather than duplicating every checkpoint. M8.4 technical evidence remains recorded in `docs/changelog/2026-08-17-m8-4-wall-assisted-tracing-technical-green.md` for historical context only; the shelving decision and its rationale are recorded in `docs/changelog/2026-08-22-m8-4-wall-assisted-tracing-shelved.md`.

## 5. Recognition experiment outcome

M7.8C and its stacked experimental work were **not product-accepted**.

The final original-plan retest still showed insufficient usefulness:

- structural geometry remained incomplete/ambiguous;
- visible windows were not reliably recovered;
- service/sanitary notation still competed with structural geometry;
- AI verification largely confirmed/rejected existing candidates and did not solve missing geometry.

PRs #42, #44 and #45 were closed without merge. Their benchmark/safety work is preserved as R&D evidence. Automatic whole-plan recognition remains tracked under #27 but no longer controls the public-beta critical path.

The earlier Assisted Tracing design PR #52 is also closed without merge. Its concepts were carried into M8.4's wall-only implementation, which itself failed real-plan Product Owner acceptance three times on the same root-cause pattern (incomplete/ambiguous geometry from deterministic pixel-level assistance) and was shelved on 2026-08-22 for the same reason — see the M8.4 section in §10 and `docs/changelog/2026-08-22-m8-4-wall-assisted-tracing-shelved.md`.

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

### M8.3 precision reference calibration — accepted, merged and post-merge verified

Accepted scope includes:

- dedicated calibration viewport with fit, pan and pointer-centred zoom;
- source-image edge, line-centre and intersection feature detection;
- deterministic source snapping with acquisition/release hysteresis;
- explicit snap toggle and temporary Alt suppression;
- magnifier, crosshair and source-coordinate readout;
- semantic A/B endpoint handles;
- source-pixel keyboard nudge with Shift coarse nudge;
- fractional source coordinates;
- optional second known-distance verification;
- residual/error verification and distortion warning behavior;
- explicit Save through the existing reference persistence boundary;
- next-step guidance and explicit inline validation for incomplete calibration;
- existing endpoint acquisition wins over missing-endpoint creation, preventing B from being synthesized on top of A.

Product-owner real-plan acceptance on 2026-08-17: **PASS** — «Сценарий PASS.»

Final accepted/integration evidence:

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

Canonical acceptance record: `docs/milestones/m8-3-acceptance.md`.

### M8.4 wall Assisted Tracing — SHELVED (2026-08-22)

Status: **SHELVED / NOT ACCEPTED / NOT MERGED / R&D EVIDENCE ONLY**, following the same protocol as the M7.8C automatic-recognition decision in §5.

The wall-only slice reached automated technical GREEN (implementation head `b4f1ede701aaa28b5ee91d9a017a5e7fb6ff23d5`; CI #5289, Browser Acceptance #1732 — Chromium 68/68, WebKit 58/58, CodeQL `95437977365`), but automation was never claimed as product acceptance. The Product Owner real-plan checklist then failed **three times**:

1. 2026-08-18 — first real-plan FAIL.
2. 2026-08-19 — second real-plan FAIL (`docs/changelog/2026-08-19-m8-4-second-real-plan-fail.md`); a corrective RED→GREEN round followed, targeting multi-wall chain stability, corner transitions and topology-safe closure.
3. 2026-08-22 — third real-plan FAIL, same root-cause class: source assistance snapped a traced exterior-corner wall fragment to the wall's edge face instead of its centre axis. Code review confirmed `collapseOutlinePair` (`apps/web/components/reference/wall-source-feature-reader.ts`) can only derive a centreline from a clean local pair of parallel edge/line-centre detections; near an architectural corner this pairing degrades and the code falls back to a raw edge feature. Three separate prior corrective commits already targeted this same corner-evidence class (`prefer bounded wall corner evidence`, `preserve balanced architectural corner evidence`, `cluster antialiased wall edge responses`), each passing its own regression — yet the corner case failed a real plan again.

A market-validation check against `docs/product/COMPETITIVE_BENCHMARK.md` found **no benchmarked competitor (RoomPlan, Planner 5D, Floorplanner, RoomSketcher, Planoplan, RemPlanner, magicplan) performs live pixel-level snap-to-underlay assistance during manual wall drawing** — the mechanism M8.4 attempts. Competitors either ship plain manual tracing (RoomPlan) or one-shot AI plan conversion (Floorplanner, RoomSketcher), never a continuous non-AI snap during drawing. Combined with three same-class real-plan failures, this is read as evidence that deterministic pixel-level wall-axis derivation is architecturally hard to make reliable specifically at corners, rather than one remaining bug.

**Decision:** M8.4 wall-only Assisted Tracing is shelved. Draft PR #94 is closed without merge; branch `feat/m8-4-wall-assisted-tracing` is preserved (not deleted) as R&D evidence, matching how PRs #42/#44/#45 were preserved for M7.8C. Hosted door/window source assistance, previously blocked pending wall acceptance, is now out of scope entirely. The accepted M8.3 calibration substrate is unaffected — manual tracing over a calibrated reference image by eye remains fully available and is the same baseline RoomPlan itself ships.

Product priority resets to strong core structural/editing behavior and best-practice interaction/UI/UX quality first; additional functionality (including any future revisit of image-assisted tracing) only after that core is solid.

Full rationale and evidence: `docs/changelog/2026-08-22-m8-4-wall-assisted-tracing-shelved.md`. Prior technical-GREEN record (historical context only, not acceptance): `docs/changelog/2026-08-17-m8-4-wall-assisted-tracing-technical-green.md`.

### Reference/recognition

Accepted source import, M8.3 calibration and M7.8A/B benchmark infrastructure remain available. Recognition is assistive/experimental and is not a beta dependency.

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

### P0 `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` — closed

The remediation proved native IndexedDB lifecycle/failure behavior and found real persisted-read boundary defects. Persisted project/asset corruption is translated into stable `ProjectStorageError` recovery semantics while direct writes retain strict domain validation.

WebKit evidence additionally demonstrated that native Blob/File writes are not a reliable current raw IndexedDB primitive in the tested runtime. The public asset API remains `Blob`, while current raw IndexedDB records store `blobBytes: ArrayBuffer` and hydrate back to Blob before validation. Database name/version/store/index schema remains unchanged, and legacy Blob-backed records remain readable.

Browser authority is explicit rather than hidden behind retries/skips:

- Chromium full discovery proves the native historical v2 Blob-backed asset survives v3 upgrade;
- Chromium + WebKit prove current ArrayBuffer-backed real reference import/save/reload/hydration, v1/v2 metadata upgrades, project lifecycle/cascade and corruption recovery;
- workers remain `1`, retries remain `0`.

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

## 8. Current programme sequencing

```text
DONE      M8.1  Editor Interaction Foundation
DONE      M8.2  Precision Drawing / Direct Manipulation Foundation — merged e323e331a435ae356b91decbdea80dde95028d8a
DONE      Testing Policy Phase A — merged cc594bae218e9e16724d7574f48be8886852e7ad
DONE      P0 IndexedDB persistence/failure-path remediation — merged 7cb9cfd2a8f809e6000209188b5fab99a2fabfb9
DONE      M8.3  Precision Reference Calibration — merged 01f520988a84291fb6e4f918e21f3403f17c4529, post-merge verified
SHELVED   M8.4  Wall Assisted Tracing — third real-plan Product Owner FAIL (2026-08-22); Draft PR #94 closed without merge, R&D evidence only
DROPPED   M8.4  Hosted door/window assistance — depended on shelved wall slice; out of scope
NOW       M8.4-UX  Core Interaction & UI/UX Hardening — product priority reset 2026-08-22; strong core + best-practice interaction quality before further feature growth; initial scope draft: honest Delete/keyboard feedback everywhere (started in PR #95), arrow-key nudge, unified keyboard-shortcut registry, safe room deletion, selection-visual polish
THEN      M8.5  Furniture + Materials 2.0
THEN      M8.6  Export + Presentation
THEN      M8.7  Public Beta Hardening
TARGET    PUBLIC FREE BETA
```

Programme tracker: #53. M8.3 tracker: #57. M8.4 tracker: #51 (closed, shelved).

## 9. M8.3 accepted product milestone

Status: **PRODUCT-OWNER ACCEPTED / PROTECTED SQUASH-MERGED / POST-MERGE VERIFIED**.

Product outcome:

> A real reference image can be calibrated in auditable source-image coordinates with predictable precision tools before ordinary editable tracing begins.

Accepted behavior:

- calibration-specific pan/zoom interaction;
- stronger magnifier/crosshair;
- source edge/line-centre/intersection snapping;
- keyboard nudge;
- fractional image coordinates;
- explicit snap toggle and temporary suppression;
- second known-distance verification;
- visible residual/error and distortion warning;
- explicit save only through the existing reference persistence boundary;
- truthful guidance for incomplete calibration;
- no false claim of precision beyond raster/source quality.

Authority rule remains: world-grid snapping is not a calibration solution because authoritative mm scale is unknown until calibration. Source-image feature snapping is the correct assistance authority during calibration.

Hardening found and corrected real issues in live state, wheel lifecycle, rendered transforms, border/content pointer origin, incomplete Save behavior and endpoint reacquisition. No threshold, retry, skip/fixme, validator, persistence or authority rule was weakened.

Acceptance record: `docs/milestones/m8-3-acceptance.md`.

GitHub reported the protected squash merge identity as `01f520988a84291fb6e4f918e21f3403f17c4529`; `main` post-merge verification is GREEN in CI #5248 and CodeQL #608.

## 10. Later public-beta programme

### M8.4 — Assisted Tracing (SHELVED)

**SHELVED 2026-08-22 — third real-plan Product Owner FAIL; not accepted, not merged.**

The wall-only slice (optional high-confidence source-image assistance inside the normal Wall tool, defaulting Off, no AI/network dependency) reached automated technical GREEN on implementation head `b4f1ede701aaa28b5ee91d9a017a5e7fb6ff23d5` (CI #5289, Browser Acceptance #1732 — Chromium 68/68, WebKit 58/58, CodeQL `95437977365`), but failed the Product Owner real-plan checklist three times (2026-08-18, 2026-08-19, 2026-08-22) on the same root-cause class: source-image wall-axis derivation degrades near architectural corners and falls back to snapping the wall's edge face instead of its centre axis. A market-validation check found no benchmarked competitor (RoomPlan, Planner 5D, Floorplanner, RoomSketcher, Planoplan, RemPlanner, magicplan) performs this live pixel-snap-during-drawing mechanism at all.

Draft PR #94 is closed without merge; branch `feat/m8-4-wall-assisted-tracing` is preserved as R&D evidence, mirroring the M7.8C precedent (§5). Hosted door/window source assistance is dropped along with it, not merely blocked. The accepted M8.3 calibration substrate is unaffected — manual tracing over a calibrated reference image remains fully available.

Full rationale: `docs/changelog/2026-08-22-m8-4-wall-assisted-tracing-shelved.md`.

### M8.4-UX — Core Interaction & UI/UX Hardening (NOW)

Product priority reset 2026-08-22: strong core structural/editing behavior and best-practice interaction/UI/UX quality take precedence over further feature growth until they are solid.

Initial scope draft (not yet a finalized/accepted milestone spec):

- honest keyboard/command feedback everywhere a command can be blocked, not just Delete/Cut (started in PR #95, `2f3469e55e1ae2a84564a01044623f3523516501`);
- arrow-key nudge for selected furniture/wall endpoints, with Shift for a coarse step (pattern already validated for M8.3 calibration nudge);
- unify `commandForKeyboardEvent` (`apps/web/components/editor/editor-commands.ts`) with the `EDITOR_COMMANDS` shortcut metadata — currently two hand-maintained sources of truth for keyboard shortcuts;
- safe full-room deletion (needs a new dependency-closure algorithm distinguishing room-owned vs. shared walls — no safe removal path exists today, neither Cut nor Delete);
- broader selection visual polish and interaction review benchmarked against mature canvas tools (draw.io, Excalidraw, Figma) and the existing `docs/product/COMPETITIVE_BENCHMARK.md` set.

This scope will be refined into a proper design/plan before implementation, per the project's mandatory delivery rule (§12).

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