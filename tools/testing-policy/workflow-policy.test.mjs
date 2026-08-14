import assert from "node:assert/strict";
import test from "node:test";

import {
  POLICY_BASE_SHA_EXPRESSION,
  REQUIRED_BROWSER_PATHS,
  browserWorkflowViolations,
  ciWorkflowViolations,
  workflowPolicyViolations,
} from "./workflow-policy.mjs";

const CI_WITHOUT_GATES = `
name: CI
jobs:
  verify:
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          persist-credentials: false
      - name: Unit tests
        run: |
          pnpm test 2>&1 | tee test.log
      - name: Core Recognition Benchmark
        env:
          RECOGNITION_BENCHMARK_COMMIT_SHA: \${{ github.event.pull_request.head.sha || github.sha }}
        run: pnpm benchmark:recognition:core
      - name: Typecheck
        run: pnpm typecheck
      - name: Lint
        run: pnpm lint
      - name: Build
        run: pnpm build
`;

const BROWSER_WITHOUT_POLICY_PATHS = `
name: Browser Acceptance
on:
  pull_request:
    paths:
      - "apps/web/**"
      - "packages/**"
      - "tools/m7-browser-audit/**"
      - ".github/workflows/m7-browser-audit.yml"
      - "docs/PROJECT_STATE.md"
      - "docs/ROADMAP.md"
      - "docs/CHANGELOG.md"
      - "docs/product/UX_BROWSER_EVIDENCE.md"
      - "docs/product/UX_ROADMAP.md"
      - "docs/milestones/**"
      - "scripts/validate-m7-docs.mjs"
      - "package.json"
      - "pnpm-lock.yaml"
`;

test("rejects CI without fetch-depth, coverage, policy gates, or POLICY_BASE_SHA", () => {
  const violations = ciWorkflowViolations(CI_WITHOUT_GATES);
  assert.ok(violations.includes("CI checkout must set fetch-depth: 0"));
  assert.ok(violations.includes("CI must set POLICY_BASE_SHA"));
  assert.ok(violations.includes("CI must run literal pnpm coverage"));
  assert.ok(violations.includes("CI must run literal pnpm verify:policy"));
  assert.ok(violations.includes("CI is missing a distinct Coverage step"));
  assert.ok(violations.includes("CI is missing a distinct Testing policy step"));
  assert.ok(violations.includes("CI is missing the testing policy evidence upload"));
});

test("rejects POLICY_BASE_SHA taken from PR head", () => {
  const violations = ciWorkflowViolations(`
    env:
      POLICY_BASE_SHA: \${{ github.event.pull_request.head.sha }}
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          persist-credentials: false
          fetch-depth: 0
      - name: Coverage
        run: pnpm coverage 2>&1 | tee coverage.log
      - name: Testing policy
        run: pnpm verify:policy 2>&1 | tee testing-policy.log
  `);
  assert.ok(violations.includes("POLICY_BASE_SHA must be PR base SHA or push before SHA, never PR head"));
  assert.ok(violations.includes("POLICY_BASE_SHA must never use PR head or github.sha"));
});

test("requires the exact POLICY_BASE_SHA expression", () => {
  assert.match(
    POLICY_BASE_SHA_EXPRESSION,
    /github\.event_name == 'pull_request' && github\.event\.pull_request\.base\.sha \|\| github\.event\.before/,
  );
});

test("rejects Browser Acceptance without policy and docs path triggers", () => {
  const violations = browserWorkflowViolations(BROWSER_WITHOUT_POLICY_PATHS);
  assert.deepEqual(violations, [
    'Browser Acceptance is missing path trigger: tools/testing-policy/**',
    'Browser Acceptance is missing path trigger: docs/testing/**',
  ]);
});

test("keeps existing Browser Acceptance app, package, harness, and lockfile triggers", () => {
  assert.ok(REQUIRED_BROWSER_PATHS.includes("apps/web/**"));
  assert.ok(REQUIRED_BROWSER_PATHS.includes("packages/**"));
  assert.ok(REQUIRED_BROWSER_PATHS.includes("tools/m7-browser-audit/**"));
  assert.ok(REQUIRED_BROWSER_PATHS.includes("package.json"));
  assert.ok(REQUIRED_BROWSER_PATHS.includes("pnpm-lock.yaml"));
});

test("current GitHub workflows satisfy the testing-policy contract", async () => {
  assert.deepEqual(await workflowPolicyViolations(), []);
});
