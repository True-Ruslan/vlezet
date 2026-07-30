# M6.3 Exact Gap Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an M6.3 exact furniture gap visually unmistakable by drawing the authoritative shortest contour-to-contour witness on the 2D Preview and presenting structured `Фактически / Требуется` evidence in the planning panel.

**Architecture:** Extend the framework-independent geometry distance primitive so it returns deterministic closest-point witnesses, while retaining the existing numeric API as a delegate. Promote exact structured evidence through candidate evaluation, derive an ephemeral web annotation from the preview document and active pair, then render one non-interactive violet overlay inside the existing Konva object layer and one structured evidence card in the planning panel.

**Tech Stack:** TypeScript 6, Vitest 4, React 19, Zustand 5, Konva/react-konva 10/19, `@vlezet/geometry`, `@vlezet/planning`, pnpm/Turborepo, GitHub Actions.

## Global Constraints

- Millimetres remain canonical; screen pixels are presentation-only and are never persisted.
- `VlezetDocument` remains the only persistent apartment/layout source of truth.
- M2 `evaluateObjectFits()` remains authoritative for containment, collisions, door swing and clearances.
- Numeric exact validation and visual closest points must share one geometry implementation.
- The exact overlay appears only for an active `pair-min-gap` in an active 2D planning Preview.
- Only one exact pair is visualized at a time.
- Preview, active pair and overlay remain ephemeral and never enter history, autosave, IndexedDB, backup or export.
- Generic reason strings must not duplicate structured exact `required / actual` evidence.
- Empty exact input still means no exact rule; `0` remains a valid exact constraint.
- Apply keeps current-document revalidation and one semantic `planning/apply-candidate` Undo/Redo operation.
- The right-inspector viewport fix remains intact.
- PR #15 remains Draft until exact-head CI and representative browser acceptance pass.

---

### Task 1: Deterministic Oriented-Rectangle Gap Witness

**Files:**
- Modify: `packages/geometry/src/oriented-rectangle-distance.test.ts`
- Modify: `packages/geometry/src/oriented-rectangle-distance.ts`
- Modify: `packages/geometry/src/index.ts`

**Interfaces:**

```ts
export type OrientedRectangleGapWitness = Readonly<{
  distanceMm: number;
  firstPoint: Point2 | null;
  secondPoint: Point2 | null;
  relation: "separated" | "touching" | "overlapping";
}>;

export function minimumGapWitnessBetweenOrientedRectangles(
  first: OrientedRectangle,
  second: OrientedRectangle,
): OrientedRectangleGapWitness;
```

The existing `minimumDistanceBetweenOrientedRectangles()` remains public and returns `minimumGapWitnessBetweenOrientedRectangles(...).distanceMm`.

- [ ] **Step 1: Write the failing witness tests**

Update the import in `oriented-rectangle-distance.test.ts`:

```ts
import {
  minimumDistanceBetweenOrientedRectangles,
  minimumGapWitnessBetweenOrientedRectangles,
} from "./oriented-rectangle-distance";
```

Add these tests:

```ts
it("returns deterministic closest points for an axis-aligned separated gap", () => {
  expect(minimumGapWitnessBetweenOrientedRectangles(
    rect(0, 0, 1000, 1000),
    rect(2000, 0, 1000, 1000),
  )).toEqual({
    distanceMm: 1000,
    firstPoint: { x: 500, y: -500 },
    secondPoint: { x: 1500, y: -500 },
    relation: "separated",
  });
});

it("returns closest points on real rotated contours", () => {
  const offset = 1500 / Math.sqrt(2);
  const witness = minimumGapWitnessBetweenOrientedRectangles(
    rect(0, 0, 1000, 600, 45),
    rect(offset, offset, 1000, 600, 45),
  );
  expect(witness.relation).toBe("separated");
  expect(witness.distanceMm).toBeCloseTo(500, 6);
  expect(witness.firstPoint).not.toBeNull();
  expect(witness.secondPoint).not.toBeNull();
});

it("returns one deterministic coincident witness for touching contours", () => {
  expect(minimumGapWitnessBetweenOrientedRectangles(
    rect(0, 0, 1000, 1000),
    rect(1000, 0, 1000, 1000),
  )).toEqual({
    distanceMm: 0,
    firstPoint: { x: 500, y: -500 },
    secondPoint: { x: 500, y: -500 },
    relation: "touching",
  });
});

it("does not invent a unique witness for overlap", () => {
  expect(minimumGapWitnessBetweenOrientedRectangles(
    rect(0, 0, 1000, 1000),
    rect(500, 0, 1000, 1000),
  )).toEqual({ distanceMm: 0, firstPoint: null, secondPoint: null, relation: "overlapping" });
});

it("swaps witness ownership when rectangle order is reversed", () => {
  const first = rect(100, -200, 900, 500, 27);
  const second = rect(2200, 1300, 700, 1100, -18);
  const forward = minimumGapWitnessBetweenOrientedRectangles(first, second);
  const reverse = minimumGapWitnessBetweenOrientedRectangles(second, first);
  expect(reverse.distanceMm).toBeCloseTo(forward.distanceMm, 9);
  expect(reverse.firstPoint).toEqual(forward.secondPoint);
  expect(reverse.secondPoint).toEqual(forward.firstPoint);
});

it("keeps the numeric API delegated to the witness result", () => {
  const first = rect(0, 0, 1000, 600, 45);
  const second = rect(1800, 900, 800, 700, -15);
  expect(minimumDistanceBetweenOrientedRectangles(first, second)).toBe(
    minimumGapWitnessBetweenOrientedRectangles(first, second).distanceMm,
  );
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
pnpm --filter @vlezet/geometry test -- src/oriented-rectangle-distance.test.ts
```

