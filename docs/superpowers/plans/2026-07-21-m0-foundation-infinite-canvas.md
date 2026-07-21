# M0 — Foundation and Infinite Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first demonstrable Vlezet editor where a user can pan/zoom an infinite millimetre-based canvas, draw a wall, receive basic snapping assistance, set an exact wall length, and undo/redo edits.

**Architecture:** Use a TypeScript monorepo. Framework-independent domain, geometry, and editor-core packages own persistent data and deterministic operations. The Next.js web app renders that state through Konva and keeps viewport/tool/selection state ephemeral. Canvas pixels never become source-of-truth geometry.

**Tech Stack:** Node.js >=22.13, pnpm 11.15.1, Turborepo 2.10.5, TypeScript 7.0.2, Next.js 16.2.10, React 19.2.7, Konva 10.3.0, react-konva 19.2.5, Zustand 5.0.14, Vitest 4.1.10.

## Global Constraints

- TypeScript is the primary implementation language.
- Millimetres are the canonical world unit.
- Screen pixels are never persisted as apartment geometry.
- Domain and geometry packages do not depend on React, Konva, or Next.js.
- Canvas objects are projections, not source data.
- Project documents are schema-versioned from the first implementation.
- Undo/redo is command-oriented.
- Pointer interactions remain local and low-latency.
- M0 does not add auth, database persistence, 3D, AI, room detection, doors/windows, or furniture.

---

## File map

```text
vlezet/
├── apps/web/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/editor/
│   │   ├── apartment-editor.tsx
│   │   ├── editor-canvas.tsx
│   │   ├── editor-toolbar.tsx
│   │   ├── wall-inspector.tsx
│   │   └── use-editor-store.ts
│   ├── package.json
│   └── tsconfig.json
├── packages/domain/
│   ├── src/document.ts
│   ├── src/wall.ts
│   ├── src/index.ts
│   └── src/*.test.ts
├── packages/geometry/
│   ├── src/point.ts
│   ├── src/viewport.ts
│   ├── src/grid.ts
│   ├── src/snapping.ts
│   ├── src/index.ts
│   └── src/*.test.ts
├── packages/editor-core/
│   ├── src/commands.ts
│   ├── src/history.ts
│   ├── src/wall-editing.ts
│   ├── src/index.ts
│   └── src/*.test.ts
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── .gitignore
```

---

### Task 1: Bootstrap the monorepo and web shell

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`
- Create package manifests/tsconfigs for `packages/domain`, `packages/geometry`, `packages/editor-core`

**Interfaces:**
- Produces workspace packages `@vlezet/domain`, `@vlezet/geometry`, `@vlezet/editor-core`.
- Produces root scripts `dev`, `build`, `test`, `typecheck`, `lint`.

- [ ] **Step 1: Create workspace manifests and TypeScript configuration**

Use exact workspace boundaries and dependency directions. `domain` has no internal dependencies; `geometry` has no UI/framework dependencies; `editor-core` may depend on `domain` and `geometry`; `web` may depend on all three.

- [ ] **Step 2: Install dependencies and commit the lockfile**

Run:

```bash
corepack enable
pnpm install
```

Expected: `pnpm-lock.yaml` is generated without peer-dependency errors that block installation.

- [ ] **Step 3: Verify the empty application shell**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: both commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: bootstrap Vlezet monorepo"
```

---

### Task 2: Define the schema-versioned wall document

**Files:**
- Create: `packages/domain/src/document.test.ts`
- Create: `packages/domain/src/document.ts`
- Create: `packages/domain/src/wall.ts`
- Create: `packages/domain/src/index.ts`

**Interfaces:**
- Produces `Millimeters`, `Point2`, `Wall`, `VlezetDocument`.
- Produces `createEmptyDocument(): VlezetDocument`.
- Produces `createWall(input): Wall` with stable caller-provided IDs.

- [ ] **Step 1: Write failing tests**

Tests must prove:

```ts
expect(createEmptyDocument()).toEqual({ schemaVersion: 1, walls: [] });
```

