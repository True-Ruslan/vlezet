import { spawnSync } from "node:child_process";

import { WORKSPACES, coverageIncludesForWorkspace } from "./config.mjs";
import { readWorkspaceCoverageReports } from "./coverage-lib.mjs";

for (const workspace of WORKSPACES) {
  const coverageIncludes = coverageIncludesForWorkspace(workspace);
  const args = [
    "--dir", workspace, "exec", "vitest", "run", "--coverage",
    "--coverage.provider=v8",
    ...coverageIncludes.flatMap((include) => ["--coverage.include", include]),
    "--coverage.reporter=text", "--coverage.reporter=json", "--coverage.reporter=lcov",
    "--coverage.reportsDirectory=coverage",
  ];
  const result = spawnSync("pnpm", args, { stdio: "inherit", shell: false });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Coverage failed for ${workspace} with exit code ${result.status}`);
  }
  await readWorkspaceCoverageReports(process.cwd(), [workspace]);
}
