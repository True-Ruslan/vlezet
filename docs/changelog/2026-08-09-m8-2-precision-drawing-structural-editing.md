# 2026-08-09 — M8.2 Precision Drawing and Structural Editing

**Status:** AUTOMATED ROOM-TRANSLATION GREEN / PRODUCT-OWNER BASE SCENARIOS PASS / LATEST FOCUSED RETEST PENDING  
**Tracker:** #56  
**Implementation PR:** #87  
**Design:** PRODUCT-OWNER APPROVED — 2026-08-09  
**M8.1 base:** `867ec54d21b1dcb94d519ace3bec0a3635717022`  
**Plan/design head before production RED:** `19e8ae38e186f5d83e7af472ee0b8b70496b867c`

## Why

M8.2 makes exact manual apartment construction fast enough to stay on the Canvas while preserving Vlezet's millimetre, topology, hosted-opening and semantic-history authority.

The slice has expanded only in response to concrete pre-acceptance product findings. Automated green is never treated as product acceptance: PR #87 remains Draft until the product owner explicitly passes the latest focused retest.

## Engineering contract

- genuine RED → observed intended failure → minimal GREEN → regression/refactor;
- `@vlezet/geometry` owns pure snapping/angle/derived polygon calculations;
- `@vlezet/editor-core` owns structural candidate construction, closure and validation;
- Canvas/web owns intent, projection and transient runtime coordination only;
- `VlezetDocument` remains the only persistent apartment truth;
- no partial mutation or silent topology repair;
- no weakening topology/opening/M2/recognition validation to obtain green tests;
- Chromium full flow + representative WebKit acceptance;
- automated verification, product acceptance, Ready state and merge are separate states.

## Original approved implementation

The original M8.2 scope delivered:

- named semantic snapping with deterministic priority and hysteresis;
- exact near-cursor wall length/angle input;
- direct endpoint/junction editing;
- topology-safe wall-body translation;
- atomic centred multi-wall thickness editing;
- structural clipboard foundation;
- hosted-opening preservation/revalidation;
- one semantic history command per committed structural operation;
- accessible structural handles and explicit valid/invalid feedback.

### Baseline and core RED/GREEN history

```text
pre-production head:         19e8ae38e186f5d83e7af472ee0b8b70496b867c
CI #4823 / #4824:            PASS

Canvas-angle RED:            9141cadcd60bae8f945a9c3bcfbbd08a176654fe / CI #4826 — EXPECTED FAIL
Canvas-angle GREEN:          0eca3ae7013d39c7cfb60c80d6e88a16d95af6c8 / CI #4828 PASS

structural-snapping RED:     f2e0b26468ac20a91a36c35ffd81b19ae8bf5923 / CI #4829 — EXPECTED FAIL
structural-snapping GREEN:   89aeda9ccbc42a0ada17ce878a7c78838250b603 / CI #4832 PASS

transaction-authority RED:   90b763de7531af33049e908f93c5895e64723881 / CI #4833 — EXPECTED FAIL
transaction GREEN:           b5d8d8938ca139cd7270063673064fa4e60af7ab / CI #4835 PASS
final API/labels:             10ed30ae136ed94b06791bdc1c13729d564c6ed2 / CI #4838 PASS

strict clipboard RED:        e02a1dc6aa560f10048a4c49e1ddb06fc8d764f9 / CI #4839 — EXPECTED FAIL
strict clipboard GREEN:      68e8ebb4b47b00ca9a349a3ef09cf2523b47e936 / CI #4842 PASS

unified runtime RED:         6b561058cb9919ad87038e9d8179f36eab67b238 / CI #4848 — EXPECTED FAIL
unified runtime candidate:   b3e35d6d34d4d814a148af4fe175469ad3cfaafd
final unified runtime:       6090bb855d1b83f439686d93d571c2710056c88f / CI #4858 PASS
```

