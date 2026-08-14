# P0 IndexedDB Testing and Remediation Design

Date: 2026-08-14
Status: Conversational design approved; written specification awaiting product-owner review
Owner: Product owner / Vlezet engineering
Base: `main` at `cc594bae218e9e16724d7574f48be8886852e7ad`
Parent policy: `docs/testing/TESTING_POLICY.md`
Debt item: `TEST-DEBT-INDEXEDDB-FAILURE-PATHS`

## 1. Purpose

Phase A of the blocking testing-policy programme is already integrated in `main` through PR #89. The repository now has measured coverage, a ratchet, changed-code thresholds, policy self-tests, automatic Chromium spec discovery, a machine-classified WebKit subset, shared Playwright runtime-error guards, and a canonical audit registry.

The first P0 remediation slice targets the confirmed IndexedDB evidence gap in `@vlezet/projects`.

This sub-project must prove the persistence adapter at the architectural boundary that actually matters:

- deterministic failure and lifecycle contracts through the public IndexedDB repository API;
- real-browser persistence and schema-upgrade behavior in Chromium and representative WebKit;
- preservation and deletion invariants for projects, settings, assets and schema-owned stores;
- honest coverage convergence without production test hooks, fake RED provenance, or threshold weakening.

The goal is not to rewrite persistence. The goal is to convert a measured, high-risk blind spot into durable automated evidence and to fix only defects that the evidence actually reveals.

## 2. Current state and measured debt

The canonical audit records `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` as P0 / Critical / OPEN. Its current evidence states that `packages/projects/src/indexeddb.ts` is unexecuted by workspace unit coverage and that existing memory-repository, project, file-format, asset and autosave tests are not dedicated proof of IndexedDB failure paths.

The accepted Phase A baseline for the `projects` workspace is:

- lines: 279/434 = 64.29%;
- statements: 297/493 = 60.24%;
- functions: 75/110 = 68.18%;
- branches: 169/312 = 54.17%.

These numbers are a measured ratchet floor, not evidence that IndexedDB behavior is correct. The later critical-area target remains at least 95% lines/statements/functions and 90% branches, while changed critical production code must satisfy 100% lines/statements/functions and at least 95% branches.

Current production schema identity is:

- database: `vlezet`;
- schema version: `3`;
- stores: `projects`, `settings`, `assets`, `recognitionSessions`;
- `projects.updatedAt` index;
- `assets.projectId` index;
- unique `recognitionSessions.projectId` index.

Historical repository code confirms the meaningful upgrade boundaries: M3 used schema version 1 with `projects` and `settings`; M4 used version 2 and added `assets` plus its `projectId` index; M4.5 moved to version 3 and added `recognitionSessions`. The remediation must exercise genuine legacy-to-current upgrade paths rather than only opening a fresh version-3 database.

## 3. Architectural constraints

This work must preserve the existing local-first architecture and API boundaries.

1. Tests exercise `createIndexedDbProjectRepository(factory)` and/or `IndexedDbProjectRepository` through public behavior.
2. Private implementation helpers such as `openDatabase`, `requestResult`, `transactionDone` and asset-deletion internals remain private. They are not exported merely to increase coverage.
3. Production code receives no debug route, test mode, fault-injection switch, hidden query parameter or test-only branch.
4. `indexeddb-schema.ts` remains the production schema contract. Tests may import its public constants; they must not duplicate mutable schema truth unnecessarily.
5. The real browser remains the authority for actual IndexedDB lifecycle and persistence semantics. Deterministic doubles supplement the browser for rare failures that are hard to induce reliably; they do not replace browser evidence.
6. No database-version bump or schema redesign is justified by this testing slice alone.
7. No unrelated persistence/UI refactor is bundled into remediation.

## 4. Evidence strategy

The selected strategy has two complementary layers.

### 4.1 Deterministic adapter contracts

A focused test suite in `packages/projects/src/indexeddb.test.ts` exercises the public repository against a deliberately small, event-driven `IDBFactory`/request/transaction test harness.

The harness exists only to trigger deterministic lifecycle and failure events. It must not become a general in-memory IndexedDB implementation.

The intended fault-injection surface includes only capabilities needed to demonstrate public outcomes such as:

- synchronous `factory.open(...)` throw;
- open request `error`;
- open request `blocked`;
- successful upgrade/open;
- request success/error;
- transaction complete/error/abort;
- cursor success/end/error where required by a public repository operation;
- observable database close on `versionchange`.

