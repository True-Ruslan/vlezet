import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./m7-onboarding-status.css", import.meta.url), "utf8").replace(/\s+/g, "");

describe("M7.5 compact onboarding layout", () => {
  it("does not move the guide into ordinary grid flow and hide the Canvas", () => {
    const compactBreakpoint = css.indexOf("@media(max-width:760px)");
    expect(compactBreakpoint).toBeGreaterThanOrEqual(0);
    const compactRules = css.slice(compactBreakpoint);

    expect(compactRules).toContain(".first-project-guide{position:absolute");
    expect(compactRules).toContain(".editor-operation-evidence{position:absolute");
    expect(compactRules).not.toContain("position:relative");
    expect(compactRules).not.toContain("grid-row:auto");
  });
});