The structural transaction layer validates the complete candidate document before acceptance. Wall translation moves its mandatory vertices as one candidate rather than chaining partial mutations. Structural preview creates no history; valid commit creates exactly one semantic command; invalid/no-op/cancel creates none.

The first runtime RED draft proposed separate structural session state. Architectural review rejected it before acceptance because it would create a second clipboard/history authority. The refined implementation integrates directly into the existing editor store.

## Exact input, snap UI, Canvas structural gestures and batch editing

By consolidation head `d9a685e69f4fc6d30b5a5264911c8371090c4ede`, the branch had the approved exact-input, snap-control, structural-handle, Canvas-preview and capability-driven batch-editing behavior.

Important semantics:

- Canvas angle convention is `0° right / 90° down / 180° left / 270° up`;
- pointer geometry remains authoritative until exact wall fields are constrained;
- Enter commits exact wall input and intentionally continues the wall chain;
- Escape exits numeric focus before cancelling the editor draft;
- `Привязки` exposes persistent snap state while Alt/Option suppresses snapping only for the active gesture;
- invalid structural preview is explicit and non-colour-only;
- compatible wall selections can edit common centred thickness atomically;
- incompatible or unsafe structural selections fail closed.

## Dedicated original Chromium/WebKit acceptance

`tools/m7-browser-audit/m8-precision-structural.spec.mjs` was added and registered in Chromium and representative WebKit.

Browser hardening intentionally exposed test-only assumptions around exact-input continuation, topological room closure, Stage-relative coordinates, onboarding overlays and opening-vs-host-wall pointer priority. Those fixtures were corrected without weakening production mutation, snap or validation policy.

First complete automated original-scope GREEN:

```text
head:                         66d27a673679f26a4a414213415f1603a02aad6a
CI #4915:                     PASS
Browser Acceptance #1365:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser artifact:             9056208133
artifact digest:              sha256:00c34117d81ec257ad6f491df5781af0230fdb783e8bd8e2dbb48662d5bd740e
```

This was automated implementation evidence only.

## 2026-08-10 — Product-owner finding: ordinary wall and room Copy/Paste

The product owner ran the seven original M8.2 scenarios and reported **all PASS**, then identified a material usability gap before acceptance: connected walls and whole rooms could not be copied/pasted through the ordinary editor flow.

Acceptance remained open and the clipboard contract was refined.

### Refined clipboard semantics

**Connected wall Copy / Duplicate**

- non-destructive Copy does not require destructive dependency closure;
- a selected connected wall becomes a detached self-contained clipboard projection;
- endpoint vertices and hosted openings are copied;
- neighbour-only junction references are pruned;
- source topology is unchanged.

**Wall Cut** remains dependency-closed and fail-closed. Safety was not weakened to enable Copy.

**Whole-room Copy / Duplicate**

- uses exact derived `PlanarFace` boundary segments rather than whole backing-wall IDs;
- copies only the atomic wall segment belonging to the room when a physical wall continues beyond it;
- carries openings fully belonging to the copied segment;
- partial-crossing openings fail closed;
- reversed wall traversal remaps opening offsets and door swing deterministically;
- explicit room name is preserved;
- destructive room Cut remains disabled because shared-topology semantics are ambiguous.

Room-only clipboard scope remains **structural shell + hosted openings + explicit room name**. Furniture joins only through explicit placed-object selection.

**Safe structural Paste** validates the requested location first and may search a bounded deterministic nearby valid position. Every candidate goes through the unchanged structural validator. Exact source-origin wall overlap stays fail-closed.

### Clipboard extension TDD evidence

```text
projection RED:               5b6409c319afadbe18b2b11cf02ad3773d2ae331 / CI #4921 — EXPECTED FAIL
room placement RED:           5146252c253fa9490060cfb68b05567aa0ad1ba4 / CI #4930 — EXPECTED FAIL
browser placement RED:        68c30b062e20b38c3340ccacc4d21fcdb7694737 / CI #4934 PASS / Browser #1381 — 32 PASS / 1 FAIL
focused wall placement RED:   ac031fecfba326a4c472db7ebbc3b3e04c4173ae / CI #4935 — EXPECTED FAIL
GREEN head:                   beb25379e0b6a25af0a8af84da878a62c5692e08
CI #4936:                     PASS
Browser Acceptance #1386:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser artifact:             9059253821
artifact digest:              sha256:219d08315515c1264a66f287cf7d21a2e01d8e6d304075d5c9be7619634dbc71
```

