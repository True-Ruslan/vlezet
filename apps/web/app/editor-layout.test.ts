import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = [
  readFileSync(new URL("./globals.css", import.meta.url), "utf8"),
  readFileSync(new URL("./editor-viewport.css", import.meta.url), "utf8"),
].join("\n");
const planningCss = readFileSync(new URL("./planning-exact-gap.css", import.meta.url), "utf8");

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

describe("editor viewport layout contract", () => {
  it("prevents toolbar min-content width from expanding the editor workspace beyond the viewport", () => {
    const editorAppRules = [...css.matchAll(/\.editor-app\s*\{([^}]*)\}/g)]
      .map((match) => match[1] ?? "")
      .join(";");

    expect(compact(editorAppRules)).toContain("grid-template-columns:minmax(0,1fr)");
  });

  it("hides optional selection/status copy before a common desktop toolbar can overflow", () => {
    const compactCss = compact(css);
    const matches = [...compactCss.matchAll(/@media\(max-width:(\d+)px\)\{([^}]|\}[^@])*?\.document-status,\.selection-shortcuts\{display:none;\}/g)];
    const widestBreakpoint = Math.max(...matches.map((match) => Number(match[1])));

    expect(matches.length).toBeGreaterThan(0);
    expect(widestBreakpoint).toBeGreaterThanOrEqual(1650);
  });

  it("stacks transferred object controls and preserves visible label spacing in the narrow inspector", () => {
    const compactPlanningCss = compact(planningCss);

    expect(compactPlanningCss).toContain(".planning-panel.planning-object-choice{display:grid;grid-template-columns:minmax(0,1fr)");
    expect(compactPlanningCss).toContain(".planning-constraint-controls{display:grid;grid-template-columns:autominmax(0,1fr)");
    expect(compactPlanningCss).toContain(".planning-inline-check{display:flex;align-items:center;gap:6px");
    expect(compactPlanningCss).toContain(".planning-field{display:grid;gap:5px;min-width:0");
  });

  it("renders each furniture-pair relationship as a separated stacked card", () => {
    const compactPlanningCss = compact(planningCss);

    expect(compactPlanningCss).toContain(".planning-pair-list{display:grid;gap:8px");
    expect(compactPlanningCss).toContain(".planning-pair-row{display:grid;gap:7px;min-width:0");
    expect(compactPlanningCss).toContain(".planning-pair-row>strong{display:block;line-height:1.35");
  });
});
