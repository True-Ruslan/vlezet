# 2026-08-09 — M8.2 Precision Drawing and Structural Editing

**Status:** AUTOMATED GATES GREEN / PRODUCT-OWNER BASE SCENARIOS PASS / CLIPBOARD EXTENSION RETEST PENDING  
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
- structural clipboard with copy-safe projection and strict destructive dependency closure;
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
- automated verification, product acceptance and merge remain separate states.

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

### Task 3 — strict structural clipboard foundation

```text
RED:                        e02a1dc6aa560f10048a4c49e1ddb06fc8d764f9
CI #4839:                   EXPECTED FAIL
reason:                     missing ./structural-clipboard
geometry:                   98 tests PASS
existing editor-core:       58 tests PASS
GREEN:                      68e8ebb4b47b00ca9a349a3ef09cf2523b47e936
CI #4842:                   PASS
```

The original foundation required a dependency-closed structural wall fragment for Copy/Cut. Required vertices and all hosted openings were carried automatically. Paste created fresh IDs, remapped internal references, applied one rigid translation and validated the complete candidate before addition. Product-owner testing later showed that applying the destructive closure rule to non-destructive Copy made ordinary wall/room clipboard use unnecessarily restrictive; the extension is recorded below without weakening Cut.

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
- structural Cut/Paste use `structure/cut` / `structure/paste` and editor-core validation;
- Escape prioritises structural gesture cancellation before object gesture cancellation;
- M8.1 furniture clipboard behaviour remains covered and unchanged;
- an accidentally generated large `ApartmentEditor` rewrite was rejected during self-review and fully removed before Task 4 GREEN.

## Tasks 5–8 — consolidated implementation truth

By pre-Task-9 consolidation head
`d9a685e69f4fc6d30b5a5264911c8371090c4ede`, the branch contained the approved implementation for Tasks 5–8:

### Task 5 — exact near-cursor wall input

- visible `Длина` / `Угол` inputs beside the active wall draft;
- canonical millimetres and Canvas angle convention;
- pointer geometry remains authoritative until an exact field is constrained;
- Tab moves length → angle;
- Enter commits the exact segment and intentionally continues the wall chain;
- Escape first exits focused numeric editing, then cancels the draft on the next editor-level Escape;
- invalid numeric input cannot silently create geometry.

### Task 6 — snap control, guides and handles

- visible `Привязки` command with `aria-pressed` state;
- gesture-local Alt/Option suppression;
- named structural snap overlay;
- endpoint/junction handle layer;
- interactive hit target metadata aligned with the >=24 px acceptance requirement.

### Task 7 — Canvas structural gesture integration

- structural candidate preview is rendered from editor-core evaluation;
- valid commit creates one semantic history operation;
- invalid preview is explicit and non-colour-only;
- rejected/cancelled/no-op gesture creates no history;
- hosted-opening and topology authority remain editor-core owned.

### Task 8 — capability-driven structural commands / batch thickness

- shared capability derivation controls keyboard/UI/context-menu mutation availability;
- compatible wall selections expose centred common thickness editing;
- incompatible/unsafe structural selection fails closed;
- structural clipboard is integrated with the single runtime clipboard authority;
- M8.1 placed-object clipboard remains unchanged.

The current GitHub PR metadata does not provide a trustworthy one-to-one reconstruction of the historical RED/GREEN commit identities for every sub-step inside Tasks 5–8. This record therefore **does not retroactively invent them**. The implemented behavior is anchored to the consolidation head above and to the dedicated Task 9 browser acceptance below.

## Task 9 — dedicated Chromium/WebKit M8.2 acceptance

A new real-browser acceptance surface was added at:

```text
tools/m7-browser-audit/m8-precision-structural.spec.mjs
```

and registered in both Chromium and representative WebKit configs.

Initial covered behavior:

- pointer wall creation + exact numeric wall segment + semantic Undo/Redo;
- exact-input Tab/Enter/Escape focus ordering;
- endpoint/midpoint/wall-axis snap acquisition and hysteresis;
- visible snap toggle and Alt/Option suppression;
- shared-endpoint structural movement with exact Undo → Redo → Undo;
- safe wall translation preserving hosted opening and wall length;
- unsafe connected-wall reversal rejection with no partial history entry;
- atomic multi-wall thickness + Undo;
- dependency-closed structural Copy/Paste + Undo/Redo;
- connected open-fragment clipboard rejection under the original Task-3 contract.

### Browser hardening RED history

Task 9 intentionally produced several **test-only** RED runs before the acceptance harness matched real product semantics. The observed failure classes were:

- expecting exact Enter to end the wall chain when the approved behavior intentionally continues it;
- visually closing a room while snapping was disabled, producing distinct vertices rather than a topological closure;
- recomputing ratio-based Canvas coordinates after context surfaces changed the available layout;
- comparing Canvas screenshots across different hover/selection projection states instead of semantic values;
- onboarding overlay physically covering a structural probe;
- probing a host wall inside the already-created door opening, correctly selecting the opening instead of the wall.

No production mutation policy, snapping priority, topology validator, opening validator, M2 authority or recognition threshold was weakened during these browser RED iterations.

### First complete automated Task 9 GREEN

