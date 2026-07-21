# M4.5 Assisted Recognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe hybrid assisted floor-plan recognition: local browser CV creates a persistent editable draft, optional OpenRouter BYOK refines it, deterministic validation converts only user-approved suggestions into normal Vlezet geometry in one undoable operation.

**Architecture:** `@vlezet/recognition` owns framework-independent candidate models, post-processing, reconciliation, validation and apply planning. Browser adapters own IndexedDB, Web Worker/OpenCV.js, HTTP and secrets. Recognition drafts remain separate from `VlezetDocument`; coordinates are normalized `[0,1]` reference-image coordinates and are projected into millimetres only at validation/apply time.

**Tech Stack:** TypeScript 6, Vitest, Zustand, React 19, Konva/react-konva, IndexedDB, Web Workers, `@techstark/opencv-js@5.0.0-release.1`, OpenRouter Chat Completions with image input and strict JSON Schema structured output.

## Global Constraints

- Candidate normalized coordinates are finite numbers in the inclusive range `[0,1]`.
- Recognition never directly mutates `VlezetDocument`; only `ApplyRecognitionDraft` may commit approved validated results.
- Existing apartment geometry is never silently replaced.
- Local recognition never uploads the reference raster.
- OpenRouter use is explicit opt-in; API keys live only in runtime memory and never enter IndexedDB, project JSON, logs, URL state or backups.
- Recognition sessions are not included in `.vlezet.json`; importing a project starts with no recognition session.
- A reference raster replacement or metric recalibration invalidates the session; display-only movement/rotation/opacity/visibility does not.
- Applying a recognition batch is exactly one history entry and one Undo removes the whole batch.
- `@vlezet/recognition` must not depend on React, Konva, Next.js, IndexedDB, fetch, Blob, Worker or OpenCV.js.
- Cloud providers must normalize their external coordinate representation into the canonical `[0,1]` contract before returning core results.

---

## File map

### New package

- `packages/recognition/package.json` — workspace package metadata.
- `packages/recognition/tsconfig.json` — TypeScript config.
- `packages/recognition/src/model.ts` — canonical recognition types and runtime validation.
- `packages/recognition/src/local-lines.ts` — pure raw-line post-processing and wall candidate building.
- `packages/recognition/src/openings.ts` — opening hypotheses from wall/gap evidence.
- `packages/recognition/src/reconcile.ts` — local/cloud/existing-geometry reconciliation.
- `packages/recognition/src/project.ts` — reference-image/world transforms and deterministic apply planning.
- `packages/recognition/src/provider.ts` — provider-neutral contracts and cloud result validation.
- `packages/recognition/src/index.ts` — public API only.

### Persistence

- `packages/projects/src/indexeddb-schema.ts` — shared IndexedDB name/version/store constants.
- `packages/projects/src/indexeddb.ts` — migrate DB version to 3 and create `recognitionSessions` store without importing recognition types.
- `apps/web/components/recognition/session-repository.ts` — typed browser adapter implementing `RecognitionSessionRepository` over the shared store.

### Browser local recognition

- `apps/web/components/recognition/local-recognition-types.ts` — worker request/progress/result protocol.
- `apps/web/components/recognition/recognition.worker.ts` — OpenCV.js raster preprocessing, Canny/Hough extraction, transfer to pure core algorithms.
- `apps/web/components/recognition/local-recognition-client.ts` — worker lifecycle, cancellation and progress adapter.

### Review/apply UI

- `apps/web/components/recognition/recognition-controller.ts` — session lifecycle orchestration.
- `apps/web/components/recognition/recognition-panel.tsx` — start/progress/summary/filter/accept/reject/apply/cloud controls.
- `apps/web/components/recognition/recognition-layer.tsx` — Konva overlay for candidates and endpoint editing.
- `apps/web/components/editor/editor-canvas.tsx` — mount recognition overlay below transient editor guides and above reference image.
- `apps/web/components/editor/apartment-editor.tsx` — compose review mode and side panel.
- `apps/web/components/projects/project-app.tsx` — repository ownership, reference revision invalidation, session restore, apply lifecycle.
- `apps/web/components/editor/use-editor-store.ts` — one semantic batch-document apply action.

### OpenRouter

- `apps/web/components/recognition/openrouter-provider.ts` — model discovery/filtering and strict structured-output request.
- `apps/web/components/recognition/openrouter-schema.ts` — JSON Schema and request/response normalization.
- `apps/web/components/recognition/cloud-dialog.tsx` — ephemeral BYOK key/model UI.

