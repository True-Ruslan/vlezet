# M8.2 Direct Manipulation and Hosted-Opening Drag Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining M8.2 direct-manipulation acceptance gap by making an explicit `room + furniture` selection draggable from any already-selected furniture body, adding fail-closed door/window movement along the current host wall, and making compact room labels deterministic and readable.

**Architecture:** Keep `VlezetDocument` and the existing editor-core/store/history authorities unchanged. Add one pure web-layer pointer-intent arbiter, one focused editor-core hosted-opening evaluator that reuses existing wall projection and `validateOpening()`, extend the existing structural gesture transaction instead of creating a second history path, and isolate room-label layout in a pure screen-space helper. Canvas remains pointer/projection coordination only.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Konva/react-konva, Zustand 5, Vitest, pnpm/Turbo, Playwright Chromium + representative WebKit.

## Global Constraints

- Current implementation branch: `feat/m8-2-precision-structural-editing`; PR #87 remains Draft until explicit product-owner PASS.
- Approved design: `docs/superpowers/specs/2026-08-12-m8-2-direct-manipulation-opening-drag-correction-design.md`.
- `VlezetDocument` remains the only persistent geometry/layout truth; no schema migration.
- Rooms remain derived and never own furniture implicitly.
- A supported room composite is exactly one room plus zero or more placed objects and no other structural roots.
- Dragging free selected-room interior or the ordinary body of an already-selected furniture member starts the same room-composite movement.
- Dragging an unselected furniture object does not silently move/join the room composite.
- Specialized object transform handles, openings, and structural handles outrank generic room-composite movement.
- Door and window ordinary drag preserve `wallId`; no silent re-hosting.
- Opening movement uses the current host wall only, clamps to its physical span, and validates overlap/junction constraints fail-closed.
- No clipboard-style nearby search is allowed for room or opening drag.
- One accepted gesture produces one semantic history entry; reject/no-op/cancel/stale produces none.
- M2 fit/collision/door/clearance authority and recognition behavior stay unchanged.
- External/open-source references are behavioral/architectural inputs only; no third-party source is copied in this slice.

## File Structure

New focused files:

- `apps/web/components/editor/editor-pointer-gesture-intent.ts` — pure semantic pointer-owner arbitration for selected composites/direct hits.
- `apps/web/components/editor/editor-pointer-gesture-intent.test.ts` — exact priority/membership contract.
- `packages/editor-core/src/hosted-opening-move.ts` — pure door/window current-host movement evaluator.
- `packages/editor-core/src/hosted-opening-move.test.ts` — horizontal/vertical/angled/clamp/conflict/no-mutation contract.
- `apps/web/components/editor/use-editor-store-opening-gesture.test.ts` — structural gesture/history contract for openings.
- `apps/web/components/editor/editor-canvas-direct-manipulation-source.test.ts` — narrow wiring contract for Canvas/PlacedObjectShape before browser acceptance.
- `apps/web/components/editor/room-canvas-label-layout.ts` — deterministic screen-space label tier/layout authority.
- `apps/web/components/editor/room-canvas-label-layout.test.ts` — non-overlap/degradation contract.
- `tools/m7-browser-audit/m8-direct-manipulation-opening.spec.mjs` — real pointer/browser acceptance.
- `docs/changelog/2026-08-12-m8-2-direct-manipulation-opening-drag-correction.md` — focused delivery record written only after implementation evidence exists.

Existing files to modify:

- `apps/web/components/editor/placed-object-shape.tsx` — delegate an explicitly selected mixed-group ordinary body to room-composite movement instead of starting its own Konva object drag.
- `apps/web/components/editor/editor-canvas.tsx` — consume pointer intent, start one semantic gesture, route opening body drag, render label layout.
- `apps/web/components/editor/use-editor-store.ts` — extend existing `StructuralGesture` with hosted-opening movement and keep one transaction/history path.
- `packages/editor-core/src/index.ts` — export hosted-opening evaluator/types.
- `packages/editor-core/src/commands.ts` — register semantic `opening/move-host` label.
- `apps/web/components/editor/dimension-annotations.ts` — expose room-label content parts without changing canonical formatting facts.
- `tools/m7-browser-audit/playwright.config.mjs` and `tools/m7-browser-audit/playwright.webkit.config.mjs` — include the new acceptance spec.
- `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/product/UX_ROADMAP.md`, `docs/CHANGELOG.md` — final truth sync only after exact-head GREEN.

