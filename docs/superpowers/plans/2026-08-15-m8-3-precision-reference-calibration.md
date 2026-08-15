# M8.3 Precision Reference Calibration — Implementation Plan

**Date:** 2026-08-15  
**Design:** `docs/superpowers/specs/2026-08-15-m8-3-precision-reference-calibration-design.md`  
**Tracker:** #57  
**Branch:** `feat/m8-3-precision-reference-calibration`

## Delivery rule

Every behavior slice follows:

```text
contract → genuine RED → verify intended failure → minimal implementation → focused GREEN → adjacent/full regression
```

No step may weaken testing-policy thresholds, skip/fixme browser coverage, introduce retries, add a persistence schema migration or substitute AI/network inference for deterministic calibration.

## Task 1 — Independent verification math

**Files:**

- modify `packages/geometry/src/reference-plan.test.ts`
- modify `packages/geometry/src/reference-plan.ts`
- export from geometry package if required

### RED

Add tests for a pure verification function using primary calibration scale plus an independent known segment:

- exact agreement;
- signed residual;
- relative error;
- 1% + 20 mm combined warning boundary;
- short-segment relative deviation below absolute 20 mm does not over-warn;
- degenerate verification segment rejects;
- invalid known length rejects.

Run the focused geometry tests and record intended missing-symbol/failing-contract RED.

### GREEN

Implement the smallest pure geometry API, e.g.:

```ts
verifyReferenceCalibration({
  primary,
  verificationPointA,
  verificationPointB,
  verificationKnownLengthMm,
})
```

Return explainable evidence only; do not mutate or average the primary transform.

Run focused geometry tests, package tests and coverage policy.

## Task 2 — Pan/zoom viewport transform and nudge primitives

**Files:**

- modify `apps/web/components/reference/calibration-viewport.test.ts`
- modify `apps/web/components/reference/calibration-viewport.ts`

### RED

Specify:

- fit-to-viewport state;
- image↔container round-trip under pan/zoom;
- pointer-anchored zoom invariance;
- pan delta;
- zoom clamp;
- 1 px / 10 px image-space nudge;
- raster-bound clamp.

### GREEN

Add an explicit `CalibrationViewportTransform` instead of deriving all behavior from current DOM rects. Keep the current no-pan/no-zoom conversion functions compatible where practical.

No project/history mutation.

## Task 3 — Deterministic source-feature vocabulary and snap resolver

**Files:**

- create `apps/web/components/reference/calibration-snap.test.ts`
- create `apps/web/components/reference/calibration-snap.ts`

### RED

Use synthetic candidate fixtures to prove:

- screen-space acquisition radius mapped through zoom;
- deterministic priority `intersection > line-center > edge` when distances are equivalent;
- nearest candidate otherwise wins;
- hysteresis release radius;
- ambiguous materially equivalent candidates abstain;
- disabled/gesture-suppressed snap returns the raw source point.

### GREEN

Implement a pure resolver independent of React/DOM.

## Task 4 — Deterministic raster feature extraction

**Files:**

- create `apps/web/components/reference/calibration-features.test.ts`
- create `apps/web/components/reference/calibration-features.ts`

### RED

Synthetic `ImageData`-like grayscale fixtures:

- isolated high-contrast edge;
- parallel dark edges produce stable line centre;
- perpendicular line centres produce intersection;
- faint/noisy evidence below threshold abstains;
- image borders remain safe;
- deterministic identical input → identical features/order.

### GREEN

Implement a bounded local raster analyser around the pointer/viewport, not whole-plan recognition.

Constraints:

- local-only deterministic processing;
- no OpenCV/AI/network dependency unless later evidence proves necessary;
- bounded work per pointer update;
- feature points expressed only in natural-image coordinates.

## Task 5 — Calibration UI navigation + precision controls

**Files:**

- modify `apps/web/components/reference/reference-panel.tsx`
- modify relevant reference CSS
- extend unit/component contracts if present

### RED

Add browser-visible contract tests before production behavior for:

- Fit / pan / pointer-centred zoom;
- focusable endpoint controls;
- keyboard nudge;
- stronger crosshair/magnifier coordinates;
- visible source snap state;
- Alt/Option temporary suppression.

### GREEN

Wire the pure viewport/snap primitives into `CalibrationStage`.

Gesture ownership:

- handle drag owns endpoint movement;
- Space/middle drag owns pan;
- wheel owns pan or modified zoom;
- no gesture performs both navigation and point placement.

## Task 6 — Second known-distance verification UI

**Files:**

- extend `reference-import-machine.ts` + tests if state belongs in reducer
- modify `reference-panel.tsx`
- use Task 1 geometry evidence

### RED

Specify state transitions:

- primary only → `not-verified`;
- valid second segment → `verified`;
- inconsistent second segment → `warning`;
- changing primary points/length invalidates stale verification evidence;
- changing verification points/length recomputes evidence;
- warning save requires explicit session acknowledgement;
- acknowledgement clears when calibration inputs change.

### GREEN

Keep verification evidence ephemeral. Do not change `ReferencePlan` persistence shape.

UI copy must report both mm and percent residual and explain that disagreement can mean endpoint error or source distortion.

## Task 7 — Browser acceptance

**Files:**

- create `tools/m7-browser-audit/m8-reference-calibration.spec.mjs` or extend the existing calibration spec only if focused ownership remains clear
- register representative WebKit spec according to testing policy

### Genuine browser RED

Use a deterministic high-contrast reference fixture and real pointer/keyboard events to prove at least:

1. pan/zoom preserves natural-image endpoint coordinates;
2. pointer zoom keeps source point under cursor;
3. endpoint keyboard nudge works;
4. intersection/source-line snap visibly acquires;
5. Alt/Option suppression leaves raw pointer point;
6. exact second distance is verified;
7. inconsistent second distance warns;
8. warning cannot save until explicit acknowledgement;
9. saved reference persists through actual IndexedDB and reload;
10. no pageerror/console.error.

The initial commit containing these assertions must fail for intended missing behavior.

### GREEN

Run:

- focused Chromium;
- representative WebKit;
- full automatic Chromium discovery;
- registered WebKit suite;
- workers=1 / retries=0.

## Task 8 — Coverage and policy gate

Because geometry authority is touched, changed critical geometry code must meet the current critical thresholds:

```text
lines = 100%
statements = 100%
functions = 100%
branches >= 95%
```

Web production changes must meet ordinary changed-code thresholds unless testing-policy classification promotes them.

Run:

```bash
pnpm test:policy
pnpm coverage
pnpm verify:policy
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Do not ratchet the baseline until final stable measured runs agree.

## Task 9 — Focused changelog and product-owner gate

Create:

- `docs/changelog/2026-08-15-m8-3-precision-reference-calibration.md`

Record:

- design/authority decision;
- mature-product research and copied-code status;
- every meaningful RED/GREEN checkpoint;
- browser evidence/artifact digest;
- coverage result;
- real defects found;
- intentional limitations (no perspective rectification/OCR/AI);
- exact-head CI + Browser + CodeQL;
- product-owner acceptance only after it actually occurs.

M8.3 remains Draft/not accepted until explicit user confirmation.

## Task 10 — Protected integration

After explicit acceptance:

1. canonical `PROJECT_STATE` / `ROADMAP` / `CHANGELOG` truth sync;
2. fresh exact-head CI + Chromium/WebKit + CodeQL;
3. mark PR Ready;
4. protected squash merge with expected-head protection;
5. post-merge CI + CodeQL verification;
6. only then unblock M8.4 Assisted Tracing.
