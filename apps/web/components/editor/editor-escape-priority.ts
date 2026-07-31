export type EditorEscapeAction =
  | "cancel-object-gesture"
  | "reset-measurement"
  | "cancel-wall-draft"
  | "cancel-placement"
  | "finish-tracing"
  | "exit-measurement"
  | "close-workflow"
  | "exit-tool"
  | "clear-selection"
  | "return-to-2d"
  | "none";

export type EditorEscapeInput = Readonly<{
  viewMode: "2d" | "3d";
  hasObjectGesture: boolean;
  measurementActive: boolean;
  measurementPhase: "idle" | "measuring" | "complete";
  hasWallDraft: boolean;
  hasPlacement: boolean;
  tracingMode: boolean;
  workflowOpen: boolean;
  tool: "select" | "wall" | "door" | "window";
  hasSelection: boolean;
}>;

export function deriveEditorEscapeAction(input: EditorEscapeInput): EditorEscapeAction {
  if (input.hasObjectGesture) return "cancel-object-gesture";
  if (input.measurementActive && input.measurementPhase !== "idle") return "reset-measurement";
  if (input.hasWallDraft) return "cancel-wall-draft";
  if (input.hasPlacement) return "cancel-placement";
  if (input.tracingMode) return "finish-tracing";
  if (input.measurementActive) return "exit-measurement";
  if (input.workflowOpen) return "close-workflow";
  if (input.viewMode === "3d") return "return-to-2d";
  if (input.tool !== "select") return "exit-tool";
  if (input.hasSelection) return "clear-selection";
  return "none";
}