and that `createWall` preserves exact millimetre coordinates/thickness without pixel conversion.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/domain test
```

Expected: FAIL because the domain API does not exist.

- [ ] **Step 3: Implement the minimal domain model**

Use:

```ts
export type Millimeters = number;
export type Point2 = Readonly<{ x: Millimeters; y: Millimeters }>;
export type Wall = Readonly<{
  id: string;
  start: Point2;
  end: Point2;
  thickness: Millimeters;
}>;

export type VlezetDocument = Readonly<{
  schemaVersion: 1;
  walls: readonly Wall[];
}>;
```

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @vlezet/domain test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): add schema-versioned wall document"
```

---

### Task 3: Implement deterministic viewport transforms and adaptive grid

**Files:**
- Create: `packages/geometry/src/viewport.test.ts`
- Create: `packages/geometry/src/viewport.ts`
- Create: `packages/geometry/src/grid.test.ts`
- Create: `packages/geometry/src/grid.ts`
- Create: `packages/geometry/src/point.ts`
- Create: `packages/geometry/src/index.ts`

**Interfaces:**
- Produces `ViewportTransform { offsetX, offsetY, pixelsPerMillimeter }`.
- Produces `worldToScreen(point, viewport)`.
- Produces `screenToWorld(point, viewport)`.
- Produces `zoomViewportAt(viewport, screenAnchor, factor, limits)` preserving the world point under the pointer.
- Produces `chooseGridStep(pixelsPerMillimeter): Millimeters`.

- [ ] **Step 1: Write failing transform tests**

Cover exact round-trip conversion and pointer-anchored zoom:

```ts
const world = { x: 1500, y: -750 };
expect(screenToWorld(worldToScreen(world, viewport), viewport)).toEqual(world);
```

For zoom, assert the world coordinate below the pointer is unchanged before/after zoom within floating-point tolerance.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/geometry test -- viewport grid
```

Expected: FAIL because APIs are missing.

- [ ] **Step 3: Implement transforms and adaptive grid**

Grid steps must come from this finite sequence:

```ts
[50, 100, 250, 500, 1000, 2000, 5000, 10000]
```

Choose the first step whose screen spacing is at least 28 px; fall back to the largest step.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @vlezet/geometry test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/geometry
git commit -m "feat(geometry): add viewport transforms and adaptive grid"
```

---

### Task 4: Implement basic wall snapping

**Files:**
- Create: `packages/geometry/src/snapping.test.ts`
- Create: `packages/geometry/src/snapping.ts`
- Modify: `packages/geometry/src/index.ts`

**Interfaces:**
- Produces:

```ts
type SnapKind = 'endpoint' | 'axis' | 'grid' | 'none';
type SnapGuide = Readonly<{ axis: 'x' | 'y'; value: number }>;
type SnapResult = Readonly<{
  point: Point2;
  kind: SnapKind;
  guides: readonly SnapGuide[];
}>;

snapWallPoint({ rawPoint, startPoint, endpoints, gridStep, tolerance }): SnapResult
```

- [ ] **Step 1: Write failing tests for priority and determinism**

Required cases:

1. Nearby existing endpoint wins over grid/axis.
2. With no endpoint, a point near horizontal alignment snaps `y` to `startPoint.y`.
3. With no endpoint/axis candidate, point snaps to nearest grid intersection.
4. Repeated calls with identical input return identical output.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/geometry test -- snapping
```

Expected: FAIL.

- [ ] **Step 3: Implement priority `endpoint > axis > grid > none`**

Endpoint candidates use Euclidean distance. Axis candidates compare absolute x/y deviation against tolerance. Grid uses nearest multiple of `gridStep`.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @vlezet/geometry test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/geometry
git commit -m "feat(geometry): add deterministic wall snapping"
```

---

### Task 5: Add command-oriented history and exact wall-length editing

**Files:**
- Create: `packages/editor-core/src/history.test.ts`
- Create: `packages/editor-core/src/history.ts`
- Create: `packages/editor-core/src/commands.ts`
- Create: `packages/editor-core/src/wall-editing.test.ts`
- Create: `packages/editor-core/src/wall-editing.ts`
- Create: `packages/editor-core/src/index.ts`

**Interfaces:**
- Produces command union:

```ts
type EditorCommand =
  | { type: 'wall/add'; wall: Wall }
  | { type: 'wall/replace'; before: Wall; after: Wall };
```

- Produces:

```ts
type HistoryState = {
  document: VlezetDocument;
  past: readonly HistoryEntry[];
  future: readonly HistoryEntry[];
};

executeCommand(state, command): HistoryState;
undo(state): HistoryState;
redo(state): HistoryState;
setWallLength(wall, lengthMm): Wall;
```

- [ ] **Step 1: Write failing history tests**

Prove add -> undo -> redo returns exact documents and that executing a new command clears redo history.

- [ ] **Step 2: Write failing exact-length tests**

For a wall from `(0,0)` to `(3000,4000)`, setting length to `10000` must keep the start fixed and preserve direction, producing `(6000,8000)`.

Reject non-finite or non-positive lengths with a domain-level error.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @vlezet/editor-core test
```

Expected: FAIL.

- [ ] **Step 4: Implement command application/inversion and length editing**

History stores one semantic entry per completed gesture. Do not create one entry per pointer-move event.

- [ ] **Step 5: Run GREEN**

```bash
pnpm --filter @vlezet/editor-core test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/editor-core
git commit -m "feat(editor-core): add command history and wall length editing"
```

---

### Task 6: Build the client editor store

**Files:**
- Create: `apps/web/components/editor/use-editor-store.test.ts`
- Create: `apps/web/components/editor/use-editor-store.ts`

**Interfaces:**
- Persistent state delegates to `HistoryState` from editor-core.
- Ephemeral state contains:

```ts
type EditorTool = 'select' | 'wall';
type DraftWall = { start: Point2; end: Point2; snap: SnapResult } | null;
```

- Store actions include `setTool`, `selectWall`, `beginWall`, `updateDraftWall`, `commitDraftWall`, `setSelectedWallLength`, `undo`, `redo`.

- [ ] **Step 1: Write failing store tests**

Use Zustand vanilla store construction for tests. Verify:

- committing a draft wall creates exactly one history entry;
- cancelling a draft creates none;
- exact-length edit creates one `wall/replace` history entry;
- undo/redo delegates correctly.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter web test -- use-editor-store
```

Expected: FAIL.

- [ ] **Step 3: Implement minimal store**

ID generation occurs only at wall commit using `crypto.randomUUID()` in the browser, with injectable ID factory in tests.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/use-editor-store*
git commit -m "feat(web): add editor state store"
```

---

### Task 7: Render the infinite canvas with pan, zoom, and adaptive grid

**Files:**
- Create: `apps/web/components/editor/editor-canvas.tsx`
- Create: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- `EditorCanvas` owns only DOM/Konva rendering and pointer translation.
- It consumes world data from the store and geometry helpers.
- Viewport state is ephemeral and never serialized into the domain document.

- [ ] **Step 1: Add a browser-facing smoke test for transform behavior where practical**

At minimum keep viewport mathematics covered in geometry tests. Add component-level tests only for DOM behavior that does not require re-testing Konva internals.

- [ ] **Step 2: Implement responsive Stage sizing**

Use `ResizeObserver`; do not bind world coordinates to initial browser dimensions.

- [ ] **Step 3: Implement pan**

Support middle-button drag and `Space + primary-button drag`. Panning changes viewport offset only.

- [ ] **Step 4: Implement pointer-centred wheel zoom**

Clamp `pixelsPerMillimeter` to a practical range equivalent to approximately `0.01` through `2` px/mm.

- [ ] **Step 5: Render adaptive grid**

Compute visible world bounds from the viewport. Render only visible grid lines plus a modest overscan; never create an unbounded number of Konva nodes.

- [ ] **Step 6: Verify**

```bash
pnpm typecheck
pnpm --filter web test
pnpm build
```

Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): add infinite canvas pan zoom and grid"
```

---

### Task 8: Add wall drawing, snapping guides, and selection

**Files:**
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Create: `apps/web/components/editor/editor-toolbar.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`

**Interfaces:**
- Wall tool uses `screenToWorld` before all geometry operations.
- Snapping tolerance is converted from a fixed screen tolerance (12 px) into world millimetres by dividing by current `pixelsPerMillimeter`.
- Rendered wall width uses `wall.thickness * pixelsPerMillimeter` but source thickness stays in millimetres.

