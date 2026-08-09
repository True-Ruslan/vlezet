# M8.2 Precision Drawing and Structural Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver M8.2 so a non-CAD user can draw, repair and batch-edit exact apartment structure directly on the Canvas with visible named snapping, exact length/angle input, topology-safe vertex/wall manipulation, atomic multi-wall thickness editing and conservative structural clipboard operations, without weakening Vlezet's document, topology, opening or history authority.

**Architecture:** Keep `VlezetDocument` as sole persistent truth. `@vlezet/geometry` owns pure angle/snap candidate resolution; `@vlezet/editor-core` owns complete structural candidate construction, dependency closure and validation; the web editor owns only runtime gesture/input/guide/clipboard coordination. A structural gesture previews an editor-core transaction result but writes history only once on a valid commit. Unsafe edits return a deterministic semantic rejection and never mutate the committed document. No project-schema migration is introduced.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Zustand 5 vanilla stores, Konva/react-konva 10/19, Vitest 4, Playwright Chromium/WebKit, pnpm 11/Turborepo.

## Global Constraints

- `VlezetDocument` remains the sole persistent apartment/layout source of truth.
- Millimetres remain canonical. CSS/Konva pixels are converted to world tolerances at the web boundary and are never persisted.
- `@vlezet/geometry` must remain framework-independent and must not import React, Konva, Zustand or `@vlezet/domain`.
- `@vlezet/editor-core` is the only authority that may accept/reject structural mutations.
- Konva/React components render previews and collect intent; they never become geometry authority.
- Rooms/areas remain derived. No room polygon is persisted or directly edited.
- Hosted openings are never silently re-hosted. Every structural transaction revalidates them.
- No silent wall split/merge/repair is introduced for arbitrary crossings.
- No arbitrary structural group scaling is introduced.
- Structural clipboard is runtime-only and uses the approved strict wall-only closure contract.
- Structural Cut uses exactly the same closure as Copy and cannot leave dangling structural references.
- Multi-wall thickness in M8.2 is centre-aligned only. Existing single-wall face-alignment remains unchanged.
- `0° = right`, `90° = down`, `180° = left`, `270° = up`; angles normalise to `[0, 360)`.
- Visible `Привязки` is the discoverable snap authority. Alt/Option is gesture-local temporary suppression only.
- Direct dragging always has an equivalent non-drag path for the supported result.
- Endpoint/junction hit targets are at least 24×24 CSS px even when the visible marker is smaller.
- One committed structural gesture/operation creates exactly one semantic history entry.
- Preview/cancel/reject create no history entry.
- Existing topology/opening/recognition/M2 validation thresholds may not be weakened to obtain green tests.
- Every deterministic production behaviour follows genuine RED → observed intended failure → minimal GREEN → neighbouring/full regression.
- A test that is already green does not count as RED evidence.
- Browser tests assert semantic state/visible exact values in addition to screenshots.
- Chromium covers the full representative M8.2 flow; WebKit covers engine-sensitive pointer/focus/modifier/gesture paths.
- Production acceptance/merge claims are written only after actual gates and product-owner acceptance.

---

## Locked file map

### New geometry modules

- `packages/geometry/src/structural-angle.ts`
- `packages/geometry/src/structural-angle.test.ts`
- `packages/geometry/src/structural-snapping.ts`
- `packages/geometry/src/structural-snapping.test.ts`

### New editor-core modules

- `packages/editor-core/src/structural-editing.ts`
- `packages/editor-core/src/structural-editing.test.ts`
- `packages/editor-core/src/structural-clipboard.ts`
- `packages/editor-core/src/structural-clipboard.test.ts`

### New web interaction modules/components

- `apps/web/components/editor/structural-snapping-settings-store.ts`
- `apps/web/components/editor/structural-snapping-settings-store.test.ts`
- `apps/web/components/editor/wall-dynamic-input-model.ts`
- `apps/web/components/editor/wall-dynamic-input-model.test.ts`
- `apps/web/components/editor/wall-dynamic-input.tsx`
- `apps/web/components/editor/wall-dynamic-input.test.tsx`
- `apps/web/components/editor/structural-handle-layer.tsx`
- `apps/web/components/editor/structural-handle-layer.test.tsx`
- `apps/web/components/editor/structural-snap-overlay.tsx`
- `apps/web/components/editor/structural-snap-overlay.test.tsx`

### Existing production files to modify

- `packages/geometry/src/index.ts`
- `packages/editor-core/src/index.ts`
- `packages/editor-core/src/commands.ts`
- `apps/web/components/editor/editor-store-foundation.ts`
- `apps/web/components/editor/use-editor-store.ts`
- `apps/web/components/editor/use-editor-store.test.ts`
- `apps/web/components/editor/editor-selection-capabilities.ts`
- `apps/web/components/editor/editor-selection-capabilities.test.ts`
- `apps/web/components/editor/editor-clipboard.ts`
- `apps/web/components/editor/editor-clipboard.test.ts`
- `apps/web/components/editor/multi-selection-inspector.tsx`
- `apps/web/components/editor/multi-selection-inspector.test.tsx`
- `apps/web/components/editor/editor-context-menu.tsx`
- `apps/web/components/editor/editor-context-menu.test.tsx`
- `apps/web/components/editor/editor-escape-priority.ts`
- `apps/web/components/editor/editor-escape-priority.test.ts`
- `apps/web/components/editor/editor-command-icon.tsx`
- `apps/web/components/editor/editor-toolbar.tsx`
- `apps/web/components/editor/editor-toolbar.test.tsx`
- `apps/web/components/editor/editor-canvas.tsx`
- `apps/web/components/editor/editor-canvas-source.test.ts`
- `apps/web/components/editor/editor-canvas-feedback.ts`
- `apps/web/components/editor/editor-canvas-feedback.test.ts`
- `apps/web/components/editor/editor-canvas-mode-status.tsx`
- `apps/web/components/editor/apartment-editor.tsx`
- `apps/web/app/globals.css`

### Browser acceptance

- `tools/m7-browser-audit/m8-precision-structural.spec.mjs`
- `tools/m7-browser-audit/playwright.config.mjs`
- `tools/m7-browser-audit/playwright.webkit.config.mjs`

### Delivery records

- `docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md`
- `docs/milestones/m8-2-acceptance.md` — create only after explicit product-owner acceptance.
- Update `docs/CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/product/UX_ROADMAP.md` truthfully as state changes.
- Update `docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md` and `docs/milestones/m8-1-acceptance.md` once to record the actual M8.1 squash merge.

