# M8.2 Selection and Clipboard Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make room point-selection geometrically correct and make Copy/Paste behave like a normal visual editor: copy exactly the explicit selection and paste that rigid selection at the Canvas pointer.

**Architecture:** `@vlezet/geometry` gains a pure boundary-inclusive point-in-polygon primitive. `apps/web` owns selection interpretation, the latest ephemeral Canvas pointer and an editor-level composite clipboard; `@vlezet/editor-core` continues to own structural projection/validation and exposes the actual translation chosen by safe structural Paste so every copied component follows the same rigid transform. `VlezetDocument` remains the only persistent truth and one accepted Paste remains one semantic history command.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Zustand 5, Konva/react-konva, Vitest 4, Playwright Chromium + WebKit, pnpm/Turbo.

## Global Constraints

- Copy exactly what the user explicitly selected; furniture inside a selected room is not included unless explicitly selected.
- Point-hit priority remains: opening → placed object → visible wall → room.
- Room point-hit must work for concave simple polygons and include boundary points within geometry epsilon.
- Paste uses the latest finite 2D Canvas pointer world position; if none exists in the editor session, fall back to the copied group anchor.
- Duplicate remains a separate deterministic-offset command.
- Supported mixed Copy roots: walls + placed objects, or exactly one room + placed objects.
- Unsupported roots include room + explicit walls, more than one room, standalone openings/vertices, and any family without an explicit projection contract.
- Room Copy means structural shell + hosted openings + explicit room annotation/name; it does not implicitly include contained furniture.
- Composite Paste is all-or-nothing and preserves one rigid translation across structure and placed objects.
- Structural safe-placement candidates continue through the unchanged topology/opening validator.
- A rejected Copy clears the Vlezet internal clipboard so later Paste cannot insert stale content.
- No persistent schema change, no recognition change, no arbitrary structural group scale, no room Cut.
- Every deterministic change follows genuine RED → observed intended failure → minimal GREEN → regression verification.
- Chromium full acceptance and representative WebKit evidence are mandatory before product-owner retest.

---

## File map

### Geometry

- Create `packages/geometry/src/point-in-polygon.ts` — pure point/edge/polygon predicates.
- Create `packages/geometry/src/point-in-polygon.test.ts` — convex/concave/boundary RED/GREEN.
- Modify `packages/geometry/src/index.ts` — export the new primitive.

### Web selection and pointer interaction

- Modify `apps/web/components/editor/editor-selection-geometry.ts` — room point-hit uses point-in-polygon and smallest-area tie-break.
- Modify `apps/web/components/editor/editor-selection-geometry.test.ts` — screenshot-class concave-room regression.
- Modify `apps/web/components/editor/editor-canvas.tsx` — publish latest world pointer and room hover identity.
- Modify `apps/web/components/editor/apartment-editor.tsx` — retain latest pointer in a ref and route Paste to it.
- Modify `apps/web/components/editor/editor-canvas-source.test.ts` / `editor-canvas-m8-2-source.test.ts` only where existing source-contract coverage needs the new callback/hover contract.

### Clipboard model and orchestration

- Modify `apps/web/components/editor/editor-clipboard.ts` — composite payload + rigid placed-object delta helper.
- Modify `apps/web/components/editor/editor-selection-capabilities.ts` — enable the two approved mixed families and retain explicit reasons for unsupported roots.
- Modify `apps/web/components/editor/use-editor-store.ts` — result-producing Copy, stale-payload clearing, composite Paste and complete pasted selection.
- Modify `apps/web/components/editor/use-editor-store-clipboard.test.ts` — mixed Copy/Paste, stale clipboard, cursor anchor, atomic history.
- Modify `apps/web/components/editor/structural-copy-selection.test.ts` — room + furniture and wall + furniture contracts.
- Modify `apps/web/components/editor/editor-selection-capabilities.test.ts` — supported/unsupported mixed capability matrix.

### Structural paste authority

- Modify `packages/editor-core/src/structural-clipboard.ts` — return the actual applied translation after fallback.
- Modify `packages/editor-core/src/structural-clipboard.test.ts` / `structural-copy-projection.test.ts` — exact requested delta and fallback-applied delta tests.
- Modify `packages/editor-core/src/index.ts` only if an exported result type is introduced.

### Product feedback and browser acceptance