- [ ] **Step 1: Write interaction-state tests before production behavior changes**

Extend store tests for two-click wall creation and selection transitions.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter web test
```

Expected: new tests fail.

- [ ] **Step 3: Implement two-click wall creation**

First click establishes snapped start. Pointer movement updates a snapped preview. Second click commits one `wall/add` command and chains the next draft start from the committed end so connected wall drawing is fast. `Escape` cancels the active draft and returns to select mode.

- [ ] **Step 4: Render snap guides and endpoint affordances**

Guides are projections of `SnapResult.guides`; the UI must not re-run snapping decisions.

- [ ] **Step 5: Implement wall selection**

Clicking a wall in select mode sets `selectedWallId`. Clicking empty canvas clears selection unless panning.

- [ ] **Step 6: Run GREEN and build**

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): add wall drawing snapping and selection"
```

---

### Task 9: Add exact-length inspector and undo/redo UX

**Files:**
- Create: `apps/web/components/editor/wall-inspector.tsx`
- Modify: `apps/web/components/editor/editor-toolbar.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/use-editor-store.ts`

**Interfaces:**
- Inspector displays selected wall length in millimetres and metres.
- Editing exact length uses `setWallLength` from editor-core and commits one `wall/replace` command.
- Keyboard shortcuts: `Ctrl/Cmd+Z` undo; `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y` redo.

- [ ] **Step 1: Add failing tests for exact-length action and keyboard command helpers**

Do not test browser key dispatch if a pure shortcut-mapping helper can be tested instead.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter web test
```

Expected: FAIL for new behavior.

- [ ] **Step 3: Implement inspector**

Invalid input stays local to the field and is not committed. Commit on Enter or explicit Apply action. Positive finite millimetres only.

- [ ] **Step 4: Implement undo/redo buttons and shortcuts**

Buttons reflect history availability. Undo/redo must restore exact wall geometry and current selection must safely clear if its entity no longer exists.

- [ ] **Step 5: Run GREEN**

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add exact wall length and undo redo UX"
```

---

### Task 10: M0 verification, documentation, and acceptance

**Files:**
- Modify: `README.md`
- Create: `docs/milestones/m0-acceptance.md`

**Interfaces:**
- Documents local run commands and M0 controls.
- Records known non-goals without promising unfinished features.

- [ ] **Step 1: Run the complete verification suite**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all exit 0.

- [ ] **Step 2: Perform manual acceptance**

Verify in a desktop browser:

1. Canvas fills the editor workspace.
2. Wheel zoom keeps the same world point under the cursor.
3. Middle-drag and Space+drag pan without changing geometry.
4. Grid spacing adapts as zoom changes.
5. Wall tool creates a wall in real world millimetres.
6. Nearby endpoint snapping is visibly preferred.
7. Horizontal/vertical assistance works.
8. Exact length edit preserves wall direction and start point.
9. Undo removes/restores a committed wall or length edit one semantic action at a time.
10. No persisted model contains screen-pixel geometry.

- [ ] **Step 3: Update README and acceptance document**

Document:

```bash
corepack enable
pnpm install
pnpm dev
```

and the controls for select, wall, pan, zoom, cancel, undo, redo.

- [ ] **Step 4: Final commit**

```bash
git add README.md docs/milestones/m0-acceptance.md
git commit -m "docs: document M0 editor controls and acceptance"
```

---

## Self-review

- M0 scope is one independently testable vertical slice.
- Every persistent geometry value is millimetre-based.
- React/Konva dependencies remain in the web app only.
- Geometry and history are tested without canvas/browser dependencies.
- Snapping has deterministic priority and exposes guide metadata.
- Wall gestures create one history entry, not one per pointer move.
- No auth/database/3D/import/AI work is included.
- No placeholder tasks remain.

## Definition of done

M0 is complete only when a clean checkout can run `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` successfully, and the browser acceptance flow demonstrates pan/zoom/grid/wall drawing/snapping/exact length/undo/redo on the same schema-versioned millimetre document.