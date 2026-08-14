import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  CRITICAL_CHANGED_THRESHOLDS,
  ORDINARY_CHANGED_THRESHOLDS,
  WORKSPACES,
  coverageIncludesForWorkspace,
  isCriticalPath,
  isProductionPath,
} from "./config.mjs";

test("requires complete V8 coverage support in every workspace manifest", async () => {
  const manifests = await Promise.all(
    WORKSPACES.map(async (workspace) => [
      workspace,
      JSON.parse(await readFile(join(workspace, "package.json"), "utf8")),
    ]),
  );

  for (const [workspace, manifest] of manifests) {
    assert.equal(manifest.devDependencies?.vitest, "4.1.10", `${workspace} vitest`);
    assert.equal(
      manifest.devDependencies?.["@vitest/coverage-v8"],
      "4.1.10",
      `${workspace} V8 coverage provider`,
    );
    assert.equal(manifest.scripts?.coverage, "vitest run --coverage", `${workspace} coverage script`);
  }
});

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

test("anchors coverage includes to each workspace production root", () => {
  assert.deepEqual(coverageIncludesForWorkspace("apps/web", "/repo"), [
    "/repo/apps/web/app/**/*.{ts,tsx,js,jsx,mjs,cjs}",
    "/repo/apps/web/components/**/*.{ts,tsx,js,jsx,mjs,cjs}",
  ]);
  for (const workspace of WORKSPACES.slice(1)) {
    assert.deepEqual(coverageIncludesForWorkspace(workspace, "/repo"), [
      `/repo/${workspace}/src/**/*.{ts,tsx,js,jsx,mjs,cjs}`,
    ]);
  }
});

test("classifies source code as production and excludes generated test artifacts", () => {
  assert.equal(isProductionPath("packages/geometry/src/fit.ts"), true);
  assert.equal(isProductionPath("apps/web/app/page.tsx"), true);
  assert.equal(isProductionPath("apps/web/components/ui/ui-button.tsx"), true);
  assert.equal(isProductionPath("apps/web/app/page.test.tsx"), false);
  assert.equal(isProductionPath("apps/web/components/ui/ui-button.spec.tsx"), false);
  assert.equal(isProductionPath("apps/web/app/types.d.ts"), false);
  assert.equal(isProductionPath("apps/web/components/model.generated.ts"), false);
  assert.equal(isProductionPath("apps/web/components/report.coverage.ts"), false);
  assert.equal(isProductionPath("apps/web/components/coverage/report.ts"), false);
  assert.equal(isProductionPath("apps/web/src/app/page.tsx"), false);
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
  assert.equal(isCriticalPath("apps/web/app/page.tsx"), false);
});
