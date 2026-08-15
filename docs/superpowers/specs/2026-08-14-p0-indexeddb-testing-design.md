# P0 IndexedDB Testing and Remediation Design

Date: 2026-08-14
Status: Written specification approved; implementation plan awaiting execution choice
Owner: Product owner / Vlezet engineering
Base: `main` at `cc594bae218e9e16724d7574f48be8886852e7ad`
Parent policy: `docs/testing/TESTING_POLICY.md`
Debt item: `TEST-DEBT-INDEXEDDB-FAILURE-PATHS`

## 1. Purpose

Phase A of the blocking testing-policy programme is integrated in `main` through PR #89. Post-merge CI #5108 and CodeQL are green on integration SHA `cc594bae218e9e16724d7574f48be8886852e7ad`.

The first P0 remediation slice targets the confirmed IndexedDB evidence gap in `@vlezet/projects`.

This sub-project must prove the persistence adapter at the architectural boundary that matters:

- deterministic failure and lifecycle contracts through the public IndexedDB repository API;
- real-browser persistence and schema-upgrade behavior in Chromium and WebKit;
- preservation and deletion invariants for projects, settings, assets and schema-owned stores;
- honest coverage convergence without production test hooks, fabricated RED provenance, or threshold weakening.

The goal is not to rewrite persistence. The goal is to turn a measured high-risk blind spot into durable automated evidence and fix only defects that the evidence actually reveals.

## 2. Current state and measured debt

The canonical audit records `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` as P0 / Critical / OPEN. `packages/projects/src/indexeddb.ts` is currently unexecuted by workspace unit coverage; memory-repository, project, file-format, asset and autosave tests are not dedicated IndexedDB failure-path evidence.

The accepted Phase A baseline for `projects` is:

- lines: 279/434 = 64.29%;
- statements: 297/493 = 60.24%;
- functions: 75/110 = 68.18%;
- branches: 169/312 = 54.17%.

These are ratchet floors, not correctness claims. Changed critical production code must satisfy 100% lines/statements/functions and at least 95% branches.

Current production schema identity is:

- database: `vlezet`;
- schema version: `3`;
- stores: `projects`, `settings`, `assets`, `recognitionSessions`;
- `projects.updatedAt` index;
- `assets.projectId` index;
- unique `recognitionSessions.projectId` index.

Historical upgrade boundaries were verified directly from repository code:

- M3 commit `6c32249acc8e333e62fceee2ea4e76ca83890c77`: schema v1 with `projects` and `settings`;
- M4 commit `12e9696e11572ad5ec055f3dfad98ad7826184e2`: schema v2 adding `assets` and its `projectId` index;
- M4.5 commit `b63bdd613db4e13c07d2a961981799bd360f256d`: schema v3 adding `recognitionSessions` and unique `projectId` index.

The remediation must therefore exercise genuine v1 -> v3 and v2 -> v3 upgrades, not only fresh v3 creation.

## 3. Architectural constraints

1. Tests exercise `createIndexedDbProjectRepository(factory)` and/or `IndexedDbProjectRepository` through public behavior.
2. Private helpers such as `openDatabase`, `requestResult`, `transactionDone` and asset-deletion internals remain private and are not exported for coverage.
3. Production code receives no debug route, test mode, fault-injection switch, hidden query parameter or test-only branch.
4. `indexeddb-schema.ts` remains schema authority. Tests may import public constants instead of duplicating mutable schema truth.
5. Real browsers remain authority for actual IndexedDB lifecycle and persistence semantics. Deterministic doubles supplement rare failure paths only.
6. No database-version bump or schema redesign is justified by this testing slice alone.
7. No unrelated persistence/UI refactor is bundled into remediation.

## 4. Evidence strategy

### 4.1 Deterministic adapter contracts

A focused suite at `packages/projects/src/indexeddb.test.ts` exercises the public repository against a deliberately small event-driven `IDBFactory`/request/transaction harness.

