import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const WEBKIT_SPECS = [
  "m7-webkit-smoke.spec.mjs",
  "m7-context-scroll.spec.mjs",
  "m7-canvas-feedback.spec.mjs",
  "m7-onboarding-status.spec.mjs",
  "m7-geometry-inspector.spec.mjs",
  "m7-furniture-fit.spec.mjs",
  "m7-reference-calibration.spec.mjs",
  "m8-editor-interaction.spec.mjs",
  "m8-group-drag-snap-regression.spec.mjs",
  "m8-precision-structural.spec.mjs",
  "m8-4-wall-assisted-tracing.spec.mjs",
  "m8-4-wall-assisted-tracing-chain.spec.mjs",
  "m8-room-copy.spec.mjs",
  "m8-selection-clipboard-semantics.spec.mjs",
  "m8-room-translation.spec.mjs",
  "m8-direct-manipulation-opening.spec.mjs",
  "m8-product-owner-regressions.spec.mjs",
  "m8-indexeddb-persistence.spec.mjs",
  "m8-indexeddb-corruption.spec.mjs",
];

export async function discoverBrowserSpecs(browserAuditDir) {
  return (await readdir(browserAuditDir))
    .filter((name) => name.endsWith(".spec.mjs"))
    .sort();
}

export function chromiumConfigViolations(config) {
  const violations = [];
  if (config.testMatch !== "**/*.spec.mjs") {
    violations.push("Chromium must discover browser specs with **/*.spec.mjs");
  }
  if (config.workers !== 1) violations.push("Chromium workers must be 1");
  if (config.retries !== 0) violations.push("Chromium retries must be 0");
  return violations;
}

export function chromiumConfigSourceViolations(source) {
  return chromiumConfigViolations({
    testMatch: /\btestMatch:\s*["']\*\*\/\*\.spec\.mjs["']/.test(source)
      ? "**/*.spec.mjs"
      : undefined,
    workers: Number(source.match(/\bworkers:\s*(\d+)\b/)?.[1]),
    retries: Number(source.match(/\bretries:\s*(\d+)\b/)?.[1]),
  });
}

export function webkitConfigViolations(config, discoveredSpecs) {
  const violations = [];
  if (config.workers !== 1) violations.push("WebKit workers must be 1");
  if (config.retries !== 0) violations.push("WebKit retries must be 0");
  if (!Array.isArray(config.testMatch) || config.testMatch.length !== WEBKIT_SPECS.length
      || config.testMatch.some((name, index) => name !== WEBKIT_SPECS[index])) {
    violations.push("WebKit testMatch must use WEBKIT_SPECS without changing its entries or order");
  }

  const discovered = new Set(discoveredSpecs);
  for (const name of WEBKIT_SPECS) {
    if (!discovered.has(name)) violations.push(`Missing WebKit spec: ${name}`);
  }
  return violations;
}

export function webkitConfigSourceViolations(source, discoveredSpecs) {
  const usesRegistry = /import\s*{\s*WEBKIT_SPECS\s*}\s*from\s*["']\.\.\/testing-policy\/browser-policy\.mjs["']/.test(source)
    && /\btestMatch:\s*WEBKIT_SPECS\b/.test(source);
  return webkitConfigViolations({
    testMatch: usesRegistry ? WEBKIT_SPECS : undefined,
    workers: Number(source.match(/\bworkers:\s*(\d+)\b/)?.[1]),
    retries: Number(source.match(/\bretries:\s*(\d+)\b/)?.[1]),
  }, discoveredSpecs);
}

export function browserSpecViolations(name, source) {
  const violations = [];
  if (/from\s+["']@playwright\/test["']/.test(source)) {
    violations.push(`${name} imports directly from @playwright/test`);
  }
  if (!/from\s+["']\.\/fixtures\.mjs["']/.test(source)) {
    violations.push(`${name} must import the shared fixtures`);
  }
  if (/\b(?:test|test\.describe|describe)\.only\s*\(/.test(source)) {
    violations.push(`${name} contains a focused test`);
  }
  if (/\btest\.(?:describe\.)?(?:skip|fixme)\s*\(/.test(source)) {
    violations.push(`${name} contains an unregistered skip or fixme`);
  }
  return violations;
}

export async function browserPolicyViolations(repositoryRoot = process.cwd()) {
  const browserAuditDir = join(repositoryRoot, "tools/m7-browser-audit");
  const specs = await discoverBrowserSpecs(browserAuditDir);
  const [chromiumSource, webkitSource] = await Promise.all([
    readFile(join(browserAuditDir, "playwright.config.mjs"), "utf8"),
    readFile(join(browserAuditDir, "playwright.webkit.config.mjs"), "utf8"),
  ]);
  const violations = [
    ...chromiumConfigSourceViolations(chromiumSource),
    ...webkitConfigSourceViolations(webkitSource, specs),
  ];

  for (const name of specs) {
    const source = await readFile(join(browserAuditDir, name), "utf8");
    violations.push(...browserSpecViolations(name, source));
  }
  return violations;
}
