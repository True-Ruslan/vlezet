# M4.6.1 Honest Wall Length Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make existing wall-length editing explicit and predictable by naming centreline length honestly and supporting `start / center / end` fixed anchors without silently moving openings.

**Architecture:** Keep the persistent `VlezetDocument` unchanged. Extend framework-independent `editor-core` wall resizing with an explicit `WallLengthAnchor`; preserve opening world positions when the wall start moves by compensating offsets. The React inspector only selects semantic intent and delegates all geometry mutation to editor-core.

**Tech Stack:** TypeScript, Vitest, Zustand, React/Next.js, existing `@vlezet/domain`, `@vlezet/geometry`, `@vlezet/editor-core`.

## Global Constraints

- Millimetres remain the canonical world unit.
- No schema migration or duplicate persisted dimension fields.
- Existing `setTopologicalWallLength(document, wallId, lengthMm)` callers retain legacy `start`-anchor behaviour by default.
- One successful length edit remains one semantic Undo/Redo operation.
- Geometry edits fail atomically; no partial mutation.
- Existing openings preserve world position when the wall start moves.
- Do not weaken topology/junction/opening validation.

---

### Task 1: Anchored wall-length geometry contract

**Files:**
- Modify: `packages/editor-core/src/topology-editing.ts`
- Modify: `packages/editor-core/src/topology-editing.test.ts`
- Modify: `packages/editor-core/src/index.ts`

**Interfaces:**
- Produces: `export type WallLengthAnchor = "start" | "center" | "end"`
- Produces: `setTopologicalWallLength(document, wallId, lengthMm, anchor?: WallLengthAnchor): VlezetDocument`
- Existing three-argument calls continue to use `anchor = "start"`.

- [ ] **Step 1: Add failing anchor tests**

Add tests proving:

```ts
it("keeps the end fixed when resizing with the end anchor", () => {
  const document = singleWallWithOpening();
  const resized = setTopologicalWallLength(document, "wall", 5000, "end");
  expect(vertex(resized, "a").position).toEqual({ x: -1000, y: 0 });
  expect(vertex(resized, "b").position).toEqual({ x: 4000, y: 0 });
});

it("keeps the midpoint fixed when resizing with the center anchor", () => {
  const document = singleWallWithOpening();
  const resized = setTopologicalWallLength(document, "wall", 6000, "center");
  expect(vertex(resized, "a").position).toEqual({ x: -1000, y: 0 });
  expect(vertex(resized, "b").position).toEqual({ x: 5000, y: 0 });
});

it("preserves opening world position when the start endpoint moves", () => {
  const document = singleWallWithOpening();
  const resized = setTopologicalWallLength(document, "wall", 5000, "end");
  expect(resized.openings[0]?.offset).toBe(2000);
});
```

Fixture:

```ts
function singleWallWithOpening(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
    ],
    walls: [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 }],
    openings: [{ id: "door", wallId: "wall", kind: "door", offset: 1000, width: 900, doorSwing: { hinge: "start", side: "left" } }],
    roomAnnotations: [],
    placedObjects: [],
  };
}
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @vlezet/editor-core test -- topology-editing.test.ts
```

Expected: FAIL because `setTopologicalWallLength` does not accept/implement anchors.

- [ ] **Step 3: Implement anchor geometry minimally**

Add:

```ts
export type WallLengthAnchor = "start" | "center" | "end";
```

Compute new endpoints from original unit direction and length delta:

```ts
const delta = lengthMm - currentLength;
const startShift = anchor === "start" ? 0 : anchor === "center" ? -delta / 2 : -delta;
const endShift = anchor === "end" ? 0 : anchor === "center" ? delta / 2 : delta;
const nextStart = {
  x: start.position.x + ux * startShift,
  y: start.position.y + uy * startShift,
};
const nextEnd = {
  x: end.position.x + ux * endShift,
  y: end.position.y + uy * endShift,
};
```

Compensate openings when start moves:

```ts
const nextOpenings = document.openings.map((opening) => {
  if (opening.wallId !== wallId) return opening;
  return { ...opening, offset: opening.offset - startShift };
});
```

Validate every selected-wall junction and opening against the new segment/length before returning the new document. Call `assertMovedVertexStaysOnHostWalls` for each moved endpoint.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
pnpm --filter @vlezet/editor-core test -- topology-editing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add regression tests for invalid shrink and legacy default**

Add:

```ts
it("keeps legacy start-fixed behavior when anchor is omitted", () => {
  const resized = setTopologicalWallLength(rectangleCornerDocument(), "ab", 8000);
  expect(vertex(resized, "a").position).toEqual({ x: 0, y: 0 });
  expect(vertex(resized, "b").position).toEqual({ x: 8000, y: 0 });
});

it("rejects an end-anchored shrink that would consume an opening", () => {
  const document = singleWallWithOpening();
  expect(() => setTopologicalWallLength(document, "wall", 1500, "end")).toThrow(/проём/i);
});
```

- [ ] **Step 6: Export the type**

Update `packages/editor-core/src/index.ts`:

```ts
export type {
  AddTopologicalWallInput,
  DocumentEdit,
  WallEndpointIntent,
  WallLengthAnchor,
} from "./topology-editing";
```

