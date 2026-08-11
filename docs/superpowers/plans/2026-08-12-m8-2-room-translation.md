# M8.2 Room Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add topology-safe direct room dragging, atomic room + explicitly selected furniture dragging, and the explicit `Выбрать мебель в комнате` selection helper without introducing persistent room ownership.

**Architecture:** Derived room geometry remains owned by `@vlezet/geometry`; `@vlezet/editor-core` resolves whether a derived room has an independently movable structural closure and validates exact rigid translation through the existing structural validator. The web store extends the existing structural gesture/history authority to coordinate room structure plus explicitly selected furniture as one atomic transaction. Canvas handles pointer intent, snapping and projection only. The helper command expands selection using a reusable full-footprint containment predicate and never mutates the document/history.

**Tech Stack:** TypeScript 6, Vitest 4, Zustand 5, React 19, Konva 10, Next.js 16, Playwright Chromium/WebKit, pnpm 11/Turbo.

## Global Constraints

- `VlezetDocument` remains the sole persistent source of truth; no room container/ownership schema is added.
- Rooms remain derived from topology; room IDs are derived face IDs.
- Furniture moves with a room only when it is explicitly selected.
- Furniture merely located inside a room never moves implicitly.
- `Выбрать мебель в комнате` changes selection only; it creates no document/history mutation.
- Automatic room-content selection uses the complete physical object footprint, not center-point containment.
- Room translation is rigid, exact and fail-closed; no silent split, detach, topology repair, opening re-host or safe-nearby relocation.
- Existing structural snapping, global `Привязки`, and gesture-local Alt/Option suppression apply to room drag.
- Higher-priority pointer targets — furniture, openings, walls, vertex/junction handles and editor controls — must win over room-interior drag.
- A valid room/composite drag produces exactly one semantic history operation; preview/cancel/reject/no-op produces none.
- Existing topology/opening validators are not weakened or bypassed.
- M2 furniture fit/collision semantics are preserved; this correction does not introduce a second furniture-validation authority.
- No recognition behavior or persistent schema changes.
- PR #87 remains Draft and unmerged until exact-head automated gates and product-owner room-translation acceptance are complete.

---

## File map

### Editor-core structural authority
- Modify: `packages/editor-core/src/structural-editing.ts`
- Modify: `packages/editor-core/src/index.ts`
- Modify: `packages/editor-core/src/commands.ts`
- Create: `packages/editor-core/src/structural-room-translation.test.ts`

Responsibilities: resolve an independently movable room structural closure, translate it rigidly, translate room annotations attached to that room, validate candidate topology/openings, and expose affected wall/vertex IDs for web gesture coordination.

### Geometry containment authority
- Modify: `packages/geometry/src/polygon.ts`
- Modify: `packages/geometry/src/polygon.test.ts` if present; otherwise create `packages/geometry/src/polygon-containment.test.ts`

Responsibilities: boundary-inclusive polygon containment for a subject polygon, including rejection when a subject edge crosses outside a concave container.

### Web selection helper / capabilities
- Create: `apps/web/components/editor/room-furniture-selection.ts`
- Create: `apps/web/components/editor/room-furniture-selection.test.ts`
- Modify: `apps/web/components/editor/editor-selection-capabilities.ts`
- Modify: `apps/web/components/editor/editor-selection-capabilities.test.ts`
- Modify: `apps/web/components/editor/editor-commands.ts`
- Modify relevant command contract test beside `editor-commands.ts`.

Responsibilities: expand exactly one selected room with fully-contained furniture; advertise room/composite move and helper command availability from one capability authority.

### Web transaction/store authority
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Create: `apps/web/components/editor/use-editor-store-room-translation.test.ts`

Responsibilities: begin/preview/commit/cancel room structural gesture, capture explicit furniture IDs from selection, apply exact same delta to those objects, commit atomically through one history operation, reject stale/invalid gestures without partial mutation.

### UI routing / Canvas
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/apartment-editor-command-routing.test.ts`
- Modify: `apps/web/components/editor/editor-context-menu.tsx`
- Modify: `apps/web/components/editor/editor-context-menu.test.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Create: `apps/web/components/editor/editor-canvas-room-translation-source.test.ts`

