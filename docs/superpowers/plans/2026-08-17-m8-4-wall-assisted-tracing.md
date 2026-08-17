# M8.4 Wall Assisted Tracing — Implementation Plan

> **Execution rule:** follow strict RED → GREEN → REFACTOR. Do not change production behavior before the corresponding failing test has been observed. Preserve exact-head CI evidence after every material behavior change.

**Goal:** add an optional wall-only source-image assist to the ordinary wall tool, reusing M8.3 transforms/features/snap resolution while preserving topology authority and existing manual behavior.

**Architecture:** one shared reference-side source-assist resolver maps world→source with `worldPointToImage()`, consumes M8.3 deterministic source features/snap semantics, and maps source→world with `imagePointToWorld()`. A pure editor-side precedence helper chooses topology > source assist > construction/grid fallback. UI state is ephemeral and defaults Off. No persistence/schema/AI/network change.

**Stack:** TypeScript 6, React 19, Next.js 16, Zustand, Konva, Vitest, Playwright/GitHub Browser Acceptance.

**Branch:** `feat/m8-4-wall-assisted-tracing`

---

## Task 1 — Contract RED: reference source-assist resolver

**Files:**
- Create: `apps/web/components/reference/reference-source-assist.test.ts`
- Then create: `apps/web/components/reference/reference-source-assist.ts`

### RED

Add focused tests defining:

1. acquired line-centre/intersection returns the M8.3 source point mapped through `imagePointToWorld()`;
2. raw world point is mapped through `worldPointToImage()` for source comparison, including non-zero reference rotation;
3. `viewportScale = pixelsPerMillimeter * millimetersPerPixel` is respected by acquisition distance;
4. ambiguous candidates abstain;
5. weak candidates abstain;
6. enabled=false returns disabled/no mutation;
7. suppressed=true returns suppressed/no mutation;
8. point outside source bounds returns `outside-reference` without acquisition;
9. active candidate remains acquired through release radius (hysteresis);
10. repeated identical input is deterministic.

Commit the tests only and verify CI fails for the missing provider contract. The failure must be attributable to the new contract, while unrelated tests remain healthy.

### GREEN

Implement the smallest pure resolver in `reference-source-assist.ts` by composing:

- `worldPointToImage()`;
- `resolveCalibrationSnap()`;
- `imagePointToWorld()`.

Do not duplicate rotation/origin/scale math.

Suggested public result:

```ts
type ReferenceSourceAssistReason =
  | "acquired"
  | "ambiguous"
  | "none"
  | "disabled"
  | "suppressed"
  | "outside-reference";

type ReferenceSourceAssistResult = Readonly<{
  acquired: boolean;
  candidateId: string | null;
  kind: CalibrationSourceFeatureKind | "none";
  sourcePoint: Point2;
  worldPoint: Point2;
  reason: ReferenceSourceAssistReason;
}>;
```

Use conservative constants at the caller boundary; keep the resolver configurable/testable.

### Verify

Run/observe:

```bash
pnpm --filter web test -- reference-source-assist.test.ts
pnpm --filter web typecheck
```

Then full CI if branch PR is already open.

---

## Task 2 — Contract RED: structural/source precedence

**Files:**
- Create: `apps/web/components/editor/wall-pointer-assist.test.ts`
- Then create: `apps/web/components/editor/wall-pointer-assist.ts`

### RED

Define a pure composition contract taking:

- ordinary `StructuralSnapResult`;
- optional `ReferenceSourceAssistResult`.

Tests must prove:

1. endpoint beats source assist;
2. junction beats source assist;
3. midpoint beats source assist;
4. intersection beats source assist;
5. wall-axis beats source assist;
6. acquired source assist beats grid;
7. acquired source assist beats horizontal/vertical;
8. acquired source assist beats parallel/perpendicular;
9. ambiguous/none/disabled/suppressed/outside source result returns the exact structural result unchanged;
10. source result never creates a topology target.

### GREEN

Implement a tiny pure helper. Do not modify `resolveStructuralSnap()` priorities globally.

This helper is the explicit authority boundary and prevents the `grid`-always-present behavior from making image assistance unreachable.

### Verify

```bash
pnpm --filter web test -- wall-pointer-assist.test.ts
```

