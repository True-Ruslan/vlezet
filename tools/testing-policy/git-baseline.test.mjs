import assert from "node:assert/strict";
import test from "node:test";

import { classifyBaselineTreeResult, resolvePolicyBaseSha } from "./git-baseline.mjs";

const ACCEPTED_BASE_SHA = "95b99baf2d0f0aad51109b311c70c9b38aa3db38";
const ZERO_SHA = "0000000000000000000000000000000000000000";
const BASELINE_PATH = "tools/testing-policy/coverage-baseline.json";

test("classifies only a successful empty ls-tree result as absent", () => {
  assert.equal(classifyBaselineTreeResult({
    status: 0,
    signal: null,
    error: undefined,
    stdout: "",
    stderr: "",
  }, BASELINE_PATH), false);
});

test("classifies an exact successful ls-tree entry as present", () => {
  assert.equal(classifyBaselineTreeResult({
    status: 0,
    signal: null,
    error: undefined,
    stdout: `100644 blob 0123456789abcdef0123456789abcdef01234567\t${BASELINE_PATH}\n`,
    stderr: "",
  }, BASELINE_PATH), true);
});

test("fails closed on a non-zero ls-tree result and surfaces stderr", () => {
  assert.throws(
    () => classifyBaselineTreeResult({
      status: 128,
      signal: null,
      error: undefined,
      stdout: "",
      stderr: "fatal: loose object is corrupt\n",
    }, BASELINE_PATH),
    /Git base baseline lookup failed with exit code 128: fatal: loose object is corrupt/,
  );
});

test("fails closed on ls-tree spawn errors and signals", () => {
  assert.throws(
    () => classifyBaselineTreeResult({
      status: null,
      signal: null,
      error: new Error("spawn git EACCES"),
      stdout: "",
      stderr: "",
    }, BASELINE_PATH),
    /Git base baseline lookup failed to spawn: spawn git EACCES/,
  );
  assert.throws(
    () => classifyBaselineTreeResult({
      status: null,
      signal: "SIGKILL",
      error: undefined,
      stdout: "",
      stderr: "",
    }, BASELINE_PATH),
    /Git base baseline lookup terminated by signal SIGKILL/,
  );
});

test("fails closed on unexpected successful ls-tree output", () => {
  assert.throws(
    () => classifyBaselineTreeResult({
      status: 0,
      signal: null,
      error: undefined,
      stdout: "unexpected output\n",
      stderr: "",
    }, BASELINE_PATH),
    /Git base baseline lookup returned unexpected output/,
  );
});

test("missing, empty, and whitespace-only POLICY_BASE_SHA resolve to unset accepted-base behavior", () => {
  assert.equal(resolvePolicyBaseSha(undefined), undefined);
  assert.equal(resolvePolicyBaseSha(""), undefined);
  assert.equal(resolvePolicyBaseSha("   "), undefined);
  assert.equal(resolvePolicyBaseSha("\n\t  "), undefined);
  assert.equal(resolvePolicyBaseSha(undefined) ?? ACCEPTED_BASE_SHA, ACCEPTED_BASE_SHA);
  assert.equal(resolvePolicyBaseSha("") ?? ACCEPTED_BASE_SHA, ACCEPTED_BASE_SHA);
  assert.equal(resolvePolicyBaseSha(" \n") ?? ACCEPTED_BASE_SHA, ACCEPTED_BASE_SHA);
});

test("invalid non-empty POLICY_BASE_SHA fails closed", () => {
  assert.throws(
    () => resolvePolicyBaseSha("not-a-sha"),
    /POLICY_BASE_SHA must be a full lowercase Git SHA/,
  );
  assert.throws(
    () => resolvePolicyBaseSha("HEAD"),
    /POLICY_BASE_SHA must be a full lowercase Git SHA/,
  );
  assert.throws(
    () => resolvePolicyBaseSha("95b99baf2d0f0aad51109b311c70c9b38aa3db3"),
    /POLICY_BASE_SHA must be a full lowercase Git SHA/,
  );
});

test("all-zero POLICY_BASE_SHA fails closed and is not treated as unset", () => {
  assert.throws(
    () => resolvePolicyBaseSha(ZERO_SHA),
    /POLICY_BASE_SHA must be a full lowercase Git SHA/,
  );
});

test("valid POLICY_BASE_SHA is returned trimmed", () => {
  assert.equal(resolvePolicyBaseSha(ACCEPTED_BASE_SHA), ACCEPTED_BASE_SHA);
  assert.equal(resolvePolicyBaseSha(`  ${ACCEPTED_BASE_SHA}\n`), ACCEPTED_BASE_SHA);
});