Responsibilities: expose `Выбрать мебель в комнате`; start room drag only from selected free interior; preserve higher-priority hits; reuse structural snapping; render composite preview from store authority.

### Browser acceptance
- Create: `tools/m7-browser-audit/m8-room-translation.spec.mjs`
- Modify: `tools/m7-browser-audit/playwright.config.mjs`
- Modify: `tools/m7-browser-audit/playwright.webkit.config.mjs`

Responsibilities: real Chromium/WebKit proof of room-only drag, explicit furniture group drag, helper command, rejection, hit priority and Undo/Redo.

### Truth sync
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md`
- Update mutable PR #87 / issue #56 metadata after exact-head gates.

---

## Task 1: Pure topology-safe room translation authority

**Files:**
- Modify: `packages/editor-core/src/structural-editing.ts`
- Modify: `packages/editor-core/src/index.ts`
- Create: `packages/editor-core/src/structural-room-translation.test.ts`

**Interfaces:**

Produces:

```ts
export type StructuralRoomTranslationClosure = Readonly<{
  roomId: string;
  vertexIds: readonly string[];
  wallIds: readonly string[];
  annotationIds: readonly string[];
}>;

export type StructuralRoomClosureResult =
  | Readonly<{ ok: true; closure: StructuralRoomTranslationClosure }>
  | Readonly<{ ok: false; reason: string }>;

export function resolveStructuralRoomTranslationClosure(
  document: VlezetDocument,
  roomId: string,
): StructuralRoomClosureResult;

export function evaluateStructuralRoomTranslation(
  document: VlezetDocument,
  roomId: string,
  delta: Point2,
): StructuralTransactionResult;
```

Closure rules:
- find derived room and corresponding `PlanarFace` by ID;
- every face atomic edge must represent a complete backing wall, not only a split/junction interval;
- a selected boundary wall must not also bound another bounded face;
- no wall outside the room closure may reference a closure vertex as endpoint or junction;
- the returned IDs follow document order for deterministic tests/runtime;
- annotations whose anchors lie in/on the selected room polygon are part of the moved room metadata.

- [ ] **Step 1: Write editor-core RED tests for isolated translation**

Create fixtures with a rectangular isolated room, one hosted opening, one room annotation and one unrelated remote wall. Assert exact delta, unchanged wall thickness/length/opening offsets, translated annotation, unchanged unrelated structure and immutable source.

```ts
const result = evaluateStructuralRoomTranslation(document, room.id, { x: 750, y: -250 });
expect(result.ok).toBe(true);
if (!result.ok) throw new Error(result.reason);
expect(result.affectedVertexIds).toEqual(["v1", "v2", "v3", "v4"]);
expect(position(result.document, "v1")).toEqual({ x: 750, y: -250 });
expect(result.document.openings[0]).toEqual(document.openings[0]);
expect(annotation(result.document).anchor).toEqual({ x: originalAnchor.x + 750, y: originalAnchor.y - 250 });
expect(remoteWallGeometry(result.document)).toEqual(remoteWallGeometry(document));
expect(document).toEqual(beforeSnapshot);
```

- [ ] **Step 2: Write RED tests for fail-closed closure rules**

Cover adjacent rooms sharing a wall, an external wall attached to a room corner, and a face edge backed by a wall with an internal junction. Each must reject before mutation with no accepted candidate/history concern.

```ts
const closure = resolveStructuralRoomTranslationClosure(adjacentRooms, leftRoom.id);
expect(closure.ok).toBe(false);
expect(closure.ok ? "" : closure.reason).toMatch(/сосед|связан|общ/i);
```

- [ ] **Step 3: Write RED tests for zero delta and missing room**

Zero delta must return the original document reference or an exactly equal no-op document without changing geometry. Unknown room ID rejects with `invalid-input` semantics.

- [ ] **Step 4: Run focused editor-core tests and capture genuine RED**

Run:

```bash
pnpm --filter @vlezet/editor-core test -- structural-room-translation.test.ts
```

Expected: FAIL because the new exported functions/types do not exist.

- [ ] **Step 5: Implement deterministic closure resolution**

Use `deriveRooms(document)` + `extractPlanarFaces(document)` from geometry. For each selected face edge verify the backing wall endpoints match that atomic edge in either orientation and reject backing walls with split/junction participation. Count boundary-wall appearances across bounded faces and reject a wall used by another room. Reject external wall references to closure vertices.

Do not clone/copy walls as clipboard code does; the evaluator must mutate only existing closure vertices.

- [ ] **Step 6: Implement rigid room candidate translation**

Translate only closure vertices by exact `delta`. Move closure annotations by the same delta. Preserve walls/openings themselves unchanged. Call the existing `validateStructuralCandidate(before, candidate, context)` with closure vertex/wall IDs and preserve all boundary-wall directions.

- [ ] **Step 7: Export the new authority and run focused GREEN**

Run:

```bash
pnpm --filter @vlezet/editor-core test -- structural-room-translation.test.ts
pnpm --filter @vlezet/editor-core typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1 GREEN**

