"use client";

import { worldToScreen, type Point2, type ViewportTransform } from "@vlezet/geometry";
import type { ReferenceSourceAssistResult } from "../reference/reference-source-assist";
import { Circle, Group, Line, Text } from "react-konva";

type SourceAssistOverlayKind = Exclude<ReferenceSourceAssistResult["kind"], "none">;

export type SourceAssistOverlayModel = Readonly<{
  label: "По подложке";
  marker: Point2;
  kind: SourceAssistOverlayKind;
}>;

export function deriveSourceAssistOverlayModel(
  assist: ReferenceSourceAssistResult,
  viewport: ViewportTransform,
): SourceAssistOverlayModel | null {
  if (!assist.acquired || !assist.candidateId || assist.kind === "none") return null;
  return {
    label: "По подложке",
    marker: worldToScreen(assist.worldPoint, viewport),
    kind: assist.kind,
  };
}

export function SourceAssistOverlay({
  assist,
  viewport,
}: Readonly<{
  assist: ReferenceSourceAssistResult | null;
  viewport: ViewportTransform;
}>) {
  const model = assist ? deriveSourceAssistOverlayModel(assist, viewport) : null;
  if (!model) return null;

  const markerSize = model.kind === "intersection" ? 7 : 6;
  return (
    <Group listening={false} name="source-assist-overlay">
      <Circle
        x={model.marker.x}
        y={model.marker.y}
        radius={markerSize + 3}
        stroke="#0f766e"
        strokeWidth={1}
        dash={[3, 3]}
        opacity={0.8}
      />
      <Line
        points={[
          model.marker.x - markerSize,
          model.marker.y,
          model.marker.x + markerSize,
          model.marker.y,
        ]}
        stroke="#0f766e"
        strokeWidth={1.5}
      />
      <Line
        points={[
          model.marker.x,
          model.marker.y - markerSize,
          model.marker.x,
          model.marker.y + markerSize,
        ]}
        stroke="#0f766e"
        strokeWidth={1.5}
      />
      <Circle x={model.marker.x} y={model.marker.y} radius={2.5} fill="#0f766e" />
      <Text
        x={model.marker.x + 12}
        y={model.marker.y + 8}
        text={model.label}
        fontSize={11}
        fill="#0f766e"
      />
    </Group>
  );
}
