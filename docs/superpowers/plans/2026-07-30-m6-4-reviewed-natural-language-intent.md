# M6.4 Reviewed Natural-Language Intent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional natural-language-to-reviewable-constraints workflow that transfers only explicitly confirmed intent into the existing deterministic M6 planning controls.

**Architecture:** Add pure symbolic intent, reference-resolution and confirmed-draft conversion contracts to `@vlezet/planning`; add a text-only OpenRouter structured-output adapter in `apps/web`; extend the existing planning panel with ephemeral input/review/ambiguity/acknowledgement state and transfer into its current manual controls. The existing planner, validator, Preview, Apply, document schema and persistence remain unchanged.

**Tech Stack:** TypeScript, Vitest, React 19, Next.js 16, Zustand, OpenRouter structured outputs, pnpm/Turborepo, GitHub Actions.

## Global Constraints

- Millimetres remain the canonical world unit.
- `VlezetDocument` remains the only persistent apartment/layout source of truth.
- Interpreter output never contains authoritative coordinates, placements or document mutations.
- Object references resolve only within the selected room; ambiguity fails closed.
- Unsupported fragments remain visible and require acknowledgement.
- Confirmed constraints pass the existing `validatePlanningConstraintSet()` unchanged.
- Interpretation never automatically runs planning or Apply.
- API key, model response and draft state remain runtime-only.
- Manual structured planning remains usable without network access.
- No schema, migration, IndexedDB, backup or import changes.
- PR remains Draft until exact-head CI and representative browser acceptance pass.

---

### Task 1: Pure intent draft and deterministic resolution

**Files:**
- Create: `packages/planning/src/intent-draft.test.ts`
- Create: `packages/planning/src/intent-draft.ts`
- Modify: `packages/planning/src/index.ts`

**Interfaces:**
- Produces: `PlanningIntentClause`, `PlanningIntentInterpretation`, `PlanningObjectReferenceResolution`, `ResolvedPlanningIntentDraft`, `normalizePlanningIntentInterpretation()`, `normalizePlanningObjectReference()`, `resolvePlanningObjectReference()`, `resolvePlanningIntentDraft()`, `planningConstraintsFromResolvedIntentDraft()`.
- Consumes: existing `PlanningConstraint` and `validatePlanningConstraintSet()`.

- [ ] **Step 1: Write failing package tests**

Cover exact reference matches, unique token-sequence matches, ambiguous `стол`, unresolved typos, `ё/е`, whitespace/punctuation normalization, unsupported-fragment preservation, malformed clause rejection and resolved draft conversion.

```ts
test("does not guess an ambiguous short object reference", () => {
  expect(resolvePlanningObjectReference("стол", [
    { id: "work", name: "Рабочий стол" },
    { id: "dining", name: "Обеденный стол" },
  ])).toEqual({ status: "ambiguous", candidateObjectIds: ["dining", "work"] });
});

test("converts a confirmed resolved draft through existing validation", () => {
  expect(planningConstraintsFromResolvedIntentDraft({
    clauses: [
      { kind: "lock-object", objectId: "sofa", sourceText: "Диван не двигать" },
      { kind: "pair-min-gap", objectIds: ["chair", "table"], minimumMm: 800, sourceText: "минимум 800 мм" },
    ],
    unsupportedFragments: [],
    warnings: [],
  }, new Set(["sofa", "chair", "table"]))).toEqual([
    { kind: "lock-object", objectId: "sofa" },
    { kind: "pair-min-gap", objectIds: ["chair", "table"], minimumMm: 800 },
  ]);
});
```

- [ ] **Step 2: Commit RED tests and verify CI fails for missing module/exports**

```bash
git add packages/planning/src/intent-draft.test.ts
git commit -m "test: define reviewed planning intent contract"
```

Expected GitHub Actions result: unit tests/typecheck fail because `intent-draft` exports do not exist.

- [ ] **Step 3: Implement minimal pure contracts**

Implement deterministic NFKC/lowercase/`ё→е`/punctuation normalization, exact-then-token-sequence matching, stable candidate ordering, strict clause normalization, resolution results and conversion through `validatePlanningConstraintSet()`.

- [ ] **Step 4: Export the new API from `packages/planning/src/index.ts`**

```ts
export * from "./intent-draft";
```

- [ ] **Step 5: Verify focused and full CI pass**

Expected: package tests, TypeScript, lint and production build pass.

- [ ] **Step 6: Commit GREEN implementation**