Commit message:

```text
feat: add topology-safe room translation authority
```

---

## Task 2: Full-footprint room containment and explicit selection helper

**Files:**
- Modify: `packages/geometry/src/polygon.ts`
- Test: `packages/geometry/src/polygon.test.ts` or create `packages/geometry/src/polygon-containment.test.ts`
- Create: `apps/web/components/editor/room-furniture-selection.ts`
- Create: `apps/web/components/editor/room-furniture-selection.test.ts`

**Interfaces:**

Produces in geometry:

```ts
export function polygonContainsPolygonInclusive(
  container: readonly Point2[],
  subject: readonly Point2[],
  epsilon?: number,
): boolean;
```

Produces in web:

```ts
export function selectFurnitureInSelectedRoom(
  document: VlezetDocument,
  selection: EditorSelection,
): EditorSelection;
```

The web helper accepts exactly one room plus zero or more already-selected placed objects and no other structural/entity kind. It keeps the room selected and adds every fully-contained placed object in document order.

- [ ] **Step 1: Write geometry RED for concave-safe polygon containment**

Test: fully inside true; boundary-touch true; partially outside false; and a subject whose corners are individually inside a concave polygon but one edge crosses the concave cut-out must be false.

```ts
expect(polygonContainsPolygonInclusive(concaveRoom, crossingRectangle)).toBe(false);
```

The implementation must therefore do more than `subject.every(pointInPolygon)`; it must also reject proper boundary crossings while allowing collinear/boundary touching within epsilon.

- [ ] **Step 2: Run geometry RED**

Run:

```bash
pnpm --filter @vlezet/geometry test -- polygon-containment
```

If the package test runner uses file discovery rather than substring filtering, run `pnpm --filter @vlezet/geometry test` and confirm only the new assertions fail.

- [ ] **Step 3: Implement `polygonContainsPolygonInclusive` minimally**

Reuse boundary-inclusive `pointInPolygon`. Add a focused proper-segment-crossing predicate inside `polygon.ts` using epsilon-aware orientation. Boundary contact and collinear overlap are allowed; a proper crossing between a subject edge and container edge rejects containment.

- [ ] **Step 4: Write web RED for `selectFurnitureInSelectedRoom`**

Construct a derived room with:
- one furniture footprint fully inside;
- one touching the boundary but still inside;
- one crossing the boundary;
- one outside/in another room.

Assert only the first two are added, existing explicit furniture remains, ordering is deterministic, and document/history are not involved.

- [ ] **Step 5: Run web helper RED**

Run:

```bash
pnpm --filter web test -- room-furniture-selection.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 6: Implement selection helper**

Derive the selected room via `deriveRooms(document)`. For each placed object build its physical rectangle using `objectRectangle` + `orientedRectangleCorners`, then call `polygonContainsPolygonInclusive(room.polygon, footprint)`. Expand with `addToSelection`; never create ownership metadata.

- [ ] **Step 7: Run Task 2 GREEN**

Run:

```bash
pnpm --filter @vlezet/geometry test
pnpm --filter web test -- room-furniture-selection.test.ts
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2 GREEN**