- Modify `apps/web/components/editor/apartment-editor.tsx` plus existing status surface/CSS as needed — transient rejected-Copy reason without adding persistent state.
- Create `tools/m7-browser-audit/m8-selection-clipboard-semantics.spec.mjs` — screenshot-class hit-test + pointer/composite clipboard acceptance.
- Modify `tools/m7-browser-audit/playwright.config.mjs` and `playwright.webkit.config.mjs` — include the new spec.
- Modify `docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, PR #87 and issue #56 only after GREEN evidence exists.

---

### Task 1: Correct concave-room point hit-testing

**Files:**
- Create: `packages/geometry/src/point-in-polygon.ts`
- Create: `packages/geometry/src/point-in-polygon.test.ts`
- Modify: `packages/geometry/src/index.ts`
- Modify: `apps/web/components/editor/editor-selection-geometry.ts`
- Modify: `apps/web/components/editor/editor-selection-geometry.test.ts`

**Interfaces:**
- Produces: `pointInPolygonInclusive(point: Point2, polygon: readonly Point2[], epsilon?: number): boolean`.
- Consumes: `Point2`, `GEOMETRY_EPSILON_MM`.

- [ ] **Step 1: Write geometry RED for a concave L-shape**

```ts
import { describe, expect, it } from "vitest";
import { pointInPolygonInclusive } from "./point-in-polygon";

const L = [
  { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 3000 },
  { x: 3000, y: 3000 }, { x: 3000, y: 6000 }, { x: 0, y: 6000 },
] as const;

describe("pointInPolygonInclusive", () => {
  it("rejects the cut-out of a concave room and includes both arms", () => {
    expect(pointInPolygonInclusive({ x: 4500, y: 4500 }, L)).toBe(false);
    expect(pointInPolygonInclusive({ x: 1500, y: 4500 }, L)).toBe(true);
    expect(pointInPolygonInclusive({ x: 4500, y: 1500 }, L)).toBe(true);
  });

  it("treats an edge and a vertex as inside", () => {
    expect(pointInPolygonInclusive({ x: 3000, y: 4500 }, L)).toBe(true);
    expect(pointInPolygonInclusive({ x: 3000, y: 3000 }, L)).toBe(true);
  });
});
```

- [ ] **Step 2: Run geometry RED**

Run: `pnpm --filter @vlezet/geometry test -- point-in-polygon.test.ts`

Expected: FAIL because `./point-in-polygon` / `pointInPolygonInclusive` does not exist.

- [ ] **Step 3: Implement the pure inclusive predicate**

```ts
import type { Point2 } from "@vlezet/domain";
import { GEOMETRY_EPSILON_MM } from "./constants";

function pointOnSegment(point: Point2, a: Point2, b: Point2, epsilon: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cross = (point.x - a.x) * dy - (point.y - a.y) * dx;
  if (Math.abs(cross) > epsilon * Math.max(1, Math.hypot(dx, dy))) return false;
  const dot = (point.x - a.x) * dx + (point.y - a.y) * dy;
  if (dot < -epsilon) return false;
  return dot <= dx * dx + dy * dy + epsilon;
}

export function pointInPolygonInclusive(
  point: Point2,
  polygon: readonly Point2[],
  epsilon = GEOMETRY_EPSILON_MM,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[j]!;
    const b = polygon[i]!;
    if (pointOnSegment(point, a, b, epsilon)) return true;
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (!crosses) continue;
    const x = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y);
    if (x > point.x + epsilon) inside = !inside;
  }
  return inside;
}
```

If the repository constant is exported from a different module, import it from the existing canonical location used by geometry package files; do not duplicate epsilon values.

- [ ] **Step 4: Run geometry GREEN and package regression**

Run:

```bash
pnpm --filter @vlezet/geometry test -- point-in-polygon.test.ts
pnpm --filter @vlezet/geometry test
```

Expected: PASS.

- [ ] **Step 5: Write web selection RED reproducing the screenshot class**

Extend `editor-selection-geometry.test.ts` with a document containing a large L-shaped room and a smaller closed room entirely inside the L cut-out. Resolve the two `deriveRooms(document)` IDs by area and assert:

```ts
const hits = entitiesAtPoint(document, { x: 4500, y: 4500 });
expect(hits.filter((ref) => ref.kind === "room")).toEqual([
  { kind: "room", id: smallRoom.id },
]);
expect(hits).not.toContainEqual({ kind: "room", id: largeRoom.id });
```

Also add an ambiguity fixture where two numerically overlapping room candidates contain the same point and assert the smaller `area` is first.

- [ ] **Step 6: Run web selection RED**

Run: `pnpm --filter web test -- editor-selection-geometry.test.ts`

Expected: FAIL because `entitiesAtPoint` still uses `polygonIntersectsRect` for rooms.

- [ ] **Step 7: Replace only room point-hit logic**

In `entitiesAtPoint`:

```ts
const roomHits = deriveRooms(document).rooms
  .filter((room) => pointInPolygonInclusive(point, room.polygon))
  .sort((a, b) => a.area - b.area);