## Preflight

Before production changes, verify PR #87 still points at the plan commit and run the ordinary exact-head CI. Since the spec/plan/research commits are documentation-only over previously tested runtime code, any baseline runtime failure is a blocker and must be diagnosed before starting RED work.

---

### Task 1: Pure Selection-Aware Pointer Gesture Arbiter

**Files:**
- Create: `apps/web/components/editor/editor-pointer-gesture-intent.ts`
- Create: `apps/web/components/editor/editor-pointer-gesture-intent.test.ts`

**Interfaces:**
- Consumes: sanitized `EditorSelection` from `./editor-selection` and a semantic direct-hit descriptor.
- Produces:

```ts
export type EditorPointerDirectHit =
  | Readonly<{ kind: "room-interior"; roomId: string }>
  | Readonly<{ kind: "placed-object-body"; objectId: string }>
  | Readonly<{ kind: "opening-body"; openingId: string }>
  | Readonly<{ kind: "object-transform-handle"; objectId: string }>
  | Readonly<{ kind: "structural-control"; entityId: string }>
  | Readonly<{ kind: "none" }>;

export type EditorPointerGestureIntent =
  | Readonly<{ kind: "room-composite-move"; roomId: string; objectIds: readonly string[] }>
  | Readonly<{ kind: "opening-host-move"; openingId: string }>
  | Readonly<{ kind: "placed-object-move"; objectId: string }>
  | Readonly<{ kind: "specialized-control" }>
  | Readonly<{ kind: "none" }>;

export function resolveEditorPointerGestureIntent(
  selection: EditorSelection,
  hit: EditorPointerDirectHit,
): EditorPointerGestureIntent;
```

- [ ] **Step 1: Write the failing arbiter tests**

Cover the exact approved matrix:

```ts
const roomAndObjects: EditorSelection = {
  refs: [
    { kind: "room", id: "room-a" },
    { kind: "placed-object", id: "sofa" },
    { kind: "placed-object", id: "table" },
  ],
  primary: { kind: "placed-object", id: "sofa" },
};

expect(resolveEditorPointerGestureIntent(roomAndObjects, {
  kind: "placed-object-body",
  objectId: "sofa",
})).toEqual({
  kind: "room-composite-move",
  roomId: "room-a",
  objectIds: ["sofa", "table"],
});

expect(resolveEditorPointerGestureIntent(roomAndObjects, {
  kind: "placed-object-body",
  objectId: "chair-unselected",
})).toEqual({ kind: "placed-object-move", objectId: "chair-unselected" });

expect(resolveEditorPointerGestureIntent(roomAndObjects, {
  kind: "opening-body",
  openingId: "door-a",
})).toEqual({ kind: "opening-host-move", openingId: "door-a" });

expect(resolveEditorPointerGestureIntent(roomAndObjects, {
  kind: "object-transform-handle",
  objectId: "sofa",
})).toEqual({ kind: "specialized-control" });
```

Also assert free selected-room interior → room composite, structural control → specialized control, and unsupported `room + wall` → no room-composite intent.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter web test -- editor-pointer-gesture-intent.test.ts
```

Expected: FAIL because `editor-pointer-gesture-intent.ts` / `resolveEditorPointerGestureIntent` does not exist.

- [ ] **Step 3: Implement the minimal pure arbiter**

Implementation rules:

```ts
const roomRefs = selection.refs.filter((ref) => ref.kind === "room");
const objectRefs = selection.refs.filter((ref) => ref.kind === "placed-object");
const roomComposite =
  roomRefs.length === 1 &&
  selection.refs.every((ref) => ref.kind === "room" || ref.kind === "placed-object");
```

Opening and specialized-control intents are resolved before the room-composite branch. A placed-object body becomes `room-composite-move` only when that exact object is already in the valid composite selection. Preserve object IDs in selection order.

- [ ] **Step 4: Run focused GREEN**

```bash
pnpm --filter web test -- editor-pointer-gesture-intent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/editor-pointer-gesture-intent.ts apps/web/components/editor/editor-pointer-gesture-intent.test.ts
git commit -m "feat(editor): arbitrate direct manipulation gestures"
```

---

### Task 2: Route Selected Furniture Body to the Existing Room Composite Gesture

**Files:**
- Modify: `apps/web/components/editor/placed-object-shape.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Create: `apps/web/components/editor/editor-canvas-direct-manipulation-source.test.ts`
- Test: `apps/web/components/editor/use-editor-store-room-translation.test.ts`

