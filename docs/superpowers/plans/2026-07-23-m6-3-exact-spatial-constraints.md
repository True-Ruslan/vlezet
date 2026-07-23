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

- `packages/geometry/src/oriented-rectangle-distance.ts` — reusable exact distance primitive for two oriented rectangles; no planning semantics.
- `packages/geometry/src/oriented-rectangle-distance.test.ts` — geometry RED→GREEN coverage for axis-aligned, rotated, touching, overlap, symmetry and floating-point boundaries.
- `packages/planning/src/exact-spacing.test.ts` — exact hard-constraint normalization/evaluation/composition contracts.
- `docs/milestones/m6-3-acceptance.md` — automated and browser acceptance gate/evidence.

### Modified files

- `packages/geometry/src/index.ts` — export exact distance primitive/type-level public API only.
- `packages/planning/src/constraints.ts` — add `pair-min-gap`, normalization/identity/validation, exact measurement and structured evidence.
- `packages/planning/src/constraints.test.ts` — extend shared constraint-set validation coverage.
- `packages/planning/src/constraint-identity.test.ts` — prove input-order invariance and `minimumMm`-sensitive intent identity.
- `packages/planning/src/constraint-revalidation.test.ts` — prove direct-candidate/Apply boundary rejects malformed/stale exact constraints.
- `packages/planning/src/planner.test.ts` — prove hard exact constraints cannot be rescued by ranking and compose with M6.2.
- `packages/planning/src/apply.test.ts` — prove stale exact gap causes atomic Apply rejection.
- `packages/planning/src/index.ts` — export new constraint/evidence contracts as needed.
- `apps/web/components/planning/planning-panel.tsx` — raw exact-gap state, validation, constraint construction, pair UI and stale preview clearing.
- `apps/web/components/planning/planning-panel.test.tsx` — empty-vs-zero, invalid input, constraint construction and measured copy contracts.

---

### Task 1: Exact oriented-rectangle distance primitive

**Files:**
- Create: `packages/geometry/src/oriented-rectangle-distance.ts`
- Create: `packages/geometry/src/oriented-rectangle-distance.test.ts`
- Modify: `packages/geometry/src/index.ts`

**Interfaces:**
- Consumes: existing `OrientedRectangle`, `orientedRectangleEdges()` and `orientedRectanglesIntersect()` from `packages/geometry/src/oriented-rectangle.ts`.
- Produces: `minimumDistanceBetweenOrientedRectangles(first: OrientedRectangle, second: OrientedRectangle): number` in canonical millimetres.

- [ ] **Step 1: Write failing geometry tests**

