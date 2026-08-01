# M7.5 Onboarding, Status and Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guide a new user from an empty project to the first authoritative closed room and retain understandable completion/recovery evidence for selected high-impact operations after transient toasts disappear.

**Architecture:** Derive first-project progress from the existing document and `deriveRooms()` only; persist only a browser-local per-project dismissal preference. Publish at most one runtime-only evidence item through a small Zustand vanilla store, render it with existing M7.3 `UiNotice`, and integrate publication only after existing authoritative operations succeed or fail atomically.

**Tech Stack:** TypeScript, React, Zustand vanilla/useStore, Vitest, React server rendering tests, Next.js 16, Playwright Chromium/WebKit, pnpm/Turborepo.

## Global Constraints

- `VlezetDocument` remains the only persistent apartment/layout source of truth.
- Do not change document schema, migrations, IndexedDB project records, portable backup format, geometry, topology, room derivation, snapping, planning validation, recognition reconciliation, semantic history or 3D authority.
- Progress is derived from current `walls.length` and existing `deriveRooms(document).rooms`; never reimplement topology.
- Only `{ "dismissed": true }` may be stored under `vlezet.ui.first-project-guide.v1.<projectId>`.
- Operation evidence is runtime-only, scoped by `projectId`, contains no raw provider response/file/geometry snapshot and holds at most one item.
- New UI must use existing M7.3 primitives/tokens, remain non-modal, preserve compact-width reachability and not intercept Canvas pointer input.
- Every production change follows RED → observed failing Actions run → GREEN → observed passing Actions run.
- Keep the feature PR Draft until automated gates and product-owner browser acceptance pass.

---

## File map

### New files

- `apps/web/components/editor/first-project-progress.ts` — pure phase/checklist derivation.
- `apps/web/components/editor/first-project-progress.test.ts` — invalid-input, empty, drawing and room-created contract.
- `apps/web/components/editor/first-project-guide-preference.ts` — guarded browser-local dismissal adapter.
- `apps/web/components/editor/first-project-guide-preference.test.ts` — storage success/failure/SSR contract.
- `apps/web/components/editor/editor-operation-evidence-store.ts` — runtime evidence types, store and project scoping.
- `apps/web/components/editor/editor-operation-evidence-store.test.ts` — replacement, dismissal, mismatch and stale-entity helpers.
- `apps/web/components/editor/first-project-guide.tsx` — non-modal guide view.
- `apps/web/components/editor/first-project-guide.test.tsx` — rendered copy/actions/accessibility states.
- `apps/web/components/editor/editor-operation-evidence.tsx` — `UiNotice` presentation and action dispatch.
- `apps/web/components/editor/editor-operation-evidence.test.tsx` — success/error/action/dismiss rendering.
- `apps/web/app/m7-onboarding-status.css` — bounded guide/evidence layout using existing tokens.
- `tools/m7-browser-audit/m7-onboarding-status.spec.mjs` — Chromium first-project and post-toast evidence flow.
- `docs/milestones/m7-5-acceptance.md` — milestone gates and manual scenarios.

### Modified files

- `apps/web/app/layout.tsx` — import M7.5 CSS.
- `apps/web/components/editor/apartment-editor.tsx` — derive rooms/progress, load dismissal, observe first-room transition, render guide/evidence and dispatch valid actions.
- `apps/web/components/editor/apartment-editor-shell.test.ts` — source-level architecture/placement regression.
- `apps/web/components/projects/project-app.tsx` — publish recognition/export success and recoverable failures; clear evidence at session boundaries.
- `apps/web/components/projects/project-app.test.ts` or nearest existing project-app source test — publication occurs after success only.
- `apps/web/components/planning/planning-panel.tsx` — publish planning Apply success/failure after existing atomic action.
- `apps/web/components/planning/planning-panel.test.tsx` — planning evidence regression.
- `tools/m7-browser-audit/playwright.config.mjs` — include M7.5 Chromium spec if explicit matching is used.
- `tools/m7-browser-audit/playwright.webkit.config.mjs` and/or `m7-webkit-smoke.spec.mjs` — compact/core onboarding smoke.

---

### Task 1: Pure first-project progress contract

**Files:**
- Create: `apps/web/components/editor/first-project-progress.test.ts`
- Create: `apps/web/components/editor/first-project-progress.ts`