for (const room of roomHits) {
  result.push({ kind: "room", id: room.id });
}
```

Do not change `concreteEntitiesIntersectingRect`; opening/object/wall ordering remains intact and marquee still excludes rooms.

- [ ] **Step 8: Run focused and full web GREEN**

```bash
pnpm --filter web test -- editor-selection-geometry.test.ts
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add packages/geometry/src/point-in-polygon.ts packages/geometry/src/point-in-polygon.test.ts packages/geometry/src/index.ts apps/web/components/editor/editor-selection-geometry.ts apps/web/components/editor/editor-selection-geometry.test.ts
git commit -m "fix(m8.2): make room point selection concave-safe"
```

---

### Task 2: Publish latest Canvas world pointer and expose room hover

**Files:**
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify/Test: existing Canvas source/feedback tests relevant to pointer/hover.

**Interfaces:**
- Produces EditorCanvas prop: `onPointerWorldChange: (point: Point2) => void`.
- Produces ApartmentEditor ref: `latestCanvasPointerWorldRef: MutableRefObject<Point2 | null>`.
- Consumes Task 1 room ordering through `entitiesAtPoint` / `entitiesIntersectingMarquee` point path.

- [ ] **Step 1: Write source-contract RED for the new callback**

Add an assertion that `EditorCanvasProps` contains `onPointerWorldChange` and that `onMouseMove` publishes `screenToWorld(pointer, viewport)` before hover/gesture branches can return.

Use existing source-contract test style, for example:

```ts
expect(source).toContain("onPointerWorldChange: (point: Point2) => void");
expect(source).toContain("onPointerWorldChange(screenToWorld(pointer, viewport))");
```

- [ ] **Step 2: Run RED**

Run: `pnpm --filter web test -- editor-canvas-source.test.ts`

Expected: FAIL on missing callback publication.

- [ ] **Step 3: Implement pointer publication without per-move React state**

Add the prop and in `onMouseMove` immediately after obtaining `pointer`:

```ts
onPointerWorldChange(screenToWorld(pointer, viewport));
```

In `ApartmentEditor`:

```ts
const latestCanvasPointerWorldRef = useRef<Point2 | null>(null);
const rememberCanvasPointer = useCallback((point: Point2) => {
  if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
    latestCanvasPointerWorldRef.current = { ...point };
  }
}, []);
```

Pass `onPointerWorldChange={rememberCanvasPointer}` to `EditorCanvas`. Reset the ref to `null` when `projectId` changes.

- [ ] **Step 4: Add room hover RED**

Add a browser/source-level assertion that when `visibleHoveredEntity?.kind === "room"`, the matching room fill/outline uses the existing `hover` visual role, while `selected` remains stronger. Do not create a separate persistent room-hover state.

- [ ] **Step 5: Implement room hover using existing `hoveredEntity` identity**

When rendering each derived room, compute:

```ts
const selected = isEntitySelected("room", room.id);
const hovered = visibleHoveredEntity?.kind === "room" && visibleHoveredEntity.id === room.id;
const visual = deriveCanvasEntityVisual(selected ? "selected" : hovered ? "hover" : "ordinary");
```

The room interior must remain listening only as already required for semantic room clicks; no new geometry owner is introduced.

- [ ] **Step 6: Run focused/full web GREEN**

```bash
pnpm --filter web test -- editor-canvas-source.test.ts editor-canvas-m8-2-source.test.ts
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/*canvas*test.ts
git commit -m "feat(m8.2): track canvas pointer and clarify room hover"
```

---

### Task 3: Expose actual structural Paste translation

**Files:**
- Modify: `packages/editor-core/src/structural-clipboard.ts`
- Modify: `packages/editor-core/src/structural-clipboard.test.ts`
- Modify: `packages/editor-core/src/index.ts` only if the named result type is exported.

**Interfaces:**
- Changes `pasteStructuralFragment(...)` result to include `appliedDelta: Point2`.
- `appliedDelta` means the exact translation from payload source coordinates to the accepted pasted coordinates, including safe-placement fallback.

- [ ] **Step 1: Write RED for requested placement**

For a non-colliding structural payload:

```ts
const result = pasteStructuralFragment(document, payload, { x: 7000, y: 2000 }, ids);
expect(result.appliedDelta).toEqual({
  x: 7000 - payload.origin.x,
  y: 2000 - payload.origin.y,
});
```

- [ ] **Step 2: Write RED for safe fallback**

Reuse/create a room fixture where the requested anchor overlaps source geometry and fallback succeeds. Derive one pasted vertex position and assert:

```ts
const source = payload.vertices[0]!;
const pasted = result.document.vertices.find((vertex) => vertex.id === result.vertexIds[0])!;
expect(pasted.position).toEqual({
  x: source.position.x + result.appliedDelta.x,
  y: source.position.y + result.appliedDelta.y,
});
expect(result.appliedDelta).not.toEqual({
  x: requested.x - payload.origin.x,
  y: requested.y - payload.origin.y,
});
```

- [ ] **Step 3: Run editor-core RED**

Run: `pnpm --filter @vlezet/editor-core test -- structural-clipboard.test.ts`

Expected: FAIL because `appliedDelta` is missing.

- [ ] **Step 4: Track accepted additional delta in production**

Introduce:

```ts
let appliedAdditionalDelta: Point2 = { x: 0, y: 0 };
```

Whenever a fallback candidate succeeds, assign the exact `additionalDelta` used by `validateAtAdditionalDelta`. Return:

```ts
appliedDelta: {
  x: delta.x + appliedAdditionalDelta.x,
  y: delta.y + appliedAdditionalDelta.y,
},
```

Do not change candidate ordering, attempt count, stride, validation calls or overlap policy.

- [ ] **Step 5: Run editor-core GREEN/full regression**

```bash
pnpm --filter @vlezet/editor-core test -- structural-clipboard.test.ts
pnpm --filter @vlezet/editor-core test
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/editor-core/src/structural-clipboard.ts packages/editor-core/src/structural-clipboard.test.ts packages/editor-core/src/index.ts
git commit -m "feat(m8.2): expose applied structural paste delta"
```

---

### Task 4: Add composite explicit-selection clipboard and stale-Copy safety

**Files:**
- Modify: `apps/web/components/editor/editor-clipboard.ts`
- Modify: `apps/web/components/editor/editor-selection-capabilities.ts`
- Modify: `apps/web/components/editor/editor-selection-capabilities.test.ts`
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify: `apps/web/components/editor/use-editor-store-clipboard.test.ts`
- Modify: `apps/web/components/editor/structural-copy-selection.test.ts`

**Interfaces:**
- Produces `CompositeEditorClipboardPayloadV1`.
- Produces `CopySelectionResult = { ok: true } | { ok: false; reason: string }`.
- Changes store method to `copySelection: () => CopySelectionResult`.
- Adds `clipboard.rejectionReason: string | null` or equivalent editor-internal transient result state; successful Copy clears it.

- [ ] **Step 1: Define composite payload RED**

Add tests expecting this shape:

```ts
export type CompositeEditorClipboardPayloadV1 = Readonly<{
  version: 1;
  kind: "composite-selection";
  copiedAtOrigin: Point2;
  structural: StructuralEditorClipboardPayloadV1 | null;
  objects: readonly PlacedObject[];
}>;
```

Use `copiedAtOrigin` passed from the selection physical bounds center, not recomputed from only one family.

- [ ] **Step 2: Add rigid object delta helper RED**

```ts
const pasted = derivePasteObjectsWithDelta({
  objects: [sofa, table],
  delta: { x: 5000, y: -1000 },
  idFactory: ids,
});
expect(pasted[1]!.position.x - pasted[0]!.position.x)
  .toBe(table.position.x - sofa.position.x);
expect(pasted[1]!.position.y - pasted[0]!.position.y)
  .toBe(table.position.y - sofa.position.y);
```

- [ ] **Step 3: Run clipboard RED**

Run: `pnpm --filter web test -- use-editor-store-clipboard.test.ts`

Expected: FAIL because composite payload/helper do not exist.

- [ ] **Step 4: Implement payload/helper minimally**

Add:

```ts
export function createCompositeEditorClipboardPayload(input: Readonly<{
  copiedAtOrigin: Point2;
  structural: StructuralEditorClipboardPayloadV1 | null;
  objects: readonly PlacedObject[];
}>): CompositeEditorClipboardPayloadV1 { /* finite point + clone validation */ }

