import assert from "node:assert/strict";
import test from "node:test";

import {
  checkChangedCoverage,
  collectChangedCoverage,
  parseChangedLines,
} from "./changed-coverage.mjs";

const location = (startLine, endLine = startLine) => ({
  start: { line: startLine, column: 0 },
  end: { line: endLine, column: 1 },
});

function coverageFile(path, overrides = {}) {
  return {
    path,
    statementMap: {},
    fnMap: {},
    branchMap: {},
    s: {},
    f: {},
    b: {},
    ...overrides,
  };
}

test("parses zero-context new-line ranges and ignores deleted-only hunks", () => {
  const changed = parseChangedLines(`diff --git a/packages/planning/src/solver.ts b/packages/planning/src/solver.ts
index 1111111..2222222 100644
--- a/packages/planning/src/solver.ts
+++ b/packages/planning/src/solver.ts
@@ -2,0 +3,2 @@
+const first = 1;
+const second = 2;
@@ -8,2 +9,0 @@
-const deleted = 1;
-const deletedToo = 2;
@@ -12 +11 @@
-const oldValue = 1;
+const newValue = 2;
`);

  assert.deepEqual(changed, new Map([
    ["packages/planning/src/solver.ts", new Set([3, 4, 11])],
  ]));
});

test("does not treat added source beginning with pluses as a destination header", () => {
  const changed = parseChangedLines(`diff --git a/packages/planning/src/solver.ts b/packages/planning/src/solver.ts
index 1111111..2222222 100644
--- a/packages/planning/src/solver.ts
+++ b/packages/planning/src/solver.ts
@@ -2,0 +3 @@
+++ b/not-a-diff-header;
@@ -8,0 +10 @@
+const later = true;
`);

  assert.deepEqual(changed, new Map([
    ["packages/planning/src/solver.ts", new Set([3, 10])],
  ]));
});

test("reports N/A when a diff contains no executable production code", () => {
  const changed = parseChangedLines(`diff --git a/docs/testing.md b/docs/testing.md
index 1111111..2222222 100644
--- a/docs/testing.md
+++ b/docs/testing.md
@@ -1,0 +2 @@
+Policy details.
`);

  assert.deepEqual(checkChangedCoverage([], changed), {
    applicable: false,
    files: [],
    failures: [],
  });
});

test("fails an uncovered changed statement and names its executable location", () => {
  const path = "packages/planning/src/solver.ts";
  const coverage = [coverageFile(path, {
    statementMap: { 0: location(5) },
    s: { 0: 0 },
  })];

  const result = checkChangedCoverage(coverage, new Map([[path, new Set([5])]]));

  assert.equal(result.applicable, true);
  assert.deepEqual(result.failures, [
    `${path} lines: actual 0/1 (0.00%), required 95.00%; uncovered executable locations: ${path}:5`,
    `${path} statements: actual 0/1 (0.00%), required 95.00%; uncovered executable locations: ${path}:5:0-5:1`,
  ]);
});

test("accepts V8 open-ended locations serialized with a null end column", () => {
  const path = "apps/web/app/page.tsx";
  const coverage = [coverageFile(path, {
    statementMap: {
      0: {
        start: { line: 5, column: 0 },
        end: { line: 6, column: null },
      },
    },
    s: { 0: 0 },
  })];

  let files;
  assert.doesNotThrow(() => {
    files = collectChangedCoverage(coverage, new Map([[path, new Set([6])]]));
  });
  const [file] = files ?? [];

  assert.deepEqual(file.metrics.statements.uncovered, ["5:0-6:*"]);
});

test("counts a function when a changed line intersects its full loc", () => {
  const path = "packages/planning/src/solver.ts";
  const coverage = [coverageFile(path, {
    fnMap: {
      0: {
        name: "solve",
        decl: location(10),
        loc: location(10, 20),
        line: 10,
      },
    },
    f: { 0: 0 },
  })];

  const [file] = collectChangedCoverage(coverage, new Map([[path, new Set([15])]]));

  assert.deepEqual(file.metrics.functions, {
    covered: 0,
    total: 1,
    pct: 0,
    uncovered: ["10:0-20:1"],
  });
});

