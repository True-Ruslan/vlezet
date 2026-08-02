# M7.8C Opening Classification and Host-Wall Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver deterministic door/window/unknown opening hypotheses that are attached to surviving local walls, fail closed on invalid placement, and remain editable until explicit Apply.

**Architecture:** Add a pure opening-analysis module to `packages/recognition`, integrate it into the browser-local engine only after wall extraction, harden reconciliation against host/geometry mutation, then expose evidence in the existing review UI. Benchmark and browser gates remain authoritative.

**Tech Stack:** TypeScript, Vitest, OpenCV.js, React/Next.js, Playwright, pnpm/Turborepo.

## Global Constraints

- `VlezetDocument` remains the only persistent source of truth.
- Millimetres remain canonical; recognition uses normalized source coordinates and pixel evidence only until Apply.
- AI may not create, move, resize or re-host openings.
- Unknown/ambiguous hypotheses remain pending or rejected.
- No accepted opening may have an unknown host or lie outside its host-wall span.
- Existing project schemas, migrations, IndexedDB and backup formats remain unchanged.
- Explicit Apply and semantic Undo/Redo remain unchanged.
- M2, planning and 3D authority must not regress.

---

### Task 1: Pure host-wall validation contract

**Files:**
- Create: `packages/recognition/src/opening-analysis.ts`
- Create: `packages/recognition/src/opening-analysis.test.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**
- Produces `analyzeOpeningHypotheses(input): OpeningAnalysisResult`.
- Input contains `widthPx`, `heightPx`, `wallCandidates`, `segments`, and bounded options.
- Result contains `candidates`, `rejections`, and deterministic diagnostics.

- [ ] **Step 1: Write failing tests** for valid host placement, unknown host rejection, outside-span rejection, end-margin rejection, overlap rejection and deterministic ordering.
- [ ] **Step 2: Run** `pnpm --filter @vlezet/recognition test -- opening-analysis.test.ts` and confirm RED because the module does not exist.
- [ ] **Step 3: Implement minimal pure geometry helpers** for projection, perpendicular distance, normalized-to-pixel conversion, in-span validation and overlap checks.
- [ ] **Step 4: Implement bounded gap classification** using door-angle evidence, window-cross evidence and `unknown-opening` fallback; prohibit `high` confidence.
- [ ] **Step 5: Export the contract** from `packages/recognition/src/index.ts`.
- [ ] **Step 6: Run the focused tests** and confirm PASS.
- [ ] **Step 7: Commit** `feat: add deterministic opening host validation`.

### Task 2: Local recognition engine integration

**Files:**
- Modify: `apps/web/components/recognition/local-recognition-engine.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine-source.test.ts`
- Create: `apps/web/components/recognition/local-recognition-engine-openings.test.ts`

**Interfaces:**
- Consumes `analyzeOpeningHypotheses` from Task 1.
- Produces local opening candidates only after wall candidate extraction and review-budget validation.

- [ ] **Step 1: Add RED source-contract tests** proving openings are no longer unconditionally discarded and that analysis occurs after wall extraction.
- [ ] **Step 2: Add focused runtime tests** for a valid door, valid window, ambiguous gap and invalid host.
- [ ] **Step 3: Integrate `analyzeOpeningHypotheses`** and replace the M7.8B deferred empty-array assignment.
- [ ] **Step 4: Add diagnostics** for classified, pending and rejected hypotheses without leaking raw IDs as dominant UI copy.
- [ ] **Step 5: Preserve review-budget fail-closed behavior** before Draft persistence or AI review.
- [ ] **Step 6: Run web recognition tests** and confirm PASS.
- [ ] **Step 7: Commit** `feat: enable validated local opening candidates`.

### Task 3: Reconciliation and provider immutability

**Files:**
- Modify: `packages/recognition/src/reconcile.ts`
- Modify: `packages/recognition/src/reconcile.test.ts`
- Modify: `packages/recognition/src/cloud-sanity.ts`
- Modify: `packages/recognition/src/cloud-sanity.test.ts`
- Modify: `apps/web/components/recognition/openrouter-provider.ts`
- Modify: `apps/web/components/recognition/openrouter-provider.test.ts`

**Interfaces:**
- Cloud may return confirmation/classification evidence for exact existing opening IDs.
- Local `hostWallCandidateId`, `center`, `widthPx`, and `orientationDeg` remain authoritative.

- [ ] **Step 1: Add RED tests** rejecting cloud-only openings, unknown IDs, changed host wall, moved center, changed width/orientation outside tolerance and overloaded opening responses.
- [ ] **Step 2: Harden cloud sanity normalization** to preserve only known local opening candidates.
- [ ] **Step 3: Harden reconciliation** so valid local decisions survive equivalent candidates and stale decisions are removed.
- [ ] **Step 4: Update structured-output schema/prompt** to state verification-only opening semantics.
- [ ] **Step 5: Run recognition and provider tests** and confirm PASS.
- [ ] **Step 6: Commit** `fix: keep opening geometry local-authoritative`.

### Task 4: Review UX and Apply safety

**Files:**
- Modify: `apps/web/components/recognition/recognition-panel.tsx`
- Modify: relevant recognition panel tests
- Modify: relevant Canvas recognition overlay component/tests
- Modify: recognition controller tests if bulk acceptance behavior changes

**Interfaces:**
- Shows type, host evidence, width, confidence and conflict reason.
- Bulk accept excludes `unknown-opening`, conflicts and invalid hosts.

- [ ] **Step 1: Add RED component/controller tests** for user-facing type/host evidence and safe bulk acceptance.
- [ ] **Step 2: Render classified openings** with direct Canvas highlight and non-raw host wording.
- [ ] **Step 3: Preserve editable Draft and explicit Apply**; verify one applied batch remains one semantic Undo operation.
- [ ] **Step 4: Run focused component/controller tests** and confirm PASS.
- [ ] **Step 5: Commit** `feat: review validated opening evidence`.

### Task 5: Benchmark, browser gates and canonical records

**Files:**
- Modify: `packages/recognition/benchmarks/fixtures/openings-heavy/*`
- Add/modify: service-block opening fixture files
- Modify: `packages/recognition/benchmarks/baselines/recognition-v1.json`
- Modify: benchmark acceptance tests
- Create: `docs/milestones/m7-8c-acceptance.md`
- Create: `docs/changelog/2026-08-03-m7-8c.md`
- Modify after acceptance: `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`

**Interfaces:**
- Benchmark records door/window TP/FP/FN, unknown-host count, out-of-span count, stale decisions and confidence errors.

- [ ] **Step 1: Expand RED benchmark fixtures** for doors, windows, ambiguous gaps, junctions and service blocks.
- [ ] **Step 2: Run Core and Source benchmark** and record actual baseline movement.
- [ ] **Step 3: Tune only deterministic thresholds justified by fixture evidence**; do not weaken host validation.
- [ ] **Step 4: Require door/window F1 `>= 0.85`, unknown-host `0`, out-of-span `0`, stale decisions `0`, incorrect high-confidence `0` before acceptance.
- [ ] **Step 5: Run** unit tests, typecheck, lint, production build, Recognition Benchmark and Chromium/WebKit browser audit.
- [ ] **Step 6: Open Draft PR** with exact-head evidence and product-owner checklist.
- [ ] **Step 7: After product-owner acceptance**, finalize milestone records and protected squash merge.
