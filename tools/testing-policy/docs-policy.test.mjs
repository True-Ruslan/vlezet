import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("canonical testing docs match the approved policy contract", async () => {
  assert.equal(WORKSPACES.length, 8);
  assert.deepEqual(await canonicalDocsViolations(), []);
});
