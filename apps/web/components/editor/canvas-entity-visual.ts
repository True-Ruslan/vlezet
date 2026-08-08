export type CanvasEntityVisualState =
  | "ordinary"
  | "hover"
  | "selected"
  | "group-selection"
  | "preview-valid"
  | "preview-invalid";

export type CanvasEntityVisual = Readonly<{
  strokeRole: "ordinary" | "hover" | "accent" | "danger";
  dash: readonly number[] | null;
  marker: "none" | "preview" | "invalid";
  emphasized: boolean;
}>;

const VISUALS: Readonly<Record<CanvasEntityVisualState, CanvasEntityVisual>> = {
  ordinary: {
    strokeRole: "ordinary",
    dash: null,
    marker: "none",
    emphasized: false,
  },
  hover: {
    strokeRole: "hover",
    dash: [4, 3],
    marker: "none",
    emphasized: false,
  },
  selected: {
    strokeRole: "accent",
    dash: null,
    marker: "none",
    emphasized: true,
  },
  "group-selection": {
    strokeRole: "accent",
    dash: [6, 4],
    marker: "none",
    emphasized: true,
  },
  "preview-valid": {
    strokeRole: "accent",
    dash: [7, 5],
    marker: "preview",
    emphasized: true,
  },
  "preview-invalid": {
    strokeRole: "danger",
    dash: [7, 5],
    marker: "invalid",
    emphasized: true,
  },
};

export function deriveCanvasEntityVisual(state: CanvasEntityVisualState): CanvasEntityVisual {
  return VISUALS[state];
}
