# Testing Policy Phase A Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the approved testing policy with honest coverage measurement, a non-decreasing ratchet, changed-code gates, fail-safe Playwright discovery/runtime guards, canonical audit truth, and blocking CI.

**Architecture:** Policy logic lives in small ESM modules under `tools/testing-policy/`; GitHub Actions invokes stable repository commands instead of embedding policy. All current Vitest 4.1.10 workspaces emit V8 JSON/LCOV. Chromium auto-discovers every executable `*.spec.mjs`; WebKit uses an explicit machine-checked representative subset. Phase A changes testing infrastructure only; P0/P1/property/mutation remediation gets separate plans after the real baseline exists.

**Tech Stack:** Node.js >=22.13.0, pnpm 11.15.1, Vitest 4.1.10, `@vitest/coverage-v8` 4.1.10, Playwright 1.54.2, GitHub Actions.

## Global Constraints

- Production behavior uses genuine RED -> GREEN when technically reproducible; never weaken validators, assertions, benchmark baselines, or thresholds for GREEN.
- Ordinary changed production code: lines/statements/functions >=95%, branches >=90%.
- Critical changed authority/data-integrity code: lines/statements/functions =100%, branches >=95%.
- Global targets remain repository 90/90/90/85 and critical areas 95/95/95/90; Phase A must measure before enforcing historical targets.
- First baseline is generated from real reports against accepted base `95b99baf2d0f0aad51109b311c70c9b38aa3db38`; numbers are never hand-authored.
- Browser retries remain `0`; every executable browser spec uses one shared runtime-error fixture.
- Docs-only/metadata-only changes have no artificial RED/changed-production requirement, but relevant gates still run.
- Canonical policy: `docs/testing/TESTING_POLICY.md`. Canonical audit/debt truth: `docs/testing/TEST_COVERAGE_AUDIT.md`.
- Vlezet architecture remains unchanged: `VlezetDocument`/mm authority, deterministic domain/geometry/editor-core, semantic Undo/Redo, M2 fit/collision authority, recognition non-authoritative.

## File Map

Create under `tools/testing-policy/`: `config.mjs`, `config.test.mjs`, `coverage-lib.mjs`, `coverage-lib.test.mjs`, `changed-coverage.mjs`, `changed-coverage.test.mjs`, `run-coverage.mjs`, `update-baseline.mjs`, `check-coverage.mjs`, `browser-policy.mjs`, `browser-policy.test.mjs`, `check-policy.mjs`, generated `coverage-baseline.json`.

Create `tools/m7-browser-audit/fixtures.mjs`; modify both Playwright configs and every `tools/m7-browser-audit/*.spec.mjs` import. Modify root/workspace manifests, lockfile, CI workflows, `CONTRIBUTING.md`, canonical testing docs, and project-state docs.

---

### Task 1: Policy constants and self-test

**Files:** Create `tools/testing-policy/config.mjs`, `config.test.mjs`; modify `package.json`.

**Produces:** `WORKSPACES`, ordinary/critical thresholds, `isProductionPath(path)`, `isCriticalPath(path)`.

- [ ] Write `config.test.mjs` first. It must assert exact thresholds and these workspaces: `apps/web`, `packages/domain`, `packages/editor-core`, `packages/geometry`, `packages/planning`, `packages/projects`, `packages/recognition`, `packages/spatial`.

```js
assert.deepEqual(ORDINARY_CHANGED_THRESHOLDS, { lines: 95, statements: 95, functions: 95, branches: 90 });
assert.deepEqual(CRITICAL_CHANGED_THRESHOLDS, { lines: 100, statements: 100, functions: 100, branches: 95 });
assert.equal(isProductionPath("packages/geometry/src/fit.test.ts"), false);
assert.equal(isCriticalPath("packages/geometry/src/fit.ts"), true);
assert.equal(isCriticalPath("apps/web/app/page.tsx"), false);
```

- [ ] Add root script `"test:policy": "node --test tools/testing-policy/*.test.mjs"` and run `pnpm test:policy`. Expected RED: missing `config.mjs`.
- [ ] Implement `config.mjs`. Production means code under root `apps/web/app`, root `apps/web/components`, or `packages/*/src`, excluding test/spec/declaration/generated/coverage files. Initial critical paths: all `domain`, `geometry`, `editor-core`, plus `projects` persistence/schema/file-format/migration/serialization modules.

