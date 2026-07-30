import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

describe("editor viewport layout contract", () => {
  it("prevents toolbar min-content width from expanding the editor workspace beyond the viewport", () => {
    const editorAppRule = css.match(/\.editor-app\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(compact(editorAppRule)).toContain("grid-template-columns:minmax(0,1fr)");
  });

  it("hides optional selection/status copy before a common desktop toolbar can overflow", () => {
    const compactCss = compact(css);
    const match = compactCss.match(/@media\(max-width:(\d+)px\)\{[^{}]*\.project-toolbar-block[^{}]*\{[^{}]*\}[^{}]*\.toolbar-project-name[^{}]*\{[^{}]*\}[^{}]*\.document-status,\.selection-shortcuts\{display:none;\}/);

    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(1650);
  });
});