If that harness becomes large enough to reproduce substantial IndexedDB semantics, implementation must stop and reassess the design before adding more emulation. `fake-indexeddb` is intentionally not an initial dependency. It may be reconsidered only with explicit evidence that the minimal doubles are becoming less trustworthy or more complex than the dependency they were meant to avoid.

A test-only helper file is allowed if it materially improves readability, for example `packages/projects/src/indexeddb.test-support.ts` or an equivalent test-only path chosen in the implementation plan. It must not be exported from `packages/projects/src/index.ts` and must never be imported by production code.

### 4.2 Real-browser contracts

A dedicated executable Playwright spec is added at:

`tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`

It imports the shared Phase A fixture from `tools/m7-browser-audit/fixtures.mjs`, so unexpected `pageerror` and `console.error` remain blocking. It must not reimplement or weaken the global runtime-error guard.

Chromium discovers the new spec automatically. Because IndexedDB is a browser API and cross-browser persistence is explicitly classified as representative WebKit risk by the testing policy, this spec (or an explicitly scoped representative subset if the implementation plan proves that to be more precise) must be registered in the machine-checked WebKit classification.

For user-visible persistence behavior, the browser test must drive the same normal product UI/lifecycle that a user drives. Direct IndexedDB access through `page.evaluate` may prepare preconditions or inspect postconditions, but it cannot substitute for the actual user action being proven. In particular, direct `objectStore.put(...)` followed by direct `objectStore.get(...)` is not acceptable evidence for the application's save/reload lifecycle.

Browser-side helpers are permitted only for test setup/inspection actions that cannot be expressed through normal product UI, specifically:

- deleting/resetting the test database between isolated cases;
- preparing a historical schema version before loading current application code;
- deliberately writing malformed/corrupted stored data required for a recovery/fail-closed scenario;
- inspecting storage state needed to prove preservation/deletion invariants.

Those helpers execute from the test harness against browser APIs. They do not add product routes or production debug APIs.

## 5. Required behavior matrix

The remediation closes evidence by behavior, not by chasing percentages alone. The final implementation plan may split these scenarios into smaller tests, but it must preserve the following contracts where applicable.

### 5.1 Open and availability

Required evidence:

- missing/unsupported IndexedDB factory fails explicitly rather than silently degrading persistence;
- synchronous `factory.open` exception becomes the repository storage error contract;
- asynchronous open request error rejects rather than hanging;
- blocked upgrade rejects with the dedicated blocked-storage outcome;
- successful open produces a usable repository;
- a subsequent database `versionchange` closes the opened connection.

### 5.2 Fresh schema creation

Opening an empty database at the current version must create/retain all required stores and indexes with the intended uniqueness/key-path semantics.

The test must prove schema facts that can cause data corruption or later operation failure. It should not assert incidental browser metadata with no behavioral value.

### 5.3 Historical schema upgrade

Real-browser cases prepare genuine historical `vlezet` schemas and then open the current application/repository.

The upgrade contract must prove that:

- missing current stores/indexes are created;
- existing project/settings data survives;
- assets present in the historical version-2 schema survive its upgrade to current;
- unrelated existing records are not discarded merely because the schema upgrades;
- the resulting database is usable by current repository operations.

The implementation should cover both verified meaningful historical boundaries, v1 -> current and v2 -> current. If repository investigation before implementation proves that one case is behaviorally redundant in the actual browser engine and provides no distinct preservation invariant, omission requires an explicit evidence-based justification in the implementation plan and audit record rather than a silent reduction of scope.

### 5.4 Project CRUD and list semantics

Real browser evidence must include at minimum:

- project save/get round trip;
- missing project returns the public empty result rather than throwing;
- list returns persisted projects in the documented deterministic ordering;
- persisted project data survives page/application reload rather than only surviving an in-memory repository instance.

At least one save -> reload -> reopen/read scenario must perform the save/open actions through the normal Vlezet UI/application lifecycle. Direct IndexedDB writes may prepare legacy/corruption fixtures, but they do not satisfy this user-visible persistence contract.

Existing domain validation contracts are reused; this slice does not duplicate every `validateProject` case unless malformed storage crosses the IndexedDB adapter boundary differently.

### 5.5 Settings / last-project semantics

The IndexedDB-backed settings behavior must prove:

- last project ID save/read round trip;
- clearing/null state behaves according to the current repository contract;
- deleting a project clears the last-project reference only when it points at the deleted project;
- deleting another project preserves an unrelated last-project reference.

### 5.6 Asset persistence and cascade deletion

Required evidence:

- asset save/get round trip through the real adapter;
- deleting a single asset does not affect unrelated assets;
- deleting all assets for project A preserves project B assets;
- deleting project A removes project A assets while preserving project B, project B assets and unrelated settings;
- asset lookup/deletion request errors and transaction failures are surfaced through the storage error contract where the public operation can encounter them.

This is the critical cascade-delete invariant: no cross-project data loss is acceptable.

### 5.7 Request failures

Representative public operations must deterministically prove that an IndexedDB request error rejects with the intended `ProjectStorageError` boundary and does not leave the returned promise pending.

Coverage must include the generic read error path and at least one operation-specific error message where production provides one, such as asset lookup/deletion support. The implementation plan should prefer one meaningful proof per distinct public error contract rather than duplicating identical helper branches mechanically.

### 5.8 Transaction failures

Both transaction `abort` and transaction `error` outcomes are separate production branches and require deterministic evidence.

Tests must prove that:

- a public write/delete operation rejects on abort;
- a public operation rejects on transaction error;
- rejection occurs even if an earlier request event succeeded;
- no test relies on timeout expiration as the assertion mechanism.

If real investigation shows one event necessarily co-fires with the other in the minimal harness, the harness must still demonstrate both production handlers independently instead of pretending one branch was covered.

### 5.9 Corrupted stored records

Browser setup may inject corrupted project/asset records directly into IndexedDB to cross the real storage boundary.

Required behavior is fail-closed through existing validators: malformed persisted data must not be silently accepted as a valid domain/project asset record.

The exact malformed fixtures should target structural corruption with behavioral meaning, not arbitrary mutation for coverage.

### 5.10 Recognition-session schema preservation

This slice does not add recognition repository behavior to `IndexedDbProjectRepository` and does not define new project-deletion semantics for recognition sessions.

Fresh-create and historical-upgrade evidence must prove that the current `recognitionSessions` store and unique `projectId` index are present and that pre-existing recognition-session records survive a schema open/upgrade when no established production contract says they should be removed.

If the audit reveals an ambiguity or orphaning risk between project deletion and recognition-session lifecycle, record it as a separate data-integrity debt/product decision. Do not silently change deletion behavior inside this test-remediation slice.

No recognition feature redesign is in scope.

## 6. Characterization versus genuine RED -> GREEN

Historical test debt is not permission to fabricate TDD provenance.

When an existing IndexedDB behavior is correct but previously untested, the new test may be GREEN immediately. It is recorded as a **characterization / existing behavior newly evidenced** contract.

When a test exposes an actual defect:

1. preserve the focused failing test and exact failing behavior;
2. record a genuine RED run/commit before changing production code when technically reproducible;
3. implement the smallest correct production fix;
4. run the same contract to GREEN;
5. run neighboring IndexedDB/project tests;
6. run the required full exact-head gates.

The PR must distinguish characterization evidence from defect RED -> GREEN evidence. A test that started GREEN cannot later be described as a RED regression proof.

## 7. Coverage convergence

Coverage is evidence accounting, not the objective by itself.

The sequence is:

1. add meaningful deterministic and browser contracts from the behavior matrix;
2. run measured coverage;
3. inspect remaining uncovered lines/functions/branches in `packages/projects/src/indexeddb.ts` and relevant schema code;
4. add tests only for remaining meaningful behavior/failure branches;
5. explicitly leave impossible/dead/unreachable branches for separate production simplification rather than writing meaningless tests;
6. regenerate the accepted baseline only through the existing coverage-baseline tooling after the evidence is complete.

No one hand-edits coverage percentages. No baseline or threshold is lowered. Ratchet movement for affected measured areas is upward-only.

Because `packages/projects` persistence is critical, any production changes made during defect remediation must satisfy the policy's critical changed-code gate: 100% lines/statements/functions and at least 95% branches for changed production code.

The historical critical-area floor remains a destination for the wider P0 programme. This IndexedDB slice is responsible for materially closing its own adapter debt; it does not claim to eliminate unrelated uncovered `@vlezet/projects` modules.

## 8. Browser isolation and runtime reliability

Each browser persistence test must be deterministic and isolated.

- Tests must not depend on execution order.
- Database state is reset or deliberately prepared per test.
- Tests must await IndexedDB completion events rather than use arbitrary sleeps.
- Browser retries remain `0`.
- No `test.only`, unmanaged `skip`, or `fixme` is introduced.
- Shared runtime guards remain active.
- Expected storage failures are asserted narrowly inside the test; global console/runtime suppression is forbidden.
- HTTP/resource guards, if added for this slice, must distinguish genuinely unexpected critical failures from intentionally exercised/expected responses and must not treat every 4xx as a product failure.

