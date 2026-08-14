import assert from "node:assert/strict";
import test from "node:test";

import {
  CRITICAL_CHANGED_THRESHOLDS,
  ORDINARY_CHANGED_THRESHOLDS,
  WORKSPACES,
  isCriticalPath,
  isProductionPath,
} from "./config.mjs";

test("exports the covered workspaces and changed-code thresholds", () => {
  assert.deepEqual(WORKSPACES, [
    "apps/web",
    "packages/domain",
    "packages/editor-core",
    "packages/geometry",
    "packages/planning",
    "packages/projects",
    "packages/recognition",
    "packages/spatial",
  ]);
  assert.deepEqual(ORDINARY_CHANGED_THRESHOLDS, {
    lines: 95,
    statements: 95,
    functions: 95,
    branches: 90,
  });
  assert.deepEqual(CRITICAL_CHANGED_THRESHOLDS, {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 95,
  });
});

test("classifies source code as production and excludes generated test artifacts", () => {
  assert.equal(isProductionPath("packages/geometry/src/fit.ts"), true);
  assert.equal(isProductionPath("apps/web/src/app/page.tsx"), true);
  assert.equal(isProductionPath("packages/geometry/src/fit.test.ts"), false);
  assert.equal(isProductionPath("packages/geometry/src/fit.spec.ts"), false);
  assert.equal(isProductionPath("packages/geometry/src/types.d.ts"), false);
  assert.equal(isProductionPath("packages/geometry/src/model.generated.ts"), false);
  assert.equal(isProductionPath("packages/geometry/src/report.coverage.ts"), false);
  assert.equal(isProductionPath("packages/geometry/coverage/report.ts"), false);
  assert.equal(isProductionPath("packages/geometry/generated/model.ts"), false);
  assert.equal(isProductionPath("packages/geometry/src\\fit.ts"), true);
});

test("classifies initial critical production paths", () => {
  assert.equal(isCriticalPath("packages/geometry/src/fit.ts"), true);
  assert.equal(isCriticalPath("packages/domain/src/document.ts"), true);
  assert.equal(isCriticalPath("packages/editor-core/src/commands.ts"), true);
  assert.equal(isCriticalPath("packages/projects/src/indexeddb-schema.ts"), true);
  assert.equal(isCriticalPath("packages/projects/src/file-format.ts"), true);
  assert.equal(isCriticalPath("packages/projects/src/repository.ts"), true);
  assert.equal(isCriticalPath("packages/projects/src/autosave.ts"), false);
  assert.equal(isCriticalPath("packages/geometry/src/fit.test.ts"), false);
  assert.equal(isCriticalPath("apps/web/src/app/page.tsx"), false);
});
