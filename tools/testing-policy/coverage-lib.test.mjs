import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  compareMetricFloor,
  readWorkspaceCoverageReports,
  summarizeCoverage,
  summarizeWorkspaceCoverage,
  validateBaseline,
} from "./coverage-lib.mjs";

const statement = (line) => ({
  start: { line, column: 0 },
  end: { line, column: 1 },
});

function baselineFixture() {
  return {
    schemaVersion: 1,
    sourceCommit: "95b99baf2d0f0aad51109b311c70c9b38aa3db38",
    ...summarizeWorkspaceCoverage({ "apps/web": [] }),
  };
}

test("aggregates Istanbul statements, functions, branches, and unique covered lines", () => {
  const summary = summarizeCoverage([
    {
      path: `${process.cwd()}/packages/example/src/a.ts`,
      statementMap: { 0: statement(1), 1: statement(2) },
      fnMap: { 0: {} },
      branchMap: { 0: {} },
      s: { 0: 1, 1: 0 },
      f: { 0: 1 },
      b: { 0: [1, 0, 2] },
    },
    {
      path: "packages\\example\\src\\b.ts",
      statementMap: { 0: statement(4), 1: statement(4) },
      fnMap: { 0: {}, 1: {} },
      branchMap: { 0: {} },
      s: { 0: 2, 1: 1 },
      f: { 0: 0, 1: 1 },
      b: { 0: [1] },
    },
  ]);

  assert.deepEqual(summary.repository, {
    lines: { covered: 2, total: 3, pct: 66.67 },
    statements: { covered: 3, total: 4, pct: 75 },
    functions: { covered: 2, total: 3, pct: 66.67 },
    branches: { covered: 3, total: 4, pct: 75 },
  });
  assert.deepEqual(summary.packages, {
    "packages/example": summary.repository,
  });
});

test("compares metric floors using integer ratios and names a regression", () => {
  const failures = compareMetricFloor(
    { covered: 89, total: 100, pct: 89 },
    { covered: 90, total: 100, pct: 90 },
    "repository branches",
  );

  assert.deepEqual(failures, [
    "repository branches: current 89/100 (89.00%) is below baseline 90/100 (90.00%)",
  ]);
  assert.deepEqual(
    compareMetricFloor(
      { covered: 66, total: 99, pct: 66.67 },
      { covered: 2, total: 3, pct: 66.67 },
      "repository lines",
    ),
    [],
  );
});

test("rejects a baseline percentage that was lowered without changing measured counts", () => {
  assert.throws(
    () => compareMetricFloor(
      { covered: 90, total: 100, pct: 90 },
      { covered: 90, total: 100, pct: 89.99 },
      "repository statements",
    ),
    /repository statements baseline pct 89\.99 does not match measured counts 90\/100 \(90\.00%\)/,
  );
});

test("rejects impossible measured counts", () => {
  assert.throws(
    () => compareMetricFloor(
      { covered: 4, total: 3, pct: 133.33 },
      { covered: 3, total: 3, pct: 100 },
      "packages/example functions",
    ),
    /packages\/example functions current covered 4 exceeds total 3/,
  );
});

test("retains a measured zero-file workspace in the package summary", () => {
  assert.deepEqual(
    summarizeWorkspaceCoverage({ "apps/web": [], "packages/example": [] }),
    {
      repository: {
        lines: { covered: 0, total: 0, pct: 100 },
        statements: { covered: 0, total: 0, pct: 100 },
        functions: { covered: 0, total: 0, pct: 100 },
        branches: { covered: 0, total: 0, pct: 100 },
      },
      packages: {
        "apps/web": {
          lines: { covered: 0, total: 0, pct: 100 },
          statements: { covered: 0, total: 0, pct: 100 },
          functions: { covered: 0, total: 0, pct: 100 },
          branches: { covered: 0, total: 0, pct: 100 },
        },
        "packages/example": {
          lines: { covered: 0, total: 0, pct: 100 },
          statements: { covered: 0, total: 0, pct: 100 },
          functions: { covered: 0, total: 0, pct: 100 },
          branches: { covered: 0, total: 0, pct: 100 },
        },
      },
    },
  );
});

test("requires the baseline schema and exact measured workspace set", () => {
  const baseline = baselineFixture();
  assert.doesNotThrow(() => validateBaseline(baseline, ["apps/web"]));
  assert.throws(
    () => validateBaseline({
      ...baseline,
    }, ["apps/web", "packages/domain"]),
    /Baseline packages must exactly match configured workspaces/,
  );
});

test("rejects extra fields in a baseline metric", () => {
  const baseline = baselineFixture();
  baseline.repository.lines.minimum = 95;

  assert.throws(
    () => validateBaseline(baseline, ["apps/web"]),
    /repository lines fields must be exactly: covered, total, pct/,
  );
});

test("rejects an extra repository metric", () => {
  const baseline = baselineFixture();
  baseline.repository.conditions = { covered: 0, total: 0, pct: 100 };

  assert.throws(
    () => validateBaseline(baseline, ["apps/web"]),
    /repository metrics must be exactly: lines, statements, functions, branches/,
  );
});

test("rejects an extra package metric", () => {
  const baseline = baselineFixture();
  baseline.packages["apps/web"].conditions = { covered: 0, total: 0, pct: 100 };

  assert.throws(
    () => validateBaseline(baseline, ["apps/web"]),
    /apps\/web metrics must be exactly: lines, statements, functions, branches/,
  );
});

test("refuses a missing workspace coverage report", async () => {
  const root = await mkdtemp(join(tmpdir(), "vlezet-coverage-"));
  try {
    await mkdir(join(root, "apps/web/coverage"), { recursive: true });
    await writeFile(join(root, "apps/web/coverage/coverage-final.json"), "{}\n");

    await assert.rejects(
      readWorkspaceCoverageReports(root, ["apps/web", "packages/domain"]),
      /Missing coverage report: packages\/domain\/coverage\/coverage-final\.json/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses coverage entries outside the configured production roots", async () => {
  const root = await mkdtemp(join(tmpdir(), "vlezet-coverage-scope-"));
  const reportPath = join(root, "packages/recognition/coverage/coverage-final.json");
  const sourcePath = `${process.cwd()}/packages/recognition/benchmarks/src/helper.ts`;
  try {
    await mkdir(join(root, "packages/recognition/coverage"), { recursive: true });
    await writeFile(reportPath, JSON.stringify({
      [sourcePath]: {
        path: sourcePath,
        statementMap: {},
        fnMap: {},
        branchMap: {},
        s: {},
        f: {},
        b: {},
      },
    }));

    await assert.rejects(
      readWorkspaceCoverageReports(root, ["packages/recognition"]),
      /Coverage report contains an out-of-scope path: packages\/recognition\/benchmarks\/src\/helper\.ts/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
