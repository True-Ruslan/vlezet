# M6.3 Exact Spatial Constraints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one exact hard planning rule, `pair-min-gap`, that guarantees a user-defined minimum edge-to-edge distance in millimetres between two oriented furniture footprints, with deterministic validation, measured evidence, non-mutating preview and atomic Apply/Undo/Redo.

**Architecture:** Put exact oriented-rectangle distance math in framework-independent `@vlezet/geometry`; extend `@vlezet/planning` with a normalized hard `pair-min-gap` contract that composes with M6.2 qualitative constraints; reuse the existing bounded M6 planner and M2 fit authority; extend the existing planning panel with raw millimetre input per selected object pair. Constraints/candidates/preview remain ephemeral; only explicit Apply mutates ordinary `VlezetDocument` transforms.

**Tech Stack:** TypeScript 6, Vitest 4, `@vlezet/domain`, `@vlezet/geometry`, `@vlezet/planning`, React 19, Zustand, Next.js 16, pnpm/Turborepo, GitHub Actions.

## Global Constraints

- Millimetres are the canonical world unit; pixels, DOM coordinates and Three.js meshes are never measurement authority.
- M2 `evaluateObjectFits()` remains authoritative for containment, object collision, door swing and clearance semantics.
- `pair-min-gap` is a hard binary rule; soft scores can never rescue a violation.
- Exact distance is minimum Euclidean edge-to-edge distance between oriented rectangular furniture footprints; touching/overlap return `0`.
- `minimumMm` must be finite and `>= 0`; `0` is valid; invalid numeric values fail closed.
- Same document + same normalized constraints must produce the same ordered alternatives.
- Existing M6.2 `lock-object`, wall/corner preferences and pair near/far preferences must remain compatible.
- No new persisted planning state, schema migration, generic rule language, LLM dependency, whole-apartment orchestration or direct 3D editing.
- Preview remains ephemeral/non-mutating; Apply revalidates current geometry and remains one semantic `planning/apply-candidate` history operation.
- Strict exact-head CI and representative real-browser acceptance are required before merge.

---

## File Structure

### New files

- `packages/geometry/src/oriented-rectangle-distance.ts` — exact distance between two oriented rectangles; no planning semantics.
- `packages/geometry/src/oriented-rectangle-distance.test.ts` — geometry RED→GREEN coverage.
- `packages/planning/src/exact-spacing.test.ts` — exact hard-constraint evaluation/composition contracts.
- `docs/milestones/m6-3-acceptance.md` — automated and browser acceptance gate/evidence.

### Modified files

- `packages/geometry/src/index.ts`
- `packages/planning/src/constraints.ts`
- `packages/planning/src/constraints.test.ts`
- `packages/planning/src/constraint-identity.test.ts`
- `packages/planning/src/constraint-revalidation.test.ts`
- `packages/planning/src/planner.test.ts`
- `packages/planning/src/apply.test.ts`
- `apps/web/components/planning/planning-panel.tsx`
- `apps/web/components/planning/planning-panel.test.tsx`

`packages/planning/src/index.ts` already uses `export * from "./constraints"`; no export wiring change is required there.

---

### Task 1: Exact oriented-rectangle distance primitive

**Files:**
- Create: `packages/geometry/src/oriented-rectangle-distance.ts`
- Create: `packages/geometry/src/oriented-rectangle-distance.test.ts`
- Modify: `packages/geometry/src/index.ts`

**Interfaces:**
- Consumes: `OrientedRectangle`, `orientedRectangleEdges()`, `orientedRectanglesIntersect()`.
- Produces: `minimumDistanceBetweenOrientedRectangles(first, second): number` in canonical millimetres.

- [ ] **Step 1: Write the failing geometry tests**

