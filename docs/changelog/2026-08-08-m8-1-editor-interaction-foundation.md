# 2026-08-08 — M8.1 Editor Interaction Foundation

**Status:** PRODUCT-OWNER ACCEPTANCE FAILED — CORRECTION IN PROGRESS  
**Tracker:** #54  
**Branch:** `feat/m8-1-editor-interaction-foundation`

## Why

M8.1 establishes one deterministic interaction substrate for selection, commands, navigation and safe multi-object editing before M8.2 expands topology-sensitive structural editing.

The accepted public-beta direction requires mature-canvas interaction quality without weakening apartment semantics: millimetres remain canonical, `VlezetDocument` remains the sole persistent truth, structural geometry remains topology-authoritative and arbitrary graphical group scaling remains forbidden.

## Scope

- unified semantic runtime selection;
- capability-aware fail-closed actions;
- atomic placed-object batch transforms;
- one writable selection truth in the editor store;
- rigid multi-furniture movement;
- semantic placed-object Copy/Cut/Paste/Duplicate;
- central command registry;
- wheel/trackpad/keyboard navigation and fit operations;
- semantic marquee selection;
- multi-selection/context UI;
- Chromium and representative WebKit acceptance.

Structural batch movement/clipboard is explicitly deferred to M8.2.

## Engineering policy

Every deterministic behaviour follows genuine RED → observed intended failure → minimal GREEN → adjacent/full regression. Existing validation, topology/opening authority, M2 fit authority and safety thresholds may not be weakened to obtain green CI.

## Baseline

M8.0 was product-owner approved and protected-squash-merged as `cf481ce3a2b882e5031ea18a576a4856b1043f3a` after up-to-date CI and Chromium/WebKit acceptance passed.

This branch was created fresh from that exact merge commit.

Baseline documentation-only head:

```text
head:     15e2989dcdbdc7e9b7fabac433238015abdaef8f
CI #4660: PASS
```

The baseline `verify` job passed the documentation contract, full unit suite, Core Recognition Benchmark, typecheck, lint and production build before the first M8.1 RED commit.

## TDD evidence

### Task 1 — unified semantic selection contract

RED `fe9de7f9a604fec318b1335428fd8311cd4ec0fb` / CI #4661 failed only because `./editor-selection` did not exist while 395 existing web tests passed.

GREEN `c591a409819870b25b5b58b2d18abaff22d27e42` / CI #4662 PASS.

### Task 2 — capability-aware fail-closed selection policy

RED `7db076b96acd9f488393e403d14d6753c90276bf` / CI #4664 failed only because `./editor-selection-capabilities` did not exist.

GREEN `903c41c0b2e137f064fe94682ccd075c97e95bd5` / CI #4665 PASS.

### Task 3 — atomic placed-object batch transforms

RED `b2ab8aa870d53f1a693016c37066414eac245be4` / CI #4667 exposed the missing batch APIs.

Final GREEN `c3cce0bc4014fe07d7dbc4d009a0b91c8a93eb96` / CI #4671 PASS after correcting only an invalid test fixture category, not production validation.

### Task 4 — one writable semantic selection truth

RED `213878d6f0985207ae815d8e97f244d32ee55fd0` / CI #4673 exposed the missing unified store selection/actions/projections.

Final GREEN `7ac0d267c81024da271c17628a43c627a5370170` / CI #4686 PASS; Browser Acceptance #1142 Chromium + WebKit PASS.

### Task 5 — deterministic rigid multi-furniture move

Store RED `2255d1a34b803f6a6be11d3d3cc662c88f534977` / CI #4688.

Canvas RED `1b5138d3b587b6c629ba8fba3c07a65b038661ed` / CI #4694.

Final GREEN `3d864ad3c93ea13ed5135efd1d47a582672ce5ee` / CI #4697, Recognition #1033, Browser #1153 Chromium + WebKit PASS.

### Task 6 — semantic placed-object clipboard

Pure RED `e9d0b315374ea02bd36953158b19bd3087bcbbdd` / CI #4698; GREEN `e6fde7a5736eebf0711a55a3f29505ffdad6287e` / CI #4700.

Store RED `038b2e11698028836eb8bc832b0b01c27e525ed4` / CI #4702.

Final GREEN `5e1383e64926f3989d0fe7a5fcd5b4f56e63308f` / CI #4703, Recognition #1039, Browser #1159 Chromium + WebKit PASS.

### Task 7 — central command registry

Pure RED `ebc99f8e9939452f001b9270d85e41d6fe3d291a` / CI #4704; GREEN `471a922372d9cb974d20dad56626b8655864564b` / CI #4705.

Integration RED `8af8559e3d061634bf9c7353bca054ef1a52b92b` / CI #4707.

Final GREEN `f36c899ad386d0684bc027b2a832b906666d5a52` / CI #4709, Recognition #1045, Browser #1165 Chromium + WebKit PASS.

### Task 8–11 — viewport, semantic selection geometry, marquee and view commands

