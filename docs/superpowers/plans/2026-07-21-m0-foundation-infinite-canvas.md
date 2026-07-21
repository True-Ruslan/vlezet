# M0 — Foundation and Infinite Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the first usable Vlezet editor slice: a millimetre-based infinite 2D canvas with pan/zoom, adaptive grid, wall drawing, deterministic snapping, exact wall length editing, selection, and command-oriented undo/redo.

**Architecture:** Keep the apartment document framework-independent. `@vlezet/domain` owns persistent entities, `@vlezet/geometry` owns deterministic math, `@vlezet/editor-core` owns commands/history/editing operations, and `apps/web` translates browser/Konva input into core operations. Viewport pixels and transient tool state never enter the persisted document.

**Tech Stack:** Node.js >=22.13, pnpm 11.15.1, Turborepo 2.10.5, TypeScript 6.0.3, Next.js 16.2.10, React 19.2.7, Konva 10.3.0, react-konva 19.2.5, Zustand 5.0.14, Vitest 4.1.10.

> TypeScript 6.0.3 is intentionally pinned instead of current TypeScript 7 because the current `@typescript-eslint/parser` compatibility range is `<6.1.0`. Upgrade only after the lint toolchain officially supports TypeScript 7.

## Global constraints

- Millimetres are the canonical world unit.
- Screen pixels are never persisted as apartment geometry.
- Domain/geometry/editor-core must not depend on React, Konva, or Next.js.
- Canvas objects are projections, not source data.
- Project documents are schema-versioned from day one.
- Undo/redo is command-oriented and records one semantic entry per completed gesture.
- Pointer interactions are local and do not depend on network round-trips.
- M0 explicitly excludes auth, database persistence, doors/windows, room detection, furniture, import, 3D, and AI.

## File map

```text
vlezet/
├── apps/web/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/editor/
│       ├── apartment-editor.tsx
│       ├── editor-canvas.tsx
│       ├── editor-toolbar.tsx
│       ├── keyboard.ts
│       ├── use-editor-store.ts
│       └── wall-inspector.tsx
├── packages/domain/src/
├── packages/geometry/src/
├── packages/editor-core/src/
├── docs/milestones/m0-acceptance.md
├── .github/workflows/ci.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Task 1 — Workspace foundation

**Deliverable:** Installable TypeScript monorepo with Next.js app and independent domain packages.

- Root package manager: `pnpm@11.15.1`.
- Node floor: `>=22.13.0`.
- Workspace packages: `@vlezet/domain`, `@vlezet/geometry`, `@vlezet/editor-core`, `web`.
- Root commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm dev`.
- Turborepo orchestrates build/test/typecheck; ESLint runs from the root.

Verification:

```bash
pnpm install
pnpm typecheck
pnpm build
```

## Task 2 — Schema-versioned domain document

**Files:** `packages/domain/src/document.ts`, `wall.ts`, `index.ts`, tests.

Interfaces:

```ts
type Millimeters = number;
type Point2 = Readonly<{ x: Millimeters; y: Millimeters }>;
type Wall = Readonly<{
  id: string;
  start: Point2;
  end: Point2;
  thickness: Millimeters;
}>;
type VlezetDocument = Readonly<{
  schemaVersion: 1;
  walls: readonly Wall[];
}>;
```

TDD acceptance:

- `createEmptyDocument()` returns `{ schemaVersion: 1, walls: [] }`.
- `createWall` preserves exact millimetre coordinates and caller-provided stable ID.

## Task 3 — Viewport geometry and adaptive grid

**Files:** `packages/geometry/src/point.ts`, `viewport.ts`, `grid.ts`, tests.

Interfaces:

```ts
type ViewportTransform = {
  offsetX: number;
  offsetY: number;
  pixelsPerMillimeter: number;
};

worldToScreen(point, viewport)
screenToWorld(point, viewport)
zoomViewportAt(viewport, anchor, factor, limits)
chooseGridStep(pixelsPerMillimeter)
```

Required tests:

- world -> screen -> world round-trip;
- pointer-centred zoom preserves the world point under the pointer;
- grid steps come from `[50,100,250,500,1000,2000,5000,10000]` mm;
- selected grid spacing remains at least about 28 screen pixels.

## Task 4 — Deterministic snapping

**File:** `packages/geometry/src/snapping.ts` + tests.

Priority:

```text
endpoint > axis > grid > none
```

API returns both the winning snapped point and guide metadata. Rendering must not recompute the decision.

Required tests:

- endpoint beats axis/grid;
- near-horizontal/vertical input aligns to wall start;
- otherwise nearest grid intersection wins;
- identical inputs produce identical outputs.

## Task 5 — Command history and exact wall length

**Files:** `packages/editor-core/src/commands.ts`, `history.ts`, `wall-editing.ts`, tests.

Public command surface:

```ts
type EditorCommand =
  | { type: "wall/add"; wall: Wall }
  | { type: "wall/replace"; before: Wall; after: Wall };
```

History requirements:

- add -> undo -> redo restores exact documents;
- a new command after undo clears redo history;
- pointer movement does not create history entries;
- a completed wall gesture creates exactly one history entry.

Exact length behavior:

- start point remains fixed;
- direction remains unchanged;
- zero, negative, NaN, Infinity, and zero-length source walls are rejected.

## Task 6 — Editor state store

**File:** `apps/web/components/editor/use-editor-store.ts` + tests.

Persistent state delegates to editor-core `HistoryState`.

Ephemeral state:

```ts
type EditorTool = "select" | "wall";
type DraftWall = {
  start: Point2;
  end: Point2;
  snap: SnapResult;
} | null;
```

Actions:

- set tool;
- select wall;
- begin/update/commit/cancel wall draft;
- edit selected wall exact length;
- undo/redo.

Tests prove:

- commit produces one command;
- cancel produces none;
- exact length produces one replace command;
- wall tool chains the next draft from the committed endpoint;
- selection is cleared safely if undo removes the selected wall.

## Task 7 — Infinite Canvas

**File:** `apps/web/components/editor/editor-canvas.tsx`.

Implementation requirements:

- responsive Stage via `ResizeObserver`;
- viewport is local ephemeral state;
- wheel zoom is pointer-centred and clamped to `0.01..2 px/mm`;
- pan via middle mouse or `Space + primary drag`;
- visible grid lines only, with small overscan;
- snapping tolerance is a fixed 12 px converted into world millimetres;
- wall thickness is stored in mm and projected to pixels only for rendering.

## Task 8 — Wall interaction and snapping UX

Two-click/chain flow:

1. Activate Wall (`W`).
2. First click establishes snapped start.
3. Pointer move previews snapped end and guide.
4. Next click commits one wall command.
5. Next draft starts automatically from the committed endpoint.
6. `Esc` cancels the chain and returns to Select.

Canvas renders:

- committed walls;
- draft wall;
- endpoint affordances;
- axis guide metadata;
- live draft length in millimetres.

## Task 9 — Selection, exact-length inspector, shortcuts

**Files:** `editor-toolbar.tsx`, `wall-inspector.tsx`, `keyboard.ts`, `apartment-editor.tsx`.

Shortcuts:

```text
V                  Select
W                  Wall
Esc                Cancel chain / Select
Ctrl/Cmd+Z         Undo
Ctrl/Cmd+Shift+Z   Redo
Ctrl/Cmd+Y         Redo
```

Inspector validates exact positive finite millimetres before committing a `wall/replace` command.

## Task 10 — CI and acceptance

GitHub Actions must run on push/PR:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The first CI run may generate `pnpm-lock.yaml`; it should be committed after successful dependency resolution and subsequent CI should use the committed lockfile.

Manual acceptance is documented in `docs/milestones/m0-acceptance.md`.

## Definition of done

M0 is done only when:

- all automated checks are green;
- a clean checkout installs reproducibly with committed lockfile;
- the browser editor demonstrates pan, pointer-centred zoom, adaptive grid, wall drawing, snapping, selection, exact length editing, and semantic undo/redo;
- no persisted model contains screen-pixel geometry;
- no deferred M1+ capability is prematurely coupled into the M0 core.
