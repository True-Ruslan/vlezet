"use client";

import type { Point2, VlezetDocument } from "@vlezet/domain";
import { worldToScreen, type ViewportTransform } from "@vlezet/geometry";
import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Group } from "react-konva";

export const STRUCTURAL_HANDLE_VISUAL_RADIUS_PX = 4;
export const STRUCTURAL_HANDLE_HIT_RADIUS_PX = 12;

export type StructuralHandleKind = "endpoint" | "junction";

export type StructuralHandleDescriptor = Readonly<{
  vertexId: string;
  kind: StructuralHandleKind;
  worldPoint: Point2;
  screenPoint: Point2;
  visualRadiusPx: number;
  hitRadiusPx: number;
  dataHitDiameter: string;
}>;

export function deriveStructuralHandleDescriptors(
  document: VlezetDocument,
  wallId: string,
  viewport: ViewportTransform,
): readonly StructuralHandleDescriptor[] {
  const wall = document.walls.find((candidate) => candidate.id === wallId);
  if (!wall) return [];
  const vertices = new Map(document.vertices.map((vertex) => [vertex.id, vertex.position]));
  const ordered = [
    { vertexId: wall.startVertexId, kind: "endpoint" as const },
    ...wall.junctionVertexIds.map((vertexId) => ({ vertexId, kind: "junction" as const })),
    { vertexId: wall.endVertexId, kind: "endpoint" as const },
  ];

  return ordered.flatMap(({ vertexId, kind }) => {
    const worldPoint = vertices.get(vertexId);
    if (!worldPoint) return [];
    return [{
      vertexId,
      kind,
      worldPoint,
      screenPoint: worldToScreen(worldPoint, viewport),
      visualRadiusPx: STRUCTURAL_HANDLE_VISUAL_RADIUS_PX,
      hitRadiusPx: STRUCTURAL_HANDLE_HIT_RADIUS_PX,
      dataHitDiameter: String(STRUCTURAL_HANDLE_HIT_RADIUS_PX * 2),
    }];
  });
}

export function StructuralHandleLayer({
  document,
  wallId,
  viewport,
  onHandlePointerDown,
}: Readonly<{
  document: VlezetDocument;
  wallId: string | null;
  viewport: ViewportTransform;
  onHandlePointerDown?: (
    vertexId: string,
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => void;
}>) {
  if (!wallId) return null;
  const handles = deriveStructuralHandleDescriptors(document, wallId, viewport);

  return (
    <Group name="structural-handles">
      {handles.map((handle) => (
        <Group key={handle.vertexId} x={handle.screenPoint.x} y={handle.screenPoint.y}>
          <Circle
            radius={handle.hitRadiusPx}
            fill="rgba(0,0,0,0.001)"
            onMouseDown={(event) => onHandlePointerDown?.(handle.vertexId, event)}
            onTouchStart={(event) => onHandlePointerDown?.(handle.vertexId, event)}
          />
          <Circle radius={handle.visualRadiusPx} fill="#ffffff" stroke="#1769ff" strokeWidth={2} listening={false} />
        </Group>
      ))}
    </Group>
  );
}