```ts
import { describe, expect, it } from "vitest";
import { minimumDistanceBetweenOrientedRectangles } from "./oriented-rectangle-distance";
import type { OrientedRectangle } from "./oriented-rectangle";

const rect = (x: number, y: number, width: number, depth: number, rotationDeg = 0): OrientedRectangle => ({
  center: { x, y }, width, depth, rotationDeg,
});

describe("minimumDistanceBetweenOrientedRectangles", () => {
  it("returns an exact 1000 mm axis-aligned edge gap", () => {
    expect(minimumDistanceBetweenOrientedRectangles(rect(0, 0, 1000, 1000), rect(2000, 0, 1000, 1000))).toBe(1000);
  });

  it("returns zero for touching and overlapping rectangles", () => {
    expect(minimumDistanceBetweenOrientedRectangles(rect(0, 0, 1000, 1000), rect(1000, 0, 1000, 1000))).toBe(0);
    expect(minimumDistanceBetweenOrientedRectangles(rect(0, 0, 1000, 1000), rect(500, 0, 1000, 1000))).toBe(0);
  });

  it("measures rotated rectangles exactly", () => {
    const offset = 1500 / Math.sqrt(2);
    const first = rect(0, 0, 1000, 600, 45);
    const second = rect(offset, offset, 1000, 600, 45);
    expect(minimumDistanceBetweenOrientedRectangles(first, second)).toBeCloseTo(500, 6);
  });

  it("is symmetric", () => {
    const first = rect(100, -200, 900, 500, 27);
    const second = rect(2200, 1300, 700, 1100, -18);
    expect(minimumDistanceBetweenOrientedRectangles(first, second))
      .toBeCloseTo(minimumDistanceBetweenOrientedRectangles(second, first), 9);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/geometry test
```

Expected: FAIL because the module/function does not exist.

- [ ] **Step 3: Implement the minimal primitive**

```ts
import type { Point2 } from "./point";
import {
  orientedRectangleEdges,
  orientedRectanglesIntersect,
  type OrientedRectangle,
} from "./oriented-rectangle";

const DISTANCE_EPSILON = 1e-6;
type Segment = Readonly<{ start: Point2; end: Point2 }>;

function pointToSegmentDistance(point: Point2, segment: Segment): number {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - segment.start.x, point.y - segment.start.y);
  const t = Math.max(0, Math.min(1,
    ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared,
  ));
  return Math.hypot(
    point.x - (segment.start.x + t * dx),
    point.y - (segment.start.y + t * dy),
  );
}

function segmentDistance(first: Segment, second: Segment): number {
  return Math.min(
    pointToSegmentDistance(first.start, second),
    pointToSegmentDistance(first.end, second),
    pointToSegmentDistance(second.start, first),
    pointToSegmentDistance(second.end, first),
  );
}

export function minimumDistanceBetweenOrientedRectangles(
  first: OrientedRectangle,
  second: OrientedRectangle,
): number {
  if (orientedRectanglesIntersect(first, second)) return 0;
  let minimum = Number.POSITIVE_INFINITY;
  for (const firstEdge of orientedRectangleEdges(first)) {
    for (const secondEdge of orientedRectangleEdges(second)) {
      minimum = Math.min(minimum, segmentDistance(firstEdge, secondEdge));
    }
  }
  return minimum <= DISTANCE_EPSILON ? 0 : minimum;
}
```

This is exact for disjoint convex rectangles because the minimum separation occurs between a vertex and an opposing edge; overlapping rectangles are caught by the existing SAT helper first. Touching is normalized to zero by the epsilon boundary.

- [ ] **Step 4: Export and run GREEN**

Add to `packages/geometry/src/index.ts`:

```ts
export { minimumDistanceBetweenOrientedRectangles } from "./oriented-rectangle-distance";
```

Run:

```bash
pnpm --filter @vlezet/geometry test
pnpm --filter @vlezet/geometry typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/geometry/src/oriented-rectangle-distance.ts packages/geometry/src/oriented-rectangle-distance.test.ts packages/geometry/src/index.ts
git commit -m "feat: add exact oriented rectangle distance"
```

---

### Task 2: `pair-min-gap` contract, validation and stable identity

**Files:**
- Modify: `packages/planning/src/constraints.ts`
- Modify: `packages/planning/src/constraints.test.ts`
- Modify: `packages/planning/src/constraint-identity.test.ts`

**Interfaces:**

```ts
export type PairMinimumGapPlanningConstraint = Readonly<{
  kind: "pair-min-gap";
  objectIds: readonly [string, string];
  minimumMm: number;
}>;
```

`PlanningConstraint` gains this union member.

- [ ] **Step 1: Write RED normalization/validation tests**

```ts
expect(normalizePlanningConstraints([
  { kind: "pair-min-gap", objectIds: ["table", "sofa"], minimumMm: 800 },
])).toEqual([
  { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
]);

expect(validatePlanningConstraintSet([
  { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 0 },
], new Set(["sofa", "table"]))).toHaveLength(1);

for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  expect(() => validatePlanningConstraintSet([
    { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: invalid },
  ], new Set(["sofa", "table"]))).toThrow();
}

expect(validatePlanningConstraintSet([
  { kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" },
  { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
], new Set(["sofa", "table"]))).toHaveLength(2);
```

