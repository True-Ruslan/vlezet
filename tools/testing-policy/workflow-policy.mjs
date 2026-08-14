import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const CI_WORKFLOW_PATH = ".github/workflows/ci.yml";
export const BROWSER_WORKFLOW_PATH = ".github/workflows/m7-browser-audit.yml";

export const POLICY_BASE_SHA_EXPRESSION =
  "${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event.before }}";

export const REQUIRED_BROWSER_PATHS = [
  "apps/web/**",
  "packages/**",
  "tools/m7-browser-audit/**",
  "tools/testing-policy/**",
  "docs/testing/**",
  ".github/workflows/m7-browser-audit.yml",
  "docs/PROJECT_STATE.md",
  "docs/ROADMAP.md",
  "docs/CHANGELOG.md",
  "docs/product/UX_BROWSER_EVIDENCE.md",
  "docs/product/UX_ROADMAP.md",
  "docs/milestones/**",
  "scripts/validate-m7-docs.mjs",
  "package.json",
  "pnpm-lock.yaml",
];

const FORBIDDEN_EVIDENCE = [
  /raster/i,
  /provider[-_ ]?response/i,
  /recognition-benchmark/,
  /m7-browser-audit/,
  /playwright/i,
];

export function namedStep(source, name) {
  const header = `- name: ${name}`;
  const start = source.indexOf(header);
  if (start === -1) return null;
  const rest = source.slice(start + header.length);
  const next = rest.search(/\n\s*- name: /);
  return header + (next === -1 ? rest : rest.slice(0, next));
}

function commandIndex(source, command) {
  const pattern = new RegExp(`(?:^|[\\s|])${command}(?:\\s|$)`, "m");
  const match = pattern.exec(source);
  return match ? match.index : -1;
}