```bash
git add packages/planning/src/intent-draft.ts packages/planning/src/index.ts
git commit -m "feat: add reviewed planning intent draft contract"
```

---

### Task 2: Text-only OpenRouter interpreter adapter

**Files:**
- Create: `apps/web/components/planning/openrouter-intent-schema.test.ts`
- Create: `apps/web/components/planning/openrouter-intent-schema.ts`
- Create: `apps/web/components/planning/openrouter-intent-provider.test.ts`
- Create: `apps/web/components/planning/openrouter-intent-provider.ts`

**Interfaces:**
- Produces: `OPENROUTER_PLANNING_INTENT_JSON_SCHEMA`, `normalizeOpenRouterPlanningIntentPayload()`, `listCompatibleOpenRouterTextModels()`, `interpretPlanningIntentWithOpenRouter()`, `OpenRouterPlanningIntentError`, `OpenRouterTextModelOption`.
- Consumes: `normalizePlanningIntentInterpretation()` from Task 1.

- [ ] **Step 1: Write failing schema/provider tests**

Tests must assert:

- request contains only text and object-name context;
- strict JSON schema supports exactly the five accepted clause forms;
- no coordinate or placement fields exist;
- model discovery requires structured output but not image input;
- `globalThis.fetch` keeps the correct receiver;
- 401/402/429/malformed response categories are explicit;
- API key is provided only as an Authorization header and never returned in output;
- malformed clause entries become visible unsupported diagnostics instead of silently changing meaning;
- abort signal is forwarded.

```ts
test("does not send geometry or image content", async () => {
  const calls: RequestInit[] = [];
  await interpretPlanningIntentWithOpenRouter({
    apiKey: "runtime-key",
    modelId: "model",
    requestText: "Диван не двигать",
    roomObjects: [{ id: "sofa", name: "Диван" }],
    signal: new AbortController().signal,
    fetcher: async (_input, init) => {
      calls.push(init ?? {});
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ clauses: [], unsupportedFragments: [], warnings: [] }) } }] }), { status: 200 });
    },
  });
  expect(JSON.stringify(calls[0]?.body)).not.toMatch(/image|position|coordinate|placement/i);
});
```

- [ ] **Step 2: Commit RED tests and verify CI failure**

```bash
git add apps/web/components/planning/openrouter-intent-*.test.ts
git commit -m "test: define planning intent provider boundary"
```

- [ ] **Step 3: Implement strict schema and payload normalization**

The provider returns symbolic `objectRef` strings only. Unit-bearing exact-gap payloads are normalized into `minimumMm` before passing to the pure package.

- [ ] **Step 4: Implement model discovery and interpretation request**

Use the existing safe browser-fetch and categorized OpenRouter patterns, but keep the adapter independent from recognition and image APIs.

- [ ] **Step 5: Verify focused and full CI pass**

- [ ] **Step 6: Commit GREEN adapter**

```bash
git add apps/web/components/planning/openrouter-intent-schema.ts apps/web/components/planning/openrouter-intent-provider.ts
git commit -m "feat: add optional planning intent interpreter"
```

---

### Task 3: Pure review/transfer view model

**Files:**
- Create: `apps/web/components/planning/planning-intent-review.test.ts`
- Create: `apps/web/components/planning/planning-intent-review.ts`

**Interfaces:**
- Produces: `PlanningIntentReviewDraft`, `buildPlanningIntentReviewDraft()`, `resolvePlanningIntentReviewReference()`, `toggleUnsupportedIntentAcknowledgement()`, `removePlanningIntentReviewClause()`, `planningControlStateFromIntentReview()`.
- Consumes: Task 1 pure contracts and existing `planningPairKey()`.
- Output matches existing planning-panel control state: selected IDs, locked IDs, boundary preferences, pair preferences and minimum-gap input strings.

- [ ] **Step 1: Write failing review/transfer tests**

Cover:

- resolved and ambiguous clause rows;
- explicit ambiguity choice;
- unsupported acknowledgement gate;
- clause removal;
- selected object limit;
- all-locked rejection;
- exact control-state transfer;
- no generated result/candidate in transfer output.

```ts
test("transfers a confirmed draft into the existing manual control state", () => {
  const state = planningControlStateFromIntentReview(reviewDraft, roomObjects);
  expect(state).toEqual({
    selectedObjectIds: ["sofa", "chair", "table"],
    lockedObjectIds: ["sofa"],
    boundaryPreferences: { chair: "corner" },
    pairPreferences: {},
    pairMinimumGapInputs: { [planningPairKey("chair", "table")]: "800" },
  });
});
```