export function derivePasteObjectsWithDelta(input: Readonly<{
  objects: readonly PlacedObject[];
  delta: Point2;
  idFactory: () => string;
}>): readonly PlacedObject[] { /* clone + fresh IDs + same delta */ }
```

Refactor existing `derivePasteObjects` to delegate to `derivePasteObjectsWithDelta`; preserve existing object-only behavior.

- [ ] **Step 5: Write selection capability RED matrix**

Create selections and assert:

```ts
expect(capabilities(roomPlusSofa).copy.enabled).toBe(true);
expect(capabilities(wallPlusSofa).copy.enabled).toBe(true);
expect(capabilities(roomPlusWall).copy.enabled).toBe(false);
expect(capabilities(twoRooms).copy.enabled).toBe(false);
expect(capabilities(openingOnly).copy.enabled).toBe(false);
```

For supported mixed selections, Cut remains disabled because no approved destructive mixed contract exists.

- [ ] **Step 6: Run capability RED**

Run: `pnpm --filter web test -- editor-selection-capabilities.test.ts`

Expected: FAIL because all mixed selections are currently rejected.

- [ ] **Step 7: Implement explicit supported-family classification**

Use counts rather than `kinds.size > 1` blanket rejection:

```ts
const rooms = selection.refs.filter((ref) => ref.kind === "room");
const walls = selection.refs.filter((ref) => ref.kind === "wall");
const objects = selection.refs.filter((ref) => ref.kind === "placed-object");
const unsupported = selection.refs.filter((ref) =>
  ref.kind !== "room" && ref.kind !== "wall" && ref.kind !== "placed-object");