### Documentation/tests

- Focused `*.test.ts` files next to pure modules.
- `docs/milestones/m4-5-acceptance.md` — browser acceptance.
- `README.md` — capability/privacy/roadmap update.

---

### Task 1: Recognition core package and canonical model

**Files:**
- Create: `packages/recognition/package.json`
- Create: `packages/recognition/tsconfig.json`
- Create: `packages/recognition/src/model.ts`
- Create: `packages/recognition/src/model.test.ts`
- Create: `packages/recognition/src/index.ts`

**Interfaces:**
- Produces `NormalizedPoint`, `RecognitionWallCandidate`, `RecognitionOpeningCandidate`, `RecognitionRoomLabelCandidate`, `RecognitionDraft`, `RecognitionSessionRecord`, `RecognitionDecision`, `validateRecognitionDraft`, `validateRecognitionSession`.

- [ ] **Step 1: Write RED tests for normalized coordinates and draft validation**

Test exact invariants: `0` and `1` accepted; negative, >1, NaN and Infinity rejected; empty IDs rejected; decision IDs must refer to known candidates; `referenceRevision` required.

```ts
expect(validateNormalizedPoint({ x: 0, y: 1 })).toEqual({ x: 0, y: 1 });
expect(() => validateNormalizedPoint({ x: 1.01, y: 0 })).toThrow();
expect(() => validateRecognitionDraft({ ...fixture, decisions: { ghost: "accepted" } })).toThrow();
```

- [ ] **Step 2: Run package tests and verify RED**

Run: `pnpm --filter @vlezet/recognition test`
Expected: package/module or exported validators missing.

- [ ] **Step 3: Implement immutable model + runtime validators**

Canonical types use `[0,1]`; confidence is `high|medium|low`; origin is `local|cloud|merged`; decisions are `pending|accepted|rejected|edited`; session includes `projectId`, `referenceAssetId`, `referenceRevision`, `engineVersion`, timestamps and optional non-secret cloud metadata.

- [ ] **Step 4: Run tests/typecheck GREEN**

Run: `pnpm --filter @vlezet/recognition test && pnpm --filter @vlezet/recognition typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add recognition core model"`

---

### Task 2: Recognition session persistence and reference revision contract

**Files:**
- Create: `packages/projects/src/indexeddb-schema.ts`
- Modify: `packages/projects/src/indexeddb.ts`
- Modify: `packages/projects/src/index.ts`
- Modify: `packages/projects/src/project.ts`
- Test: `packages/projects/src/project.test.ts`
- Create: `apps/web/components/recognition/session-repository.ts`
- Create: `apps/web/components/recognition/session-repository.test.ts`

**Interfaces:**
- Produces shared DB constants with database version `3` and store `recognitionSessions`.
- Produces `referenceRevision: string` in `ReferencePlan`.
- Produces `RecognitionSessionRepository` methods `getForProject`, `put`, `deleteForProject` in web adapter.

- [ ] **Step 1: RED tests for reference revision semantics**

Assert new reference installation has a revision; display-only changes preserve it; raster replacement and recalibration receive a new revision through service inputs.

- [ ] **Step 2: RED fake-indexeddb-style repository tests using a minimal in-memory IDB test double already compatible with project tests**

Cover put/get/delete and stale predicate `session.referenceAssetId !== project.referencePlan.assetId || session.referenceRevision !== project.referencePlan.referenceRevision`.

- [ ] **Step 3: Implement schema constants and DB v3 upgrade**

`indexeddb.ts` must create the new store in `onupgradeneeded` while keeping projects/settings/assets intact. Project deletion does not need to import recognition types; `ProjectApp` will explicitly delete the session through the recognition repository.

- [ ] **Step 4: Extend `ReferencePlan` with `referenceRevision` and backward-compatible validation**

Old M4 project data without the field receives a deterministic legacy revision derived from immutable calibration/raster identity fields during validation/migration; new installs use `crypto.randomUUID()` supplied by the web service boundary.

- [ ] **Step 5: Implement web session repository**

Persist validated recognition session JSON only. Reject secret-like fields (`apiKey`, `authorization`) defensively before writing.

- [ ] **Step 6: Run tests/typecheck GREEN**