Also assert self-pair, outside-selection reference and duplicate exact rule on the same unordered pair throw.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/planning test
```

Expected: compile/test FAIL because the new union member does not exist.

- [ ] **Step 3: Add normalization and distinct identity namespace**

Add branches equivalent to:

```ts
case "pair-min-gap": {
  const ids = constraint.objectIds;
  if (!Array.isArray(ids) || ids.length !== 2 || typeof ids[0] !== "string" || typeof ids[1] !== "string" ||
      ids[0].length === 0 || ids[1].length === 0 || !Number.isFinite(constraint.minimumMm) || constraint.minimumMm < 0) {
    throw new Error("Invalid pair-min-gap constraint.");
  }
  const ordered = ids[0].localeCompare(ids[1]) <= 0 ? [ids[0], ids[1]] : [ids[1], ids[0]];
  return { kind: "pair-min-gap", objectIds: [ordered[0]!, ordered[1]!], minimumMm: constraint.minimumMm };
}
```

Identity/value branches:

```ts
case "pair-min-gap":
  return `pair-min-gap:${constraint.objectIds[0]}:${constraint.objectIds[1]}`;

case "pair-min-gap":
  return `${stableConstraintIdentity(constraint)}:${constraint.minimumMm}`;
```

Keep `MAX_PLANNING_CONSTRAINTS = 9`. Because the new identity prefix differs from `pair-distance`, both rules may coexist for the same pair.

- [ ] **Step 4: Validate selected IDs and self-pairs**

In `validatePlanningConstraintSet()`, route both pair kinds through pair validation, while keeping identities distinct:

```ts
if (constraint.kind === "pair-distance" || constraint.kind === "pair-min-gap") {
  const [first, second] = constraint.objectIds;
  if (first === second) throw new Error("Pair constraint requires two distinct objects.");
  if (!selectedObjectIds.has(first) || !selectedObjectIds.has(second)) {
    throw new Error("Pair constraint references an object outside the planning selection.");
  }
  continue;
}
```

- [ ] **Step 5: Prove stable identity semantics**

```ts
expect(planningConstraintSetKey([
  { kind: "pair-min-gap", objectIds: ["table", "sofa"], minimumMm: 800 },
])).toBe(planningConstraintSetKey([
  { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
]));

expect(planningConstraintSetKey([
  { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
])).not.toBe(planningConstraintSetKey([
  { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 801 },
]));
```

- [ ] **Step 6: Run GREEN and commit**

```bash
pnpm --filter @vlezet/planning test
pnpm --filter @vlezet/planning typecheck
git add packages/planning/src/constraints.ts packages/planning/src/constraints.test.ts packages/planning/src/constraint-identity.test.ts
git commit -m "feat: add exact pair minimum gap contract"
```

Expected: PASS.

---

### Task 3: Hard exact-gap evaluation and structured measured evidence

**Files:**
- Create: `packages/planning/src/exact-spacing.test.ts`
- Modify: `packages/planning/src/constraints.ts`
- Modify: `packages/planning/src/planner.test.ts`

**Interfaces:**

```ts
export type PairMinimumGapConstraintEvidence = Readonly<{
  kind: "pair-min-gap";
  objectIds: readonly [string, string];
  requiredMm: number;
  actualMm: number;
  satisfied: boolean;
}>;
```

`PlanningConstraintEvaluation` gains:

```ts
exactEvidence: readonly PairMinimumGapConstraintEvidence[];
```

Existing `evidence: readonly string[]` remains deterministic display copy.

- [ ] **Step 1: Create explicit test fixtures and RED tests**

In `exact-spacing.test.ts`, use a full document fixture:

```ts
import type { VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import { evaluatePlanningConstraints } from "./constraints";
import type { PlanningCandidate } from "./contracts";

function documentWithEdgeGap(gapMm: number): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } },
      { id: "v2", position: { x: 6000, y: 0 } },
      { id: "v3", position: { x: 6000, y: 4000 } },
      { id: "v4", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "w1", startVertexId: "v1", endVertexId: "v2", junctionVertexIds: [], thickness: 100 },
      { id: "w2", startVertexId: "v2", endVertexId: "v3", junctionVertexIds: [], thickness: 100 },
      { id: "w3", startVertexId: "v3", endVertexId: "v4", junctionVertexIds: [], thickness: 100 },
      { id: "w4", startVertexId: "v4", endVertexId: "v1", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [
      { id: "sofa", presetId: null, name: "Диван", category: "seating", position: { x: 1500, y: 2000 }, width: 1000, depth: 700, height: 800, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } },
      { id: "table", presetId: null, name: "Стол", category: "table", position: { x: 2500 + gapMm, y: 2000 }, width: 1000, depth: 700, height: 750, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } },
    ],
  };
}

