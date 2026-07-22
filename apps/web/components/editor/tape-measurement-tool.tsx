"use client";

import {
  measureBetweenPoints,
  projectPointToSegment,
  screenToWorld,
  snapWallPoint,
  worldToScreen,
  type Point2,
  type ViewportTransform,
} from "@vlezet/geometry";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import { useStore } from "zustand";
import { measurementToolStore } from "./measurement-tool-store";
import { shouldHandleTapePointer } from "./tape-measurement-pointer";
import { advanceTapeMeasurement, previewTapeMeasurement, type TapeMeasurementState } from "./tape-measurement-state";
import { editorStore } from "./use-editor-store";

const SNAP_TOLERANCE_PX = 12;

export type TapeMeasurementToolProps = Readonly<{
  width: number;
  height: number;
  viewport: ViewportTransform;
  gridStep: number;
}>;

function pointerPosition(event: KonvaEventObject<MouseEvent>): Point2 | null {
  return event.target.getStage()?.getPointerPosition() ?? null;
}

function labelBox(text: string, point: Point2, width: number, key: string) {
  return <Group key={key} listening={false}>
    <Rect x={point.x - width / 2} y={point.y - 10} width={width} height={20} cornerRadius={5} fill="#fff7ed" opacity={0.96} />
    <Text x={point.x - width / 2} y={point.y - 7} width={width} align="center" text={text} fontSize={11} fontStyle="bold" fill="#9a3412" />
  </Group>;
}

export function TapeMeasurementTool({ width, height, viewport, gridStep }: TapeMeasurementToolProps) {
  const active = useStore(measurementToolStore, (state) => state.active);
  const document = useStore(editorStore, (state) => state.history.document);
  const editorTool = useStore(editorStore, (state) => state.tool);
  const placementPresetId = useStore(editorStore, (state) => state.placementPresetId);
  const [measurement, setMeasurement] = useState<TapeMeasurementState>(null);
  const spacePressedRef = useRef(false);

  const resolvedWalls = useMemo(() => {
    const vertexMap = new Map(document.vertices.map((vertex) => [vertex.id, vertex.position]));
    return document.walls.flatMap((wall) => {
      const start = vertexMap.get(wall.startVertexId);
      const end = vertexMap.get(wall.endVertexId);
      return start && end ? [{ wallId: wall.id, start, end }] : [];
    });
  }, [document.vertices, document.walls]);

  const endpoints = useMemo(() => document.vertices.map((vertex) => vertex.position), [document.vertices]);

  useEffect(() => measurementToolStore.subscribe((state) => {
    if (!state.active) setMeasurement(null);
  }), []);

  useEffect(() => {
    if (!active || (editorTool === "select" && !placementPresetId)) return;
    measurementToolStore.getState().setActive(false);
  }, [active, editorTool, placementPresetId]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressedRef.current = true;
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMeasurement(null);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressedRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      spacePressedRef.current = false;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [active]);

  const snapPoint = (screenPoint: Point2): Point2 => {
    const rawPoint = screenToWorld(screenPoint, viewport);
    const tolerance = SNAP_TOLERANCE_PX / viewport.pixelsPerMillimeter;
    const vertexCandidate = document.vertices
      .map((vertex, index) => ({ vertex, index, distance: Math.hypot(rawPoint.x - vertex.position.x, rawPoint.y - vertex.position.y) }))
      .filter((candidate) => candidate.distance <= tolerance)
      .sort((a, b) => a.distance - b.distance || a.index - b.index)[0];
    if (vertexCandidate) return vertexCandidate.vertex.position;

    const wallCandidate = resolvedWalls
      .map((wall, index) => ({ wall, index, projection: projectPointToSegment(rawPoint, wall.start, wall.end) }))
      .filter((candidate) => candidate.projection.distance <= tolerance)
      .sort((a, b) => a.projection.distance - b.projection.distance || a.index - b.index)[0];
    if (wallCandidate) return wallCandidate.projection.point;

    return snapWallPoint({ rawPoint, startPoint: null, endpoints, gridStep, tolerance }).point;
  };

  if (!active) return null;

  const startScreen = measurement ? worldToScreen(measurement.start, viewport) : null;
  const endScreen = measurement ? worldToScreen(measurement.end, viewport) : null;
  const metrics = measurement ? measureBetweenPoints(measurement.start, measurement.end) : null;
  const cornerScreen = measurement ? worldToScreen({ x: measurement.end.x, y: measurement.start.y }, viewport) : null;
  const midpoint = startScreen && endScreen ? { x: (startScreen.x + endScreen.x) / 2, y: (startScreen.y + endScreen.y) / 2 } : null;
  const xMidpoint = startScreen && cornerScreen ? { x: (startScreen.x + cornerScreen.x) / 2, y: startScreen.y } : null;
  const yMidpoint = cornerScreen && endScreen ? { x: endScreen.x, y: (cornerScreen.y + endScreen.y) / 2 } : null;

  const handlePointer = (event: KonvaEventObject<MouseEvent>, commit: boolean) => {
    if (!shouldHandleTapePointer({
      commit,
      button: event.evt.button,
      buttons: event.evt.buttons,
      spacePressed: spacePressedRef.current,
      hasMeasurement: measurement !== null,
      measurementComplete: measurement?.complete ?? false,
    })) return;
    const pointer = pointerPosition(event);
    if (!pointer) return;
    event.cancelBubble = true;
    const point = snapPoint(pointer);
    setMeasurement((current) => commit ? advanceTapeMeasurement(current, point) : previewTapeMeasurement(current, point));
  };

  return <Group>
    {measurement && startScreen && endScreen && metrics && cornerScreen && midpoint ? <Group listening={false}>
      <Line points={[startScreen.x, startScreen.y, endScreen.x, endScreen.y]} stroke="#ea580c" strokeWidth={2} />
      <Line points={[startScreen.x, startScreen.y, cornerScreen.x, cornerScreen.y, endScreen.x, endScreen.y]} stroke="#f97316" strokeWidth={1} dash={[5, 5]} opacity={0.72} />
      <Circle x={startScreen.x} y={startScreen.y} radius={5} fill="#fff7ed" stroke="#ea580c" strokeWidth={2} />
      <Circle x={endScreen.x} y={endScreen.y} radius={5} fill="#fff7ed" stroke="#ea580c" strokeWidth={2} />
      {labelBox(`${Math.round(metrics.distanceMm)} мм`, { x: midpoint.x, y: midpoint.y - 18 }, 92, "distance")}
      {xMidpoint && metrics.deltaXmm > 0 ? labelBox(`ΔX ${Math.round(metrics.deltaXmm)} мм`, { x: xMidpoint.x, y: xMidpoint.y - 15 }, 104, "dx") : null}
      {yMidpoint && metrics.deltaYmm > 0 ? labelBox(`ΔY ${Math.round(metrics.deltaYmm)} мм`, { x: yMidpoint.x + 58, y: yMidpoint.y }, 104, "dy") : null}
    </Group> : null}
    <Rect
      x={0}
      y={0}
      width={width}
      height={height}
      fill="#ffffff"
      opacity={0.001}
      onMouseDown={(event) => handlePointer(event, true)}
      onMouseMove={(event) => handlePointer(event, false)}
      onMouseEnter={(event) => { const stage = event.target.getStage(); if (stage) stage.container().style.cursor = "crosshair"; }}
      onMouseLeave={(event) => { const stage = event.target.getStage(); if (stage) stage.container().style.cursor = ""; }}
    />
  </Group>;
}