---

## Task 3 — Contract RED: runtime setting defaults Off

**Files:**
- Create: `apps/web/components/editor/source-assist-settings-store.test.ts`
- Then create: `apps/web/components/editor/source-assist-settings-store.ts`

### RED

Test:

- initial state is `enabled: false`;
- toggle/set operations are deterministic;
- state is runtime-only (no project type/schema dependency/import).

### GREEN

Implement the smallest Zustand store, mirroring the style of structural snapping settings without adding persistence.

### Verify

```bash
pnpm --filter web test -- source-assist-settings-store.test.ts
```

---

## Task 4 — Contract RED: toolbar control

**Files:**
- Modify: `apps/web/components/editor/structural-snapping-toolbar.test.tsx` or add `source-assist-toolbar.test.tsx`
- Modify: `apps/web/components/editor/editor-toolbar.tsx`

### RED

Render `EditorToolBarView` and assert:

- visible `По подложке` control when a reference exists;
- default/prop Off has `aria-pressed="false"`;
- enabled has `aria-pressed="true"`;
- no reference disables the control;
- 3D/editing-disabled state disables it;
- existing `Привязки` contract remains unchanged.

### GREEN

Extend toolbar props with source-assist state/toggle. Wire `EditorToolbar` to `sourceAssistSettingsStore`.

Do not add project persistence.

### Verify

```bash
pnpm --filter web test -- structural-snapping-toolbar.test.tsx source-assist-toolbar.test.tsx
```

---

## Task 5 — Contract RED: bounded image feature acquisition adapter

**Files:**
- Create: `apps/web/components/reference/wall-source-feature-reader.test.ts`
- Create: `apps/web/components/reference/wall-source-feature-reader.ts`

### RED

Specify a narrow adapter around existing `readCalibrationFeaturesFromImage()` with the M8.3 thresholds already used by precision calibration unless evidence justifies stricter values.

Tests with generated pixel fixtures must prove:

- a strong narrow wall line yields deterministic line-centre/edge features;
- empty/weak patch produces no eligible high-confidence acquisition;
- source dimensions are respected;
- canvas read error is surfaced to caller so editor can fail closed;
- no network/global recognition module is involved.

### GREEN

Reuse `readCalibrationFeaturesFromImage()`; do not fork its image-analysis implementation.

Start with the accepted M8.3 feature policy:

- radius 20 source px;
- contrast threshold 60;
- darkness threshold 120;
- maximum line width 6 px.

Source-assist resolver minimum strength should remain conservative and explicit in one place. If real fixture/browser evidence shows a threshold issue, change it only with focused tests.

---

## Task 6 — Contract RED: wall draft integration without behavior drift

**Files:**
- Add focused pure/controller test such as `apps/web/components/editor/wall-source-assist-controller.test.ts`
- Create: `apps/web/components/editor/wall-source-assist-controller.ts`
- Modify later: `apps/web/components/editor/editor-canvas.tsx`

### RED

Model the wall pointer decision without Konva first. Required tests:

- assistance Off: ordinary structural result passes through unchanged;
- missing/hidden reference: ordinary structural result passes through unchanged;
- topology structural result wins and source reader is not authoritative;
- source acquisition replaces only construction/grid fallback;
- source abstention preserves ordinary structural result exactly;
- Alt/Option suppression preserves ordinary behavior;
- source feature read exception preserves ordinary behavior;
- active source candidate id is carried for hysteresis;
- reference revision change clears active source candidate;
- dynamic exact input remains applied after pointer-assist resolution.

### GREEN

Implement controller functions with dependency injection for feature reading/resolution where useful. Keep image-analysis errors local and fail closed.

Then wire `EditorCanvas` minimally:

- read source-assist setting;
- maintain ephemeral active source assist state/id;
- compute ordinary structural result first;
- query source only when wall draft + enabled + visible reference + decoded image + !Alt;
- combine through `wall-pointer-assist.ts`;
- pass the resulting point through existing dynamic-input path;
- clear source state on tool/reference/revision/toggle changes.

Do not change `commitDraftWall()` or document schema in this slice.

### Verify

Focused unit suite, then:

```bash
pnpm --filter web test
pnpm typecheck
pnpm lint
```

