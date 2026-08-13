# M8.2 Direct Manipulation / Hosted Opening Correction — 2026-08-12

Status: **AUTOMATED GREEN / PRODUCT-OWNER CORRECTION RETEST PENDING**

This record documents the focused M8.2 correction that followed the latest product-owner retest. It is an implementation/evidence record, not an acceptance record. PR #87 remains Draft, issue #56 remains open, M8.3 remains blocked, and no protected merge is authorized by this document.

## Product-owner failure and root cause

The product-owner retest found one real mixed-composite direct-manipulation failure: after explicitly selecting `room + furniture`, starting a drag on the body of an already-selected furniture item did not move the selected room composite as one rigid group.

The failure was traced through the actual pointer path:

1. `beginStructuralRoomGesture` intentionally refused a non-room direct Konva hit.
2. `PlacedObjectShape` stopped event propagation and entered placed-object handling.
3. the ordinary object gesture path could not own this mixed selection because the selection also contained a room reference.
4. as a result, a selected mixed composite had no single semantic drag owner when pointer-down began on selected furniture.

The correction makes semantic gesture ownership explicit. Renderer bubbling/hit ownership is not allowed to decide ambiguous selected-composite behavior. Pointer-down resolves one semantic gesture owner before mutation begins.

## Corrected product behavior

### Selected room + explicit furniture

- an isolated selected room can still be moved from free room interior;
- `room + explicitly selected furniture` moves by one identical accepted delta and commits atomically;
- starting that same composite drag on an already-selected furniture body delegates to the room-composite gesture instead of falling into ordinary object movement;
- an unselected furniture hit remains an ordinary furniture interaction;
- single-object Transformer resize/rotate remains available outside mixed room-composite ownership;
- accepted room movement remains one semantic `room/translate` history operation; reject/no-op/cancel creates none.

### Hosted doors and windows

Direct opening movement now preserves current-host semantics:

- a door/window drag is constrained to its existing host wall;
- movement does not silently re-host the opening onto another wall;
- pointer movement beyond an endpoint is constrained to the valid current-wall span;
- overlap/invalid opening positions are shown as invalid during the gesture and commit nothing;
- door and window use the same structural host-move primitive;
- one accepted opening movement is one semantic Undo/Redo operation.

### Room label readability

Room labels are now derived by a deterministic renderer-only layout helper and rendered as separate non-overlapping Konva text slots. The degradation order is:

1. full: name + area + dimensions;
2. name + area;
3. compact one-line name + area;
4. name only;
5. hidden when even the safe minimum cannot fit.

Dimensions are removed before area. Long content uses bounded wrapping/ellipsis rather than overlapping adjacent label rows. Label fragments are explicitly keyed so the projection does not emit unstable React fragment warnings.

## TDD / implementation provenance

### Mixed-composite gesture arbitration

- RED: `8ea1d629b1fde1ff450d7bcd2fa0dbb1a4433eb4` — `test(editor): require selection-aware gesture arbitration`
- GREEN foundation: `b719396d12ccb9e19681b7c396f247c8b3a48efd` — `feat(editor): arbitrate direct manipulation gestures`
- RED: `fc41bce676747f19506194648979b41c3f3f3c84` — `test(canvas): require room composite drag ownership from selected furniture`
- GREEN: `3e95517504cf1ac268cd44fab676f5a00986a56b` — `fix(editor): delegate selected mixed object drag to room composite`
- GREEN Canvas routing: `c0192916151ace09bf9713e6c7cf0efabe14e9c8` — `fix(canvas): route selected mixed object drag through room gesture`

### Hosted-opening movement

- RED: `779005daeb8dcbbb22e7722b03f07f18aa0d4c8c` — `test(editor-core): require hosted opening movement evaluator`
- GREEN: `8208cb03fbbdc41488477b5098f7989a2c1f1ddc` — `feat(editor-core): evaluate hosted opening movement`
- export: `b749e7793983f242ed6c957cd95a6606117862c1` — `feat(editor-core): export hosted opening movement`
- RED: `85ee063864f65207fb9181cbbd1ca25ffe734f96` — `test(editor): require hosted opening structural gesture`
- GREEN command: `ec13686a7c4db3a6e6e2b2a1ef6cd4c4d2ae5fc0` — `feat(editor-core): register hosted opening move command`
- GREEN store gesture: `65b31b71fd9c417a64a0a09c3b20bf6514ac908c` — `feat(editor): add hosted opening structural gesture`
- RED pointer routing: `b21c07363be71f917850a316b9c03f4d8e8367e6` — `test(canvas): require hosted opening pointer routing`
- GREEN pointer routing: `e274f268fd3ed598c70cafc9fabb9b86e4559208` — `feat(canvas): route hosted opening drag through structural gesture`
- RED render-safety: `7694ecab933323ccbdd12732baede0837c4eb12e` — `test(canvas): require render-safe hosted opening handlers`
- GREEN render-safety: `831658e0aa8e2b75edcc6c88c2dc1559430ec68a` — `fix(canvas): make hosted opening handler render-safe`

