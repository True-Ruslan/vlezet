import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { WORKSPACES } from "./config.mjs";
import {
  readWorkspaceCoverageReports,
  summarizeWorkspaceCoverage,
  validateBaseline,
} from "./coverage-lib.mjs";

const ACCEPTED_BASE_SHA = "95b99baf2d0f0aad51109b311c70c9b38aa3db38";

if (process.argv.length !== 2) {
  throw new Error("coverage:baseline accepts no metric or threshold arguments");
}

const sourceCommit = process.env.POLICY_BASE_SHA ?? ACCEPTED_BASE_SHA;
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error("POLICY_BASE_SHA must be a full lowercase Git SHA");
}

const root = process.cwd();
const filesByWorkspace = await readWorkspaceCoverageReports(root, WORKSPACES);
const baseline = {
  schemaVersion: 1,
  sourceCommit,
  ...summarizeWorkspaceCoverage(filesByWorkspace),
};
validateBaseline(baseline, WORKSPACES);

const destination = join(root, "tools/testing-policy/coverage-baseline.json");
await writeFile(destination, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
console.log(`Wrote measured coverage baseline for ${sourceCommit}`);