Create tests equivalent to:

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

  it("measures rotated rectangles instead of axis-aligned bounds", () => {
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

- [ ] **Step 2: Run geometry tests and verify RED**

Run:

```bash
pnpm --filter @vlezet/geometry test
```

Expected: FAIL because `./oriented-rectangle-distance` / `minimumDistanceBetweenOrientedRectangles` does not exist.

- [ ] **Step 3: Implement the minimal exact primitive**

Use the existing rectangle helpers and isolate segment math inside the new file:

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
  const t = Math.max(0, Math.min(1, ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (segment.start.x + t * dx), point.y - (segment.start.y + t * dy));
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

The implementation must rely on existing rectangle validation/corner generation and must not use AABBs.

- [ ] **Step 4: Export the primitive**

Add to `packages/geometry/src/index.ts`:

```ts
export { minimumDistanceBetweenOrientedRectangles } from "./oriented-rectangle-distance";
```

- [ ] **Step 5: Run geometry GREEN plus typecheck**

Run:

```bash
pnpm --filter @vlezet/geometry test
pnpm --filter @vlezet/geometry typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the geometry primitive**

```bash
git add packages/geometry/src/oriented-rectangle-distance.ts packages/geometry/src/oriented-rectangle-distance.test.ts packages/geometry/src/index.ts
git commit -m "feat: add exact oriented rectangle distance"
```

---

### Task 2: `pair-min-gap` structured contract, normalization and identity

**Files:**
- Modify: `packages/planning/src/constraints.ts`
- Modify: `packages/planning/src/constraints.test.ts`
- Modify: `packages/planning/src/constraint-identity.test.ts`
- Modify: `packages/planning/src/index.ts`

**Interfaces:**
- Consumes: existing `PlanningConstraint[]`, `validatePlanningConstraintSet()`, `planningConstraintSetKey()`.
- Produces:

```ts
type PairMinimumGapPlanningConstraint = Readonly<{
  kind: "pair-min-gap";
  objectIds: readonly [string, string];
  minimumMm: number;
}>;
```

- [ ] **Step 1: Write RED tests for normalization and validation**

Add cases equivalent to:

```ts
expect(normalizePlanningConstraints([
  { kind: "pair-min-gap", objectIds: ["table", "sofa"], minimumMm: 800 },
])).toEqual([
  { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
]);

expect(() => validatePlanningConstraintSet([
  { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: -1 },
], new Set(["sofa", "table"]))).toThrow();

for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  expect(() => validatePlanningConstraintSet([
    { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: invalid },
  ], new Set(["sofa", "table"]))).toThrow();
}

expect(validatePlanningConstraintSet([
  { kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" },
  { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
], new Set(["sofa", "table"]))).toHaveLength(2);
```

Also prove duplicate/conflicting `pair-min-gap` on the same unordered pair fails, self-pair fails, outside-selection IDs fail and `minimumMm: 0` succeeds.

- [ ] **Step 2: Run planning tests and verify RED**

```bash
pnpm --filter @vlezet/planning test
```

Expected: compile/test failure because `pair-min-gap` is not part of `PlanningConstraint`.

- [ ] **Step 3: Extend the union and stable identities**

In `constraints.ts`, add the new type and union member. Use a distinct identity namespace so exact and soft pair rules can coexist:

```ts
case "pair-min-gap":
  return `pair-min-gap:${constraint.objectIds[0]}:${constraint.objectIds[1]}`;
```

Stable value must include the numeric intent:

```ts
case "pair-min-gap":
  return `${stableConstraintIdentity(constraint)}:${constraint.minimumMm}`;
```

Normalize unordered IDs lexically, exactly as `pair-distance` does.

- [ ] **Step 4: Validate exact numeric semantics fail-closed**

Add validation equivalent to:

```ts
if (!Number.isFinite(constraint.minimumMm) || constraint.minimumMm < 0) {
  throw new Error("Pair-min-gap minimumMm must be a finite non-negative number.");
}
```

Keep `MAX_PLANNING_CONSTRAINTS = 9` unchanged. Use the existing `seen` identity mechanism; because `pair-distance:*` and `pair-min-gap:*` identities differ, qualitative near/far and exact minimum gap can coexist on the same unordered pair.

- [ ] **Step 5: Prove candidate identity determinism**

In `constraint-identity.test.ts`, add:

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

- [ ] **Step 6: Run planning GREEN and typecheck**

```bash
pnpm --filter @vlezet/planning test
pnpm --filter @vlezet/planning typecheck
```

Expected: PASS for contract/identity tests; evaluation behavior is added in Task 3.

- [ ] **Step 7: Commit contract work**

```bash
git add packages/planning/src/constraints.ts packages/planning/src/constraints.test.ts packages/planning/src/constraint-identity.test.ts packages/planning/src/index.ts
git commit -m "feat: add exact pair minimum gap contract"
```

---

### Task 3: Hard exact-gap evaluation and measured evidence

**Files:**
- Create: `packages/planning/src/exact-spacing.test.ts`
- Modify: `packages/planning/src/constraints.ts`
- Modify: `packages/planning/src/planner.test.ts`

**Interfaces:**
- Consumes: `minimumDistanceBetweenOrientedRectangles()` and existing `objectRectangle()` from `@vlezet/geometry`.
- Produces structured evidence before copy formatting:

```ts
type PairMinimumGapConstraintEvidence = Readonly<{
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

Existing `evidence: readonly string[]` remains for deterministic user-facing reasons.

- [ ] **Step 1: Write RED evaluation tests**

Use deterministic fixtures whose furniture rectangles have known edge gaps. Cover:

```ts
expect(evaluatePlanningConstraints(docWithGap(799), candidateWithMinimum(800)).hardValid).toBe(false);
expect(evaluatePlanningConstraints(docWithGap(800), candidateWithMinimum(800)).hardValid).toBe(true);
expect(evaluatePlanningConstraints(docWithGap(842), candidateWithMinimum(800)).exactEvidence).toContainEqual({
  kind: "pair-min-gap",
  objectIds: ["sofa", "table"],
  requiredMm: 800,
  actualMm: 842,
  satisfied: true,
});
```

Add a composition test containing both:

```ts
{ kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" }
{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 }
```

and prove a candidate below 800 is hard-invalid regardless of its soft preference penalty.

- [ ] **Step 2: Run planning tests and verify RED**

```bash
pnpm --filter @vlezet/planning test
```

Expected: FAIL because exact measurement/evidence is not evaluated.

- [ ] **Step 3: Add exact measurement branch**

Import:

```ts
import {
  minimumDistanceBetweenOrientedRectangles,
  objectRectangle,
  ...
} from "@vlezet/geometry";
```

Before the existing generic `pair-distance` branch, handle `pair-min-gap`:

```ts
const EXACT_SPATIAL_EPSILON_MM = 1e-6;

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
  hardValid &&= satisfied;
  exactEvidence.push({
    kind: "pair-min-gap",
    objectIds: constraint.objectIds,
    requiredMm: constraint.minimumMm,
    actualMm,
    satisfied,
  });
  evidence.push(`${first.name} ↔ ${second.name}: требуется минимум ${formatMm(constraint.minimumMm)} мм, фактически ${formatMm(actualMm)} мм.`);
  continue;
}
```

Use a deterministic formatter that does not parse values back from strings:

```ts
function formatMm(value: number): string {
  return Number(value.toFixed(2)).toString();
}
```

Every early return from `evaluatePlanningConstraints()` must include `exactEvidence: []`.

- [ ] **Step 4: Preserve M2-first candidate validity**

Do not alter the existing `evaluatePlanningCandidate()` ranking order. It already computes:

```ts
let valid = fit.planValid && constraintEvaluation.hardValid;
```

and then rejects blocked/room-mismatch selected objects before ranking. Add planner tests proving an exact-gap-valid candidate still loses if M2 reports collision/door/containment invalidity.

- [ ] **Step 5: Run GREEN and deterministic repeatability tests**

```bash
pnpm --filter @vlezet/planning test
pnpm --filter @vlezet/planning typecheck
```

Expected: PASS; same document + same exact constraints returns identical ordered candidate IDs across repeated `planLayoutAlternatives()` calls.

- [ ] **Step 6: Commit evaluation work**

```bash
git add packages/planning/src/exact-spacing.test.ts packages/planning/src/constraints.ts packages/planning/src/planner.test.ts
git commit -m "feat: enforce exact pair spacing in planning"
```

---

### Task 4: Apply-time stale revalidation remains atomic

**Files:**
- Modify: `packages/planning/src/apply.test.ts`
- Modify: `packages/planning/src/constraint-revalidation.test.ts`
- Production file expected unchanged unless a failing test proves a real boundary gap: `packages/planning/src/apply.ts`

**Interfaces:**
- Consumes: existing `applyPlanningCandidateToDocument()` → `evaluatePlanningCandidate()` revalidation chain.
- Produces: explicit regression proof that exact constraints are recomputed against current trusted document state before mutation.

- [ ] **Step 1: Write RED/characterization tests for stale exact spacing**

Add a generated/valid candidate carrying:

```ts
constraints: [{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 }]
```

Then mutate the current document before Apply so the fixed/non-candidate context causes actual edge gap to become `< 800`. Assert:

```ts
const before = JSON.stringify(staleCurrent);
expect(() => applyPlanningCandidateToDocument(staleCurrent, candidate))
  .toThrowError(expect.objectContaining({ code: "candidate-invalid" }));
expect(JSON.stringify(staleCurrent)).toBe(before);
```

Also test direct candidate malformed exact constraints (`NaN`, self-pair, outside-selection reference) fail closed through the same revalidation path.

- [ ] **Step 2: Run planning tests**

```bash
pnpm --filter @vlezet/planning test
```

Expected: ideally PASS immediately because existing Apply delegates to `evaluatePlanningCandidate()`. If it fails, the failure identifies a real revalidation gap; fix only that gap, never duplicate exact-spacing logic in `apply.ts`.

- [ ] **Step 3: Verify one-command history semantics remain unchanged**

Run the existing web/editor store test suite after any planning changes:

```bash
pnpm --filter web test
```

Expected: existing `planning/apply-candidate` one-step Undo/Redo tests PASS.

- [ ] **Step 4: Commit revalidation regressions**

```bash
git add packages/planning/src/apply.test.ts packages/planning/src/constraint-revalidation.test.ts packages/planning/src/apply.ts
git commit -m "test: cover exact spacing apply revalidation"
```

Do not modify `apply.ts` if tests prove the current evaluation delegation is already sufficient.

---

### Task 5: Exact millimetre pair input in the existing planning panel

**Files:**
- Modify: `apps/web/components/planning/planning-panel.tsx`
- Modify: `apps/web/components/planning/planning-panel.test.tsx`

**Interfaces:**
- Consumes: existing `planningPairKey()`, `buildPlanningConstraints()`, `PlanningPairChoice`, M6.2 near/far controls.
- Produces raw UI state `pairMinimumGapInputs: Record<string, string>` and `pair-min-gap` structured constraints.

- [ ] **Step 1: Write RED UI/helper tests**

Extend `buildPlanningConstraints()` tests with a fifth argument:

```ts
const constraints = buildPlanningConstraints(
  ["sofa", "table"],
  [],
  {},
  { [planningPairKey("sofa", "table")]: "near" },
  { [planningPairKey("sofa", "table")]: "800" },
);

expect(constraints).toContainEqual({
  kind: "pair-min-gap",
  objectIds: ["sofa", "table"],
  minimumMm: 800,
});
expect(constraints).toContainEqual({
  kind: "pair-distance",
  objectIds: ["sofa", "table"],
  preference: "near",
});
```

Add exact parsing tests:

```ts
expect(parsePairMinimumGapInput("")).toBeNull();
expect(parsePairMinimumGapInput("0")).toBe(0);
expect(parsePairMinimumGapInput("800")).toBe(800);
expect(parsePairMinimumGapInput("800,5")).toBe(800.5);
expect(() => parsePairMinimumGapInput("-1")).toThrow();
expect(() => parsePairMinimumGapInput("abc")).toThrow();
```

Render tests must assert copy includes:

```text
Минимальный проход между предметами
по ближайшим краям мебели
Требуется минимум
фактически
```

- [ ] **Step 2: Run web tests and verify RED**

```bash
pnpm --filter web test
```

Expected: FAIL because exact gap state/input/helper does not exist.

- [ ] **Step 3: Add parser and extend constraint builder**

Implement:

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

Extend `buildPlanningConstraints(..., pairMinimumGapInputs)` so each selected unordered pair may emit both `pair-distance` and `pair-min-gap`. Empty input emits no exact constraint; string `"0"` emits a real zero constraint.

- [ ] **Step 4: Extend pair view model and component state**

Add to `PlanningPairChoice`:

```ts
minimumGapInput: string;
minimumGapError: string | null;
```

Add state:

```ts
const [pairMinimumGapInputs, setPairMinimumGapInputs] = useState<Record<string, string>>({});
```

When selection changes, clean both `pairPreferences` and `pairMinimumGapInputs` to pairs whose two IDs remain selected. Any exact input change must call `clearGeneratedState()` immediately.

- [ ] **Step 5: Add compact exact-gap controls to each pair**

Keep M6.2 near/far select and add a separate numeric/text input that preserves raw user text:

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

Helper copy must distinguish semantics:

```text
«Ближе/дальше» ранжируется по центрам предметов. Минимальный проход — жёсткое требование по ближайшим краям мебели с учётом поворота.
```

- [ ] **Step 6: Block generation on invalid raw numeric input**

Derive pair errors via `parsePairMinimumGapInput()`. `canGenerate` must additionally require no pair input errors. `generate()` must build the exact constraints from the same parser so UI gating and request construction cannot disagree.

- [ ] **Step 7: Run web GREEN and typecheck**

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit UI work**

```bash
git add apps/web/components/planning/planning-panel.tsx apps/web/components/planning/planning-panel.test.tsx
git commit -m "feat: add exact pair spacing controls"
```

---

### Task 6: Full regression gate, acceptance record and Draft PR

**Files:**
- Create: `docs/milestones/m6-3-acceptance.md`
- No canonical `PROJECT_STATE.md` / `ROADMAP.md` / `CHANGELOG.md` DONE update until browser acceptance and merge.

**Interfaces:**
- Consumes all previous tasks.
- Produces an implementation-complete Draft PR that remains unmerged until real-browser acceptance.

- [ ] **Step 1: Run the complete local-equivalent verification suite**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all PASS.

- [ ] **Step 2: Self-review architecture boundaries**

Verify changed files show:

```text
no VlezetDocument schema/migration changes
no IndexedDB/autosave planning persistence
no Three.js/Canvas measurement authority
no duplicate M2 collision engine
pair-min-gap hard-valid before soft ranking
exact geometry primitive framework-independent
candidate identity includes normalized minimumMm
preview path still non-mutating
Apply still one semantic history operation
```

- [ ] **Step 3: Write acceptance checklist**

`docs/milestones/m6-3-acceptance.md` must record automated contracts and require this real-browser scenario:

```text
1. Baseline M6.1/M6.2 generation still works with empty exact inputs.
2. Select two movable objects; enter feasible minimum, e.g. 800 mm.
3. Generate: result explanation shows required and actual edge-to-edge mm.
4. Preview visibly respects the required nearest-edge gap.
5. Combine "Ближе друг к другу" + 800 mm; best valid options approach but never violate the hard minimum.
6. Change 800 → another value; stale result/preview clears immediately.
7. Enter impossible/high value; no violating alternative is offered.
8. Enter invalid/negative text; generation is blocked with explicit validation.
9. Apply valid candidate; 3D projects ordinary document positions normally.
10. One Undo restores all transforms; one Redo reapplies them.
11. Reload: only applied ordinary transforms persist, not exact constraints.
12. Manual furniture editing, M2 fit and M5 spatial/inspection still work.
```

- [ ] **Step 4: Open/update Draft PR and require exact-head CI**

PR body must include exact design/plan/checklist paths, the final head SHA and GitHub Actions run ID after completion. Keep it Draft until browser acceptance.

- [ ] **Step 5: Do not merge before browser acceptance**

Only after explicit product-owner confirmation:

```text
mark PR Ready
→ verify exact head has strict CI PASS
→ squash merge
→ update docs/milestones/m6-3-acceptance.md with accepted head/run/merge
→ update PROJECT_STATE.md / ROADMAP.md / CHANGELOG.md in a separate canonical docs PR
```
