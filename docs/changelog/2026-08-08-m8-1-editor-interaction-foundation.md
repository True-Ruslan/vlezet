# 2026-08-08 — M8.1 Editor Interaction Foundation

**Status:** AWAITING PRODUCT-OWNER ACCEPTANCE  
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

### Task 5 — deterministic rigid multi-furniture move

A move gesture can now preserve a compatible furniture-only multi-selection. The dragged member becomes the primary snap anchor without dropping the other selected furniture. The anchor receives the existing snap correction and the resulting translation vector is applied identically to the complete moving set. Transform/resize remains single-object only.

Store RED:

```text
head:     2255d1a34b803f6a6be11d3d3cc662c88f534977
CI #4688: FAIL as intended
observed: 420 prior tests PASS; new gesture assertions exposed the former single-object preview/selection/history model
```

Canvas/component RED:

```text
head:     1b5138d3b587b6c629ba8fba3c07a65b038661ed
CI #4694: FAIL as intended
observed: 424 tests PASS; exactly 2 new source/component contracts failed before Canvas group integration existed
```

Final GREEN:

```text
head:                     3d864ad3c93ea13ed5135efd1d47a582672ce5ee
CI #4697:                 PASS
Recognition Benchmark #1033: PASS
Browser Acceptance #1153:
  Chromium:               PASS
  WebKit:                 PASS
```

The final implementation evaluates fit against the whole preview set, excludes the complete moving set from object snapping, preserves relative position/rotation exactly, creates one `object/batch-move` history entry for non-zero movement, creates no history for zero delta, and cancels without document mutation. Mixed/structural selection is fail-closed.

### Task 6 — versioned semantic placed-object clipboard

M8.1 now has an internal runtime-only clipboard for furniture. The payload is versioned, uses a rotation-aware world-space group bounds centre, snapshots objects immutably and never relies on browser/system clipboard permission.

Pure-model RED/GREEN:

```text
RED head:  e9d0b315374ea02bd36953158b19bd3087bcbbdd
CI #4698:  FAIL as intended; 426 prior tests PASS; './editor-clipboard' absent
GREEN head: e6fde7a5736eebf0711a55a3f29505ffdad6287e
CI #4700:  PASS
```

Store/history RED:

```text
head:     038b2e11698028836eb8bc832b0b01c27e525ed4
CI #4702: FAIL as intended
observed: 430 prior tests PASS; all 7 new scenarios failed only because semantic clipboard store commands did not exist
```

Final GREEN:

```text
head:                     5e1383e64926f3989d0fe7a5fcd5b4f56e63308f
CI #4703:                 PASS
Recognition Benchmark #1039: PASS
Browser Acceptance #1159:
  Chromium:               PASS
  WebKit:                 PASS
```

Copy is non-mutating. Cut is one atomic `object/batch-delete`; Paste and Duplicate are one atomic `object/batch-add`; Undo restores/removes the complete group. Paste generates fresh IDs, same-anchor repetition advances by deterministic `+200,+200` mm increments, changing the anchor resets the sequence, and Duplicate offsets by `+200,+200` without replacing persistent clipboard contents. Unsupported mixed/structural selections are no-ops without partial mutation.

### Task 7 — central semantic command registry and keyboard focus safety

Semantic keyboard routing is now defined by one framework-independent command registry. Native editable targets keep browser text editing semantics, while the editor handles command-modified Copy/Cut/Paste/Select All/Duplicate plus existing history/tool/object actions. Escape is intentionally excluded from the registry and continues through the existing one-level `deriveEditorEscapeAction` priority model. The small legacy keyboard adapter now owns only `F` (catalogue) and Escape.

Pure registry RED/GREEN:

```text
RED head:   ebc99f8e9939452f001b9270d85e41d6fe3d291a
CI #4704:   FAIL as intended; 437 prior tests PASS; './editor-commands' absent
GREEN head: 471a922372d9cb974d20dad56626b8655864564b
CI #4705:   PASS
```

Integration RED:

```text
head:     8af8559e3d061634bf9c7353bca054ef1a52b92b
CI #4707: FAIL as intended
observed: 3 ApartmentEditor routing failures + 3 legacy-adapter failures; Recognition Benchmark #1043 remained PASS
```

Final GREEN:

```text
head:                     f36c899ad386d0684bc027b2a832b906666d5a52
CI #4709:                 PASS
Recognition Benchmark #1045: PASS
Browser Acceptance #1165:
  Chromium:               PASS
  WebKit:                 PASS
```