## 9. File boundaries

Expected implementation footprint:

- `packages/projects/src/indexeddb.test.ts` — deterministic public-API contracts and fault injection;
- optional test-only support adjacent to the test suite if minimal doubles warrant extraction;
- `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs` — real-browser persistence/upgrade/corruption contracts;
- `tools/testing-policy/browser-policy.mjs` — only the machine-checked WebKit classification needed for the new executable spec;
- `docs/testing/TEST_COVERAGE_AUDIT.md` — evidence/status update when debt is actually closed;
- generated coverage baseline artifacts only through the existing generator if the accepted measured ratchet improves;
- other production files only if a genuine defect requires a minimal fix.

The implementation plan must verify exact package scripts, Vitest environment capabilities and browser-policy registration mechanics before prescribing commands. This design does not invent an unverified testing dependency or test runner feature.

## 10. Integration and evidence sequence

Implementation begins only after this written specification and its subsequent implementation plan are approved.

The implementation branch is created from the then-current integrated `main`, not from this docs-only design branch. A Draft PR should be opened early so exact-head policy/CI behavior is visible while the P0 slice evolves.

Before the slice is eligible for acceptance, evidence must include:

- focused deterministic IndexedDB tests;
- real Chromium persistence/upgrade evidence;
- representative WebKit persistence evidence;
- policy self-tests and verification;
- unit/workspace regression tests;
- measured coverage and non-decreasing ratchet;
- typecheck/lint/build and all repository-required CI gates relevant to the diff;
- CodeQL/security result where the repository workflow requires it;
- zero unresolved review threads;
- canonical audit documentation updated with exact closure evidence.

The debt item is changed from OPEN only after the required evidence exists on the exact implementation head. Documentation must not predeclare closure.

Product-owner PASS remains a separate acceptance state before protected squash merge. After merge, post-merge CI/security status must be checked against the actual integration SHA. `implemented`, `tested`, `accepted`, `merged` and `released` remain distinct.

## 11. Definition of Done for TEST-DEBT-INDEXEDDB-FAILURE-PATHS

This P0 debt item is complete only when all of the following are true:

1. public repository open/availability failure contracts are deterministic and automated;
2. request-error and transaction abort/error branches have focused deterministic evidence;
3. fresh-schema creation is verified;
4. genuine historical v1 -> current and v2 -> current schema upgrades are verified in a real browser with preservation invariants, unless a documented evidence-based plan exception is approved before implementation;
5. project round-trip and reload persistence are verified through the real application lifecycle in a browser;
6. last-project settings behavior is verified;
7. asset round-trip, isolated deletion and project cascade deletion are verified without cross-project data loss;
8. malformed persisted records fail closed at the adapter/domain boundary;
9. current recognition-session schema creation/upgrade preservation is verified without inventing new project-deletion semantics;
10. Chromium passes with shared runtime guards;
11. representative WebKit passes;
12. no required browser spec can escape Phase A discovery/classification policy;
13. measured coverage for the affected area improves or remains non-decreasing, with no hand-authored baseline change;
14. any changed critical production code satisfies the critical changed-code threshold;
15. no production helper was exported or added solely for tests;
16. no retry/skip/assertion/threshold weakening was used to make tests green;
17. audit truth is updated only after exact-head evidence exists;
18. product-owner acceptance is explicit before merge;
19. protected integration and post-merge checks are verified separately.

## 12. Out of scope

This sub-project does not include:

- redesigning the project repository API;
- replacing IndexedDB with another persistence technology;
- moving local-first state to a server;
- bumping `VLEZET_DATABASE_VERSION` without a product/schema requirement;
- rewriting all `@vlezet/projects` tests;
- creating a general-purpose IndexedDB emulator;
- adding `fake-indexeddb` without a demonstrated need;
- test-only production exports/routes/hooks;
- unrelated M8.3 product work;
- recognition quality work;
- defining new recognition-session deletion semantics without a separate product/data-integrity decision;
- broad UI redesign;
- arbitrary tests written only to increase percentages;
- lowering coverage thresholds or the measured ratchet.

## 13. Success criterion

The slice succeeds when IndexedDB persistence is no longer a P0 evidence blind spot: failures are deterministic and reproducible at the adapter boundary, lifecycle/upgrade/data-preservation behavior is proven in real browsers, the user-visible save/reload path is exercised through the real application lifecycle, coverage accounting reflects the new evidence, and the canonical debt item can be closed without changing the production architecture merely to make testing easier.