### Room-label layout

- RED: `cc153c66810c784a3f1f7e1796ab48e6783b159c` — `test(canvas): require deterministic room label layout`
- GREEN helper: `74fa3ebe9102461a287deb58f2531adb818ffc35` — `feat(canvas): derive safe room label layout`
- rendering contract: `5356de9585e5697092496ecc2216c313c32b718f` — `test(canvas): require safe room label rendering`
- content split: `5313cb9ce50741e940fa1d1a9fbc25665ad6b3bb` — `refactor(canvas): expose room label content parts`
- GREEN rendering: `868719a8c8e308f275a0e8e4052a7aeadad9672e` — `fix(canvas): render deterministic room label slots`
- additional RED: `a9572d5b2599531bac36c6509b8deb79d262727b` — `test(canvas): require keyed room label fragments`
- GREEN: `ee5f923346251e759d99d9bcda3cb6cc0a019980` — `fix(canvas): key room label fragments`

## Browser acceptance provenance and failure classification

Dedicated correction acceptance was added at:

- `0130864943db5146854fbf1ee2b5b90cb2334c49` — `test(browser): cover M8.2 direct manipulation correction`
- Browser Acceptance #1503 — **FAIL**

The #1503 failures were investigated from Playwright traces/artifacts before any product change. They were classified as **browser-harness defects, not product-runtime defects**:

1. the new room fixture disabled structural snapping, so its contour could not reliably close on the start endpoint and several room scenarios failed before reaching the behavior under test;
2. opening tests began drag from the center of the wall gap, while the actual listening Konva geometry is the door leaf/window lines, so the test started marquee/selection handling instead of `translate-opening`.

No domain, topology, opening validation or recognition authority was weakened to obtain GREEN.

Harness correction/hardening:

- `b8314e999ad0686b3bb1ac826a080e39062b8018` — `test(browser): fix M8.2 acceptance harness`
- `ebda70125dd81b93d555198f07666c841d8b8398` — `test(browser): probe rendered M8.2 interaction bounds`
- `af14ccb338ca7d87b6bf1b52140407e7ba8dc4fb` — `test(browser): verify persisted furniture transforms`

## Exact implementation-head evidence

Verified implementation head before this truth-sync:

```text
head:                         ee5f923346251e759d99d9bcda3cb6cc0a019980
CI #5058 / run:               31605042971 — PASS
  documentation contract:     PASS
  unit tests:                 PASS
  Core Recognition Benchmark: PASS
  typecheck:                  PASS
  lint:                       PASS
  build:                      PASS
Browser Acceptance #1508:     PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser run:                  31605042975
browser artifact:             9145064452
artifact digest:              sha256:978b5493ac309ca52b45d0555a0a5c11615ef5e933ea8c8684d63362ed4b8646
unresolved review threads:    0
```

A fresh exact-head CI + Browser Acceptance run is still required after the documentation truth-sync commit, because documentation changes create a new PR head.

## Market / open-source research provenance

The correction uses ideas and interaction patterns only; third-party code was not copied.

- `fedepaj/arcada-planner` — MIT; consulted as an architectural/interaction reference only.
- `charmlinn/blueprint3d-modern` — MIT; consulted as an architectural/interaction reference only.
- **copied code: none**.

Repository research/benchmark records already exist in the M8.2 branch (`docs/product` / `docs/research`). Vlezet's own authority boundaries, types, validators and tests remain the source of truth.

## Scope / authority audit

The correction does **not** introduce:

- a `VlezetDocument` schema migration;
- persistent room ownership of furniture;
- recognition threshold or recognition behavior changes;
- M2 fit/collision/clearance authority changes;
- silent topology repair;
- silent opening re-hosting;
- partial structural commits after a rejected gesture.

`@vlezet/editor-core` remains structural mutation/validation authority; geometry remains deterministic; Canvas owns pointer intent/projection/transient gesture coordination only.

## Acceptance gate

Current delivery state is intentionally:

```text
M8.2 direct-manipulation correction: AUTOMATED GREEN
latest product-owner correction retest: PENDING
M8.2 product acceptance: PENDING
PR #87: Draft
issue #56: Open
M8.3: BLOCKED
```

Only an explicit product-owner PASS for the focused correction scenarios can unblock the M8.2 acceptance record, final accepted-head gates, Ready state, issue closure and separately authorized protected squash merge.