- [ ] **Step 2: Commit RED tests and verify CI failure**

- [ ] **Step 3: Implement immutable review helpers and transfer validation**

Use `planningConstraintsFromResolvedIntentDraft()` as the final authority. Do not duplicate planning conflict rules in UI code.

- [ ] **Step 4: Verify focused and full CI pass**

- [ ] **Step 5: Commit GREEN view model**

```bash
git add apps/web/components/planning/planning-intent-review.ts
git commit -m "feat: add reviewable planning intent transfer model"
```

---

### Task 4: Planning panel language/review UX

**Files:**
- Create: `apps/web/components/planning/planning-intent-section.test.tsx`
- Create: `apps/web/components/planning/planning-intent-section.tsx`
- Modify: `apps/web/components/planning/planning-panel.test.tsx`
- Modify: `apps/web/components/planning/planning-panel.tsx`
- Modify: `apps/web/app/planning-exact-gap.css`

**Interfaces:**
- `PlanningIntentSection` receives room objects and callbacks; it owns only ephemeral language/provider/review state.
- `PlanningPanel` receives transferred manual-control state and remains the sole owner of selected objects and ordinary controls.

- [ ] **Step 1: Write failing component tests**

Cover:

- input/key/model controls;
- successful draft display;
- ambiguity select;
- unsupported acknowledgement;
- transfer disabled until resolved/acknowledged;
- transfer populates ordinary controls;
- transfer does not call `planLayoutAlternatives()`;
- provider failure leaves `Найти варианты` and manual controls active;
- any transfer/manual-control edit clears result, Preview and active exact pair;
- closing panel discards language state.

- [ ] **Step 2: Commit RED UI tests and verify CI failure**

- [ ] **Step 3: Implement `PlanningIntentSection`**

Use runtime-only React state, abort stale requests, discover compatible model on demand, render review cards and expose only a confirmed transfer callback.

- [ ] **Step 4: Integrate transfer into `PlanningPanel`**

Add a helper that sets all five existing control-state collections atomically, calls `clearGeneratedState()`, and never invokes `generate()`.

Update `clearGeneratedState()` to clear both Preview and `activeExactPairKey`.

- [ ] **Step 5: Add responsive styling without changing the editor grid contract**

Keep the right panel viewport-safe and reuse existing inspector primitives.

- [ ] **Step 6: Verify focused and full CI pass**

- [ ] **Step 7: Commit GREEN UI integration**

```bash
git add apps/web/components/planning apps/web/app/planning-exact-gap.css
git commit -m "feat: add reviewed natural-language planning UX"
```

---

### Task 5: Documentation, acceptance checklist and final verification

**Files:**
- Create: `docs/milestones/m6-4-acceptance.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `README.md`

**Interfaces:**
- Records implementation status without marking browser acceptance or merge complete prematurely.

- [ ] **Step 1: Add an M6.4 RC acceptance checklist**

Include automated gates, provider failure, ambiguity, unsupported fragment, transfer fidelity, manual fallback, Preview/Apply/Undo/Redo and persistence checks.

- [ ] **Step 2: Update canonical docs to M6.4 RC/Draft PR state**

State exact limitations and retain M6.3 as the last accepted milestone until browser acceptance and merge.

- [ ] **Step 3: Verify no persistence/schema files changed**

Inspect the PR file list. Expected: no changes under domain migrations, projects IndexedDB schema, backup/import formats or `VlezetDocument`.

- [ ] **Step 4: Run exact-head GitHub Actions**

Required successful steps:

```text
Install dependencies
Unit tests
Typecheck
Lint
Build
```

- [ ] **Step 5: Create or update Draft PR**

PR title: `feat: M6.4 reviewed natural-language intent`.

PR body must state:

- interpretation is optional and review-only;
- supported vocabulary is limited to M6.2–M6.3;
- ambiguity/unsupported text fail closed;
- transfer populates existing controls and does not generate automatically;
- no persistence/schema or planner-authority changes;
- exact-head CI status;
- representative browser acceptance remains required before Ready for Review.

- [ ] **Step 6: Perform representative browser acceptance**

Use `Диван`, `Кресло`, `Рабочий стол`, `Обеденный стол` and the canonical ambiguous `стол` scenario from the spec.

- [ ] **Step 7: Record final evidence only after acceptance**

Do not mark M6.4 accepted or merged until the browser checklist and exact-head CI pass.
