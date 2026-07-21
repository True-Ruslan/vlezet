"use client";

import type { Wall } from "@vlezet/domain";
import {
  chooseGridStep,
  distanceBetween,
  projectPointToSegment,
  screenToWorld,
  snapWallPoint,
  validateTopology,
  worldToScreen,
  zoomViewportAt,
  type Point2,
  type SnapResult,
  type ViewportTransform,
} from "@vlezet/geometry";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Layer, Line, Stage, Text } from "react-konva";
import { useStore } from "zustand";
import { editorStore, type TopologySnapTarget } from "./use-editor-store";

const INITIAL_SCALE = 0.12;
const MIN_SCALE = 0.01;
const MAX_SCALE = 2;
const SNAP_TOLERANCE_PX = 12;

type ResolvedWall = Readonly<{ wall: Wall; start: Point2; end: Point2 }>;
type PointerSnap = Readonly<{ snap: SnapResult; target: TopologySnapTarget | null }>;

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const panRef = useRef<{ active: boolean; last: Point2 }>({ active: false, last: { x: 0, y: 0 } });
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [viewport, setViewport] = useState<ViewportTransform>({ offsetX: 140, offsetY: 140, pixelsPerMillimeter: INITIAL_SCALE });

  const tool = useStore(editorStore, (state) => state.tool);
  const document = useStore(editorStore, (state) => state.history.document);
  const draftWall = useStore(editorStore, (state) => state.draftWall);
  const selectedWallId = useStore(editorStore, (state) => state.selectedWallId);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isEditableTarget(event.target)) return;
      event.preventDefault();
      setSpacePressed(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const vertexMap = useMemo(() => new Map(document.vertices.map((vertex) => [vertex.id, vertex])), [document.vertices]);
  const resolvedWalls = useMemo<ResolvedWall[]>(() => document.walls.flatMap((wall) => {
    const start = vertexMap.get(wall.startVertexId);
    const end = vertexMap.get(wall.endVertexId);
    return start && end ? [{ wall, start: start.position, end: end.position }] : [];
  }), [document.walls, vertexMap]);
  const diagnostics = useMemo(() => validateTopology(document), [document]);
  const errorDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === "error");

  const gridStep = chooseGridStep(viewport.pixelsPerMillimeter);
  const endpoints = useMemo(() => document.vertices.map((vertex) => vertex.position), [document.vertices]);

  const gridLines = useMemo(() => {
    const topLeft = screenToWorld({ x: 0, y: 0 }, viewport);
    const bottomRight = screenToWorld({ x: size.width, y: size.height }, viewport);
    const minX = Math.min(topLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, bottomRight.y);
    const lines: Array<{ key: string; points: number[]; major: boolean }> = [];

    const firstX = Math.floor(minX / gridStep) * gridStep - gridStep;
    const lastX = Math.ceil(maxX / gridStep) * gridStep + gridStep;
    for (let x = firstX; x <= lastX; x += gridStep) {
      const screenX = worldToScreen({ x, y: 0 }, viewport).x;
      lines.push({ key: `x-${x}`, points: [screenX, 0, screenX, size.height], major: Math.round(x / gridStep) % 5 === 0 });
    }

    const firstY = Math.floor(minY / gridStep) * gridStep - gridStep;
    const lastY = Math.ceil(maxY / gridStep) * gridStep + gridStep;
    for (let y = firstY; y <= lastY; y += gridStep) {
      const screenY = worldToScreen({ x: 0, y }, viewport).y;
      lines.push({ key: `y-${y}`, points: [0, screenY, size.width, screenY], major: Math.round(y / gridStep) % 5 === 0 });
    }
    return lines;
  }, [gridStep, size.height, size.width, viewport]);

  const pointerPosition = (event: KonvaEventObject<MouseEvent | WheelEvent>): Point2 | null => {
    const stage = event.target.getStage();
    return stage?.getPointerPosition() ?? null;
  };

  const snapPointer = (screenPoint: Point2, startPoint?: Point2 | null): PointerSnap => {
    const rawPoint = screenToWorld(screenPoint, viewport);
    const tolerance = SNAP_TOLERANCE_PX / viewport.pixelsPerMillimeter;

    const vertexCandidate = document.vertices
      .map((vertex, index) => ({ vertex, index, distance: distanceBetween(rawPoint, vertex.position) }))
      .filter((candidate) => candidate.distance <= tolerance)
      .sort((a, b) => a.distance - b.distance || a.index - b.index)[0];
    if (vertexCandidate) {
      const point = vertexCandidate.vertex.position;
      return {
        snap: { point, kind: "endpoint", guides: [] },
        target: { kind: "vertex", vertexId: vertexCandidate.vertex.id, point },
      };
    }

    const wallCandidate = resolvedWalls
      .map((resolved, index) => ({ resolved, index, projection: projectPointToSegment(rawPoint, resolved.start, resolved.end) }))
      .filter((candidate) => candidate.projection.distance <= tolerance && candidate.projection.t > 1e-6 && candidate.projection.t < 1 - 1e-6)
      .sort((a, b) => a.projection.distance - b.projection.distance || a.index - b.index)[0];
    if (wallCandidate) {
      const point = wallCandidate.projection.point;
      return {
        snap: { point, kind: "wall", guides: [] },
        target: { kind: "wall", wallId: wallCandidate.resolved.wall.id, point },
      };
    }

    return {
      snap: snapWallPoint({ rawPoint, startPoint, endpoints, gridStep, tolerance }),
      target: null,
    };
  };

  const onWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const pointer = pointerPosition(event);
    if (!pointer) return;
    const factor = Math.exp(-event.evt.deltaY * 0.0015);
    setViewport((current) => zoomViewportAt(current, pointer, factor, { min: MIN_SCALE, max: MAX_SCALE }));
  };

  const onMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    const pointer = pointerPosition(event);
    if (!pointer) return;
    const shouldPan = event.evt.button === 1 || (event.evt.button === 0 && spacePressed);
    if (shouldPan) {
      event.evt.preventDefault();
      panRef.current = { active: true, last: pointer };
      return;
    }
    if (event.evt.button !== 0) return;

    if (tool === "wall") {
      const resolved = snapPointer(pointer, draftWall?.start ?? null);
      if (!draftWall) editorStore.getState().beginWall(resolved.snap.point, resolved.target);
      else {
        editorStore.getState().updateDraftWall(resolved.snap, resolved.target);
        editorStore.getState().commitDraftWall();
      }
      return;
    }
    editorStore.getState().selectWall(null);
  };

  const onMouseMove = (event: KonvaEventObject<MouseEvent>) => {
    const pointer = pointerPosition(event);
    if (!pointer) return;
    if (panRef.current.active) {
      const dx = pointer.x - panRef.current.last.x;
      const dy = pointer.y - panRef.current.last.y;
      panRef.current = { active: true, last: pointer };
      setViewport((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));
      return;
    }
    if (tool === "wall" && draftWall) {
      const resolved = snapPointer(pointer, draftWall.start);
      editorStore.getState().updateDraftWall(resolved.snap, resolved.target);
    }
  };

  const endPan = () => { panRef.current.active = false; };
  const draftStartScreen = draftWall ? worldToScreen(draftWall.start, viewport) : null;
  const draftEndScreen = draftWall ? worldToScreen(draftWall.end, viewport) : null;
  const draftLength = draftWall ? Math.hypot(draftWall.end.x - draftWall.start.x, draftWall.end.y - draftWall.start.y) : 0;
  const draftTargetScreen = draftWall?.endTarget ? worldToScreen(draftWall.endTarget.point, viewport) : null;

  return (
    <div ref={containerRef} className={`canvas-shell tool-${tool}${spacePressed ? " is-pan-ready" : ""}`} onContextMenu={(event) => event.preventDefault()}>
      <Stage ref={stageRef} width={size.width} height={size.height} onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={endPan} onMouseLeave={endPan}>
        <Layer listening={false}>
          {gridLines.map((line) => <Line key={line.key} points={line.points} stroke={line.major ? "#d9dde3" : "#eceff3"} strokeWidth={1} perfectDrawEnabled={false} />)}
        </Layer>

        <Layer>
          {resolvedWalls.map(({ wall, start: startWorld, end: endWorld }) => {
            const start = worldToScreen(startWorld, viewport);
            const end = worldToScreen(endWorld, viewport);
            const selected = wall.id === selectedWallId;
            const visualWidth = Math.max(2, wall.thickness * viewport.pixelsPerMillimeter);
            return (
              <Line
                key={wall.id}
                points={[start.x, start.y, end.x, end.y]}
                stroke={selected ? "#1769ff" : "#232830"}
                strokeWidth={visualWidth}
                hitStrokeWidth={Math.max(14, visualWidth)}
                lineCap="square"
                lineJoin="miter"
                onMouseDown={(wallEvent) => {
                  if (tool !== "select") return;
                  wallEvent.cancelBubble = true;
                  editorStore.getState().selectWall(wall.id);
                }}
              />
            );
          })}

          {tool === "wall" ? document.vertices.map((vertex) => {
            const screen = worldToScreen(vertex.position, viewport);
            const isJunction = document.walls.some((wall) => wall.junctionVertexIds.includes(vertex.id));
            return (
              <Circle
                key={vertex.id}
                x={screen.x}
                y={screen.y}
                radius={isJunction ? 4.5 : 3.5}
                fill={isJunction ? "#ffffff" : "#1769ff"}
                stroke="#1769ff"
                strokeWidth={1.5}
                opacity={0.8}
                listening={false}
              />
            );
          }) : null}

          {draftWall?.snap.guides.map((guide, index) => {
            if (guide.axis === "x") {
              const x = worldToScreen({ x: guide.value, y: 0 }, viewport).x;
              return <Line key={`guide-x-${index}`} points={[x, 0, x, size.height]} stroke="#1769ff" strokeWidth={1} dash={[6, 6]} opacity={0.55} listening={false} />;
            }
            const y = worldToScreen({ x: 0, y: guide.value }, viewport).y;
            return <Line key={`guide-y-${index}`} points={[0, y, size.width, y]} stroke="#1769ff" strokeWidth={1} dash={[6, 6]} opacity={0.55} listening={false} />;
          })}

          {draftStartScreen && draftEndScreen ? <>
            <Line points={[draftStartScreen.x, draftStartScreen.y, draftEndScreen.x, draftEndScreen.y]} stroke="#1769ff" strokeWidth={Math.max(2, 150 * viewport.pixelsPerMillimeter)} dash={[8, 6]} opacity={0.75} listening={false} />
            <Circle x={draftStartScreen.x} y={draftStartScreen.y} radius={5} fill="#1769ff" listening={false} />
            <Circle x={draftEndScreen.x} y={draftEndScreen.y} radius={5} fill="#1769ff" listening={false} />
            {draftTargetScreen ? (
              <Circle
                x={draftTargetScreen.x}
                y={draftTargetScreen.y}
                radius={9}
                fill={draftWall?.endTarget?.kind === "wall" ? "#fff7ed" : "#eff6ff"}
                stroke={draftWall?.endTarget?.kind === "wall" ? "#f97316" : "#1769ff"}
                strokeWidth={2}
                listening={false}
              />
            ) : null}
            {draftLength > 0 ? <Text x={(draftStartScreen.x + draftEndScreen.x) / 2 + 10} y={(draftStartScreen.y + draftEndScreen.y) / 2 - 26} text={`${Math.round(draftLength)} мм`} fontSize={13} fill="#1769ff" listening={false} /> : null}
          </> : null}

          {errorDiagnostics.map((diagnostic, index) => diagnostic.point ? (() => {
            const screen = worldToScreen(diagnostic.point!, viewport);
            return <Circle key={`diagnostic-${diagnostic.code}-${index}`} x={screen.x} y={screen.y} radius={8} fill="#ef4444" opacity={0.85} listening={false} />;
          })() : null)}
        </Layer>
      </Stage>

      {errorDiagnostics.length > 0 ? (
        <div className="topology-alert" role="status">Проверьте геометрию: {errorDiagnostics[0]?.message}</div>
      ) : null}
      <div className="canvas-help"><span>{Math.round(gridStep)} мм сетка</span><span>Колесо — масштаб</span><span>Синие узлы — соединения</span><span>Space + drag / средняя кнопка — панорама</span></div>
    </div>
  );
}
