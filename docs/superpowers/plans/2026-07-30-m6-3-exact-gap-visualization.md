# M6.3 Exact Gap Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an M6.3 exact furniture gap visually unmistakable by drawing the authoritative shortest contour-to-contour witness on the 2D Preview and presenting structured `Фактически / Требуется` evidence in the planning panel.

**Architecture:** Extend the existing framework-independent geometry distance primitive so it returns deterministic closest-point witnesses, while keeping the current numeric API as a delegate. Promote existing structured exact evidence through candidate evaluation, then derive an ephemeral web annotation from the preview document and active pair. Render one non-interactive violet overlay in the existing Konva object layer and one structured evidence card in the planning panel; do not change `VlezetDocument`, persistence, history, M2 fit authority or Apply semantics.

**Tech Stack:** TypeScript 6, Vitest 4, React 19, Zustand 5, Konva/react-konva 10/19, existing `@vlezet/geometry` and `@vlezet/planning` packages, pnpm/Turborepo, GitHub Actions.

## Global Constraints

- Millimetres remain canonical; screen pixels are presentation-only and are never persisted.
- `VlezetDocument` remains the only persistent apartment/layout source of truth.
- The existing M2 `evaluateObjectFits()` remains authoritative for containment, collisions, door swing and clearances.
- The geometry witness and numeric distance must share one implementation; no second closest-distance algorithm is allowed in web code.
- The exact overlay is visible only for an active `pair-min-gap` in an active planning Preview.
- Only one exact pair is visualized at a time.
- The exact overlay is 2D-only, non-interactive, and must not mutate document/history/autosave/IndexedDB.
- Exact evidence is structured; generic reason strings must not duplicate `required / actual` exact evidence.
- Empty exact input still means no exact rule; `0` remains a real valid exact constraint.
- Apply still revalidates against the current document and remains one semantic `planning/apply-candidate` Undo/Redo operation.
- The existing right-inspector viewport fix (`minmax(0, 1fr)` root column and responsive toolbar copy) must remain intact.
- PR #15 remains Draft until exact-head CI and representative browser acceptance pass.

---

## File Structure

### Geometry authority

- Modify `packages/geometry/src/oriented-rectangle-distance.ts` — own deterministic closest-point witness calculation and retain the numeric delegate.
- Modify `packages/geometry/src/oriented-rectangle-distance.test.ts` — lock separated, rotated, touching, overlap, symmetry and deterministic tie-breaking semantics.
- Modify `packages/geometry/src/index.ts` — export the witness type/function.

### Planning evidence

- Modify `packages/planning/src/evaluation.ts` — expose `exactEvidence` on `PlanningCandidateEvaluation`.
- Modify `packages/planning/src/exact-spacing.test.ts` — prove structured evidence promotion and absence of duplicated exact reason strings.
- Modify `packages/planning/src/constraints.ts` — stop copying exact evidence into generic string evidence while preserving hard validation.

### Ephemeral web model/state

- Create `apps/web/components/planning/planning-pair-key.ts` — own normalized pair keys shared by panel, store and annotation code.
- Create `apps/web/components/planning/exact-gap-annotation.ts` — pure preview-document-to-annotation view-model; no React/Konva.
- Create `apps/web/components/planning/exact-gap-annotation.test.ts` — prove preview transforms, required/actual state, zero gap, stale state, null/error states and non-mutation.
- Modify `apps/web/components/planning/planning-ui-store.ts` — add active exact pair state and deterministic Preview transitions.
- Modify `apps/web/components/planning/planning-ui-store.test.ts` — prove automatic first-pair selection, pair switching and clearing.

### Presentation

- Create `apps/web/components/editor/exact-gap-overlay.tsx` — draw a double-ended dashed witness, endpoint markers and clamped pill in screen space.
- Create `apps/web/components/editor/exact-gap-overlay.test.ts` — test pure layout/clamping/zero-length behavior and non-interactive source contract.
- Modify `apps/web/components/editor/editor-canvas.tsx` — derive and render the active annotation inside the existing object layer without adding a sixth Konva layer.
- Modify `apps/web/components/editor/editor-canvas-layers.test.ts` — retain the five-layer budget and assert exact overlay integration.
- Modify `apps/web/components/planning/planning-panel.tsx` — improve input copy, render structured exact cards and support `Показать на плане`.
- Modify `apps/web/components/planning/planning-panel.test.tsx` — test copy, cards, active state and no duplicate exact reason.
- Modify `apps/web/app/globals.css` — add compact evidence-card styles only.