---

## Task 7 — Contract RED: visible ephemeral source feedback

**Files:**
- Create: `apps/web/components/editor/source-assist-overlay.test.tsx`
- Create: `apps/web/components/editor/source-assist-overlay.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx`

### RED

Test presentation contract:

- acquired state visibly says `По подложке`;
- overlay is absent when not acquired;
- presentation receives screen/world point from existing viewport transform, not a new source/world formula;
- pointer events are disabled for overlay so it cannot steal editor input.

### GREEN

Render a small ephemeral marker/label only for the active acquired source candidate. Keep it out of document/export authority.

---

## Task 8 — Regression proof: wall semantic history

**Files:**
- Prefer existing editor-store/history tests; add `apps/web/components/editor/wall-assisted-history.test.ts` only if no focused existing location fits.

### RED/GREEN expectation

No production history change should be necessary. Add regression proving:

- one source-assisted wall commit adds exactly one history command;
- one Undo removes the wall;
- one Redo restores it;
- no source-assist metadata appears in `VlezetDocument`.

If this test fails, fix integration rather than adding a new history mechanism.

---

## Task 9 — Browser acceptance RED then GREEN

**Files:**
- Add/modify Playwright acceptance spec under the existing browser acceptance suite.
- Add deterministic generated reference fixture only if current reference fixture cannot express a strong source line.

### Acceptance flow

1. create/open project;
2. import deterministic reference image;
3. calibrate and save reference;
4. choose Wall;
5. verify `По подложке` starts Off;
6. enable it;
7. move/click near a strong reference line and observe acquired assist feedback;
8. commit wall and verify its endpoint follows source evidence within deterministic tolerance;
9. start a connected wall near existing topology and verify topology wins;
10. hold Alt/Option and prove source assist is suppressed;
11. turn assistance Off and prove ordinary wall behavior;
12. Undo/Redo wall edits;
13. assert no uncaught page/runtime/console error;
14. assert no network request is required for source assistance.

First run must be allowed to fail for the missing browser/UI behavior before the final UI wiring is treated as complete.

Run Chromium full acceptance and representative WebKit with workers=1 and retries=0 through the repository workflow.

---

## Task 10 — Full exact-head verification

On one immutable head require:

```text
Project documentation contract    PASS
Unit tests                        PASS
Coverage                          PASS
Testing Policy                    PASS
Core Recognition Benchmark        PASS
Typecheck                         PASS
Lint                              PASS
Build                             PASS
Browser Chromium                  PASS
Browser representative WebKit     PASS
CodeQL                            PASS
```

No gate from an older SHA may be combined with a newer head.

If changed-production coverage fails, add honest behavioral coverage. Never lower thresholds or exclude the code.

---

## Task 11 — Canonical technical-state sync

**Files:**
- `docs/PROJECT_STATE.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`
- focused M8.4 changelog/technical record
- issue #51 / PR body

Only after technical GREEN, record:

- exact head SHA;
- exact CI/browser/CodeQL run numbers;
- tested scope and known non-goals;
- `implemented + automated technical gates GREEN / Product Owner acceptance pending / NOT MERGED`.

Do not mark M8.4 wall slice accepted until the Product Owner tests the real reference-plan journey.

---

## Task 12 — Product Owner acceptance and protected integration

After automated GREEN, provide a short deterministic real-plan checklist focused on:

- strong source wall acquisition;
- ambiguous/weak source abstention;
- topology precedence;
- Alt suppression;
- Off behavior;
- Undo/Redo.

Only after Product Owner PASS:

1. sync canonical acceptance truth;
2. rerun exact-head gates;
3. mark PR ready;
4. protected squash-merge the verified exact head;
5. capture actual merge SHA;
6. verify post-merge `main` CI + CodeQL;
7. close the wall-only sub-slice;
8. begin hosted door/window design using the same provider.

## Guardrails

- No full-plan recognition resurrection.
- No AI/network dependency.
- No project schema/persistence field for assist state.
- No duplicate source/world transform.
- No global `resolveStructuralSnap()` priority change solely to fit M8.4.
- No source result may create or claim an existing topology target.
- No silent committed-geometry mutation.
- No retry/skip/fixme/coverage-policy weakening.