Run: `pnpm --filter @vlezet/projects test && pnpm --filter @vlezet/projects typecheck && pnpm --filter web test`
Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -m "feat: persist recognition sessions safely"`

---

### Task 3: Pure local wall post-processing

**Files:**
- Create: `packages/recognition/src/local-lines.ts`
- Create: `packages/recognition/src/local-lines.test.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**
- Consumes raw image-space `DetectedLineSegment {x1,y1,x2,y2}` plus image dimensions.
- Produces `buildWallCandidates(input): RecognitionWallCandidate[]`.

- [ ] **Step 1: RED fixture tests**

Use synthetic line fixtures for: paired parallel wall edges -> one centerline; collinear fragments -> merged candidate; short isolated dimension marks -> rejected; nearly horizontal line -> canonicalized; confidence high only when parallel-pair + junction evidence exists.

- [ ] **Step 2: Implement deterministic geometry helpers**

Normalize angle modulo 180°, compute segment projection/overlap, pair near-parallel edges by configurable pixel distance, merge collinear centerlines, clamp final normalized endpoints to `[0,1]`.

- [ ] **Step 3: Keep thresholds explicit and versioned**

Export `LOCAL_RECOGNITION_ENGINE_VERSION = "1"` and one `DEFAULT_LOCAL_RECOGNITION_OPTIONS` object. No magic numbers inside loops.

- [ ] **Step 4: Run tests/typecheck GREEN**

Run: `pnpm --filter @vlezet/recognition test && pnpm --filter @vlezet/recognition typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: derive wall candidates from line evidence"`

---

### Task 4: OpenCV Web Worker and local recognition client

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/next.config.ts` only if browser bundling requires Node builtin fallbacks
- Create: `apps/web/components/recognition/local-recognition-types.ts`
- Create: `apps/web/components/recognition/recognition.worker.ts`
- Create: `apps/web/components/recognition/local-recognition-client.ts`
- Create: `apps/web/components/recognition/local-recognition-client.test.ts`

**Interfaces:**
- `runLocalRecognition({ imageData, projectId, referenceAssetId, referenceRevision }, { signal, onProgress }): Promise<RecognitionDraft>`.

- [ ] **Step 1: Add exact OpenCV dependency**

Add `@techstark/opencv-js: "5.0.0-release.1"` to web dependencies and regenerate lockfile.

- [ ] **Step 2: RED client protocol tests**

Test progress propagation, worker error normalization, cancellation terminates worker, and successful result is runtime-validated before returning.

- [ ] **Step 3: Implement worker protocol**

Worker phases: `prepare`, `edges`, `lines`, `walls`, `openings`, `complete`. Use grayscale -> Gaussian blur -> Canny -> `HoughLinesP`; copy raw line endpoints into plain arrays; immediately delete every OpenCV `Mat` in `finally`.

- [ ] **Step 4: Pass line segments to pure core**

Worker must not implement merge/confidence logic itself; call `buildWallCandidates` from `@vlezet/recognition`.

- [ ] **Step 5: Run web tests/typecheck/build**

Run: `pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web build`
Expected: PASS with worker chunk emitted and no server-side OpenCV evaluation.

- [ ] **Step 6: Commit**

`git commit -m "feat: run local plan recognition in worker"`

---

### Task 5: Recognition review session lifecycle and UI

**Files:**
- Create: `apps/web/components/recognition/recognition-controller.ts`
- Create: `apps/web/components/recognition/recognition-controller.test.ts`
- Create: `apps/web/components/recognition/recognition-panel.tsx`
- Create: `apps/web/components/recognition/recognition-layer.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/projects/project-app.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Controller states: `idle|running-local|review|running-cloud|error`.
- Draft edits always persist through `RecognitionSessionRepository` and never touch editor history.

- [ ] **Step 1: RED controller tests**

Cover start local -> progress -> persistent review; reload restore; stale session ignored with explicit status; accept/reject/edit candidate persists; discard deletes session; local failure preserves existing session.

- [ ] **Step 2: Implement controller as explicit state machine**

Keep worker/HTTP side effects injected for tests. No React state machine logic hidden in JSX callbacks.

- [ ] **Step 3: Implement review panel**

Show counts by walls/openings/confidence/conflicts; filters; candidate detail; `Принять`, `Отклонить`, `Принять уверенные`, `Проверить с AI`, `Применить выбранное`, `Закрыть`, `Удалить черновик`.

- [ ] **Step 4: Implement Konva recognition overlay**

Render candidates using review semantics; selected wall endpoints draggable in normalized image space. Convert screen/world pointer back through `ReferencePlan` transform and then to normalized source coordinates.

- [ ] **Step 5: Integrate project lifecycle**

