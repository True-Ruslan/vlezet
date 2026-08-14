import assert from "node:assert/strict";
import test from "node:test";

import { classifyBaselineTreeResult } from "./git-baseline.mjs";

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
