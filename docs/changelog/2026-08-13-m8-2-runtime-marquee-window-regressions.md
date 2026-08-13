# M8.2 Runtime / Marquee / Window Regressions — 2026-08-13

Status: **AUTOMATED GREEN / PRODUCT-OWNER RETEST PENDING**

This record follows the product-owner retest after the previous M8.2 direct-manipulation checkpoint. It documents three real product gaps that were not adequately protected by the earlier browser acceptance suite. PR #87 remains Draft, issue #56 remains open, M8.2 is not product-accepted and M8.3 remains blocked.

## Product-owner findings

The real development/browser session exposed three problems:

1. selecting/dragging a hosted door could throw a Turbopack runtime error because the live Zustand singleton did not expose `beginStructuralOpeningGesture`;
2. ordinary marquee selection around a room and its furniture selected backing structural entities instead of one semantic room root plus the contained furniture, forcing modifier-based selection for the desired group move;
3. a visible window was difficult/impossible to drag in normal use even though the earlier exact-coordinate browser test was GREEN.

These findings invalidate the earlier M8.2 acceptance checkpoint as final product evidence. The correction therefore returned to genuine RED → causal isolation → minimal GREEN.

## Root causes

### 1. Turbopack / Fast Refresh live-store shape skew

The current source already declared, implemented and registered the hosted-opening actions. Fresh stores and fresh-process CI therefore had them and could pass.

The real runtime failure class was different: Turbopack/Fast Refresh can preserve an already-created Zustand singleton while replacing modules whose newer code expects additional store actions. The preserved singleton can therefore have an older action shape even though the current TypeScript source is correct.

The new regression simulates this exact state by removing the hosted-opening actions from the live singleton before loading a document. A fresh temporary store is not considered sufficient evidence.

Final behavior:

- `loadEditorDocument()` repairs missing hosted-opening actions before loading the document;
- module evaluation also performs the same narrowly scoped repair for a preserved live singleton;
- repaired handlers are bound directly to the real `editorStore`, not copied as closures from a temporary store;
- existing document/history/runtime state is not replaced merely to repair actions.

### 2. Whole-room marquee semantics

Before the correction, a non-zero marquee queried only concrete entities. A rectangle around a room therefore returned the hosted opening, four backing walls and furniture, but no room reference.

Final behavior:

- a marquee that fully encloses a derived room selects that derived room as the **semantic structural root**;
- furniture intersecting the same marquee remains selected explicitly;
- backing walls/openings of the enclosed room are not added as separate selection members;
- partial marquee selection that does not fully enclose a room retains the existing concrete wall/opening/furniture behavior;
- point-hit ordering remains unchanged.

This allows ordinary no-modifier marquee selection to produce `room + furniture`, after which the existing atomic room-composite movement path can move the selection without requiring Shift-based construction of the selection.

### 3. Window hit target

The door leaf already used a 12 px Konva `hitStrokeWidth`, while a window was represented by two visually thin 1.5–2 px listening lines without an expanded hit region. The previous browser harness started at the mathematically exact line and therefore could pass while normal pointer placement missed.

Final behavior:

- both window lines keep the same visual stroke;
- both receive `hitStrokeWidth={12}`;
- geometry, hosted-wall projection, `wallId`, overlap validation and semantic history are unchanged.

## Genuine RED evidence

Regression test commit:

```text
08efe070df59fc1c9a0d661a42130ae98875c2e7
```

### CI #5064 — expected RED

Run: `31647593014`

The existing web suite remained healthy; the newly added regression file produced the two intended failures:

- whole-room marquee returned `door + 4 walls + 2 chairs` instead of `room + 2 chairs`;
- simulated preserved live store still had `beginStructuralOpeningGesture === undefined` after document load.

This was a causal RED, not a manufactured source-string check.

### Browser Acceptance #1514 — expected RED

Run: `31647593013`

Result before production correction:

```text
53 PASS
2 FAIL
```

The two failures were the new product-owner flows:

- normal marquee around room + furniture did not produce the semantic room composite;
- a user-like window drag beginning 4 px away from the exact thin line missed the window and entered marquee behavior.