The harness exists only to trigger deterministic lifecycle and failure events. It must not become a general in-memory IndexedDB implementation.

Its intended fault-injection surface is limited to capabilities needed for public outcomes:

- synchronous `factory.open(...)` throw;
- open request `error`;
- open request `blocked`;
- successful upgrade/open;
- request success/error;
- transaction complete/error/abort;
- observable database close on `versionchange`.

If the harness starts reproducing substantial IndexedDB semantics, implementation stops and reassesses before adding more emulation. `fake-indexeddb` is not an initial dependency. It may be reconsidered only if evidence shows minimal doubles are becoming less trustworthy or more complex.

A test-only helper file is allowed if it materially improves readability. It must not be exported from `packages/projects/src/index.ts` or imported by production code.

### 4.2 Real-browser contracts

A dedicated executable Playwright spec is added at:

`tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`

It imports the shared Phase A fixture so unexpected `pageerror` and `console.error` remain blocking. It must not reimplement or weaken the global runtime-error guard.

Chromium discovers this spec automatically. The complete IndexedDB persistence spec is also registered in the machine-checked WebKit representative set. There is no later silent reduction to a smaller subset for this P0 slice; any future scope reduction requires a separately approved design change.

For user-visible persistence behavior, browser tests drive the same normal product UI/lifecycle that a user drives. Direct IndexedDB access through `page.evaluate` may prepare preconditions or inspect postconditions, but it cannot substitute for the user action being proven. Direct `objectStore.put(...)` followed by direct `objectStore.get(...)` is not evidence for the application's save/reload lifecycle.

Browser-side helpers are permitted only for setup/inspection that cannot reasonably be expressed through normal UI:

- deleting/resetting the test database between isolated cases;
- preparing historical schema versions before loading current application code;
- deliberately writing malformed stored data for fail-closed scenarios;
- inspecting storage state to prove preservation/deletion invariants.

No product route or production debug API is added.

## 5. Required behavior matrix

The debt closes by behavior, not by percentage alone.

### 5.1 Open and availability

Required evidence:

- missing/unsupported IndexedDB factory fails explicitly;
- synchronous `factory.open` exception becomes `ProjectStorageError`;
- asynchronous open request error rejects rather than hanging;
- blocked upgrade rejects with the dedicated blocked-storage outcome;
- successful open produces a usable repository;
- later `versionchange` closes the opened connection.

### 5.2 Fresh schema creation

Opening an empty database at current version must create all required stores/indexes with intended key-path and uniqueness semantics.

Fresh-schema creation is verified in Chromium and WebKit.

### 5.3 Historical schema upgrade

Real-browser cases prepare genuine historical `vlezet` schemas and then load current code.

Both verified historical boundaries are mandatory:

- v1 -> v3;
- v2 -> v3.

The upgrade contract proves:

- missing current stores/indexes are created;
- existing project/settings records survive;
- v2 assets survive upgrade;
- unrelated existing records are preserved;
- current repository operations work after upgrade.

Upgrade evidence runs in Chromium and WebKit.

### 5.4 Project CRUD and list semantics

Real browser evidence includes:

- project save/get round trip;
- missing project returns `null` rather than throwing;
- list preserves documented newest-first ordering with deterministic ID tie-break;
- project data survives page/application reload.

At least one save -> reload -> reopen/read scenario performs save/open through normal Vlezet UI/application lifecycle.

### 5.5 Settings / last-project semantics

Evidence must prove:

- last project ID save/read round trip;
- clearing/null state;
- deleting the referenced project clears the reference;
- deleting another project preserves an unrelated last-project reference.

### 5.6 Asset persistence and cascade deletion

Evidence must prove:

- asset save/get round trip;
- deleting one asset preserves unrelated assets;
- deleting all assets for project A preserves project B assets;
- deleting project A removes project A assets while preserving project B, project B assets and unrelated settings;
- public asset-operation request/transaction failures surface through `ProjectStorageError` where applicable.