### Acceptance record

- Modify `docs/milestones/m6-3-acceptance.md` — append the UX refinement and updated browser checklist only after implementation gates pass; do not mark final browser acceptance before the user verifies it.

---

### Task 1: Deterministic Oriented-Rectangle Gap Witness

**Files:**
- Modify: `packages/geometry/src/oriented-rectangle-distance.test.ts`
- Modify: `packages/geometry/src/oriented-rectangle-distance.ts`
- Modify: `packages/geometry/src/index.ts`

**Interfaces:**
- Consumes: `OrientedRectangle`, `Point2`, `orientedRectangleEdges()`, `orientedRectanglesIntersect()`, `projectPointToSegment()`, `segmentIntersection()`, `GEOMETRY_EPSILON_MM`.
- Produces:

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

- Preserves:

```ts
export function minimumDistanceBetweenOrientedRectangles(
  first: OrientedRectangle,
  second: OrientedRectangle,
): number;
```

- [ ] **Step 1: Add failing witness tests**

Extend `oriented-rectangle-distance.test.ts` with imports and assertions equivalent to:

```ts
import {
  minimumDistanceBetweenOrientedRectangles,
  minimumGapWitnessBetweenOrientedRectangles,
} from "./oriented-rectangle-distance";

it("returns exact closest points for an axis-aligned separated gap", () => {
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

it("returns real-contour witness points for rotated rectangles", () => {
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

it("returns a deterministic coincident witness for touching contours", () => {
  const witness = minimumGapWitnessBetweenOrientedRectangles(
    rect(0, 0, 1000, 1000),
    rect(1000, 0, 1000, 1000),
  );
  expect(witness).toEqual({
    distanceMm: 0,
    firstPoint: { x: 500, y: -500 },
    secondPoint: { x: 500, y: -500 },
    relation: "touching",
  });
});

it("returns overlap without inventing a unique witness segment", () => {
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

The deterministic tie-break is lexicographic by `firstPoint.x`, `firstPoint.y`, `secondPoint.x`, `secondPoint.y` after distance.

- [ ] **Step 2: Run the focused geometry test and confirm RED**

Run:

```bash
pnpm --filter @vlezet/geometry test -- src/oriented-rectangle-distance.test.ts
```

Expected: FAIL because `minimumGapWitnessBetweenOrientedRectangles` and `OrientedRectangleGapWitness` do not exist.

- [ ] **Step 3: Implement the minimal witness algorithm**

Replace the private numeric-only candidate logic with a candidate pair type:

```ts
type GapCandidate = Readonly<{
  distanceMm: number;
  firstPoint: Point2;
  secondPoint: Point2;
}>;
```

For every ordered first/second edge pair:

1. collect a non-parallel `segmentIntersection()` point as `{ point, point, 0 }`;
2. project each first endpoint to the second edge;
3. project each second endpoint to the first edge;
4. normalize distances `<= GEOMETRY_EPSILON_MM` to `0` and coincident points to the same deterministic point;
5. sort all candidates by distance and then the fixed lexicographic point key.

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

Collinear touching edges are resolved by endpoint projections at zero distance; the lexicographic tie-break supplies one deterministic contact point.

- [ ] **Step 4: Export the witness API**

Update `packages/geometry/src/index.ts`:

```ts
export {
  minimumDistanceBetweenOrientedRectangles,
  minimumGapWitnessBetweenOrientedRectangles,
} from "./oriented-rectangle-distance";
export type { OrientedRectangleGapWitness } from "./oriented-rectangle-distance";
```

- [ ] **Step 5: Run geometry tests and package checks**

Run:

```bash
pnpm --filter @vlezet/geometry test
pnpm --filter @vlezet/geometry typecheck
```

Expected: PASS, including all existing numeric-distance tests.

- [ ] **Step 6: Commit the geometry authority**

```bash
git add packages/geometry/src/oriented-rectangle-distance.ts packages/geometry/src/oriented-rectangle-distance.test.ts packages/geometry/src/index.ts
git commit -m "feat: expose exact furniture gap witnesses"
```

---

### Task 2: Promote Structured Exact Evidence Through Candidate Evaluation

**Files:**
- Modify: `packages/planning/src/evaluation.ts`
- Modify: `packages/planning/src/constraints.ts`
- Modify: `packages/planning/src/exact-spacing.test.ts`

**Interfaces:**
- Consumes: existing `PairMinimumGapConstraintEvidence`, `evaluatePlanningConstraints()`.
- Produces:

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

- [ ] **Step 1: Add failing planning evidence tests**

Extend `exact-spacing.test.ts`:

```ts
import { evaluatePlanningCandidate } from "./evaluation";

