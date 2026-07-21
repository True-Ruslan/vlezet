"use client";

import { screenToWorld, worldToScreen, type ViewportTransform } from "@vlezet/geometry";
import type { ReferencePlan } from "@vlezet/projects";
import type Konva from "konva";
import { Image as KonvaImage } from "react-konva";

export type ReferenceLayerProps = Readonly<{
  referencePlan: ReferencePlan;
  image: HTMLImageElement;
  viewport: ViewportTransform;
  onMoveEnd?: (originWorld: Readonly<{ x: number; y: number }>) => void;
}>;

export function ReferenceLayer({ referencePlan, image, viewport, onMoveEnd }: ReferenceLayerProps) {
  if (!referencePlan.display.visible) return null;
  const origin = worldToScreen(referencePlan.transform.originWorld, viewport);
  const width = referencePlan.widthPx * referencePlan.transform.millimetersPerPixel * viewport.pixelsPerMillimeter;
  const height = referencePlan.heightPx * referencePlan.transform.millimetersPerPixel * viewport.pixelsPerMillimeter;
  const unlocked = !referencePlan.display.locked;

  return (
    <KonvaImage
      image={image}
      x={origin.x}
      y={origin.y}
      width={width}
      height={height}
      rotation={referencePlan.transform.rotationDeg}
      opacity={referencePlan.display.opacity}
      draggable={unlocked}
      listening={unlocked}
      perfectDrawEnabled={false}
      onDragEnd={(event) => {
        if (!unlocked || !onMoveEnd) return;
        const node = event.target as Konva.Image;
        onMoveEnd(screenToWorld({ x: node.x(), y: node.y() }, viewport));
      }}
    />
  );
}
