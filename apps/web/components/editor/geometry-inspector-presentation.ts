import type { WallLengthAnchor, WallThicknessAlignment } from "@vlezet/editor-core";
import type { Point2 } from "@vlezet/geometry";

export type WallVisualAxis = "horizontal" | "vertical" | "diagonal";
export type VisualEndpointRole = "visual-start" | "center" | "visual-end";

export type WallVisualModel = Readonly<{
  axis: WallVisualAxis;
  internalStartIsVisualStart: boolean;
  visualStartLabel: string;
  visualEndLabel: string;
  visualStartShort: string;
  visualEndShort: string;
  tangent: Point2;
  leftNormal: Point2;
}>;

export type PhysicalFaceChoice = Readonly<{
  id: "first-face" | "axis" | "second-face";
  label: string;
  alignment: WallThicknessAlignment;
}>;

export function deriveWallVisualModel(_start: Point2, _end: Point2): WallVisualModel {
  return {
    axis: "horizontal",
    internalStartIsVisualStart: true,
    visualStartLabel: "",
    visualEndLabel: "",
    visualStartShort: "",
    visualEndShort: "",
    tangent: { x: 1, y: 0 },
    leftNormal: { x: 0, y: 1 },
  };
}

export function wallLengthAnchorForVisualRole(
  _model: WallVisualModel,
  _role: VisualEndpointRole,
): WallLengthAnchor {
  return "center";
}

export function physicalFaceChoices(_model: WallVisualModel): readonly PhysicalFaceChoice[] {
  return [];
}
