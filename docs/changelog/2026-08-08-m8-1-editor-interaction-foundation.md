# 2026-08-08 — M8.1 Editor Interaction Foundation

**Status:** IN DEVELOPMENT  
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

The first M8.1 production contract is a pure runtime value model for `(kind,id)` entity refs, deterministic insertion order, primary selection, additive/toggle operations and history-safe sanitisation across walls, vertices, derived rooms, openings and placed objects.

RED:

```text
head:     fe9de7f9a604fec318b1335428fd8311cd4ec0fb
CI #4661: FAIL as intended at web unit tests
reason:   Cannot find module './editor-selection'
existing web tests: 395 PASS
```

The RED commit contained the nine behavioural invariants only; no production implementation existed.

GREEN:

```text
head:     c591a409819870b25b5b58b2d18abaff22d27e42
CI #4662: PASS
```

GREEN evidence includes all new selection invariants, the full unit suite, Core Recognition Benchmark, typecheck, lint and production build.

The implementation is intentionally pure: no Zustand, Konva, DOM, clipboard, command registry or persistence changes were introduced. Selection remains runtime-only and `VlezetDocument` remains the sole persistent document truth.

### Task 2 — capability-aware fail-closed selection policy

The capability evaluator sanitises the semantic selection against the current document and exposes one explicit permission matrix for Copy/Cut/Paste/Duplicate/Delete/Move/Rotate/Scale.

Required safety properties include:

- one or many placed objects may be copied, cut, duplicated, deleted and moved;
- only one placed object exposes existing rotation;
- structural and mixed selections receive no implicit subset operation;
- paste depends on the internal placed-object clipboard rather than current selection;
- stale refs grant no capabilities;
- structural/mixed blocks provide concise Russian explanations;
- graphical group scale remains disabled unconditionally.

RED:

```text
head:     7db076b96acd9f488393e403d14d6753c90276bf
CI #4664: FAIL as intended at web unit tests
reason:   Cannot find module './editor-selection-capabilities'
existing/new tests before expected failure: 404 PASS
```

GREEN:

```text
head:     903c41c0b2e137f064fe94682ccd075c97e95bd5
CI #4665: PASS
```

GREEN evidence includes the complete capability matrix, full unit suite, Core Recognition Benchmark, typecheck, lint and production build. The evaluator is pure and performs no store read, UI mutation or document mutation.

### Task 3 — atomic placed-object batch transforms

The editor-core now owns immutable all-or-nothing helpers for batch add/update/translate/delete of placed objects. Batch validation rejects duplicate IDs, missing sources, destination conflicts, invalid resulting objects and non-finite translation before any transformed document escapes. Update/delete preserve document order; additions append in supplied stable order. Batch movement is represented by one `object/batch-move` semantic history command, so one Undo/Redo restores the whole group.

RED:

```text
head:     b2ab8aa870d53f1a693016c37066414eac245be4
CI #4667: FAIL as intended at editor-core unit tests
reason:   batch APIs did not exist
observed: 7 new behavioural tests failed on missing functions while existing editor-core tests remained green
```

Initial implementation head `4b3d81f71c9d58086db32c7332ce23c5ed67839e` made the entire unit suite and recognition gate GREEN, but full CI correctly stopped at typecheck because the new test fixture used unsupported category `"work"`. The fixture was corrected to the valid physical category `"table"`; no behavioural assertion, validation rule or threshold was weakened.

Final GREEN:

```text
head:     c3cce0bc4014fe07d7dbc4d009a0b91c8a93eb96
CI #4671: PASS
editor-core: 47 / 47 PASS
web:         413 / 413 PASS
```

The final run also passed the complete workspace unit suite, Core Recognition Benchmark, typecheck, lint and production build. The production implementation remains framework-independent and does not introduce persistence/schema changes or structural batch semantics.

### Task 4 — one writable semantic selection truth

The editor store now persists only one runtime selection value. The former writable `selectedWallId`, `selectedRoomId`, `selectedOpeningId` and `selectedObjectId` fields are physically absent. Existing single-inspector consumers use pure compatibility projections from `selection`; multi-selection therefore cannot accidentally masquerade as a single entity.

The migration also makes stale refs fail closed and sanitises selection after document mutation, delete, Undo/Redo, project load and recognition Apply. Legacy `selectWall/selectRoom/selectOpening/selectObject` remain only as command adapters over the unified selection; they are not parallel state.

RED:

```text
head:     213878d6f0987bbb0f41067c2ad9f1827200cf2f
CI #4673: FAIL as intended
observed: 413 prior web tests PASS; 5 new store-migration tests failed because unified selection state/actions/projections did not exist yet
```

The migration exposed useful compatibility debt rather than being hidden:

- exact head `aab4eb5c9c105330dbc4893cd8f765ffefc5c338` reached the full unit suite but old tests still read removed writable IDs;
- exact head `eb08f24650834c64d6fe94fc7addc12eb05ce6ef` reduced the remaining failure to one stale-ID fixture that attempted to select nonexistent `wall-x`;
- the fixture was strengthened to create/select a real wall rather than weakening fail-closed sanitisation;
- subsequent typecheck found the final direct legacy writes in project-session reset and recognition Apply; both now reset `EMPTY_EDITOR_SELECTION` instead.

Final GREEN:

```text
head:                  7ac0d267c81024da271c17628a43c627a5370170
CI #4686:              PASS
Browser Acceptance #1142:
  Chromium:            PASS
  WebKit:              PASS
```

The final exact-head CI passed documentation contract, full unit suite, Core Recognition Benchmark, typecheck, lint and production build. No project schema, persistence format, geometry authority, M2 authority or structural batch behavior changed.

## Acceptance / merge

Not yet accepted. No completion or merge claim is made by this record.