Expected: FAIL because the witness type/function do not exist.

- [ ] **Step 3: Implement one shared boundary-candidate calculation**

In `oriented-rectangle-distance.ts`, use:

```ts
type GapCandidate = Readonly<{
  distanceMm: number;
  firstPoint: Point2;
  secondPoint: Point2;
}>;
```

For every first/second edge pair, collect:

```ts
const intersection = segmentIntersection(firstEdge.start, firstEdge.end, secondEdge.start, secondEdge.end);
if (intersection) {
  candidates.push({ distanceMm: 0, firstPoint: intersection.point, secondPoint: intersection.point });
}

for (const point of [firstEdge.start, firstEdge.end]) {
  const projection = projectPointToSegment(point, secondEdge.start, secondEdge.end);
  candidates.push({ distanceMm: projection.distance, firstPoint: point, secondPoint: projection.point });
}
for (const point of [secondEdge.start, secondEdge.end]) {
  const projection = projectPointToSegment(point, firstEdge.start, firstEdge.end);
  candidates.push({ distanceMm: projection.distance, firstPoint: projection.point, secondPoint: point });
}
```

Sort candidates by:

```ts
first.distanceMm - second.distanceMm ||
first.firstPoint.x - second.firstPoint.x ||
first.firstPoint.y - second.firstPoint.y ||
first.secondPoint.x - second.secondPoint.x ||
first.secondPoint.y - second.secondPoint.y
```

Normalize a candidate distance `<= GEOMETRY_EPSILON_MM` to `0`; for zero-distance candidates use the lexicographically smaller of the two numerically near-identical points for both witness endpoints.

Implement:

```ts
export function minimumGapWitnessBetweenOrientedRectangles(
  first: OrientedRectangle,
  second: OrientedRectangle,
): OrientedRectangleGapWitness {
  if (orientedRectanglesIntersect(first, second)) {
    return { distanceMm: 0, firstPoint: null, secondPoint: null, relation: "overlapping" };
  }
  const candidate = closestBoundaryCandidate(first, second);
  const touching = candidate.distanceMm <= GEOMETRY_EPSILON_MM;
  return {
    distanceMm: touching ? 0 : candidate.distanceMm,
    firstPoint: candidate.firstPoint,
    secondPoint: candidate.secondPoint,
    relation: touching ? "touching" : "separated",
  };
}

export function minimumDistanceBetweenOrientedRectangles(
  first: OrientedRectangle,
  second: OrientedRectangle,
): number {
  return minimumGapWitnessBetweenOrientedRectangles(first, second).distanceMm;
}
```

Collinear touching edges are handled by zero-distance endpoint projections and the same deterministic tie-break.

- [ ] **Step 4: Export the witness API**

```ts
export {
  minimumDistanceBetweenOrientedRectangles,
  minimumGapWitnessBetweenOrientedRectangles,
} from "./oriented-rectangle-distance";
export type { OrientedRectangleGapWitness } from "./oriented-rectangle-distance";
```

- [ ] **Step 5: Run package verification**