```text
head:                         66d27a673679f26a4a414213415f1603a02aad6a
CI #4915:                     PASS
Browser Acceptance #1365:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser artifact:             9056208133
artifact digest:              sha256:00c34117d81ec257ad6f491df5781af0230fdb783e8bd8e2dbb48662d5bd740e
```

This was automated implementation evidence only. It did **not** imply product-owner acceptance or merge authorization.

## 2026-08-10 — Product-owner pre-acceptance finding: ordinary wall and room Copy/Paste

The product owner completed the seven requested M8.2 manual scenarios and reported **all PASS**, then identified one material usability gap before acceptance:

> connected walls and whole rooms could not be copied/pasted through ordinary editor commands.

Acceptance was deliberately kept open and the clipboard contract was refined rather than treating the earlier automated green as sufficient product acceptance.

### Refined product semantics

**Wall Copy / Duplicate**

- non-destructive Copy no longer requires destructive dependency closure;
- a selected connected wall is projected into a self-contained clipboard wall with its endpoint vertices;
- junction references that belong only to unselected neighbouring walls are pruned in the copy;
- every opening hosted by the copied full wall is carried automatically;
- source topology is never modified by Copy.

**Wall Cut**

- remains strict dependency-closed and fail-closed;
- a connected wall cannot be cut on its own when that would leave dangling topology;
- no safety rule was weakened to enable Copy.

**Whole-room Copy / Duplicate**

- room selection is projected from the exact derived `PlanarFace` boundary rather than whole backing wall IDs;
- an atomic room boundary segment is copied even when the source physical wall continues into a neighbouring room through a junction;
- only openings fully belonging to the copied boundary segments are carried;
- a partially crossing opening fails closed instead of being clipped or guessed;
- reversed source-wall traversal remaps opening offset and door swing orientation deterministically;
- the explicit `RoomAnnotation` name is copied when present;
- room Cut remains disabled because shared structural topology makes destructive room semantics ambiguous.

Current room clipboard scope is the **structural room shell + hosted openings + explicit room name**. Furniture remains an independent placed-object clipboard concern; automatically including all furniture located inside a room is intentionally not claimed by this extension.

**Safe placement**

- every requested paste position is validated first with the unchanged structural validator;
- ordinary structural paste may search a bounded deterministic nearby placement if the default offset intersects existing topology;
- room and ordinary offset wall paste share this safe-nearby behavior;
- an explicit wall paste exactly at its source origin remains fail-closed, preserving the exact-overlap regression contract;
- at most eight bounded right/down/diagonal placement steps are considered, each with the same topology/opening validation;
- no valid placement means no mutation and no history entry.

### TDD evidence

Initial wall/room projection RED:

```text
RED web head:                5b6409c319afadbe18b2b11cf02ad3773d2ae331
CI #4921:                    EXPECTED FAIL
reason:                      connected wall Copy still required strict closure;
                             room structural clipboard API did not exist
```

Room ordinary-paste placement RED:

```text
RED:                         5146252c253fa9490060cfb68b05567aa0ad1ba4
CI #4930:                    EXPECTED FAIL
reason:                      projected room was valid, but the ordinary +200 mm paste anchor
                             overlapped the source and was correctly rejected
```

First expanded browser run:

```text
head:                        68c30b062e20b38c3340ccacc4d21fcdb7694737
CI #4934:                    PASS
Browser Acceptance #1381:   EXPECTED FAIL
Chromium:                    32 PASS / 1 FAIL
whole-room Copy/Paste:       PASS
connected-wall Copy UI:      PASS — Copy/Duplicate visible, Cut absent
connected-wall Ctrl+C/V:     FAIL — default offset crossed neighbouring wall and paste was rejected
```

Focused unit reproduction of the browser failure:

```text
RED:                         ac031fecfba326a4c472db7ebbc3b3e04c4173ae
CI #4935:                    EXPECTED FAIL
existing web tests:          569 PASS
new focused failure:         connected-wall safe nearby paste created no history/document change
```

Final GREEN after extending only the placement policy:

```text
head:                         beb25379e0b6a25af0a8af84da878a62c5692e08
CI #4936:                     PASS
Browser Acceptance #1386:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser artifact:             9059253821
artifact digest:              sha256:219d08315515c1264a66f287cf7d21a2e01d8e6d304075d5c9be7619634dbc71
```

The final browser suite includes both connected-wall Copy/Paste and whole-room Copy/Paste plus Undo/Redo. The existing exact-overlap fail-closed unit regression remains green.

## Current gate

M8.2 remains **Draft / not yet product-accepted**. The original seven manual acceptance scenarios were reported PASS, but the newly added clipboard behavior requires a short product-owner retest on the latest verified head.

Required focused retest:

1. select one wall that is connected to other walls → Copy/Paste must create a detached valid copy; Copy and Duplicate are available, Cut remains unavailable when dependency closure is incomplete;
2. select a derived room → Copy/Paste must create a second valid room shell with its doors/windows and explicit room name if present;
3. Undo/Redo each paste once and verify one semantic history step per paste;
4. verify that an unsafe structural placement never leaves partial geometry.

Do not create `docs/milestones/m8-2-acceptance.md`, mark PR #87 Ready, close #56, or merge until this focused clipboard retest passes and the resulting documentation head receives fresh exact-head CI/browser verification.