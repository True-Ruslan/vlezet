import { resolve } from "node:path";

export const WORKSPACES = [
  "apps/web",
  "packages/domain",
  "packages/editor-core",
  "packages/geometry",
  "packages/planning",
  "packages/projects",
  "packages/recognition",
  "packages/spatial",
];

const COVERAGE_EXTENSION_GLOB = "{ts,tsx,js,jsx,mjs,cjs}";

export function coverageIncludesForWorkspace(workspace, repositoryRoot = process.cwd()) {
  if (!WORKSPACES.includes(workspace)) throw new Error(`Unknown coverage workspace: ${workspace}`);
  const sourceRoots = workspace === "apps/web" ? ["app", "components"] : ["src"];
  return sourceRoots.map((sourceRoot) => (
    `${resolve(repositoryRoot, workspace, sourceRoot).replaceAll("\\", "/")}/**/*.${COVERAGE_EXTENSION_GLOB}`
  ));
}

export const ORDINARY_CHANGED_THRESHOLDS = {
  lines: 95,
  statements: 95,
  functions: 95,
  branches: 90,
};

export const CRITICAL_CHANGED_THRESHOLDS = {
  lines: 100,
  statements: 100,
  functions: 100,
  branches: 95,
};

export function isProductionPath(file) {
  const p = file.replaceAll("\\", "/");
  return /^(?:apps\/web\/(?:app|components)|packages\/[^/]+\/src)\/.+\.(?:[cm]?[jt]sx?)$/.test(p)
    && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(p)
    && !p.endsWith(".d.ts")
    && !/\.(?:generated|coverage)\.[cm]?[jt]sx?$/.test(p)
    && !/(?:^|\/)(?:generated|coverage)(?:\/|$)/.test(p);
}

export function isCriticalPath(file) {
  const p = file.replaceAll("\\", "/");
  if (!isProductionPath(p)) return false;

  return /^(?:packages\/(?:domain|geometry|editor-core)\/src\/)/.test(p)
    || /^packages\/projects\/src\/.*(?:persistence|repository|indexeddb|schema|file-format|migration|seriali[sz]ation).*\.(?:[cm]?[jt]sx?)$/.test(p);
}
