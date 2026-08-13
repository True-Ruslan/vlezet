# Blocking Testing Policy and Coverage Audit Design

Date: 2026-08-13
Status: Approved design, implementation pending
Owner: Product owner / Vlezet engineering
Base: `main` at `95b99baf2d0f0aad51109b311c70c9b38aa3db38`

## 1. Purpose

Vlezet must not treat a green pipeline as sufficient proof that a behavior is correct. The project already uses genuine RED -> GREEN in important slices and has meaningful deterministic and browser tests, but the policy is not yet enforced as a project-wide blocking contract.

This design introduces a mandatory testing policy and a finite audit/remediation programme so that production behavior is accepted only when it has automated evidence at the correct architectural level.

The policy has four goals:

1. prevent new untested behavior from entering `main`;
2. prevent coverage and browser-suite regressions from being hidden by configuration drift;
3. find and close historical test debt systematically, prioritising the highest-risk code;
4. preserve the existing Vlezet architecture: `VlezetDocument` and millimetres remain authoritative, deterministic packages remain independent from rendering, semantic Undo/Redo remains the edit history contract, M2 fit/collision authority is not weakened, and recognition remains assistance rather than geometry authority.

This work is the current engineering priority before M8.3 product development resumes.

## 2. Design decision

The selected strategy is **contract-first plus a coverage ratchet**.

Coverage is a blocking secondary signal. It is not a substitute for behavioral contracts, failure-path tests, browser user flows, or RED -> GREEN evidence.

The project explicitly rejects these weaker alternatives:

- coverage-only quality gates;
- changed-code coverage without historical-debt remediation;
- a repository-wide 100% line target that encourages meaningless assertions;
- full mutation testing for every UI file;
- relying on manually maintained Playwright file lists as the source of truth.

The permanent human-readable policy will live in `docs/testing/TESTING_POLICY.md`. The audit/debt truth will live in `docs/testing/TEST_COVERAGE_AUDIT.md`. Machine-readable thresholds and baselines may live elsewhere as implementation requires, but they must be validated against these canonical contracts rather than becoming an undocumented second policy.

## 3. Mandatory change classification

Every change must be classified by affected behavior and risk. One PR may belong to multiple classes; all applicable evidence requirements accumulate.

### 3.1 Deterministic domain/authority changes

Examples:

- `packages/domain`;
- `packages/geometry`;
- `packages/editor-core`;
- topology and structural editing;
- validators;
- fit/collision and clearance authority;
- semantic history;
- planning constraints that can change accepted document state.

Required evidence:

- focused unit/contract test;
- real RED for new or corrected deterministic behavior where the previous behavior is observable;
- happy path;
- relevant boundary cases;
- reject/fail-closed cases;
- no-op/cancel behavior when applicable;
- Undo/Redo semantics when the change is a committed editor operation;
- changed-code coverage gate;
- package/global coverage ratchet.

Geometry and other mathematical primitives additionally require property-based invariants when examples alone cannot establish the contract robustly.

### 3.2 Persistence, migrations, import/export and local storage

Examples:

- IndexedDB schema/open/upgrade paths;
- project repository persistence;
- migration between document/storage versions;
- project import/export;
- reference-plan and asset persistence.

Required evidence:

- integration-level contract, not only a memory fake;
- successful round trip;
- malformed/legacy input where relevant;
- open/upgrade/transaction failure behavior;
- recovery or fail-closed behavior;
- preservation of unrelated project data;
- changed-code coverage and ratchet gates.

### 3.3 Store/runtime coordination

Examples:

- Zustand action surfaces;
- runtime singleton repair;
- coordination between Canvas events, store actions and editor-core commands.

Required evidence:

- unit/integration contract for state semantics;
- browser regression when the behavior is user-visible;
- protection against stale/runtime shape failures where the runtime makes them possible.

### 3.4 Canvas and direct manipulation

Any change involving the following is browser-critical:

- pointer acquisition/hit areas;
- drawing;
- wall/vertex/opening/furniture drag;
- selection and marquee;
- multiselect;
- snapping;
- copy/paste initiated through UI;
- keyboard shortcuts;
- Undo/Redo initiated through UI;
- room/furniture/opening direct manipulation.

Required evidence is a real Playwright user flow that exercises the complete path:

`user input -> DOM/Konva event -> store/runtime coordination -> deterministic operation -> rendered/resulting state`.

A unit test that directly invokes the store or editor-core function is necessary where appropriate but is not sufficient for this class of change.

### 3.5 Other browser-visible UI workflows

Examples:

- project lifecycle;
- onboarding;
- calibration;
- persistence visible to the user;
- panels that control editor behavior.

Required evidence:

- Chromium browser acceptance for critical flow changes;
- representative WebKit evidence where the behavior can differ at browser/input/rendering boundaries.

### 3.6 Recognition

Recognition remains experimental assistance and uses its existing deterministic benchmark/evidence contract. Changes must not weaken benchmark baselines simply to obtain GREEN.

### 3.7 Non-runtime exceptions

A risk-based exception exists only when the change objectively does not alter product/runtime behavior.

Examples:

- documentation-only changes;
- metadata-only changes;
- some dependency/configuration changes where runtime behavior is provably unaffected.

Such changes do not need artificial RED -> GREEN evidence or changed-code production coverage. They still run every relevant documentation, build, security, dependency, configuration, or browser gate required by the files and risks they touch.

There is no equivalent exception for production behavior.

## 4. Coverage architecture

Coverage is enforced by three independent mechanisms.

### 4.1 Repository ratchet

The implementation first measures the real current baseline without inventing thresholds.

The baseline records at minimum:

- lines;
- statements;
- functions;
- branches.

A PR must not lower the accepted repository baseline.

The ratchet exists to guarantee that historical debt can only stay level temporarily or improve; it cannot silently regress.

Branch coverage is a first-class metric because validation/rejection/error behavior commonly lives behind branches even when line coverage looks high.

### 4.2 Changed-code thresholds

For ordinary production code changed by a PR:

- lines >= 95%;
- statements >= 95%;
- functions >= 95%;
- branches >= 90%.

For critical authority/data-integrity areas changed by a PR:

- lines = 100%;
- statements = 100%;
- functions = 100%;
- branches >= 95%.

Critical areas initially include:

- domain document invariants and migrations;
- geometry/topology predicates and transformations;
- editor-core structural operations and semantic history;
- persistence/storage/migration/import-export logic;
- validators;
- fit/collision/opening constraints;
- other deterministic modules explicitly classified P0 by the audit.

Meeting these percentages does not waive scenario requirements. A test suite can satisfy coverage numerically and still fail the policy if it does not prove required boundaries/rejections/user flows.

### 4.3 Global target ratchet

Historical debt is remediated toward these target floors:

Critical packages/areas:

- lines/statements >= 95%;
- functions >= 95%;
- branches >= 90%.

Repository production code overall:

- lines/statements/functions >= 90%;
- branches >= 85%.

These are minimum protection targets, not a reason to add meaningless tests solely to reach a number. The audit may set a stronger target for a specific deterministic module when justified by its risk and complexity.

## 5. RED -> GREEN provenance

For a bugfix or behavioral regression, the evidence must establish causality.

Required sequence:

1. write or identify a focused behavioral test;
2. run it against the previous behavior;
3. observe RED for the intended reason;
4. implement the smallest correct production change;
5. run the same focused test to GREEN;
6. run neighboring regression tests;
7. run the full required exact-head gates.

Forbidden practices:

- writing the regression test only after the fix and claiming TDD provenance;
- weakening an assertion, validator, benchmark or threshold to obtain GREEN;
- producing a fake RED by intentionally breaking an unrelated assertion;
- using retries as a substitute for fixing flakiness;
- modifying production code and the test contract in a way that makes the original defect impossible to demonstrate without explicit justification.

If a genuine pre-fix RED cannot be reproduced for a technical reason, the PR must state that limitation explicitly; it cannot label the sequence genuine RED -> GREEN.

## 6. Playwright policy

### 6.1 Automatic discovery

Chromium browser acceptance must no longer depend on a hand-maintained list of every executable spec.

The implementation will establish automatic discovery of the mandatory Chromium suite and a machine-checked classification for the WebKit subset.

Every browser spec must be one of:

- automatically executable in the mandatory Chromium suite;
- explicitly marked/configured as an intentional helper/non-executable file;
- explicitly classified for representative WebKit execution where required.

A repository contract test must fail if a new executable browser spec can exist without being discovered by the mandatory suite.

### 6.2 WebKit strategy

WebKit remains representative rather than blindly duplicating every Chromium test. The selection must be explicit and machine-checkable to prevent drift.

Cross-browser-critical flows include browser/input/rendering boundaries such as:

- pointer/drag acquisition;
- Canvas hit detection;
- calibration/input workflows;
- persistence behavior with browser APIs;
- representative project lifecycle and direct-manipulation smoke.

The audit may expand the subset when evidence identifies browser-specific risk.

### 6.3 Global browser error guards

Every mandatory Playwright test receives shared guards rather than implementing them opportunistically per spec.

