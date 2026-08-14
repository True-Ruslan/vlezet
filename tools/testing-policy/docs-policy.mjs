import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  CRITICAL_CHANGED_THRESHOLDS,
  ORDINARY_CHANGED_THRESHOLDS,
  WORKSPACES,
} from "./config.mjs";

export const CANONICAL_POLICY_PATH = "docs/testing/TESTING_POLICY.md";
export const CANONICAL_AUDIT_PATH = "docs/testing/TEST_COVERAGE_AUDIT.md";
export const BASELINE_PATH = "tools/testing-policy/coverage-baseline.json";
export const ACCEPTED_BASE_SHA = "95b99baf2d0f0aad51109b311c70c9b38aa3db38";

export const POLICY_REQUIRED_HEADINGS = [
  "Change classification",
  "RED -> GREEN provenance",
  "Coverage ratchet and changed-code rules",
  "Playwright user flows",
  "WebKit strategy",
  "Runtime errors and flakiness",
  "Non-runtime exception",
  "Test-debt discipline",
  "Property-based and mutation testing",
  "Definition of Done",
];

export const AUDIT_ROW_LABELS = [
  "repository",
  "web",
  "domain",
  "editor-core",
  "geometry",
  "planning",
  "projects",
  "recognition",
  "spatial",
];

export const AUDIT_ROW_WORKSPACES = {
  web: "apps/web",
  domain: "packages/domain",
  "editor-core": "packages/editor-core",
  geometry: "packages/geometry",
  planning: "packages/planning",
  projects: "packages/projects",
  recognition: "packages/recognition",
  spatial: "packages/spatial",
};

const METRICS = ["lines", "statements", "functions", "branches"];

export function formatCoverageCell(metric) {
  return `${metric.covered}/${metric.total} (${metric.pct}%)`;
}

async function readOptional(repositoryRoot, relativePath) {
  try {
    return await readFile(join(repositoryRoot, relativePath), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function placeholderViolations(path, source) {
  return /\b(?:TBD|TODO)\b/i.test(source) ? [`Unresolved TBD/TODO in ${path}`] : [];
}

function requireNeedles(path, source, needles, label) {
  return needles
    .filter((needle) => !source.includes(needle))
    .map((needle) => `${path} is missing ${label}: ${needle}`);
}

export async function canonicalDocsViolations(repositoryRoot = process.cwd()) {
  const violations = [];
  const policy = await readOptional(repositoryRoot, CANONICAL_POLICY_PATH);
  const audit = await readOptional(repositoryRoot, CANONICAL_AUDIT_PATH);

  if (policy === null) violations.push(`Missing canonical testing document: ${CANONICAL_POLICY_PATH}`);
  if (audit === null) violations.push(`Missing canonical testing document: ${CANONICAL_AUDIT_PATH}`);
  if (policy === null || audit === null) return violations;

  violations.push(...placeholderViolations(CANONICAL_POLICY_PATH, policy));
  violations.push(...placeholderViolations(CANONICAL_AUDIT_PATH, audit));
  violations.push(...POLICY_REQUIRED_HEADINGS
    .filter((heading) => !policy.includes(`## ${heading}`))
    .map((heading) => `${CANONICAL_POLICY_PATH} is missing heading: ${heading}`));
  violations.push(...requireNeedles(CANONICAL_POLICY_PATH, policy, [
    `lines >= ${ORDINARY_CHANGED_THRESHOLDS.lines}%`,
    `statements >= ${ORDINARY_CHANGED_THRESHOLDS.statements}%`,
    `functions >= ${ORDINARY_CHANGED_THRESHOLDS.functions}%`,
    `branches >= ${ORDINARY_CHANGED_THRESHOLDS.branches}%`,
  ], "ordinary changed-code threshold"));
  violations.push(...requireNeedles(CANONICAL_POLICY_PATH, policy, [
    `lines = ${CRITICAL_CHANGED_THRESHOLDS.lines}%`,
    `statements = ${CRITICAL_CHANGED_THRESHOLDS.statements}%`,
    `functions = ${CRITICAL_CHANGED_THRESHOLDS.functions}%`,
    `branches >= ${CRITICAL_CHANGED_THRESHOLDS.branches}%`,
  ], "critical changed-code threshold"));

  const baselineSource = await readOptional(repositoryRoot, BASELINE_PATH);
  if (baselineSource === null) {
    violations.push(`Missing coverage baseline: ${BASELINE_PATH}`);
    return violations;
  }

  const baseline = JSON.parse(baselineSource);
  if (baseline.sourceCommit !== ACCEPTED_BASE_SHA) {
    violations.push(`Baseline sourceCommit must be ${ACCEPTED_BASE_SHA}`);
  }
  if (!audit.includes(ACCEPTED_BASE_SHA)) {
    violations.push(`${CANONICAL_AUDIT_PATH} must record baseline source commit ${ACCEPTED_BASE_SHA}`);
  }
  if (!audit.includes("pnpm coverage:baseline")) {
    violations.push(`${CANONICAL_AUDIT_PATH} must record the baseline generation command`);
  }
  if (!/IndexedDB/i.test(audit) || !/audit candidate/i.test(audit)) {
    violations.push(
      `${CANONICAL_AUDIT_PATH} must keep IndexedDB failure paths as an explicit P0 audit candidate`,
    );
  }
  if (!/missing same-name test file is never proof of no coverage/i.test(audit)) {
    violations.push(
      `${CANONICAL_AUDIT_PATH} must state that a missing same-name test file is never proof of no coverage`,
    );
  }

  const expectedWorkspaces = [...WORKSPACES].sort();
  const actualWorkspaces = Object.keys(baseline.packages ?? {}).sort();
  if (actualWorkspaces.join("\n") !== expectedWorkspaces.join("\n")) {
    violations.push("Baseline packages must include all eight coverage workspaces");
  }

  for (const label of AUDIT_ROW_LABELS) {
    if (!new RegExp(`\\|\\s*${label}\\s*\\|`, "i").test(audit)) {
      violations.push(`${CANONICAL_AUDIT_PATH} is missing baseline row: ${label}`);
      continue;
    }
    const metrics = label === "repository"
      ? baseline.repository
      : baseline.packages?.[AUDIT_ROW_WORKSPACES[label]];
    if (!metrics) {
      violations.push(`${CANONICAL_AUDIT_PATH} ${label} has no measured baseline metrics`);
      continue;
    }
    for (const name of METRICS) {
      const cell = formatCoverageCell(metrics[name]);
      if (!audit.includes(cell)) {
        violations.push(`${CANONICAL_AUDIT_PATH} ${label} is missing measured ${name} value ${cell}`);
      }
    }
  }

  return violations;
}
