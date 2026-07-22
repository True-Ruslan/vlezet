# M6.1 Deterministic Layout Alternatives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, framework-independent planning engine that generates up to three explainable furniture-placement alternatives for 1–3 existing objects in one supported rectangular room, previews them without mutating the document, and applies one candidate as a single undoable semantic operation.

**Architecture:** Introduce `@vlezet/planning` with request validation, bounded anchor generation, candidate evaluation through the existing M2 `evaluateObjectFits`, deterministic ranking, and revalidation/apply helpers. The web layer owns only ephemeral planning UI/preview state; `VlezetDocument` remains the single persistent source of truth. Applying a candidate goes through `editor-core`/history as one `planning/apply-candidate` document-replace command.

**Tech Stack:** TypeScript 6, pnpm/Turborepo, Vitest, React 19, Zustand 5, Konva/react-konva, existing `@vlezet/domain`, `@vlezet/geometry`, `@vlezet/editor-core`.

## Global Constraints

- Millimetres remain the canonical world unit.
- `@vlezet/planning` must be framework-independent and may depend only on `@vlezet/domain` and `@vlezet/geometry`.
- Existing M2 `evaluateObjectFits()` remains authoritative for containment, collisions, door swing and clearances.
- M6.1 supports one deterministic axis-aligned rectangular room and 1–3 existing placed objects only.
- Candidate transforms may change only `position` and `rotationDeg`.
- Non-selected objects remain fixed obstacles.
- Planning preview is ephemeral and must not mutate `VlezetDocument`, history, autosave or IndexedDB.
- Candidate Apply must revalidate against the current document, fail closed when invalid/stale, and produce one semantic Undo/Redo operation.
- No LLM/API dependency, no AI/free-form geometry, no second layout authority, no direct 3D editing, no persistent planning sessions.

---

## File Structure

Create:

- `packages/planning/package.json` — workspace package metadata/dependencies/scripts.
- `packages/planning/tsconfig.json` — TypeScript package config.
- `packages/planning/src/contracts.ts` — planning request/candidate/evaluation/error types and limits.
- `packages/planning/src/anchors.ts` — deterministic rectangular-room placement anchor/orientation generation.
- `packages/planning/src/evaluation.ts` — ephemeral candidate document construction, M2-based validation, ranking facts and explanations.
- `packages/planning/src/planner.ts` — bounded deterministic combination generation, deduplication, ranking and top-result selection.
- `packages/planning/src/apply.ts` — candidate revalidation and pure document transform application.
- `packages/planning/src/index.ts` — package public exports.
- `packages/planning/src/planner.test.ts` — planning contract/generation/evaluation/ranking regression suite.
- `packages/planning/src/apply.test.ts` — revalidation/non-mutation/apply regression suite.
- `apps/web/components/planning/planning-ui-store.ts` — ephemeral open/preview UI state only.
- `apps/web/components/planning/planning-panel.tsx` — room object selection, generation, ranked alternatives, explanations, preview/apply actions.
- `apps/web/components/planning/planning-panel.test.tsx` — render/selection/constraint contract tests.
- `docs/milestones/m6-1-acceptance.md` — exact CI and real-browser acceptance checklist/evidence.

Modify:

- `pnpm-lock.yaml` — workspace dependency graph after adding `@vlezet/planning`.
- `apps/web/package.json` — add `@vlezet/planning` workspace dependency.
- `packages/editor-core/package.json` — add `@vlezet/planning` workspace dependency.
- `packages/editor-core/src/commands.ts` — add `planning/apply-candidate` semantic command label.
- `packages/editor-core/src/index.ts` — export candidate apply adapter.
- `packages/editor-core/src/planning-editing.ts` — pure atomic validated candidate apply adapter.
- `packages/editor-core/src/planning-editing.test.ts` — apply/undo/redo/stale failure tests.
- `apps/web/components/editor/use-editor-store.ts` — add `applyPlanningCandidate` action executing one history command.
- `apps/web/components/editor/use-editor-store.test.ts` — store-level one-command Undo/Redo test.
- `apps/web/components/editor/wall-inspector.tsx` — add `Варианты расстановки` entry point for supported selected room and render planning panel when open.
- `apps/web/components/editor/editor-canvas.tsx` — render candidate transforms as non-listening ghost `PlacedObjectShape` previews without replacing persisted/displayed source objects.
- `apps/web/components/editor/apartment-editor.tsx` — reset ephemeral planning state on project/view-context changes as needed.
- `apps/web/app/globals.css` — planning panel/result styles using existing inspector visual language.