Restore session after project open; delete session when project deleted; mark stale when reference revision changes; do not include session in project export/import/duplicate.

- [ ] **Step 6: Run tests/typecheck/build GREEN**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -m "feat: add recognition review workflow"`

---

### Task 6: Deterministic apply planning and one-step undo

**Files:**
- Create: `packages/recognition/src/project.ts`
- Create: `packages/recognition/src/project.test.ts`
- Modify: `packages/recognition/src/index.ts`
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify: `apps/web/components/editor/use-editor-store.test.ts`
- Modify: `apps/web/components/recognition/recognition-controller.ts`

**Interfaces:**
- `planRecognitionApply({ draft, referencePlan, document, idFactory }): RecognitionApplyPlan`.
- Editor store action `applyRecognitionDocument(after: VlezetDocument): void` commits label `recognition/apply` through one `document/replace` command.

- [ ] **Step 1: RED transform tests**

Verify normalized image endpoints -> calibrated pixel coordinates -> world millimetres under translation/rotation/scale.

- [ ] **Step 2: RED safety tests**

Duplicate existing walls omitted; near-conflicting walls reported and not applied; invalid/zero-length candidates rejected; only accepted/edited decisions eligible.

- [ ] **Step 3: Implement apply planner using normal domain/editor-core wall operations**

Do not manually manufacture invalid topology. Build the candidate document sequentially with existing topological wall operations and return diagnostics for candidates that cannot be safely added.

- [ ] **Step 4: Add one editor-store batch apply action**

The before/after document pair is one `executeCommand` call. Test Undo restores byte-equivalent pre-apply document and Redo reapplies the batch.

- [ ] **Step 5: Run recognition/editor tests GREEN**

Run: `pnpm --filter @vlezet/recognition test && pnpm --filter @vlezet/editor-core test && pnpm --filter web test`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: apply recognition as one safe command"`

---

### Task 7: Opening hypotheses and host-wall validation

**Files:**
- Create: `packages/recognition/src/openings.ts`
- Create: `packages/recognition/src/openings.test.ts`
- Modify: `packages/recognition/src/project.ts`
- Modify: `packages/recognition/src/index.ts`
- Modify: `apps/web/components/recognition/recognition.worker.ts`
- Modify: `apps/web/components/recognition/recognition-panel.tsx`
- Modify: `apps/web/components/recognition/recognition-layer.tsx`

**Interfaces:**
- `buildOpeningHypotheses({ wallCandidates, lineSegments, imageSize }): RecognitionOpeningCandidate[]`.

- [ ] **Step 1: RED synthetic tests**

Wall gap aligned on same centerline -> unknown opening candidate; arc-like evidence upgrades to door medium/high; paired short cross-lines may suggest window; unsupported isolated gaps remain low confidence.

- [ ] **Step 2: Implement conservative hypotheses**

Prefer false negatives to false authoritative positives. No opening can be high-confidence without a host-wall candidate and bounded width evidence.

- [ ] **Step 3: Add apply host matching**

After wall application, project accepted openings onto the resulting semantic host wall, use existing opening placement validation, and reject overlaps/T-junction conflicts visibly.

- [ ] **Step 4: Add review reclassification**

Allow `door|window|unknown-opening`; `unknown-opening` cannot be applied until user reclassifies or cloud reconciliation supplies a supported kind.

- [ ] **Step 5: Run tests GREEN and commit**

Run: `pnpm --filter @vlezet/recognition test && pnpm --filter web test && pnpm typecheck`
Commit: `git commit -m "feat: recognize and review opening hypotheses"`

---

### Task 8: Provider-neutral cloud contracts and OpenRouter BYOK

**Files:**
- Create: `packages/recognition/src/provider.ts`
- Create: `packages/recognition/src/provider.test.ts`
- Modify: `packages/recognition/src/index.ts`
- Create: `apps/web/components/recognition/openrouter-schema.ts`
- Create: `apps/web/components/recognition/openrouter-provider.ts`
- Create: `apps/web/components/recognition/openrouter-provider.test.ts`
- Create: `apps/web/components/recognition/cloud-dialog.tsx`

**Interfaces:**
- `RecognitionProvider.recognize(input, signal)` returns validated provider-neutral candidates.
- `listCompatibleOpenRouterModels(apiKey, signal)` returns models with image input and structured-output capability.

- [ ] **Step 1: RED core provider schema tests**

Reject out-of-range coordinates, unsupported kinds, missing required fields and non-finite values before reconciliation.

