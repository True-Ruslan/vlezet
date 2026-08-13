"use client";

import {
  worldToScreen,
  type Point2,
  type StructuralSnapResult,
  type ViewportTransform,
} from "@vlezet/geometry";
import { Circle, Group, Line, Text } from "react-konva";

export type StructuralSnapOverlayGuide =
  | Readonly<{ kind: "point"; point: Point2 }>
  | Readonly<{ kind: "segment"; start: Point2; end: Point2 }>;

export type StructuralSnapOverlayModel = Readonly<{
  label: string;
  marker: Point2;
  guides: readonly StructuralSnapOverlayGuide[];
}>;

export function deriveStructuralSnapOverlayModel(
  snap: StructuralSnapResult,
  viewport: ViewportTransform,
  size: Readonly<{ width: number; height: number }>,
): StructuralSnapOverlayModel | null {
  if (snap.kind === "none" || !snap.label) return null;
  const guides: StructuralSnapOverlayGuide[] = snap.guides.map((guide) => {
    if (guide.kind === "point") {
      return { kind: "point", point: worldToScreen(guide.point, viewport) };
    }
    if (guide.kind === "segment") {
      return {
        kind: "segment",
        start: worldToScreen(guide.start, viewport),
        end: worldToScreen(guide.end, viewport),
      };
    }
    if (guide.axis === "x") {
      const x = worldToScreen({ x: guide.value, y: 0 }, viewport).x;
      return { kind: "segment", start: { x, y: 0 }, end: { x, y: size.height } };
    }
    const y = worldToScreen({ x: 0, y: guide.value }, viewport).y;
    return { kind: "segment", start: { x: 0, y }, end: { x: size.width, y } };
  });

  return {
    label: snap.label,
    marker: worldToScreen(snap.point, viewport),
    guides,
  };
}

export function StructuralSnapOverlay({
  snap,
  viewport,
  size,
}: Readonly<{
  snap: StructuralSnapResult | null;
  viewport: ViewportTransform;
  size: Readonly<{ width: number; height: number }>;
}>) {
  const model = snap ? deriveStructuralSnapOverlayModel(snap, viewport, size) : null;
  if (!model) return null;

  return (
    <Group listening={false} name="structural-snap-overlay">
      {model.guides.map((guide, index) => guide.kind === "point" ? (
        <Circle key={`point-${index}`} x={guide.point.x} y={guide.point.y} radius={3} fill="#1769ff" />
      ) : (
        <Line
          key={`segment-${index}`}
          points={[guide.start.x, guide.start.y, guide.end.x, guide.end.y]}
          stroke="#1769ff"
          strokeWidth={1}
          dash={[5, 4]}
        />
      ))}
      <Circle x={model.marker.x} y={model.marker.y} radius={5} fill="#ffffff" stroke="#1769ff" strokeWidth={2} />
      <Text x={model.marker.x + 10} y={model.marker.y - 20} text={model.label} fontSize={12} fill="#1f2937" />
    </Group>
  );
}