test("counts a branch arm when the changed line intersects the arm location", () => {
  const path = "packages/planning/src/solver.ts";
  const coverage = [coverageFile(path, {
    branchMap: {
      0: {
        type: "if",
        loc: location(10),
        locations: [location(11), location(20)],
        line: 10,
      },
    },
    b: { 0: [1, 0] },
  })];

  const [file] = collectChangedCoverage(coverage, new Map([[path, new Set([20])]]));

  assert.deepEqual(file.metrics.branches, {
    covered: 0,
    total: 1,
    pct: 0,
    uncovered: ["20:0-20:1"],
  });
});

test("counts every branch arm when a changed line intersects the branch loc", () => {
  const path = "packages/planning/src/solver.ts";
  const coverage = [coverageFile(path, {
    branchMap: {
      0: {
        type: "if",
        loc: location(10),
        locations: [location(11), location(20)],
        line: 10,
      },
    },
    b: { 0: [1, 0] },
  })];

  const files = collectChangedCoverage(coverage, new Map([[path, new Set([10])]]));

  assert.equal(files.length, 1);
  const [file] = files;
  assert.deepEqual(file.metrics.branches, {
    covered: 1,
    total: 2,
    pct: 50,
    uncovered: ["20:0-20:1"],
  });
});

test("uses the branch loc for V8 implicit arms that have empty locations", () => {
  const path = "apps/web/components/editor/example.tsx";
  const coverage = [coverageFile(path, {
    branchMap: {
      0: {
        type: "if",
        loc: location(10),
        locations: [location(10), { start: {}, end: {} }],
        line: 10,
      },
    },
    b: { 0: [1, 0] },
  })];

  let files;
  assert.doesNotThrow(() => {
    files = collectChangedCoverage(coverage, new Map([[path, new Set([10])]]));
  });
  assert.deepEqual(files?.[0].metrics.branches, {
    covered: 1,
    total: 2,
    pct: 50,
    uncovered: ["10:0-10:1"],
  });
});

test("allows 94 percent branch coverage for ordinary code but rejects it for critical code", () => {
  const branch = {
    type: "switch",
    loc: location(1),
    locations: Array.from({ length: 100 }, () => location(2)),
    line: 1,
  };
  const branchHits = [...Array(94).fill(1), ...Array(6).fill(0)];

  const ordinaryPath = "packages/planning/src/solver.ts";
  const ordinary = checkChangedCoverage(
    [coverageFile(ordinaryPath, { branchMap: { 0: branch }, b: { 0: branchHits } })],
    new Map([[ordinaryPath, new Set([2])]]),
  );
  assert.deepEqual(ordinary.failures, []);

  const criticalPath = "packages/geometry/src/solver.ts";
  const critical = checkChangedCoverage(
    [coverageFile(criticalPath, { branchMap: { 0: branch }, b: { 0: branchHits } })],
    new Map([[criticalPath, new Set([2])]]),
  );
  assert.equal(critical.failures.length, 1);
  assert.match(
    critical.failures[0],
    /^packages\/geometry\/src\/solver\.ts branches: actual 94\/100 \(94\.00%\), required 95\.00%; uncovered executable locations:/,
  );
});

test("compares threshold ratios exactly when two-decimal coverage rounds up", () => {
  const path = "packages/planning/src/solver.ts";
  const statementMap = Object.fromEntries(
    Array.from({ length: 1019 }, (_, index) => [index, location(2)]),
  );
  const hits = Object.fromEntries([
    ...Array.from({ length: 968 }, (_, index) => [index, 1]),
    ...Array.from({ length: 51 }, (_, index) => [index + 968, 0]),
  ]);

  const result = checkChangedCoverage(
    [coverageFile(path, { statementMap, s: hits })],
    new Map([[path, new Set([2])]]),
  );

  assert.equal(result.files[0].metrics.statements.pct, 95);
  assert.deepEqual(result.failures, [
    `${path} statements: actual 968/1019 (95.00%), required 95.00%; uncovered executable locations: ${path}:2:0-2:1`,
  ]);
});