function candidate(document: VlezetDocument, minimumMm: number): PlanningCandidate {
  return {
    id: `candidate:${minimumMm}`,
    roomId: "room:placeholder",
    placements: document.placedObjects.map((object) => ({ objectId: object.id, position: object.position, rotationDeg: object.rotationDeg })),
    constraints: [{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm }],
  };
}
```

Before assertions, replace `roomId` with the actual derived room ID inside the test using `deriveRooms(document).rooms[0]!.id` so no hard-coded derived ID is relied upon.

Assertions:

```ts
const below = documentWithEdgeGap(799);
const exact = documentWithEdgeGap(800);
const above = documentWithEdgeGap(842);

expect(evaluatePlanningConstraints(below, { ...candidate(below, 800), roomId: deriveRooms(below).rooms[0]!.id }).hardValid).toBe(false);
expect(evaluatePlanningConstraints(exact, { ...candidate(exact, 800), roomId: deriveRooms(exact).rooms[0]!.id }).hardValid).toBe(true);
expect(evaluatePlanningConstraints(above, { ...candidate(above, 800), roomId: deriveRooms(above).rooms[0]!.id }).exactEvidence).toContainEqual({
  kind: "pair-min-gap", objectIds: ["sofa", "table"], requiredMm: 800, actualMm: 842, satisfied: true,
});
```

Add a candidate containing both `pair-distance: near` and `pair-min-gap: 800`; assert gap `799` remains hard-invalid regardless of preference penalty.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/planning test
```

Expected: FAIL because exact measurement/evidence is not implemented.

- [ ] **Step 3: Add exact measurement/evidence branch**

Extend the existing geometry import exactly with:

```ts
import {
  deriveRooms,
  distanceBetween,
  minimumDistanceBetweenOrientedRectangles,
  objectRectangle,
  orientedRectangleCorners,
} from "@vlezet/geometry";
```

Add:

```ts
const EXACT_SPATIAL_EPSILON_MM = 1e-6;

function formatMm(value: number): string {
  return Number(value.toFixed(2)).toString();
}
```

Initialize:

```ts
const evidence: string[] = [];
const exactEvidence: PairMinimumGapConstraintEvidence[] = [];
```

Before the existing `pair-distance` handling:

```ts
if (constraint.kind === "pair-min-gap") {
  const [firstId, secondId] = constraint.objectIds;
  const first = objects.get(firstId);
  const second = objects.get(secondId);
  if (!first || !second) {
    hardValid = false;
    evidence.push("Не найдены предметы для проверки точного минимального расстояния.");
    continue;
  }
  const actualMm = minimumDistanceBetweenOrientedRectangles(objectRectangle(first), objectRectangle(second));
  const satisfied = actualMm + EXACT_SPATIAL_EPSILON_MM >= constraint.minimumMm;
  hardValid = hardValid && satisfied;
  exactEvidence.push({ kind: "pair-min-gap", objectIds: constraint.objectIds, requiredMm: constraint.minimumMm, actualMm, satisfied });
  evidence.push(`${first.name} ↔ ${second.name}: требуется минимум ${formatMm(constraint.minimumMm)} мм, фактически ${formatMm(actualMm)} мм.`);
  continue;
}
```

Every early return from `evaluatePlanningConstraints()` must return `exactEvidence: []`; the final return must include `exactEvidence`.

- [ ] **Step 4: Prove M2 remains first hard authority and ordering remains deterministic**

In `planner.test.ts`, add two regressions:

```ts
const first = planLayoutAlternatives(document, requestWithExactConstraint);
const second = planLayoutAlternatives(document, requestWithExactConstraint);
expect(second.candidates.map((item) => item.candidate.id)).toEqual(first.candidates.map((item) => item.candidate.id));
```

and a fixture where exact gap is sufficient but M2 reports collision/door/containment invalidity; assert that candidate is never returned as valid.

Do not change `comparePlanningCandidateEvaluations()` ordering.

