# 2026-08-09 — M8.2 Precision Drawing and Structural Editing

**Status:** AUTOMATED CORRECTION GREEN / PRODUCT-OWNER BASE SCENARIOS PASS / CORRECTION RETEST PENDING  
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

## 2026-08-11 — Precise room targeting and composite clipboard correction

The wall/room clipboard extension was automated-green, but the broader interaction contract still needed to be made explicit and regression-safe before product acceptance. The correction design/plan was recorded as:

```text
design:                      a6a95bcb0ca5281b92f0e2f4f97befae39c8f9ae
plan:                        b9605d452c081c48857dbbd86d8dbcec706d8e56
```

### Product semantics

**Precise room targeting**

- room point-hit uses exact polygon containment rather than a broad bounding approximation;
- when multiple derived faces contain the same point, deterministic canonical-area ordering selects the smallest valid room first;
- concave-room cut-outs therefore do not steal clicks intended for a smaller adjacent room;
- empty room interiors expose hover/selectability through geometry fallback when no higher-priority Konva listening node exists.

**Explicit composite Copy**

- approved mixed selections may combine structural room/wall clipboard content with explicitly selected placed furniture;
- room containment alone never implies furniture membership — furniture inside a room but not selected is not copied;
- unsupported explicit mixes remain fail-closed;
- destructive Cut remains governed by the stricter dependency-closure contract.

**Atomic pointer Paste**

- ordinary Paste uses the latest Canvas world pointer as the requested anchor;
- before any Canvas pointer has been observed, clipboard origin is the deterministic fallback;
- the complete structural candidate is validated first;
- if structural safe-nearby placement changes the requested delta, the same **actually accepted** delta is applied to explicitly copied furniture;
- structure + furniture therefore remain one rigid composite and commit through one `document/replace` semantic history operation;
- rejection leaves no partial geometry, furniture or history entry.

**Rejected Copy feedback / stale clipboard safety**

- explicit keyboard Copy always routes through the store, even when current capability is unsupported;
- an unsupported Copy clears any stale previous clipboard payload;
- a non-modal `role="status"` reason explains why Copy was rejected;
- successful Copy/Paste clears the notice.

### Genuine RED / GREEN evidence

Concave-room point-hit RED:

```text
RED:                         14dc065e3e73de66a6c7b2b89364ce28ac97b744
CI #4942:                    EXPECTED FAIL
Browser #1392:               CANCELLED after RED
```

Approved mixed-copy capability RED:

```text
RED:                         96d929a44c483e23ee5409161e8584a6c0993a94
CI #4954:                    EXPECTED FAIL
Browser #1404:               CANCELLED after RED
```

Pointer/composite Paste routing RED:

```text
RED:                         50256b799685d0e55e2170bbd2cbf42442206102
CI #4968:                    EXPECTED FAIL
Browser #1418:               PASS — previous browser suite did not yet cover the new contract
```

Rejected Copy / stale clipboard RED:

```text
RED:                         23e54361d97b9917b1badf9b2a42cf9eeecee718
CI #4974:                    EXPECTED FAIL
Browser #1424:               CANCELLED after RED
```

First dedicated selection/clipboard browser acceptance RED:

```text
head:                        bf5230f7acb03b06fe0b47370d6937bf57c55e2f
CI #4979:                    PASS
Browser #1429:               EXPECTED FAIL
reason:                      new real-Canvas scenarios exposed room-hover gap and fixture assumptions
```

Focused room-hover RED:

```text
RED:                         601fbd1d281159edc2eac76b9fb561542c49b660
CI #4980:                    EXPECTED FAIL
Browser #1430:               CANCELLED after RED
```

Production GREEN was built incrementally without broadening authority:

```text
room polygon containment:    46d59c632c57cfbfdc899977f746a75645e48a42
canonical room ordering:     e991df20cd79f21ac214ca4ab532dce83771ff62
composite primitives:        d17679e46de77651df26533bb27ddf3154da6c7d
approved mixed capabilities: 0448b282f7db20de6ec8386764b36abfac60aa1f
explicit mixed Copy:         f96bd5e94eda91af5f66d30feb88b729f63b4721
atomic composite Paste:      1aeaa593b5627fd11e3b271232a103fa2399225d
latest-pointer Paste:        bd38efcc7a3395f7c12490c7fd29683d67a1d534
history label authority:     889039d6a07f19dc9a80e9b7a4177f2b8ae9764a
rejected-Copy feedback:      a91d550cfe1a764e0c9c91530c13e494a3509120
feedback effect hardening:   29e0e9e433b1333cda3bec44153e8cb6495b31fd
room-hover geometry fallback:5fc292fbede63ed9e794a0e13e22c497fc05595e
point-hit type narrowing:    52fe1f7f947958fee47a06e1fd3c1b618663f942
```

The dedicated browser suite then exposed only test-fixture topology/layout defects: recomputing Canvas ratios after first-room UI changes could target different world coordinates, and visually touching walls were correctly rejected without explicit endpoint topology. Fixture-only commits hardened the scenario without weakening validation. The final fixture reuses stable Stage-relative offsets and semantic endpoint snapping.

### Final automated correction GREEN

```text
head:                         fbc5c6ef299aba4daf2257730c99f2c39966c0ab
CI #4986:                     PASS
  documentation contract:     PASS
  unit tests:                 PASS
  Core Recognition Benchmark: PASS
  typecheck:                  PASS
  lint:                       PASS
  build:                      PASS
Browser Acceptance #1436:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser artifact:             9115252220
artifact digest:              sha256:df067068672383db97cead6b75c224f26ad5adea63ffc513ef6c572ca281d7df
review threads:                0
```

Scope review from the pre-correction M8.2 consolidation head confirmed no persistent schema change, no recognition behavior change and no validator weakening. The correction is limited to editor selection/clipboard routing, editor-core structural clipboard semantics, focused browser acceptance and documentation.

## Current gate

M8.2 remains **Draft / not yet product-accepted**. The original seven manual acceptance scenarios were reported PASS, and the subsequent clipboard/selection correction is automated-green. Product acceptance still requires an explicit focused retest of the latest correction.

Required focused retest:

1. small room inside a concave-room cut-out always selects correctly;
2. room hover makes the click target discoverable before selection;
3. two explicitly selected furniture items paste around the latest Canvas pointer and preserve spacing;
4. room + explicitly selected furniture pastes atomically as one rigid group;
5. furniture inside the room but not explicitly selected is not copied;
6. rejected unsupported Copy shows a reason and cannot paste stale previous clipboard content;
7. one Undo removes the complete composite Paste and one Redo restores it.

Do not create `docs/milestones/m8-2-acceptance.md`, mark PR #87 Ready, close #56, or merge until this correction retest passes and the resulting accepted documentation head receives fresh exact-head CI/browser verification.