```bash
pnpm --filter @vlezet/geometry test
pnpm --filter @vlezet/geometry typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/geometry/src/oriented-rectangle-distance.ts packages/geometry/src/oriented-rectangle-distance.test.ts packages/geometry/src/index.ts
git commit -m "feat: expose exact furniture gap witnesses"
```

---

### Task 2: Promote Exact Structured Evidence

**Files:**
- Modify: `packages/planning/src/evaluation.ts`
- Modify: `packages/planning/src/constraints.ts`
- Modify: `packages/planning/src/exact-spacing.test.ts`

**Interface change:**

```ts
export type PlanningCandidateEvaluation = Readonly<{
  candidateId: string;
  valid: boolean;
  tightObjectCount: number;
  recommendationCount: number;
  preferencePenalty: number;
  rotatedObjectCount: number;
  totalMovementMm: number;
  reasons: readonly string[];
  exactEvidence: readonly PairMinimumGapConstraintEvidence[];
  stableKey: string;
}>;
```

- [ ] **Step 1: Write the failing promotion test**

Add to `exact-spacing.test.ts`:

```ts
import { evaluatePlanningCandidate } from "./evaluation";

it("promotes structured exact evidence without duplicating exact copy in generic reasons", () => {
  const document = documentWithEdgeGap(842);
  const exactCandidate = candidate(document, [
    { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
  ]);
  const evaluation = evaluatePlanningCandidate(document, exactCandidate);

  expect(evaluation.exactEvidence).toEqual([{
    kind: "pair-min-gap",
    objectIds: ["sofa", "table"],
    requiredMm: 800,
    actualMm: 842,
    satisfied: true,
  }]);
  expect(evaluation.reasons.join(" ")).not.toContain("требуется минимум 800 мм");
  expect(evaluation.valid).toBe(true);
});
```

Change the existing exact-spacing test at lines 77–78 so it asserts only `aboveEvaluation.exactEvidence`; remove the two string assertions.

- [ ] **Step 2: Confirm RED**

```bash
pnpm --filter @vlezet/planning test -- src/exact-spacing.test.ts
```

Expected: FAIL because `PlanningCandidateEvaluation` has no `exactEvidence`, and exact text is still generic evidence.

- [ ] **Step 3: Remove duplicate exact text and promote data**

In the `pair-min-gap` branch of `evaluatePlanningConstraints()`, keep `hardValid` and `exactEvidence.push(...)`, but delete the exact `evidence.push(...)` sentence.

In `evaluation.ts`, import the evidence type and add:

```ts
exactEvidence: constraintEvaluation.exactEvidence,
```

to the normal return. The early invalid-placement return uses:

```ts
exactEvidence: [],
```