---

### Task 1: Create `@vlezet/planning` contracts and request validation

**Files:**
- Create: `packages/planning/package.json`
- Create: `packages/planning/tsconfig.json`
- Create: `packages/planning/src/contracts.ts`
- Create: `packages/planning/src/index.ts`
- Create/Test: `packages/planning/src/planner.test.ts`

**Interfaces:**

Produces:

```ts
export const MAX_SELECTED_PLANNING_OBJECTS = 3;
export const MAX_PLANNING_EVALUATIONS = 6000;
export const MAX_DISPLAYED_PLANNING_CANDIDATES = 3;

export type PlanningRequest = Readonly<{
  roomId: string;
  objectIds: readonly string[];
}>;

export type PlanningPlacement = Readonly<{
  objectId: string;
  position: Readonly<{ x: number; y: number }>;
  rotationDeg: number;
}>;

export type PlanningCandidate = Readonly<{
  id: string;
  roomId: string;
  placements: readonly PlanningPlacement[];
}>;

export type PlanningErrorCode =
  | "invalid-plan"
  | "room-missing"
  | "room-unsupported"
  | "invalid-object-selection"
  | "object-missing"
  | "object-outside-target-room"
  | "candidate-invalid";

export class PlanningError extends Error {
  readonly code: PlanningErrorCode;
}
```

- [ ] **Step 1: Write failing request-validation tests**

Add tests that import `validatePlanningRequest` before it exists and cover:

```ts
expect(() => validatePlanningRequest(document, { roomId, objectIds: [] }))
  .toThrowError(PlanningError);
expect(() => validatePlanningRequest(document, { roomId, objectIds: ["a", "a"] }))
  .toThrowError(/duplicate/i);
expect(() => validatePlanningRequest(document, { roomId, objectIds: ["a", "b", "c", "d"] }))
  .toThrowError(/1–3|1-3/);
```

Also cover missing room, missing object, invalid derived plan and non-rectangular target room.

- [ ] **Step 2: Run planning package tests and verify RED**

Run through CI/PR head:

```bash
pnpm --filter @vlezet/planning test
```

Expected: FAIL because package/functions are missing.

- [ ] **Step 3: Add package scaffold and minimal validation implementation**

`packages/planning/package.json`:

```json
{
  "name": "@vlezet/planning",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc --noEmit",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@vlezet/domain": "workspace:*",
    "@vlezet/geometry": "workspace:*"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "vitest": "4.1.10"
  }
}
```

`tsconfig.json` extends `../../tsconfig.base.json` and includes `src/**/*.ts`.

Implement `validatePlanningRequest(document, request)` to:

1. call `deriveRooms(document)` and reject geometry errors;
2. find `roomId`;
3. require `deriveRectangularRoomDimensions(room)`;
4. require 1–3 unique object IDs;
5. require every selected object exists;
6. use current `evaluateObjectFits(document)` room assignment to require each selected object currently belongs to the requested room.

Return a normalized validated context containing the derived room and selected objects; never mutate input.

- [ ] **Step 4: Run tests/typecheck for package and verify GREEN**

```bash
pnpm --filter @vlezet/planning test
pnpm --filter @vlezet/planning typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/planning pnpm-lock.yaml
git commit -m "feat: add M6.1 planning contracts"
```

---

### Task 2: Deterministic anchors, candidate evaluation and ranking

**Files:**
- Create: `packages/planning/src/anchors.ts`
- Create: `packages/planning/src/evaluation.ts`
- Create: `packages/planning/src/planner.ts`
- Modify: `packages/planning/src/contracts.ts`
- Modify: `packages/planning/src/index.ts`
- Test: `packages/planning/src/planner.test.ts`

**Interfaces:**

Produces:

```ts
export type PlanningCandidateEvaluation = Readonly<{
  candidateId: string;
  valid: boolean;
  tightObjectCount: number;
  recommendationCount: number;
  rotatedObjectCount: number;
  totalMovementMm: number;
  reasons: readonly string[];
}>;

export type RankedPlanningCandidate = Readonly<{
  candidate: PlanningCandidate;
  evaluation: PlanningCandidateEvaluation;
}>;

export type PlanningResult = Readonly<{
  roomId: string;
  evaluatedCandidateCount: number;
  validCandidateCount: number;
  candidates: readonly RankedPlanningCandidate[];
}>;

export function evaluatePlanningCandidate(
  document: VlezetDocument,
  candidate: PlanningCandidate,
): PlanningCandidateEvaluation;

export function planLayoutAlternatives(
  document: VlezetDocument,
  request: PlanningRequest,
): PlanningResult;
```

- [ ] **Step 1: Add RED tests for deterministic anchors and orientation deduplication**

Test an axis-aligned room and object with known width/depth. Assert generated centers account for rotated footprint extents, stay deterministic, and rotations contain only normalized current and `+90°` values without duplicates.

Example expectations:

```ts
expect(orientationsFor(0)).toEqual([0, 90]);
expect(orientationsFor(270)).toEqual([270, 0]);
expect(new Set(anchors.map(stableAnchorKey)).size).toBe(anchors.length);
```

- [ ] **Step 2: Add RED tests for M2-authoritative rejection**

Create fixtures where generated/evaluated candidates would:

- leave the room;
- collide with a fixed non-selected object;
- block a door swing.

Assert `evaluatePlanningCandidate(...).valid === false` and that no blocked candidate appears in `planLayoutAlternatives(...).candidates`.

- [ ] **Step 3: Add RED ranking tests**

Construct explicit valid candidates and assert comparator order:

1. clean `fits` before `tight`;
2. fewer recommendation diagnostics first;
3. fewer changed rotations first;
4. lower total movement first;
5. stable candidate key tie-break.

Also assert identical inputs produce deeply identical ordered results and source document JSON remains byte-equivalent after planning.

- [ ] **Step 4: Implement anchor/orientation generation**

In `anchors.ts`:

- derive `minX/maxX/minY/maxY` from the already-validated rectangular room polygon;
- calculate oriented footprint half-extents from `orientedRectangleCorners` for each candidate rotation;
- generate corner, side-midpoint, center and current-position anchors in a fixed order;
- deduplicate by a stable numeric key;
- normalize rotations using domain `normalizeRotationDeg`.

Do not snap to pixels or use viewport/grid state.

- [ ] **Step 5: Implement pure candidate evaluation**

In `evaluation.ts`:

```ts
const evaluationDocument = {
  ...document,
  placedObjects: document.placedObjects.map((object) => {
    const placement = placementByObjectId.get(object.id);
    return placement
      ? { ...object, position: { ...placement.position }, rotationDeg: placement.rotationDeg }
      : object;
  }),
};
const fit = evaluateObjectFits(evaluationDocument);
```

Reject when plan invalid, selected object is blocked, or selected object does not resolve to `candidate.roomId`.

Count recommendation diagnostics only from selected objects. Derive deterministic reasons from diagnostic codes and clean-fit facts; do not use generated prose/LLM.

- [ ] **Step 6: Implement bounded deterministic combination generation**

In `planner.ts`:

- validate request;
- build stable placement option arrays per selected object in request order;
- enumerate complete combinations depth-first in stable order;
- stop after `MAX_PLANNING_EVALUATIONS = 6000` complete candidates;
- deduplicate candidate placement keys;
- derive deterministic candidate IDs from room/object/transform key strings, e.g. `candidate:${stableHashOrEncodedKey}` without UUIDs;
- evaluate with `evaluatePlanningCandidate`;
- keep valid candidates;
- sort with explicit lexicographic comparator;
- return at most `MAX_DISPLAYED_PLANNING_CANDIDATES = 3` candidates.

- [ ] **Step 7: Verify package GREEN**

```bash
pnpm --filter @vlezet/planning test
pnpm --filter @vlezet/planning typecheck
```

Expected: PASS, including determinism/non-mutation regressions.

- [ ] **Step 8: Commit**

```bash
git add packages/planning
git commit -m "feat: generate deterministic layout alternatives"
```

---

### Task 3: Revalidated atomic Apply and one-command Undo/Redo

