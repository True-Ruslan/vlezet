import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WORKSPACES } from "./config.mjs";
import {
  ACCEPTED_BASE_SHA,
  AUDIT_ROW_LABELS,
  CANONICAL_AUDIT_PATH,
  CANONICAL_POLICY_PATH,
  canonicalDocsViolations,
} from "./docs-policy.mjs";

test("reports missing canonical testing docs", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "vlezet-docs-policy-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.deepEqual(await canonicalDocsViolations(root), [
    `Missing canonical testing document: ${CANONICAL_POLICY_PATH}`,
    `Missing canonical testing document: ${CANONICAL_AUDIT_PATH}`,
  ]);
});

test("rejects unresolved placeholders and missing contract facts", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "vlezet-docs-policy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "docs/testing"), { recursive: true });
  await mkdir(join(root, "tools/testing-policy"), { recursive: true });
  await writeFile(join(root, CANONICAL_POLICY_PATH), "# Policy\nTODO finish this\n");
  await writeFile(join(root, CANONICAL_AUDIT_PATH), "# Audit\nTBD numbers\n");
  await copyFile(
    "tools/testing-policy/coverage-baseline.json",
    join(root, "tools/testing-policy/coverage-baseline.json"),
  );

  const violations = await canonicalDocsViolations(root);
  assert.ok(violations.some((item) => item.includes("Unresolved TBD/TODO")));
  assert.ok(violations.some((item) => item.includes("ordinary changed-code threshold")));
  assert.ok(violations.some((item) => item.includes("critical changed-code threshold")));
  assert.ok(violations.some((item) => item.includes(ACCEPTED_BASE_SHA)));
  assert.ok(AUDIT_ROW_LABELS.every((label) => (
    violations.some((item) => item.includes(`missing baseline row: ${label}`))
  )));
});

test("accepts a measured ratchet whose sourceCommit moves to a newer policy base", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "vlezet-docs-policy-ratchet-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "docs/testing"), { recursive: true });
  await mkdir(join(root, "tools/testing-policy"), { recursive: true });

  const nextBaseSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const [policy, audit, baselineSource] = await Promise.all([
    readFile(CANONICAL_POLICY_PATH, "utf8"),
    readFile(CANONICAL_AUDIT_PATH, "utf8"),
    readFile("tools/testing-policy/coverage-baseline.json", "utf8"),
  ]);
  const baseline = JSON.parse(baselineSource);
  const currentBaseSha = baseline.sourceCommit;
  baseline.sourceCommit = nextBaseSha;

  await writeFile(join(root, CANONICAL_POLICY_PATH), policy, "utf8");
  await writeFile(
    join(root, CANONICAL_AUDIT_PATH),
    audit.replaceAll(currentBaseSha, nextBaseSha),
    "utf8",
  );
  await writeFile(
    join(root, "tools/testing-policy/coverage-baseline.json"),
    `${JSON.stringify(baseline, null, 2)}\n`,
    "utf8",
  );

  assert.deepEqual(await canonicalDocsViolations(root), []);
});

test("canonical testing docs match the approved policy contract", async () => {
  assert.equal(WORKSPACES.length, 8);
  assert.deepEqual(await canonicalDocsViolations(), []);
});