Unexpected conditions that fail a browser test include at minimum:

- `pageerror`;
- `console.error`;
- detectable unhandled rejection/runtime error;
- critical unexpected resource/runtime failure where the browser harness can classify it reliably.

Expected errors must be explicitly scoped and asserted; broad global suppression is forbidden.

### 6.4 Flakiness policy

Mandatory browser acceptance runs with retries disabled by default.

A flaky test is a defect in the test or product and must be diagnosed. It must not be hidden by increasing retry counts.

Intentional skips must be rare, explicit, traceable to a debt item or supported platform reason, and machine-visible to the policy validator.

## 7. Audit model

The audit does not infer quality from matching production/test filenames. It creates an evidence map by behavior.

### 7.1 Risk inventory

Every production area is classified:

- **P0 - authority/data integrity:** domain, migrations, geometry/topology, editor-core, validators, persistence/import/export, fit/collision, semantic history;
- **P1 - user-critical interaction:** Canvas, selection, drawing, direct manipulation, snapping, project lifecycle, calibration;
- **P2 - supporting behavior:** panels, onboarding, secondary visual/application state and utilities;
- **P3 - experimental:** recognition/AI R&D and benchmark/evidence tooling.

Remediation order is P0 -> P1 -> P2 -> P3 unless a currently blocking defect justifies promotion.

### 7.2 Behavior matrix

For each relevant behavior the audit records applicable scenarios rather than blindly requiring every row for every function.

Candidate dimensions include:

- happy path;
- lower/upper/minimum/maximum boundary;
- zero/no-op;
- malformed or invalid input;
- missing entity/reference;
- conflict/overlap;
- fail-closed result;
- cancel;
- Undo;
- Redo;
- repeat operation/idempotence where applicable;
- persistence round trip;
- migration;
- stale/runtime state;
- browser interaction;
- representative WebKit interaction;
- regression-specific scenario.

A scenario is marked N/A only with a concrete reason, not to improve apparent completeness.

### 7.3 Honest baseline

The first coverage run records the real baseline before thresholds are used to block historical debt.

Reports are retained for at least:

- repository overall;
- domain;
- geometry;
- editor-core;
- projects/persistence;
- planning;
- web/store;
- any other package with production behavior.

The baseline is then converted into ratchet data and audit debt.

## 8. Test debt registry

Historical gaps are recorded only in the canonical `docs/testing/TEST_COVERAGE_AUDIT.md` registry.

Each debt item contains:

- stable ID;
- P0/P1/P2/P3 risk;
- package/area;
- exact behavior or branch lacking evidence;
- current evidence;
- required evidence type;
- status;
- closure commit/PR/evidence when fixed.

Example shape:

```text
ID: TEST-DEBT-017
Risk: P0
Area: projects/indexeddb
Behavior: transaction abort recovery
Current evidence: none confirmed
Required evidence: IndexedDB integration/failure-path contract
Status: OPEN
```

The registry must not become an unbounded TODO dump. Every entry describes a concrete behavior and a verifiable closing condition.

Future modifications to an area with known debt cannot use the existence of debt as permission to add more uncovered behavior.

## 9. Policy validator

The implementation introduces a blocking project contract, expected to be exposed through a command such as `pnpm test:policy` and documented normatively in `docs/testing/TESTING_POLICY.md`.

The exact executable structure is an implementation detail, but the contract must check at least:

- coverage ratchet integrity;
- critical thresholds;
- changed-code coverage;
- browser spec discovery/classification;
- Chromium/WebKit configuration drift;
- shared browser error guards;
- forbidden accidental `.only`;
- unregistered `.skip`/equivalent intentional exclusion;
- retries policy;
- attempts to lower accepted thresholds/baselines without an explicit policy change;
- test configuration that silently excludes newly added production/tests.

The testing infrastructure is therefore itself tested and blocking.

## 10. Property-based testing

Property-based tests are added where deterministic invariants are more trustworthy than enumerating many hand-picked fixtures.

Initial target invariants include, where mathematically applicable:

- translating geometry by `(dx, dy)` preserves distances, lengths and areas;
- distance is symmetric;
- equivalent polygon traversal does not change derived area;
- accepted hosted-opening movement always keeps the opening within its current host and passes unchanged overlap validation;
- accepted structural commands do not create dangling references;
- Undo restores the pre-command semantic document;
- Redo restores the committed result;
- serialization/import-export round trips preserve semantic document equality;
- deterministic transformations produce reproducible output for the same input.

Property failures must print/persist the seed and shrunk counterexample so the exact case is reproducible in CI and locally.