**Files:**
- Create: `packages/planning/src/apply.ts`
- Create/Test: `packages/planning/src/apply.test.ts`
- Modify: `packages/planning/src/index.ts`
- Create: `packages/editor-core/src/planning-editing.ts`
- Create/Test: `packages/editor-core/src/planning-editing.test.ts`
- Modify: `packages/editor-core/src/commands.ts`
- Modify: `packages/editor-core/src/index.ts`
- Modify: `packages/editor-core/package.json`
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify/Test: `apps/web/components/editor/use-editor-store.test.ts`

**Interfaces:**

Produces:

```ts
export function applyPlanningCandidateToDocument(
  document: VlezetDocument,
  candidate: PlanningCandidate,
): VlezetDocument;
```

and store action:

```ts
applyPlanningCandidate: (candidate: PlanningCandidate) => void;
```

- [ ] **Step 1: Write RED apply tests in planning package**

Assert:

- valid candidate changes only `position` and `rotationDeg` for listed objects;
- IDs, dimensions, category, height, name, preset and clearance are preserved exactly;
- source document is unchanged;
- missing object or newly invalid candidate throws `PlanningError` atomically;
- candidate is re-evaluated against the current document before returning the new document.

- [ ] **Step 2: Implement pure revalidated apply helper**

`applyPlanningCandidateToDocument` must call `evaluatePlanningCandidate(document, candidate)` first and throw `PlanningError("candidate-invalid")` if invalid. Only then map selected object transforms into a new document.

- [ ] **Step 3: Write RED editor-core/history tests**

Add `planning/apply-candidate` to `EditorCommandLabel` test expectations.

Test:

```ts
const before = createHistoryState(document);
const afterDocument = applyPlanningCandidate(document, candidate);
const executed = executeCommand(before, {
  type: "document/replace",
  label: "planning/apply-candidate",
  before: document,
  after: afterDocument,
});
expect(undo(executed).document).toEqual(document);
expect(redo(undo(executed)).document).toEqual(afterDocument);
```

- [ ] **Step 4: Add editor-core adapter and dependency**

`planning-editing.ts` exports a thin named adapter around planning's validated pure apply helper. `editor-core` may depend on `@vlezet/planning`; `@vlezet/planning` must never depend on editor-core.

- [ ] **Step 5: Add store action with one semantic command**

In `use-editor-store.ts`, action behavior:

```ts
const before = get().history.document;
const after = applyPlanningCandidateToDocument(before, candidate);
set({
  history: executeCommand(get().history, {
    type: "document/replace",
    label: "planning/apply-candidate",
    before,
    after,
  }),
  selectedObjectId: null,
});
```

No per-object command loop.

- [ ] **Step 6: Verify editor-core/store GREEN**

```bash
pnpm --filter @vlezet/editor-core test
pnpm --filter @vlezet/editor-core typecheck
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/planning packages/editor-core apps/web/components/editor/use-editor-store* apps/web/package.json pnpm-lock.yaml
git commit -m "feat: apply planning candidates atomically"
```

---

### Task 4: Ephemeral planning panel and 2D ghost preview

**Files:**
- Create: `apps/web/components/planning/planning-ui-store.ts`
- Create: `apps/web/components/planning/planning-panel.tsx`
- Create/Test: `apps/web/components/planning/planning-panel.test.tsx`
- Modify: `apps/web/components/editor/wall-inspector.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/package.json`

**Interfaces:**

Ephemeral UI state:

```ts
export type PlanningUiState = {
  roomId: string | null;
  previewCandidate: PlanningCandidate | null;
  openForRoom: (roomId: string) => void;
  setPreviewCandidate: (candidate: PlanningCandidate | null) => void;
  close: () => void;
};
```

- [ ] **Step 1: Write RED component/store tests**

Cover:

- `openForRoom` and `close` do not touch `editorStore.history.document`;
- panel lists only existing objects currently assigned to target room;
- selection disables generation for 0 objects and prevents >3 objects;
- generation renders at most three ranked alternatives;
- clicking preview sets only ephemeral `previewCandidate`;
- Apply calls the editor-store atomic action and clears preview/panel state on success;
- planning error/no-valid-alternatives renders controlled Russian copy.

- [ ] **Step 2: Implement ephemeral planning UI store**

Use `zustand/vanilla`, following the existing spatial view-mode store pattern. Do not persist or subscribe it to project autosave.

- [ ] **Step 3: Add room-inspector entry point and planning panel**