No cross-project data loss is acceptable.

### 5.7 Request failures

Representative public operations deterministically prove that request errors reject with the intended `ProjectStorageError` boundary and never leave promises pending.

Coverage includes the generic read-error path and at least one distinct operation-specific message where production provides one.

### 5.8 Transaction failures

Transaction `abort` and transaction `error` are separate production branches and both require deterministic evidence.

Tests prove:

- a public write/delete operation rejects on abort;
- a public operation rejects on transaction error;
- rejection still occurs if an earlier request event succeeded;
- no timeout expiration is used as the assertion mechanism.

### 5.9 Corrupted stored records

Browser setup may inject structurally corrupted project/asset records directly into IndexedDB.

Malformed persisted data must fail closed through existing validators and must never be silently accepted as valid domain/project-asset state.

### 5.10 Recognition-session schema preservation

This slice does not add recognition repository behavior to `IndexedDbProjectRepository` and does not define new project-deletion semantics for recognition sessions.

Required schema evidence is precise:

- fresh v3 creation contains `recognitionSessions` with unique `projectId` index;
- v1 -> v3 and v2 -> v3 upgrades create that store/index without damaging legacy data;
- reopening an already-current v3 database with an existing recognition-session record preserves that record.

Because v1/v2 never contained `recognitionSessions`, the design does not pretend that a pre-v3 recognition record can be preserved across those upgrades.

If project deletion versus recognition-session lifecycle reveals an orphaning ambiguity, it is recorded as a separate data-integrity debt/product decision. Deletion semantics are not silently changed in this remediation.

## 6. Characterization versus genuine RED -> GREEN

Historical test debt does not justify fabricated TDD provenance.

When existing behavior is correct but untested, a new test may start GREEN. It is recorded as characterization / existing behavior newly evidenced.

When a test exposes an actual defect:

1. preserve the focused failing test and exact behavior;
2. record a genuine RED run/commit before production change when reproducible;
3. implement the smallest correct production fix;
4. run the same contract to GREEN;
5. run neighboring IndexedDB/projects tests;
6. run all required exact-head gates.

A characterization test that started GREEN is never described later as RED evidence.

## 7. Coverage convergence

Coverage is evidence accounting, not the objective itself.

Sequence:

1. add meaningful deterministic and browser contracts from the behavior matrix;
2. run measured coverage;
3. inspect remaining uncovered lines/functions/branches in `indexeddb.ts` and relevant schema code;
4. add tests only for meaningful remaining behavior/failure branches;
5. leave genuinely impossible/dead branches for separate production simplification rather than meaningless tests;
6. regenerate the accepted baseline only through existing measured tooling after evidence is complete.

No hand-edited percentages. No baseline or threshold lowering. Ratchet movement is upward-only.

Any production changes during defect remediation must satisfy the critical changed-code gate: 100% lines/statements/functions and at least 95% branches.

This slice closes its IndexedDB adapter debt; it does not claim to eliminate unrelated uncovered `@vlezet/projects` modules.

## 8. Browser isolation and runtime reliability

Each browser test is deterministic and isolated:

- no execution-order dependency;
- database state reset or deliberately prepared per test;
- IndexedDB completion events awaited directly; no arbitrary sleeps;
- retries remain `0`;
- no `test.only`, unmanaged `skip` or `fixme`;
- shared runtime guards remain active;
- expected storage failures asserted narrowly; no global runtime/console suppression.

## 9. File boundaries

Expected implementation footprint:

- `packages/projects/src/indexeddb.test.ts` — deterministic public-API contracts and fault injection;
- optional adjacent test-only support if minimal doubles warrant extraction;
- `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs` — real-browser persistence/upgrade/corruption contracts;
- `tools/testing-policy/browser-policy.mjs` and/or current WebKit registry file — only the machine-checked classification required for the new executable spec;
- `docs/testing/TEST_COVERAGE_AUDIT.md` — evidence/status update only when debt is actually closed;
- generated coverage baseline only through the existing generator when accepted measured coverage improves;
- production persistence files only if a genuine defect requires a minimal fix.

The implementation plan must verify exact package scripts, Vitest environment capabilities and browser-policy registration mechanics before prescribing commands. No unverified dependency or runner feature is assumed by this design.

## 10. Integration and evidence sequence

Implementation begins only after this written specification and its implementation plan are approved.

The implementation branch is created from the then-current integrated `main`, not from this docs-only branch. A Draft PR opens early so exact-head policy/CI behavior remains visible.

Before acceptance, evidence must include:

- focused deterministic IndexedDB tests;
- Chromium persistence/upgrade evidence;
- full registered WebKit persistence/upgrade evidence;
- policy self-tests and enforcement;
- unit/workspace regression tests;
- measured coverage and non-decreasing ratchet;
- typecheck/lint/build and all repository-required gates relevant to the diff;
- CodeQL/security result where required;
- zero unresolved review threads;
- canonical audit updated with exact-head closure evidence.

The debt stays OPEN until required evidence exists on the exact implementation head. Documentation must not predeclare closure.

Product-owner PASS remains separate from `implemented` and `tested`. Protected squash merge occurs only after acceptance; post-merge CI/security is verified on the actual integration SHA.

## 11. Definition of Done for TEST-DEBT-INDEXEDDB-FAILURE-PATHS

This debt is complete only when all are true:

1. public open/availability failure contracts are deterministic and automated;
2. request-error and transaction abort/error branches have focused evidence;
3. fresh v3 schema creation is verified in Chromium and WebKit;
4. v1 -> v3 and v2 -> v3 upgrades are verified in Chromium and WebKit with preservation invariants;
5. project round-trip and reload persistence are verified through real application lifecycle;
6. last-project settings behavior is verified;
7. asset round-trip, isolated deletion and project cascade deletion are verified without cross-project data loss;
8. malformed persisted records fail closed;
9. recognition-session schema creation/upgrade and current-v3 reopen preservation are verified without inventing deletion semantics;
10. Chromium passes with shared runtime guards;
11. the complete IndexedDB persistence spec passes in WebKit;
12. browser discovery/classification policy cannot omit the required spec;
13. measured coverage is non-decreasing and any baseline update is generated, not hand-authored;
14. changed critical production code satisfies critical changed-code thresholds;
15. no production helper exists solely for tests;
16. no retry/skip/assertion/threshold weakening was used;
17. audit truth is updated only after exact-head evidence;
18. product-owner acceptance is explicit before merge;
19. protected integration and post-merge checks are verified separately.

## 12. Out of scope

This sub-project does not include:

- redesigning the repository API;
- replacing IndexedDB;
- moving local-first state to a server;
- bumping `VLEZET_DATABASE_VERSION` without a product/schema requirement;
- rewriting all `@vlezet/projects` tests;
- creating a general-purpose IndexedDB emulator;
- adding `fake-indexeddb` without demonstrated need;
- test-only production exports/routes/hooks;
- unrelated M8.3 work;
- recognition quality work;
- defining new recognition-session deletion semantics without a separate product/data-integrity decision;
- broad UI redesign;
- arbitrary percentage-chasing tests;
- lowering coverage thresholds or the measured ratchet.

## 13. Success criterion

The slice succeeds when IndexedDB persistence is no longer a P0 evidence blind spot: failure behavior is deterministic and reproducible at the adapter boundary, lifecycle/upgrade/data-preservation behavior is proven in Chromium and WebKit, the user-visible save/reload path is exercised through the real application lifecycle, coverage accounting reflects the evidence, and the canonical debt item can be closed without changing production architecture merely to make testing easier.
