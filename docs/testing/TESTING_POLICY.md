# Vlezet Testing Policy

**Status:** canonical approved contract for this repository. Machine-readable thresholds, discovery rules and baselines live under `tools/testing-policy/` and must stay consistent with this document. This file is the human-readable source of truth.

Coverage is a blocking secondary signal. It does not replace behavioral contracts, failure-path tests, browser user flows, or genuine RED -> GREEN evidence.

## Commands

```bash
pnpm test:policy
pnpm verify:policy
pnpm coverage
pnpm coverage:check
```

`pnpm test:policy` runs the policy self-tests. `pnpm verify:policy` runs static discovery/config/source/docs checks, then the coverage ratchet and changed-code gate. `pnpm coverage` measures every workspace; `pnpm coverage:check` is the coverage half of `verify:policy`.

Do not weaken a validator, assertion, benchmark, baseline or threshold merely to obtain GREEN.

## Change classification

Every change must be classified by affected behavior and risk. One pull request may belong to multiple classes; all applicable evidence requirements accumulate.

### Deterministic domain/authority changes

Examples: `packages/domain`, `packages/geometry`, `packages/editor-core`, topology and structural editing, validators, fit/collision and clearance authority, semantic history, and planning constraints that can change accepted document state.

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

### Persistence, migrations, import/export and local storage

Examples: IndexedDB schema/open/upgrade paths, project repository persistence, document/storage migrations, project import/export, and reference-plan/asset persistence.

Required evidence:

- integration-level contract, not only a memory fake;
- successful round trip;
- malformed/legacy input where relevant;
- open/upgrade/transaction failure behavior;
- recovery or fail-closed behavior;
- preservation of unrelated project data;
- changed-code coverage and ratchet gates.

### Store/runtime coordination

Examples: Zustand action surfaces, runtime singleton repair, and coordination between Canvas events, store actions and editor-core commands.

Required evidence:

- unit/integration contract for state semantics;
- browser regression when the behavior is user-visible;
- protection against stale/runtime shape failures where the runtime makes them possible.

### Canvas and direct manipulation

Any change involving pointer acquisition/hit areas, drawing, wall/vertex/opening/furniture drag, selection and marquee, multiselect, snapping, UI-initiated copy/paste, keyboard shortcuts, UI-initiated Undo/Redo, or room/furniture/opening direct manipulation is browser-critical.

Required evidence is a real Playwright user flow that exercises the complete path:

`user input -> DOM/Konva event -> store/runtime coordination -> deterministic operation -> rendered/resulting state`.

A unit test that directly invokes the store or editor-core function is necessary where appropriate but is not sufficient for this class of change.

### Other browser-visible UI workflows

Examples: project lifecycle, onboarding, calibration, persistence visible to the user, and panels that control editor behavior.

Required evidence:

- Chromium browser acceptance for critical flow changes;
- representative WebKit evidence where the behavior can differ at browser/input/rendering boundaries.

### Recognition

Recognition remains experimental assistance and uses its existing deterministic benchmark/evidence contract. Changes must not weaken benchmark baselines simply to obtain GREEN.

## RED -> GREEN provenance

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

If a genuine pre-fix RED cannot be reproduced for a technical reason, the pull request must state that limitation explicitly; it cannot label the sequence genuine RED -> GREEN.

## Coverage ratchet and changed-code rules

Coverage is enforced by three independent mechanisms. Numbers in this section are normative. The implementation in `tools/testing-policy/config.mjs` and `tools/testing-policy/coverage-baseline.json` must match them.

### Repository ratchet

The first baseline is measured, never hand-authored. It records lines, statements, functions and branches for the repository and every coverage workspace.

A pull request must not lower the accepted repository or package baseline. Historical debt may stay level temporarily or improve; it cannot silently regress. Branch coverage is a first-class metric because validation, rejection and error behavior commonly live behind branches even when line coverage looks high.

The measured Phase A baseline is recorded in `docs/testing/TEST_COVERAGE_AUDIT.md` from `tools/testing-policy/coverage-baseline.json`.

### Changed-code thresholds

For ordinary production code changed by a pull request:

- lines >= 95%;
- statements >= 95%;
- functions >= 95%;
- branches >= 90%.

For critical authority/data-integrity areas changed by a pull request:

- lines = 100%;
- statements = 100%;
- functions = 100%;
- branches >= 95%.

Critical areas initially include all production code in `packages/domain`, `packages/geometry` and `packages/editor-core`, plus `packages/projects` persistence, repository, IndexedDB, schema, file-format, migration and serialization modules. Meeting these percentages does not waive scenario requirements.

