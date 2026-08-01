import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("M7.7 furniture and fit layout", () => {
  it("keeps catalogue filters wrapping and independently scrollable", () => {
    const css = readFileSync(new URL("./m7-furniture-fit.css", import.meta.url), "utf8");

    expect(css).toContain(".catalog-filter-controls");
    expect(css).toMatch(/\.catalog-category-list\s*\{[^}]*flex-wrap:\s*wrap/s);
    expect(css).toMatch(/\.furniture-catalog\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.catalog-scroll\s*\{[^}]*overflow:\s*auto/s);
    expect(css).toMatch(/@media\s*\(max-width:\s*980px\)/s);
  });
});