Property testing supplements focused example/regression tests; it does not replace them.

## 11. Mutation testing

Mutation testing is introduced selectively after P0 areas have meaningful ordinary and property coverage.

Initial mutation targets:

- validators;
- geometry predicates;
- topology/structural guards;
- migrations;
- opening constraints;
- collision/fit authority;
- semantic history invariants.

Mutation testing is not required for every React/UI file. It is used where a high line/branch number could otherwise conceal weak assertions around deterministic correctness.

The implementation plan will determine tooling, runtime budget and which mutation score becomes blocking after an observational baseline. Mutation thresholds must not be invented before the baseline exists.

## 12. Implementation phases

### Phase A - testing infrastructure

Establish the machinery before attempting broad remediation:

1. coverage engine and report format;
2. baseline capture;
3. ratchet representation;
4. changed-code coverage calculation;
5. critical-area threshold configuration;
6. Playwright automatic discovery;
7. explicit WebKit classification;
8. shared browser error fixture;
9. policy validator;
10. CI wiring and evidence artifacts.

No product behavior should change in this phase except changes strictly required to make existing tests deterministic and truthful; any such behavior change gets its own RED -> GREEN contract.

### Phase B - P0 remediation

Audit and close P0 debt in this order unless measured risk suggests a different local ordering:

1. domain + migrations;
2. geometry/topology;
3. editor-core/history;
4. projects/persistence/import-export;
5. fit/collision/opening constraints;
6. planning constraints and deterministic transforms.

Each debt item is closed with real evidence, not by excluding the code from coverage.

### Phase C - P1 browser remediation

Audit user-critical workflows end-to-end, including:

- project creation/open/save/reload;
- room/wall/vertex operations;
- doors/windows;
- furniture placement/manipulation;
- selection/multiselect/marquee;
- copy/paste;
- dragging;
- snapping and Alt suppression;
- Undo/Redo through the UI;
- calibration;
- primary error/rejection paths.

Browser tests must use realistic user acquisition points where interaction geometry matters. The M8.2 door hit-target defect is the reference example for why testing only mathematically ideal coordinates is insufficient.

### Phase D - P2/P3 remediation

After P0/P1 gates are satisfactory, close supporting UI/utilities and experimental tooling debt according to measured risk.

## 13. Definition of Done after policy activation

A behavior-changing feature or bugfix is technically complete only when all applicable conditions are true:

1. risk/change class is known;
2. a behavioral contract exists at the correct layer;
3. regression work has genuine RED provenance when technically reproducible;
4. focused implementation is GREEN;
5. applicable boundary/error/reject cases are covered;
6. required browser user flow is covered;
7. changed-code coverage passes;
8. repository/package ratchet is not degraded;
9. critical thresholds pass;
10. required Chromium/WebKit gates pass;
11. browser runtime error guards are clean;
12. full CI is GREEN on the exact head;
13. documentation states actual rather than optimistic status;
14. product-owner acceptance is obtained when the milestone requires it.

`implemented`, `tested`, `accepted`, `merged` and `released` remain distinct states.

## 14. Expected audit outputs

The audit is considered complete only when it produces concrete evidence rather than a subjective statement that there are many tests.

Required outputs:

1. measured repository/package coverage baseline;
2. P0-P3 risk inventory;
3. behavior coverage matrix;
4. finite test-debt registry with closure conditions;
5. blocking policy validator and CI gates;
6. remediation evidence for P0 and P1 debt to the accepted target level;
7. property-based coverage for selected deterministic invariants;
8. mutation-testing baseline and selected P0 gates where cost/benefit supports them.

M8.3 may resume as the main product-development slice only after the testing-policy infrastructure is active and the agreed P0/P1 audit/remediation gate is satisfied or the product owner explicitly accepts a narrower documented transition criterion.

## 15. Non-goals

This programme does not:

- make recognition authoritative;
- change Vlezet document/schema authority merely for easier testing;
- change geometry/editor semantics without a separately justified product contract;
- require 100% repository-wide line coverage;
- require WebKit duplication of every Chromium test;
- require mutation testing for all UI code;
- permit lowering existing validators/benchmarks to fit tests;
- permit excluding difficult production code merely to improve coverage reports.

## 16. Success criteria

The design succeeds when future development cannot silently introduce executable production behavior without corresponding evidence, browser specs cannot silently fall outside mandatory discovery, project coverage cannot regress unnoticed, high-risk historical gaps are explicitly identified and systematically removed, and quality gates remain strict enough to catch real defects without encouraging tests written only to satisfy a percentage.