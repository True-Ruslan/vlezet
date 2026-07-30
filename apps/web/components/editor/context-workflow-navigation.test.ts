import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./apartment-editor.tsx", import.meta.url), "utf8");

describe("M7.2 ApartmentEditor workflow navigation", () => {
  it("owns an ephemeral return target and uses pure capture/preservation helpers", () => {
    expect(source).toContain("type WorkflowReturnTarget");
    expect(source).toContain("useState<WorkflowReturnTarget | null>(null)");
    expect(source).toContain("captureEditorWorkflowReturnTarget");
    expect(source).toContain("preserveWorkflowReturnTarget");
    expect(source).toContain("selectionForWorkflowReturnTarget");
    expect(source).not.toContain("workflowReturnTarget:");
    expect(source).not.toContain("localStorage");
  });

  it("restores exactly one validated ordinary selection after closing workflows", () => {
    expect(source).toContain("planningUiStore.getState().close()");
    expect(source).toContain("selection.selectedWallId");
    expect(source).toContain("selection.selectedRoomId");
    expect(source).toContain("selection.selectedOpeningId");
    expect(source).toContain("selection.selectedObjectId");
    expect(source).toContain("store.selectWall(null)");
  });

  it("keeps compact presentation close independent from workflow exit", () => {
    const start = source.indexOf("const closeCompactSurface");
    const end = source.indexOf("const toggleFurnitureSurface", start);
    const closeBody = source.slice(start, end);
    expect(closeBody).toContain("setCompactSurfaceChoice(null)");
    expect(closeBody).not.toContain("onToggleReferencePanel");
    expect(closeBody).not.toContain("onToggleRecognitionPanel");
    expect(closeBody).not.toContain("planningUiStore.getState().close");
  });

  it("captures only when entering the first bounded workflow and preserves the original target", () => {
    expect(source).toContain("beginBoundedWorkflow");
    expect(source).toContain("setWorkflowReturnTarget((current) => preserveWorkflowReturnTarget(current, captured))");
    expect(source).toContain("returnFromWorkflow");
  });
});