it("promotes structured exact evidence without duplicating it in generic reasons", () => {
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

Update existing assertions that currently expect exact `required/factual` text in `constraintEvaluation.evidence`: assert the same values from `exactEvidence` instead.

- [ ] **Step 2: Run the focused planning test and confirm RED**

Run:

```bash
pnpm --filter @vlezet/planning test -- src/exact-spacing.test.ts
```

Expected: FAIL because `PlanningCandidateEvaluation` has no `exactEvidence`, and exact text is still included in generic evidence.

- [ ] **Step 3: Remove untyped exact-string duplication**

In the `pair-min-gap` branch of `evaluatePlanningConstraints()`:

- keep `hardValid` calculation;
- keep `exactEvidence.push(...)`;
- remove the generic `evidence.push("...требуется минимум...")` call.

Do not change epsilon, hard validity, ranking penalty or stable identity.

- [ ] **Step 4: Promote exact evidence from constraint evaluation**

In `evaluation.ts`:

```ts
import {
  evaluatePlanningConstraints,
  planningConstraintSetKey,
  type PairMinimumGapConstraintEvidence,
} from "./constraints";
```

Add `exactEvidence` to every return path:

```ts
exactEvidence: constraintEvaluation.exactEvidence,
```

Invalid placement data before constraint evaluation returns `exactEvidence: []`.

- [ ] **Step 5: Run planning package tests and typecheck**

Run:

```bash
pnpm --filter @vlezet/planning test
pnpm --filter @vlezet/planning typecheck
```

Expected: PASS; exact hard validation/ranking is unchanged, and generic reasons no longer duplicate structured exact evidence.

- [ ] **Step 6: Commit structured evidence promotion**

```bash
git add packages/planning/src/evaluation.ts packages/planning/src/constraints.ts packages/planning/src/exact-spacing.test.ts
git commit -m "feat: expose structured exact gap evidence"
```

---

### Task 3: Add Shared Pair Keys, Ephemeral Active Pair State and Annotation View-Model

**Files:**
- Create: `apps/web/components/planning/planning-pair-key.ts`
- Create: `apps/web/components/planning/exact-gap-annotation.ts`
- Create: `apps/web/components/planning/exact-gap-annotation.test.ts`
- Modify: `apps/web/components/planning/planning-ui-store.ts`
- Modify: `apps/web/components/planning/planning-ui-store.test.ts`
- Modify: `apps/web/components/planning/planning-panel.tsx`
- Modify: `apps/web/components/planning/planning-panel.test.tsx`

**Interfaces:**
- Produces:

```ts
export function planningPairKey(firstObjectId: string, secondObjectId: string): string;
export function planningPairIds(key: string): readonly [string, string] | null;

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

- Extends store state:

```ts
activeExactPairKey: string | null;
setActiveExactPairKey: (pairKey: string | null) => void;
```

- [ ] **Step 1: Extract pair-key tests and add active-state RED tests**

Move the current `planningPairKey()` implementation out of `planning-panel.tsx` into `planning-pair-key.ts` and preserve its export through the panel during migration if existing callers require it.

Extend `planning-ui-store.test.ts` with candidates containing normalized exact constraints:

```ts
const exactCandidate: PlanningCandidate = {
  ...candidate,
  placements: [
    { objectId: "sofa", position: { x: 1000, y: 2000 }, rotationDeg: 90 },
    { objectId: "table", position: { x: 2800, y: 2000 }, rotationDeg: 0 },
    { objectId: "chair", position: { x: 3900, y: 2400 }, rotationDeg: 0 },
  ],
  constraints: [
    { kind: "pair-min-gap", objectIds: ["chair", "table"], minimumMm: 600 },
    { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
  ],
};

it("selects the first deterministic exact pair when Preview starts", () => {
  const store = createPlanningUiStore();
  store.getState().openForRoom("room-1");
  store.getState().setPreviewCandidate(exactCandidate);
  expect(store.getState().activeExactPairKey).toBe("chair|table");
});

it("switches only ephemeral active-pair state and clears it with Preview", () => {
  const store = createPlanningUiStore();
  store.getState().setPreviewCandidate(exactCandidate);
  store.getState().setActiveExactPairKey("sofa|table");
  expect(store.getState().activeExactPairKey).toBe("sofa|table");
  store.getState().setPreviewCandidate(null);
  expect(store.getState()).toMatchObject({ previewCandidate: null, activeExactPairKey: null });
});
```

- [ ] **Step 2: Add failing pure annotation tests**

Create `exact-gap-annotation.test.ts` with a small document fixture and tests:

```ts
it("derives required and actual gap from preview transforms", () => {
  const annotation = deriveExactGapAnnotation(previewDocument, candidate, "sofa|table");
  expect(annotation).toMatchObject({
    pairKey: "sofa|table",
    actualMm: 842,
    requiredMm: 800,
    satisfied: true,
    zeroLength: false,
    label: "↔ Зазор 842 мм",
  });
});

it("returns stale unsatisfied state from the current preview document", () => {
  const stale = moveObject(previewDocument, "table", { x: 2200, y: 2000 });
  expect(deriveExactGapAnnotation(stale, candidate, "sofa|table"))
    .toMatchObject({ requiredMm: 800, satisfied: false });
});

it("returns zero-length contact semantics", () => {
  expect(deriveExactGapAnnotation(touchingDocument, touchingCandidate, "sofa|table"))
    .toMatchObject({ actualMm: 0, zeroLength: true, label: "↔ Зазор 0 мм" });
});

it("returns null without Preview, exact constraint, active pair, objects or unique overlap witness", () => {
  expect(deriveExactGapAnnotation(document, null, "sofa|table")).toBeNull();
  expect(deriveExactGapAnnotation(document, candidateWithoutExact, "sofa|table")).toBeNull();
  expect(deriveExactGapAnnotation(document, candidate, null)).toBeNull();
  expect(deriveExactGapAnnotation(overlappingDocument, overlappingCandidate, "sofa|table")).toBeNull();
});
```

Also snapshot `JSON.stringify(document)` and `JSON.stringify(candidate)` before calls and assert they are unchanged.

- [ ] **Step 3: Run focused web tests and confirm RED**

Run:

```bash
pnpm --filter web test -- components/planning/planning-ui-store.test.ts components/planning/exact-gap-annotation.test.ts
```

Expected: FAIL because active pair state, shared pair helpers and annotation view-model do not exist.

- [ ] **Step 4: Implement shared pair helpers**

Create `planning-pair-key.ts`:

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

Update `planning-panel.tsx` and its tests to import this helper instead of owning duplicate logic.

- [ ] **Step 5: Implement deterministic active-pair store transitions**

Add a pure helper inside `planning-ui-store.ts`:

```ts
function firstExactPairKey(candidate: PlanningCandidate | null): string | null {
  const keys = (candidate?.constraints ?? [])
    .filter((constraint) => constraint.kind === "pair-min-gap")
    .map((constraint) => planningPairKey(constraint.objectIds[0], constraint.objectIds[1]))
    .sort((first, second) => first.localeCompare(second));
  return keys[0] ?? null;
}
```

`setPreviewCandidate(candidate)` sets both `previewCandidate` and `activeExactPairKey: firstExactPairKey(candidate)`. `openForRoom()`, `close()` and Preview clear set active pair to `null`. Pair switching must not touch room or Preview.

- [ ] **Step 6: Implement the pure annotation view-model**

Create `exact-gap-annotation.ts`:

```ts
const EXACT_SPATIAL_EPSILON_MM = 1e-6;

export function deriveExactGapAnnotation(
  previewDocument: VlezetDocument,
  candidate: PlanningCandidate | null,
  activePairKey: string | null,
): ExactGapAnnotation | null {
  const ids = activePairKey ? planningPairIds(activePairKey) : null;
  if (!candidate || !ids) return null;

  const constraint = (candidate.constraints ?? []).find((item) =>
    item.kind === "pair-min-gap" &&
    planningPairKey(item.objectIds[0], item.objectIds[1]) === activePairKey,
  );
  if (!constraint || constraint.kind !== "pair-min-gap") return null;

  const first = previewDocument.placedObjects.find((object) => object.id === ids[0]);
  const second = previewDocument.placedObjects.find((object) => object.id === ids[1]);
  if (!first || !second) return null;

  const witness = minimumGapWitnessBetweenOrientedRectangles(
    objectRectangle(first),
    objectRectangle(second),
  );
  if (!witness.firstPoint || !witness.secondPoint || witness.relation === "overlapping") return null;

  const actualMm = witness.distanceMm;
  return {
    pairKey: activePairKey,
    firstPoint: witness.firstPoint,
    secondPoint: witness.secondPoint,
    actualMm,
    requiredMm: constraint.minimumMm,
    satisfied: actualMm + EXACT_SPATIAL_EPSILON_MM >= constraint.minimumMm,
    zeroLength: actualMm <= EXACT_SPATIAL_EPSILON_MM,
    label: `↔ Зазор ${Number(actualMm.toFixed(2))} мм`,
  };
}
```

Do not read persisted transforms when preview transforms are available; the caller passes the already-derived preview document.

- [ ] **Step 7: Run web model/store tests and typecheck**

Run:

```bash
pnpm --filter web test -- components/planning/planning-ui-store.test.ts components/planning/exact-gap-annotation.test.ts components/planning/planning-panel.test.tsx
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit ephemeral model/state**

```bash
git add apps/web/components/planning/planning-pair-key.ts apps/web/components/planning/exact-gap-annotation.ts apps/web/components/planning/exact-gap-annotation.test.ts apps/web/components/planning/planning-ui-store.ts apps/web/components/planning/planning-ui-store.test.ts apps/web/components/planning/planning-panel.tsx apps/web/components/planning/planning-panel.test.tsx
git commit -m "feat: model active exact gap annotations"
```

---

### Task 4: Render Structured Exact Evidence Cards in the Planning Panel

**Files:**
- Modify: `apps/web/components/planning/planning-panel.tsx`
- Modify: `apps/web/components/planning/planning-panel.test.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `candidate.evaluation.exactEvidence`, `activeExactPairKey`, `planningPairKey()`.
- Extends `PlanningPanelViewProps`:

```ts
activeExactPairKey: string | null;
onShowExactPair: (candidate: RankedPlanningCandidate, pairKey: string) => void;
```

- [ ] **Step 1: Write failing panel copy and evidence-card tests**

Update the `ranked.evaluation` fixture to include:

```ts
exactEvidence: [{
  kind: "pair-min-gap",
  objectIds: ["sofa", "table"],
  requiredMm: 800,
  actualMm: 842,
  satisfied: true,
}],
```

Remove the exact sentence from `reasons`.

Assert:

```ts
expect(html).toContain("↔ Минимальный зазор по контурам");
expect(html).toContain("Это не размер предмета и не расстояние между центрами");
expect(html).toContain("Точное расстояние");
expect(html).toContain("Фактически");
expect(html).toContain("842 мм");
expect(html).toContain("Требуется");
expect(html).toContain("≥ 800 мм");
expect(html).toContain("По ближайшим точкам повёрнутых контуров");
expect(html).toContain("Показывается на плане");
expect(html).not.toContain("требуется минимум 800 мм, фактически 842 мм");
```

Add a second exact evidence pair and assert its button says `Показать на плане` while the active pair says `Показывается на плане`.

- [ ] **Step 2: Run the focused panel test and confirm RED**

Run:

```bash
pnpm --filter web test -- components/planning/planning-panel.test.tsx
```

Expected: FAIL because the panel still renders exact evidence as generic reasons and has no active-pair action.

- [ ] **Step 3: Improve exact input copy**

Replace:

```text
Минимальный проход между предметами
```

with:

```text
↔ Минимальный зазор по контурам
```

Use helper text exactly:

```text
Кратчайшее расстояние между внешними контурами предметов с учётом поворота. Это не размер предмета и не расстояние между центрами.
```

Keep the qualitative centre-distance explanation separate.

- [ ] **Step 4: Render one structured card per exact evidence entry**

For each `candidate.evaluation.exactEvidence`:

1. resolve names from `objects` by ID, falling back to IDs;
2. compute `pairKey`;
3. render semantic heading `↔ Точное расстояние`;
4. render pair names;
5. render `Фактически: N мм`;
6. render `Требуется: ≥ N мм`;
7. render `По ближайшим точкам повёрнутых контуров`;
8. render a button that calls `onShowExactPair(candidate, pairKey)`.

Use `Number(value.toFixed(2))` for deterministic compact millimetre copy.

- [ ] **Step 5: Wire active-pair behavior in the stateful panel**

Read:

```ts
const activeExactPairKey = useStore(planningUiStore, (state) => state.activeExactPairKey);
```

Implement:

```ts
const showExactPair = (candidate: RankedPlanningCandidate, pairKey: string) => {
  planningUiStore.getState().setPreviewCandidate(candidate.candidate);
  planningUiStore.getState().setActiveExactPairKey(pairKey);
};
```

Existing Preview button continues to call `setPreviewCandidate()` and therefore automatically selects the deterministic first exact pair.

Every existing input-change path that clears Preview automatically clears the active pair through `setPreviewCandidate(null)`.

- [ ] **Step 6: Add compact card styles**

Append focused classes to `globals.css`:

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

Use existing `.secondary-action` for the show action; do not introduce a new button system.

- [ ] **Step 7: Run panel tests and web typecheck**

Run:

```bash
pnpm --filter web test -- components/planning/planning-panel.test.tsx
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit the planning-panel UX**

```bash
git add apps/web/components/planning/planning-panel.tsx apps/web/components/planning/planning-panel.test.tsx apps/web/app/globals.css
git commit -m "feat: explain exact gaps in planning results"
```

---

### Task 5: Draw the Contextual Exact Gap Overlay on the 2D Canvas

**Files:**
- Create: `apps/web/components/editor/exact-gap-overlay.tsx`
- Create: `apps/web/components/editor/exact-gap-overlay.test.ts`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/editor-canvas-layers.test.ts`

**Interfaces:**
- Consumes: `ExactGapAnnotation`, `ViewportTransform`, stage width/height, `worldToScreen()`.
- Produces:

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

export function ExactGapOverlay(props: Readonly<{
  annotation: ExactGapAnnotation;
  viewport: ViewportTransform;
  stageSize: Readonly<{ width: number; height: number }>;
}>): ReactElement;
```

- [ ] **Step 1: Add failing overlay layout and source-contract tests**

Create `exact-gap-overlay.test.ts`:

```ts
it("converts world witness points to screen points and centres the label", () => {
  const layout = deriveExactGapOverlayLayout(annotation, viewport, { width: 900, height: 700 });
  expect(layout.first).toEqual(worldToScreen(annotation.firstPoint, viewport));
  expect(layout.second).toEqual(worldToScreen(annotation.secondPoint, viewport));
  expect(layout.zeroLength).toBe(false);
});

it("clamps the pill inside the visible stage", () => {
  const layout = deriveExactGapOverlayLayout(edgeAnnotation, viewport, { width: 320, height: 240 });
  expect(layout.label.x).toBeGreaterThanOrEqual(8);
  expect(layout.label.x + layout.labelWidth).toBeLessThanOrEqual(312);
  expect(layout.label.y).toBeGreaterThanOrEqual(8);
  expect(layout.label.y).toBeLessThanOrEqual(210);
});

it("offsets a zero-length contact label from the marker", () => {
  const layout = deriveExactGapOverlayLayout(contactAnnotation, viewport, { width: 900, height: 700 });
  expect(layout.zeroLength).toBe(true);
  expect(layout.label.y).not.toBe(layout.first.y);
});

it("keeps the overlay non-interactive and visually distinct", () => {
  const source = readFileSync(new URL("./exact-gap-overlay.tsx", import.meta.url), "utf8");
  expect(source).toContain("listening={false}");
  expect(source).toContain("dash={[7, 5]}");
  expect(source).toContain("#7c3aed");
  expect(source).toContain("pointerAtBeginning");
  expect(source).toContain("pointerAtEnding");
});
```

- [ ] **Step 2: Run the focused overlay test and confirm RED**

Run:

```bash
pnpm --filter web test -- components/editor/exact-gap-overlay.test.ts
```

Expected: FAIL because the overlay component/layout do not exist.

- [ ] **Step 3: Implement pure screen-space layout**

Use `worldToScreen()` for endpoints. Compute label width as:

```ts
const labelWidth = Math.max(92, annotation.label.length * 6.6 + 20);
```

For a non-zero segment, use the midpoint plus a perpendicular 14px offset. For zero length, use `{ x: first.x + 16, y: first.y - 28 }`. Clamp label `x` to `[8, stage.width - labelWidth - 8]` and `y` to `[8, stage.height - 30]`.

- [ ] **Step 4: Implement the non-interactive Konva overlay**

Use one `Group listening={false}`.

Separated/touching non-zero witness:

```tsx
<Arrow
  points={[first.x, first.y, second.x, second.y]}
  stroke={satisfied ? "#7c3aed" : "#dc2626"}
  fill={satisfied ? "#7c3aed" : "#dc2626"}
  strokeWidth={1.5}
  dash={[7, 5]}
  pointerLength={6}
  pointerWidth={6}
  pointerAtBeginning
  pointerAtEnding
  listening={false}
/>
```

Add two 3px endpoint circles. For zero length, render one 5px contact marker with an outer ring and no Arrow.

Render a white pill with a violet/danger border and the exact label. Keep all stroke/text sizes constant screen-space values.

- [ ] **Step 5: Integrate into the existing canvas layer**

In `editor-canvas.tsx`:

```ts
const activeExactPairKey = useStore(planningUiStore, (state) => state.activeExactPairKey);
const exactGapAnnotation = useMemo(
  () => deriveExactGapAnnotation(planningPreviewDocument, planningPreviewCandidate, activeExactPairKey),
  [activeExactPairKey, planningPreviewCandidate, planningPreviewDocument],
);
```

Render `<ExactGapOverlay ... />` after planning ghost objects inside the existing object `<Layer>`. Do not add a new physical `<Layer>`.

- [ ] **Step 6: Extend the canvas-layer regression**

Keep:

```ts
expect(physicalLayers).toBeLessThanOrEqual(5);
```

Add source assertions that `EditorCanvas` imports/renders `ExactGapOverlay` and reads `activeExactPairKey`.

- [ ] **Step 7: Run canvas tests, full web tests and typecheck**

Run:

```bash
pnpm --filter web test -- components/editor/exact-gap-overlay.test.ts components/editor/editor-canvas-layers.test.ts
pnpm --filter web test
pnpm --filter web typecheck
```

Expected: PASS; the layer count remains at or below five.

- [ ] **Step 8: Commit canvas visualization**

```bash
git add apps/web/components/editor/exact-gap-overlay.tsx apps/web/components/editor/exact-gap-overlay.test.ts apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/editor-canvas-layers.test.ts
git commit -m "feat: visualize exact furniture gaps on canvas"
```

---

### Task 6: Full Verification, Acceptance Record and Draft PR Refresh

**Files:**
- Modify: `docs/milestones/m6-3-acceptance.md`
- Verify: `.github/workflows/ci.yml`
- Verify: `apps/web/app/editor-viewport.css`
- Verify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: all completed tasks.
- Produces: exact-head CI evidence and an updated browser checklist while keeping final acceptance pending.

- [ ] **Step 1: Run the complete local-equivalent gate**

Run:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits `0`.

- [ ] **Step 2: Review architectural boundaries in the final diff**

Verify explicitly:

```text
no VlezetDocument/schema/migration changes
no project persistence/autosave/IndexedDB planning state
no second numeric distance implementation in web
minimumDistanceBetweenOrientedRectangles delegates to witness
exact overlay appears only for Preview + active exact pair
only one overlay is rendered
no sixth Konva Layer
exact evidence is structured and not duplicated in generic reasons
Apply and one-step Undo/Redo code paths are unchanged
editor viewport CSS fix remains imported after globals.css
```

- [ ] **Step 3: Update the M6.3 acceptance record without claiming browser PASS**

Append:

```markdown
## Exact-gap visualization refinement

- [x] authoritative closest-point geometry witness
- [x] numeric exact validation delegates to the same witness calculation
- [x] structured exact evidence promoted through candidate evaluation
- [x] contextual one-pair 2D overlay with `↔ Зазор N мм`
- [x] structured `Фактически / Требуется / по контурам` result card
- [x] active exact pair remains ephemeral and clears with Preview/input/close
- [x] inspector viewport regression remains covered
- [ ] representative browser acceptance confirms clarity at the reported viewport/scale
```

Record exact commit/run IDs only after GitHub Actions completes.

- [ ] **Step 4: Commit acceptance documentation**

```bash
git add docs/milestones/m6-3-acceptance.md
git commit -m "docs: add M6.3 exact gap visualization gate"
```

- [ ] **Step 5: Verify exact feature head in GitHub Actions**

Wait for the PR-head workflow and verify on the exact commit:

```text
Install dependencies — PASS
Unit tests — PASS
Typecheck — PASS
Lint — PASS
Build — PASS
```

Do not treat an older run as evidence for a newer documentation or code head.

- [ ] **Step 6: Refresh Draft PR #15**

Update the PR body with:

```text
- exact closest-point witness geometry;
- structured exact evidence cards;
- contextual violet `↔ Зазор N мм` Preview overlay;
- one active exact pair at a time;
- inspector overflow regression fixed and retained;
- final exact head and GitHub Actions run;
- browser acceptance still pending.
```

Keep the PR Draft.

- [ ] **Step 7: Representative browser acceptance**

At the same viewport and browser scale used in the reported screenshot:

```text
1. Select furniture and confirm the full right inspector remains visible.
2. Open planning for two objects with an exact minimum.
3. Preview a candidate and confirm one violet dashed double-arrow connects the visually nearest contour points.
4. Confirm the pill says `↔ Зазор N мм`, not only `N мм`.
5. Rotate an object and verify endpoints move to the new nearest real contour points.
6. Confirm the result card separately shows `Фактически`, `Требуется` and contour semantics.
7. Confirm ordinary blue width/depth dimensions remain visually distinct.
8. With multiple exact pairs, switch `Показать на плане`; only one overlay remains visible.
9. Change the exact input and confirm result, Preview and overlay clear together.
10. Confirm Preview adds no Undo step and no save/persistence operation.
11. Apply a candidate; confirm 2D→3D, one-step Undo/Redo and reload behavior remain unchanged.
```

- [ ] **Step 8: Merge only after user acceptance**

After the user explicitly confirms the browser checklist:

```text
mark PR #15 Ready for Review
verify exact head and CI again
squash merge PR #15
open a separate canonical docs PR
update PROJECT_STATE.md / ROADMAP.md / CHANGELOG.md / m6-3-acceptance.md with final merge SHA and acceptance wording
verify docs PR exact-head CI
squash merge docs PR
```