In `SelectedRoomInspector`, show `Варианты расстановки` only when `deriveRectangularRoomDimensions(room)` succeeds.

`PlanningPanel`:

- resolves current target room from `editorStore.history.document` each render;
- obtains fit room assignments from current deterministic evaluation;
- lists target-room objects with checkboxes;
- enforces 1–3 selected objects;
- calls `planLayoutAlternatives(document, { roomId, objectIds })` synchronously;
- shows up to three cards with `Вариант 1`, fit summary/reasons and buttons `Предпросмотр` / `Применить`;
- uses controlled fail-closed messages for unsupported/stale/no-result cases;
- never writes document until explicit Apply.

- [ ] **Step 4: Render ghost preview in editor canvas**

Read `previewCandidate` from the ephemeral planning UI store.

Derive `planningPreviewObjects` by copying source placed objects and replacing only candidate `position`/`rotationDeg`. Render them in the existing furniture layer as:

```tsx
<PlacedObjectShape
  key={`planning-preview:${object.id}`}
  object={object}
  viewport={viewport}
  selected={false}
  preview
  fitStatus={previewFit.byObjectId.get(object.id)?.status ?? "blocked"}
/>
```

They must be non-draggable/non-listening because `preview` already disables selection/transform behavior. Keep the real objects visible underneath so preview is clearly comparative and non-destructive.

- [ ] **Step 5: Reset stale preview on project/context changes**

Close/clear planning UI when:

- project ID changes;
- target room no longer exists;
- switching into a conflicting recognition/reference workflow;
- Apply succeeds.

Do not silently apply anything during cleanup.

- [ ] **Step 6: Add focused styles**

Reuse existing `.inspector-panel`, button and field visual language. Add only planning-specific result card/checkbox/reason/active-preview classes. No new design system.

- [ ] **Step 7: Verify web GREEN**

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web packages/planning pnpm-lock.yaml
git commit -m "feat: add M6.1 planning preview workflow"
```

---

### Task 5: Full regression gate, acceptance evidence and PR readiness

**Files:**
- Create: `docs/milestones/m6-1-acceptance.md`
- Do not update `docs/PROJECT_STATE.md`, `docs/ROADMAP.md` or `docs/CHANGELOG.md` to DONE until real-browser acceptance and merge.

- [ ] **Step 1: Run full exact-head CI gate**

Required commands represented by GitHub Actions:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all PASS on the exact PR head.

- [ ] **Step 2: Self-review changed-file diff**

Verify explicitly:

- no candidate/planning state added to `VlezetDocument` schema;
- no IndexedDB/autosave planning persistence;
- no collision math duplicated outside M2 authority;
- no per-object Apply command loop;
- no UUID/random ordering in planning output;
- preview does not call editor mutations;
- full search budget is hard bounded;
- temporary UI state fails closed after document changes.

- [ ] **Step 3: Create browser acceptance checklist**

`docs/milestones/m6-1-acceptance.md` must require on the representative apartment:

1. select a deterministic rectangular room with multiple furniture items;
2. open `Варианты расстановки`;
3. select 1–3 objects;
4. generate alternatives and confirm max 3 displayed;
5. preview each without save/history mutation;
6. confirm offered alternatives do not contain object collisions/outside-room/door obstruction;
7. inspect deterministic explanation text;
8. Apply one candidate;
9. confirm 2D matches preview;
10. switch to 3D and confirm ordinary document projection matches;
11. Undo once restores all selected objects;
12. Redo once reapplies all selected objects;
13. reload project and confirm only the explicitly applied ordinary document persists;
14. verify M2 fit status, M5.2 furniture projection and M5.4 inspection regressions are absent.

- [ ] **Step 4: Open/maintain Draft PR and attach exact evidence**

PR title:

```text
feat: M6.1 deterministic layout alternatives
```

Keep Draft until exact-head strict CI and browser acceptance pass.

- [ ] **Step 5: After browser acceptance, finalize**

Only after user acceptance:

```text
mark PR Ready
→ verify exact head CI
→ squash merge
→ update PROJECT_STATE.md
→ update ROADMAP.md
→ prepend CHANGELOG.md entry with final merge SHA, RC findings and acceptance evidence
```

Commit acceptance documentation before the final exact-head CI so evidence is part of the verified head.