**Interfaces:**
- Produces:
  - `FirstProjectPhase = "empty" | "drawing" | "room-created"`
  - `FirstProjectStepId = "project-created" | "first-wall" | "closed-room" | "review-room"`
  - `deriveFirstProjectProgress(input: { wallCount: number; roomCount: number }): FirstProjectProgress`

- [ ] **Step 1: Commit RED tests only**

```ts
import { describe, expect, it } from "vitest";
import { deriveFirstProjectProgress } from "./first-project-progress";

describe("M7.5 first-project progress", () => {
  it("guides an empty project to the wall tool", () => {
    expect(deriveFirstProjectProgress({ wallCount: 0, roomCount: 0 })).toMatchObject({
      phase: "empty",
      completedSteps: ["project-created"],
      currentStep: "first-wall",
      primaryAction: "activate-wall-tool",
    });
  });

  it("keeps room completion pending while walls are open", () => {
    expect(deriveFirstProjectProgress({ wallCount: 3, roomCount: 0 })).toMatchObject({
      phase: "drawing",
      completedSteps: ["project-created", "first-wall"],
      currentStep: "closed-room",
      primaryAction: "activate-wall-tool",
    });
  });

  it("uses authoritative room count for success", () => {
    expect(deriveFirstProjectProgress({ wallCount: 4, roomCount: 1 })).toMatchObject({
      phase: "room-created",
      completedSteps: ["project-created", "first-wall", "closed-room"],
      currentStep: "review-room",
      primaryAction: "select-first-room",
    });
  });

  it.each([
    { wallCount: Number.NaN, roomCount: 0 },
    { wallCount: -1, roomCount: 0 },
    { wallCount: 1.5, roomCount: 0 },
    { wallCount: 0, roomCount: Number.POSITIVE_INFINITY },
  ])("fails closed for invalid counts: %o", (input) => {
    expect(deriveFirstProjectProgress(input)).toMatchObject({ phase: "empty", completedSteps: [] });
  });
});
```

- [ ] **Step 2: Verify RED in GitHub Actions**

Push the test-only commit. Expected: unit step fails because `./first-project-progress` does not exist.

- [ ] **Step 3: Implement the minimal pure contract**

Return fixed Russian title/description/action data for the three phases. Invalid counts return an `empty` fail-closed result with no completed steps and no completion claim.

- [ ] **Step 4: Verify GREEN**

Expected: focused and full unit suite pass; typecheck/lint/build remain green.

- [ ] **Step 5: Commit**

`feat: derive first-project progress`

---

### Task 2: Guarded per-project guide preference

**Files:**
- Create: `apps/web/components/editor/first-project-guide-preference.test.ts`
- Create: `apps/web/components/editor/first-project-guide-preference.ts`

**Interfaces:**
- Produces:
  - `firstProjectGuideStorageKey(projectId: string): string`
  - `readFirstProjectGuideDismissed(projectId: string, storage?: Pick<Storage, "getItem"> | null): boolean`
  - `writeFirstProjectGuideDismissed(projectId: string, storage?: Pick<Storage, "setItem"> | null): boolean`

- [ ] **Step 1: Commit RED tests only**

Cover exact key, valid JSON, malformed JSON, storage read throwing, write throwing, missing `window`/null storage and project isolation.

```ts
expect(firstProjectGuideStorageKey("p1")).toBe("vlezet.ui.first-project-guide.v1.p1");
expect(readFirstProjectGuideDismissed("p1", { getItem: () => '{"dismissed":true}' })).toBe(true);
expect(readFirstProjectGuideDismissed("p1", { getItem: () => "broken" })).toBe(false);
expect(writeFirstProjectGuideDismissed("p1", { setItem: () => { throw new Error("blocked"); } })).toBe(false);
```

- [ ] **Step 2: Verify RED**

Expected: missing module failure.

- [ ] **Step 3: Implement minimal guarded adapter**

Validate non-empty `projectId`; catch every storage/JSON exception; read failure returns `false`; write returns success boolean and stores exactly `{"dismissed":true}`.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

`feat: persist first-project guide dismissal`

---

### Task 3: Runtime operation-evidence store

**Files:**
- Create: `apps/web/components/editor/editor-operation-evidence-store.test.ts`
- Create: `apps/web/components/editor/editor-operation-evidence-store.ts`

