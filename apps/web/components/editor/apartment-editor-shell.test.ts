import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./apartment-editor.tsx", import.meta.url), "utf8");

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

describe("M7.1 apartment editor shell integration", () => {
  it("uses the shared compact-layout and context identity contracts", () => {
    expect(source).toContain('from "./editor-context-kind"');
    expect(source).toContain('from "./editor-side-surface"');
    expect(source).toContain('from "./use-compact-editor-layout"');
    expect(source).toContain("deriveEditorContextKind");
    expect(source).toContain("nextCompactEditorSurface");
    expect(source).toContain("useCompactEditorLayout()");
  });

  it("wraps catalogue and context in stable side-surface identities", () => {
    const normalized = compact(source);
    expect(normalized).toContain('<EditorSideSurfaceid="editor-catalogue-surface"');
    expect(normalized).toContain('side="left"');
    expect(normalized).toContain('<EditorSideSurfaceid="editor-context-surface"');
    expect(normalized).toContain('side="right"');
    expect(normalized).toContain("<FurnitureCatalog/>");
    expect(normalized).toContain("<WallInspectorplanningNavigation={workflowNavigation}/>");
  });

  it("connects the compact context trigger without persisting presentation state", () => {
    expect(source).toContain("contextTriggerVisible={compactLayout && viewMode === \"2d\"}");
    expect(source).toContain("contextOpen={compactSurface === \"context\"}");
    expect(source).toContain("contextLabel={editorContextLabel(contextKind)}");
    expect(source).toContain("setCompactSurfaceChoice");
    expect(source).toContain("setDismissedContextKey");
    expect(source).not.toContain("onViewportChange({ compactSurface");
    expect(source).not.toContain("updateUi({ compactSurface");
    expect(source).not.toContain("referencePlan: { compactSurface");
  });

  it("uses one-column spatial composition and derives hidden 2D sheets in 3D", () => {
    expect(source).toContain('viewMode === "3d" ? "is-spatial"');
    expect(source).toContain('viewMode === "3d" ? null');
    expect(source).toContain("<SpatialViewer fitRequest={fit3dRequest} />");
  });
});

describe("M7.4 Escape integration", () => {
  it("derives one cancellation action instead of stacking generic cancellation and tracing exit", () => {
    expect(source).toContain('from "./editor-escape-priority"');
    expect(source).toContain("deriveEditorEscapeAction");
    expect(source).toContain('case "reset-measurement"');
    expect(source).toContain('case "cancel-wall-draft"');
    expect(source).toContain('case "clear-selection"');
    expect(source).not.toContain("store.cancelCurrentAction();\n          if (props.tracingMode) props.onStopTracing();");
  });
});