**Interfaces:**
- Consumes: `resolveEditorPointerGestureIntent()` from Task 1 and existing `beginStructuralRoomGesture(roomId)` / `previewStructuralRoomGesture(delta)` store methods.
- Produces: selected-object-body and free-room-interior paths both start the existing `translate-room` gesture; no new document mutation semantics.

Add these presentation props to `PlacedObjectShape`:

```ts
moveGestureOwner?: "object" | "room-composite";
onRoomCompositePointerDown?: (event: KonvaEventObject<MouseEvent | TouchEvent>) => void;
```

- [ ] **Step 1: Write the focused RED**

Extend store regression to prove starting point is irrelevant at transaction level, then add a source/wiring test that requires:

```ts
expect(source).toContain('moveGestureOwner={moveIntent.kind === "room-composite-move" ? "room-composite" : "object"}');
expect(source).toContain("onRoomCompositePointerDown");
expect(shapeSource).toContain('draggable={!preview && moveGestureOwner !== "room-composite"}');
```

The store regression must compare preview documents produced by the same room/object selection and same delta, independent of which body initiated the gesture.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter web test -- editor-canvas-direct-manipulation-source.test.ts use-editor-store-room-translation.test.ts
```

Expected: new wiring assertions FAIL because selected furniture still owns its Konva drag.

- [ ] **Step 3: Refactor Canvas room-gesture start without changing evaluator semantics**

Extract the current begin logic into a function that takes already-resolved semantic intent instead of re-deriving ownership from Konva hit order:

```ts
const beginResolvedRoomCompositeGesture = (
  roomId: string,
  pointer: Point2,
  event: KonvaEventObject<MouseEvent | TouchEvent>,
): boolean => { /* existing beginStructuralRoomGesture store + pointer-ref setup */ };
```

Free-room Stage pointer-down calls the arbiter with `{ kind: "room-interior", roomId }`. Each placed object computes the arbiter result with `{ kind: "placed-object-body", objectId }`.

- [ ] **Step 4: Make `PlacedObjectShape` delegation deterministic**

When `moveGestureOwner === "room-composite"` and no Shift/Cmd/Ctrl modifier is active:

- do not let the Konva Group start its own draggable object gesture;
- invoke `onRoomCompositePointerDown` on mouse/touch down;
- preserve current selection membership on the subsequent plain click;
- retain modifier-click behavior so the user can explicitly remove/add selection members;
- leave transform events on the existing object path.

When owner is `object`, preserve current M8.1 behavior byte-for-byte where possible.

- [ ] **Step 5: Run focused GREEN plus adjacent interaction tests**

```bash
pnpm --filter web test -- editor-pointer-gesture-intent.test.ts editor-canvas-direct-manipulation-source.test.ts use-editor-store-room-translation.test.ts editor-canvas-room-translation-source.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/editor/placed-object-shape.tsx apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/editor-canvas-direct-manipulation-source.test.ts apps/web/components/editor/use-editor-store-room-translation.test.ts
git commit -m "fix(editor): drag explicit room composite from selected furniture"
```

---

### Task 3: Editor-Core Hosted Opening Movement Evaluator

**Files:**
- Create: `packages/editor-core/src/hosted-opening-move.ts`
- Create: `packages/editor-core/src/hosted-opening-move.test.ts`
- Modify: `packages/editor-core/src/index.ts`

**Interfaces:**
- Consumes: `projectPointToWallOffset()` and `proposeOpeningPlacement()` from `@vlezet/geometry`; `validateOpening()` from existing opening editing.
- Produces:

```ts
export type HostedOpeningMoveResult =
  | Readonly<{
      ok: true;
      document: VlezetDocument;
      opening: Opening;
      changed: boolean;
    }>
  | Readonly<{
      ok: false;
      candidate: VlezetDocument | null;
      reason: string;
    }>;

