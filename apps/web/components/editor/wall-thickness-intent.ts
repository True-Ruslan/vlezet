import type { WallThicknessAlignment } from "@vlezet/editor-core";
import type { WallRoomSide } from "@vlezet/geometry";

export type WallThicknessGrowthIntent = "inside" | "center" | "outside";

export function resolveWallThicknessAlignment(
  interiorSide: WallRoomSide,
  intent: WallThicknessGrowthIntent,
): WallThicknessAlignment {
  if (intent === "center") return "center";
  if (intent === "inside") return interiorSide === "left" ? "right-face" : "left-face";
  return interiorSide === "left" ? "left-face" : "right-face";
}
