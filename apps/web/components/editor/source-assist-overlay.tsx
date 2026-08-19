"use client";

import { worldToScreen, type ViewportTransform } from "@vlezet/geometry";
import { Circle, Group, Line, Text } from "react-konva";
import type { ReferenceSourceAssistResult } from "../reference/reference-source-assist";

export type SourceAssistOverlayModel = Readonly<{
  marker: Readonly<{ x: number; y: number }>;
  label: string;
  kind: ReferenceSourceAssistResult["kind"];
}>;

export function deriveSourceAssistOverlayModel(
  assist: ReferenceSourceAssistResult | null,
  viewport: ViewportTransform,
): SourceAssistOverlayModel | null {
  if (!assist?.acquired) return null;
  return {
    marker: worldToScreen(assist.worldPoint, viewport),
    label: assist.kind === "intersection" ? "По подложке · угол" : "По подложке",
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
  const model = deriveSourceAssistOverlayModel(assist, viewport);
  if (!model) return null;

  const { marker } = model;
  return (
    <Group listening={false} name="source-assist-overlay">
      <Circle
        x={marker.x}
        y={marker.y}
        radius={8}
        fill="#ffffff"
        stroke="#0f766e"
        strokeWidth={2}
        opacity={0.96}
      />
      <Circle x={marker.x} y={marker.y} radius={2.5} fill="#0f766e" />
      {model.kind === "intersection" ? (
        <>
          <Line points={[marker.x - 6, marker.y, marker.x + 6, marker.y]} stroke="#0f766e" strokeWidth={1.5} />
          <Line points={[marker.x, marker.y - 6, marker.x, marker.y + 6]} stroke="#0f766e" strokeWidth={1.5} />
        </>
      ) : null}
      <Text
        x={marker.x + 12}
        y={marker.y - 22}
        text={model.label}
        fontSize={12}
        fontStyle="bold"
        fill="#0f766e"
      />
    </Group>
  );
}
