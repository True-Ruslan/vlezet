import { worldToScreen, type Point2, type ViewportTransform } from "@vlezet/geometry";
import type { ReactElement } from "react";
import { Arrow, Circle, Group, Rect, Text } from "react-konva";
import type { ExactGapAnnotation } from "../planning/exact-gap-annotation";

export type ExactGapOverlayLayout = Readonly<{
  first: Point2;
  second: Point2;
  label: Point2;
  labelWidth: number;
  zeroLength: boolean;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function deriveExactGapOverlayLayout(
  annotation: ExactGapAnnotation,
  viewport: ViewportTransform,
  stageSize: Readonly<{ width: number; height: number }>,
): ExactGapOverlayLayout {
  const first = worldToScreen(annotation.firstPoint, viewport);
  const second = worldToScreen(annotation.secondPoint, viewport);
  const availableWidth = Math.max(40, stageSize.width - 16);
  const labelWidth = Math.min(availableWidth, Math.max(92, annotation.label.length * 6.6 + 20));

  let labelX: number;
  let labelY: number;
  if (annotation.zeroLength) {
    labelX = first.x + 16;
    labelY = first.y - 28;
  } else {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    labelX = (first.x + second.x) / 2 - labelWidth / 2 + normalX * 14;
    labelY = (first.y + second.y) / 2 - 12 + normalY * 14;
  }

  return {
    first,
    second,
    label: {
      x: clamp(labelX, 8, Math.max(8, stageSize.width - labelWidth - 8)),
      y: clamp(labelY, 8, Math.max(8, stageSize.height - 30)),
    },
    labelWidth,
    zeroLength: annotation.zeroLength,
  };
}

export function ExactGapOverlay({
  annotation,
  viewport,
  stageSize,
}: Readonly<{
  annotation: ExactGapAnnotation;
  viewport: ViewportTransform;
  stageSize: Readonly<{ width: number; height: number }>;
}>): ReactElement {
  const layout = deriveExactGapOverlayLayout(annotation, viewport, stageSize);
  const color = annotation.satisfied ? "#7c3aed" : "#dc2626";
  const background = annotation.satisfied ? "#faf8ff" : "#fff7f7";

  return (
    <Group listening={false}>
      {layout.zeroLength ? (
        <>
          <Circle x={layout.first.x} y={layout.first.y} radius={6} fill="#ffffff" stroke={color} strokeWidth={1.5} listening={false} />
          <Circle x={layout.first.x} y={layout.first.y} radius={2.5} fill={color} listening={false} />
        </>
      ) : (
        <>
          <Arrow
            points={[layout.first.x, layout.first.y, layout.second.x, layout.second.y]}
            stroke={color}
            fill={color}
            strokeWidth={1.5}
            dash={[7, 5]}
            pointerLength={6}
            pointerWidth={6}
            pointerAtBeginning
            pointerAtEnding
            listening={false}
          />
          <Circle x={layout.first.x} y={layout.first.y} radius={3} fill="#ffffff" stroke={color} strokeWidth={1.5} listening={false} />
          <Circle x={layout.second.x} y={layout.second.y} radius={3} fill="#ffffff" stroke={color} strokeWidth={1.5} listening={false} />
        </>
      )}
      <Rect
        x={layout.label.x}
        y={layout.label.y}
        width={layout.labelWidth}
        height={24}
        cornerRadius={12}
        fill={background}
        stroke={color}
        strokeWidth={1}
        shadowColor="#0f172a"
        shadowBlur={6}
        shadowOpacity={0.12}
        listening={false}
      />
      <Text
        x={layout.label.x + 10}
        y={layout.label.y + 6}
        width={layout.labelWidth - 20}
        text={annotation.label}
        align="center"
        fill={color}
        fontSize={10}
        fontStyle="bold"
        listening={false}
      />
    </Group>
  );
}
