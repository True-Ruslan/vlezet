# P0 IndexedDB persistence and failure-path remediation

**Date:** 2026-08-15  
**Status:** PRODUCT-OWNER ACCEPTED in PR #90. Technical evidence and coverage ratchet are complete. Canonical acceptance truth is synchronized; fresh exact-head CI, Chromium/WebKit and CodeQL on the final documentation head are the remaining pre-merge gates, followed by protected squash integration and post-merge verification.

## Goal

Close the P0 `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` gap without replacing native IndexedDB with a memory repository, weakening validation, changing database schema/version, or adding production test hooks.

Approved design and executable plan:

- `docs/superpowers/specs/2026-08-14-p0-indexeddb-testing-design.md`
- `docs/superpowers/plans/2026-08-15-p0-indexeddb-testing-remediation.md`

## Delivered test infrastructure

Deterministic public-adapter contracts now exercise:

- unavailable IndexedDB;
- synchronous and asynchronous open failures;
- blocked open/upgrade;
- successful open and `versionchange` close;
- project, asset and asset-index request failures;
- transaction completion, abort and error;
- project CRUD/list ordering and missing-record semantics;
- `lastProjectId` read/write/clear behavior;
- project -> asset deletion closure with unrelated-setting preservation;
- asset get/put/delete and per-project asset deletion;
- malformed scalar/array asset records and invalid binary metadata;
- schema-upgrade branches for new stores, existing stores, missing indexes and already-existing indexes.

Native browser acceptance is explicit and retry-free. The final authority split is intentional:

- **Chromium** runs the complete discovered browser suite and additionally proves a native historical v2 Blob-backed asset survives the v3 upgrade unchanged;
- **WebKit** proves current ArrayBuffer-backed asset persistence, real reference import/reload, v1/v2 metadata upgrades, corruption recovery and the rest of its registered representative suite;
- the Playwright WebKit runtime cannot reliably synthesize a historical Blob-backed IndexedDB record (`UnknownError: Error preparing Blob/File data to be stored in object store`), so that impossible fixture is not disguised with a skip/retry; legacy Blob compatibility remains covered by the Chromium native regression plus the public repository hydration contract.

The browser contracts cover:

- current v3 schema and index uniqueness;
- native v1 -> v3 preservation of project + `lastProjectId`;
- native v2 -> v3 preservation of project + `lastProjectId`;
- native legacy Blob-backed v2 asset preservation in Chromium;
- recognition-session preservation across a real application reopen;
- real reference-plan import -> normalize -> save -> reload -> hydrate through the production repository in Chromium and WebKit;
- real UI rename/autosave -> reload -> dashboard -> reopen lifecycle;
- project deletion removing only owned ArrayBuffer-backed assets while preserving unrelated project/asset/settings state;
- user-facing fail-closed recovery for corrupted persisted projects/assets.

## Production defects found and fixed

### Corrupted persisted project escaped the storage boundary

Focused RED:

```text
project corruption RED: 0f0bb70a9630ea91baaf9fa055bb68601a9c883e
CI #5131: Unit tests FAIL as intended
expected: ProjectStorageError
actual:   ProjectValidationError
```

Minimal fix:

```text
head: a02a34fad68f39ec8092bb91e470b1f66e7dffde
```

Persisted project reads now translate validation failure into:

`ProjectStorageError("Локальный проект повреждён и не был открыт.", { cause })`

`put()` still calls `validateProject()` directly, so caller/programming validation semantics were not weakened.

### Corrupted persisted reference asset escaped the storage boundary

Focused RED:

```text
head: fc027970d4881f9a31e232c1be7321497bc1d974
CI unit gate: FAIL as intended
expected: ProjectStorageError
actual:   ProjectAssetValidationError
```

Minimal fix:

```text
head: a561f26a4ec2aa631b02f1032d842f03d619fcaf
```

Persisted asset reads now translate validation failure into:

`ProjectStorageError("Подложка проекта повреждена и не была открыта.", { cause })`

`putAsset()` still calls `validateProjectAsset()` directly.

### WebKit-native Blob writes are not a safe current storage primitive

Repeated exact-browser RED evidence showed the Playwright WebKit runtime failing direct IndexedDB Blob/File writes before Vlezet launched, including browser-created `File` and `canvas.toBlob()` values. The real product import path established the same compatibility risk while the public runtime contract still required `Blob`.

The minimal production remediation keeps the public/domain contract unchanged while changing only the raw IndexedDB representation:

```text
public ProjectAssetRecord: Blob
raw current IndexedDB record: blobBytes: ArrayBuffer
read boundary: ArrayBuffer -> Blob -> validateProjectAsset()
legacy raw record: Blob remains readable
DB name/version/stores/indexes: unchanged
```

This avoids new WebKit Blob writes without a schema/version migration and preserves legacy reads.

## Honest infrastructure findings

Several red checkpoints were deliberately not classified as product defects:

1. the first deterministic harness emitted transaction events before the outer awaited continuation had advanced; it was corrected using deterministic microtask draining, with no sleep/timeouts;
2. `indexeddb.test-support.ts` was initially treated by changed-code policy as production code because it lived under `src` without a test suffix; helpers were moved into `.test.ts` instead of weakening coverage policy;
3. test-only TypeScript narrowing and selector/reload-state expectations were corrected without runtime changes;
4. a magnifier assertion initially assumed engine-identical CSS-pixel rounding; the test was aligned to the pointer coordinates actually delivered by the browser rather than weakening product geometry;
5. WebKit cannot construct the historical raw Blob fixture used to model pre-remediation storage, so browser authority was split explicitly instead of adding a skip, retry or fake store;
6. GitHub browser jobs occasionally spent long periods in browser installation before tests started; those runs are runner/network evidence, not product verdicts;
7. the final coverage ratchet exposed a Phase A policy-maintenance defect: the docs-policy contract incorrectly treated the original Phase A baseline SHA as immutable although the approved generator supports later measured ratchets. RED `760b0f21179a23bdd8199491a98bc7a2efa08734` proved the defect; GREEN `366ad1f880d5866264e94388412c6dfabf37f83b` follows generated `baseline.sourceCommit` without weakening thresholds, measured cells or workspace checks.

## Safety boundaries preserved

- database name remains `vlezet`;
- database version remains `3`;
- store/index schema is unchanged;
- public `ProjectAssetRecord` remains Blob-based;
- current raw IndexedDB binary storage is ArrayBuffer-backed;
- legacy Blob-backed records remain readable;
- no production debug route, test mode, fault switch or fake IndexedDB dependency was added;
- no memory repository substitutes for browser persistence evidence;
- no coverage baseline, threshold or assertion was lowered;
- no browser skip/fixme/retry was introduced;
- project/document authority and M8.2 geometry semantics are unchanged;
- validation remains strict; only validation failures originating from persisted reads are translated to stable storage/recovery errors.

## Product-owner accepted technical evidence

Accepted implementation/policy head:

```text
366ad1f880d5866264e94388412c6dfabf37f83b
```

Exact-head gates before acceptance truth sync:

```text
CI #5167 / run 31889155829:  PASS
  documentation contract:    PASS
  unit tests:                PASS
  coverage:                  PASS
  testing policy:            PASS
  recognition benchmark:     PASS
  typecheck:                 PASS
  lint:                      PASS
  build:                     PASS
CodeQL #527 / run 31889153986: PASS
Browser Acceptance #1614 / run 31889155832: PASS
  Chromium:                  65/65 PASS
  WebKit:                    57/57 PASS
  workers:                   1
  retries:                   0
browser artifact:            9248180775
artifact SHA-256:            58d22159c0ab995ef2659c46977def0d4e32cee8ea354af7cf8770c73a95eb75
unresolved review threads:   0
reviews/requested changes:   0
```

Measured ratchet:

```text
repository:        lines 5850/9306 (62.86%)
                   statements 6674/11248 (59.33%)
                   functions 1541/2489 (61.91%)
                   branches 4068/7733 (52.61%)
packages/projects: lines 384/446 (86.10%)
                   statements 416/507 (82.05%)
                   functions 111/114 (97.37%)
                   branches 212/323 (65.63%)
indexeddb.ts:      100% lines/statements/functions/branches
indexeddb-schema:  100% lines/statements/functions/branches
```

Product-owner acceptance:

```text
2026-08-15 — PASS — «Принимаю P0»
```

Canonical acceptance truth is synchronized across `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md` and `docs/testing/TEST_COVERAGE_AUDIT.md`. This documentation-only sync necessarily advances the PR head beyond the accepted implementation/policy SHA; it does not alter runtime behavior.

## Remaining integration gate

1. obtain fresh exact-head CI + Chromium/WebKit + CodeQL on the final acceptance-documentation head;
2. mark PR #90 Ready only when those checks are GREEN;
3. protected squash merge with expected-head protection;
4. verify post-merge CI + CodeQL on `main`;
5. only after protected integration is verified may M8.3 Precision Reference Calibration begin.