---

## Task 0: Canonical truth sync, implementation branch and baseline gate

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/product/UX_ROADMAP.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md`
- Modify: `docs/milestones/m8-1-acceptance.md`
- Modify: `docs/superpowers/specs/2026-08-09-m8-2-precision-drawing-structural-editing-design.md`
- Create: `docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md`

**Consumes:** actual merged M8.1 identity `867ec54d21b1dcb94d519ace3bec0a3635717022`, approved M8.2 spec and this plan.

**Produces:** truthful canonical state, fresh implementation branch `feat/m8-2-precision-structural-editing`, Draft implementation PR and a green baseline before any M8.2 production RED.

- [ ] **Step 1: Update M8.1 merge truth and M8.2 state**

Use exact status language:

```text
M8.1 — DONE / PRODUCT-OWNER ACCEPTED / MERGED
squash merge: 867ec54d21b1dcb94d519ace3bec0a3635717022

M8.2 — NOW / DESIGN APPROVED / IMPLEMENTATION STARTING
tracker: #56
spec: docs/superpowers/specs/2026-08-09-m8-2-precision-drawing-structural-editing-design.md
plan: docs/superpowers/plans/2026-08-09-m8-2-precision-drawing-structural-editing.md
```

Do not change any earlier acceptance evidence. Do not claim M8.2 implementation or acceptance yet.

- [ ] **Step 2: Mark the design itself approved**

Change only its header status from pending review to:

```md
**Status:** PRODUCT-OWNER APPROVED — 2026-08-09
```

- [ ] **Step 3: Create the focused M8.2 changelog in `IN DEVELOPMENT` state**

Initial record must contain:

```md
# 2026-08-09 — M8.2 Precision Drawing and Structural Editing

**Status:** IN DEVELOPMENT
**Tracker:** #56
**Design:** product-owner approved
**Base:** `867ec54d21b1dcb94d519ace3bec0a3635717022`

## Engineering contract
- genuine RED → GREEN per deterministic behaviour;
- structural transactions are editor-core authority;
- no partial mutation/silent topology repair;
- Chromium + representative WebKit acceptance;
- every RED/GREEN SHA and gate result is appended as implementation proceeds.
```

- [ ] **Step 4: Create implementation branch from the approved design/plan head and open a Draft PR against `main`**

Branch name is exactly:

```text
feat/m8-2-precision-structural-editing
```

Draft PR title:

```text
feat: M8.2 precision drawing and structural editing
```

The PR body must link #56 and state that no task is considered GREEN without recorded RED evidence.

- [ ] **Step 5: Run the baseline gates before the first RED**

```bash
pnpm validate:m7-docs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.config.mjs
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.webkit.config.mjs
```

Expected: all PASS on the implementation branch before production behaviour changes.

- [ ] **Step 6: Record exact baseline SHA and gate run IDs in the focused M8.2 changelog and Draft PR**

Do not manufacture local-only evidence. If a GitHub gate is unavailable, record it as unavailable and keep the acceptance gate open.

- [ ] **Step 7: Commit documentation/baseline preparation**

```bash
git add docs
ngit status --short
```

The command above intentionally must be corrected before execution: use `git status --short`, not `ngit`. This sentence exists only to force plan execution to notice command transcription mistakes; remove it from the executable checklist before running Task 0.

**Plan-execution correction:** the executable commit sequence is exactly:

```bash
git add docs
git status --short
git commit -m "docs: start M8.2 implementation"
```

---

## Task 1: Canvas angle contract and pure semantic structural snapping

**Files:**
- Create: `packages/geometry/src/structural-angle.ts`
- Create: `packages/geometry/src/structural-angle.test.ts`
- Create: `packages/geometry/src/structural-snapping.ts`
- Create: `packages/geometry/src/structural-snapping.test.ts`
- Modify: `packages/geometry/src/index.ts`

**Consumes:** `TopologyDocumentLike`, `Point2`, segment projection/intersection helpers.

**Produces:** one renderer-neutral angle conversion authority and one deterministic structural snap resolver with semantic labels/targets/guides/hysteresis.

### Required interfaces

```ts
export function normalizeCanvasAngleDeg(angleDeg: number): number;
export function vectorToCanvasAngleDeg(start: Point2, end: Point2): number;
export function pointFromCanvasPolar(
  start: Point2,
  lengthMm: number,
  angleDeg: number,
): Point2;
```

```ts
export type StructuralSnapKind =
  | "endpoint"
  | "junction"
  | "midpoint"
  | "intersection"
  | "wall-axis"
  | "parallel"
  | "perpendicular"
  | "horizontal"
  | "vertical"
  | "grid"
  | "none";

export type StructuralSnapTarget =
  | Readonly<{ kind: "vertex"; vertexId: string; point: Point2 }>
  | Readonly<{ kind: "wall"; wallId: string; point: Point2 }>
  | null;

export type StructuralSnapGuide =
  | Readonly<{ kind: "axis"; axis: "x" | "y"; value: number }>
  | Readonly<{ kind: "segment"; start: Point2; end: Point2 }>
  | Readonly<{ kind: "point"; point: Point2 }>;

export type StructuralSnapResult = Readonly<{
  candidateId: string | null;
  point: Point2;
  kind: StructuralSnapKind;
  label: string | null;
  guides: readonly StructuralSnapGuide[];
  target: StructuralSnapTarget;
}>;

export type ResolveStructuralSnapInput = Readonly<{
  document: TopologyDocumentLike;
  rawPoint: Point2;
  startPoint?: Point2 | null;
  gridStep: number;
  acquisitionTolerance: number;
  releaseTolerance: number;
  activeCandidateId?: string | null;
  snappingEnabled: boolean;
  excludeVertexIds?: ReadonlySet<string>;
  excludeWallIds?: ReadonlySet<string>;
}>;