`ApartmentEditor` now owns one `executeEditorCommand` adapter. Semantic mutation shortcuts no longer branch directly on legacy shortcut names. `input`, `textarea`, `select`, `contenteditable` and explicitly marked native-editable controls retain native editing priority. Registered viewport command IDs exist, but zoom/actual-size/fit-selection execution remains deliberately unconsumed until the dedicated viewport controller supplies it.

### Tasks 8–10 — viewport navigation, semantic selection geometry and Canvas integration

The runtime interaction layer now normalises wheel/trackpad pan versus modified-wheel/pinch zoom, keeps Space+drag and middle-button pan, derives selection/marquee bounds from semantic geometry, and integrates replace/toggle/marquee selection without making Konva nodes authoritative geometry.

Selection geometry preserves the intended distinction between direct room selection and marquee/select-all: rooms are derived and may be selected by direct point hit, but are excluded from marquee/select-all structural sets. Group bounds remain non-interactive and expose no graphical scale handles.

A real Chromium regression exposed a contract collision: the marquee helper had become the direct point-hit helper, which made direct room selection impossible. The regression received its own RED/GREEN pair rather than weakening marquee semantics:

```text
RED head:  31dd7134975f67189e3545b8cde87d6abe5979eb
CI #4788:  FAIL as intended; direct-room point-hit tests absent from production API
Browser #1244: FAIL on the affected room journeys

GREEN head: 4457bfe1c37239c70f8c83e8580cb7ea6b949cef
CI #4789:    PASS
Recognition Benchmark #1125: PASS
Browser Acceptance #1245: PASS (Chromium + WebKit)
```

The fix introduced explicit semantic point-hit behaviour while preserving marquee exclusion of rooms/vertices and concrete priority before derived room fallback.

### Task 11 — fit-plan / fit-selection / actual-size / zoom commands

Viewport commands remain runtime-only and do not create semantic history. `fitPlan` safely unions document/reference bounds, `fitSelection` is fail-closed for empty selection, and actual-size returns to the editor baseline pixels-per-millimetre rather than pretending to know physical monitor DPI.

TDD evidence:

```text
pure RED:    a062d7b3927f05413dab0f3832aee5b766752f73 — CI #4724 FAIL; 473 prior tests PASS
pure GREEN:  0069ac1ebdb701997d3da20b6e5dd1093ccd09f5 — CI #4725 PASS
integration RED: 4de79039ff369a66ef7f1fae0461c91f3525b65b
nullable RED:    a2648531a2102efb998de836203e0372fd79bd2c — 478 prior tests PASS; 1 expected `documentBounds=null` failure
final GREEN:     ee8c380ef684bba0a9bbf024cc2f7bc4459b7316
CI #4732:        PASS
Recognition Benchmark #1068: PASS
Browser Acceptance #1188: PASS (Chromium + WebKit)
```

During final interaction review the original plan's bare `0/1/2/+/-` global shortcuts were rejected as too surprising for an editor where number/punctuation input may be meaningful. The commands remain available through explicit UI/registry execution, but bare keys no longer mutate the viewport.

That correction also followed RED/GREEN evidence:

```text
RED head:  c03d5aef2158cbaecca3002dd3106ea77c5351e8 — CI #4790 FAIL; old bare-key resolver still active
GREEN/browser-aligned head: d48948ac026445803a9fb3c0b07cbfe485d3fa8e
CI #4792: PASS
Recognition Benchmark #1128: PASS
Browser Acceptance #1248: PASS (Chromium + WebKit)
```

### Task 12 — compact multi-selection inspector and semantic context menu

The multi-selection inspector now shows deterministic type counts and one compact `Действия ···` disclosure instead of a stack of full-width mutation buttons. It does not expose fake shared geometry fields, does not advertise unsupported group rotation, and keeps mixed/structural restrictions fail-closed with an explanation.

Inspector RED:

```text
head:     8b95b194d5e27dde08e8382357c985548eb01207
CI #4793: FAIL as intended; 507 prior tests PASS and the new compact-action contract was the only failure
Recognition Benchmark #1129: PASS
```

The context menu is a consumer of the same command/capability authority, not a second mutation path. Entity selection menus use Copy/Cut/Duplicate → Fit Selection → Delete when available; empty Canvas uses Paste/Select All → Fit Plan. Mixed/structural selections expose only safe non-mutating view actions. Shortcut labels are OS-aware, and empty-canvas right click now produces a semantic `target: null` request instead of silently falling back to the browser menu.

