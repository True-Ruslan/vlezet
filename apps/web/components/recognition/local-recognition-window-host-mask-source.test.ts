import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeSource = readFileSync(
  new URL("../../../../packages/recognition/src/structural-clutter-veto-runtime.ts", import.meta.url),
  "utf8",
);

describe("one-sided window host production mask contract", () => {
  it("composes the extension in the existing mask-aware clutter runtime", () => {
    expect(runtimeSource).toContain("extendOneSidedWindowHosts({");
    expect(runtimeSource).toContain("structuralMask: input.mask");
    expect(runtimeSource.indexOf("applyStructuralClutterVetoBase(input)"))
      .toBeLessThan(runtimeSource.indexOf("extendOneSidedWindowHosts({"));
  });
});
