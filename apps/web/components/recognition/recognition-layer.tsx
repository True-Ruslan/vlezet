"use client";

import { imagePointToWorld, screenToWorld, worldPointToImage, worldToScreen, type ViewportTransform } from "@vlezet/geometry";
import type { ReferencePlan } from "@vlezet/projects";
import type { NormalizedPoint, RecognitionDraft } from "@vlezet/recognition";
import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Group, Line, Text } from "react-konva";
import {
  useRecognitionReviewFilter,
  type RecognitionReviewFilter,
} from "./recognition-review-filter";

const CONFIDENCE_STROKE = {
  high: "#16a34a",
  medium: "#d97706",
  low: "#64748b",
} as const;

const AI_PROPOSAL_STROKE = "#7c3aed";

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
  reviewFilter?: RecognitionReviewFilter;
  onSelect: (candidateId: string) => void;
  onEditWall: (candidateId: string, patch: Readonly<{ start?: NormalizedPoint; end?: NormalizedPoint }>) => void;
}>;

export function RecognitionLayer(props: RecognitionLayerProps) {
  const sharedReviewFilter = useRecognitionReviewFilter();
  const reviewFilter = props.reviewFilter ?? sharedReviewFilter;
  const aiProposals = props.draft.aiProposals ?? [];
  const questionedLocalIds = new Set(
    aiProposals
      .filter((proposal) => proposal.kind === "local-wall-review" && proposal.targetLocalCandidateId)
      .map((proposal) => proposal.targetLocalCandidateId as string),
  );
  const showLocal = reviewFilter === "all" || reviewFilter === "local" || reviewFilter === "questioned-local";
  const visibleWalls = !showLocal
    ? []
    : reviewFilter === "questioned-local"
      ? props.draft.walls.filter((wall) => questionedLocalIds.has(wall.id))
      : props.draft.walls;
  const visibleOpenings = showLocal && reviewFilter !== "questioned-local" ? props.draft.openings : [];
  const showAiGeometry = reviewFilter === "all" || reviewFilter === "ai-proposals";

  return <Group>
    {visibleWalls.map((wall) => {
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
    {visibleOpenings.map((opening) => {
      const center = worldToScreen(worldPoint(opening.center, props.referencePlan), props.viewport);
      const selected = props.selectedCandidateId === opening.id;
      const rejected = props.draft.decisions[opening.id] === "rejected";
      const stroke = opening.conflict ? "#dc2626" : rejected ? "#94a3b8" : CONFIDENCE_STROKE[opening.confidence];
      return <Group key={opening.id} opacity={rejected ? 0.38 : 0.95} onMouseDown={(event) => { event.cancelBubble = true; props.onSelect(opening.id); }}>
        <Circle x={center.x} y={center.y} radius={selected ? 10 : 8} fill="#fff" stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <Text x={center.x - 30} y={center.y - 25} width={60} align="center" text={opening.kind === "door" ? "Д" : opening.kind === "window" ? "О" : "?"} fontSize={11} fontStyle="bold" fill={stroke} listening={false} />
      </Group>;
    })}
    {showAiGeometry ? aiProposals.map((proposal) => {
      if (proposal.state !== "eligible") return null;
      if (proposal.geometry?.kind !== "opening") return null;
      const geometry = proposal.geometry;
      const centerPx = {
        x: geometry.center.x * props.referencePlan.widthPx,
        y: geometry.center.y * props.referencePlan.heightPx,
      };
      const halfWidthPx = geometry.widthNormalized * props.referencePlan.widthPx / 2;
      const radians = geometry.orientationDeg * Math.PI / 180;
      const offset = { x: Math.cos(radians) * halfWidthPx, y: Math.sin(radians) * halfWidthPx };
      const startWorld = imagePointToWorld({ x: centerPx.x - offset.x, y: centerPx.y - offset.y }, props.referencePlan.transform);
      const endWorld = imagePointToWorld({ x: centerPx.x + offset.x, y: centerPx.y + offset.y }, props.referencePlan.transform);
      const start = worldToScreen(startWorld, props.viewport);
      const end = worldToScreen(endWorld, props.viewport);
      const center = worldToScreen(imagePointToWorld(centerPx, props.referencePlan.transform), props.viewport);
      const selected = props.selectedCandidateId === proposal.id;
      return <Group
        key={proposal.id}
        opacity={0.94}
        onMouseDown={(event) => { event.cancelBubble = true; props.onSelect(proposal.id); }}
      >
        <Line
          points={[start.x, start.y, end.x, end.y]}
          stroke={AI_PROPOSAL_STROKE}
          strokeWidth={selected ? 5 : 3}
          dash={[10, 6]}
          hitStrokeWidth={18}
        />
        <Circle x={center.x} y={center.y} radius={selected ? 7 : 5} fill="#fff" stroke={AI_PROPOSAL_STROKE} strokeWidth={2} />
        <Text
          x={center.x - 54}
          y={center.y - 28}
          width={108}
          align="center"
          text="Предложение AI"
          fontSize={11}
          fontStyle="bold"
          fill={AI_PROPOSAL_STROKE}
          listening={false}
        />
      </Group>;
    }) : null}
  </Group>;
}