const copySupported = unsupported.length === 0 &&
  rooms.length <= 1 &&
  !(rooms.length === 1 && walls.length > 0) &&
  (rooms.length + walls.length + objects.length === selection.refs.length);
```

Return explicit disabled reasons for >1 room, room+wall and unsupported roots.

- [ ] **Step 8: Write store RED for room + explicit furniture and no implicit furniture**

Fixture: one room containing three objects, but selection contains room + sofa + table only.

```ts
const result = store.getState().copySelection();
expect(result).toEqual({ ok: true });
const payload = store.getState().clipboard.payload;
expect(payload?.kind).toBe("composite-selection");
if (payload?.kind !== "composite-selection") throw new Error("expected composite");
expect(payload.objects.map((object) => object.id)).toEqual(["sofa", "table"]);
expect(payload.objects.some((object) => object.id === "lamp-unselected")).toBe(false);
expect(payload.structural?.scope?.kind).toBe("room");
```

- [ ] **Step 9: Write store RED for walls + furniture**

Select two walls + one explicit object and assert the composite contains only those roots and their automatic structural dependencies/openings.

- [ ] **Step 10: Write stale clipboard RED**

```ts
store.getState().selectWall("top");
expect(store.getState().copySelection().ok).toBe(true);
expect(store.getState().clipboard.payload).not.toBeNull();

store.setState({ selection: unsupportedRoomPlusWallSelection });
const rejected = store.getState().copySelection();
expect(rejected.ok).toBe(false);
expect(store.getState().clipboard.payload).toBeNull();
```

- [ ] **Step 11: Run store RED**

```bash
pnpm --filter web test -- use-editor-store-clipboard.test.ts structural-copy-selection.test.ts
```

Expected: FAIL for mixed Copy and stale-payload clearing.

- [ ] **Step 12: Implement result-producing Copy**

In `copySelection`:

1. sanitize selection;
2. classify room/walls/objects;
3. compute `deriveSelectionWorldBounds(document, selection)` and use its center as composite `copiedAtOrigin`;
4. build structural projection only from explicit structural roots;
5. clone only explicit placed objects;
6. on success replace clipboard and clear rejection reason;
7. on any unsupported/projection error set `{ payload: null, ..., rejectionReason: reason }` and return `{ ok: false, reason }`.

Do not silently preserve an older payload.

- [ ] **Step 13: Run focused/full web GREEN**

```bash
pnpm --filter web test -- editor-selection-capabilities.test.ts use-editor-store-clipboard.test.ts structural-copy-selection.test.ts
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 14: Commit Task 4**

