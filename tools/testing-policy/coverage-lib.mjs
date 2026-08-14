import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

import { isProductionPath } from "./config.mjs";

const METRICS = ["lines", "statements", "functions", "branches"];
const METRIC_FIELDS = ["covered", "total", "pct"];

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.join("\n") !== sortedExpected.join("\n")) {
    throw new Error(`${label} must be exactly: ${expected.join(", ")}`);
  }
}

function percentage(covered, total) {
  return total === 0 ? 100 : Math.round((covered * 10_000) / total) / 100;
}

function metric(covered, total) {
  return { covered, total, pct: percentage(covered, total) };
}

function emptyCounts() {
  return Object.fromEntries(METRICS.map((name) => [name, { covered: 0, total: 0 }]));
}

function addCounts(target, source) {
  for (const name of METRICS) {
    target[name].covered += source[name].covered;
    target[name].total += source[name].total;
  }
}

function finishCounts(counts) {
  return Object.fromEntries(
    METRICS.map((name) => [name, metric(counts[name].covered, counts[name].total)]),
  );
}

function normalizeRepositoryPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  const root = process.cwd().replaceAll("\\", "/");
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);
  if (!isAbsolute(normalized)) return normalized.replace(/^\.\//, "");
  return relative(process.cwd(), normalized).replaceAll("\\", "/");
}

function packageForPath(filePath) {
  const match = /^(apps|packages)\/[^/]+\//.exec(filePath);
  if (!match) throw new Error(`Coverage path is outside a workspace: ${filePath}`);
  return match[0].slice(0, -1);
}

function countHits(hits) {
  const values = Object.values(hits ?? {});
  return {
    covered: values.filter((hit) => Number.isFinite(hit) && hit > 0).length,
    total: values.length,
  };
}

function countBranches(branches) {
  return countHits(Object.values(branches ?? {}).flat());
}

function countLines(file) {
  const hitsByLine = new Map();
  for (const [id, location] of Object.entries(file.statementMap ?? {})) {
    const line = location?.start?.line;
    const hit = file.s?.[id];
    if (!Number.isSafeInteger(line) || line < 1) {
      throw new Error(`Invalid statement line in ${file.path}: ${line}`);
    }
    if (!Number.isFinite(hit) || hit < 0) {
      throw new Error(`Invalid statement count in ${file.path}: ${hit}`);
    }
    hitsByLine.set(line, (hitsByLine.get(line) ?? 0) + hit);
  }
  return countHits(Object.fromEntries(hitsByLine));
}

function countFile(file) {
  return {
    lines: countLines(file),
    statements: countHits(file.s),
    functions: countHits(file.f),
    branches: countBranches(file.b),
  };
}

export function summarizeCoverage(files) {
  if (!Array.isArray(files)) throw new TypeError("Coverage files must be an array");

  const repository = emptyCounts();
  const packages = new Map();
  const seen = new Set();

  for (const file of files) {
    if (!file || typeof file.path !== "string") {
      throw new TypeError("Every Istanbul coverage entry must have a path");
    }
    const filePath = normalizeRepositoryPath(file.path);
    if (seen.has(filePath)) throw new Error(`Duplicate coverage path: ${filePath}`);
    seen.add(filePath);

    const workspace = packageForPath(filePath);
    const counts = countFile(file);
    addCounts(repository, counts);
    if (!packages.has(workspace)) packages.set(workspace, emptyCounts());
    addCounts(packages.get(workspace), counts);
  }

  return {
    repository: finishCounts(repository),
    packages: Object.fromEntries(
      [...packages.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([workspace, counts]) => [workspace, finishCounts(counts)]),
    ),
  };
}

export function summarizeWorkspaceCoverage(filesByWorkspace) {
  if (!filesByWorkspace || typeof filesByWorkspace !== "object" || Array.isArray(filesByWorkspace)) {
    throw new TypeError("Workspace coverage must be an object");
  }

  const packages = {};
  const allFiles = [];
  for (const [workspace, files] of Object.entries(filesByWorkspace)) {
    if (!Array.isArray(files)) throw new TypeError(`${workspace} coverage must be an array`);
    for (const file of files) {
      const actualWorkspace = packageForPath(normalizeRepositoryPath(file.path));
      if (actualWorkspace !== workspace) {
        throw new Error(`${file.path} belongs to ${actualWorkspace}, not ${workspace}`);
      }
    }
    packages[workspace] = summarizeCoverage(files).repository;
    allFiles.push(...files);
  }

  return {
    repository: summarizeCoverage(allFiles).repository,
    packages,
  };
}

