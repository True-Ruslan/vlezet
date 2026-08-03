# M7.8C Thick Walls, Windows and Clutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate duplicate axes of one thick wall, recover mask-supported windows and block short sanitary/furniture wall candidates without weakening recognition safety.

**Architecture:** Add three framework-independent deterministic recognition stages. Thick-wall consolidation and clutter veto consume a bounded structural-mask view; window recovery consumes the same mask plus thin symbol lines. Integrate the stages into the local engine before topology sanitation/opening validation while preserving immutable AI geometry and explicit Apply.

**Tech Stack:** TypeScript 6, Vitest, OpenCV.js, React 19, Next.js 16, pnpm/Turborepo, Playwright, GitHub Actions.

## Global Constraints

- `VlezetDocument` remains the only persistent geometry authority.
- Millimetres remain canonical outside recognition raster analysis.
- AI cannot create, move, resize, thicken or re-host geometry.
- Recognition remains a reviewable Draft until explicit Apply.
- Project, IndexedDB, backup and history schemas remain unchanged.
- Ambiguity and budget overflow fail closed.
- Core and Source Opening F1 remain at least `0.85`.
- Unknown-host openings, stale decisions and incorrect high-confidence predictions remain `0`.
- PR #42 remains Draft and `DO NOT MERGE` until explicit product-owner acceptance.

---

### Task 1: Consolidate filled thick-wall siblings

**Files:**
- Create: `packages/recognition/src/thick-wall-consolidation.ts`
- Create: `packages/recognition/src/thick-wall-consolidation.test.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**

```ts
export type StructuralMaskView = Readonly<{
  widthPx: number;
  heightPx: number;
  isStructural: (x: number, y: number) => boolean;
}>;

export type ThickWallConsolidationResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  mergedGroupCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

export function consolidateThickWallSiblings(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  mask: StructuralMaskView;
}>): ThickWallConsolidationResult;
```

- [ ] **Step 1: Write RED tests**

Cover:

1. two overlapping parallel axes in one fully structural band merge;
2. the same axes separated by a white corridor remain distinct;
3. three sibling axes merge to one deterministic centre/thickness;
4. perpendicular/crossing walls do not merge;
5. reversed input order returns the same result;
6. more than 96 candidates fails closed with `thick-wall-consolidation-budget-exceeded`.

The merged candidate must contain `thick-wall-sibling-consolidation`, use medium confidence at most and have deterministic ID/geometry.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/recognition exec vitest run src/thick-wall-consolidation.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement bounded consolidation**

Use fixed limits:

```ts
const MAX_WALL_CANDIDATES = 96;
const MAX_PAIR_COMPARISONS = 4096;
const MAX_GROUP_SIZE = 6;
const AXIS_TOLERANCE_DEG = 8;
const MIN_OVERLAP_RATIO = 0.72;
const MAX_BAND_GAP_PX = 8;
const MIN_STRUCTURAL_FILL_RATIO = 0.72;
const MAX_COMBINED_THICKNESS_PX = 420;
const MAX_THICKNESS_MULTIPLIER = 3.2;
```

Build an undirected sibling graph only from independently mask-supported pairs, then merge each bounded connected component. Sample only the projected overlap corridor; do not use already merged output as evidence for new edges.

- [ ] **Step 4: Export and run GREEN**

Run the focused test and the recognition package suite.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/thick-wall-consolidation.ts packages/recognition/src/thick-wall-consolidation.test.ts packages/recognition/src/index.ts
git commit -m "fix: consolidate filled thick-wall siblings"
```

### Task 2: Recover mask-supported windows

**Files:**
- Create: `packages/recognition/src/window-mask-analysis.ts`
- Create: `packages/recognition/src/window-mask-analysis.test.ts`
- Modify: `packages/recognition/src/opening-analysis.ts`
- Modify: `packages/recognition/src/opening-analysis.test.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**

```ts
export function detectMaskSupportedWindows(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>): readonly RecognitionOpeningCandidate[];
```

Extend `AnalyzeOpeningHypothesesInput` with optional `structuralMask?: StructuralMaskView`.

- [ ] **Step 1: Write RED tests**

Cover:

1. bounded low-fill interval with two matching rails produces one `window` bound to the host wall;
2. one rail produces no candidate;
3. a perpendicular door leaf suppresses window classification;
4. low-fill interval at wall end is rejected;
5. duplicate mask and existing rail hypotheses collapse to one candidate;
6. reversed wall/symbol ordering is deterministic;
7. budgets fail closed.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/recognition exec vitest run src/window-mask-analysis.test.ts src/opening-analysis.test.ts
```

- [ ] **Step 3: Implement mask sampling**

Use:

```ts
const MIN_WINDOW_WIDTH_PX = 28;
const MAX_WINDOW_WIDTH_PX = 240;
const MIN_HOST_SUPPORT_PX = 18;
const LOW_OCCUPANCY_RATIO = 0.36;
const HIGH_OCCUPANCY_RATIO = 0.58;
const MIN_RAIL_COUNT = 2;
const MAX_WALLS = 96;
const MAX_SYMBOL_SEGMENTS = 512;
```

