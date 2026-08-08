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

  it("adapts semantic selection to one validated ordinary return target and restores exactly one entity", () => {
    expect(source).toContain("planningUiStore.getState().close()");
    expect(source).toContain("selectedWallIdFromSelection(selection)");
    expect(source).toContain("selectedRoomIdFromSelection(selection)");
    expect(source).toContain("selectedOpeningIdFromSelection(selection)");
    expect(source).toContain("selectedObjectIdFromSelection(selection)");
    expect(source).toContain("captureEditorWorkflowReturnTarget(currentSelection, document)");
    expect(source).toContain("const nextSelection = target ? selectionForWorkflowReturnTarget(target, document) : EMPTY_SELECTION");
    expect(source).toContain("store.clearSelection()");
    expect(source).toContain("if (nextSelection.selectedWallId) store.selectWall(nextSelection.selectedWallId)");
    expect(source).toContain("else if (nextSelection.selectedRoomId) store.selectRoom(nextSelection.selectedRoomId)");
    expect(source).toContain("else if (nextSelection.selectedOpeningId) store.selectOpening(nextSelection.selectedOpeningId)");
    expect(source).toContain("else if (nextSelection.selectedObjectId) store.selectObject(nextSelection.selectedObjectId)");
  });

  it("keeps compact presentation close independent from workflow exit", () => {
    const start = source.indexOf("const closeCompactSurface");
    const end = source.indexOf("const beginBoundedWorkflow", start);
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