The viewport controller introduced wheel/trackpad pan, modified pointer-centred zoom, Space/middle pan and runtime-only fit commands. Selection geometry remained domain-derived rather than Konva-authoritative. Marquee/select-all exclude derived rooms, while direct room click remains supported through a separate point-hit contract.

Task 11 fit-command final GREEN: `ee8c380ef684bba0a9bbf024cc2f7bc4459b7316` / CI #4732, Recognition #1068, Browser #1188 Chromium + WebKit PASS.

A later acceptance regression showed direct room selection had accidentally been coupled to marquee exclusion. Dedicated RED `31dd7134975f67189e3545b8cde87d6abe5979eb` reproduced it. GREEN `4457bfe1c37239c70f8c83e8580cb7ea6b949cef` separated `entitiesAtPoint()` from marquee semantics; CI #4789, Recognition #1125 and Browser #1245 all PASS.

### Acceptance correction — trackpad zoom, live bounds and safe view controls

Product-owner feedback identified slow modified-trackpad zoom and asked to remove undocumented bare `0/1/2/+/-` view bindings.

The calibrated controller now normalises wheel delta modes and uses approximately 1% scale response per small pixel delta, bounded to roughly ±10% per event. Canvas consumes the controller-provided factor directly.

Group bounds derive from the live furniture preview rather than committed document state. A separate snap-contract regression restored wall metadata to `TopologySnapTarget` instead of corrupting `SnapResult`.

Bare viewport shortcuts were removed while view commands remain accessible through explicit UI. Tests-only RED `c03d5aef2158cbaecca3002dd3106ea77c5351e8` / CI #4790 proved the old keyboard resolver still consumed them. Browser acceptance was aligned at `d48948ac026445803a9fb3c0b07cbfe485d3fa8e`; CI #4792, Recognition #1128 and Browser #1248 Chromium + WebKit PASS.

### Task 12–13 — compact inspector, semantic context menu and browser acceptance

The multi-selection inspector was reduced from large persistent mutation buttons to one compact `Действия ···` disclosure. Paste no longer appears as a selection action and roadmap text about future group rotation was removed from production UI.

The context menu now has separate command sets:

- selection: Copy, Cut, Duplicate, Fit Selection, Delete where allowed;
- empty Canvas: Paste when available, Select All, Fit Plan;
- mixed/structural selection remains fail-closed except safe view operations;
- shortcut hints are OS-aware for standard edit commands;
- right-click on empty Canvas suppresses the native menu and emits a nullable semantic target request.

Context-menu RED `f0a5cd82aa0e51e897f38c10fd6b26bef9b2ff99` / CI #4796 produced only the intended new failures. Production reached deterministic GREEN at `033f244a9883bfc69190350c7b28448a4b11bd0c` / CI #4800 and Recognition #1136; Browser #1256 then failed only on three stale expectations for the old menu. Acceptance assertions were updated without production changes at `0e6cf9f4e8168dd36c68c6effc036360aae11884`.

Exact code+browser evidence at that head:

```text
CI #4801:                  PASS
Recognition Benchmark #1137: PASS
Browser Acceptance #1257: PASS
  Chromium:                PASS
  WebKit:                  PASS
```

### Task 14 handoff and product-owner correction

The first handoff head `23be513e963c23a88e9c3c6b6c5e2c58caacd996` changed only this focused changelog after code head `0e6cf9f4...` and passed a fresh exact-head gate:

```text
CI #4802:                  PASS
Recognition Benchmark #1138: PASS
Browser Acceptance #1258: PASS
  Chromium:                PASS
  WebKit:                  PASS
```

Product-owner manual acceptance on 2026-08-09 passed every reviewed area except one reproducible furniture-group drag defect: while dragging a selected furniture group, small cursor oscillations around snap positions can leave the actively dragged visual node diverged from the snapped group preview/bounds. The user described the objects as trying to attach to the grid and then sticking outside the selection rectangle.

This is treated as a real M8.1 interaction failure, not an accepted limitation. A dedicated source/browser RED is being added before the correction.

The same review requested batch configuration for multiple selected walls, at minimum common wall thickness. That request is intentionally recorded for **M8.2 structural editing**, not implemented in M8.1: wall batch mutation is topology-sensitive and remains outside M8.1's placed-object-only mutation authority.

## Architecture audit

Verified from the PR diff:

- no `VlezetDocument` schema/migration change;
- no IndexedDB/project/backup format change;
- no AI/network dependency added to core editing;
- no topology/opening/M2 fit authority weakened;
- placed-object batch transforms are atomic and editor-core-owned;
- structural/mixed batch mutation remains fail-closed;
- structural clipboard/batch movement remains disabled;
- arbitrary group scaling remains disabled;
- viewport/selection/clipboard/context state remains runtime-only;
- recognition benchmark thresholds and existing safety validators were not lowered.

## Acceptance / merge

**Acceptance currently FAILED pending the snapped-group drag correction.**

PR #85 must remain Draft / DO NOT MERGE. Do not create the M8.1 acceptance milestone, update canonical completion state, mark Ready, merge or start M8.2 until the correction receives fresh exact-head automated evidence and explicit product-owner PASS.