Docs-only and metadata-only diffs that change no executable production code return explicit `N/A` for changed-code coverage; they are not a failure. Deleted code is ignored because it cannot execute in HEAD.

### Global target floors

Historical debt is remediated toward these later target floors. Phase A measures and ratchets the current baseline; it does not invent historical enforcement of these floors.

Critical packages/areas:

- lines/statements >= 95%;
- functions >= 95%;
- branches >= 90%.

Repository production code overall:

- lines/statements/functions >= 90%;
- branches >= 85%.

These are minimum protection targets, not a reason to add meaningless tests solely to reach a number.

## Playwright user flows

Chromium browser acceptance discovers every executable `tools/m7-browser-audit/*.spec.mjs` automatically. A repository contract test must fail if a new executable browser spec can exist without being discovered by the mandatory suite.

Every browser spec must import the shared fixtures in `tools/m7-browser-audit/fixtures.mjs`. Direct imports from `@playwright/test` are forbidden in executable specs.

Canvas and direct-manipulation changes require a real Playwright user flow, not only a unit invocation of the store or editor-core function.

## WebKit strategy

WebKit remains representative rather than blindly duplicating every Chromium test. The selection is the explicit `WEBKIT_SPECS` registry in `tools/testing-policy/browser-policy.mjs` and is machine-checked: every entry must exist, order must be preserved, and the WebKit Playwright config must consume that registry.

Cross-browser-critical flows include browser/input/rendering boundaries such as pointer/drag acquisition, Canvas hit detection, calibration/input workflows, persistence behavior with browser APIs, and representative project lifecycle and direct-manipulation smoke. The audit may expand the subset when evidence identifies browser-specific risk.

## Runtime errors and flakiness

Every mandatory Playwright test receives the shared `runtimeErrorGuard`. Unexpected `pageerror`, `console.error`, and detectable unhandled rejection/runtime error fail the test. Expected errors must be explicitly scoped and asserted; broad global suppression is forbidden.

Mandatory browser acceptance runs with retries `0`. A flaky test is a defect in the test or product and must be diagnosed. It must not be hidden by increasing retry counts.

Focused tests (`test.only`, `describe.only`) are forbidden. Intentional skips and `fixme` markers must be rare, explicit, traceable to a debt item or supported platform reason, and machine-visible to the policy validator. Phase A has no skip allowlist; unregistered `test.skip` / `test.fixme` fail the policy.

## Non-runtime exception

A risk-based exception exists only when the change objectively does not alter product/runtime behavior.

Examples:

- documentation-only changes;
- metadata-only changes;
- some dependency/configuration changes where runtime behavior is provably unaffected.

Such changes do not need artificial RED -> GREEN evidence or changed-code production coverage. They still run every relevant documentation, build, security, dependency, configuration, or browser gate required by the files and risks they touch.

There is no equivalent exception for production behavior.

## Test-debt discipline

Historical gaps are recorded only in `docs/testing/TEST_COVERAGE_AUDIT.md`. Every entry describes a concrete behavior and a verifiable closing condition. The registry must not become an unbounded placeholder dump.

Future modifications to an area with known debt cannot use the existence of debt as permission to add more uncovered behavior. A missing same-name test file is never proof of no coverage.

Remediation order is P0 -> P1 -> P2 -> P3 unless a currently blocking defect justifies promotion. Phase A establishes the measured baseline and gates; P0/P1/property/mutation remediation are separate evidence-driven plans after that baseline exists.

## Property-based and mutation testing

Property-based tests are added where deterministic invariants are more trustworthy than enumerating many hand-picked fixtures. They supplement focused example/regression tests; they do not replace them. Property failures must print or persist the seed and shrunk counterexample.

Initial target invariants include, where mathematically applicable: translation preserving distances/lengths/areas; symmetric distance; equivalent polygon traversal preserving derived area; accepted hosted-opening movement staying in host and passing overlap validation; accepted structural commands creating no dangling references; Undo restoring the pre-command semantic document; Redo restoring the committed result; serialization round trips preserving semantic document equality; and deterministic transformations producing reproducible output.

Mutation testing is introduced selectively after P0 areas have meaningful ordinary and property coverage. Initial mutation targets are validators, geometry predicates, topology/structural guards, migrations, opening constraints, collision/fit authority, and semantic history invariants. Mutation testing is not required for every React/UI file. Mutation thresholds must not be invented before an observational baseline exists.

## Definition of Done

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

`implemented`, `tested`, `accepted`, `merged` and `released` remain distinct states. Green CI does not imply product acceptance.