export async function readWorkspaceCoverageReports(root, workspaces) {
  const result = {};
  for (const workspace of workspaces) {
    const relativeReport = `${workspace}/coverage/coverage-final.json`;
    let source;
    try {
      source = await readFile(join(root, relativeReport), "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") throw new Error(`Missing coverage report: ${relativeReport}`);
      throw error;
    }

    let report;
    try {
      report = JSON.parse(source);
    } catch (error) {
      throw new Error(`Invalid coverage report ${relativeReport}: ${error.message}`);
    }
    if (!report || typeof report !== "object" || Array.isArray(report)) {
      throw new Error(`Coverage report must be an object: ${relativeReport}`);
    }
    const files = Object.values(report);
    for (const file of files) {
      if (!file || typeof file.path !== "string") {
        throw new Error(`Coverage report entry has no path: ${relativeReport}`);
      }
      const normalizedPath = normalizeRepositoryPath(file.path);
      if (!isProductionPath(normalizedPath) || packageForPath(normalizedPath) !== workspace) {
        throw new Error(`Coverage report contains an out-of-scope path: ${normalizedPath}`);
      }
    }
    result[workspace] = files;
  }
  return result;
}

function validateMetric(value, label) {
  requireExactKeys(value, METRIC_FIELDS, `${label} fields`);
  for (const field of ["covered", "total"]) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 0) {
      throw new Error(`${label} ${field} must be a non-negative safe integer`);
    }
  }
  if (value.covered > value.total) {
    throw new Error(`${label} covered ${value.covered} exceeds total ${value.total}`);
  }
  const measuredPct = percentage(value.covered, value.total);
  if (value.pct !== measuredPct) {
    throw new Error(
      `${label} pct ${value.pct} does not match measured counts ${value.covered}/${value.total} (${measuredPct.toFixed(2)}%)`,
    );
  }
}

export function compareMetricFloor(current, baseline, name = "coverage") {
  validateMetric(current, `${name} current`);
  validateMetric(baseline, `${name} baseline`);

  const below = baseline.total > 0
    && (current.total === 0
      || BigInt(current.covered) * BigInt(baseline.total)
        < BigInt(baseline.covered) * BigInt(current.total));
  if (!below) return [];

  return [
    `${name}: current ${current.covered}/${current.total} (${current.pct.toFixed(2)}%) is below baseline ${baseline.covered}/${baseline.total} (${baseline.pct.toFixed(2)}%)`,
  ];
}

export function compareCoverageFloors(current, baseline) {
  validateCoverageSummary(current);
  validateCoverageSummary(baseline);
  const failures = [];
  for (const name of METRICS) {
    failures.push(...compareMetricFloor(
      current.repository?.[name],
      baseline.repository?.[name],
      `repository ${name}`,
    ));
  }
  for (const [workspace, baselineMetrics] of Object.entries(baseline.packages ?? {})) {
    const currentMetrics = current.packages?.[workspace];
    if (!currentMetrics) {
      failures.push(`${workspace}: current coverage is missing`);
      continue;
    }
    for (const name of METRICS) {
      failures.push(...compareMetricFloor(
        currentMetrics[name],
        baselineMetrics[name],
        `${workspace} ${name}`,
      ));
    }
  }
  return failures;
}

export function validateCoverageSummary(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    throw new Error("Coverage summary must be an object");
  }
  requireExactKeys(summary.repository, METRICS, "repository metrics");
  for (const name of METRICS) validateMetric(summary.repository[name], `repository ${name}`);
  if (!summary.packages || typeof summary.packages !== "object" || Array.isArray(summary.packages)) {
    throw new Error("packages must be an object");
  }
  for (const [workspace, metrics] of Object.entries(summary.packages)) {
    requireExactKeys(metrics, METRICS, `${workspace} metrics`);
    for (const name of METRICS) validateMetric(metrics[name], `${workspace} ${name}`);
  }
}

export function validateBaseline(baseline, workspaces) {
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    throw new Error("Baseline must be an object");
  }
  const expectedFields = ["schemaVersion", "sourceCommit", "repository", "packages"];
  if (Object.keys(baseline).sort().join("\n") !== expectedFields.sort().join("\n")) {
    throw new Error(`Baseline fields must be exactly: ${expectedFields.join(", ")}`);
  }
  if (baseline.schemaVersion !== 1) throw new Error("Baseline schemaVersion must be 1");
  if (!/^[0-9a-f]{40}$/.test(baseline.sourceCommit)) {
    throw new Error("Baseline sourceCommit must be a full lowercase Git SHA");
  }

  const actualWorkspaces = Object.keys(baseline.packages ?? {}).sort();
  const expectedWorkspaces = [...workspaces].sort();
  if (actualWorkspaces.join("\n") !== expectedWorkspaces.join("\n")) {
    throw new Error("Baseline packages must exactly match configured workspaces");
  }
  validateCoverageSummary(baseline);

  for (const name of METRICS) {
    const packageCovered = Object.values(baseline.packages)
      .reduce((sum, packageSummary) => sum + packageSummary[name].covered, 0);
    const packageTotal = Object.values(baseline.packages)
      .reduce((sum, packageSummary) => sum + packageSummary[name].total, 0);
    if (baseline.repository[name].covered !== packageCovered
      || baseline.repository[name].total !== packageTotal) {
      throw new Error(`Repository ${name} counts do not equal package counts`);
    }
  }
}