Context-menu RED:

```text
head:     f0a5cd82aa0e51e897f38c10fd6b26bef9b2ff99
CI #4796: FAIL as intended; old selection-only menu contract still present
Recognition Benchmark #1132: PASS
```

Production GREEN before browser assertion sync:

```text
head:                     033f244a9883bfc69190350c7b28448a4b11bd0c
CI #4800:                 PASS
Recognition Benchmark #1136: PASS
Browser Acceptance #1256: FAIL only on three stale pre-final menu expectations
```

Those browser failures were reviewed rather than hidden: 21/24 Chromium scenarios already passed; the three failures expected the removed `Нет доступных действий`/`Повернуть на 90°` behaviour. Browser assertions were updated to the approved menu contract without changing production code.

### Task 13 — Chromium/WebKit interaction acceptance

Final code+browser-evidence head before the documentation-only handoff:

```text
head:                     0e6cf9f4e8168dd36c68c6effc036360aae11884
CI #4801:                 PASS
Recognition Benchmark #1137: PASS
Browser Acceptance #1257: PASS
  Chromium:               PASS
  WebKit:                 PASS
```

The automated browser suite now covers ordinary wheel pan, modified-wheel zoom, Space/middle pan, native editable shortcut safety, safe explicit view controls, context-menu execution, rigid multi-furniture move with one Undo/Redo, semantic Copy/Cut/Paste/Duplicate, marquee selection, select-all exclusion of derived rooms, mixed-selection fail-closed behaviour and compact-width reachability/no horizontal overflow.

## Regressions discovered and fixed

- direct room click was lost when a marquee-only helper was reused as point-hit authority; fixed with explicit `entitiesAtPoint()` semantics while keeping rooms excluded from marquee/select-all;
- a source assertion accidentally tested implementation syntax instead of semantic behaviour; corrected without weakening the runtime contract;
- React lint correctly rejected synchronous platform-detection `setState` inside an effect; replaced with `useSyncExternalStore` snapshot semantics instead of suppressing lint;
- old Browser Acceptance assertions still expected bare viewport keys and the pre-final context menu; updated only after production behaviour had independent unit/render evidence;
- typecheck/unit gates repeatedly stopped integration when contracts were incomplete; no validation/test threshold was lowered to obtain green CI.

## Architecture audit for product-owner handoff

Diff audit confirms:

- no `VlezetDocument` schema or migration change;
- no IndexedDB/project/backup format change;
- no package-manifest or AI/network dependency added to core editing;
- no `@vlezet/geometry` authority change and no opening/topology/M2 fit authority weakening;
- editor-core batch APIs accept only placed objects and validate whole batches atomically;
- structural/mixed Copy/Cut/Duplicate/Delete/Move remains fail-closed;
- structural clipboard/batch move is not enabled;
- arbitrary group scale remains disabled unconditionally;
- selection, clipboard, gesture, marquee, context-menu and viewport state remain runtime-only;
- recognition Apply/project session changes only reset the unified runtime selection and do not change recognition geometry or persistence semantics;
- no recognition benchmark threshold or accepted safety validator was lowered.

## Intentional deferrals

M8.1 deliberately does **not** include:

- direct vertex editing or structural group move/clipboard/dependency closure — M8.2;
- calibration/source-feature snapping — M8.3;
- assisted tracing — M8.4;
- group furniture rotation/alignment/distribution/rich resize — M8.5;
- arbitrary graphical group scale — not part of semantic Vlezet editing.

## Product-owner manual acceptance checklist

Automation intentionally leaves only interaction feel/ergonomics for manual acceptance:

1. mouse wheel/trackpad pan and modified/pinch zoom feel predictable;
2. multi-selection and marquee feel understandable;
3. moving/copying/pasting a small furniture group feels natural;
4. context menu and keyboard shortcuts are discoverable and non-surprising;
5. no obvious interaction conflict appears while tracing/selecting existing walls/openings;
6. compact laptop width remains usable.

## Acceptance / merge

Awaiting explicit product-owner PASS/FAIL. This record does **not** claim acceptance, Ready-for-review state, completion, merge SHA or M8.2 start.

Per the approved plan, `docs/milestones/m8-1-acceptance.md`, canonical `docs/CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md` and `docs/product/UX_ROADMAP.md` are intentionally unchanged until explicit acceptance and protected integration.