- [ ] **Step 2: RED OpenRouter request tests with injected fetch**

Assert Authorization bearer key is request-only; endpoint is `/api/v1/chat/completions`; message contains text first then base64 image input; `response_format.type` is `json_schema`; schema uses `strict: true`; provider preferences require supported parameters; abort propagates.

- [ ] **Step 3: Implement model discovery**

Call `/api/v1/models`; filter `architecture.input_modalities` containing `image` and `supported_parameters` containing structured-output/response-format capability. Do not hard-code one permanent model ID.

- [ ] **Step 4: Implement strict recognition schema**

Coordinates are integers `0..10000` externally for model ergonomics; adapter divides by `10000`, validates `[0,1]`, and returns canonical core types. Model may suggest walls/openings/roomLabels only.

- [ ] **Step 5: Implement ephemeral BYOK dialog**

Key stays in component/controller memory only; password input; explicit privacy notice before send; clear key when dialog/controller unmounts or project changes.

- [ ] **Step 6: Run tests/typecheck GREEN and commit**

Run: `pnpm --filter @vlezet/recognition test && pnpm --filter web test && pnpm typecheck`
Commit: `git commit -m "feat: add OpenRouter BYOK recognition provider"`

---

### Task 9: Hybrid reconciliation

**Files:**
- Create: `packages/recognition/src/reconcile.ts`
- Create: `packages/recognition/src/reconcile.test.ts`
- Modify: `packages/recognition/src/index.ts`
- Modify: `apps/web/components/recognition/recognition-controller.ts`
- Modify: `apps/web/components/recognition/recognition-panel.tsx`

**Interfaces:**
- `reconcileRecognition({ localDraft, cloudResult, existingGeometry }): RecognitionDraft`.

- [ ] **Step 1: RED reconciliation matrix tests**

Local+cloud near-match -> one `merged` candidate with raised confidence; cloud-only wall with no geometric support -> remains low/medium and pending; conflicting classifications -> conflict; existing-geometry duplicate -> rejected/duplicate diagnostic; user prior decisions survive reconciliation where candidate identity can be matched.

- [ ] **Step 2: Implement deterministic matching**

Use normalized geometric tolerances, angle difference, endpoint/segment distance and overlap. Never use LLM text to decide geometric equality.

- [ ] **Step 3: Preserve provenance/evidence**

Merged candidates retain local and cloud evidence summaries and cloud model metadata at session level, never API key.

- [ ] **Step 4: Integrate `Проверить с AI`**

Cloud failure leaves local draft untouched. Successful response writes a reconciled session atomically after validation.

- [ ] **Step 5: Run tests GREEN and commit**

Run: `pnpm --filter @vlezet/recognition test && pnpm --filter web test && pnpm typecheck`
Commit: `git commit -m "feat: reconcile local and AI recognition"`

---

### Task 10: UX hardening, privacy checks, docs and final gates

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `README.md`
- Create: `docs/milestones/m4-5-acceptance.md`
- Add/modify focused tests where gaps were found.

- [ ] **Step 1: Add stale-session and failure UX**

Exact user states: no calibrated reference; OpenCV unavailable; insufficient structural lines; cancelled; stale after recalibration/replacement; invalid key; 402/funds; 429/rate limit; unsupported model; malformed structured response. Each offers safe fallback and never destroys the draft/project.

- [ ] **Step 2: Add privacy regression tests**

Serialize/export project and inspect persisted recognition session fixtures: no `apiKey`, `Authorization`, bearer token or cloud request payload containing secrets. Import creates no recognition session.

- [ ] **Step 3: Write browser acceptance**

Cover local run, progress, F5 restore, edit/reject/accept, one-step apply+undo, existing geometry safety, opening reclassification, OpenRouter BYOK refinement, cancellation/failure preservation, stale session after recalibration, and no session after JSON round-trip.

- [ ] **Step 4: Update README**

Explain local-first recognition, optional OpenRouter BYOK, privacy boundary, editable draft and roadmap status.

- [ ] **Step 5: Full clean verification**

Run in one clean CI/workspace:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit `0`.

- [ ] **Step 6: PR self-review**

Check branch is ahead of `main` only, no generated/temp files, no write-enabled CI, no unresolved review threads, no secrets, dependency lockfile committed, and scope excludes managed backend/OCR/perspective correction.

- [ ] **Step 7: Commit final hardening**

`git commit -m "docs: finalize M4.5 assisted recognition"`