- [ ] **Step 7: Commit**

```bash
git add packages/editor-core/src/topology-editing.ts packages/editor-core/src/topology-editing.test.ts packages/editor-core/src/index.ts
git commit -m "feat: add anchored wall length editing"
```

---

### Task 2: Wire anchor intent through the editor store

**Files:**
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Add/modify test: `apps/web/components/editor/use-editor-store.test.ts`

**Interfaces:**
- Consumes: `WallLengthAnchor` and anchored `setTopologicalWallLength` from Task 1.
- Produces: `setSelectedWallLength(lengthMm: number, anchor?: WallLengthAnchor): void`.

- [ ] **Step 1: Add failing store test**

Create a store with a selected 4000 mm wall and call:

```ts
store.getState().setSelectedWallLength(6000, "center");
```

Assert the original midpoint remains unchanged and history gains exactly one entry.

- [ ] **Step 2: Run focused web tests and verify RED**

Run:

```bash
pnpm --filter web test -- use-editor-store.test.ts
```

Expected: FAIL because the store method does not accept/pass an anchor.

- [ ] **Step 3: Update store contract**

Import the type:

```ts
import type { WallLengthAnchor } from "@vlezet/editor-core";
```

Change:

```ts
setSelectedWallLength: (lengthMm: number, anchor?: WallLengthAnchor) => void;
```

and implementation:

```ts
setSelectedWallLength: (lengthMm, anchor = "start") => {
  const { history, selectedWallId } = get();
  if (!selectedWallId) return;
  const before = history.document;
  const after = setTopologicalWallLength(before, selectedWallId, lengthMm, anchor);
  set({ history: executeCommand(history, { type: "document/replace", label: "wall/set-length", before, after }) });
},
```

- [ ] **Step 4: Run focused test and verify GREEN**

```bash
pnpm --filter web test -- use-editor-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/use-editor-store.ts apps/web/components/editor/use-editor-store.test.ts
git commit -m "feat: pass wall length anchors through editor store"
```

---

### Task 3: Make wall-length semantics explicit in the inspector

**Files:**
- Modify: `apps/web/components/editor/wall-inspector.tsx`
- Add/modify test: `apps/web/components/editor/wall-inspector.test.tsx`

**Interfaces:**
- Consumes: `WallLengthAnchor` and `editorStore.setSelectedWallLength(length, anchor)`.

- [ ] **Step 1: Add failing UI contract test**

Assert the selected-wall inspector renders:

```text
Длина по оси стены
Что остаётся на месте
Начало
Центр
Конец
```

and does not render the ambiguous label `Точная длина`.

- [ ] **Step 2: Run focused test and verify RED**

```bash
pnpm --filter web test -- wall-inspector.test.tsx
```

Expected: FAIL on missing explicit semantics/anchor UI.

- [ ] **Step 3: Implement inspector anchor control**

Add local state:

```ts
const [lengthAnchor, setLengthAnchor] = useState<WallLengthAnchor>("start");
```

Call:

```ts
editorStore.getState().setSelectedWallLength(value, lengthAnchor);
```

Replace the label with:

```tsx
<label className="field-label" htmlFor="wall-length">Длина по оси стены</label>
```

Add an accessible select:

```tsx
<label className="field-label" htmlFor="wall-length-anchor">Что остаётся на месте</label>
<select
  id="wall-length-anchor"
  className="inspector-select"
  value={lengthAnchor}
  onChange={(event) => setLengthAnchor(event.target.value as WallLengthAnchor)}
>
  <option value="start">Начало</option>
  <option value="center">Центр</option>
  <option value="end">Конец</option>
</select>
```

Add explicit helper copy:

```text
Длина по оси — расстояние между узлами стены. Это не всегда равно чистому внутреннему размеру комнаты.
```

Rename the facts label from bare `Длина` to `По оси`.

- [ ] **Step 4: Run focused UI test and verify GREEN**

```bash
pnpm --filter web test -- wall-inspector.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/wall-inspector.tsx apps/web/components/editor/wall-inspector.test.tsx
git commit -m "feat: clarify wall centreline length semantics"
```

---

### Task 4: Full verification and milestone state

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/CHANGELOG.md`
- Create: `docs/milestones/m4-6-1-acceptance.md`

- [ ] **Step 1: Run full strict verification**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 2: Write browser acceptance**

Acceptance must cover:

```text
select wall
→ verify explicit centreline wording
→ resize with Start anchor
→ Undo/Redo
→ resize with End anchor and verify end stays fixed
→ resize with Center anchor and verify midpoint stays fixed
→ verify doors/windows do not jump when start moves
→ verify invalid shrink fails without partial mutation
→ reload project
```

- [ ] **Step 3: Record roadmap status**

Document that M4.6.1 is the first completed slice and M4.6.2 Clear Internal Room Dimensions is next.

- [ ] **Step 4: Commit**

```bash
git add docs/PROJECT_STATE.md docs/CHANGELOG.md docs/milestones/m4-6-1-acceptance.md
git commit -m "docs: record M4.6.1 wall semantics acceptance"
```