The browser RED proved that the projected wall/room behavior itself worked but the ordinary default offset could intersect neighbouring topology. The fix extended only placement policy; the structural validator remained unchanged.

## 2026-08-11 — Precise room targeting and composite clipboard correction

The clipboard extension exposed a broader interaction contract that needed explicit regression coverage before product acceptance.

```text
design:                       a6a95bcb0ca5281b92f0e2f4f97befae39c8f9ae
plan:                         b9605d452c081c48857dbbd86d8dbcec706d8e56
```

### Product semantics

**Precise room targeting**

- point-hit uses polygon containment, not a room bounding box;
- deterministic canonical-area ordering chooses the smallest valid containing room;
- concave cut-outs do not steal clicks from smaller adjacent rooms;
- empty room interiors expose hover/selectability through geometry fallback only when no higher-priority listening entity exists.

**Explicit composite Copy**

- approved mixed selections combine room/wall structural content with explicitly selected furniture;
- room containment alone never implies furniture clipboard membership;
- unsupported mixes fail closed;
- destructive Cut remains governed by stricter structural closure.

**Atomic pointer Paste**

- latest Canvas world pointer is the ordinary requested anchor;
- structural candidate is validated first;
- when safe-nearby placement changes the requested structural delta, the same accepted delta is applied to explicit furniture;
- structure + furniture remain rigid and commit in one `document/replace` history operation;
- rejection leaves no partial geometry, furniture or history.

**Rejected Copy feedback**

- unsupported explicit Copy clears stale clipboard payload;
- a non-modal status reason explains rejection;
- an older clipboard cannot silently paste after the rejected command.

### Precise-selection/composite TDD evidence

```text
concave room hit RED:         14dc065e3e73de66a6c7b2b89364ce28ac97b744 / CI #4942 — EXPECTED FAIL
mixed-copy capability RED:    96d929a44c483e23ee5409161e8584a6c0993a94 / CI #4954 — EXPECTED FAIL
pointer/composite Paste RED:  50256b799685d0e55e2170bbd2cbf42442206102 / CI #4968 — EXPECTED FAIL
rejected-Copy feedback RED:   23e54361d97b9917b1badf9b2a42cf9eeecee718 / CI #4974 — EXPECTED FAIL
browser interaction RED:      bf5230f7acb03b06fe0b47370d6937bf57c55e2f / CI #4979 PASS / Browser #1429 FAIL
room-hover fallback RED:      601fbd1d281159edc2eac76b9fb561542c49b660 / CI #4980 — EXPECTED FAIL
final automated GREEN head:   fbc5c6ef299aba4daf2257730c99f2c39966c0ab
CI #4986:                     PASS
Browser Acceptance #1436:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser artifact:             9115252220
artifact digest:              sha256:df067068672383db97cead6b75c224f26ad5adea63ffc513ef6c572ca281d7df
review threads:                0
```

Intermediate browser failures after production correction were fixture topology/layout defects. They were corrected in acceptance code only; production structural validation was not weakened.

## 2026-08-12 — Direct room translation correction

Before final M8.2 acceptance, direct room movement was defined as a first-class structural editing gesture instead of forcing a copy/paste workaround or implicit furniture ownership.

```text
design:                       31075d42841c706d5d8f07839b1e4e946e412e3c
plan:                         feb930e279edeb5a3546a71008f2d1b03b041a8f
pre-room-translation head:    1eda34b409247ddb1a6509c09221ea87b57b8f68
```

### Product semantics

**Room structural closure**

