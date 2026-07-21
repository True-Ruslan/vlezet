"use client";

import type { PlacedObject } from "@vlezet/domain";
import type { PlacedObjectPatch } from "@vlezet/editor-core";
import { screenToWorld, worldToScreen, type FitStatus, type ViewportTransform } from "@vlezet/geometry";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef } from "react";
import { Group, Line, Rect, Text, Transformer } from "react-konva";
import type { ObjectGestureKind } from "./use-editor-store";

export type PlacedObjectShapeProps = Readonly<{
  object: PlacedObject;
  viewport: ViewportTransform;
  selected: boolean;
  fitStatus: FitStatus;
  preview?: boolean;
  onSelect?: () => void;
  onGestureStart?: (kind: ObjectGestureKind) => void;
  onGesturePreview?: (patch: PlacedObjectPatch) => void;
  onGestureCommit?: () => void;
}>;

function statusStroke(status: FitStatus, selected: boolean, preview: boolean): string {
  if (status === "blocked") return "#dc2626";
  if (status === "tight") return "#d97706";
  if (selected || preview) return "#1769ff";
  return "#4b5563";
}

function categoryFill(category: PlacedObject["category"]): string {
  return {
    sleep: "#eef2ff",
    seating: "#f5f3ff",
    storage: "#f8fafc",
    table: "#fefce8",
    chair: "#fff7ed",
    kitchen: "#ecfeff",
    appliance: "#f0fdfa",
    custom: "#f9fafb",
  }[category];
}

function InteriorMark({ object, width, depth }: Readonly<{ object: PlacedObject; width: number; depth: number }>) {
  const stroke = "#94a3b8";
  if (object.category === "sleep") {
    return <>
      <Line points={[-width / 2, -depth * 0.2, width / 2, -depth * 0.2]} stroke={stroke} strokeWidth={1} listening={false} />
      <Rect x={-width * 0.34} y={-depth * 0.42} width={width * 0.28} height={depth * 0.17} cornerRadius={3} stroke={stroke} strokeWidth={1} listening={false} />
      <Rect x={width * 0.06} y={-depth * 0.42} width={width * 0.28} height={depth * 0.17} cornerRadius={3} stroke={stroke} strokeWidth={1} listening={false} />
    </>;
  }
  if (object.category === "seating") {
    return <>
      <Line points={[-width * 0.4, depth * 0.18, width * 0.4, depth * 0.18]} stroke={stroke} strokeWidth={1} listening={false} />
      <Line points={[-width * 0.32, -depth * 0.3, -width * 0.32, depth * 0.3]} stroke={stroke} strokeWidth={1} listening={false} />
      <Line points={[width * 0.32, -depth * 0.3, width * 0.32, depth * 0.3]} stroke={stroke} strokeWidth={1} listening={false} />
    </>;
  }
  if (object.category === "table" || object.category === "kitchen") {
    return <Rect x={-width * 0.38} y={-depth * 0.32} width={width * 0.76} height={depth * 0.64} cornerRadius={4} stroke={stroke} strokeWidth={1} listening={false} />;
  }
  if (object.category === "appliance") {
    const diameter = Math.min(width, depth) * 0.44;
    return <Rect x={-diameter / 2} y={-diameter / 2} width={diameter} height={diameter} cornerRadius={999} stroke={stroke} strokeWidth={1} listening={false} />;
  }
  return <Line points={[-width * 0.38, 0, width * 0.38, 0]} stroke={stroke} strokeWidth={1} listening={false} />;
}

export function PlacedObjectShape({
  object,
  viewport,
  selected,
  fitStatus,
  preview = false,
  onSelect,
  onGestureStart,
  onGesturePreview,
  onGestureCommit,
}: PlacedObjectShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const screen = worldToScreen(object.position, viewport);
  const width = object.width * viewport.pixelsPerMillimeter;
  const depth = object.depth * viewport.pixelsPerMillimeter;

  useEffect(() => {
    const transformer = transformerRef.current;
    const group = groupRef.current;
    if (!transformer || !group || !selected || preview) return;
    transformer.nodes([group]);
    transformer.getLayer()?.batchDraw();
  }, [preview, selected]);

  const emitTransformPreview = (node: Konva.Group) => {
    const world = screenToWorld({ x: node.x(), y: node.y() }, viewport);
    onGesturePreview?.({
      position: world,
      width: Math.max(50, object.width * Math.abs(node.scaleX())),
      depth: Math.max(50, object.depth * Math.abs(node.scaleY())),
      rotationDeg: node.rotation(),
    });
  };

  const selectFromPointer = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (preview) return;
    event.cancelBubble = true;
    onSelect?.();
  };

  return <>
    <Group
      ref={groupRef}
      x={screen.x}
      y={screen.y}
      rotation={object.rotationDeg}
      draggable={!preview}
      opacity={preview ? 0.62 : 1}
      onMouseDown={selectFromPointer}
      onTap={selectFromPointer}
      onDragStart={(event) => {
        event.cancelBubble = true;
        onSelect?.();
        onGestureStart?.("move");
      }}
      onDragMove={(event) => {
        onGesturePreview?.({ position: screenToWorld({ x: event.target.x(), y: event.target.y() }, viewport) });
      }}
      onDragEnd={(event) => {
        onGesturePreview?.({ position: screenToWorld({ x: event.target.x(), y: event.target.y() }, viewport) });
        onGestureCommit?.();
      }}
      onTransformStart={() => onGestureStart?.("transform")}
      onTransformEnd={(event) => {
        const node = event.target as Konva.Group;
        emitTransformPreview(node);
        node.scale({ x: 1, y: 1 });
        onGestureCommit?.();
      }}
    >
      <Rect
        x={-width / 2}
        y={-depth / 2}
        width={width}
        height={depth}
        fill={categoryFill(object.category)}
        stroke={statusStroke(fitStatus, selected, preview)}
        strokeWidth={selected || preview || fitStatus !== "fits" ? 2 : 1.2}
        dash={preview ? [7, 5] : undefined}
        cornerRadius={Math.min(8, width * 0.06, depth * 0.06)}
        shadowColor={selected ? "#1769ff" : undefined}
        shadowBlur={selected ? 8 : 0}
        shadowOpacity={selected ? 0.12 : 0}
      />
      <InteriorMark object={object} width={width} depth={depth} />
      {width >= 72 && depth >= 36 ? (
        <Text
          x={-width / 2 + 6}
          y={-8}
          width={width - 12}
          align="center"
          text={object.name}
          fontSize={Math.max(9, Math.min(13, depth * 0.16))}
          fill="#334155"
          ellipsis
          listening={false}
        />
      ) : null}
    </Group>
    {selected && !preview ? (
      <Transformer
        ref={transformerRef}
        rotateEnabled
        rotationSnaps={[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345]}
        rotationSnapTolerance={6}
        enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
        keepRatio={false}
        flipEnabled={false}
        anchorSize={8}
        anchorCornerRadius={3}
        borderStroke="#1769ff"
        anchorStroke="#1769ff"
        anchorFill="#ffffff"
        rotateAnchorOffset={24}
        boundBoxFunc={(oldBox, newBox) => newBox.width < 8 || newBox.height < 8 ? oldBox : newBox}
      />
    ) : null}
  </>;
}
