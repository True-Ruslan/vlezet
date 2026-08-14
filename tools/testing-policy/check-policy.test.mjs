import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("check-policy composes workflowPolicyViolations into static checks", async () => {
  const source = await readFile(new URL("./check-policy.mjs", import.meta.url), "utf8");
  assert.match(
    source,
    /import\s*\{[^}]*\bworkflowPolicyViolations\b[^}]*\}\s*from\s*["']\.\/workflow-policy\.mjs["']/,
  );
  assert.match(source, /\.\.\.\s*\(\s*await\s+workflowPolicyViolations\(\s*\)\s*\)/);
});
