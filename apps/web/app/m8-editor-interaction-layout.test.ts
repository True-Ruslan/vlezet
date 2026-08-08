import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8")
  .replace(/\s+/g, " ");

describe("M8.1 selection presentation layout", () => {
  it("renders the semantic context menu as a bounded fixed overlay", () => {
    expect(css).toContain(".editor-context-menu { position:fixed; z-index:40; display:grid;");
    expect(css).toContain("max-width:min(280px,calc(100vw - 16px));");
    expect(css).toContain(".editor-context-menu button { width:100%;");
    expect(css).toContain("text-align:left;");
    expect(css).toContain(".editor-context-menu-empty { margin:0;");
  });

  it("keeps multi-selection facts and blocked reasons readable inside the existing inspector column", () => {
    expect(css).toContain(".multi-selection-inspector { min-width:0;");
    expect(css).toContain(".multi-selection-summary { display:grid;");
    expect(css).toContain(".multi-selection-summary li { display:flex; align-items:center; justify-content:space-between;");
    expect(css).toContain(".multi-selection-blocked-reason { margin:");
    expect(css).toContain("overflow-wrap:anywhere;");
  });
});