The new ordinary door select/drag test passed in a fresh browser process. Together with the unit live-singleton RED, this distinguished a preserved-runtime/Turbopack state problem from a missing source implementation.

Browser artifact: `9161439988`  
Artifact digest: `sha256:5f527c29b34f80035d8df0b761cd448880fbe90b9e5a255a0b6bea374a36545e`

## Correction iterations

### First candidate — useful partial RED

```text
e2d80f581471e68f33f9c08a14b7c40ccabf6295
```

This candidate proved that the semantic room-root marquee implementation satisfied the new product contract, but also exposed two issues before GREEN was claimed:

1. two older M8.1 tests explicitly encoded the superseded rule that rooms never participate in marquee selection;
2. the first runtime repair copied action functions from a temporary store, so their closures mutated that temporary store rather than the live singleton.

Those failures were retained as evidence and corrected rather than hidden or bypassed.

### Second candidate — marquee/runtime GREEN, window isolated RED

```text
bf04db8a5cd75818891849e7d05742e80eea8211
```

Changes:

- hosted-opening repair handlers bind directly to the live singleton;
- old marquee tests are updated to the new explicit whole-room contract while partial concrete marquee behavior stays covered.

Evidence:

```text
CI #5066:                  PASS
Browser Acceptance #1516: 54 PASS / 1 FAIL
```

The new marquee flow passed. The new door flow passed. The **only** remaining browser failure was the realistic near-line window drag, isolating the hit-target defect before the window code was touched.

Browser artifact: `9161743471`  
Artifact digest: `sha256:b859b198bcdfa5d392360244dad1e30d37589a0ab50e5c8e02f441e8a20b6f10`

### Final product-code GREEN

Window hit-target correction:

```text
357c92c36fc6c72b3e727b00f4b342b742efeb72
```

Only the interactive hit width changed for window lines; visible width and structural semantics did not.

Exact product-code evidence:

```text
head:                           357c92c36fc6c72b3e727b00f4b342b742efeb72
CI #5067 / run 31648753553:    PASS
  documentation contract:       PASS
  unit tests:                   PASS
  Core Recognition Benchmark:   PASS
  typecheck:                    PASS
  lint:                         PASS
  build:                        PASS
Browser Acceptance #1517:      PASS
  Chromium:                     PASS
  WebKit:                       PASS
browser run:                    31648753509
browser artifact:               9161930810
artifact digest:                sha256:dfbf78d25fa4b6ce32d7ce5f25ca01746ebe9b7c332575776f1953a4466b74ab
```

The new Playwright regression file is included in both Chromium and WebKit configurations and exercises real pointer/keyboard/UI behavior rather than internal store mutation:

1. no-modifier marquee around one room + two chairs → semantic `room + furniture` selection → group drag → Undo/Redo;
2. ordinary door selection and drag with `pageerror` / `console.error` guard;
3. user-like window drag from a point offset from the visually thin line, proving the practical hit target.

All tests in this focused file use a per-page browser-error collector and fail on uncaught page errors or console errors.

## Architecture / safety audit

The correction does **not** introduce:

- a `VlezetDocument` schema or migration change;
- persistent room ownership of furniture;
- weakening of topology or hosted-opening validation;
- silent opening re-hosting;
- changes to M2 fit/collision/door/clearance authority;
- recognition threshold/behavior changes;
- arbitrary structural scaling;
- partial structural commits after rejection.

The marquee change is semantic selection only. The live-store repair is runtime compatibility for missing actions only. The window change is interaction hit geometry only.

## Acceptance state

```text
latest product-code head:           357c92c36fc6c72b3e727b00f4b342b742efeb72
reported regressions:               FIXED + AUTOMATED GREEN
Chromium/WebKit regression:         PASS
M8.2 product-owner retest:          PENDING
M8.2 product acceptance:            PENDING
PR #87:                             Draft
issue #56:                          Open
M8.3:                               BLOCKED
```

A fresh exact-head CI + Browser Acceptance run is still required after documentation truth-sync because documentation creates a new branch head. Automated GREEN remains necessary but does not replace explicit product-owner acceptance.