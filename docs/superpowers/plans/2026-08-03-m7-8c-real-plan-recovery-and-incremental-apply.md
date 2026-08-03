# M7.8C Real-Plan Recovery and Incremental Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow additional recognition candidates to be safely applied after a previous Apply and recover principal walls missed by region-only local recognition without admitting isolated furniture/text lines.

**Architecture:** Recognition mutations return an applied Draft to review, while Apply becomes idempotent for both walls and openings. Local recognition keeps structural regions as primary evidence and fuses only topology-anchored candidates from a bounded strict Hough supplement.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Vitest, OpenCV.js, pnpm/Turborepo, Playwright, GitHub Actions.

## Global Constraints

- `VlezetDocument` remains the only persistent geometry authority.
- AI cannot create, move, resize, thicken or re-host geometry.
- Recognition remains a reviewable Draft until explicit Apply.
- Existing project, IndexedDB and backup schemas remain unchanged.
- Supplemental Hough candidates are capped at medium confidence.
- Candidate, comparison and accepted-supplement budgets fail closed.
- Door-swing reconstruction is out of scope.
- Core and Source Opening F1 must remain at least `0.85`.
- Unknown-host openings, stale decisions and incorrect high-confidence predictions must remain `0`.

---

### Task 1: Return applied Drafts to review after candidate changes

**Files:**
- Modify: `apps/web/components/recognition/recognition-applied-state.test.ts`
- Modify: `apps/web/components/recognition/recognition-controller.ts`

**Interfaces:**
- Consumes: `reviewStatus(session: RecognitionSessionRecord): RecognitionDraftStatus`
- Produces: `#updateDraft(...)` that normalizes `applied` to the correct review status before persistence.

- [ ] **Step 1: Write failing controller tests**

Add a Draft fixture containing two wall candidates and verify:

```ts
await controller.updateDecision("wall-2", "accepted");
expect(controller.state.session?.draft.status).toBe("local-complete");
```

Repeat with cloud metadata and expect `reconciled`. Also cover `editWall` on an applied Draft.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm --filter web exec vitest run components/recognition/recognition-applied-state.test.ts
```

Expected: the new tests receive `applied` instead of the review status.

- [ ] **Step 3: Implement review normalization**

In `RecognitionController.#updateDraft`, calculate the updated Draft and then replace `status: "applied"` with `reviewStatus(session)` before validation and persistence. Do not change `setAppliedState`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same Vitest command. Expected: all applied-state tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/recognition/recognition-applied-state.test.ts apps/web/components/recognition/recognition-controller.ts
git commit -m "fix: reopen recognition draft after candidate changes"
```

### Task 2: Make repeated Apply idempotent for openings

**Files:**
- Modify: `apps/web/components/recognition/recognition-apply.test.ts`
- Modify: `apps/web/components/recognition/recognition-apply.ts`
- Modify: `apps/web/components/recognition/recognition-panel.tsx`

**Interfaces:**
- Produces: `findExistingOpening(document, wallId, kind, centerOffset, width)` returning `duplicate | conflict | null`.
- Preserves: `planRecognitionApply(...) => RecognitionApplyPlan`.

- [ ] **Step 1: Write failing repeated-Apply tests**

Create a first Draft with one wall and one door, apply it, then apply the same accepted Draft to the resulting document. Assert:

```ts
expect(second.document).toEqual(first.document);
expect(second.appliedCandidateIds).toEqual([]);
expect(second.diagnostics).toContainEqual(expect.objectContaining({
  candidateId: "door-1",
  severity: "info",
}));
```

Add a second test where another wall is accepted after the first Apply and assert only that wall is added. Add a conflicting-opening test: same wall and overlapping span with a different kind must be skipped with a warning.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter web exec vitest run components/recognition/recognition-apply.test.ts
```

Expected: the repeated door is duplicated or rejected by lower-level geometry without the required deterministic diagnostic.

- [ ] **Step 3: Implement opening duplicate/conflict detection**

Before `addOpening`, compare against existing openings on the resolved wall:

- centre tolerance: `70 mm`;
- width tolerance: `100 mm`;
- any span overlap above `0.8` with a different kind is a conflict;
- an equivalent kind/centre/width is an informational duplicate and is not added.

Do not mark duplicates as newly applied.

- [ ] **Step 4: Update Apply copy**

When an applied Draft becomes reviewable, show `Применить новые выбранные`. Keep `Уже применено` only while the Draft status is currently `applied`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 2 test command and the recognition panel tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/recognition/recognition-apply.test.ts apps/web/components/recognition/recognition-apply.ts apps/web/components/recognition/recognition-panel.tsx
git commit -m "fix: support idempotent incremental recognition apply"
```

### Task 3: Add a pure topology-anchored supplemental wall gate

**Files:**
- Create: `packages/recognition/src/wall-evidence-fusion.ts`
- Create: `packages/recognition/src/wall-evidence-fusion.test.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**

```ts
export type FuseRecognitionWallEvidenceInput = Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  supplementalWalls: readonly RecognitionWallCandidate[];
}>;

export type FuseRecognitionWallEvidenceResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  acceptedSupplementalCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

export function fuseRecognitionWallEvidence(
  input: FuseRecognitionWallEvidenceInput,
): FuseRecognitionWallEvidenceResult;
```

- [ ] **Step 1: Write RED tests for admission and rejection**

Cover:

1. a horizontal supplement connecting two primary vertical walls is accepted;
2. an isolated numeral-like segment is rejected;
3. a short one-anchor furniture segment is rejected;
4. a bounded collinear extension between primary fragments is accepted;
5. a physical duplicate is rejected;
6. reversed input order returns the same result;
7. input above the candidate budget returns only primary walls with `wall-evidence-fusion-budget-exceeded`.

Accepted supplements must have:

```ts
expect(candidate).toMatchObject({
  confidence: "medium",
  origin: "local",
  conflict: null,
});
expect(candidate.evidence.reasons).toContain("supplemental-hough-topology-anchor");
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter @vlezet/recognition exec vitest run src/wall-evidence-fusion.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement deterministic fusion**

Use these fixed safety limits:

```ts
const MAX_PRIMARY_WALLS = 96;
const MAX_SUPPLEMENTAL_WALLS = 96;
const MAX_PAIR_COMPARISONS = 4096;
const MAX_ACCEPTED_SUPPLEMENTS = 16;
const AXIS_TOLERANCE_DEG = 10;
const ENDPOINT_ANCHOR_TOLERANCE_PX = 18;
const COLLINEAR_OFFSET_TOLERANCE_PX = 12;
const COLLINEAR_GAP_TOLERANCE_PX = 42;
const DUPLICATE_MIN_OVERLAP_RATIO = 0.72;
const MIN_SUPPLEMENT_LENGTH_PX = 24;
```

Admission requires either:

- both endpoints within anchor tolerance of the primary network; or
- a bounded collinear gap/extension between primary fragments.

Rename accepted IDs deterministically with a `supplemental-` prefix and a geometry key so primary IDs cannot collide.

- [ ] **Step 4: Export the module and verify GREEN**

Run the focused tests. Expected: all fusion tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/wall-evidence-fusion.ts packages/recognition/src/wall-evidence-fusion.test.ts packages/recognition/src/index.ts
git commit -m "feat: add topology-anchored wall evidence fusion"
```

### Task 4: Integrate strict supplemental Hough into region-first recognition

**Files:**
- Modify: `apps/web/components/recognition/local-recognition-engine.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine-region-source.test.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine-source.test.ts`

**Interfaces:**
- Consumes: `fuseRecognitionWallEvidence(...)` from Task 3.
- Produces debug fields:
  - `supplementalCandidateCount`;
  - `acceptedSupplementalCount`;
  - `wallEvidenceFusionDiagnosticCodes`;
  - selected mode `regions+supplemental` when at least one supplement is accepted.

- [ ] **Step 1: Replace the old source-contract expectation with RED hybrid expectations**

The source tests must assert that strict Hough is no longer contained exclusively in `if (!useStructuralRegionEvidence)`, and that fusion occurs after primary region walls are built but before window-host consolidation and topology sanitation.

- [ ] **Step 2: Run source-contract tests and verify RED**

```bash
pnpm --filter web exec vitest run components/recognition/local-recognition-engine-region-source.test.ts components/recognition/local-recognition-engine-source.test.ts
```

Expected: the current fallback-only branch violates the new expectations.

- [ ] **Step 3: Refactor Hough extraction into a bounded helper inside the engine**

Always run the strict pass on `structuralMask`. Run the permissive pass only when no region evidence exists. Analyze strict supplemental segments with the existing adaptive options.

For region mode:

```ts
const fusion = fuseRecognitionWallEvidence({
  widthPx: input.imageData.width,
  heightPx: input.imageData.height,
  primaryWalls: strictWalls,
  supplementalWalls: markAdaptiveCandidates(supplementalAnalysis.candidates),
});
analysisWalls = [...fusion.walls];
```

Keep region candidates primary and preserve the current adaptive fallback when no regions exist.

- [ ] **Step 4: Add diagnostics and debug evidence**

Emit `topology-anchored-hough-supplement` only when at least one supplement is accepted. Emit budget diagnostics unchanged from the fusion result.

- [ ] **Step 5: Run focused tests and full unit suite**

```bash
pnpm --filter web exec vitest run components/recognition/local-recognition-engine-region-source.test.ts components/recognition/local-recognition-engine-source.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/recognition/local-recognition-engine.ts apps/web/components/recognition/local-recognition-engine-region-source.test.ts apps/web/components/recognition/local-recognition-engine-source.test.ts
git commit -m "feat: supplement region walls with anchored Hough evidence"
```

### Task 5: Verify quality gates and update PR evidence

**Files:**
- Modify: PR #42 body only after exact-head checks pass.

- [ ] **Step 1: Run exact-head GitHub workflows**

Required workflows:

- Standard CI;
- Recognition Benchmark;
- M7 Browser Audit.

- [ ] **Step 2: Inspect benchmark artifacts**

Confirm:

```text
Core Opening F1 >= 0.85
Source Opening F1 >= 0.85
Core unknown-host = 0
Source unknown-host = 0
Core stale decisions = 0
Source stale decisions = 0
Core incorrect-high-confidence = 0
Source incorrect-high-confidence = 0
```

Record Source wall geometry/topology F1 and per-fixture regressions. Do not accept aggregate improvement if any previously passing fixture fails.

- [ ] **Step 3: Verify browser behavior**

Chromium and WebKit must pass. Confirm the Apply button returns after changing a decision on an applied Draft.

- [ ] **Step 4: Update Draft PR #42**

Document:

- exact head SHA;
- workflow run numbers;
- artifact ID and SHA-256;
- incremental Apply behavior;
- accepted supplemental-wall count in benchmark fixtures;
- product-owner retest checklist for the same real plan.

Keep the PR Draft and `DO NOT MERGE` until explicit product acceptance.
