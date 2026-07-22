# M4.6.4 Dimension Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make clear room dimensions visually obvious on the canvas so a normal user can distinguish `3550 × 3300 mm inside` from wall-centreline dimensions without understanding CAD semantics.

**Architecture:** Keep `VlezetDocument` unchanged and authoritative. Dimension annotations are deterministic UI projections derived from `DerivedRoom`, wall endpoints, and the viewport; they are never persisted and never become geometry authority. Rectangular-room labels expose clear dimensions immediately, while selected entities receive explicit dimension lines with distinct copy for clear-room versus centreline semantics.

**Tech Stack:** TypeScript, React 19, Next.js 16, react-konva/Konva, Zustand, Vitest, `@vlezet/geometry`, `@vlezet/editor-core`.

## Global Constraints

- Millimetres remain the canonical world unit.
- `VlezetDocument` remains `vertices + wall centrelines + thickness`; no persisted dimension annotations or duplicate room dimensions.
- Room clear dimensions must come from the same inner polygon used for room area.
- Dimension annotations are derived projections only.
- Complex/non-rectangular rooms must not receive guessed width/height dimensions.
- Selected-wall dimensions must be explicitly identified as centreline dimensions.
- Keep the physical Konva Layer count within the existing max-5 regression contract.

---

### Task 1: Pure dimension annotation model and room-label copy

**Files:**
- Create: `apps/web/components/editor/dimension-annotations.ts`
- Create: `apps/web/components/editor/dimension-annotations.test.ts`

**Interfaces:**
- Consumes: `DerivedRoom`, `Point2`, `deriveRectangularRoomDimensions`.
- Produces:
  - `type LinearDimensionAnnotation = Readonly<{ kind: "clear-room" | "centreline-wall"; axis: "horizontal" | "vertical" | "free"; start: Point2; end: Point2; valueMm: number; outward: Point2 }>`
  - `deriveRectangularRoomDimensionAnnotations(room: DerivedRoom): readonly LinearDimensionAnnotation[]`
  - `formatRoomCanvasLabel(room: DerivedRoom): string`
  - `deriveWallCentrelineDimensionAnnotation(start: Point2, end: Point2): LinearDimensionAnnotation | null`

- [ ] **Step 1: Write failing tests**

Test a rectangular room whose inner polygon is `3550 × 3300` and assert:

```ts
const annotations = deriveRectangularRoomDimensionAnnotations(room);
expect(annotations).toHaveLength(2);
expect(annotations.map((item) => item.valueMm)).toEqual([3550, 3300]);
expect(formatRoomCanvasLabel(room)).toContain("3550 × 3300 мм внутри");
```

Test an L-shaped room and assert no width/height annotation is guessed and the label contains only name + area.

Test a `3550 mm` wall and assert the wall annotation is `kind: "centreline-wall"` with `valueMm: 3550`.

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm --filter web test -- dimension-annotations.test.ts
```

Expected: FAIL because the module/functions do not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

For rectangular rooms, use the clear inner polygon bounds and place the horizontal annotation on the top inner edge with outward `{ x: 0, y: -1 }`, and the vertical annotation on the left inner edge with outward `{ x: -1, y: 0 }`.

Room label format for supported rectangles:

```text
Комната 3
11.72 м²
3550 × 3300 мм внутри
```

For unsupported shapes, omit the third line rather than guessing.

For walls, derive the centreline length from endpoints and a deterministic left normal.

- [ ] **Step 4: Run tests to verify GREEN**

Run the same targeted Vitest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/dimension-annotations.ts apps/web/components/editor/dimension-annotations.test.ts
git commit -m "feat: derive honest canvas dimension annotations"
```

---

### Task 2: Konva dimension overlay component

**Files:**
- Create: `apps/web/components/editor/dimension-overlay.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx`

**Interfaces:**
- Consumes: `LinearDimensionAnnotation`, `ViewportTransform`, `worldToScreen`.
- Produces: `DimensionOverlay` React component rendering dimension/extension lines, endpoint ticks, and labels without adding a new physical Konva `Layer`.

- [ ] **Step 1: Add a failing pure rendering-contract test**

Extend `dimension-annotations.test.ts` with a test that distinguishes copy:

```ts
expect(formatDimensionValue(roomAnnotation)).toBe("3550 мм внутри");
expect(formatDimensionValue(wallAnnotation)).toBe("3550 мм по оси");
```

Expected initial result: FAIL because `formatDimensionValue` does not exist.

- [ ] **Step 2: Implement `formatDimensionValue` minimally and make test GREEN**

Exact copy:

```text
<value> мм внутри
<value> мм по оси
```

- [ ] **Step 3: Implement `DimensionOverlay`**

Render in the existing non-listening annotation `Layer`:

- extension lines from measured endpoints to a screen-space offset dimension line;
- a dimension line offset by 24 px from the measured geometry;
- short endpoint ticks;
- centered text label with a small opaque light background for readability;
- room clear dimensions use the primary blue annotation treatment;
- wall centreline dimension uses a more technical neutral/slate treatment so the two semantics are not visually conflated;
- `listening={false}` on every annotation node.

Screen-space offset must stay visually stable across zoom; measured endpoints still come from world geometry.

- [ ] **Step 4: Wire selected-room and selected-wall annotations into `EditorCanvas`**

- rectangular room selected: render two clear-room annotations;
- wall selected: render one centreline annotation;
- no supported selected entity: render none;
- reuse the existing annotation `Layer`; do not create another `Layer`.

- [ ] **Step 5: Replace room canvas label construction with `formatRoomCanvasLabel(room)`**

Every rectangular room now immediately exposes its clear internal size under the area, even before selection. Non-rectangular rooms keep name + area only.

- [ ] **Step 6: Run web tests/typecheck**

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/editor/dimension-overlay.tsx apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/dimension-annotations.ts apps/web/components/editor/dimension-annotations.test.ts
git commit -m "feat: show clear room dimensions on canvas"
```

---

### Task 3: Regression and exact-head verification

**Files:**
- Modify only if needed: existing tests/docs/PR description.

**Interfaces:**
- Produces a mergeable M4.6.4 vertical slice with no persistence/schema changes.

- [ ] **Step 1: Run the full strict gate**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all PASS.

- [ ] **Step 2: Verify product acceptance manually in browser**

Scenario:

1. Draw a rectangular room by entering `3550 × 3300` as wall-centreline lengths with 150 mm walls.
2. Confirm the room label immediately states approximately `3400 × 3150 мм внутри` and `10.71 м²`.
3. Select the room and confirm clear dimension lines match `3400` and `3150` on the inner faces.
4. Edit the room clear size to `3550 × 3300` through the room inspector.
5. Confirm label and dimension lines update to `3550 × 3300 мм внутри` and area to approximately `11.72 м²`.
6. Select a wall and confirm its dimension is explicitly labelled `... мм по оси` rather than appearing to be the room clear dimension.
7. Verify Undo/Redo updates labels and lines deterministically.
8. Verify zoom/pan keeps labels readable and does not change measured values.

- [ ] **Step 3: Update canonical docs and PR #7**

Record M4.6.4 as implemented and explicitly note that user feedback reprioritized dimension lines ahead of thickness-alignment UI because discoverability/mental-model trust was the immediate blocker.

- [ ] **Step 4: Final exact-head CI evidence**

Record the final HEAD SHA and passing GitHub Actions run in PR #7.
