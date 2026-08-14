import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { WORKSPACES } from "./config.mjs";
import { checkChangedCoverage, parseChangedLines } from "./changed-coverage.mjs";
import {
  compareCoverageFloors,
  readWorkspaceCoverageReports,
  summarizeWorkspaceCoverage,
  validateBaseline,
} from "./coverage-lib.mjs";
import {
  classifyBaselineTreeResult,
  requireSuccessfulGit,
  resolvePolicyBaseSha,
} from "./git-baseline.mjs";

const ACCEPTED_BASE_SHA = "95b99baf2d0f0aad51109b311c70c9b38aa3db38";
const BASELINE_PATH = "tools/testing-policy/coverage-baseline.json";

if (process.argv.length !== 2) throw new Error("coverage:check accepts no arguments");

const policyBaseSha = resolvePolicyBaseSha(process.env.POLICY_BASE_SHA);
const baseSha = policyBaseSha ?? ACCEPTED_BASE_SHA;
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
requireSuccessfulGit(commitCheck, `Git base commit verification for ${baseSha}`);

const baseFileCheck = git(["ls-tree", "--full-tree", baseSha, "--", BASELINE_PATH]);
if (classifyBaselineTreeResult(baseFileCheck, BASELINE_PATH)) {
  const shown = git(["show", `${baseSha}:${BASELINE_PATH}`]);
  requireSuccessfulGit(shown, "Git base baseline read");
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

let changedBaseSha = policyBaseSha;
if (changedBaseSha === undefined) {
  const mergeBase = git(["merge-base", "HEAD", "origin/main"]);
  requireSuccessfulGit(mergeBase, "Git changed-coverage merge-base lookup");
  changedBaseSha = mergeBase.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(changedBaseSha)) {
    throw new Error(`Git changed-coverage merge-base returned an invalid SHA: ${changedBaseSha}`);
  }
}

const diff = git([
  "diff",
  "--unified=0",
  "--no-color",
  "--diff-filter=ACMR",
  `${changedBaseSha}...HEAD`,
  "--",
  "apps",
  "packages",
]);
requireSuccessfulGit(diff, `Git changed-coverage diff against ${changedBaseSha}`);
const changedCoverage = checkChangedCoverage(filesByWorkspace, parseChangedLines(diff.stdout));
failIfAny(changedCoverage.failures, "Changed production coverage is below policy thresholds");

console.log(`Coverage ratchet passed against ${baseSha}`);
if (changedCoverage.applicable) {
  console.log(`Changed production coverage passed against ${changedBaseSha}`);
} else {
  console.log(`Changed production coverage: N/A (no changed executable production code)`);
}
