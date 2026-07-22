"use client";

import { imagePointToWorld, screenToWorld, worldPointToImage, worldToScreen, type ViewportTransform } from "@vlezet/geometry";
import type { ReferencePlan } from "@vlezet/projects";
import type { NormalizedPoint, RecognitionDraft } from "@vlezet/recognition";
import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Group, Line, Text } from "react-konva";

const CONFIDENCE_STROKE = {
  high: "#16a34a",
  medium: "#d97706",
  low: "#64748b",
} as const;

function worldPoint(point: NormalizedPoint, referencePlan: ReferencePlan) {
  return imagePointToWorld({ x: point.x * referencePlan.widthPx, y: point.y * referencePlan.heightPx }, referencePlan.transform);
}

function normalizedFromScreen(screen: Readonly<{ x: number; y: number }>, viewport: ViewportTransform, referencePlan: ReferencePlan): NormalizedPoint {
  const world = screenToWorld(screen, viewport);
  const image = worldPointToImage(world, referencePlan.transform);
  return {
    x: Math.max(0, Math.min(1, image.x / referencePlan.widthPx)),
    y: Math.max(0, Math.min(1, image.y / referencePlan.heightPx)),
  };
}

export type RecognitionLayerProps = Readonly<{
  draft: RecognitionDraft;
  referencePlan: ReferencePlan;
  viewport: ViewportTransform;
  selectedCandidateId: string | null;
  onSelect: (candidateId: string) => void;
  onEditWall: (candidateId: string, patch: Readonly<{ start?: NormalizedPoint; end?: NormalizedPoint }>) => void;
}>;

export function RecognitionLayer(props: RecognitionLayerProps) {
  return <Group>
    {props.draft.walls.map((wall) => {
      const startWorld = worldPoint(wall.start, props.referencePlan);
      const endWorld = worldPoint(wall.end, props.referencePlan);
      const start = worldToScreen(startWorld, props.viewport);
      const end = worldToScreen(endWorld, props.viewport);
      const selected = props.selectedCandidateId === wall.id;
      const rejected = props.draft.decisions[wall.id] === "rejected";
      const stroke = wall.conflict ? "#dc2626" : rejected ? "#94a3b8" : CONFIDENCE_STROKE[wall.confidence];
      return <Group key={wall.id} opacity={rejected ? 0.38 : 0.92}>
        <Line
          points={[start.x, start.y, end.x, end.y]}
          stroke={stroke}
          strokeWidth={selected ? 5 : 3}
          dash={wall.origin === "cloud" ? [8, 5] : wall.origin === "merged" ? [] : [3, 3]}
          hitStrokeWidth={16}
          onMouseDown={(event) => { event.cancelBubble = true; props.onSelect(wall.id); }}
        />
        {selected ? <>
          <Circle
            x={start.x}
            y={start.y}
            radius={6}
            fill="#fff"
            stroke={stroke}
            strokeWidth={2}
            draggable
            onDragEnd={(event: KonvaEventObject<DragEvent>) => props.onEditWall(wall.id, { start: normalizedFromScreen(event.target.position(), props.viewport, props.referencePlan) })}
          />
          <Circle
            x={end.x}
            y={end.y}
            radius={6}
            fill="#fff"
            stroke={stroke}
            strokeWidth={2}
            draggable
            onDragEnd={(event: KonvaEventObject<DragEvent>) => props.onEditWall(wall.id, { end: normalizedFromScreen(event.target.position(), props.viewport, props.referencePlan) })}
          />
        </> : null}
      </Group>;
    })}
    {props.draft.openings.map((opening) => {
      const center = worldToScreen(worldPoint(opening.center, props.referencePlan), props.viewport);
      const selected = props.selectedCandidateId === opening.id;
      const rejected = props.draft.decisions[opening.id] === "rejected";
      const stroke = opening.conflict ? "#dc2626" : rejected ? "#94a3b8" : CONFIDENCE_STROKE[opening.confidence];
      return <Group key={opening.id} opacity={rejected ? 0.38 : 0.95} onMouseDown={(event) => { event.cancelBubble = true; props.onSelect(opening.id); }}>
        <Circle x={center.x} y={center.y} radius={selected ? 10 : 8} fill="#fff" stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <Text x={center.x - 30} y={center.y - 25} width={60} align="center" text={opening.kind === "door" ? "Д" : opening.kind === "window" ? "О" : "?"} fontSize={11} fontStyle="bold" fill={stroke} listening={false} />
      </Group>;
    })}
  </Group>;
}
