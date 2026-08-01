# M7.7 Furniture and Fit Workflow — Plan Self-Review Amendments

**Status:** normative amendments to `2026-08-01-m7-7-furniture-fit-workflow.md`  
**Date:** 2026-08-01  
**Plan head before review:** `b1d14e19fd1b6b9918bfa342c41111885363ce4a`

These amendments resolve issues found during the required writing-plans self-review. They have priority over the corresponding steps in the primary plan. All other tasks and constraints remain unchanged.

## 1. Add Task 0: open the Draft PR before product implementation

Task 9 Step 1 moves to the beginning of execution, immediately after the plan is accepted and before Task 1 product code.

### Task 0: Establish the delivery shell

**Files:** no product files.

- [ ] Verify branch `feat/m7-7-furniture-fit-workflow` is based on canonical `main` commit `259182852157d7552b37c8a10a3bcebcb31e086c` and contains only the approved design/plan documents.
- [ ] Open a Draft PR to `main` titled `feat: M7.7 furniture and fit workflow`.
- [ ] Put the actual PR number returned by GitHub into all later acceptance records. Do not use symbolic angle-bracket values in committed documents.
- [ ] The initial body must link the two design documents and two plan documents, list `UX-FURN-001/002/003` and remaining `UX-FURN-004`, repeat authority boundaries, and state `Product implementation and automated acceptance are in progress; product-owner browser acceptance is pending.`
- [ ] Keep the PR Draft throughout implementation and automated hardening.

Task 9 no longer opens a PR; it updates the existing Draft PR.

## 2. Exact-angle orientation replaces nearest-cardinal approximation

The primary plan's Task 4 sentence `define deterministic nearest-cardinal presentation for arbitrary angles` is removed. Nearest-cardinal snapping would misrepresent objects at angles such as 30° or 45°.

Task 4 interfaces become:

```ts
export type FurnitureLocalSide = "front" | "right" | "back" | "left";
export type ScreenSide = "top" | "right" | "bottom" | "left";
export type UnitScreenVector = Readonly<{ x: number; y: number }>;

export function furnitureLocalSideScreenVector(
  side: FurnitureLocalSide,
  rotationDeg: number,
): UnitScreenVector;

export function classifyCardinalScreenSide(
  vector: UnitScreenVector,
): ScreenSide;
```

The vector uses the same presentation convention as the existing Canvas:

- at `0°`, front points toward screen bottom: `{ x: 0, y: 1 }`;
- at `90°`, front points toward screen left: `{ x: -1, y: 0 }`;
- at `180°`, front points toward screen top: `{ x: 0, y: -1 }`;
- at `270°`, front points toward screen right: `{ x: 1, y: 0 }`.

Implementation uses exact trigonometric rotation for every finite angle. `classifyCardinalScreenSide()` is used only for readable cardinal descriptions/tests; it does not snap the cue geometry.

Required additional test:

```ts
const vector = furnitureLocalSideScreenVector("front", 45);
expect(vector.x).toBeCloseTo(-Math.SQRT1_2, 6);
expect(vector.y).toBeCloseTo(Math.SQRT1_2, 6);
```

`FurnitureOrientationCue` rotates its rectangle/front marker by the exact draft angle. Semantic side rows remain normal-flow text and controls; no focusable element is placed inside a transformed layer.

## 3. Exact contour-gap copy is owned by the existing planning annotation

Task 6 must also include:

- Modify: `apps/web/components/planning/exact-gap-annotation.ts`
- Modify the existing test for that module (use its actual repository filename discovered during execution).

The current annotation label `↔ Зазор … мм` becomes an unambiguous presentation label such as:

```ts
label: `↔ Кратчайший зазор ${compactMm(actualMm)} мм`,
```

The Canvas legend uses the longer explanation `Кратчайший зазор между контурами`. Both values still come from the existing `minimumGapWitnessBetweenOrientedRectangles()` result; no distance calculation is duplicated.

Canvas source tests must not require the long phrase to exist inside `editor-canvas.tsx` when it belongs to the planning annotation component. Test each owner file separately.

## 4. Browser RED must be a real failing behavior test

Task 8 Steps 1–2 are replaced with:

- [ ] Create `m7-furniture-fit.spec.mjs` first with the deterministic accepted-room setup and one initial assertion that the catalogue exposes `Поиск мебели и техники`.
- [ ] Run the focused file directly:

```bash
cd tools/m7-browser-audit
pnpm exec playwright test m7-furniture-fit.spec.mjs --config=playwright.config.mjs
```

Expected: FAIL because the current product has no catalogue search field.

- [ ] Implement Tasks 1–6 until the focused scenario passes.
- [ ] Only after the focused test exists, append `m7-furniture-fit.spec.mjs` to both `testMatch` arrays.
- [ ] `playwright --list` is a discovery check, not RED evidence; it must not be described as expected to fail merely because a configured filename is absent.

## 5. Runtime identifiers are concrete values, not committed placeholders

In Task 9:

- obtain the actual Draft PR number in Task 0 before creating `docs/milestones/m7-7-acceptance.md`;
- write that integer directly into `**PR:** #…`;
- obtain exact SHA/run/artifact/digest values from GitHub before writing evidence fields;
- use explicit status `PENDING` only for a real workflow state, never as a substitute for unknown data presented as if final;
- construct merge title and message programmatically from the actual PR number and exact accepted head supplied to the merge API;
- never commit strings such as `<actual PR number>`, `<exact accepted head>` or `<PR>`.

The acceptance document may begin with:

```markdown
**Status:** AUTOMATED ACCEPTANCE PENDING / PRODUCT OWNER REVIEW PENDING
```

but final-evidence sections are added only when the immutable values exist.

## 6. Confirmed real package interfaces

`@vlezet/geometry` currently exports `FitDiagnostic`, `FitDiagnosticCode`, `FitStatus`, `evaluateObjectFits()` and `measureObjectClearances()`. Task 3 may import those types directly from `@vlezet/geometry`; no local duplicate diagnostic type is permitted.

## 7. Self-review result

After these amendments:

- every design requirement maps to an implementation task;
- no arbitrary-angle orientation is approximated as a cardinal angle;
- Draft PR lifecycle matches the accepted project workflow;
- browser RED evidence is genuine;
- runtime identifiers are never committed as unresolved placeholders;
- exact contour-gap wording has one correct presentation owner;
- all planned product changes remain inside `apps/web` presentation/runtime surfaces and browser/docs evidence;
- no domain, editor-core, geometry-authority, persistence, planning-authority, recognition or 3D changes are required.
