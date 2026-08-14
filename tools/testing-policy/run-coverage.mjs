import { spawnSync } from "node:child_process";

import { WORKSPACES } from "./config.mjs";

for (const workspace of WORKSPACES) {
  const args = [
    "--dir", workspace, "exec", "vitest", "run", "--coverage",
    "--coverage.provider=v8",
    "--coverage.include=src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
    "--coverage.reporter=text", "--coverage.reporter=json", "--coverage.reporter=lcov",
    "--coverage.reportsDirectory=coverage",
  ];
  const result = spawnSync("pnpm", args, { stdio: "inherit", shell: false });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Coverage failed for ${workspace} with exit code ${result.status}`);
  }
}