- [ ] **Step 5: Run GREEN and commit**

```bash
pnpm --filter @vlezet/planning test
pnpm --filter @vlezet/planning typecheck
git add packages/planning/src/exact-spacing.test.ts packages/planning/src/constraints.ts packages/planning/src/planner.test.ts
git commit -m "feat: enforce exact pair spacing in planning"
```

Expected: PASS.

---

### Task 4: Apply-time exact revalidation remains atomic

**Files:**
- Modify: `packages/planning/src/apply.test.ts`
- Modify: `packages/planning/src/constraint-revalidation.test.ts`
- `packages/planning/src/apply.ts` should remain unchanged because it already delegates to `evaluatePlanningCandidate()`.

**Interfaces:** Existing `applyPlanningCandidateToDocument()` must recompute the exact rule through the ordinary evaluation path.

- [ ] **Step 1: Add stale exact-gap Apply regression**

Build a valid candidate carrying:

```ts
constraints: [{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 }]
```

Then alter current document geometry so the candidate's recomputed actual gap becomes `< 800` and assert:

```ts
const before = JSON.stringify(staleCurrent);
expect(() => applyPlanningCandidateToDocument(staleCurrent, candidate))
  .toThrowError(expect.objectContaining({ code: "candidate-invalid" }));
expect(JSON.stringify(staleCurrent)).toBe(before);
```

Add direct-candidate regressions for `NaN`, self-pair and outside-selection reference; they must all fail closed.

- [ ] **Step 2: Run planning and web history tests**

```bash
pnpm --filter @vlezet/planning test
pnpm --filter web test
```

Expected: PASS after Task 3 because Apply already calls `evaluatePlanningCandidate()`. If a regression fails, fix the shared evaluator/validator only; do not add duplicate gap math to `apply.ts`.

- [ ] **Step 3: Commit tests**

```bash
git add packages/planning/src/apply.test.ts packages/planning/src/constraint-revalidation.test.ts
git commit -m "test: cover exact spacing apply revalidation"
```

---

### Task 5: Exact millimetre pair input in the existing planning panel

**Files:**
- Modify: `apps/web/components/planning/planning-panel.tsx`
- Modify: `apps/web/components/planning/planning-panel.test.tsx`

**Interfaces:** Add raw state `pairMinimumGapInputs: Record<string, string>`; empty string means no rule, `"0"` means a real zero rule.

- [ ] **Step 1: Write RED parser/builder/render tests**

```ts
expect(parsePairMinimumGapInput("")).toBeNull();
expect(parsePairMinimumGapInput("0")).toBe(0);
expect(parsePairMinimumGapInput("800")).toBe(800);
expect(parsePairMinimumGapInput("800,5")).toBe(800.5);
expect(() => parsePairMinimumGapInput("-1")).toThrow();
expect(() => parsePairMinimumGapInput("abc")).toThrow();

const key = planningPairKey("sofa", "table");
const constraints = buildPlanningConstraints(
  ["sofa", "table"], [], {}, { [key]: "near" }, { [key]: "800" },
);
expect(constraints).toContainEqual({ kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" });
expect(constraints).toContainEqual({ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 });
```

Render tests must assert:

```text
Минимальный проход между предметами
по ближайшим краям мебели
требуется минимум 800 мм
фактически 842 мм
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter web test
```

Expected: FAIL because exact input/parser does not exist.

- [ ] **Step 3: Add one canonical raw-input parser**

```ts
export function parsePairMinimumGapInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("Введите минимальный проход как неотрицательное число в миллиметрах.");
  }
  return value;
}
```

- [ ] **Step 4: Extend `buildPlanningConstraints()` with exact pair inputs**

Add fifth parameter:

```ts
pairMinimumGapInputs: Readonly<Record<string, string | undefined>>,
```

Inside the existing selected-pair loop, after optional `pair-distance` creation:

```ts
const minimumMm = parsePairMinimumGapInput(pairMinimumGapInputs[key] ?? "");
if (minimumMm !== null) {
  const ids = pairIdsFromKey(key);
  if (ids && selected.has(ids[0]) && selected.has(ids[1])) {
    constraints.push({ kind: "pair-min-gap", objectIds: ids, minimumMm });
  }
}
```

- [ ] **Step 5: Extend pair view model/state and clear stale results**

Add:

```ts
minimumGapInput: string;
minimumGapError: string | null;
```

to `PlanningPairChoice`, and state:

```ts
const [pairMinimumGapInputs, setPairMinimumGapInputs] = useState<Record<string, string>>({});
```

On object deselection, filter exact inputs with the same `pairIdsFromKey()` predicate already used for pair preferences. On exact input change:

```ts
setPairMinimumGapInputs((current) => ({ ...current, [pairKey]: raw }));
clearGeneratedState();
```

Derive each `minimumGapError` by calling `parsePairMinimumGapInput()` in `try/catch`. `canGenerate` must require that all selected-pair errors are null.

- [ ] **Step 6: Add compact pair input and exact helper copy**

```tsx
<label className="planning-field">
  <span>Минимальный проход между предметами</span>
  <div className="length-field-row">
    <input
      inputMode="decimal"
      value={pair.minimumGapInput}
      aria-invalid={pair.minimumGapError ? true : undefined}
      onChange={(event) => onPairMinimumGapChange(pair.key, event.target.value)}
    />
    <span>мм</span>
  </div>
  {pair.minimumGapError ? <span className="field-error">{pair.minimumGapError}</span> : null}
</label>
```

Helper copy:

```text
«Ближе/дальше» ранжируется по центрам предметов. Минимальный проход — жёсткое требование по ближайшим краям мебели с учётом поворота.
```

`generate()` must call the same `buildPlanningConstraints()` with `pairMinimumGapInputs`; no second parser/validation path.

- [ ] **Step 7: Run GREEN and commit**

```bash
pnpm --filter web test
pnpm --filter web typecheck
git add apps/web/components/planning/planning-panel.tsx apps/web/components/planning/planning-panel.test.tsx
git commit -m "feat: add exact pair spacing controls"
```

Expected: PASS.

---

### Task 6: Full regression gate, Draft PR and browser acceptance

**Files:**
- Create: `docs/milestones/m6-3-acceptance.md`
- Do not mark `PROJECT_STATE.md`, `ROADMAP.md` or `CHANGELOG.md` DONE before accepted browser verification and merge.

- [ ] **Step 1: Run full strict verification**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all PASS.

- [ ] **Step 2: Architecture self-review**

Confirm changed files satisfy exactly:

```text
no VlezetDocument schema/migration change
no IndexedDB/autosave planning persistence
no Three.js/Canvas measurement authority
no duplicate M2 fit/collision/door engine
pair-min-gap hard-valid before soft ranking
exact geometry primitive framework-independent
candidate identity contains normalized minimumMm
preview remains non-mutating
Apply remains one semantic history operation
```

- [ ] **Step 3: Create acceptance checklist**

`docs/milestones/m6-3-acceptance.md` must require:

```text
1. Baseline M6.1/M6.2 generation works with empty exact inputs.
2. Select two movable objects; enter feasible minimum, e.g. 800 mm.
3. Generate: explanation shows required and actual edge-to-edge mm.
4. Preview visibly respects the nearest-edge minimum.
5. Combine "Ближе друг к другу" + 800 mm; alternatives approach but never violate the hard minimum when candidate space permits.
6. Change exact value; stale result/preview clears immediately.
7. Enter impossible/high value; no violating alternative is offered.
8. Enter invalid/negative text; generation is blocked with explicit validation.
9. Apply valid candidate; 3D projects ordinary document positions normally.
10. One Undo restores all transforms; one Redo reapplies them.
11. Reload: only applied ordinary transforms persist, not exact constraints.
12. Manual editing, M2 fit and M5 spatial/inspection still work.
```

- [ ] **Step 4: Open Draft PR and record exact-head CI**

PR body must record:

```text
Design: docs/superpowers/specs/2026-07-23-m6-3-exact-spatial-constraints-design.md
Plan: docs/superpowers/plans/2026-07-23-m6-3-exact-spatial-constraints.md
Acceptance: docs/milestones/m6-3-acceptance.md
Final exact head: <actual SHA after implementation>
GitHub Actions: <actual run ID> — PASS
```

Replace the two angle-bracket fields with real values before declaring the RC ready for browser acceptance; they are execution-time evidence fields, not unresolved design requirements.

- [ ] **Step 5: Merge gate**

Do not merge until explicit product-owner browser acceptance. After acceptance:

```text
mark PR Ready
→ verify exact PR head + strict CI PASS
→ squash merge
→ update M6.3 acceptance with accepted head/run/merge
→ update PROJECT_STATE.md / ROADMAP.md / CHANGELOG.md in a separate canonical docs PR
```