```bash
git add apps/web/components/editor/editor-clipboard.ts apps/web/components/editor/editor-selection-capabilities.ts apps/web/components/editor/editor-selection-capabilities.test.ts apps/web/components/editor/use-editor-store.ts apps/web/components/editor/use-editor-store-clipboard.test.ts apps/web/components/editor/structural-copy-selection.test.ts
git commit -m "feat(m8.2): copy explicit mixed selections atomically"
```

---

### Task 5: Paste every clipboard family at the Canvas pointer and keep composite Paste atomic

**Files:**
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify: `apps/web/components/editor/use-editor-store-clipboard.test.ts`
- Modify: `apps/web/components/editor/apartment-editor-command-routing.test.ts`

**Interfaces:**
- Consumes Task 2 `latestCanvasPointerWorldRef`.
- Consumes Task 3 `pasteStructuralFragment(...).appliedDelta`.
- Consumes Task 4 composite payload.
- `pasteClipboard(anchor: Point2)` remains the store entry point; `ApartmentEditor` now supplies pointer anchor.

- [ ] **Step 1: Write command-routing RED**

Update the command-routing test so `selection.paste` no longer contains `copiedAtOrigin + 200` and instead resolves:

```ts
const anchor = latestCanvasPointerWorldRef.current ?? store.clipboard.payload.copiedAtOrigin;
store.pasteClipboard(anchor);
```

- [ ] **Step 2: Run command-routing RED**

Run: `pnpm --filter web test -- apartment-editor-command-routing.test.ts`

Expected: FAIL because fixed source-relative offset is still present.

- [ ] **Step 3: Implement pointer-routed keyboard Paste**

Use the latest finite Canvas pointer ref. Do not mutate the pointer on keyboard events and do not persist it.

- [ ] **Step 4: Write objects-only pointer Paste RED**

Copy two objects, call `pasteClipboard({ x: 10000, y: 7000 })`, then assert the center of pasted physical bounds equals the requested anchor (within numerical epsilon) and the source relative vector is unchanged.

- [ ] **Step 5: Write composite room + furniture pointer Paste RED**

Select room + sofa + table, Copy, then Paste far away. Assert:

```ts
expect(after.walls.length).toBe(before.walls.length + roomShellWallCount);
expect(after.placedObjects.length).toBe(before.placedObjects.length + 2);
expect(after.placedObjects.some((object) => object.name === "unselected lamp copy")).toBe(false);
expect(state.history.past).toHaveLength(beforeHistory + 1);
```

Derive source→pasted deltas and assert the sofa, table and every pasted structural vertex share one equal delta.

- [ ] **Step 6: Write structural collision fallback RED for the whole group**

Request a composite room + furniture Paste at an overlapping cursor anchor so editor-core fallback is required. Assert the furniture delta equals `structuralResult.appliedDelta`, not the originally requested delta.

Also assert one `undo()` removes structure and furniture together and one `redo()` restores both.

- [ ] **Step 7: Run Paste RED suite**

Run: `pnpm --filter web test -- use-editor-store-clipboard.test.ts apartment-editor-command-routing.test.ts`

Expected: FAIL on pointer routing/composite atomicity.

- [ ] **Step 8: Implement composite Paste transaction**

For `composite-selection`:

```ts
const requestedDelta = {
  x: anchor.x - payload.copiedAtOrigin.x,
  y: anchor.y - payload.copiedAtOrigin.y,
};

let candidate = before;
let appliedDelta = requestedDelta;
let pastedWallIds: readonly string[] = [];

if (payload.structural) {
  const requestedStructuralAnchor = {
    x: payload.structural.origin.x + requestedDelta.x,
    y: payload.structural.origin.y + requestedDelta.y,
  };
  const structural = pasteStructuralFragment(before, payload.structural, requestedStructuralAnchor, idFactory);
  candidate = structural.document;
  appliedDelta = structural.appliedDelta;
  pastedWallIds = structural.wallIds;
}

const pastedObjects = derivePasteObjectsWithDelta({
  objects: payload.objects,
  delta: appliedDelta,
  idFactory: () => idFactory("placed-object"),
});
candidate = addPlacedObjects(candidate, pastedObjects);
```

Only after the full candidate exists, execute one `document/replace` command. If structural Paste throws, do not add objects or history. Set selection to all pasted walls + objects.

