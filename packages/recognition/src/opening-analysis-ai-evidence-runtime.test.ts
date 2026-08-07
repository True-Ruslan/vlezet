import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./opening-analysis-with-ai-evidence.ts", import.meta.url), "utf8");

describe("AI evidence opening runtime delegation", () => {
  it("wraps the current short-jamb/terminal recovery runtime instead of bypassing it", () => {
    expect(source).toContain('from "./opening-analysis-runtime-with-short-jamb"');
    expect(source).not.toContain('from "./opening-analysis-runtime-with-window-proposals"');
  });
});