Sample across the wall band, segment bounded low-occupancy runs, require paired rails and reject door-leaf evidence. Produce medium-confidence local candidates with `mask-supported-window-gap` and `paired-window-rails` reasons.

- [ ] **Step 4: Deduplicate before validation**

In `analyzeOpeningHypotheses`, combine existing hypotheses and mask candidates by host, kind and centre/width tolerance. Prefer known kind over unknown and higher local score over lower score.

- [ ] **Step 5: Run GREEN**

Run focused tests and the recognition suite.

- [ ] **Step 6: Commit**

```bash
git add packages/recognition/src/window-mask-analysis.ts packages/recognition/src/window-mask-analysis.test.ts packages/recognition/src/opening-analysis.ts packages/recognition/src/opening-analysis.test.ts packages/recognition/src/index.ts
git commit -m "feat: recover mask-supported windows"
```

### Task 3: Block short structural clutter before review authority

**Files:**
- Create: `packages/recognition/src/structural-clutter-veto.ts`
- Create: `packages/recognition/src/structural-clutter-veto.test.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**

```ts
export function applyStructuralClutterVeto(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>): Readonly<{
  walls: readonly RecognitionWallCandidate[];
  blockedCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;
```

- [ ] **Step 1: Write RED tests**

Cover:

1. short one-anchor, low-support, symbol-dense sanitary contour becomes `unsupported`/low;
2. long partition remains unchanged;
3. short wall attached at both endpoints remains unchanged;
4. short high-support wall remains unchanged;
5. input ordering is deterministic;
6. overload preserves input.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/recognition exec vitest run src/structural-clutter-veto.test.ts
```

- [ ] **Step 3: Implement conservative veto**

Block only when all conditions from the design hold. Add `structural-clutter-veto` reason and warning diagnostic. Never delete the candidate.

- [ ] **Step 4: Run GREEN and commit**

```bash
git add packages/recognition/src/structural-clutter-veto.ts packages/recognition/src/structural-clutter-veto.test.ts packages/recognition/src/index.ts
git commit -m "fix: veto short structural clutter candidates"
```

### Task 4: Integrate the three stages into the OpenCV engine

**Files:**
- Modify: `apps/web/components/recognition/local-recognition-engine.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine-region-source.test.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine-source.test.ts`

**Data flow:**

```text
region/Hough fusion
→ thick-wall sibling consolidation
→ structural clutter veto
→ window-host consolidation
→ topology sanitation
→ opening analysis with structural mask
→ rescale/persist Draft
```

- [ ] **Step 1: Write RED source-contract tests**

Assert exact stage ordering, debug counters and structural-mask forwarding.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter web exec vitest run components/recognition/local-recognition-engine-region-source.test.ts components/recognition/local-recognition-engine-source.test.ts
```

- [ ] **Step 3: Integrate stages**

Create one mask view backed by `structuralMask.data`. Add debug fields:

- `thickWallMergedGroupCount`;
- `structuralClutterBlockedCount`;
- `maskSupportedWindowCount`;
- diagnostic-code arrays for all stages.

Exclude blocked walls from window-host/opening analysis but preserve them in the final Draft.

- [ ] **Step 4: Run focused and full tests**

```bash
pnpm --filter web exec vitest run components/recognition/local-recognition-engine-region-source.test.ts components/recognition/local-recognition-engine-source.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/recognition/local-recognition-engine.ts apps/web/components/recognition/local-recognition-engine-region-source.test.ts apps/web/components/recognition/local-recognition-engine-source.test.ts
git commit -m "feat: stabilize thick walls windows and clutter"
```

### Task 5: Record Gemini 2.5 Flash verification evidence without model-specific authority

**Files:**
- Modify: `apps/web/components/recognition/openrouter-provider.test.ts`
- Modify: `apps/web/components/recognition/openrouter-provider.ts`
- Modify: `apps/web/components/recognition/recognition-panel.tsx`

- [ ] **Step 1: Write RED tests**

Add a pure model-profile classifier that marks `google/gemini-2.5-flash` and provider aliases as `unqualified-for-floor-plan-verification`. The profile only changes explanatory UI copy; it must not change sanitization, confidence limits or geometry authority.

- [ ] **Step 2: Implement informational warning**

After a verification result where confident count drops by at least 60% and no missing opening can be added, show:

```text
Модель резко снизила уверенность локального черновика. Это не исправляет геометрию; сравните результат с локальным слоем или выберите другую vision-модель.
```

Do not automatically revert decisions and do not blacklist the model.

- [ ] **Step 3: Run tests and commit**

```bash
git add apps/web/components/recognition/openrouter-provider.test.ts apps/web/components/recognition/openrouter-provider.ts apps/web/components/recognition/recognition-panel.tsx
git commit -m "feat: surface weak AI verification profiles"
```

### Task 6: Exact-head verification and PR evidence

- [ ] **Step 1: Run Standard CI, Recognition Benchmark and M7 Browser Audit**
- [ ] **Step 2: Inspect Core and Source per-fixture metrics and artifacts**
- [ ] **Step 3: Reject the implementation if any previously passing fixture regresses**
- [ ] **Step 4: Update Draft PR #42 with exact SHA, run IDs, artifact digest and product retest checklist**
- [ ] **Step 5: Keep PR Draft and do not merge**