For objects-only and structural-only payloads, use the supplied pointer anchor directly; remove the keyboard-layer hidden `+200 mm` behavior. Repeated Paste can continue to use explicit repetition state only if it does not move the first Paste away from the pointer.

- [ ] **Step 9: Run focused/full GREEN**

```bash
pnpm --filter web test -- use-editor-store-clipboard.test.ts apartment-editor-command-routing.test.ts
pnpm --filter web test
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit Task 5**

```bash
git add apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/use-editor-store.ts apps/web/components/editor/use-editor-store-clipboard.test.ts apps/web/components/editor/apartment-editor-command-routing.test.ts
git commit -m "feat(m8.2): paste explicit selection at canvas pointer"
```

---

### Task 6: Surface rejected Copy feedback without stale state

**Files:**
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: existing editor status CSS/component chosen during implementation, keeping the change local.
- Test: `apps/web/components/editor/apartment-editor-command-routing.test.ts` or a focused component test.

**Interfaces:**
- Consumes Task 4 `CopySelectionResult`.
- Produces transient UI notice only; no persistent document/project state.

- [ ] **Step 1: Write RED for rejected keyboard Copy**

Assert command routing calls `copySelection()` even when the selection is unsupported, clears the internal clipboard through the store result path, and exposes the returned reason in a `role="status"` surface.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter web test -- apartment-editor-command-routing.test.ts`

Expected: FAIL because current routing gates Copy entirely on `capabilities.copy.enabled`.

- [ ] **Step 3: Implement minimal command semantics**

For `selection.copy`:

```ts
if (editingBlocked) return false;
const result = store.copySelection();
if (!result.ok) setClipboardNotice(result.reason);
else setClipboardNotice(null);
return true;
```

Keep context-menu buttons capability-aware, but keyboard Copy is an explicit attempt and must invalidate stale clipboard on rejection.

Render the notice as a non-modal `role="status"` message and clear it on successful Copy/Paste or after a short local timeout. It must not affect Canvas geometry or selection.

- [ ] **Step 4: Run focused/full GREEN**

```bash
pnpm --filter web test -- apartment-editor-command-routing.test.ts
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/*.css apps/web/components/editor/apartment-editor-command-routing.test.ts
git commit -m "fix(m8.2): prevent stale clipboard after rejected copy"
```

---

### Task 7: Chromium/WebKit acceptance for the reported interaction class

**Files:**
- Create: `tools/m7-browser-audit/m8-selection-clipboard-semantics.spec.mjs`
- Modify: `tools/m7-browser-audit/playwright.config.mjs`
- Modify: `tools/m7-browser-audit/playwright.webkit.config.mjs`

**Interfaces:**
- Consumes Tasks 1–6 user-visible behavior only.
- Produces browser evidence suitable for M8.2 acceptance.

- [ ] **Step 1: Write browser RED for concave room targeting**

Create the L-shaped + small-room fixture through real Canvas interactions or the existing browser fixture helper. Click repeatedly in the cut-out/small-room interior and assert the small room label/inspector is selected every time; the large room must never become primary.

- [ ] **Step 2: Add room hover acceptance**

Move pointer over empty room interior and assert the Canvas status/cursor/visual state reports a selectable target without clicking.

- [ ] **Step 3: Add pointer Paste acceptance for two furniture objects**

1. select two furniture items;
2. Copy;
3. move pointer to a visibly remote empty point;
4. Paste;
5. assert pasted objects appear around that pointer and preserve mutual spacing;
6. Undo/Redo once.

- [ ] **Step 4: Add composite room + explicit furniture acceptance**

1. select room;
2. modifier-select two furniture objects inside it while leaving a third unselected;
3. Copy;
4. move pointer;
5. Paste;
6. assert second room shell + exactly two furniture copies appear;
7. assert the unselected furniture has no copy;
8. one Undo removes the whole pasted group; one Redo restores it.

- [ ] **Step 5: Add stale clipboard rejection acceptance**

1. Copy a valid wall;
2. create unsupported room + explicit wall selection;
3. press Copy;
4. assert rejection reason is visible;
5. press Paste;
6. assert no old wall appears.

- [ ] **Step 6: Add structural collision/fallback acceptance**

Request composite Paste over occupied structure. Assert either a safe nearby rigid group appears or no mutation occurs; never allow structure-only or furniture-only partial Paste.

- [ ] **Step 7: Run Chromium RED then GREEN**

