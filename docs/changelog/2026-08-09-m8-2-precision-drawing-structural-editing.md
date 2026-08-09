# 2026-08-09 — M8.2 Precision Drawing and Structural Editing

**Status:** IN DEVELOPMENT  
**Tracker:** #56  
**Implementation PR:** #87  
**Design:** PRODUCT-OWNER APPROVED — 2026-08-09  
**M8.1 base:** `867ec54d21b1dcb94d519ace3bec0a3635717022`  
**Plan/design head before production RED:** `19e8ae38e186f5d83e7af472ee0b8b70496b867c`

## Why

M8.2 makes exact manual apartment construction fast enough to stay on the Canvas while preserving Vlezet's millimetre, topology, hosted-opening and semantic-history authority.

Approved scope:

- named semantic snapping with deterministic priority and hysteresis;
- exact near-cursor wall length/angle input;
- direct endpoint/junction editing;
- contextual topology-safe wall-body translation;
- atomic centred multi-wall thickness editing;
- strict fail-closed structural clipboard dependency closure;
- hosted-opening preservation/revalidation;
- one semantic history command per committed structural operation;
- WCAG 2.2-oriented drag alternatives, target sizing and keyboard/focus behaviour.

## Engineering contract

- genuine RED → observed intended failure → minimal GREEN → regression/refactor;
- `@vlezet/geometry` owns pure snapping/angle calculations;
- `@vlezet/editor-core` owns structural candidate construction and validation;
- Canvas is intent/projection only;
- no partial mutation or silent topology repair;
- no weakening existing topology/opening/recognition thresholds;
- Chromium full flow + representative WebKit acceptance;
- acceptance and merge remain separate states.

## Pre-production baseline

```text
head:                       19e8ae38e186f5d83e7af472ee0b8b70496b867c
CI #4823:                   PASS
CI #4824:                   PASS — duplicate exact-head run while design PR also existed
production M8.2 code:       none
```

PR #86 was closed without merge after design approval because the approved design/plan commits are carried forward by implementation PR #87.

## RED / GREEN evidence

### Task 1 — Canvas angle authority

```text
RED:                        9141cadcd60bae8f945a9c3bcfbbd08a176654fe
CI #4826:                   EXPECTED FAIL
reason:                     missing ./structural-angle
pre-existing geometry:      18 suites / 75 tests PASS
GREEN integration:          0eca3ae7013d39c7cfb60c80d6e88a16d95af6c8
CI #4828:                   PASS
```

### Task 1 — semantic structural snapping

```text
RED:                        f2e0b26468ac20a91a36c35ffd81b19ae8bf5923
CI #4829:                   EXPECTED FAIL
reason:                     missing ./structural-snapping
existing + angle geometry:  19 suites / 88 tests PASS
GREEN refinement:           89aeda9ccbc42a0ada17ce878a7c78838250b603
CI #4832:                   PASS
```

CI #4831 exposed two test-fixture contradictions with the approved priority: the fixtures asked for a lower-priority snap at an exact midpoint. The test-only correction moved the eligible construction intersection away from a midpoint and made the undeclared crossing assert no invented `intersection` split while preserving midpoint priority. Production snap ranking was not weakened.

### Task 2 — structural transaction authority

```text
RED:                        90b763de7531af33049e908f93c5895e64723881
CI #4833:                   EXPECTED FAIL
reason:                     missing ./structural-editing
geometry:                   98 tests PASS
pre-existing editor-core:   47 tests PASS
GREEN authority:            b5d8d8938ca139cd7270063673064fa4e60af7ab
CI #4835:                   PASS
final API/labels head:       10ed30ae136ed94b06791bdc1c13729d564c6ed2
CI #4838:                   PASS
```

The transaction layer validates the complete candidate document before acceptance: finite geometry, no collapse/reversal where direction must be preserved, topology diagnostics and every hosted opening. Wall translation moves its mandatory vertices as one candidate rather than chaining partial mutations. Batch thickness reuses centred `setWallThickness` semantics.

### Task 3 — strict structural clipboard

```text
RED:                        e02a1dc6aa560f10048a4c49e1ddb06fc8d764f9
CI #4839:                   EXPECTED FAIL
reason:                     missing ./structural-clipboard
geometry:                   98 tests PASS
existing editor-core:       58 tests PASS
GREEN:                      68e8ebb4b47b00ca9a349a3ef09cf2523b47e936
CI #4842:                   PASS
```

Only a topologically closed wall fragment is copyable/cuttable. Hosted openings are dependencies and are carried automatically. Paste creates fresh IDs, remaps internal references, applies one rigid translation and validates the complete candidate before addition.

### Task 4 — unified runtime gesture / clipboard / history

The first RED draft used a separate structural session state. Architectural review rejected that direction before acceptance because it would create a second clipboard/history owner. The RED was refined to require integration directly in the existing editor store.

```text
refined RED:                6b561058cb9919ad87038e9d8179f36eab67b238
CI #4848:                   EXPECTED FAIL
new unified-store failures: 6
pre-existing web tests:     513 PASS
editor-core / geometry:     PASS
unified runtime candidate:  b3e35d6d34d4d814a148af4fe175469ad3cfaafd
CI #4851 runtime:           unit + recognition PASS; typecheck exposed union narrowing only
final Task 4 head:          6090bb855d1b83f439686d93d571c2710056c88f
CI #4858:                   PASS
```

Final Task 4 properties:

- `EditorStoreState` is the single owner of object + structural gestures, semantic history and clipboard state;
- structural preview creates no history; valid commit creates exactly one semantic command; invalid/no-op/cancel creates none;
- structural Copy/Cut/Paste share one discriminated editor clipboard with the accepted M8.1 furniture path;
- structural Cut/Paste use `structure/cut` / `structure/paste` and strict editor-core closure/validation;
- Escape prioritises structural gesture cancellation before object gesture cancellation;
- M8.1 furniture clipboard behaviour remains covered and unchanged;
- an accidentally generated large `ApartmentEditor` rewrite was rejected during self-review and fully removed before Task 4 GREEN; the accepted M8.1 `apartment-editor.tsx` has no diff at `6090bb85…`.

Task 5 exact near-cursor wall input is next.
