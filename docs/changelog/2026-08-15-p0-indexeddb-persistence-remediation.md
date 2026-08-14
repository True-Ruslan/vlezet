# P0 IndexedDB persistence and failure-path remediation

**Date:** 2026-08-15  
**Status:** IN DEVELOPMENT in Draft PR #90. Exact-head delivery gates and product-owner acceptance remain pending.

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
- schema-upgrade branches for new stores, existing stores, missing indexes and already-existing indexes.

Native browser acceptance is explicitly registered in both Chromium and the representative WebKit suite with retries `0`. The browser contracts cover:

- current v3 schema and index uniqueness;
- native v1 -> v3 preservation of project + `lastProjectId`;
- native v2 -> v3 preservation of project + setting + reference asset;
- recognition-session preservation across a real application reopen;
- real UI rename/autosave -> reload -> dashboard -> reopen lifecycle;
- project deletion removing only owned assets while preserving unrelated project/asset/settings state;
- user-facing fail-closed recovery for a corrupted persisted project.

## Genuine production defects found

### Corrupted persisted project escaped the storage boundary

Focused RED:

```text
head: fc027970d4881f9a31e232c1be7321497bc1d974?  # asset RED is below; project RED identity retained separately
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

## Honest infrastructure findings

Several red checkpoints were deliberately not classified as production defects:

1. the first deterministic harness emitted transaction events before the outer awaited continuation had advanced; it was corrected using deterministic microtask draining, with no sleep/timeouts;
2. `indexeddb.test-support.ts` was initially treated by changed-code policy as production code because it lived under `src` without a test suffix; helpers were moved into `.test.ts` instead of weakening coverage policy;
3. a test-only TypeScript event-handler typing defect was corrected without runtime changes;
4. WebKit failed synthetic asset seeding before Vlezet launched when the fixture wrote project/settings/assets in one multi-store transaction. The fixture was changed to mirror real application orchestration: project/settings metadata and asset Blob writes use separate native transactions. Chromium had already passed the same product behavior;
5. later GitHub browser jobs spent anomalously long periods in the browser-install step before tests started. Those runs are runner/network evidence, not product verdicts; final exact-head Chromium + WebKit remains mandatory.

## Safety boundaries preserved

- database name remains `vlezet`;
- database version remains `3`;
- store/index schema is unchanged;
- no production debug route, test mode, fault switch or fake IndexedDB dependency was added;
- no memory repository substitutes for browser persistence evidence;
- no coverage baseline, threshold or assertion was lowered;
- project/document authority and M8.2 geometry semantics are unchanged;
- validation remains strict; only validation failures originating from persisted reads are translated to stable storage/recovery errors.

## Remaining gate

Before this P0 slice may be accepted:

1. exact-head CI must pass documentation, unit, coverage, testing-policy, recognition benchmark, typecheck, lint and build;
2. exact-head Browser Acceptance must pass Chromium and the full registered WebKit suite with retries `0`;
3. CodeQL must pass;
4. measured coverage evidence must be recorded from generated artifacts rather than hand-authored;
5. canonical `PROJECT_STATE`, `ROADMAP`, `CHANGELOG` and `TEST_COVERAGE_AUDIT` truth must be synchronized;
6. product-owner acceptance is required before moving PR #90 out of Draft or protected merge.