**Interfaces:**
- Produces:
  - `EditorOperationKind`
  - `EditorEvidenceAction`
  - `EditorOperationEvidence`
  - `createEditorOperationEvidenceStore()`
  - singleton `editorOperationEvidenceStore`
  - `visibleEditorOperationEvidence(evidence, projectId, validEntityIds?): EditorOperationEvidence | null`

- [ ] **Step 1: Commit RED tests only**

Tests prove:
- publish replaces the previous item;
- dismiss clears one active item;
- `clearForProjectSwitch()` clears current evidence;
- project mismatch is invisible;
- `select-room` evidence becomes invisible when its `roomId` is absent from valid IDs;
- runtime item is not JSON/persistence coupled.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement minimal vanilla Zustand store**

State:

```ts
type EditorOperationEvidenceState = Readonly<{
  evidence: EditorOperationEvidence | null;
  publish: (evidence: EditorOperationEvidence) => void;
  dismiss: () => void;
  clearForProjectSwitch: () => void;
}>;
```

Do not generate business IDs. Callers provide `id` using `crypto.randomUUID()` or a safe runtime fallback.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

`feat: add runtime operation evidence store`

---

### Task 4: Guide and evidence presentation components

**Files:**
- Create: `apps/web/components/editor/first-project-guide.test.tsx`
- Create: `apps/web/components/editor/first-project-guide.tsx`
- Create: `apps/web/components/editor/editor-operation-evidence.test.tsx`
- Create: `apps/web/components/editor/editor-operation-evidence.tsx`
- Create: `apps/web/app/m7-onboarding-status.css`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- `FirstProjectGuide({ progress, onPrimaryAction, onDismiss })`
- `EditorOperationEvidenceNotice({ evidence, onAction, onDismiss })`

- [ ] **Step 1: Commit RED render tests only**

Use `renderToStaticMarkup` and assert:
- empty/drawing/room-created copy and button labels;
- checklist exposes completed/current state in text/attributes, not colour alone;
- dismiss button has an accessible name;
- evidence uses existing `ui-notice` classes, success/error semantics and explicit action label;
- generic `ОК` is never rendered.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement minimal components using `UiCard`, `UiButton` and `UiNotice`**

The guide root uses `data-first-project-phase`; evidence root uses `data-operation-kind`. Do not add a new notice visual language.

- [ ] **Step 4: Add bounded responsive CSS and import it from layout**

Required contracts:
- no fixed width wider than its container;
- `min-width: 0` on grid/flex children;
- guide/evidence do not intercept Canvas outside their own controls;
- no document-level horizontal overflow;
- meaningful text at least 12 px and actions 40 px through existing primitives.

- [ ] **Step 5: Verify GREEN**

- [ ] **Step 6: Commit**

`feat: add first-project guide and durable evidence views`

---

### Task 5: ApartmentEditor first-room orchestration