```js
export function isProductionPath(file) {
  const p = file.replaceAll("\\", "/");
  return /^(?:apps\/web\/(?:app|components)|packages\/[^/]+\/src)\/.+\.(?:[cm]?[jt]sx?)$/.test(p)
    && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(p) && !p.endsWith(".d.ts");
}
```

- [ ] Run `pnpm test:policy && pnpm test`. Expected GREEN.
- [ ] Commit: `test: define blocking quality policy contract`.

---

### Task 2: Complete workspace coverage collection

**Files:** Create `run-coverage.mjs`; modify root `package.json`, all eight workspace `package.json` files, `pnpm-lock.yaml`, `config.test.mjs`.

- [ ] Extend policy test so every workspace must contain `vitest: 4.1.10`, `@vitest/coverage-v8: 4.1.10`, and `"coverage": "vitest run --coverage"`. Run `pnpm test:policy`; expected RED on missing provider/script.
- [ ] Add provider/script to all eight manifests; run `pnpm install` to update the lockfile, never edit it manually.
- [ ] Implement `run-coverage.mjs` to run each workspace sequentially. Use a tested coverage-include helper that returns absolute, workspace-rooted glob arguments: `apps/web` includes root `app/**/*.{ts,tsx,js,jsx,mjs,cjs}` and `components/**/*.{ts,tsx,js,jsx,mjs,cjs}`; every package includes root `src/**/*.{ts,tsx,js,jsx,mjs,cjs}`. Absolute globs are required because Vitest 4.1.10 treats relative `src/**/*` as matching nested paths such as `benchmarks/src`.

The command shape is:

```js
[
  "--dir", workspace, "exec", "vitest", "run", "--coverage",
  "--coverage.provider=v8",
  ...coverageIncludesForWorkspace(workspace).flatMap((include) => ["--coverage.include", include]),
  "--coverage.reporter=text", "--coverage.reporter=json", "--coverage.reporter=lcov",
  "--coverage.reportsDirectory=coverage",
]
```

Use `spawnSync("pnpm", args, { stdio: "inherit", shell: false })`; non-zero is fatal. Validate every emitted JSON entry against the same production-root contract so unintended nested paths fail closed. Add root `"coverage": "node tools/testing-policy/run-coverage.mjs"`.
- [ ] Run `pnpm coverage`; assert all eight `<workspace>/coverage/coverage-final.json` files exist. `coverage.include` is mandatory so unexecuted source is measured.
- [ ] Run `pnpm test:policy && pnpm test`. Expected GREEN.
- [ ] Commit: `test: collect complete workspace coverage`.

---

### Task 3: Measured baseline and anti-lowering ratchet

**Files:** Create `coverage-lib.mjs`, `coverage-lib.test.mjs`, `update-baseline.mjs`, `check-coverage.mjs`, generated `coverage-baseline.json`; modify root scripts.

**Interfaces:** `summarizeCoverage(files)`, `compareMetricFloor(current, baseline)`, baseline schema `{schemaVersion:1, sourceCommit, repository, packages}` with each metric `{covered,total,pct}`.

- [ ] Write synthetic RED tests for statement/function/branch/line aggregation and ratchet failure. Example: 3/4 covered branches => exactly 75%; current 89 vs baseline 90 => named failure.
- [ ] Run `node --test tools/testing-policy/coverage-lib.test.mjs`; expected RED: module absent.
- [ ] Implement aggregation from Istanbul JSON (`s`, `f`, `b`, `statementMap`). Normalize paths repository-relative. Compare ratios using integer counts; round displayed `pct` deterministically to 2 decimals.
- [ ] Implement `update-baseline.mjs`: refuse missing reports; accept no metric CLI overrides; write only measured values. Add scripts:

```json
"coverage:baseline": "node tools/testing-policy/update-baseline.mjs",
"coverage:check": "node tools/testing-policy/check-coverage.mjs"
```

- [ ] Run:

```bash
pnpm coverage
POLICY_BASE_SHA=95b99baf2d0f0aad51109b311c70c9b38aa3db38 pnpm coverage:baseline
```

Verify `sourceCommit` and all package totals/percentages against reports; no manual number edits.
- [ ] Implement `check-coverage.mjs`: recompute current coverage; reject current below HEAD baseline; compare HEAD baseline against base baseline loaded with `git show <POLICY_BASE_SHA>:tools/testing-policy/coverage-baseline.json`; reject lowering. Bootstrap is allowed only when the base file is absent **and** `baseline.sourceCommit === POLICY_BASE_SHA`.
- [ ] Unit-test tampering (`90 -> 89.99`) and impossible counts (`covered > total`). Run `node --test ...coverage-lib.test.mjs && pnpm coverage:check`. Expected GREEN.
- [ ] Commit: `test: enforce measured coverage ratchet`.