Commit message:

```text
feat: add explicit room furniture selection helper
```

---

## Task 3: Atomic store room/composite structural gesture

**Files:**
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Create: `apps/web/components/editor/use-editor-store-room-translation.test.ts`
- Modify: `packages/editor-core/src/commands.ts`

**Interfaces:**

Extend structural gesture with:

```ts
Readonly<{
  kind: "translate-room";
  entityId: string;
  before: VlezetDocument;
  previewDocument: VlezetDocument;
  valid: boolean;
  reason: string | null;
  changed: boolean;
  movedVertexIds: readonly string[];
  movedWallIds: readonly string[];
  placedObjectIds: readonly string[];
  delta: Point2;
}>
```

Add store methods:

```ts
beginStructuralRoomGesture(roomId: string): void;
previewStructuralRoomGesture(delta: Point2): void;
selectFurnitureInSelectedRoom(): void;
```

`commitStructuralGesture` remains the single commit path and gains the semantic label `room/translate` for `translate-room`.

- [ ] **Step 1: Write store RED for room-only gesture**

Assert begin captures one selected room, preview translates the structural closure only, unselected interior furniture remains coordinate-identical, and commit adds one history command.

- [ ] **Step 2: Write store RED for room + explicitly selected furniture**

Select one room plus two objects, leave a third object inside unselected. Assert preview/commit applies exactly the same delta to room and the two explicit objects while the third does not move.

```ts
store.previewStructuralRoomGesture({ x: 900, y: 300 });
expect(objectPosition(preview, "selected-a")).toEqual(add(beforeA, { x: 900, y: 300 }));
expect(objectPosition(preview, "unselected-c")).toEqual(beforeC);
```

- [ ] **Step 3: Write store RED for atomic rejection/cancel/history**

Cover unsafe shared topology, invalid candidate, zero delta, cancel, one Undo/Redo, and concurrent `history.document !== gesture.before`. On every rejection/cancel, explicit furniture and structure remain unchanged and history length does not grow.

- [ ] **Step 4: Write store RED for helper selection command**

`selectFurnitureInSelectedRoom()` changes only `selection`, leaves `history` and document identity unchanged, and is a no-op when the selection does not contain exactly one eligible room root.

- [ ] **Step 5: Run focused RED**

Run:

```bash
pnpm --filter web test -- use-editor-store-room-translation.test.ts
```

Expected: FAIL on missing room gesture/helper behavior.

- [ ] **Step 6: Implement `beginStructuralRoomGesture`**

Validate the current selection is one room plus optional placed objects only. Call `resolveStructuralRoomTranslationClosure`. Capture explicit placed-object IDs, closure IDs, immutable `before`, and preserve current selection. Do not replace a mixed room+furniture selection with room-only selection.

- [ ] **Step 7: Implement room preview atomically**

Call `evaluateStructuralRoomTranslation(gesture.before, roomId, delta)`. If rejected, keep an invalid preview state/reason and never move furniture. If accepted, translate only captured explicit placed objects by the exact same delta using the existing placed-object translation primitive/current furniture movement semantics, then store one complete `previewDocument`.

The preview document itself must contain both structural and explicit furniture preview positions so Canvas has one projection source.

- [ ] **Step 8: Extend commit/cancel and semantic command label**

Register `room/translate` in the editor-core command-label union. A valid changed room gesture commits `previewDocument` through exactly one `document/replace`; stale document, zero movement, invalid preview and cancel create no history entry.

- [ ] **Step 9: Implement `selectFurnitureInSelectedRoom()` store routing**

Call the Task 2 pure helper and `store.setState({ selection: nextSelection })` only. Never alter history/document.

- [ ] **Step 10: Run Task 3 GREEN and surrounding store regressions**

Run:

```bash
pnpm --filter web test -- use-editor-store-room-translation.test.ts
pnpm --filter web test -- use-editor-store-composite-paste.test.ts use-editor-store-composite-clipboard.test.ts use-editor-store-clipboard.test.ts
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 11: Commit Task 3 GREEN**

Commit message:

```text
feat: add atomic room translation gesture
```

---

## Task 4: Shared capabilities and `Выбрать мебель в комнате` command

**Files:**
- Modify: `apps/web/components/editor/editor-selection-capabilities.ts`
- Modify: `apps/web/components/editor/editor-selection-capabilities.test.ts`
- Modify: `apps/web/components/editor/editor-commands.ts`
- Modify command registry test adjacent to `editor-commands.ts`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/apartment-editor-command-routing.test.ts`
- Modify: `apps/web/components/editor/editor-context-menu.tsx`
- Modify: `apps/web/components/editor/editor-context-menu.test.tsx`

**Interfaces:**

Extend `SelectionCapabilities` with:

```ts
selectFurnitureInRoom: SelectionCapability;
```

Add command ID:

```ts
"selection.select-furniture-in-room"
```

Display label:

```text
Выбрать мебель в комнате
```

- [ ] **Step 1: Write capability RED**

Assert `move.enabled === true` for:
- one independently movable room;
- one independently movable room + placed objects.

Assert move stays disabled for room + wall, multiple rooms, and unsafe room closure. Assert `selectFurnitureInRoom` is enabled for exactly one room root with optional placed objects, disabled otherwise.

- [ ] **Step 2: Write command/UI routing RED**

Assert command registry contains `selection.select-furniture-in-room`; `ApartmentEditor` routes it to `editorStore.getState().selectFurnitureInSelectedRoom()` through capability authority; context menu exposes the label only in eligible room selection context.

- [ ] **Step 3: Run RED**

Run:

```bash
pnpm --filter web test -- editor-selection-capabilities.test.ts apartment-editor-command-routing.test.ts editor-context-menu.test.tsx
```

Expected: FAIL only on new room-move/helper contracts.

- [ ] **Step 4: Implement capability derivation**

Use `resolveStructuralRoomTranslationClosure(document, roomId)` to distinguish structurally movable from unsafe room selection without guessing in UI. Do not enable other mixed destructive commands; room+furniture still receives only the operations explicitly supported by this slice.

- [ ] **Step 5: Add command registry/routing/context action**

Keep the helper command selection-only and non-modal. Use the same command executor as other selection actions; no direct component mutation of document/history.

- [ ] **Step 6: Run Task 4 GREEN**

Run:

```bash
pnpm --filter web test -- editor-selection-capabilities.test.ts apartment-editor-command-routing.test.ts editor-context-menu.test.tsx
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4 GREEN**

Commit message:

```text
feat: expose room move and furniture selection command
```

---

## Task 5: Direct room-interior drag routing and preview

**Files:**
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Create: `apps/web/components/editor/editor-canvas-room-translation-source.test.ts`
- Modify existing Canvas feedback/source tests only where the approved contract changes their expectations.

**Interfaces:**

Extend Canvas-local pointer gesture:

```ts
Readonly<{
  kind: "translate-room";
  roomId: string;
  pointerStartWorld: Point2;
  snapAnchorStartWorld: Point2;
  movedVertexIds: ReadonlySet<string>;
  movedWallIds: ReadonlySet<string>;
}>
```

The snap anchor is the pointer-down world point in the selected room interior. It is not persisted and is not a room-owned coordinate.

- [ ] **Step 1: Write Canvas routing RED**

Source/behavior contract must prove:
- selected-room free interior can start `beginStructuralRoomGesture`;
- a higher-priority Konva entity prevents room drag start;
- room gesture preserves mixed room+furniture selection;
- preview routes raw/snap-adjusted exact delta to `previewStructuralRoomGesture`;
- existing `finishStructuralPointerGesture`/cancel path handles room gesture;
- no clipboard `safe-nearby` placement function is called.

- [ ] **Step 2: Run focused RED**

Run:

```bash
pnpm --filter web test -- editor-canvas-room-translation-source.test.ts
```

Expected: FAIL because room pointer gesture is not routed.

- [ ] **Step 3: Start room gesture from Stage pointer-down only for free selected interior**

On select-mode primary pointer-down:
1. preserve pan/recognition/placement/structural-handle guards;
2. query current Konva intersection and resolve `canvasEntityFromKonvaNode`;
3. if a higher-priority concrete entity exists, do not claim the room gesture;
4. convert pointer to world;
5. use `entitiesAtPoint` and current selection to verify the hit is the selected room;
6. obtain current closure/moved IDs from store gesture after `beginStructuralRoomGesture`;
7. store pointer start and snap-exclusion IDs in Canvas transient pointer gesture.

If no room gesture starts, existing marquee/click behavior continues unchanged.

- [ ] **Step 4: Preview with existing structural snap authority**

Resolve snapping for the transient room snap anchor using the global toggle and event Alt/Option state. Exclude all moved room closure vertices/walls so the room does not snap to itself. Compute `delta = snappedAnchor - snapAnchorStartWorld` and pass exactly that delta to store preview. Never search an alternative valid location.

- [ ] **Step 5: Render one complete preview document**

When a structural room gesture is active, use `structuralGesture.previewDocument.placedObjects` as the base displayed-object collection so explicitly selected furniture previews with the room. Existing independent object gesture preview remains layered only when applicable.

- [ ] **Step 6: Keep feedback/hit priority coherent**

Use existing valid/invalid structural preview treatment and rejection reason. Furniture/opening/wall/handle mouse-down remains higher priority. Selected room interior uses current hover/selectable affordance; no new modal/overlay is introduced.

- [ ] **Step 7: Run Canvas/store GREEN and regressions**

Run:

```bash
pnpm --filter web test -- editor-canvas-room-translation-source.test.ts editor-canvas-room-hover-source.test.ts editor-selection-room-hit.test.ts use-editor-store-room-translation.test.ts
pnpm --filter web test
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5 GREEN**

Commit message:

```text
feat: support direct selected room dragging
```

---

## Task 6: Real Chromium/WebKit room-translation acceptance

**Files:**
- Create: `tools/m7-browser-audit/m8-room-translation.spec.mjs`
- Modify: `tools/m7-browser-audit/playwright.config.mjs`
- Modify: `tools/m7-browser-audit/playwright.webkit.config.mjs`

**Interfaces:**

No production interface. This task is the user-interaction proof layer.

- [ ] **Step 1: Add browser RED before considering the feature complete**

Build only validator-clean fixtures using endpoint-to-endpoint walls/semantic snaps already proven by the M8.2 harness. Add Chromium scenarios:
1. room-only direct interior drag to requested position;
2. unselected furniture inside room remains stationary;
3. room + two explicitly selected furniture items move rigidly by the same delta;
4. helper `Выбрать мебель в комнате` expands selection, then room drag moves those selected contents;
5. furniture hit wins over room drag;
6. unsafe adjacent/shared room translation rejects and commits nothing;
7. one Undo/Redo removes/restores full composite move;
8. `Привязки` and Alt/Option suppression are consistent.

Representative WebKit minimum: room-only, room+explicit furniture, furniture-hit priority, unsafe rejection, Undo/Redo.

- [ ] **Step 2: Register spec in both browser configs and run Browser Acceptance**

Use the repository Browser Acceptance workflow on the exact RED head. Expected before any necessary interaction fixes: new scenarios may FAIL while pre-existing browser suite remains green. Record the exact run and failure location as RED evidence.

- [ ] **Step 3: Diagnose any browser RED systematically**

Classify each failure as fixture/harness vs production behavior. Never weaken structural validation to make a fixture pass. Fix production only when the failing browser trace demonstrates a real contract violation.

- [ ] **Step 4: Re-run exact-head Chromium then WebKit to GREEN**

Expected: all existing M8 browser scenarios plus new room-translation scenarios PASS in Chromium; representative WebKit PASS on the same commit.

- [ ] **Step 5: Commit any final harness/interaction corrections**

Use focused commit messages such as:

```text
test: cover M8.2 room translation acceptance
```

or, for a genuine production correction:

```text
fix: preserve room translation interaction contract
```

---

## Task 7: Full exact-head verification and truth sync

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md`
- Mutable metadata: PR #87 and issue #56.

- [ ] **Step 1: Run deterministic implementation-head gates**

Require on one exact implementation head:

```bash
pnpm test
pnpm benchmark:recognition:core
pnpm typecheck
pnpm lint
pnpm build
```

GitHub Actions must report all equivalent required jobs PASS.

- [ ] **Step 2: Require exact-head Browser Acceptance GREEN**

Chromium and representative WebKit must both PASS on that same implementation head. Record workflow run IDs, artifact ID/digest and exact SHA.

- [ ] **Step 3: Scope/review audit**

Compare the implementation head to the pre-room-translation spec head. Confirm changes are limited to M8.2 room movement/selection/browser/docs concerns; no persistent schema or recognition behavior changed. Require zero unresolved review threads.

- [ ] **Step 4: Truth-sync canonical docs**

Record:
- prior composite clipboard retest PASS from product owner;
- new room-translation correction design/spec/plan heads;
- genuine RED/GREEN evidence;
- exact semantics: room-only vs explicit furniture; helper command; fail-closed shared topology; one history operation;
- status `AUTOMATED ROOM-TRANSLATION GREEN / PRODUCT-OWNER ROOM-TRANSLATION RETEST PENDING`.

Do not create `docs/milestones/m8-2-acceptance.md` yet.

- [ ] **Step 5: Re-run fresh exact-head gates after docs commits**

Because docs commits change the SHA, require fresh CI and Browser Acceptance on the final documentation head. Do not cite the earlier implementation-head run as final delivery evidence.

- [ ] **Step 6: Update PR #87 and issue #56 metadata without changing git head**

Record final exact SHA, CI run, Browser run, artifact/digest, review-thread count and focused manual retest instructions. Keep PR Draft and issue open.

- [ ] **Step 7: Product-owner focused retest gate**

Ask the product owner to verify:
1. room-only drag moves the room but not unselected furniture;
2. room + explicitly selected furniture moves rigidly together;
3. helper selects only fully-contained furniture;
4. partially crossing furniture is not implicitly selected;
5. furniture drag still wins over room drag;
6. unsafe shared topology rejects without partial movement;
7. one Undo/Redo reverses/restores a complete composite move;
8. snapping/Alt behavior is predictable.

Only an explicit PASS may unblock M8.2 acceptance documentation and a fresh accepted-head gate. Protected squash merge remains a separate authorization step.

---

## Plan self-review

### Spec coverage

- Direct selected-room drag: Tasks 1, 3, 5, 6.
- Explicit furniture only: Tasks 2, 3, 6.
- `Выбрать мебель в комнате`: Tasks 2, 3, 4, 6.
- Full-footprint containment: Task 2.
- Higher-priority hit behavior: Tasks 5, 6.
- Fail-closed shared topology: Tasks 1, 3, 6.
- No safe-nearby drag: Tasks 1, 5, 6.
- Existing snapping/Alt: Tasks 5, 6.
- Atomic preview/commit/Undo/Redo: Tasks 3, 6.
- No persistent ownership/schema/recognition changes: Global Constraints + Task 7 audit.
- Product-owner gate before acceptance/merge: Task 7.

### Placeholder scan

No `TBD`, `TODO`, deferred implementation placeholders or unspecified validation steps remain. Every new interface used by a later task is defined in an earlier task.

### Type/interface consistency

- Editor-core exposes closure + evaluator in Task 1; capability/store/Canvas consume those names in Tasks 3–5.
- Geometry exposes `polygonContainsPolygonInclusive`; web selection helper consumes it in Task 2.
- Store exposes `beginStructuralRoomGesture`, `previewStructuralRoomGesture`, `selectFurnitureInSelectedRoom`; Canvas/command routing consume those exact names in Tasks 4–5.
- The only new semantic history label is `room/translate`; no second history owner is introduced.
