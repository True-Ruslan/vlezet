import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = [
  readFileSync(new URL("./globals.css", import.meta.url), "utf8"),
  readFileSync(new URL("./editor-viewport.css", import.meta.url), "utf8"),
].join("\n");

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
});