---

### Task 4: Changed executable coverage gate

**Files:** Create `changed-coverage.mjs`, `changed-coverage.test.mjs`; modify `check-coverage.mjs`.

**Interfaces:** `parseChangedLines(diff)`, `collectChangedCoverage(coverage, changedLines)`, `checkChangedCoverage(...)`.

- [ ] Write RED tests for zero-context diff parsing, docs-only N/A, uncovered changed statement, function whose full `loc` intersects changed lines although declaration starts earlier, and branch-arm intersection. Also prove a 94% branch result passes ordinary 90 but fails critical 95.
- [ ] Run `node --test tools/testing-policy/changed-coverage.test.mjs`; expected RED.
- [ ] Implement Git diff input:

```bash
git diff --unified=0 --no-color --diff-filter=ACMR <base>...HEAD -- apps packages
```

Use `POLICY_BASE_SHA`; local fallback `git merge-base HEAD origin/main`. Deleted code is ignored because it cannot execute in HEAD.
- [ ] Intersect changed lines with statement locations/counters, full function `loc`, branch `loc` and branch-arm locations. Check each changed production file against `isCriticalPath(path)`; diagnostics name file, metric, actual, required, and uncovered executable locations.
- [ ] Compose after ratchet checks. No changed executable production code => explicit `N/A`, not failure.
- [ ] Run:

```bash
pnpm coverage
POLICY_BASE_SHA=95b99baf2d0f0aad51109b311c70c9b38aa3db38 pnpm coverage:check
```

Expected GREEN because Phase-A source behavior is unchanged.
- [ ] Commit: `test: gate changed production coverage`.

---

### Task 5: Fail-safe browser discovery and shared runtime guard

**Files:** Create `browser-policy.mjs`, `browser-policy.test.mjs`, `tools/m7-browser-audit/fixtures.mjs`; modify both Playwright configs and every browser spec import.

- [ ] Write RED policy tests: discover all `tools/m7-browser-audit/*.spec.mjs`; current Chromium config must fail because it uses exhaustive literal registration. Every WebKit entry must exist. Every spec must fail the policy while importing directly from `@playwright/test`.
- [ ] Run `node --test tools/testing-policy/browser-policy.test.mjs`; expected RED.
- [ ] Put the **current** WebKit filenames in exported `WEBKIT_SPECS`; do not silently drop a case.
- [ ] Change Chromium config to automatic `testMatch: "**/*.spec.mjs"`; keep workers `1`, retries `0`, timeout/reporter/use unchanged. WebKit imports `WEBKIT_SPECS` and keeps its existing browser settings.
- [ ] Create shared fixture:

```js
import { test as base, expect } from "@playwright/test";
export const test = base.extend({
  runtimeErrorGuard: [async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", e => errors.push(`pageerror: ${e.message}`));
    page.on("console", m => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });
    await use();
    expect(errors, "unexpected browser runtime errors").toEqual([]);
  }, { auto: true }],
});
export { expect };
```

- [ ] Replace every spec import with `from "./fixtures.mjs"`. Remove the duplicate WeakMap/browser-error hooks from `m8-product-owner-regressions.spec.mjs`.
- [ ] Extend policy test to reject direct `@playwright/test` imports, retries other than 0, exhaustive Chromium lists, nonexistent WebKit specs, `test.only`/`describe.only`, and unregistered `test.skip`/`fixme`. Phase A has no skip allowlist.
- [ ] Run policy GREEN, then real Chromium + WebKit. Any new runtime error is an audit finding; do not globally suppress it. A required product fix becomes its own focused regression RED -> GREEN slice.
- [ ] Commit: `test: make browser acceptance fail-safe`.

---

### Task 6: Stable policy command and canonical docs/audit

**Files:** Create `check-policy.mjs`, `docs/testing/TESTING_POLICY.md`, `docs/testing/TEST_COVERAGE_AUDIT.md`; modify `package.json`, `CONTRIBUTING.md`, documentation validator if needed, `PROJECT_STATE.md`, `ROADMAP.md`, `CHANGELOG.md`.