No ranking field, stable key, hard validity or Apply code changes.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @vlezet/planning test
pnpm --filter @vlezet/planning typecheck
git add packages/planning/src/evaluation.ts packages/planning/src/constraints.ts packages/planning/src/exact-spacing.test.ts
git commit -m "feat: expose structured exact gap evidence"
```

Expected: PASS.

---

### Task 3: Shared Pair Keys and Ephemeral Active Pair State

**Files:**
- Create: `apps/web/components/planning/planning-pair-key.ts`
- Modify: `apps/web/components/planning/planning-panel.tsx`
- Modify: `apps/web/components/planning/planning-panel.test.tsx`
- Modify: `apps/web/components/planning/planning-ui-store.ts`
- Modify: `apps/web/components/planning/planning-ui-store.test.ts`

**Interfaces:**

```ts
export function planningPairKey(firstObjectId: string, secondObjectId: string): string;
export function planningPairIds(key: string): readonly [string, string] | null;
```

```ts
activeExactPairKey: string | null;
setActiveExactPairKey: (pairKey: string | null) => void;
```

- [ ] **Step 1: Write failing state tests**

Replace the store test candidate with:

```ts
const candidate: PlanningCandidate = {
  id: "candidate:preview",
  roomId: "room-1",
  placements: [
    { objectId: "sofa", position: { x: 1000, y: 2000 }, rotationDeg: 90 },
    { objectId: "table", position: { x: 2800, y: 2000 }, rotationDeg: 0 },
    { objectId: "chair", position: { x: 3900, y: 2400 }, rotationDeg: 0 },
  ],
  constraints: [
    { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
    { kind: "pair-min-gap", objectIds: ["chair", "table"], minimumMm: 600 },
  ],
};
```

Add:

```ts
it("selects the first deterministic exact pair when Preview starts", () => {
  const store = createPlanningUiStore();
  store.getState().openForRoom("room-1");
  store.getState().setPreviewCandidate(candidate);
  expect(store.getState().activeExactPairKey).toBe("chair|table");
});

it("switches only active pair state and clears it with Preview", () => {
  const store = createPlanningUiStore();
  store.getState().openForRoom("room-1");
  store.getState().setPreviewCandidate(candidate);
  store.getState().setActiveExactPairKey("sofa|table");
  expect(store.getState()).toMatchObject({ roomId: "room-1", previewCandidate: candidate, activeExactPairKey: "sofa|table" });
  store.getState().setPreviewCandidate(null);
  expect(store.getState()).toMatchObject({ roomId: "room-1", previewCandidate: null, activeExactPairKey: null });
});

it("clears active pair when opening another room or closing planning", () => {
  const store = createPlanningUiStore();
  store.getState().setPreviewCandidate(candidate);
  store.getState().openForRoom("room-2");
  expect(store.getState().activeExactPairKey).toBeNull();
  store.getState().setPreviewCandidate(candidate);
  store.getState().close();
  expect(store.getState()).toMatchObject({ roomId: null, previewCandidate: null, activeExactPairKey: null });
});
```

- [ ] **Step 2: Confirm RED**

```bash
pnpm --filter web test -- components/planning/planning-ui-store.test.ts
```

Expected: FAIL because active pair state does not exist.

- [ ] **Step 3: Create shared pair helpers**

```ts
export function planningPairKey(firstObjectId: string, secondObjectId: string): string {
  return firstObjectId.localeCompare(secondObjectId) <= 0
    ? `${firstObjectId}|${secondObjectId}`
    : `${secondObjectId}|${firstObjectId}`;
}

export function planningPairIds(key: string): readonly [string, string] | null {
  const parts = key.split("|");
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
}
```

Remove the local `planningPairKey()` and `pairIdsFromKey()` from `planning-panel.tsx`; import the shared functions. Re-export `planningPairKey` from `planning-panel.tsx` during this PR so the existing test import remains compatible:

```ts
export { planningPairKey } from "./planning-pair-key";
```

- [ ] **Step 4: Implement store transitions**

```ts
function firstExactPairKey(candidate: PlanningCandidate | null): string | null {
  return (candidate?.constraints ?? [])
    .filter((constraint) => constraint.kind === "pair-min-gap")
    .map((constraint) => planningPairKey(constraint.objectIds[0], constraint.objectIds[1]))
    .sort((first, second) => first.localeCompare(second))[0] ?? null;
}
```

`setPreviewCandidate(candidate)` sets preview plus the deterministic first key. `setActiveExactPairKey()` changes only that key. `openForRoom()`, `setPreviewCandidate(null)` and `close()` clear it.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter web test -- components/planning/planning-ui-store.test.ts components/planning/planning-panel.test.tsx
pnpm --filter web typecheck
git add apps/web/components/planning/planning-pair-key.ts apps/web/components/planning/planning-panel.tsx apps/web/components/planning/planning-panel.test.tsx apps/web/components/planning/planning-ui-store.ts apps/web/components/planning/planning-ui-store.test.ts
git commit -m "feat: track active exact planning pairs"
```

Expected: PASS.

---

### Task 4: Pure Preview Gap Annotation View-Model

**Files:**
- Create: `apps/web/components/planning/exact-gap-annotation.ts`
- Create: `apps/web/components/planning/exact-gap-annotation.test.ts`

**Interface:**

```ts
export type ExactGapAnnotation = Readonly<{
  pairKey: string;
  firstPoint: Point2;
  secondPoint: Point2;
  actualMm: number;
  requiredMm: number;
  satisfied: boolean;
  zeroLength: boolean;
  label: string;
}>;

export function deriveExactGapAnnotation(
  previewDocument: VlezetDocument,
  candidate: PlanningCandidate | null,
  activePairKey: string | null,
): ExactGapAnnotation | null;
```

- [ ] **Step 1: Write a complete failing annotation test fixture**

Create `exact-gap-annotation.test.ts` with:

```ts
import type { VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import type { PlanningCandidate } from "@vlezet/planning";
import { deriveExactGapAnnotation } from "./exact-gap-annotation";

function documentWithGap(gapMm: number): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [], walls: [], openings: [], roomAnnotations: [],
    placedObjects: [
      {
        id: "sofa", presetId: null, name: "Диван", category: "seating",
        position: { x: 500, y: 500 }, width: 1000, depth: 700, height: 800, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
      {
        id: "table", presetId: null, name: "Стол", category: "table",
        position: { x: 1500 + gapMm, y: 500 }, width: 1000, depth: 700, height: 750, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
    ],
  };
}

function candidate(document: VlezetDocument, minimumMm = 800): PlanningCandidate {
  return {
    id: "candidate:gap",
    roomId: "room-1",
    placements: document.placedObjects.map((object) => ({
      objectId: object.id,
      position: { ...object.position },
      rotationDeg: object.rotationDeg,
    })),
    constraints: [{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm }],
  };
}

it("derives required and actual gap from preview transforms without mutation", () => {
  const document = documentWithGap(842);
  const preview = candidate(document);
  const documentBefore = JSON.stringify(document);
  const candidateBefore = JSON.stringify(preview);
  expect(deriveExactGapAnnotation(document, preview, "sofa|table")).toMatchObject({
    pairKey: "sofa|table", actualMm: 842, requiredMm: 800,
    satisfied: true, zeroLength: false, label: "↔ Зазор 842 мм",
  });
  expect(JSON.stringify(document)).toBe(documentBefore);
  expect(JSON.stringify(preview)).toBe(candidateBefore);
});

it("reports current preview geometry as stale and unsatisfied", () => {
  const document = documentWithGap(799);
  expect(deriveExactGapAnnotation(document, candidate(document), "sofa|table"))
    .toMatchObject({ actualMm: 799, requiredMm: 800, satisfied: false });
});

it("returns zero-length contact semantics", () => {
  const document = documentWithGap(0);
  expect(deriveExactGapAnnotation(document, candidate(document, 0), "sofa|table"))
    .toMatchObject({ actualMm: 0, requiredMm: 0, satisfied: true, zeroLength: true, label: "↔ Зазор 0 мм" });
});

it("returns null for missing Preview, active key, exact rule, object or unique overlap witness", () => {
  const document = documentWithGap(842);
  const exact = candidate(document);
  expect(deriveExactGapAnnotation(document, null, "sofa|table")).toBeNull();
  expect(deriveExactGapAnnotation(document, exact, null)).toBeNull();
  expect(deriveExactGapAnnotation(document, { ...exact, constraints: [] }, "sofa|table")).toBeNull();
  expect(deriveExactGapAnnotation({ ...document, placedObjects: document.placedObjects.slice(0, 1) }, exact, "sofa|table")).toBeNull();
  const overlap = documentWithGap(-100);
  expect(deriveExactGapAnnotation(overlap, candidate(overlap, 0), "sofa|table")).toBeNull();
});
```

- [ ] **Step 2: Confirm RED**

```bash
pnpm --filter web test -- components/planning/exact-gap-annotation.test.ts
```

Expected: FAIL because the view-model does not exist.

- [ ] **Step 3: Implement the pure view-model**

Use `planningPairIds()`, `planningPairKey()`, `objectRectangle()` and `minimumGapWitnessBetweenOrientedRectangles()`. Resolve the active normalized `pair-min-gap`, then resolve both objects from the supplied preview document. Return `null` for missing data or `relation === "overlapping"`.

```ts
const EXACT_SPATIAL_EPSILON_MM = 1e-6;
const compactMm = (value: number) => Number(value.toFixed(2));

const actualMm = witness.distanceMm;
return {
  pairKey: activePairKey,
  firstPoint: witness.firstPoint,
  secondPoint: witness.secondPoint,
  actualMm,
  requiredMm: constraint.minimumMm,
  satisfied: actualMm + EXACT_SPATIAL_EPSILON_MM >= constraint.minimumMm,
  zeroLength: actualMm <= EXACT_SPATIAL_EPSILON_MM,
  label: `↔ Зазор ${compactMm(actualMm)} мм`,
};
```

The function accepts an already-derived preview document, so it never falls back to persisted transforms.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter web test -- components/planning/exact-gap-annotation.test.ts
pnpm --filter web typecheck
git add apps/web/components/planning/exact-gap-annotation.ts apps/web/components/planning/exact-gap-annotation.test.ts
git commit -m "feat: derive exact gap preview annotations"
```

Expected: PASS.

---

### Task 5: Structured Exact Evidence Cards

**Files:**
- Modify: `apps/web/components/planning/planning-panel.tsx`
- Modify: `apps/web/components/planning/planning-panel.test.tsx`
- Modify: `apps/web/app/globals.css`

**View props:**

```ts
activeExactPairKey: string | null;
onShowExactPair: (candidate: RankedPlanningCandidate, pairKey: string) => void;
```

- [ ] **Step 1: Write failing panel tests**

Update the `ranked.evaluation` fixture:

```ts
reasons: [
  "Все выбранные предметы помещаются без столкновений.",
  "Открывание дверей не перекрыто.",
],
exactEvidence: [{
  kind: "pair-min-gap",
  objectIds: ["sofa", "table"],
  requiredMm: 800,
  actualMm: 842,
  satisfied: true,
}],
```

Pass:

```tsx
activeExactPairKey="sofa|table"
onShowExactPair={() => {}}
```

Assert:

```ts
expect(html).toContain("↔ Минимальный зазор по контурам");
expect(html).toContain("Это не размер предмета и не расстояние между центрами");
expect(html).toContain("↔ Точное расстояние");
expect(html).toContain("Фактически");
expect(html).toContain("842 мм");
expect(html).toContain("Требуется");
expect(html).toContain("≥ 800 мм");
expect(html).toContain("По ближайшим точкам повёрнутых контуров");
expect(html).toContain("Показывается на плане");
expect(html).not.toContain("требуется минимум 800 мм, фактически 842 мм");
```

Add a second exact evidence entry for `chair|table`, set the active key to `sofa|table`, and assert both `Показывается на плане` and `Показать на плане` are present.

- [ ] **Step 2: Confirm RED**

```bash
pnpm --filter web test -- components/planning/planning-panel.test.tsx
```

Expected: FAIL because structured cards and new copy do not exist.

- [ ] **Step 3: Implement the panel copy and cards**

Input label:

```text
↔ Минимальный зазор по контурам
```

Helper:

```text
Кратчайшее расстояние между внешними контурами предметов с учётом поворота. Это не размер предмета и не расстояние между центрами.
```

For every `candidate.evaluation.exactEvidence`, resolve names from `objects`, compute `pairKey`, and render:

```text
↔ Точное расстояние
Диван — Стол
Фактически: 842 мм
Требуется: ≥ 800 мм
По ближайшим точкам повёрнутых контуров
[Показывается на плане | Показать на плане]
```

Use `Number(value.toFixed(2))`. Keep generic reasons in their existing list; exact evidence is no longer in that list.

In the stateful panel:

```ts
const activeExactPairKey = useStore(planningUiStore, (state) => state.activeExactPairKey);
const showExactPair = (candidate: RankedPlanningCandidate, pairKey: string) => {
  planningUiStore.getState().setPreviewCandidate(candidate.candidate);
  planningUiStore.getState().setActiveExactPairKey(pairKey);
};
```

Existing Preview automatically selects the first exact pair via the store.

- [ ] **Step 4: Add focused CSS**

```css
.planning-exact-list { display:grid; gap:7px; }
.planning-exact-card { display:grid; gap:7px; padding:9px; border:1px solid #ddd6fe; border-radius:9px; background:#faf8ff; }
.planning-exact-card.is-active { border-color:#8b5cf6; box-shadow:0 0 0 2px rgba(139,92,246,.1); }
.planning-exact-heading,.planning-exact-metric { display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
.planning-exact-heading span { color:#6d28d9; font-size:10px; font-weight:750; }
.planning-exact-metric dt { color:#64748b; font-size:10px; }
.planning-exact-metric dd { margin:0; font-size:11px; font-weight:750; }
.planning-exact-note { margin:0; color:#64748b; font-size:10px; line-height:1.4; }
```

Use existing `.secondary-action` buttons.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter web test -- components/planning/planning-panel.test.tsx
pnpm --filter web typecheck
git add apps/web/components/planning/planning-panel.tsx apps/web/components/planning/planning-panel.test.tsx apps/web/app/globals.css
git commit -m "feat: explain exact gaps in planning results"
```

Expected: PASS.

---

### Task 6: Contextual Canvas Overlay

**Files:**
- Create: `apps/web/components/editor/exact-gap-overlay.tsx`
- Create: `apps/web/components/editor/exact-gap-overlay.test.ts`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/editor-canvas-layers.test.ts`

**Interfaces:**

```ts
export type ExactGapOverlayLayout = Readonly<{
  first: Point2;
  second: Point2;
  label: Point2;
  labelWidth: number;
  zeroLength: boolean;
}>;

export function deriveExactGapOverlayLayout(
  annotation: ExactGapAnnotation,
  viewport: ViewportTransform,
  stageSize: Readonly<{ width: number; height: number }>,
): ExactGapOverlayLayout;
```

- [ ] **Step 1: Write failing overlay tests**

Create `exact-gap-overlay.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { worldToScreen, type ViewportTransform } from "@vlezet/geometry";
import type { ExactGapAnnotation } from "../planning/exact-gap-annotation";
import { deriveExactGapOverlayLayout } from "./exact-gap-overlay";

const viewport: ViewportTransform = { offsetX: 100, offsetY: 50, pixelsPerMillimeter: 0.1 };
const annotation: ExactGapAnnotation = {
  pairKey: "sofa|table",
  firstPoint: { x: 500, y: 500 },
  secondPoint: { x: 1342, y: 500 },
  actualMm: 842,
  requiredMm: 800,
  satisfied: true,
  zeroLength: false,
  label: "↔ Зазор 842 мм",
};

it("converts witness points to screen space", () => {
  const layout = deriveExactGapOverlayLayout(annotation, viewport, { width: 900, height: 700 });
  expect(layout.first).toEqual(worldToScreen(annotation.firstPoint, viewport));
  expect(layout.second).toEqual(worldToScreen(annotation.secondPoint, viewport));
  expect(layout.zeroLength).toBe(false);
});

it("clamps the label inside the stage", () => {
  const edge = { ...annotation, firstPoint: { x: -1000, y: -1000 }, secondPoint: { x: -900, y: -1000 } };
  const layout = deriveExactGapOverlayLayout(edge, viewport, { width: 320, height: 240 });
  expect(layout.label.x).toBeGreaterThanOrEqual(8);
  expect(layout.label.x + layout.labelWidth).toBeLessThanOrEqual(312);
  expect(layout.label.y).toBeGreaterThanOrEqual(8);
  expect(layout.label.y).toBeLessThanOrEqual(210);
});

it("offsets a zero-length contact label", () => {
  const contact = { ...annotation, firstPoint: { x: 500, y: 500 }, secondPoint: { x: 500, y: 500 }, actualMm: 0, zeroLength: true, label: "↔ Зазор 0 мм" };
  const layout = deriveExactGapOverlayLayout(contact, viewport, { width: 900, height: 700 });
  expect(layout.label.y).not.toBe(layout.first.y);
});

it("uses a distinct non-interactive exact-gap visual language", () => {
  const source = readFileSync(new URL("./exact-gap-overlay.tsx", import.meta.url), "utf8");
  expect(source).toContain("listening={false}");
  expect(source).toContain("dash={[7, 5]}");
  expect(source).toContain("#7c3aed");
  expect(source).toContain("pointerAtBeginning");
  expect(source).toContain("pointerAtEnding");
});
```

- [ ] **Step 2: Confirm RED**

```bash
pnpm --filter web test -- components/editor/exact-gap-overlay.test.ts
```

Expected: FAIL because the overlay module does not exist.

- [ ] **Step 3: Implement screen-space layout**

```ts
const labelWidth = Math.max(92, annotation.label.length * 6.6 + 20);
```

Convert both points with `worldToScreen()`. For non-zero segments, place the label at the midpoint plus a 14px perpendicular offset. For zero length, use `{ x: first.x + 16, y: first.y - 28 }`. Clamp label `x` to `[8, stage.width - labelWidth - 8]` and `y` to `[8, stage.height - 30]`.

- [ ] **Step 4: Implement the non-interactive Konva component**

Use one `Group listening={false}`. For a non-zero witness render:

```tsx
<Arrow
  points={[first.x, first.y, second.x, second.y]}
  stroke={annotation.satisfied ? "#7c3aed" : "#dc2626"}
  fill={annotation.satisfied ? "#7c3aed" : "#dc2626"}
  strokeWidth={1.5}
  dash={[7, 5]}
  pointerLength={6}
  pointerWidth={6}
  pointerAtBeginning
  pointerAtEnding
  listening={false}
/>
```

Add 3px endpoint circles. For zero length render one 5px contact marker with an outer ring and no Arrow. Render a white pill with violet/danger border and `annotation.label`. All sizes are screen-space constants.

- [ ] **Step 5: Integrate without adding a Konva layer**

In `editor-canvas.tsx`:

```ts
const activeExactPairKey = useStore(planningUiStore, (state) => state.activeExactPairKey);
const exactGapAnnotation = useMemo(
  () => deriveExactGapAnnotation(planningPreviewDocument, planningPreviewCandidate, activeExactPairKey),
  [activeExactPairKey, planningPreviewCandidate, planningPreviewDocument],
);
```

Render `<ExactGapOverlay annotation={exactGapAnnotation} viewport={viewport} stageSize={size} />` after planning ghost objects inside the existing object `<Layer>`. Render nothing for `null`.

Extend `editor-canvas-layers.test.ts`:

```ts
expect(physicalLayers).toBeLessThanOrEqual(5);
expect(source).toContain("ExactGapOverlay");
expect(source).toContain("activeExactPairKey");
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter web test -- components/editor/exact-gap-overlay.test.ts components/editor/editor-canvas-layers.test.ts
pnpm --filter web test
pnpm --filter web typecheck
git add apps/web/components/editor/exact-gap-overlay.tsx apps/web/components/editor/exact-gap-overlay.test.ts apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/editor-canvas-layers.test.ts
git commit -m "feat: visualize exact furniture gaps on canvas"
```

Expected: PASS and no sixth physical `<Layer>`.

---

### Task 7: Full Gate, Acceptance Record and Draft PR Refresh

**Files:**
- Modify: `docs/milestones/m6-3-acceptance.md`
- Verify: `apps/web/app/editor-viewport.css`
- Verify: `apps/web/app/layout.tsx`
- Verify: `.github/workflows/ci.yml`

- [ ] **Step 1: Run the complete gate**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits `0`.

- [ ] **Step 2: Review final architecture**

Verify:

```text
no VlezetDocument/schema/migration changes
no planning state in persistence/autosave/IndexedDB
no web closest-distance implementation
numeric distance delegates to geometry witness
one active exact pair and one overlay only
no sixth Konva Layer
exact evidence is structured and absent from generic reason strings
Apply and Undo/Redo paths unchanged
editor-viewport.css remains imported after globals.css
```

- [ ] **Step 3: Update acceptance record without claiming browser PASS**

Append:

```markdown
## Exact-gap visualization refinement

- [x] authoritative closest-point geometry witness
- [x] numeric exact validation delegates to the same witness calculation
- [x] structured exact evidence promoted through candidate evaluation
- [x] contextual one-pair 2D overlay with `↔ Зазор N мм`
- [x] structured `Фактически / Требуется / по контурам` result card
- [x] active pair remains ephemeral and clears with Preview/input/close
- [x] inspector viewport regression remains covered
- [ ] representative browser acceptance confirms clarity at the reported viewport and browser scale
```

Commit:

```bash
git add docs/milestones/m6-3-acceptance.md
git commit -m "docs: add M6.3 exact gap visualization gate"
```

- [ ] **Step 4: Verify exact PR head in GitHub Actions**

Require PASS on the exact final commit for install, tests, typecheck, lint and build. Do not cite an older run.

- [ ] **Step 5: Refresh Draft PR #15**

Record the exact head/run and delivered UX. Keep Draft and unmerged.

- [ ] **Step 6: Representative browser acceptance**

At the reported viewport and browser scale:

```text
1. Select furniture and confirm the complete inspector remains visible.
2. Preview one exact pair and confirm one violet dashed double-arrow connects visually nearest contour points.
3. Confirm the pill says `↔ Зазор N мм`.
4. Rotate an object and confirm endpoints move to the new nearest real contour points.
5. Confirm the panel separately shows `Фактически`, `Требуется` and contour semantics.
6. Confirm ordinary blue width/depth dimensions remain visually distinct.
7. Configure multiple exact pairs and switch `Показать на плане`; only one overlay remains visible.
8. Change exact input and confirm result, Preview and overlay clear together.
9. Confirm Preview creates no Undo step or save operation.
10. Apply and verify 2D→3D, one-step Undo/Redo and reload persistence.
```

- [ ] **Step 7: Merge only after explicit browser acceptance**

```text
mark PR #15 Ready
verify exact head and CI
squash merge PR #15
open a separate canonical docs PR
update PROJECT_STATE.md / ROADMAP.md / CHANGELOG.md / m6-3-acceptance.md with final merge SHA and accepted scope
verify docs PR exact-head CI
squash merge docs PR
```