**Files:**
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/apartment-editor-shell.test.ts`
- Add focused component/source test if existing test structure requires it.

**Interfaces consumed:**
- `deriveRooms(document)` from `@vlezet/geometry`
- Tasks 1–4 modules and singleton store
- existing `editorStore.setTool("wall")`, `selectRoom(roomId)`, `undo()`

- [ ] **Step 1: Commit RED tests only**

Prove source/component contracts:
- room progress is based on `deriveRooms(document).rooms`, not a new topology helper;
- existing completed project initial render does not publish first-room evidence;
- same-project transition `0 → 1+` publishes exactly one `first-room-created` item;
- project change resets baseline and clears evidence;
- referenced room removal clears stale success;
- guide is hidden in 3D and bounded recognition/reference/planning workflows;
- guide primary action only selects Wall or existing room.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement orchestration**

Use refs for `{ projectId, roomCount }` transition baseline and state for dismissal loading/runtime fallback. On `projectId` change:
- clear runtime evidence;
- load browser preference;
- establish current room count baseline without publishing.

Render guide only when 2D, not dismissed, and no bounded workflow owns context. Render evidence through `visibleEditorOperationEvidence` with current derived room IDs.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

`feat: guide first-room completion in editor`

---

### Task 6: Recognition and project-backup evidence

**Files:**
- Modify: `apps/web/components/projects/project-app.tsx`
- Create or modify nearest project-app/source contract test.

**Interfaces consumed:** singleton evidence store.

- [ ] **Step 1: Commit RED tests only**

Prove:
- recognition success publishes only after `commitRecognitionDocument` and `markApplied` succeed;
- zero safe candidates remains a minor toast and does not publish success;
- recognition failure publishes `recoverable-failure` only while the review draft remains available and does not claim mutation;
- JSON backup success publishes `project-backup-exported` only after serialization and download call complete;
- backup failure publishes recovery evidence and retains existing detailed/global error path;
- PNG success remains toast-only;
- `startSession`, `stopSession` or project switch clears runtime evidence.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement publication helpers**

Use ordinary copy from the approved spec. Recognition success may include the trustworthy `plan.appliedCandidateIds.length`. Recovery action is `open-recognition-review` only when the active session/draft exists.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

`feat: retain recognition and backup outcomes`

---

### Task 7: Planning Apply evidence

**Files:**
- Modify: `apps/web/components/planning/planning-panel.test.tsx`
- Modify: `apps/web/components/planning/planning-panel.tsx`

- [ ] **Step 1: Commit RED tests only**

Prove:
- successful `applyPlanningCandidate` publishes `planning-applied` with `undo` action after the command succeeds;
- failing Apply publishes recoverable evidence with existing categorized message and no success;
- failure keeps the existing local panel error and clears stale preview/result as before.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement minimal publication**

Publish after `editorStore.getState().applyPlanningCandidate(...)`; preserve `planningUiStore.close()` and all existing error handling. Use the current active project ID supplied through a small prop/context contract rather than reading persisted project data from planning code. Preferred change: add `projectId` to `PlanningPanel` through `WallInspector`/`ApartmentEditor` only if needed; otherwise publish through an editor-scoped current-project runtime helper defined by Task 3. Do not place project IDs in planning domain contracts.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

`feat: retain planning apply outcome`

---

### Task 8: Browser acceptance and milestone record

**Files:**
- Create: `tools/m7-browser-audit/m7-onboarding-status.spec.mjs`
- Modify: `tools/m7-browser-audit/playwright.config.mjs`
- Modify: `tools/m7-browser-audit/playwright.webkit.config.mjs` or `m7-webkit-smoke.spec.mjs`
- Create: `docs/milestones/m7-5-acceptance.md`

- [ ] **Step 1: Add Chromium RED flow**

Automate:
1. create/open a fresh project;
2. assert guide says `Первый план`;
3. click `Начать со стены` and assert Wall mode;
4. draw first wall and assert `Контур ещё не замкнут`;
5. complete a rectangular room using current tested Canvas helpers;
6. assert `Первая комната создана` durable evidence and room-created guide;
7. wait longer than 2600 ms and assert evidence remains;
8. dismiss evidence;
9. switch/reopen project and assert no stale evidence;
10. verify compact viewport has no horizontal overflow and primary controls remain reachable.

Expected RED: selectors/components absent.

- [ ] **Step 2: Add WebKit core smoke**

Cover fresh-project guide, Wall activation, first wall progress and compact no-overflow. Reuse existing WebKit project setup patterns.

- [ ] **Step 3: Verify GREEN exact head**

Required:
- documentation contract;
- all unit tests;
- typecheck;
- lint;
- production build;
- Chromium full flow;
- WebKit core smoke;
- browser evidence upload.

- [ ] **Step 4: Record automated evidence**

Acceptance document remains `AUTOMATED PASS / PRODUCT-OWNER PENDING` until manual browser scenarios are confirmed.

- [ ] **Step 5: Commit**

`test: cover M7.5 onboarding status and recovery`

---

### Task 9: Draft PR and final implementation review

**Files:**
- Update PR body and acceptance record only; no new product behavior.

- [ ] **Step 1: Open or update Draft PR**

Title: `feat: M7.5 onboarding status and recovery`

Body must list delivered behavior, exact tested head, CI/browser runs, authority boundaries and manual acceptance scenarios.

- [ ] **Step 2: Review diff for scope**

Reject any change to schema/migrations/geometry/planning algorithms/recognition algorithms/3D authority.

- [ ] **Step 3: Verify no unresolved review threads and exact-head checks**

- [ ] **Step 4: Provide product-owner test script**

Manual scenarios:
- fresh project guide through first closed room;
- dismiss and per-project isolation;
- Undo removes room and stale evidence;
- recognition Apply success/failure evidence;
- planning Apply success/failure evidence;
- editable backup evidence after toast timeout;
- compact width and 3D/workflow hiding behavior.

- [ ] **Step 5: Keep Draft until explicit acceptance**

Do not merge before product-owner confirmation and a fresh exact-head standard/browser PASS.