export function evaluateHostedOpeningMove(
  document: VlezetDocument,
  openingId: string,
  pointerWorld: Point2,
): HostedOpeningMoveResult;
```

- [ ] **Step 1: Write RED evaluator tests**

Use deterministic fixtures for horizontal, vertical and angled host walls. Assert:

```ts
const result = evaluateHostedOpeningMove(document, "door-a", { x: 3_400, y: 700 });
expect(result.ok).toBe(true);
if (result.ok) {
  expect(result.opening.wallId).toBe("wall-a");
  expect(result.opening.kind).toBe("door");
  expect(result.opening.width).toBe(900);
  expect(result.opening.doorSwing).toEqual(sourceDoor.doorSwing);
}
```

Also require endpoint clamping with width accounted for, conflict with another opening → `ok:false` with candidate, zero movement → `changed:false`, missing opening/invalid host → fail closed, and source document deep-equal to its pre-call snapshot.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/editor-core test -- hosted-opening-move.test.ts
```

Expected: FAIL because evaluator/module does not exist.

- [ ] **Step 3: Implement the minimal evaluator**

Algorithm:

```ts
const current = document.openings.find((opening) => opening.id === openingId);
if (!current || !finite(pointerWorld)) return rejection(...);

const pointerOffset = projectPointToWallOffset(document, current.wallId, pointerWorld);
const placement = proposeOpeningPlacement(document, current.wallId, pointerOffset, current.width);
const next: Opening = { ...current, offset: placement.offset };
const candidate = {
  ...document,
  openings: document.openings.map((opening) => opening.id === openingId ? next : opening),
};

try {
  validateOpening(candidate, next, openingId);
} catch (error) {
  return { ok: false, candidate, reason: message(error) };
}

return {
  ok: true,
  document: candidate,
  opening: next,
  changed: Math.abs(next.offset - current.offset) > GEOMETRY_EPSILON_MM,
};
```

Do not alter `wallId`, width, kind, swing or unrelated fields. Do not search another wall or nearby collision-free offset.

- [ ] **Step 4: Run GREEN and opening regressions**

```bash
pnpm --filter @vlezet/editor-core test -- hosted-opening-move.test.ts opening-editing.test.ts structural-editing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/editor-core/src/hosted-opening-move.ts packages/editor-core/src/hosted-opening-move.test.ts packages/editor-core/src/index.ts
git commit -m "feat(editor-core): evaluate hosted opening movement"
```

---

### Task 4: One Structural Gesture/History Path for Door and Window Drag

