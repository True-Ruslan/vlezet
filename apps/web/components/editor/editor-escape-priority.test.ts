import { describe, expect, it } from "vitest";
import {
  deriveEditorEscapeAction,
  type EditorEscapeInput,
} from "./editor-escape-priority";

const base: EditorEscapeInput = {
  viewMode: "2d",
  hasObjectGesture: false,
  measurementActive: false,
  measurementPhase: "idle",
  hasWallDraft: false,
  hasPlacement: false,
  tracingMode: false,
  workflowOpen: false,
  tool: "select",
  hasSelection: false,
};

function action(patch: Partial<EditorEscapeInput>) {
  return deriveEditorEscapeAction({ ...base, ...patch });
}

describe("M7.4 one-level Escape priority", () => {
  it("cancels only the highest pointer transient", () => {
    expect(action({
      hasObjectGesture: true,
      measurementActive: true,
      measurementPhase: "measuring",
      hasWallDraft: true,
      hasPlacement: true,
    })).toBe("cancel-object-gesture");
  });

  it("resets a measurement before leaving Measure", () => {
    expect(action({ measurementActive: true, measurementPhase: "measuring", tool: "wall" })).toBe("reset-measurement");
    expect(action({ measurementActive: true, measurementPhase: "complete" })).toBe("reset-measurement");
    expect(action({ measurementActive: true, measurementPhase: "idle" })).toBe("exit-measurement");
  });

  it("cancels a wall draft before exiting the Wall tool", () => {
    expect(action({ tool: "wall", hasWallDraft: true, hasSelection: true })).toBe("cancel-wall-draft");
    expect(action({ tool: "wall", hasSelection: true })).toBe("exit-tool");
  });

  it("cancels placement and tracing before lower-priority modes", () => {
    expect(action({ hasPlacement: true, tracingMode: true, workflowOpen: true })).toBe("cancel-placement");
    expect(action({ tracingMode: true, workflowOpen: true })).toBe("finish-tracing");
  });

  it("closes bounded workflows before ordinary tool exit or selection clearing", () => {
    expect(action({ workflowOpen: true, tool: "door", hasSelection: true })).toBe("close-workflow");
    expect(action({ tool: "window", hasSelection: true })).toBe("exit-tool");
    expect(action({ hasSelection: true })).toBe("clear-selection");
  });

  it("returns from 3D only after higher-priority pointer state", () => {
    expect(action({ viewMode: "3d", hasObjectGesture: true })).toBe("cancel-object-gesture");
    expect(action({ viewMode: "3d" })).toBe("return-to-2d");
  });

  it("does nothing when no cancellable state exists", () => {
    expect(action({})).toBe("none");
  });
});