- a selected room is resolved from derived room/face geometry;
- `@vlezet/editor-core` determines whether the room boundary is independently movable;
- isolated safe boundary moves as one rigid candidate;
- shared/connected topology that would require guessing or tearing adjacent structure rejects fail-closed;
- openings remain hosted and validated through the existing structural candidate authority.

**Room-only movement**

- drag begins only from free selected-room interior after higher-priority hits are excluded;
- the room structure moves by one delta;
- furniture merely located inside the room stays fixed.

**Room + explicit furniture movement**

- furniture moves with the room only when explicitly selected;
- `Выбрать мебель в комнате` is a selection helper, not persistent ownership;
- helper inclusion requires the complete physical furniture footprint to be contained by the room polygon;
- touching the boundary is permitted; crossing it is excluded from automatic selection;
- already explicitly selected furniture is preserved;
- mixed preview derives from one preview document and commits atomically.

**Pointer and snapping priority**

- placed furniture, walls, openings and structural handles keep priority over room drag;
- room structural snapping excludes the moving room's own vertices/walls so it cannot self-snap;
- Alt/Option suppresses structural snapping locally without disabling the global setting.

**History / rejection**

- accepted room movement commits as one semantic `room/translate` command;
- one Undo/Redo reverses/restores the complete accepted movement;
- invalid, no-op, cancelled or stale gestures create no history;
- rejected structural movement never partially moves selected furniture.

No room ownership field or schema migration was introduced.

### Genuine room-translation RED/GREEN evidence

Editor-core closure/evaluator:

```text
RED:                         38876ad1b6d92f719b1a1e26a72c8fbcf2f02720
CI #4993:                    EXPECTED FAIL — six new room-translation authority tests only
GREEN:                       4dd9c65324bcc110569a394208fa759c68b32cac
CI #4995:                    PASS
```

Full-footprint containment and selection helper:

```text
geometry RED:                ad4116f8d808618609c517de4aa12017634a57e7 / CI #4996 — EXPECTED FAIL
geometry GREEN:              4846b0679dce48631ba28cfd077f751e7636988b
helper RED:                  7ec10b6c40e1a115b866d7db68466d5c15b8e25f / CI #4998 — EXPECTED FAIL
helper implementation:       199c3c4d8eb89c415a9a13261ea5f83deb4deb2b
package-export fix:          8759ceb4ddc083c044293c228dc8944e7c096e3a
CI #5000:                    PASS
```

The helper GREEN initially failed only when imported through `@vlezet/geometry`: package-local tests used the direct module while the package root had an explicit export list. Systematic debugging confirmed the missing root export; no helper/fixture semantics were weakened.

Atomic store gesture:

```text
RED:                         eaa39b02ac93d067b5d09d55ea78cad65c9328c8 / CI #5001 — EXPECTED FAIL
history label:               3ab73c7b52d99f9c8719c61edeedee27a9e7f82f
GREEN:                       57ada4bc285f1a940a40d2b192e58a305582925e / CI #5003 PASS
```

Capabilities and command routing:

```text
capability RED:              8a88f0a0263f73803469fcebfeeb68d20baa9f0f / CI #5004 — EXPECTED FAIL
capability GREEN:            f76e7c53b594ac0ffa5acc33cfcb8664a78a2b89 / CI #5005 PASS
command/UI RED:              6671579fb56669a3c8bdd9ab0ea5fb0281a2a251 / CI #5006 — EXPECTED FAIL
command/UI GREEN:            6fd107fe8c2646433bb372cca865cb8a1cb0539a / CI #5010 PASS
```

Canvas routing:

```text
RED:                         acead652c019906ccc7d6e8870cb4c5878a7d374 — EXPECTED FAIL
GREEN:                       61c5dd0a81df7425df52cf247941310a669bfe58
CI #5012:                    PASS
```

Dedicated room-translation browser acceptance was added to Chromium and representative WebKit:

```text
browser test head:           e1eb2c81457a6d1b003ab1b1b6cf8fe7fc693d5a
Browser #1463:               FAIL
```

That run exposed **two different classes** and they were handled separately:

1. a test-only coordinate assumption: Undo verification kept absolute page coordinates even though opening/closing context surfaces can move the Konva Stage;
2. a real product feedback gap: unsafe room topology caused `beginStructuralRoomGesture` to return silently, so the rejection could not be rendered visibly.

The real product defect received its own focused RED:

```text
focused feedback RED:        81beec015cf1194d421d7dd4b4473a10d3ffa22f
CI #5016:                    EXPECTED FAIL
existing web tests:          605 PASS
new failure only:            expected invalid translate-room gesture, received undefined
```

Minimal production fix:

```text
GREEN:                       501059e69c87583ff6f06b3a283f1e9effe42a6d
CI #5017:                    PASS
production diff:             apps/web/components/editor/use-editor-store.ts only (+22/-2)
```

Unsafe closure now preserves an invalid `translate-room` gesture with the structural reason, unchanged source document and empty moved structural IDs. The Canvas can therefore show a visible fail-closed rejection. Commit semantics still refuse invalid gestures.

Acceptance-harness corrections were then test-only:

- Undo/Redo probes use stable Stage-relative offsets rather than stale absolute page coordinates;
- the unsafe browser fixture uses one valid room plus a deterministic externally connected wall instead of relying on a more fragile second-room construction;
- editor-core independently covers shared-room closure rejection.

Final implementation/test head:

```text
head:                         00cfae03ca66610414ef7451f37f67192efa1f97
CI #5018:                     PASS
  documentation contract:     PASS
  unit tests:                 PASS
  Core Recognition Benchmark: PASS
  typecheck:                  PASS
  lint:                       PASS
  build:                      PASS
Browser Acceptance #1468:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
browser artifact:             9122287038
artifact digest:              sha256:b6683f810bb9c9a07d44b8b46118b8be9776d52eec81a8e201584c76ebcc114b
review threads:                0
```

Scope audit `1eda34b409247ddb1a6509c09221ea87b57b8f68` → `00cfae03ca66610414ef7451f37f67192efa1f97` changes only room translation/selection/editor-core/geometry/browser/spec-plan surfaces. `packages/domain`, persistent document/project schema and recognition behavior are unchanged.

## Current gate

M8.2 remains **Draft / not yet product-accepted**. The original seven manual scenarios were reported PASS. Clipboard/selection and direct room-translation corrections are automated-green. Product acceptance still requires explicit focused retest of the latest combined behavior.

### Room-translation focused retest

1. move an isolated room by dragging free room interior; only room structure moves;
2. explicitly select `room + 2 furniture` and drag; structure and both items move by one identical delta;
3. invoke `Выбрать мебель в комнате`; fully contained furniture joins selection;
4. furniture crossing the room boundary is not added automatically;
5. furniture/wall/opening/structural-handle pointer hits retain priority over room drag;
6. with snapping enabled, moving toward external structure shows snap behavior; Alt/Option suppresses it only for the active gesture;
7. unsafe shared/connected room topology rejects visibly and mouseup commits nothing;
8. Undo/Redo treats one accepted room movement as exactly one semantic operation.

### Earlier precise-selection/composite retest still required for final acceptance

1. small room inside a concave-room cut-out selects correctly;
2. room hover exposes the empty-room click target;
3. two explicitly selected furniture items paste around the latest Canvas pointer and preserve spacing;
4. room + explicitly selected furniture pastes atomically as one rigid group;
5. furniture inside the room but not explicitly selected is not copied;
6. rejected unsupported Copy shows a reason and cannot paste stale previous content;
7. one Undo removes the complete composite Paste and one Redo restores it.

Do not create `docs/milestones/m8-2-acceptance.md`, mark PR #87 Ready, close #56, or merge until the required product-owner retest passes and the resulting accepted documentation head receives fresh exact-head CI/browser verification. Protected merge remains separately authorized.