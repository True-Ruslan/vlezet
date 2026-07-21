"use client";

import type { Opening, Wall } from "@vlezet/domain";
import { validateOpening } from "@vlezet/editor-core";
import {
  chooseGridStep,
  deriveRooms,
  deriveVisibleWallIntervals,
  distanceBetween,
  openingSegment,
  pointAtWallOffset,
  projectPointToSegment,
  projectPointToWallOffset,
  proposeOpeningPlacement,
  screenToWorld,
  snapWallPoint,
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
type OpeningPreview = Readonly<{ wallId: string; pointerOffset: number; opening: Opening; valid: boolean }>;

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

function arcPoints(hinge: Point2, closedDirection: Point2, openDirection: Point2, radius: number): Point2[] {
  const start = Math.atan2(closedDirection.y, closedDirection.x);
  const end = Math.atan2(openDirection.y, openDirection.x);
  let delta = end - start;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Array.from({ length: 17 }, (_, index) => {
    const angle = start + delta * (index / 16);
    return { x: hinge.x + Math.cos(angle) * radius, y: hinge.y + Math.sin(angle) * radius };
  });
}

export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const panRef = useRef<{ active: boolean; last: Point2 }>({ active: false, last: { x: 0, y: 0 } });
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [openingPreview, setOpeningPreview] = useState<OpeningPreview | null>(null);
  const [viewport, setViewport] = useState<ViewportTransform>({ offsetX: 140, offsetY: 140, pixelsPerMillimeter: INITIAL_SCALE });

  const tool = useStore(editorStore, (state) => state.tool);
  const document = useStore(editorStore, (state) => state.history.document);
  const draftWall = useStore(editorStore, (state) => state.draftWall);
  const selectedWallId = useStore(editorStore, (state) => state.selectedWallId);
  const selectedRoomId = useStore(editorStore, (state) => state.selectedRoomId);
  const selectedOpeningId = useStore(editorStore, (state) => state.selectedOpeningId);

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
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === "Space") setSpacePressed(false); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  useEffect(() => { if (tool !== "door" && tool !== "window") setOpeningPreview(null); }, [tool]);

  const vertexMap = useMemo(() => new Map(document.vertices.map((vertex) => [vertex.id, vertex])), [document.vertices]);
  const resolvedWalls = useMemo<ResolvedWall[]>(() => document.walls.flatMap((wall) => {
    const start = vertexMap.get(wall.startVertexId);
    const end = vertexMap.get(wall.endVertexId);
    return start && end ? [{ wall, start: start.position, end: end.position }] : [];
  }), [document.walls, vertexMap]);
  const derivedRooms = useMemo(() => deriveRooms(document), [document]);
  const errorDiagnostics = derivedRooms.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const gridStep = chooseGridStep(viewport.pixelsPerMillimeter);
  const endpoints = useMemo(() => document.vertices.map((vertex) => vertex.position), [document.vertices]);

  const gridLines = useMemo(() => {
    const topLeft = screenToWorld({ x: 0, y: 0 }, viewport);
    const bottomRight = screenToWorld({ x: size.width, y: size.height }, viewport);
    const minX = Math.min(topLeft.x, bottomRight.x), maxX = Math.max(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y), maxY = Math.max(topLeft.y, bottomRight.y);
    const lines: Array<{ key: string; points: number[]; major: boolean }> = [];
    for (let x = Math.floor(minX / gridStep) * gridStep - gridStep; x <= Math.ceil(maxX / gridStep) * gridStep + gridStep; x += gridStep) {
      const sx = worldToScreen({ x, y: 0 }, viewport).x;
      lines.push({ key: `x-${x}`, points: [sx, 0, sx, size.height], major: Math.round(x / gridStep) % 5 === 0 });
    }
    for (let y = Math.floor(minY / gridStep) * gridStep - gridStep; y <= Math.ceil(maxY / gridStep) * gridStep + gridStep; y += gridStep) {
      const sy = worldToScreen({ x: 0, y }, viewport).y;
      lines.push({ key: `y-${y}`, points: [0, sy, size.width, sy], major: Math.round(y / gridStep) % 5 === 0 });
    }
    return lines;
  }, [gridStep, size.height, size.width, viewport]);

  const pointerPosition = (event: KonvaEventObject<MouseEvent | WheelEvent>): Point2 | null => event.target.getStage()?.getPointerPosition() ?? null;

  const snapPointer = (screenPoint: Point2, startPoint?: Point2 | null): PointerSnap => {
    const rawPoint = screenToWorld(screenPoint, viewport);
    const tolerance = SNAP_TOLERANCE_PX / viewport.pixelsPerMillimeter;
    const vertexCandidate = document.vertices.map((vertex, index) => ({ vertex, index, distance: distanceBetween(rawPoint, vertex.position) })).filter((candidate) => candidate.distance <= tolerance).sort((a, b) => a.distance - b.distance || a.index - b.index)[0];
    if (vertexCandidate) {
      const point = vertexCandidate.vertex.position;
      return { snap: { point, kind: "endpoint", guides: [] }, target: { kind: "vertex", vertexId: vertexCandidate.vertex.id, point } };
    }
    const wallCandidate = resolvedWalls.map((resolved, index) => ({ resolved, index, projection: projectPointToSegment(rawPoint, resolved.start, resolved.end) })).filter((candidate) => candidate.projection.distance <= tolerance && candidate.projection.t > 1e-6 && candidate.projection.t < 1 - 1e-6).sort((a, b) => a.projection.distance - b.projection.distance || a.index - b.index)[0];
    if (wallCandidate) {
      const point = wallCandidate.projection.point;
      return { snap: { point, kind: "wall", guides: [] }, target: { kind: "wall", wallId: wallCandidate.resolved.wall.id, point } };
    }
    return { snap: snapWallPoint({ rawPoint, startPoint, endpoints, gridStep, tolerance }), target: null };
  };

  const updateOpeningPreview = (screenPoint: Point2) => {
    if (tool !== "door" && tool !== "window") return;
    const raw = screenToWorld(screenPoint, viewport);
    const tolerance = Math.max(SNAP_TOLERANCE_PX / viewport.pixelsPerMillimeter, 250);
    const candidate = resolvedWalls.map((resolved, index) => ({ resolved, index, projection: projectPointToSegment(raw, resolved.start, resolved.end) })).filter((item) => item.projection.distance <= tolerance).sort((a, b) => a.projection.distance - b.projection.distance || a.index - b.index)[0];
    if (!candidate) { setOpeningPreview(null); return; }
    const pointerOffset = projectPointToWallOffset(document, candidate.resolved.wall.id, candidate.projection.point);
    const width = tool === "door" ? 900 : 1200;
    let placement: { offset: number; width: number };
    try { placement = proposeOpeningPlacement(document, candidate.resolved.wall.id, pointerOffset, width); } catch { setOpeningPreview(null); return; }
    const opening: Opening = {
      id: "__preview__",
      wallId: candidate.resolved.wall.id,
      kind: tool,
      ...placement,
      ...(tool === "door" ? { doorSwing: { hinge: "start", side: "left" } } : {}),
    };
    let valid = true;
    try { validateOpening(document, opening); } catch { valid = false; }
    setOpeningPreview({ wallId: opening.wallId, pointerOffset, opening, valid });
  };

  const onWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const pointer = pointerPosition(event); if (!pointer) return;
    setViewport((current) => zoomViewportAt(current, pointer, Math.exp(-event.evt.deltaY * 0.0015), { min: MIN_SCALE, max: MAX_SCALE }));
  };

  const onMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    const pointer = pointerPosition(event); if (!pointer) return;
    const shouldPan = event.evt.button === 1 || (event.evt.button === 0 && spacePressed);
    if (shouldPan) { event.evt.preventDefault(); panRef.current = { active: true, last: pointer }; return; }
    if (event.evt.button !== 0) return;
    if (tool === "wall") {
      const resolved = snapPointer(pointer, draftWall?.start ?? null);
      if (!draftWall) editorStore.getState().beginWall(resolved.snap.point, resolved.target);
      else { editorStore.getState().updateDraftWall(resolved.snap, resolved.target); editorStore.getState().commitDraftWall(); }
      return;
    }
    if ((tool === "door" || tool === "window") && openingPreview?.valid) {
      editorStore.getState().addOpeningAt(openingPreview.wallId, openingPreview.pointerOffset);
      return;
    }
    editorStore.getState().selectWall(null);
  };

  const onMouseMove = (event: KonvaEventObject<MouseEvent>) => {
    const pointer = pointerPosition(event); if (!pointer) return;
    if (panRef.current.active) {
      const dx = pointer.x - panRef.current.last.x, dy = pointer.y - panRef.current.last.y;
      panRef.current = { active: true, last: pointer };
      setViewport((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));
      return;
    }
    if (tool === "wall" && draftWall) {
      const resolved = snapPointer(pointer, draftWall.start);
      editorStore.getState().updateDraftWall(resolved.snap, resolved.target);
    } else if (tool === "door" || tool === "window") updateOpeningPreview(pointer);
  };

  const endPan = () => { panRef.current.active = false; };
  const draftStartScreen = draftWall ? worldToScreen(draftWall.start, viewport) : null;
  const draftEndScreen = draftWall ? worldToScreen(draftWall.end, viewport) : null;
  const draftLength = draftWall ? Math.hypot(draftWall.end.x - draftWall.start.x, draftWall.end.y - draftWall.start.y) : 0;
  const draftTargetScreen = draftWall?.endTarget ? worldToScreen(draftWall.endTarget.point, viewport) : null;

  const renderOpeningSymbol = (opening: Opening, preview = false) => {
    const segment = openingSegment(document, opening);
    const start = worldToScreen(segment.start, viewport), end = worldToScreen(segment.end, viewport);
    const selected = opening.id === selectedOpeningId;
    const stroke = preview ? (openingPreview?.valid ? "#1769ff" : "#ef4444") : (selected ? "#1769ff" : "#374151");
    const wall = document.walls.find((candidate) => candidate.id === opening.wallId)!;
    const gapWidth = Math.max(3, wall.thickness * viewport.pixelsPerMillimeter + 3);
    const elements = [<Line key={`${opening.id}-gap`} points={[start.x, start.y, end.x, end.y]} stroke="#ffffff" strokeWidth={gapWidth} listening={false} />];
    if (opening.kind === "window") {
      const normal = { x: segment.leftNormal.x * wall.thickness * 0.22, y: segment.leftNormal.y * wall.thickness * 0.22 };
      for (const sign of [-1, 1]) {
        const a = worldToScreen({ x: segment.start.x + normal.x * sign, y: segment.start.y + normal.y * sign }, viewport);
        const b = worldToScreen({ x: segment.end.x + normal.x * sign, y: segment.end.y + normal.y * sign }, viewport);
        elements.push(<Line key={`${opening.id}-window-${sign}`} points={[a.x, a.y, b.x, b.y]} stroke={stroke} strokeWidth={1.5} listening={preview ? false : true} onMouseDown={(e) => { if (!preview && tool === "select") { e.cancelBubble = true; editorStore.getState().selectOpening(opening.id); } }} />);
      }
    } else {
      const hingeAtStart = opening.doorSwing?.hinge !== "end";
      const hinge = hingeAtStart ? segment.start : segment.end;
      const closedDirection = hingeAtStart ? segment.tangent : { x: -segment.tangent.x, y: -segment.tangent.y };
      const sideSign = opening.doorSwing?.side === "right" ? -1 : 1;
      const openDirection = { x: segment.leftNormal.x * sideSign, y: segment.leftNormal.y * sideSign };
      const openEnd = { x: hinge.x + openDirection.x * opening.width, y: hinge.y + openDirection.y * opening.width };
      const hingeScreen = worldToScreen(hinge, viewport), openScreen = worldToScreen(openEnd, viewport);
      elements.push(<Line key={`${opening.id}-leaf`} points={[hingeScreen.x, hingeScreen.y, openScreen.x, openScreen.y]} stroke={stroke} strokeWidth={2} hitStrokeWidth={12} listening={!preview} onMouseDown={(e) => { if (!preview && tool === "select") { e.cancelBubble = true; editorStore.getState().selectOpening(opening.id); } }} />);
      const arc = arcPoints(hinge, closedDirection, openDirection, opening.width).flatMap((point) => { const s = worldToScreen(point, viewport); return [s.x, s.y]; });
      elements.push(<Line key={`${opening.id}-arc`} points={arc} stroke={stroke} strokeWidth={1} dash={[4, 3]} opacity={0.75} listening={false} />);
    }
    return elements;
  };

  return (
    <div ref={containerRef} className={`canvas-shell tool-${tool}${spacePressed ? " is-pan-ready" : ""}`} onContextMenu={(event) => event.preventDefault()}>
      <Stage ref={stageRef} width={size.width} height={size.height} onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={endPan} onMouseLeave={() => { endPan(); setOpeningPreview(null); }}>
        <Layer listening={false}>{gridLines.map((line) => <Line key={line.key} points={line.points} stroke={line.major ? "#d9dde3" : "#eceff3"} strokeWidth={1} perfectDrawEnabled={false} />)}</Layer>
        <Layer>
          {derivedRooms.rooms.map((room) => {
            const points = room.polygon.flatMap((point) => { const screen = worldToScreen(point, viewport); return [screen.x, screen.y]; });
            const selected = room.id === selectedRoomId;
            return <Line key={room.id} points={points} closed fill={selected ? "#dbeafe" : "#f4f7fb"} stroke={selected ? "#93c5fd" : undefined} strokeWidth={selected ? 1.5 : 0} opacity={selected ? 0.9 : 0.72} onMouseDown={(e) => { if (tool === "select") { e.cancelBubble = true; editorStore.getState().selectRoom(room.id); } }} />;
          })}
          {derivedRooms.rooms.map((room) => { const label = worldToScreen(room.labelPoint, viewport); return <Text key={`label-${room.id}`} x={label.x - 80} y={label.y - 18} width={160} align="center" text={`${room.name}\n${room.areaM2.toFixed(2)} м²`} fontSize={12} lineHeight={1.35} fill="#4b5563" listening={false} />; })}
        </Layer>
        <Layer>
          {resolvedWalls.flatMap(({ wall }) => deriveVisibleWallIntervals(document, wall.id).map((interval, index) => {
            const a = worldToScreen(pointAtWallOffset(document, wall.id, interval.startOffset), viewport);
            const b = worldToScreen(pointAtWallOffset(document, wall.id, interval.endOffset), viewport);
            const selected = wall.id === selectedWallId;
            const visualWidth = Math.max(2, wall.thickness * viewport.pixelsPerMillimeter);
            return <Line key={`${wall.id}-visible-${index}`} points={[a.x, a.y, b.x, b.y]} stroke={selected ? "#1769ff" : "#232830"} strokeWidth={visualWidth} hitStrokeWidth={Math.max(14, visualWidth)} lineCap="square" lineJoin="miter" onMouseDown={(e) => { if (tool === "select") { e.cancelBubble = true; editorStore.getState().selectWall(wall.id); } }} />;
          }))}
          {document.openings.flatMap((opening) => renderOpeningSymbol(opening))}
          {openingPreview ? renderOpeningSymbol(openingPreview.opening, true) : null}
          {tool === "wall" ? document.vertices.map((vertex) => { const screen = worldToScreen(vertex.position, viewport); const isJunction = document.walls.some((wall) => wall.junctionVertexIds.includes(vertex.id)); return <Circle key={vertex.id} x={screen.x} y={screen.y} radius={isJunction ? 4.5 : 3.5} fill={isJunction ? "#fff" : "#1769ff"} stroke="#1769ff" strokeWidth={1.5} opacity={0.8} listening={false} />; }) : null}
          {draftWall?.snap.guides.map((guide, index) => guide.axis === "x" ? <Line key={`guide-x-${index}`} points={[worldToScreen({ x: guide.value, y: 0 }, viewport).x, 0, worldToScreen({ x: guide.value, y: 0 }, viewport).x, size.height]} stroke="#1769ff" strokeWidth={1} dash={[6,6]} opacity={0.55} listening={false} /> : <Line key={`guide-y-${index}`} points={[0, worldToScreen({ x: 0, y: guide.value }, viewport).y, size.width, worldToScreen({ x: 0, y: guide.value }, viewport).y]} stroke="#1769ff" strokeWidth={1} dash={[6,6]} opacity={0.55} listening={false} />)}
          {draftStartScreen && draftEndScreen ? <><Line points={[draftStartScreen.x,draftStartScreen.y,draftEndScreen.x,draftEndScreen.y]} stroke="#1769ff" strokeWidth={Math.max(2,150*viewport.pixelsPerMillimeter)} dash={[8,6]} opacity={0.75} listening={false}/><Circle x={draftStartScreen.x} y={draftStartScreen.y} radius={5} fill="#1769ff" listening={false}/><Circle x={draftEndScreen.x} y={draftEndScreen.y} radius={5} fill="#1769ff" listening={false}/>{draftTargetScreen ? <Circle x={draftTargetScreen.x} y={draftTargetScreen.y} radius={9} fill={draftWall?.endTarget?.kind === "wall" ? "#fff7ed" : "#eff6ff"} stroke={draftWall?.endTarget?.kind === "wall" ? "#f97316" : "#1769ff"} strokeWidth={2} listening={false}/> : null}{draftLength > 0 ? <Text x={(draftStartScreen.x+draftEndScreen.x)/2+10} y={(draftStartScreen.y+draftEndScreen.y)/2-26} text={`${Math.round(draftLength)} мм`} fontSize={13} fill="#1769ff" listening={false}/> : null}</> : null}
          {errorDiagnostics.map((diagnostic,index) => diagnostic.point ? (() => { const screen=worldToScreen(diagnostic.point!,viewport); return <Circle key={`diagnostic-${diagnostic.code}-${index}`} x={screen.x} y={screen.y} radius={8} fill="#ef4444" opacity={0.85} listening={false}/>; })() : null)}
        </Layer>
      </Stage>
      {errorDiagnostics.length > 0 ? <div className="topology-alert" role="status">Проверьте геометрию: {errorDiagnostics[0]?.message}</div> : null}
      <div className="canvas-help"><span>{Math.round(gridStep)} мм сетка</span><span>Колесо — масштаб</span><span>{tool === "door" || tool === "window" ? "Наведите на стену и кликните" : "Синие узлы — соединения"}</span><span>Space + drag / средняя кнопка — панорама</span></div>
    </div>
  );
}
