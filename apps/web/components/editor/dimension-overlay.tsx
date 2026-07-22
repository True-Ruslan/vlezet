"use client";

import type { ViewportTransform } from "@vlezet/geometry";
import { Group, Line, Rect, Text } from "react-konva";
import { formatDimensionValue, type LinearDimensionAnnotation } from "./dimension-annotations";
import { projectDimensionAnnotation } from "./dimension-overlay-geometry";

export type DimensionOverlayProps = Readonly<{
  annotations: readonly LinearDimensionAnnotation[];
  viewport: ViewportTransform;
}>;

const LABEL_WIDTH_PX = 132;
const LABEL_HEIGHT_PX = 20;
const TICK_HALF_PX = 5;

export function DimensionOverlay({ annotations, viewport }: DimensionOverlayProps) {
  return <>
    {annotations.map((annotation, index) => {
      const geometry = projectDimensionAnnotation(annotation, viewport);
      const dx = geometry.dimensionEnd.x - geometry.dimensionStart.x;
      const dy = geometry.dimensionEnd.y - geometry.dimensionStart.y;
      const length = Math.hypot(dx, dy);
      if (length <= 1e-6) return null;

      const tick = {
        x: (-dy / length) * TICK_HALF_PX,
        y: (dx / length) * TICK_HALF_PX,
      };
      const clearRoom = annotation.kind === "clear-room";
      const stroke = clearRoom ? "#1769ff" : "#64748b";
      const labelFill = clearRoom ? "#eff6ff" : "#f8fafc";
      const labelText = clearRoom ? "#174ea6" : "#475569";
      const key = `${annotation.kind}-${annotation.start.x}-${annotation.start.y}-${annotation.end.x}-${annotation.end.y}-${index}`;

      return <Group key={key} listening={false}>
        <Line points={[
          geometry.measuredStart.x,
          geometry.measuredStart.y,
          geometry.dimensionStart.x,
          geometry.dimensionStart.y,
        ]} stroke={stroke} strokeWidth={1} opacity={0.58} />
        <Line points={[
          geometry.measuredEnd.x,
          geometry.measuredEnd.y,
          geometry.dimensionEnd.x,
          geometry.dimensionEnd.y,
        ]} stroke={stroke} strokeWidth={1} opacity={0.58} />
        <Line points={[
          geometry.dimensionStart.x,
          geometry.dimensionStart.y,
          geometry.dimensionEnd.x,
          geometry.dimensionEnd.y,
        ]} stroke={stroke} strokeWidth={1.4} />
        <Line points={[
          geometry.dimensionStart.x - tick.x,
          geometry.dimensionStart.y - tick.y,
          geometry.dimensionStart.x + tick.x,
          geometry.dimensionStart.y + tick.y,
        ]} stroke={stroke} strokeWidth={1.4} />
        <Line points={[
          geometry.dimensionEnd.x - tick.x,
          geometry.dimensionEnd.y - tick.y,
          geometry.dimensionEnd.x + tick.x,
          geometry.dimensionEnd.y + tick.y,
        ]} stroke={stroke} strokeWidth={1.4} />
        <Rect
          x={geometry.labelPoint.x - LABEL_WIDTH_PX / 2}
          y={geometry.labelPoint.y - LABEL_HEIGHT_PX / 2}
          width={LABEL_WIDTH_PX}
          height={LABEL_HEIGHT_PX}
          cornerRadius={5}
          fill={labelFill}
          opacity={0.96}
        />
        <Text
          x={geometry.labelPoint.x - LABEL_WIDTH_PX / 2}
          y={geometry.labelPoint.y - 7}
          width={LABEL_WIDTH_PX}
          align="center"
          text={formatDimensionValue(annotation)}
          fontSize={11}
          fontStyle="bold"
          fill={labelText}
        />
      </Group>;
    })}
  </>;
}
