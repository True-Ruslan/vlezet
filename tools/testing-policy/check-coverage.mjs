import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { WORKSPACES } from "./config.mjs";
import {
  compareCoverageFloors,
  readWorkspaceCoverageReports,
  summarizeWorkspaceCoverage,
  validateBaseline,
} from "./coverage-lib.mjs";

const ACCEPTED_BASE_SHA = "95b99baf2d0f0aad51109b311c70c9b38aa3db38";
const BASELINE_PATH = "tools/testing-policy/coverage-baseline.json";

if (process.argv.length !== 2) throw new Error("coverage:check accepts no arguments");

const baseSha = process.env.POLICY_BASE_SHA ?? ACCEPTED_BASE_SHA;
if (!/^[0-9a-f]{40}$/.test(baseSha)) {
  throw new Error("POLICY_BASE_SHA must be a full lowercase Git SHA");
}

function git(args) {
  return spawnSync("git", args, { cwd: process.cwd(), encoding: "utf8", shell: false });
}

function failIfAny(failures, heading) {
  if (failures.length > 0) {
    throw new Error(`${heading}:\n- ${failures.join("\n- ")}`);
  }
}

const baseline = JSON.parse(await readFile(join(process.cwd(), BASELINE_PATH), "utf8"));
validateBaseline(baseline, WORKSPACES);

const filesByWorkspace = await readWorkspaceCoverageReports(process.cwd(), WORKSPACES);
const current = summarizeWorkspaceCoverage(filesByWorkspace);
failIfAny(
  compareCoverageFloors(current, baseline),
  "Current coverage is below the HEAD baseline",
);

const commitCheck = git(["cat-file", "-e", `${baseSha}^{commit}`]);
if (commitCheck.status !== 0) {
  throw new Error(`POLICY_BASE_SHA is not an available commit: ${baseSha}`);
}

const baseFileCheck = git(["cat-file", "-e", `${baseSha}:${BASELINE_PATH}`]);
if (baseFileCheck.status === 0) {
  const shown = git(["show", `${baseSha}:${BASELINE_PATH}`]);
  if (shown.status !== 0) throw new Error(`Could not read base baseline: ${shown.stderr.trim()}`);
  let baseBaseline;
  try {
    baseBaseline = JSON.parse(shown.stdout);
  } catch (error) {
    throw new Error(`Base baseline is invalid JSON: ${error.message}`);
  }
  validateBaseline(baseBaseline, WORKSPACES);
  failIfAny(
    compareCoverageFloors(baseline, baseBaseline),
    "HEAD baseline lowers the accepted base baseline",
  );
} else if (baseline.sourceCommit !== baseSha) {
  throw new Error(
    `Base baseline is absent; bootstrap requires sourceCommit ${baseSha}, got ${baseline.sourceCommit}`,
  );
}

console.log(`Coverage ratchet passed against ${baseSha}`);