**Files:**
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Create: `apps/web/components/editor/use-editor-store-opening-gesture.test.ts`
- Modify: `packages/editor-core/src/commands.ts`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/editor-canvas-direct-manipulation-source.test.ts`

**Interfaces:**
- Consumes: `evaluateHostedOpeningMove()` from Task 3.
- Produces store methods:

```ts
beginStructuralOpeningGesture(openingId: string): void;
previewStructuralOpeningGesture(pointerWorld: Point2): void;
```

Extend `StructuralGesture` with `kind: "translate-opening"` using the existing `before`, `previewDocument`, `valid`, `reason`, `changed` fields. Add `opening/move-host` to `EditorCommandLabel`.

- [ ] **Step 1: Write store RED tests**

Require:

- begin selects the opening and captures immutable `before`;
- preview follows current host-wall projection;
- pointer near another wall never changes `wallId`;
- invalid overlap retains invalid candidate/reason;
- invalid mouseup path can cancel with no history;
- valid commit emits one `opening/move-host` command;
- Undo/Redo restores exact offsets;
- stale document identity rejects on commit;
- zero movement adds no history.

- [ ] **Step 2: Run store RED**

```bash
pnpm --filter web test -- use-editor-store-opening-gesture.test.ts
```

Expected: FAIL because opening structural gesture methods/kind do not exist.

- [ ] **Step 3: Implement store GREEN**

Reuse the existing structural transaction lifecycle. `previewStructuralOpeningGesture(pointerWorld)` calls the evaluator against `gesture.before`; `commitStructuralGesture()` maps `translate-opening` to `opening/move-host`. Do not introduce a second history stack.

- [ ] **Step 4: Write Canvas wiring RED before changing opening rendering**

Update the focused source test to require:

```ts
expect(source).toContain("beginStructuralOpeningGesture");
expect(source).toContain("previewStructuralOpeningGesture");
expect(source).toContain('kind: "translate-opening"');
```

and require interactive window lines and the door leaf to attach pointer-down to the same opening gesture starter.

- [ ] **Step 5: Run Canvas RED**

```bash
pnpm --filter web test -- editor-canvas-direct-manipulation-source.test.ts
```

Expected: FAIL until opening symbols are wired.

- [ ] **Step 6: Wire Canvas opening body drag**

Extend the Canvas pointer ref:

```ts
| Readonly<{ kind: "translate-opening"; openingId: string }>
```

Add `beginStructuralOpeningGesture(openingId, event)` that has priority over room composite, sets selection through the store, records the pointer gesture and clears marquee/snap feedback. In `previewStructuralPointerGesture`, route this kind directly using current `screenToWorld(pointer, viewport)`; no structural XY snap and no re-host search.

Attach the same pointer-down handler to:

- both interactive window body lines;
- the door leaf hit target.

The existing opening arc remains non-listening presentation.

- [ ] **Step 7: Run focused GREEN**

```bash
pnpm --filter web test -- use-editor-store-opening-gesture.test.ts editor-canvas-direct-manipulation-source.test.ts editor-canvas-structural-source.test.ts
pnpm --filter @vlezet/editor-core test -- hosted-opening-move.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/editor/use-editor-store.ts apps/web/components/editor/use-editor-store-opening-gesture.test.ts apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/editor-canvas-direct-manipulation-source.test.ts packages/editor-core/src/commands.ts
git commit -m "feat(editor): drag hosted openings along current wall"
```

---

### Task 5: Deterministic Compact Room Label Layout

**Files:**
- Modify: `apps/web/components/editor/dimension-annotations.ts`
- Create: `apps/web/components/editor/room-canvas-label-layout.ts`
- Create: `apps/web/components/editor/room-canvas-label-layout.test.ts`
- Modify: `apps/web/components/editor/editor-canvas.tsx`

**Interfaces:**
- `dimension-annotations.ts` produces semantic content only:

```ts
export type RoomCanvasLabelContent = Readonly<{
  name: string;
  area: string;
  dimensions: string | null;
}>;

export function formatRoomCanvasLabelContent(room: DerivedRoom): RoomCanvasLabelContent;
```

Keep `formatRoomCanvasLabel()` for existing consumers/tests by joining these parts.

- `room-canvas-label-layout.ts` produces screen projection only:

```ts
export type RoomCanvasLabelTier = "full" | "name-area" | "compact" | "name-only";

export type RoomCanvasLabelLayout = Readonly<{
  tier: RoomCanvasLabelTier;
  x: number;
  y: number;
  width: number;
  name: Readonly<{ y: number; height: number; maxLines: 1 | 2 }>;
  area: Readonly<{ y: number; height: number }> | null;
  dimensions: Readonly<{ y: number; height: number }> | null;
}>;

export function deriveRoomCanvasLabelLayout(input: Readonly<{
  roomScreenPoints: readonly Point2[];
  anchorScreen: Point2;
  content: RoomCanvasLabelContent;
}>): RoomCanvasLabelLayout | null;
```

- [ ] **Step 1: Write label-layout RED tests**

Use explicit screen rectangles and long names. Assert degradation order and non-overlap mathematically:

```ts
const layout = deriveRoomCanvasLabelLayout({
  roomScreenPoints: [
    { x: 0, y: 0 }, { x: 220, y: 0 },
    { x: 220, y: 100 }, { x: 0, y: 100 },
  ],
  anchorScreen: { x: 110, y: 50 },
  content: { name: "Очень длинное название комнаты", area: "12,34 м²", dimensions: "3630 × 3380 мм внутри" },
});
expect(layout?.tier).toBe("full");
expect((layout?.name.y ?? 0) + (layout?.name.height ?? 0)).toBeLessThanOrEqual(layout?.area?.y ?? Infinity);
```

Add compact-height cases requiring dimensions hidden before area, one-line ellipsis tier, name-only tier, and `null` when even one line cannot safely fit. Test a long unbroken token.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter web test -- room-canvas-label-layout.test.ts
```

Expected: FAIL because layout helper does not exist.

- [ ] **Step 3: Implement deterministic layout constants**

Use fixed screen-space constants so rendering is testable and zoom changes only available bounds:

```ts
const FONT_SIZE_PX = 11;
const LINE_HEIGHT_PX = 15;
const GAP_PX = 2;
const PADDING_PX = 6;
const MAX_WIDTH_PX = 200;
const MIN_NAME_WIDTH_PX = 56;
```