export function ciWorkflowViolations(source) {
  const violations = [];
  const checkout = namedStep(source, "Checkout");
  if (!checkout) {
    violations.push("CI is missing the Checkout step");
  } else {
    if (!/fetch-depth:\s*0\b/.test(checkout)) {
      violations.push("CI checkout must set fetch-depth: 0");
    }
    if (!/persist-credentials:\s*false\b/.test(checkout)) {
      violations.push("CI checkout must keep persist-credentials: false");
    }
  }

  const assignments = [...source.matchAll(/POLICY_BASE_SHA:\s*(.+)/g)]
    .map((match) => match[1].trim());
  if (assignments.length === 0) {
    violations.push("CI must set POLICY_BASE_SHA");
  } else if (assignments.some((value) => value !== POLICY_BASE_SHA_EXPRESSION)) {
    violations.push("POLICY_BASE_SHA must be PR base SHA or push before SHA, never PR head");
  }
  if (assignments.some((value) => /head\.sha|github\.sha/.test(value))) {
    violations.push("POLICY_BASE_SHA must never use PR head or github.sha");
  }

  const coverageStep = namedStep(source, "Coverage");
  const policyStep = namedStep(source, "Testing policy");
  const uploadStep = namedStep(source, "Upload testing policy evidence");
  if (!coverageStep) violations.push("CI is missing a distinct Coverage step");
  if (!policyStep) violations.push("CI is missing a distinct Testing policy step");
  if (!uploadStep) violations.push("CI is missing the testing policy evidence upload");

  if (coverageStep) {
    if (!/pnpm coverage 2>&1 \| tee coverage\.log/.test(coverageStep)) {
      violations.push("Coverage must run literal pnpm coverage and tee coverage.log");
    }
    if (/node tools\/testing-policy\//.test(coverageStep)) {
      violations.push("Coverage must not inline node tools/testing-policy paths");
    }
  }
  if (policyStep) {
    if (!/pnpm test:policy 2>&1 \| tee testing-policy\.log/.test(policyStep)) {
      violations.push("Testing policy must run literal pnpm test:policy and tee testing-policy.log");
    }
    if (!/pnpm verify:policy 2>&1 \| tee -a testing-policy\.log/.test(policyStep)) {
      violations.push("Testing policy must run literal pnpm verify:policy and append testing-policy.log");
    }
    if (/node tools\/testing-policy\//.test(policyStep)) {
      violations.push("Testing policy must not inline node tools/testing-policy paths");
    }
  }

  const unitIndex = commandIndex(source, "pnpm test");
  const coverageIndex = commandIndex(source, "pnpm coverage");
  const policyTestIndex = commandIndex(source, "pnpm test:policy");
  const policyIndex = commandIndex(source, "pnpm verify:policy");
  const recognitionIndex = commandIndex(source, "pnpm benchmark:recognition:core");
  const typecheckIndex = commandIndex(source, "pnpm typecheck");
  const lintIndex = commandIndex(source, "pnpm lint");
  const buildIndex = commandIndex(source, "pnpm build");

  if (unitIndex === -1) violations.push("CI must keep the unit test step");
  if (coverageIndex === -1) violations.push("CI must run literal pnpm coverage");
  if (policyTestIndex === -1) violations.push("CI must run literal pnpm test:policy");
  if (policyIndex === -1) violations.push("CI must run literal pnpm verify:policy");
  if (recognitionIndex === -1) violations.push("CI must keep the recognition benchmark");
  if (typecheckIndex === -1) violations.push("CI must keep typecheck");
  if (lintIndex === -1) violations.push("CI must keep lint");
  if (buildIndex === -1) violations.push("CI must keep build");

  if (
    unitIndex !== -1
    && coverageIndex !== -1
    && policyTestIndex !== -1
    && policyIndex !== -1
    && recognitionIndex !== -1
    && !(unitIndex < coverageIndex && coverageIndex < policyTestIndex
      && policyTestIndex < policyIndex && policyIndex < recognitionIndex)
  ) {
    violations.push("Coverage then Testing policy self-tests and enforcement must run after unit tests and before recognition");
  }
  if (
    recognitionIndex !== -1
    && typecheckIndex !== -1
    && lintIndex !== -1
    && buildIndex !== -1
    && !(recognitionIndex < typecheckIndex && typecheckIndex < lintIndex && lintIndex < buildIndex)
  ) {
    violations.push("Recognition benchmark, typecheck, lint, and build order must stay unchanged");
  }

  if (uploadStep) {
    if (!/if:\s*always\(\)/.test(uploadStep)) {
      violations.push("Testing policy evidence must upload on always()");
    }
    if (!/retention-days:\s*14\b/.test(uploadStep)) {
      violations.push("Testing policy evidence must retain artifacts for 14 days");
    }
    if (!/coverage\.log/.test(uploadStep)) {
      violations.push("Testing policy evidence must include coverage.log");
    }
    if (!/testing-policy\.log/.test(uploadStep)) {
      violations.push("Testing policy evidence must include testing-policy.log");
    }
    if (!/tools\/testing-policy\/coverage-baseline\.json/.test(uploadStep)) {
      violations.push("Testing policy evidence must include baseline JSON");
    }
    if (!/coverage-final\.json/.test(uploadStep)) {
      violations.push("Testing policy evidence must include JSON coverage reports");
    }
    if (!/lcov\.info/.test(uploadStep)) {
      violations.push("Testing policy evidence must include LCOV reports");
    }
    for (const pattern of FORBIDDEN_EVIDENCE) {
      if (pattern.test(uploadStep)) {
        violations.push("Testing policy evidence must not upload private plan rasters, provider responses, or browser artifacts");
        break;
      }
    }
  }

  return violations;
}

export function browserWorkflowViolations(source) {
  return REQUIRED_BROWSER_PATHS
    .filter((path) => !source.includes(`- "${path}"`))
    .map((path) => `Browser Acceptance is missing path trigger: ${path}`);
}

export async function workflowPolicyViolations(repositoryRoot = process.cwd()) {
  const [ci, browser] = await Promise.all([
    readFile(join(repositoryRoot, CI_WORKFLOW_PATH), "utf8"),
    readFile(join(repositoryRoot, BROWSER_WORKFLOW_PATH), "utf8"),
  ]);
  return [
    ...ciWorkflowViolations(ci),
    ...browserWorkflowViolations(browser),
  ];
}
