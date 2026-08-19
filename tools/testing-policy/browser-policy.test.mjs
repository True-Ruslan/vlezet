import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  WEBKIT_SPECS,
  browserPolicyViolations,
  browserSpecViolations,
  chromiumConfigViolations,
  chromiumConfigSourceViolations,
  discoverBrowserSpecs,
  webkitConfigViolations,
  webkitConfigSourceViolations,
} from "./browser-policy.mjs";

test("preserves the explicit WebKit acceptance set", () => {
  assert.deepEqual(WEBKIT_SPECS, [
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
  ]);
});

test("requires IndexedDB, real reference import, and M8.4 assisted tracing evidence in WebKit", () => {
  assert.ok(WEBKIT_SPECS.includes("m7-reference-calibration.spec.mjs"));
  assert.ok(WEBKIT_SPECS.includes("m8-4-wall-assisted-tracing.spec.mjs"));
  assert.ok(WEBKIT_SPECS.includes("m8-4-wall-assisted-tracing-chain.spec.mjs"));
  assert.ok(WEBKIT_SPECS.includes("m8-indexeddb-persistence.spec.mjs"));
  assert.ok(WEBKIT_SPECS.includes("m8-indexeddb-corruption.spec.mjs"));
});

test("keeps native legacy Blob synthesis Chromium-only while WebKit proves current persistence", () => {
  assert.ok(WEBKIT_SPECS.includes("m7-reference-calibration.spec.mjs"));
  assert.ok(WEBKIT_SPECS.includes("m8-indexeddb-persistence.spec.mjs"));
  assert.equal(WEBKIT_SPECS.includes("m8-indexeddb-legacy-blob.spec.mjs"), false);
});

test("discovers every executable browser spec without a filename registry", async (t) => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "vlezet-browser-policy-"));
  t.after(() => rm(fixtureDir, { recursive: true, force: true }));
  await Promise.all([
    writeFile(join(fixtureDir, "alpha.spec.mjs"), ""),
    writeFile(join(fixtureDir, "new-regression.spec.mjs"), ""),
    writeFile(join(fixtureDir, "helper.mjs"), ""),
  ]);

  assert.deepEqual(await discoverBrowserSpecs(fixtureDir), [
    "alpha.spec.mjs",
    "new-regression.spec.mjs",
  ]);
});

test("current browser infrastructure satisfies the policy", async () => {
  assert.deepEqual(await browserPolicyViolations(), []);
});

test("rejects exhaustive Chromium lists and retries", () => {
  assert.deepEqual(chromiumConfigViolations({
    testMatch: ["first.spec.mjs", "second.spec.mjs"],
    workers: 2,
    retries: 1,
  }), [
    "Chromium must discover browser specs with **/*.spec.mjs",
    "Chromium workers must be 1",
    "Chromium retries must be 0",
  ]);
  assert.deepEqual(chromiumConfigSourceViolations(`
    testMatch: ["first.spec.mjs", "second.spec.mjs"],
    workers: 2,
    retries: 1,
  `), [
    "Chromium must discover browser specs with **/*.spec.mjs",
    "Chromium workers must be 1",
    "Chromium retries must be 0",
  ]);
});

test("rejects changed or nonexistent WebKit entries and retries", () => {
  assert.deepEqual(webkitConfigViolations({
    testMatch: [...WEBKIT_SPECS, "missing.spec.mjs"],
    workers: 2,
    retries: 2,
  }, WEBKIT_SPECS.slice(1)), [
    "WebKit workers must be 1",
    "WebKit retries must be 0",
    "WebKit testMatch must use WEBKIT_SPECS without changing its entries or order",
    `Missing WebKit spec: ${WEBKIT_SPECS[0]}`,
  ]);
  assert.deepEqual(webkitConfigSourceViolations(`
    testMatch: ["missing.spec.mjs"],
    workers: 2,
    retries: 2,
  `, WEBKIT_SPECS.slice(1)), [
    "WebKit workers must be 1",
    "WebKit retries must be 0",
    "WebKit testMatch must use WEBKIT_SPECS without changing its entries or order",
    `Missing WebKit spec: ${WEBKIT_SPECS[0]}`,
  ]);
});

test("rejects direct Playwright imports, focused tests, skips, and fixmes", () => {
  assert.deepEqual(browserSpecViolations("unsafe.spec.mjs", `
    import { expect, test } from "@playwright/test";
    test.only("focused", () => {});
    test.skip("skipped", () => {});
    test.fixme("broken suite", () => {});
  `), [
    "unsafe.spec.mjs imports directly from @playwright/test",
    "unsafe.spec.mjs must import the shared fixtures",
    "unsafe.spec.mjs contains a focused test",
    "unsafe.spec.mjs contains an unregistered skip or fixme",
  ]);
  assert.deepEqual(browserSpecViolations("focused.spec.mjs", `
    import { expect, test } from "./fixtures.mjs";
    describe.only("focused", () => {});
  `), [
    "focused.spec.mjs contains a focused test",
  ]);
});

test("rejects suite-level skips and fixmes", () => {
  assert.deepEqual(browserSpecViolations("suite-skip.spec.mjs", `
    import { expect, test } from "./fixtures.mjs";
    test.describe.skip("skipped suite", () => {});
    test.describe.fixme("broken suite", () => {});
  `), [
    "suite-skip.spec.mjs contains an unregistered skip or fixme",
  ]);
});