From the browser harness directory using the existing CI command/config, run the new spec in Chromium. Before production fixes it must demonstrate at least the intended old-behavior failures; after Tasks 1–6 it must PASS.

- [ ] **Step 8: Run representative WebKit**

Run the same new spec through `playwright.webkit.config.mjs` and require PASS.

- [ ] **Step 9: Commit Task 7**

```bash
git add tools/m7-browser-audit/m8-selection-clipboard-semantics.spec.mjs tools/m7-browser-audit/playwright.config.mjs tools/m7-browser-audit/playwright.webkit.config.mjs
git commit -m "test(m8.2): cover precise selection and composite clipboard"
```

---

### Task 8: Full gates, documentation truth-sync and product-owner retest boundary

**Files:**
- Modify: `docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Update: PR #87 body and issue #56 body after exact-head evidence exists.

**Interfaces:**
- Consumes all completed tasks and exact GitHub Actions evidence.
- Produces truthful status `AUTOMATED GREEN / PRODUCT-OWNER CORRECTION RETEST PENDING` until explicit manual PASS.

- [ ] **Step 1: Run local/full deterministic gates**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm benchmark:recognition:core
pnpm validate:m7-docs
```

Expected: all PASS.

- [ ] **Step 2: Push current implementation head and wait for exact-head GitHub Actions**

Require:

- CI PASS;
- Browser Acceptance PASS;
- Chromium PASS;
- representative WebKit PASS;
- browser evidence artifact present.

Do not document green before the run actually completes.

- [ ] **Step 3: Review diff for scope and authority**

Verify no persistent schema change, no recognition behavior change, no weakened structural validator and no unrelated UI refactor. Confirm unresolved review threads = 0.

- [ ] **Step 4: Update focused changelog with actual TDD identities**

Record real RED and GREEN SHAs/run numbers only. Never reconstruct or invent missing evidence.

- [ ] **Step 5: Sync canonical state/roadmap**

State that the correction is automated-green but M8.2 remains unaccepted until focused product-owner retest of:

```text
1. small room inside concave-room cut-out always selects correctly;
2. room hover makes click semantics discoverable;
3. two furniture items paste at cursor and preserve spacing;
4. room + explicitly selected furniture pastes as one rigid group;
5. furniture inside room but not selected is not copied;
6. rejected unsupported Copy cannot paste stale previous content;
7. Undo/Redo treats each composite Paste as one semantic operation.
```

- [ ] **Step 6: Commit documentation sync**

```bash
git add docs/PROJECT_STATE.md docs/ROADMAP.md docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "docs(m8.2): record selection clipboard correction evidence"
```

- [ ] **Step 7: Run fresh exact-head gates after docs sync**

Require fresh CI + Browser Acceptance PASS on the documentation head. Record artifact ID/digest and review-thread count in mutable PR/issue metadata without creating another commit solely for run IDs.

- [ ] **Step 8: Stop at product-owner retest**

Do not mark PR Ready, create `docs/milestones/m8-2-acceptance.md`, close #56 or merge until the user explicitly reports PASS for the correction retest.

---

## Plan self-review

### Spec coverage

- Concave-room hit-test: Task 1 + Task 7.
- Room hover discoverability: Task 2 + Task 7.
- Canvas-pointer Paste: Tasks 2 + 5 + Task 7.
- Explicit-selection-only rule: Task 4 + Task 7.
- Room + furniture and walls + furniture composite Copy: Task 4.
- One rigid transform including structural fallback: Tasks 3 + 5.
- One semantic history operation: Task 5 + Task 7.
- Stale clipboard prevention + visible reason: Tasks 4 + 6 + Task 7.
- Structural validator remains authoritative: Task 3/5 constraints and Task 8 review.
- Chromium/WebKit evidence and truth-sync: Tasks 7–8.

### Placeholder scan

No TBD/TODO/"implement later" steps are permitted. Every behavior has a concrete interface, RED condition and GREEN verification command.

### Type consistency

- `Point2` is the common pointer/delta type across geometry, editor-core and web.
- `pasteStructuralFragment(...).appliedDelta` is introduced in Task 3 and consumed by Task 5.
- `CompositeEditorClipboardPayloadV1` is introduced in Task 4 and consumed by Task 5.
- `copySelection(): CopySelectionResult` is introduced in Task 4 and consumed by Task 6.
- `onPointerWorldChange(point)` is introduced in Task 2 and consumed by Task 5 through `ApartmentEditor`'s ref.