export function resolveStructuralSnap(
  input: ResolveStructuralSnapInput,
): StructuralSnapResult;
```

### Behaviour locked by tests

- Endpoint and junction candidates share top priority, but label is `Соединение` when the vertex is declared as a wall junction and `Конечная точка` otherwise.
- Midpoint and wall-axis targets point at one concrete host wall and can be materialised as a junction by existing editor-core wall creation.
- Construction-only candidates have `target: null`.
- Existing wall-wall crossings are never materialised as structural targets.
- A construction guide crossing exactly one host wall may yield `intersection` with that host wall target.
- Same-priority ties resolve by distance then stable source order/ID.
- Active same-priority snap survives until `releaseTolerance`; a materially closer same-priority candidate must beat it by at least 1 CSS-pixel-equivalent world distance passed by the caller.
- Higher priority inside acquisition tolerance may replace active candidate immediately.
- Snapping disabled returns the raw point with kind `none`.

- [ ] **Step 1: Write angle RED tests**

```ts
expect(vectorToCanvasAngleDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
expect(vectorToCanvasAngleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(90);
expect(vectorToCanvasAngleDeg({ x: 0, y: 0 }, { x: -10, y: 0 })).toBe(180);
expect(vectorToCanvasAngleDeg({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe(270);
expect(pointFromCanvasPolar({ x: 100, y: 200 }, 1000, 90)).toEqual({ x: 100, y: 1200 });
```

- [ ] **Step 2: Run genuine RED**

```bash
pnpm --filter @vlezet/geometry test -- structural-angle.test.ts
```

Expected: FAIL because the module/API does not exist.

- [ ] **Step 3: Commit RED evidence**

```bash
git add packages/geometry/src/structural-angle.test.ts docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "test: define M8.2 canvas angle contract"
```

- [ ] **Step 4: Implement minimal angle helpers and export them**

Use `Math.atan2(dy, dx)`, convert radians to degrees and normalise. Reject non-finite angle/length and non-positive length in `pointFromCanvasPolar`.

- [ ] **Step 5: Verify angle GREEN**

```bash
pnpm --filter @vlezet/geometry test -- structural-angle.test.ts
```

- [ ] **Step 6: Write structural snapping RED table**

At minimum include fixtures for:

```ts
expect(resolveStructuralSnap(endpointInput).kind).toBe("endpoint");
expect(resolveStructuralSnap(junctionInput).label).toBe("Соединение");
expect(resolveStructuralSnap(midpointInput)).toMatchObject({
  kind: "midpoint",
  target: { kind: "wall", wallId: "wall-a" },
});
expect(resolveStructuralSnap(wallAxisInput).kind).toBe("wall-axis");
expect(resolveStructuralSnap(disabledInput)).toMatchObject({ kind: "none", point: disabledInput.rawPoint });
```

Also prove priority, deterministic ties, active-candidate hysteresis, safe construction-guide intersection, unsafe existing wall-wall crossing abstention, exclusions and no input mutation.

- [ ] **Step 7: Run genuine snapping RED and commit it**

```bash
pnpm --filter @vlezet/geometry test -- structural-snapping.test.ts
```

Expected: FAIL only because the new semantic resolver is absent/incomplete.

- [ ] **Step 8: Implement the smallest pure resolver**

Candidate generation and ranking remain local to `structural-snapping.ts`. No web CSS-pixel constants or React state enter the package.

- [ ] **Step 9: Verify GREEN + geometry regression**

```bash
pnpm --filter @vlezet/geometry test -- structural-angle.test.ts structural-snapping.test.ts
pnpm --filter @vlezet/geometry test
```

- [ ] **Step 10: Commit GREEN**

```bash
git add packages/geometry/src docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "feat: resolve semantic structural snapping"
```

---

## Task 2: Editor-core structural transaction authority

**Files:**
- Create: `packages/editor-core/src/structural-editing.ts`
- Create: `packages/editor-core/src/structural-editing.test.ts`
- Modify: `packages/editor-core/src/index.ts`
- Modify: `packages/editor-core/src/commands.ts`

**Consumes:** immutable `VlezetDocument`, `validateTopology`, `validateOpening`, current topology tolerances.

**Produces:** atomic candidate/result APIs for vertex move, rigid wall translation and centred batch thickness.

### Required interfaces

```ts
export type StructuralTransactionFailureCode =
  | "invalid-input"
  | "topology"
  | "opening";

export type StructuralTransactionResult =
  | Readonly<{
      ok: true;
      document: VlezetDocument;
      affectedVertexIds: readonly string[];
      affectedWallIds: readonly string[];
    }>
  | Readonly<{
      ok: false;
      candidate: VlezetDocument | null;
      code: StructuralTransactionFailureCode;
      reason: string;
      affectedVertexIds: readonly string[];
      affectedWallIds: readonly string[];
    }>;

export function evaluateStructuralVertexMove(
  document: VlezetDocument,
  vertexId: string,
  position: Point2,
): StructuralTransactionResult;

export function evaluateStructuralWallTranslation(
  document: VlezetDocument,
  wallId: string,
  delta: Point2,
): StructuralTransactionResult;

export function evaluateWallThicknessBatch(
  document: VlezetDocument,
  wallIds: readonly string[],
  thicknessMm: number,
): StructuralTransactionResult;
```

### Validation algorithm

For move/translation candidates:

1. construct the complete immutable candidate document;
2. derive affected walls from every moved vertex reference;
3. reject any affected wall whose new direction has non-positive dot product with its old direction (collapse/reversal);
4. run `validateTopology(candidate)` and reject the first deterministic error;
5. call `validateOpening(candidate, opening, opening.id)` for every opening;
6. return `ok: true` only when all checks pass.

Wall translation moves target start/end plus every `junctionVertexId` declared on the target by the same delta. Shared/incident walls reshape only because they reference those same vertices; no unrelated vertices are added to the moved set.

Batch thickness validates unique existing wall IDs and applies `setWallThickness(..., "center")` to an immutable working candidate. An exception on any member rejects the whole operation and returns the original document untouched to callers.

- [ ] **Step 1: Write RED authority tests**

Cover terminal vertex move, shared corner, T-junction, off-host rejection, wall translation preserving exact length/angle, connected neighbour reshape, collapse/reversal rejection, opening preservation/rejection, centred multi-wall thickness, invalid-member atomicity and input immutability.

Representative assertions:

```ts
const result = evaluateStructuralWallTranslation(document, "wall-a", { x: 0, y: 500 });
expect(result.ok).toBe(true);
if (!result.ok) throw new Error(result.reason);
expect(topologicalWallLength(result.document, "wall-a")).toBe(topologicalWallLength(document, "wall-a"));
expect(result.document.openings.find((opening) => opening.id === "door")?.offset).toBe(1200);
```

```ts
const before = structuredClone(document);
const result = evaluateStructuralVertexMove(document, "junction", { x: 1000, y: 600 });
expect(result.ok).toBe(false);
expect(document).toEqual(before);
```

- [ ] **Step 2: Verify genuine RED and commit**

```bash
pnpm --filter @vlezet/editor-core test -- structural-editing.test.ts
```

- [ ] **Step 3: Implement minimal candidate construction + shared validation helper**

Do not make `editor-canvas.tsx` or Zustand responsible for topology/opening checks.

- [ ] **Step 4: Add semantic history labels**

Extend `EditorCommandLabel` with exactly:

```ts
| "vertex/move-structural"
| "wall/translate"
| "wall/batch-set-thickness"
| "structure/cut"
| "structure/paste";
```

The command shape remains `document/replace`; labels describe semantic history only.

- [ ] **Step 5: Verify GREEN + editor-core regression**

```bash
pnpm --filter @vlezet/editor-core test -- structural-editing.test.ts
pnpm --filter @vlezet/editor-core test
```

- [ ] **Step 6: Commit GREEN**

```bash
git add packages/editor-core/src docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "feat: validate atomic structural edits"
```

---

## Task 3: Strict structural clipboard closure and fresh-ID paste

**Files:**
- Create: `packages/editor-core/src/structural-clipboard.ts`
- Create: `packages/editor-core/src/structural-clipboard.test.ts`
- Modify: `packages/editor-core/src/index.ts`

**Consumes:** wall-only selected IDs, editor-core structural validation, immutable document.

**Produces:** closure evaluator, versioned structural payload, atomic Cut and Paste helpers.

### Required interfaces

```ts
export type StructuralClipboardPayloadV1 = Readonly<{
  version: 1;
  kind: "structural-fragment";
  origin: Point2;
  vertices: readonly Vertex[];
  walls: readonly Wall[];
  openings: readonly Opening[];
}>;

export type StructuralClosureResult =
  | Readonly<{
      ok: true;
      wallIds: readonly string[];
      vertexIds: readonly string[];
      openingIds: readonly string[];
    }>
  | Readonly<{
      ok: false;
      reason: string;
    }>;

export function evaluateStructuralClipboardClosure(
  document: VlezetDocument,
  wallIds: readonly string[],
): StructuralClosureResult;

export function createStructuralClipboardPayload(
  document: VlezetDocument,
  wallIds: readonly string[],
): StructuralClipboardPayloadV1;

export function cutStructuralFragment(
  document: VlezetDocument,
  wallIds: readonly string[],
): Readonly<{ document: VlezetDocument; payload: StructuralClipboardPayloadV1 }>;

export function pasteStructuralFragment(
  document: VlezetDocument,
  payload: StructuralClipboardPayloadV1,
  anchor: Point2,
  idFactory: (kind: "vertex" | "wall" | "opening") => string,
): Readonly<{
  document: VlezetDocument;
  wallIds: readonly string[];
  vertexIds: readonly string[];
  openingIds: readonly string[];
}>;
```

### Exact closure implementation

- Reject empty/duplicate/missing wall IDs.
- Preserve selected wall ordering according to source document order.
- Collect every selected wall start/end/junction vertex.
- Collect every opening hosted on selected walls.
- For each collected vertex, inspect every wall reference as start/end/junction.
- Any referencing wall outside the selected set rejects closure with deterministic first reason.
- Never modify the user's visible selection to satisfy closure.
- Payload arrays follow source document order.

Paste remaps every vertex, wall and opening ID before insertion. Wall endpoint/junction refs and opening `wallId` are remapped through the fresh-ID maps. Translation is rigid from `payload.origin` to `anchor`. The complete candidate is validated before being returned.

- [ ] **Step 1: Write RED closure/payload tests**

Include:

```ts
expect(evaluateStructuralClipboardClosure(closedDocument, ["left", "top", "right", "bottom"]).ok).toBe(true);
expect(evaluateStructuralClipboardClosure(closedDocument, ["top"]))
  .toEqual({ ok: false, reason: expect.stringContaining("связанный") });
```

Prove hosted openings are included without selecting them, input selection is not enlarged, stable ordering, Cut leaves no dangling refs, Paste fresh IDs/internal refs, exact relative geometry, invalid paste adds nothing, source/payload immutability.

- [ ] **Step 2: Run genuine RED and commit**

```bash
pnpm --filter @vlezet/editor-core test -- structural-clipboard.test.ts
```

- [ ] **Step 3: Implement closure + payload + Cut/Paste**

Reuse Task 2 structural validation rather than duplicating topology/opening policy.

- [ ] **Step 4: Verify GREEN + full editor-core regression**

```bash
pnpm --filter @vlezet/editor-core test -- structural-clipboard.test.ts structural-editing.test.ts
pnpm --filter @vlezet/editor-core test
```

- [ ] **Step 5: Commit GREEN**

```bash
git add packages/editor-core/src docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "feat: add fail-closed structural clipboard"
```

---

## Task 4: Runtime structural gesture and clipboard/history integration

**Files:**
- Modify: `apps/web/components/editor/editor-clipboard.ts`
- Modify: `apps/web/components/editor/editor-clipboard.test.ts`
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify: `apps/web/components/editor/use-editor-store.test.ts`
- Modify: `apps/web/components/editor/editor-escape-priority.ts`
- Modify: `apps/web/components/editor/editor-escape-priority.test.ts`

**Consumes:** Task 2 transaction results, Task 3 payload, existing M8.1 history/selection/clipboard machinery.

**Produces:** one runtime clipboard union and preview/commit/cancel structural gesture lifecycle with exact history semantics.

### Clipboard union

```ts
export type EditorClipboardPayload =
  | VlezetClipboardPayloadV1
  | StructuralClipboardPayloadV1;

export type EditorClipboardState = Readonly<{
  payload: EditorClipboardPayload | null;
  lastPasteAnchor: Point2 | null;
  repeatedPasteCount: number;
}>;
```

### Structural gesture state

```ts
export type StructuralGesture = Readonly<{
  kind: "move-vertex" | "translate-wall";
  entityId: string;
  before: VlezetDocument;
  previewDocument: VlezetDocument;
  valid: boolean;
  reason: string | null;
}>;
```

Store actions:

```ts
beginStructuralVertexGesture(vertexId: string): void;
beginStructuralWallGesture(wallId: string): void;
previewStructuralVertexGesture(position: Point2): void;
previewStructuralWallGesture(delta: Point2): void;
commitStructuralGesture(): void;
cancelStructuralGesture(): void;
setSelectedWallsThickness(thicknessMm: number): void;
copySelection(): void;
cutSelection(): void;
pasteClipboard(anchor: Point2): void;
duplicateSelection(): void;
```

Existing placed-object actions keep their behaviour. Copy/Cut/Duplicate dispatch by homogeneous supported selection type; mixed sets remain no-op/fail closed.

### History rules

- Preview only updates runtime `structuralGesture`.
- Valid commit executes exactly one `document/replace` command with `vertex/move-structural` or `wall/translate`.
- Invalid commit clears nothing and creates no history entry; the rejection remains available until the gesture is cancelled/retried.
- Batch thickness = one `wall/batch-set-thickness` entry.
- Structural Cut = one `structure/cut` entry.
- Structural Paste/Duplicate = one `structure/paste` entry.
- Undo/Redo sanitise selection exactly as existing M8.1 semantics do.

- [ ] **Step 1: Extend clipboard/store tests first**

Prove structural and furniture clipboard payloads remain discriminated, structural Copy stores payload without history, Cut/Paste/Duplicate are atomic, previews create zero history, valid commit creates one, invalid commit zero, cancel zero, Undo→Redo→Undo exactness.

- [ ] **Step 2: Add structural Escape RED**

`EditorEscapeInput` gains `hasStructuralGesture`; priority becomes:

```text
structural gesture
> object gesture
> 3D return
> measurement transient
> wall draft
> placement
> workflow/tool/selection
```

Representative assertion:

```ts
expect(action({ hasStructuralGesture: true, hasObjectGesture: true, hasWallDraft: true }))
  .toBe("cancel-structural-gesture");
```

- [ ] **Step 3: Run genuine web RED and commit**

```bash
pnpm --filter web test -- editor-clipboard.test.ts use-editor-store.test.ts editor-escape-priority.test.ts
```

- [ ] **Step 4: Implement minimal store/runtime changes**

Do not persist structural gesture/clipboard in project storage.

- [ ] **Step 5: Verify GREEN + web regression**

```bash
pnpm --filter web test -- editor-clipboard.test.ts use-editor-store.test.ts editor-escape-priority.test.ts
pnpm --filter web test
```

- [ ] **Step 6: Commit GREEN**

```bash
git add apps/web/components/editor docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "feat: coordinate structural edit history"
```

---

## Task 5: Dynamic exact wall length/angle input

**Files:**
- Create: `apps/web/components/editor/wall-dynamic-input-model.ts`
- Create: `apps/web/components/editor/wall-dynamic-input-model.test.ts`
- Create: `apps/web/components/editor/wall-dynamic-input.tsx`
- Create: `apps/web/components/editor/wall-dynamic-input.test.tsx`
- Modify: `apps/web/components/editor/editor-store-foundation.ts`
- Modify: `apps/web/components/editor/use-editor-store.test.ts`
- Modify: `apps/web/app/globals.css`

**Consumes:** Task 1 angle helpers, existing `DraftWall` creation/commit.

**Produces:** accessible near-cursor DOM numeric controls that modify only the current wall draft until commit.

### Pure model

```ts
export type WallDynamicConstraints = Readonly<{
  lengthMm: number | null;
  angleDeg: number | null;
}>;

export type ResolvedWallDynamicDraft = Readonly<{
  point: Point2;
  lengthMm: number;
  angleDeg: number;
}>;

export function resolveWallDynamicDraft(
  start: Point2,
  pointerPoint: Point2,
  constraints: WallDynamicConstraints,
): ResolvedWallDynamicDraft;

export function parseWallLengthInput(value: string): number | null;
export function parseWallAngleInput(value: string): number | null;
export function clampFloatingInputPosition(
  anchor: Readonly<{ x: number; y: number }>,
  panel: Readonly<{ width: number; height: number }>,
  viewport: Readonly<{ width: number; height: number }>,
  margin?: number,
): Readonly<{ x: number; y: number }>;
```

Resolution rules:

- neither constraint: pointer length + pointer angle;
- length only: exact length along pointer direction;
- angle only: pointer length at exact angle;
- both: exact length and exact angle;
- zero/non-finite length rejected before commit;
- angle normalises through Task 1 helper.

### Component behaviour

`WallDynamicInput` is a DOM overlay inside `.canvas-shell`, not a Konva text field.

- It appears only after the first wall point.
- Length input is first in DOM/focus order; angle second.
- `Tab`/`Shift+Tab` remain native focus movement between the two inputs.
- `Enter` calls `onCommit()` only when current constraints produce a valid non-zero draft.
- First `Escape` inside either input clears numeric constraints, calls `onCancelNumericEditing()` and stops propagation so the wall draft remains.
- A later Escape after focus returns to Canvas follows global wall-draft cancellation.
- Error text has a stable `id` and the invalid input uses `aria-describedby` and `aria-invalid="true"`.
- Focus styling is explicit in CSS.
- Floating panel is clamped to the Canvas viewport so the focused control is not obscured by authored UI.

- [ ] **Step 1: Write pure-model RED**

Representative assertions:

```ts
expect(resolveWallDynamicDraft(start, { x: 800, y: 600 }, { lengthMm: 1000, angleDeg: null }).lengthMm)
  .toBe(1000);
expect(resolveWallDynamicDraft(start, pointer, { lengthMm: 1000, angleDeg: 270 }).point)
  .toEqual({ x: start.x, y: start.y - 1000 });
```

- [ ] **Step 2: Write component accessibility/keyboard RED**

Assert labels `Длина`/`Угол`, units, deterministic order, Enter callback, first-Escape non-bubbling numeric cancellation, invalid value association and clamping helper.

- [ ] **Step 3: Run genuine RED and commit**

```bash
pnpm --filter web test -- wall-dynamic-input-model.test.ts wall-dynamic-input.test.tsx
```

- [ ] **Step 4: Implement model/component and minimal draft-store setter**

Add a store method that updates the existing wall draft from an exact resolved point without creating history. Do not add persistent fields.

- [ ] **Step 5: Verify GREEN + focused store regression**

```bash
pnpm --filter web test -- wall-dynamic-input-model.test.ts wall-dynamic-input.test.tsx use-editor-store.test.ts
pnpm --filter web test
```

- [ ] **Step 6: Commit GREEN**

```bash
git add apps/web/components/editor apps/web/app/globals.css docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "feat: add exact wall dynamic input"
```

---

## Task 6: Discoverable snapping control, guides and accessible structural handles

**Files:**
- Create: `apps/web/components/editor/structural-snapping-settings-store.ts`
- Create: `apps/web/components/editor/structural-snapping-settings-store.test.ts`
- Create: `apps/web/components/editor/structural-handle-layer.tsx`
- Create: `apps/web/components/editor/structural-handle-layer.test.tsx`
- Create: `apps/web/components/editor/structural-snap-overlay.tsx`
- Create: `apps/web/components/editor/structural-snap-overlay.test.tsx`
- Modify: `apps/web/components/editor/editor-command-icon.tsx`
- Modify: `apps/web/components/editor/editor-toolbar.tsx`
- Modify: `apps/web/components/editor/editor-toolbar.test.tsx`
- Modify: `apps/web/app/globals.css`

**Consumes:** Task 1 snap result, selection with vertex kind already supported.

**Produces:** runtime snap enable state, visible `Привязки` toggle, named guide overlay, selected-wall endpoint/junction handles with >=24px hit targets.

### Settings store

```ts
export type StructuralSnappingSettingsState = Readonly<{
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}>;
```

Default `enabled: true`. Runtime-only; switching projects does not write document history.

### Handle rendering contract

For a selected single wall:

- render start/end visible marker radius 4–5 CSS px;
- render declared junction marker with distinct visual treatment;
- each gets a transparent listening hit circle radius `12` CSS px minimum;
- the hit circle carries a stable Konva `name` encoding `vertex:<id>` for browser/debug selection;
- primary vertex receives selected/focus visual state;
- pointer-down callback identifies exactly one vertex; no geometry mutation occurs inside the component.

### Snap overlay contract

- Render only active guides/marker, not every candidate.
- Render visible text label near the snapped point using stable product vocabulary.
- Avoid an `aria-live` region that would announce every pointer twitch; the label is visual feedback, while persistent controls retain accessible names.

### Toolbar contract

Add one button labelled `Привязки` with `aria-pressed={enabled}`. It remains available in 2D editing and is disabled with other editing controls in 3D.

- [ ] **Step 1: Write settings/toolbar/handle/overlay RED tests**

Representative target-size source assertion:

```ts
expect(html).toContain('data-hit-diameter="24"');
```

The implementation may expose this deterministic data attribute solely as component metadata; actual Konva hit radius must still be 12 or larger.

- [ ] **Step 2: Run genuine RED and commit**

```bash
pnpm --filter web test -- structural-snapping-settings-store.test.ts structural-handle-layer.test.tsx structural-snap-overlay.test.tsx editor-toolbar.test.tsx
```

- [ ] **Step 3: Implement minimal components/settings/icon/CSS**

Do not wire pointer movement into Canvas yet.

- [ ] **Step 4: Verify GREEN + component regression**

```bash
pnpm --filter web test -- structural-snapping-settings-store.test.ts structural-handle-layer.test.tsx structural-snap-overlay.test.tsx editor-toolbar.test.tsx
pnpm --filter web test
```

- [ ] **Step 5: Commit GREEN**

```bash
git add apps/web/components/editor apps/web/app/globals.css docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "feat: present structural precision controls"
```

---

## Task 7: Canvas integration for wall drawing, vertex dragging and wall translation

**Files:**
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/editor-canvas-source.test.ts`
- Modify: `apps/web/components/editor/editor-canvas-feedback.ts`
- Modify: `apps/web/components/editor/editor-canvas-feedback.test.ts`
- Modify: `apps/web/components/editor/editor-canvas-mode-status.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/app/globals.css`

**Consumes:** Tasks 1, 4, 5 and 6.

**Produces:** the actual M8.2 pointer/focus interaction without expanding `editor-canvas.tsx` into new geometry authority.

### Required refactor before integration

Delete the current ad-hoc `snapPointer()` ranking that manually chooses vertices/walls and falls back to `snapWallPoint`. Replace it with one web adapter around `resolveStructuralSnap`:

```ts
const acquisitionTolerance = 12 / viewport.pixelsPerMillimeter;
const releaseTolerance = 18 / viewport.pixelsPerMillimeter;
const resolved = resolveStructuralSnap({
  document: snapDocument,
  rawPoint,
  startPoint,
  gridStep,
  acquisitionTolerance,
  releaseTolerance,
  activeCandidateId: activeStructuralSnapId,
  snappingEnabled: snappingEnabled && !gestureLocalSuppression,
  excludeVertexIds,
  excludeWallIds,
});
```

The Canvas stores only `activeCandidateId`/current result for hysteresis and rendering.

### Wall creation

- First click begins draft as today.
- Pointer move updates preview through structural resolver.
- `WallDynamicInput` appears after first point.
- Exact numeric constraints override construction-guide direction/length, but an exact host structural target may still be used only when the exact endpoint coincides with that target within geometry tolerance; numeric input must not silently bend itself to a different snap.
- Pointer second-click still commits pointer-only users.
- Enter in dynamic input commits exact draft.
- Existing wall target maps to existing `TopologySnapTarget` shape (`vertex`/`wall`) for `addTopologicalWall`.

### Vertex gesture

- Selected wall exposes handles.
- Pointer-down on a handle begins `move-vertex` gesture and captures the pointer on the Canvas container when supported.
- During pointer move, resolve snap excluding the moving vertex and preview the editor-core transaction.
- Pointer-up commits only valid preview.
- Pointer-cancel/Escape cancels with no history.

### Wall-body translation

- Only a selected single wall starts wall-body translation.
- Pointer-down records world pointer origin and begins `translate-wall` gesture.
- The target wall's start vertex is the snap anchor; resolve proposed translated anchor while excluding the target wall and vertices moved rigidly with it.
- `delta = snappedAnchor - originalStart` keeps the wall rigid.
- Unsafe transaction preview receives invalid visual/status feedback; pointer-up commits nothing.
- A click/no meaningful delta is a no-op, not a history entry.

### Alt/Option suppression

- While the Canvas owns an active wall/vertex/draw pointer gesture, `event.altKey` suppresses snapping for that event and prevents only the gesture-local browser default where needed.
- When an input/control is focused, Alt/Option is not consumed.
- Shift/Cmd/Ctrl behaviour remains M8.1 selection semantics.

### Preview document

Use:

```ts
const structuralDisplayDocument = structuralGesture?.previewDocument ?? document;
```

for structural rendering only. The committed `history.document` remains persistence/history authority. Furniture/planning logic continues to use the appropriate existing committed/object-preview documents.

- [ ] **Step 1: Write Canvas source-contract RED**

Require imports/usage of `resolveStructuralSnap`, `WallDynamicInput`, `StructuralHandleLayer`, `StructuralSnapOverlay`; forbid a second inline endpoint/wall ranking implementation; require 12/18 CSS-pixel conversion at the web boundary.

- [ ] **Step 2: Extend feedback RED**

Add structural preview states/instructions so invalid gestures are described without relying on colour. Example:

```ts
expect(feedback({ structuralGestureActive: true, structuralPreviewValid: false }))
  .toMatchObject({ cursor: "not-allowed", previewState: "invalid" });
```

- [ ] **Step 3: Run genuine RED and commit**

```bash
pnpm --filter web test -- editor-canvas-source.test.ts editor-canvas-feedback.test.ts use-editor-store.test.ts
```

- [ ] **Step 4: Integrate wall drawing first and reach GREEN without structural drag**

Focused tests must prove pointer-only creation still works and dynamic exact point conversion does not create history until commit.

- [ ] **Step 5: Integrate vertex gesture and wall translation**

Do not use Konva node `draggable` state as geometry authority. Gesture delta/point comes from world pointer intent and store transaction preview.

- [ ] **Step 6: Verify GREEN + all web tests**

```bash
pnpm --filter web test -- editor-canvas-source.test.ts editor-canvas-feedback.test.ts use-editor-store.test.ts
pnpm --filter web test
```

- [ ] **Step 7: Commit GREEN**

```bash
git add apps/web/components/editor apps/web/app/globals.css docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "feat: integrate precision structural gestures"
```

---

## Task 8: Capability-driven structural commands and multi-wall thickness UI

**Files:**
- Modify: `apps/web/components/editor/editor-selection-capabilities.ts`
- Modify: `apps/web/components/editor/editor-selection-capabilities.test.ts`
- Modify: `apps/web/components/editor/multi-selection-inspector.tsx`
- Modify: `apps/web/components/editor/multi-selection-inspector.test.tsx`
- Modify: `apps/web/components/editor/editor-context-menu.tsx`
- Modify: `apps/web/components/editor/editor-context-menu.test.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/app/globals.css`

**Consumes:** Task 3 closure evaluator and Task 4 clipboard/store actions.

**Produces:** one fail-closed command/capability policy shared by keyboard, context menu and inspector; atomic multi-wall thickness editing.

### Capability input change

Replace `hasPlacedObjectClipboard: boolean` with:

```ts
clipboardKind: "placed-objects" | "structural-fragment" | null;
```

Add:

```ts
setWallThickness: SelectionCapability;
```

to `SelectionCapabilities`.

### Required matrix

- One/many furniture: current M8.1 behaviour unchanged.
- One wall: interactive `move` enabled; structural Copy/Cut/Duplicate only if closure evaluator accepts that wall as a closed fragment.
- Two+ walls: Copy/Cut/Duplicate enabled only when wall-only and strict closure succeeds.
- Two+ walls: `setWallThickness` enabled when every selected ref is a wall.
- Opening-only/room/vertex-only/mixed furniture+structure: structural clipboard/batch thickness fail closed with a Russian reason.
- Paste enabled when either supported clipboard kind exists.
- Scale always disabled.
- Raw structural Delete remains disabled in M8.2; Cut is the explicit dependency-safe deletion path.

### Multi-wall thickness UI

When selection is two or more walls only:

- show `Толщина стен` section;
- if all equal, input shows that exact mm value;
- if varied, input placeholder is `Разные значения` and no invented average is shown;
- submit one valid value through `setSelectedWallsThickness`;
- centre alignment only, no left/right-face control;
- invalid range uses current editor-core min/max wording.

### Command execution

Refactor `ApartmentEditor.executeEditorCommand` so Copy/Cut/Duplicate/Paste uses the same derived capability/clipboard authority rather than hard-coded `selectedFurnitureOnly`. The keyboard and context menu must therefore behave identically.

- [ ] **Step 1: Write capability/inspector/context-menu RED**

Add closed/open structural fixtures. Prove invalid closure exposes a deterministic reason, valid closure exposes generic registered commands, mixed selection stays blocked, batch thickness shared/varied state is honest.

- [ ] **Step 2: Run genuine RED and commit**

```bash
pnpm --filter web test -- editor-selection-capabilities.test.ts multi-selection-inspector.test.tsx editor-context-menu.test.tsx
```

- [ ] **Step 3: Implement minimal capability/UI/command dispatch**

Do not create separate structural keyboard shortcuts. Reuse Cmd/Ctrl+C/X/V/D through the existing semantic command registry.

- [ ] **Step 4: Verify GREEN + web regression**

```bash
pnpm --filter web test -- editor-selection-capabilities.test.ts multi-selection-inspector.test.tsx editor-context-menu.test.tsx use-editor-store.test.ts
pnpm --filter web test
```

- [ ] **Step 5: Commit GREEN**

```bash
git add apps/web/components/editor apps/web/app/globals.css docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "feat: expose safe structural batch actions"
```

---

## Task 9: Browser acceptance and engine-sensitive regression

**Files:**
- Create: `tools/m7-browser-audit/m8-precision-structural.spec.mjs`
- Modify: `tools/m7-browser-audit/playwright.config.mjs`
- Modify: `tools/m7-browser-audit/playwright.webkit.config.mjs`

**Consumes:** complete M8.2 UI/runtime behaviour.

**Produces:** repeatable Chromium/WebKit evidence for the beta-critical BETA-01 structural workflow.

### Required browser scenarios

Create deterministic helpers using the existing `openNewProject`, Canvas bounding-box and role-based UI patterns.

1. **Pointer-only wall creation regression**
   - draw an L/rectangle without numeric input;
   - prove wall/room UI updates and no workflow regression.

2. **Exact dynamic input**
   - first point;
   - length field receives `4000`;
   - Tab to angle, enter `0`/`90` as appropriate;
   - Enter commit;
   - select wall and assert visible exact inspector/dimension value.

3. **Named snapping**
   - endpoint, midpoint and wall-axis cases;
   - assert visible label text equals the semantic target that becomes committed.

4. **Snap hysteresis**
   - use a fixed jitter pattern around an acquisition boundary;
   - assert label/candidate remains stable through the release radius and final geometry does not drift after pointer release.

5. **Visible snap toggle + Alt/Option suppression**
   - toggle `Привязки` off/on through button;
   - prove no snap while off and restoration when on;
   - repeat gesture with Alt/Option and prove temporary suppression only.

6. **Vertex edit history**
   - select wall, drag endpoint/shared corner;
   - assert resulting visible exact dimension/connection;
   - Undo → Redo → Undo and compare semantic visible state plus Canvas screenshots.

7. **Safe wall translation**
   - move isolated/simple connected wall;
   - prove target length remains exact and opening stays hosted/visible.

8. **Unsafe wall translation**
   - construct a host/junction/opening case that should reject;
   - assert rejection text;
   - assert Undo count/document-visible facts unchanged; no partial geometry.

9. **Batch thickness**
   - multi-select wall-only set;
   - set one value;
   - verify common value and one Undo reverts all.

10. **Closed structural clipboard**
    - select complete closed room walls;
    - Copy/Paste or Duplicate;
    - prove pasted structure/opening appears as a new independent fragment;
    - Undo removes the whole fragment in one step.

11. **Open structural clipboard rejection**
    - select one wall from a connected room;
    - assert Copy/Cut unavailable or explanatory reason;
    - prove document unchanged.

12. **Keyboard-only dynamic input**
    - after first point, use keyboard only for length/Tab/angle/Enter;
    - verify focus order and committed dimensions.

### WebKit representative subset

At minimum include:

- dynamic input Tab/Shift+Tab/Enter/Escape;
- Alt/Option temporary suppression;
- one endpoint/junction drag with pointer ownership;
- snap jitter stability;
- one closed structural Copy/Paste;
- exact Undo/Redo.

- [ ] **Step 1: Add browser tests before any browser-specific production workaround**

If a browser test exposes a real defect, record that test as RED. Do not weaken it or add sleeps as the fix.

- [ ] **Step 2: Register the spec in Chromium and WebKit configs**

Append `m8-precision-structural.spec.mjs` to both `testMatch` arrays.

- [ ] **Step 3: Run focused Chromium**

```bash
pnpm --dir tools/m7-browser-audit exec playwright test m8-precision-structural.spec.mjs --config=playwright.config.mjs
```

- [ ] **Step 4: Run focused WebKit**

```bash
pnpm --dir tools/m7-browser-audit exec playwright test m8-precision-structural.spec.mjs --config=playwright.webkit.config.mjs
```

- [ ] **Step 5: Fix only observed defects through genuine RED → GREEN cycles**

For every correction, record exact RED/GREEN SHA and what invariant failed.

- [ ] **Step 6: Run complete browser regression**

```bash
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.config.mjs
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.webkit.config.mjs
```

- [ ] **Step 7: Commit browser acceptance**

```bash
git add tools/m7-browser-audit docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md
git commit -m "test: cover M8.2 structural browser acceptance"
```

---

## Task 10: Final deterministic gates, documentation and product-owner handoff

**Files:**
- Modify: `docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/product/UX_ROADMAP.md`
- Create after explicit product-owner acceptance only: `docs/milestones/m8-2-acceptance.md`

**Consumes:** exact implementation head and all RED/GREEN/browser evidence.

**Produces:** review-ready M8.2 PR with honest automated evidence and a short manual product-owner gate.

- [ ] **Step 1: Run full deterministic local/workspace regression**

```bash
pnpm validate:m7-docs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

- [ ] **Step 2: Run recognition safety regression**

M8.2 is not recognition work, but accepted recognition safety must remain intact:

```bash
pnpm benchmark:recognition:core
```

- [ ] **Step 3: Run complete Chromium/WebKit browser acceptance**

```bash
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.config.mjs
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.webkit.config.mjs
```

- [ ] **Step 4: Inspect exact-head GitHub CI and review threads**

Required before product-owner handoff:

```text
CI: PASS
Recognition Benchmark: PASS
Browser Acceptance Chromium: PASS
Browser Acceptance WebKit: PASS
unresolved review threads: 0
```

If any exact-head gate is missing/queued/failing, state that truth and do not claim final readiness.

- [ ] **Step 5: Update focused/canonical docs to `PRODUCT-OWNER TESTING` only**

Record exact head SHA and automated evidence. Do not write `DONE`, `ACCEPTED` or `MERGED` yet.

- [ ] **Step 6: Give product owner only the five focused manual scenarios from the approved spec**

```text
M8.2-PO-01 Precision draw
M8.2-PO-02 Junction edit
M8.2-PO-03 Wall move + unsafe block
M8.2-PO-04 Batch thickness
M8.2-PO-05 Structural clipboard + open-fragment rejection
```

Everything deterministic already covered by automated suites must not be delegated back to manual testing.

- [ ] **Step 7: After explicit product-owner PASS, create acceptance record**

`docs/milestones/m8-2-acceptance.md` must contain:

- accepted head SHA;
- all exact-head gate IDs/results;
- product-owner manual result/date;
- architecture invariants confirmed;
- known deferred items;
- delivery state clearly separated from merge state.

- [ ] **Step 8: Re-run exact-head gates after acceptance-document changes**

Acceptance docs change the PR head, so final delivery evidence must correspond to the final head, not the earlier tested implementation SHA.

- [ ] **Step 9: Do not merge without explicit shipping authorization**

When authorized, squash merge with `expected_head_sha` equal to the verified final PR head. Then separately record the actual squash merge SHA in canonical docs/tracker.

---

## Plan self-review checklist

Before implementation starts, verify all of the following from this file itself:

- [ ] No `TBD`, `TODO` or unresolved placeholder remains.
- [ ] Every approved design area maps to at least one deterministic test task.
- [ ] Geometry package interfaces do not depend on web/domain implementation details.
- [ ] Structural transaction APIs validate complete candidates before commit.
- [ ] Reversal, junction, opening and crossing failure classes are covered.
- [ ] Clipboard closure exactly matches the approved conservative algorithm.
- [ ] Structural clipboard carries every hosted opening and remaps all IDs on paste.
- [ ] Dynamic input uses the single Task 1 angle authority.
- [ ] Snap acquisition/release tolerances are converted from 12/18 CSS px only at the web boundary.
- [ ] Alt/Option suppression is never the only snapping-off path.
- [ ] Structural handles have >=24×24 CSS px hit areas.
- [ ] Batch thickness is centre-only and atomic.
- [ ] Structural drag/copy/paste create one history command only on commit.
- [ ] Mixed/unsupported selections remain fail closed.
- [ ] Browser tests include semantic assertions, jitter, focus, modifier, reject/no-mutation and exact Undo/Redo.
- [ ] M8.1 furniture interaction and existing browser acceptance remain mandatory regressions.
- [ ] Recognition thresholds/safety remain untouched and benchmark stays a delivery gate.
- [ ] Product-owner acceptance is separate from protected merge.

## Execution strategy

Execute this plan **inline, task-by-task in the current development workflow** because no independent subagent execution surface is available in this conversation. Preserve the same discipline a subagent-driven run would use: one bounded task at a time, fresh RED evidence, review the diff/test result before the next task, and keep the Draft PR/changelog current after each GREEN checkpoint.

The product owner has already approved the written M8.2 specification and explicitly authorized implementation. Therefore no additional design clarification is required before Task 0. Production changes still begin only after Task 0 establishes the fresh implementation branch and green baseline.