- [ ] Add `"verify:policy": "node tools/testing-policy/check-policy.mjs && node tools/testing-policy/check-coverage.mjs"`. `check-policy.mjs` runs static discovery/config/source checks; coverage checks remain separate for clear diagnostics.
- [ ] Add a docs-contract RED requiring both canonical testing docs, exact changed-code thresholds, baseline source commit, and all eight workspace baseline rows; forbid unresolved `TBD`/`TODO` in canonical policy/audit.
- [ ] Run `pnpm validate:m7-docs` or the chosen policy validator; expected RED because docs are absent.
- [ ] Write `TESTING_POLICY.md` as the normative approved contract: change classes, RED/GREEN provenance, ratchet/changed-code rules, real Playwright flows, WebKit strategy, runtime-error/flake rules, non-runtime exception, debt discipline, property/mutation direction, Definition of Done.
- [ ] Write `TEST_COVERAGE_AUDIT.md` from generated baseline values. Table rows: repository, web, domain, editor-core, geometry, planning, projects, recognition, spatial. Record exact source commit and generation command. Record only confirmed gaps; IndexedDB failure paths remain an explicit P0 **audit candidate** until dedicated evidence proves coverage or debt. Missing same-name test file is never proof of no coverage.
- [ ] Update `CONTRIBUTING.md` to link the canonical policy and commands. Truth-sync state/roadmap/changelog only to actual branch status; do not call Phase A accepted/merged before acceptance/integration.
- [ ] Run `pnpm validate:m7-docs && pnpm test:policy && pnpm verify:policy`. Expected GREEN.
- [ ] Commit: `docs: make testing policy canonical`.

---

### Task 7: Blocking CI and evidence artifacts

**Files:** Modify `.github/workflows/ci.yml`, `.github/workflows/m7-browser-audit.yml`; add/modify a workflow contract test under `tools/testing-policy/`.

- [ ] Write RED workflow test requiring `fetch-depth: 0`, literal `pnpm coverage`, `pnpm verify:policy`, `POLICY_BASE_SHA`, and Browser Acceptance path triggers for `tools/testing-policy/**` + `docs/testing/**`. Run `pnpm test:policy`; expected RED.
- [ ] In CI set base SHA to PR base SHA or push `before` SHA, never PR head. Add distinct Coverage then Testing policy steps after unit tests. Keep recognition benchmark, typecheck, lint, build unchanged.

```yaml
env:
  POLICY_BASE_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event.before }}
```

- [ ] Tee `coverage.log` and `testing-policy.log`. Upload JSON/LCOV reports, baseline JSON, and logs for 14 days on `always()`. Never upload private plan rasters/provider responses.
- [ ] Add Browser Acceptance path triggers for policy/docs. Keep existing app/package/harness/package-lock triggers.
- [ ] Run `pnpm test:policy`; expected GREEN.
- [ ] Commit: `ci: block regressions with testing policy gates`.

---

### Task 8: Exact-head verification and Phase-B handoff

**Files:** Documentation/evidence only if facts discovered during verification require truth-sync.

- [ ] Run exact candidate head:

```bash
pnpm validate:m7-docs
pnpm test
pnpm coverage
POLICY_BASE_SHA=95b99baf2d0f0aad51109b311c70c9b38aa3db38 pnpm verify:policy
pnpm benchmark:recognition:core
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all GREEN with measured coverage matching baseline/audit.
- [ ] Run real Chromium and representative WebKit acceptance with retries 0 and shared runtime-error guard. Expected GREEN.
- [ ] Open/refresh Draft PR. PR evidence must distinguish tooling REDs, measured baseline, implemented gates, remaining OPEN debt, and unchanged product behavior.
- [ ] Require exact-head CI, Chromium, WebKit, and configured security/CodeQL evidence. Cross-check uploaded coverage JSON against `coverage-baseline.json` and `TEST_COVERAGE_AUDIT.md`; reject mismatch or unexplained exclusions.
- [ ] Present exact-head evidence and measured audit to product owner. Green CI does not equal acceptance. Merge only after explicit acceptance/protected integration.
- [ ] After accepted Phase A, use the measured audit to write a **separate P0 remediation implementation plan**. Then P1, then property/mutation rollout. Do not guess debt or mutation thresholds before their measured gates.

## Self-review requirements

Before execution confirm: every enforcement mechanism has a real tooling RED; bootstrap uses measured base `95b99baf...`; unexecuted `src` files are included; changed functions/branches use location intersection; docs-only diffs return N/A; Chromium discovery is automatic; WebKit subset is explicit/checked; every spec uses the shared fixture; retries stay zero; no production semantics are altered for policy GREEN; P0/P1/mutation remain separate evidence-driven plans.
