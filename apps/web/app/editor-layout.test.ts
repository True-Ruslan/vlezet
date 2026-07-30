import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const viewportCss = readFileSync(new URL("./editor-viewport.css", import.meta.url), "utf8");
const shellCss = readFileSync(new URL("./editor-shell.css", import.meta.url), "utf8");
const css = `${globalsCss}\n${viewportCss}\n${shellCss}`;
const planningCss = readFileSync(new URL("./planning-exact-gap.css", import.meta.url), "utf8");

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

function ruleBodies(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))]
    .map((match) => match[1] ?? "")
    .join(";");
}

describe("M7.1 editor viewport layout contract", () => {
  it("contains the editor in one viewport column and three semantic rows", () => {
    const editorApp = compact(ruleBodies(".editor-app"));

    expect(editorApp).toContain("grid-template-columns:minmax(0,1fr)");
    expect(editorApp).toContain("grid-template-rows:52px48pxminmax(0,1fr)");
    expect(editorApp).toContain("width:100vw");
    expect(editorApp).toContain("overflow:hidden");
  });

  it("keeps both command bars width-contained and the save status readable", () => {
    const compactCss = compact(css);
    const projectBar = compact(ruleBodies(".editor-project-bar"));
    const toolBar = compact(ruleBodies(".editor-tool-bar"));
    const saveStatus = compact(ruleBodies(".editor-project-bar .save-status"));

    expect(compactCss).toContain(".editor-project-bar,.editor-tool-bar,.editor-workspace,.editor-side-surface,.editor-side-surface-content{min-width:0;min-height:0;");
    expect(projectBar).toContain("height:52px");
    expect(toolBar).toContain("height:48px");
    expect(saveStatus).toContain("font-size:12px");
  });

  it("uses minmax Canvas columns and a dedicated one-column spatial layout", () => {
    const compactCss = compact(css);
    const workspace = compact(ruleBodies(".editor-workspace"));
    const catalogClosed = compact(ruleBodies(".editor-workspace.catalog-closed"));

    expect(workspace).toContain("grid-template-columns:250pxminmax(0,1fr)340px");
    expect(catalogClosed).toContain("grid-template-columns:minmax(0,1fr)340px");
    expect(compactCss).toContain(".editor-workspace.is-spatial,.editor-workspace.is-spatial.catalog-closed{grid-template-columns:minmax(0,1fr)");
  });

  it("replaces hidden responsive panels with viewport-bounded non-modal sheets", () => {
    const compactCss = compact(css);
    const compactBreakpoint = compactCss.indexOf("@media(max-width:1100px)");

    expect(compactBreakpoint).toBeGreaterThanOrEqual(0);
    const responsive = compactCss.slice(compactBreakpoint);
    expect(responsive).toContain(".editor-workspace,.editor-workspace.catalog-closed{grid-template-columns:minmax(0,1fr)");
    expect(responsive).toContain(".editor-side-surface.is-compact{position:fixed;top:100px;bottom:0");
    expect(responsive).toContain("width:min(360px,calc(100vw-48px))");
    expect(responsive).toContain(".editor-side-surface.is-compact[data-side=left]{left:0");
    expect(responsive).toContain(".editor-side-surface.is-compact[data-side=right]{right:0");
    expect(responsive).toContain(".editor-side-surface.inspector-panel");
    expect(responsive).toContain(".editor-side-surface.furniture-catalog");
    expect(responsive).not.toContain(".inspector-panel{display:none}");
    expect(responsive).not.toContain(".furniture-catalog{display:none}");
  });

  it("collapses visual tool labels without removing command buttons", () => {
    const commandLabels = compact(ruleBodies(".editor-command-label"));
    const commandButtons = compact(ruleBodies(".editor-command-button"));

    expect(commandLabels).toContain("display:none");
    expect(commandButtons).toContain("width:40px");
    expect(commandButtons).not.toContain("display:none");
  });

  it("overrides the legacy compact rule that hid project identity", () => {
    const projectTitle = compact(ruleBodies(".editor-project-bar .project-title-stack"));
    expect(projectTitle).toContain("display:grid");
  });
});

describe("planning inspector regression", () => {
  it("stacks transferred object controls and preserves visible label spacing", () => {
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
