import { createStore } from "zustand/vanilla";
import type { CanvasPreviewState } from "./editor-canvas-feedback";

export type CanvasPanState = "idle" | "ready" | "active";

type CanvasTransientFeedbackState = {
  hoveredSelectable: boolean;
  previewState: CanvasPreviewState;
  panState: CanvasPanState;
  setHoveredSelectable: (hoveredSelectable: boolean) => void;
  setPreviewState: (previewState: CanvasPreviewState) => void;
  setPanState: (panState: CanvasPanState) => void;
  reset: () => void;
};

const EMPTY_FEEDBACK = {
  hoveredSelectable: false,
  previewState: "none" as const,
  panState: "idle" as const,
};

export const canvasTransientFeedbackStore = createStore<CanvasTransientFeedbackState>((set) => ({
  ...EMPTY_FEEDBACK,
  setHoveredSelectable: (hoveredSelectable) => set({ hoveredSelectable }),
  setPreviewState: (previewState) => set({ previewState }),
  setPanState: (panState) => set({ panState }),
  reset: () => set(EMPTY_FEEDBACK),
}));
