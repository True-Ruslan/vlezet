"use client";

import { useStore } from "zustand";
import { deriveCanvasFeedback } from "./editor-canvas-feedback";
import { EditorCanvasStatus } from "./editor-canvas-status";
import { measurementToolStore } from "./measurement-tool-store";
import { editorStore } from "./use-editor-store";

export type EditorCanvasModeStatusProps = Readonly<{
  viewMode: "2d" | "3d";
  recognitionReviewActive: boolean;
  tracingMode: boolean;
}>;

export function EditorCanvasModeStatus({
  viewMode,
  recognitionReviewActive,
  tracingMode,
}: EditorCanvasModeStatusProps) {
  const tool = useStore(editorStore, (state) => state.tool);
  const hasWallDraft = useStore(editorStore, (state) => state.draftWall !== null);
  const placementPresetId = useStore(editorStore, (state) => state.placementPresetId);
  const measurementActive = useStore(measurementToolStore, (state) => state.active);
  const measurementPhase = useStore(measurementToolStore, (state) => state.phase);

  const feedback = deriveCanvasFeedback({
    viewMode,
    recognitionReviewActive,
    tracingMode,
    placementPresetId,
    placementPreviewValid: null,
    measurementActive,
    measurementPhase,
    tool,
    hasWallDraft,
    openingPreviewValid: null,
    hoveredSelectable: false,
    panState: "idle",
  });

  return (
    <div className="editor-canvas-mode-status-host">
      <EditorCanvasStatus feedback={feedback} />
    </div>
  );
}