Compute polygon AABB, inset it by padding, cap width at 200 px, center/clamp around `anchorScreen`, then choose tier by available height in this order:

1. two-line-name + area + dimensions;
2. two-line-name + area;
3. one-line-name + area;
4. one-line-name;
5. `null`.

- [ ] **Step 4: Render separate non-overlapping Konva text blocks**

Replace the current single newline `<Text width={200}>` room label with separate name/area/dimensions `<Text>` nodes using the layout. Name gets explicit `height`, `wrap="word"` and `ellipsis`; area/dimensions are single-line and cannot overlap because their Y positions come from the helper.

- [ ] **Step 5: Run GREEN plus existing dimension tests**

```bash
pnpm --filter web test -- room-canvas-label-layout.test.ts dimension-annotations.test.ts editor-canvas-source.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/editor/dimension-annotations.ts apps/web/components/editor/room-canvas-label-layout.ts apps/web/components/editor/room-canvas-label-layout.test.ts apps/web/components/editor/editor-canvas.tsx
git commit -m "fix(canvas): keep compact room labels readable"
```

---

### Task 6: Real Chromium/WebKit Acceptance for the New Product-Owner Paths

**Files:**
- Create: `tools/m7-browser-audit/m8-direct-manipulation-opening.spec.mjs`
- Modify: `tools/m7-browser-audit/playwright.config.mjs`
- Modify: `tools/m7-browser-audit/playwright.webkit.config.mjs`

**Interfaces:**
- Uses the real editor through pointer/keyboard interaction only.
- Must not replace behavioral assertions with source-string assertions.

- [ ] **Step 1: Add the browser spec before claiming the correction GREEN**

Use the stable helper pattern already proven in `m8-room-translation.spec.mjs`: `openNewProject`, Stage-relative points, explicit snapping control, `drag`, selection summary and one-operation Undo/Redo.

Implement these exact scenarios:

1. Create isolated room, place two chairs, explicitly select room + both chairs, start drag from first selected chair body, and assert complete selection remains `Комнаты: 1 / Предметы: 2`; clear selection and click expected translated chair/room positions to prove rigid movement.
2. Repeat equivalent movement from free room interior and assert same membership/history semantics.
3. With room selected, drag an unselected chair and assert ordinary chair selection/movement occurs while room stays at original position.
4. Select a single furniture item and verify its existing transform handles remain usable without room translation.
5. Create a door, switch to Select, drag its leaf along the same wall, then verify inspector/selection still identifies the same door and one Undo/Redo restores/reapplies position.
6. Drag the door well beyond a wall endpoint and verify it remains on the same wall/span rather than disappearing or re-hosting.
7. Put two openings on one wall, drag one into the other and require visible invalid feedback during drag plus no committed overlap after mouseup.
8. Create a representative window and prove the same host-wall drag primitive.
9. Name a compact room with a deliberately long string and capture/assert the no-error state plus screenshot evidence after the deterministic layout helper has selected a compact tier.

For the mixed composite regression, the critical interaction must start with:

```js
await selectRoomAndObjects(page, roomPoint, [firstChair, secondChair]);
await expect(page.locator(".multi-selection-summary")).toContainText("Комнаты: 1");
await expect(page.locator(".multi-selection-summary")).toContainText("Предметы: 2");
await drag(page, firstChair, targetForFirstChair);
await expect(page.locator(".topology-alert")).toHaveCount(0);
await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 3");
```

- [ ] **Step 2: Register the spec in both Playwright configs**

Chromium includes all scenarios. WebKit includes at minimum selected-furniture-body composite move, unselected furniture ordinary behavior, door host move/no re-host, invalid opening rejection, Undo/Redo, and compact-label smoke/evidence.

- [ ] **Step 3: Run browser acceptance locally when available**

```bash
pnpm --dir tools/m7-browser-audit audit -- m8-direct-manipulation-opening.spec.mjs
pnpm --dir tools/m7-browser-audit audit:webkit -- m8-direct-manipulation-opening.spec.mjs
```

Expected: PASS in both engines. If the harness cannot run browsers locally, commit the test first and use GitHub Browser Acceptance as the RED/GREEN runner; diagnose every failure before changing product code or test expectations.

