import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../../../.github/workflows/recognition-benchmark.yml", import.meta.url),
  "utf8",
);

describe("Recognition Benchmark workflow trigger", () => {
  it("runs for recognition changes on stacked pull requests without requiring a main-based validation PR", () => {
    expect(workflow).toContain("pull_request:\n    paths:");
    expect(workflow).not.toContain("pull_request:\n    branches:\n      - main");
    expect(workflow).toContain("workflow_dispatch:");
  });
});