- [ ] **Step 4: Commit browser evidence code**

```bash
git add tools/m7-browser-audit/m8-direct-manipulation-opening.spec.mjs tools/m7-browser-audit/playwright.config.mjs tools/m7-browser-audit/playwright.webkit.config.mjs
git commit -m "test(browser): cover M8.2 direct manipulation correction"
```

---

### Task 7: Full Regression, Truth Sync, and Product-Owner Gate

**Files:**
- Create: `docs/changelog/2026-08-12-m8-2-direct-manipulation-opening-drag-correction.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/product/UX_ROADMAP.md`
- Modify: `docs/CHANGELOG.md`
- Mutable metadata: PR #87 and issue #56.

**Interfaces:**
- Consumes exact RED/GREEN commit/run identities from Tasks 1–6.
- Produces truthful `AUTOMATED GREEN / PRODUCT-OWNER RETEST PENDING`; never `accepted` before manual PASS.

- [ ] **Step 1: Run focused deterministic suites**

```bash
pnpm --filter @vlezet/editor-core test -- hosted-opening-move.test.ts structural-editing.test.ts opening-editing.test.ts
pnpm --filter web test -- editor-pointer-gesture-intent.test.ts use-editor-store-room-translation.test.ts use-editor-store-opening-gesture.test.ts room-canvas-label-layout.test.ts editor-canvas-direct-manipulation-source.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full repository gates**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm benchmark:recognition:core
pnpm validate:m7-docs
```

Expected: all PASS. No M2/topology/opening/recognition threshold may be weakened to obtain GREEN.

- [ ] **Step 3: Run/fetch fresh exact-head Browser Acceptance**

Require Chromium and representative WebKit PASS on the same commit. Record workflow run, artifact ID and SHA-256 digest. Review threads must be checked again and unresolved threads must be zero before delivery status is updated.

- [ ] **Step 4: Write focused changelog with provenance**

Record:

- product-owner screenshot/path and exact root cause;
- arbiter behavior adopted from market/open-source research at the idea level only;
- `fedepaj/arcada-planner` and `charmlinn/blueprint3d-modern` as MIT references, with explicit `copied code: none`;
- hosted-opening current-wall semantics;
- label degradation tiers;
- every genuine RED and corresponding GREEN head/run;
- browser failures classified as product defects vs harness defects;
- scope audit confirming no domain schema/recognition drift;
- product-owner acceptance still `PENDING`.

- [ ] **Step 5: Synchronize canonical truth**

Update `PROJECT_STATE`, `ROADMAP`, UX roadmap and concise changelog so they say:

```text
M8.2 direct-manipulation correction automated GREEN
latest product-owner correction retest PENDING
M8.3 BLOCKED
```

Do not create `docs/milestones/m8-2-acceptance.md` yet.

- [ ] **Step 6: Commit documentation truth**

```bash
git add docs/PROJECT_STATE.md docs/ROADMAP.md docs/product/UX_ROADMAP.md docs/CHANGELOG.md docs/changelog/2026-08-12-m8-2-direct-manipulation-opening-drag-correction.md
git commit -m "docs(m8.2): record direct manipulation correction evidence"
```

- [ ] **Step 7: Run fresh documentation-head gates**

The documentation commit changes the exact head, so repeat CI and Chromium/WebKit Browser Acceptance on that exact head. Only those fresh runs are delivery evidence.

- [ ] **Step 8: Update PR #87 / issue #56 without changing the Git head**

Record exact documentation head, CI/browser runs, artifact/digest, review-thread count and the focused manual retest matrix. Keep PR #87 Draft and issue #56 open.

- [ ] **Step 9: Stop at the product-owner gate**

Ask the product owner to verify:

1. `room + furniture` dragged from selected furniture body moves rigidly;
2. free-room-interior composite drag still works;
3. unselected furniture keeps ordinary behavior;
4. object transform handles remain specialized;
5. door drag stays on current wall including endpoint clamp;
6. conflicting door/opening move rejects visibly;
7. window uses the same current-wall primitive;
8. opening and composite Undo/Redo are one operation each;
9. compact/long room label is readable and non-overlapping;
10. prior M8.2 clipboard/selection scenarios remain PASS.

Only explicit PASS may trigger a later acceptance-record task, accepted-head gates, Ready state and protected squash merge.
