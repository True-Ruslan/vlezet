"use client";

import { createPlacedObject, type Opening, type PlacedObject, type Wall } from "@vlezet/domain";
import { validateOpening, type PlacedObjectPatch } from "@vlezet/editor-core";
import {
  chooseGridStep,
  deriveDocumentBounds,
  deriveRooms,
  deriveVisibleWallIntervals,
  distanceBetween,
  evaluateObjectFits,
  expandedOrientedRectangle,
  fitViewportToBounds,
  localToWorld,
  measureObjectClearances,
  objectRectangle,
  openingSegment,
  orientedRectangleCorners,
  pointAtWallOffset,
  projectPointToSegment,
  projectPointToWallOffset,
  proposeOpeningPlacement,
  referencePlanBounds,
  screenToWorld,
  snapWallPoint,
  worldToScreen,
  zoomViewportAt,
  type DirectionalClearances,
  type Point2,
  type SnapResult,
  type ViewportTransform,
} from "@vlezet/geometry";
import type { ReferencePlan } from "@vlezet/projects";
import type { NormalizedPoint, RecognitionDraft } from "@vlezet/recognition";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Layer, Line, Stage, Text } from "react-konva";
import { useStore } from "zustand";
import { getFurniturePreset } from "./furniture-presets";
import { snapPlacedObject, type ObjectSnapGuide } from "./object-snapping";
import { PlacedObjectShape } from "./placed-object-shape";
import { RecognitionLayer } from "../recognition/recognition-layer";
import { ReferenceLayer } from "../reference/reference-layer";
import { useReferenceImage } from "../reference/use-reference-image";
import { editorStore, type TopologySnapTarget } from "./use-editor-store";

const MIN_SCALE = 0.01;
const MAX_SCALE = 2;
const SNAP_TOLERANCE_PX = 12;
const PLACEMENT_PREVIEW_ID = "__placement-preview__";

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

function screenPolygon(points: readonly Point2[], viewport: ViewportTransform): number[] {
  return points.flatMap((point) => {
    const screen = worldToScreen(point, viewport);
    return [screen.x, screen.y];
  });
}

function previewFromPreset(presetId: string, position: Point2): PlacedObject {
  const preset = getFurniturePreset(presetId);
  return createPlacedObject({
    id: PLACEMENT_PREVIEW_ID,
    presetId: preset.id,
    name: preset.name,
    category: preset.category,
    position,
    width: preset.width,
    depth: preset.depth,
    ...(preset.height === undefined ? {} : { height: preset.height }),
    rotationDeg: 0,
    clearance: preset.clearance,
  });
}

function measurementLabel(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)} мм`;
}

export type EditorCanvasProps = Readonly<{
  initialViewport: ViewportTransform;
  onViewportChange: (viewport: ViewportTransform) => void;
  fitRequest: number;
  fitReferenceRequest: number;
  referencePlan: ReferencePlan | null;
  referenceAssetBlob: Blob | null;
  tracingMode: boolean;
  recognitionDraft: RecognitionDraft | null;
  selectedRecognitionCandidateId: string | null;
  recognitionReviewActive: boolean;
  onSelectRecognitionCandidate: (candidateId: string | null) => void;
  onEditRecognitionWall: (candidateId: string, patch: Readonly<{ start?: NormalizedPoint; end?: NormalizedPoint }>) => void;
  onReferenceMoveEnd: (originWorld: Point2) => void;
}>;

type ViewportUpdater = ViewportTransform | ((current: ViewportTransform) => ViewportTransform);

export function EditorCanvas({ initialViewport, onViewportChange, fitRequest, fitReferenceRequest, referencePlan, referenceAssetBlob, tracingMode, recognitionDraft, selectedRecognitionCandidateId, recognitionReviewActive, onSelectRecognitionCandidate, onEditRecognitionWall, onReferenceMoveEnd }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const panRef = useRef<{ active: boolean; last: Point2 }>({ active: false, last: { x: 0, y: 0 } });
  const handledFitRequestRef = useRef(fitRequest);
  const handledFitReferenceRequestRef = useRef(fitReferenceRequest);
  const viewportRef = useRef<ViewportTransform>({ ...initialViewport });
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [openingPreview, setOpeningPreview] = useState<OpeningPreview | null>(null);
  const [placementPreview, setPlacementPreview] = useState<PlacedObject | null>(null);
  const [objectGuides, setObjectGuides] = useState<readonly ObjectSnapGuide[]>([]);
  const [viewport, setViewport] = useState<ViewportTransform>(() => ({ ...initialViewport }));

  const commitViewport = useCallback((next: ViewportTransform) => {
    viewportRef.current = next;
    setViewport(next);
    onViewportChange(next);
  }, [onViewportChange]);

  const updateViewport = useCallback((update: ViewportUpdater) => {
    const next = typeof update === "function" ? update(viewportRef.current) : update;
    commitViewport(next);
  }, [commitViewport]);

  const tool = useStore(editorStore, (state) => state.tool);
  const document = useStore(editorStore, (state) => state.history.document);
  const draftWall = useStore(editorStore, (state) => state.draftWall);
  const selectedWallId = useStore(editorStore, (state) => state.selectedWallId);
  const selectedRoomId = useStore(editorStore, (state) => state.selectedRoomId);
  const selectedOpeningId = useStore(editorStore, (state) => state.selectedOpeningId);
  const selectedObjectId = useStore(editorStore, (state) => state.selectedObjectId);
  const placementPresetId = useStore(editorStore, (state) => state.placementPresetId);
  const objectGesture = useStore(editorStore, (state) => state.objectGesture);

  const visibleOpeningPreview = tool === "door" || tool === "window" ? openingPreview : null;
  const visiblePlacementPreview = placementPresetId && placementPreview?.presetId === placementPresetId ? placementPreview : null;
  const { image: referenceImage } = useReferenceImage(referenceAssetBlob);
  const visibleReferenceBounds = useMemo(() => referencePlan?.display.visible ? referencePlanBounds(referencePlan) : null, [referencePlan]);

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
    if (fitRequest === handledFitRequestRef.current || size.width <= 1 || size.height <= 1) return;
    handledFitRequestRef.current = fitRequest;
    commitViewport(fitViewportToBounds(deriveDocumentBounds(document, { additionalBounds: visibleReferenceBounds }), size, 64));
  }, [commitViewport, document, fitRequest, size, visibleReferenceBounds]);

  useEffect(() => {
    if (fitReferenceRequest === handledFitReferenceRequestRef.current || size.width <= 1 || size.height <= 1 || !visibleReferenceBounds) return;
    handledFitReferenceRequestRef.current = fitReferenceRequest;
    commitViewport(fitViewportToBounds(visibleReferenceBounds, size, 64));
  }, [commitViewport, fitReferenceRequest, size, visibleReferenceBounds]);

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

  const displayedObjects = useMemo(() => document.placedObjects.map((object) =>
    objectGesture?.objectId === object.id ? objectGesture.preview : object,
  ), [document.placedObjects, objectGesture]);

  const evaluationDocument = useMemo(() => ({
    ...document,
    placedObjects: visiblePlacementPreview ? [...displayedObjects, visiblePlacementPreview] : displayedObjects,
  }), [displayedObjects, document, visiblePlacementPreview]);

  const fitEvaluation = useMemo(() => evaluateObjectFits(evaluationDocument), [evaluationDocument]);
  const selectedObject = displayedObjects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedClearances = useMemo<DirectionalClearances | null>(() => {
    if (!selectedObject) return null;
    try { return measureObjectClearances(evaluationDocument, selectedObject.id); } catch { return null; }
  }, [evaluationDocument, selectedObject]);

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

  const updatePlacementPreview = (screenPoint: Point2) => {
    if (!placementPresetId) return;
    const rawPosition = screenToWorld(screenPoint, viewport);
    const initial = previewFromPreset(placementPresetId, rawPosition);
    const snap = snapPlacedObject({
      rawPosition,
      moving: initial,
      others: displayedObjects,
      tolerance: SNAP_TOLERANCE_PX / viewport.pixelsPerMillimeter,
      gridStep,
    });
    setPlacementPreview({ ...initial, position: snap.position });
    setObjectGuides(snap.guides);
  };

  const previewObjectGesture = (objectId: string, patch: PlacedObjectPatch) => {
    const state = editorStore.getState();
    const gesture = state.objectGesture;
    const source = gesture?.objectId === objectId
      ? gesture.preview
      : state.history.document.placedObjects.find((object) => object.id === objectId);
    if (!source) return;

    if (patch.position) {
      const moving = { ...source, position: patch.position };
      const snap = snapPlacedObject({
        rawPosition: patch.position,
        moving,
        others: displayedObjects.filter((object) => object.id !== objectId),
        tolerance: SNAP_TOLERANCE_PX / viewport.pixelsPerMillimeter,
        gridStep,
      });
      setObjectGuides(snap.guides);
      state.previewObjectGesture({ ...patch, position: snap.position });
      return;
    }

    state.previewObjectGesture(patch);
  };

  const onWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const pointer = pointerPosition(event); if (!pointer) return;
    updateViewport((current) => zoomViewportAt(current, pointer, Math.exp(-event.evt.deltaY * 0.0015), { min: MIN_SCALE, max: MAX_SCALE }));
  };

  const onMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    const pointer = pointerPosition(event); if (!pointer) return;
    const shouldPan = event.evt.button === 1 || (event.evt.button === 0 && spacePressed);
    if (shouldPan) { event.evt.preventDefault(); panRef.current = { active: true, last: pointer }; return; }
    if (event.evt.button !== 0) return;
    if (recognitionReviewActive) { onSelectRecognitionCandidate(null); return; }

    if (placementPresetId && visiblePlacementPreview) {
      editorStore.getState().placeSelectedPreset(visiblePlacementPreview.position);
      setPlacementPreview(null);
      setObjectGuides([]);
      return;
    }
    if (tool === "wall") {
      const resolved = snapPointer(pointer, draftWall?.start ?? null);
      if (!draftWall) editorStore.getState().beginWall(resolved.snap.point, resolved.target);
      else { editorStore.getState().updateDraftWall(resolved.snap, resolved.target); editorStore.getState().commitDraftWall(); }
      return;
    }
    if ((tool === "door" || tool === "window") && visibleOpeningPreview?.valid) {
      editorStore.getState().addOpeningAt(visibleOpeningPreview.wallId, visibleOpeningPreview.pointerOffset);
      return;
    }
    editorStore.getState().selectObject(null);
  };

  const onMouseMove = (event: KonvaEventObject<MouseEvent>) => {
    const pointer = pointerPosition(event); if (!pointer) return;
    if (panRef.current.active) {
      const dx = pointer.x - panRef.current.last.x, dy = pointer.y - panRef.current.last.y;
      panRef.current = { active: true, last: pointer };
      updateViewport((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));
      return;
    }
    if (recognitionReviewActive) return;
    if (placementPresetId) updatePlacementPreview(pointer);
    else if (tool === "wall" && draftWall) {
      const resolved = snapPointer(pointer, draftWall.start);
      editorStore.getState().updateDraftWall(resolved.snap, resolved.target);
    } else if (tool === "door" || tool === "window") updateOpeningPreview(pointer);
  };

  const endPan = () => { panRef.current.active = false; };
  const clearTransientCanvasState = () => {
    endPan();
    setOpeningPreview(null);
    setPlacementPreview(null);
    setObjectGuides([]);
  };

  const draftStartScreen = draftWall ? worldToScreen(draftWall.start, viewport) : null;
  const draftEndScreen = draftWall ? worldToScreen(draftWall.end, viewport) : null;
  const draftLength = draftWall ? Math.hypot(draftWall.end.x - draftWall.start.x, draftWall.end.y - draftWall.start.y) : 0;
  const draftTargetScreen = draftWall?.endTarget ? worldToScreen(draftWall.endTarget.point, viewport) : null;

  const renderOpeningSymbol = (opening: Opening, preview = false) => {
    const segment = openingSegment(document, opening);
    const start = worldToScreen(segment.start, viewport), end = worldToScreen(segment.end, viewport);
    const selected = opening.id === selectedOpeningId;
    const stroke = preview ? (visibleOpeningPreview?.valid ? "#1769ff" : "#ef4444") : (selected ? "#1769ff" : "#374151");
    const wall = document.walls.find((candidate) => candidate.id === opening.wallId)!;
    const gapWidth = Math.max(3, wall.thickness * viewport.pixelsPerMillimeter + 3);
    const elements = [<Line key={`${opening.id}-gap`} points={[start.x, start.y, end.x, end.y]} stroke="#ffffff" strokeWidth={gapWidth} listening={false} />];
    if (opening.kind === "window") {
      const normal = { x: segment.leftNormal.x * wall.thickness * 0.22, y: segment.leftNormal.y * wall.thickness * 0.22 };
      for (const sign of [-1, 1]) {
        const a = worldToScreen({ x: segment.start.x + normal.x * sign, y: segment.start.y + normal.y * sign }, viewport);
        const b = worldToScreen({ x: segment.end.x + normal.x * sign, y: segment.end.y + normal.y * sign }, viewport);
        elements.push(<Line key={`${opening.id}-window-${sign}`} points={[a.x, a.y, b.x, b.y]} stroke={stroke} strokeWidth={1.5} listening={!preview} onMouseDown={(e) => { if (!preview && tool === "select") { e.cancelBubble = true; editorStore.getState().selectOpening(opening.id); } }} />);
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

  const clearancePolygon = selectedObject
    ? orientedRectangleCorners(expandedOrientedRectangle(objectRectangle(selectedObject), selectedObject.clearance))
    : null;

  const dimensionLabels = selectedObject ? (() => {
    const rectangle = objectRectangle(selectedObject);
    const widthPoint = localToWorld(rectangle, { x: 0, y: -selectedObject.depth / 2 - 110 });
    const depthPoint = localToWorld(rectangle, { x: selectedObject.width / 2 + 110, y: 0 });
    return {
      width: { point: widthPoint, text: `${Math.round(selectedObject.width)} мм` },
      depth: { point: depthPoint, text: `${Math.round(selectedObject.depth)} мм` },
    };
  })() : null;

  const clearanceLabelPoints = selectedObject && selectedClearances ? (() => {
    const rectangle = objectRectangle(selectedObject);
    const values = selectedClearances;
    const position = (side: keyof DirectionalClearances, distance: number | null): Point2 => {
      const half = distance === null ? 250 : distance / 2;
      if (side === "front") return localToWorld(rectangle, { x: 0, y: selectedObject.depth / 2 + half });
      if (side === "back") return localToWorld(rectangle, { x: 0, y: -selectedObject.depth / 2 - half });
      if (side === "right") return localToWorld(rectangle, { x: selectedObject.width / 2 + half, y: 0 });
      return localToWorld(rectangle, { x: -selectedObject.width / 2 - half, y: 0 });
    };
    return (Object.keys(values) as Array<keyof DirectionalClearances>).map((side) => ({ side, value: values[side], point: position(side, values[side]) }));
  })() : [];

  const helpText = placementPresetId
    ? "Выберите место для предмета"
    : tool === "door" || tool === "window"
      ? "Наведите на стену и кликните"
      : "Синие узлы — соединения";

  return (
    <div ref={containerRef} className={`canvas-shell tool-${tool}${placementPresetId ? " is-placing-object" : ""}${spacePressed ? " is-pan-ready" : ""}`} onContextMenu={(event) => event.preventDefault()}>
      <Stage ref={stageRef} width={size.width} height={size.height} onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={endPan} onMouseLeave={clearTransientCanvasState}>
        <Layer listening={false}>{gridLines.map((line) => <Line key={line.key} points={line.points} stroke={line.major ? "#d9dde3" : "#eceff3"} strokeWidth={1} perfectDrawEnabled={false} />)}</Layer>
        {referencePlan && referenceImage ? <Layer><ReferenceLayer referencePlan={referencePlan} image={referenceImage} viewport={viewport} onMoveEnd={onReferenceMoveEnd} /></Layer> : null}
        <Layer>
          {derivedRooms.rooms.map((room) => {
            const selected = room.id === selectedRoomId;
            return <Line key={room.id} points={screenPolygon(room.polygon, viewport)} closed fill={selected ? "#dbeafe" : "#f4f7fb"} stroke={selected ? "#93c5fd" : undefined} strokeWidth={selected ? 1.5 : 0} opacity={tracingMode ? (selected ? 0.42 : 0.2) : (selected ? 0.9 : 0.72)} onMouseDown={(e) => { if (tool === "select" && !placementPresetId) { e.cancelBubble = true; editorStore.getState().selectRoom(room.id); } }} />;
          })}
          {derivedRooms.rooms.map((room) => { const label = worldToScreen(room.labelPoint, viewport); return <Text key={`label-${room.id}`} x={label.x - 80} y={label.y - 18} width={160} align="center" text={`${room.name}\n${room.areaM2.toFixed(2)} м²`} fontSize={12} lineHeight={1.35} fill="#4b5563" listening={false} />; })}
          {resolvedWalls.flatMap(({ wall }) => deriveVisibleWallIntervals(document, wall.id).map((interval, index) => {
            const a = worldToScreen(pointAtWallOffset(document, wall.id, interval.startOffset), viewport);
            const b = worldToScreen(pointAtWallOffset(document, wall.id, interval.endOffset), viewport);
            const selected = wall.id === selectedWallId;
            const visualWidth = Math.max(2, wall.thickness * viewport.pixelsPerMillimeter);
            return <Line key={`${wall.id}-visible-${index}`} points={[a.x, a.y, b.x, b.y]} stroke={selected ? "#1769ff" : "#232830"} strokeWidth={visualWidth} hitStrokeWidth={Math.max(14, visualWidth)} lineCap="square" lineJoin="miter" onMouseDown={(e) => { if (tool === "select" && !placementPresetId) { e.cancelBubble = true; editorStore.getState().selectWall(wall.id); } }} />;
          }))}
          {document.openings.flatMap((opening) => renderOpeningSymbol(opening))}
          {visibleOpeningPreview ? renderOpeningSymbol(visibleOpeningPreview.opening, true) : null}
          {tool === "wall" && !recognitionReviewActive ? document.vertices.map((vertex) => { const screen = worldToScreen(vertex.position, viewport); const isJunction = document.walls.some((wall) => wall.junctionVertexIds.includes(vertex.id)); return <Circle key={vertex.id} x={screen.x} y={screen.y} radius={isJunction ? 4.5 : 3.5} fill={isJunction ? "#fff" : "#1769ff"} stroke="#1769ff" strokeWidth={1.5} opacity={0.8} listening={false} />; }) : null}
          {recognitionDraft && referencePlan ? <RecognitionLayer draft={recognitionDraft} referencePlan={referencePlan} viewport={viewport} selectedCandidateId={selectedRecognitionCandidateId} onSelect={onSelectRecognitionCandidate} onEditWall={onEditRecognitionWall} /> : null}
        </Layer>
        <Layer>
          {clearancePolygon ? <Line points={screenPolygon(clearancePolygon, viewport)} closed fill="#f59e0b" opacity={0.08} stroke="#d97706" strokeWidth={1.2} dash={[6, 5]} listening={false} /> : null}
          {displayedObjects.map((object) => (
            <PlacedObjectShape
              key={object.id}
              object={object}
              viewport={viewport}
              selected={object.id === selectedObjectId}
              fitStatus={fitEvaluation.byObjectId.get(object.id)?.status ?? "blocked"}
              onSelect={() => editorStore.getState().selectObject(object.id)}
              onGestureStart={(kind) => editorStore.getState().beginObjectGesture(object.id, kind)}
              onGesturePreview={(patch) => previewObjectGesture(object.id, patch)}
              onGestureCommit={() => { editorStore.getState().commitObjectGesture(); setObjectGuides([]); }}
            />
          ))}
          {visiblePlacementPreview ? (
            <PlacedObjectShape
              object={visiblePlacementPreview}
              viewport={viewport}
              selected={false}
              preview
              fitStatus={fitEvaluation.byObjectId.get(PLACEMENT_PREVIEW_ID)?.status ?? "blocked"}
            />
          ) : null}
        </Layer>
        <Layer listening={false}>
          {objectGuides.map((guide, index) => guide.axis === "x"
            ? <Line key={`object-guide-x-${index}`} points={[worldToScreen({ x: guide.value, y: 0 }, viewport).x, 0, worldToScreen({ x: guide.value, y: 0 }, viewport).x, size.height]} stroke="#0ea5e9" strokeWidth={1} dash={[5, 5]} opacity={0.72} />
            : <Line key={`object-guide-y-${index}`} points={[0, worldToScreen({ x: 0, y: guide.value }, viewport).y, size.width, worldToScreen({ x: 0, y: guide.value }, viewport).y]} stroke="#0ea5e9" strokeWidth={1} dash={[5, 5]} opacity={0.72} />)}
          {draftWall?.snap.guides.map((guide, index) => guide.axis === "x" ? <Line key={`guide-x-${index}`} points={[worldToScreen({ x: guide.value, y: 0 }, viewport).x, 0, worldToScreen({ x: guide.value, y: 0 }, viewport).x, size.height]} stroke="#1769ff" strokeWidth={1} dash={[6,6]} opacity={0.55} /> : <Line key={`guide-y-${index}`} points={[0, worldToScreen({ x: 0, y: guide.value }, viewport).y, size.width, worldToScreen({ x: 0, y: guide.value }, viewport).y]} stroke="#1769ff" strokeWidth={1} dash={[6,6]} opacity={0.55} />)}
          {draftStartScreen && draftEndScreen ? <><Line points={[draftStartScreen.x,draftStartScreen.y,draftEndScreen.x,draftEndScreen.y]} stroke="#1769ff" strokeWidth={Math.max(2,150*viewport.pixelsPerMillimeter)} dash={[8,6]} opacity={0.75}/><Circle x={draftStartScreen.x} y={draftStartScreen.y} radius={5} fill="#1769ff"/><Circle x={draftEndScreen.x} y={draftEndScreen.y} radius={5} fill="#1769ff"/>{draftTargetScreen ? <Circle x={draftTargetScreen.x} y={draftTargetScreen.y} radius={9} fill={draftWall?.endTarget?.kind === "wall" ? "#fff7ed" : "#eff6ff"} stroke={draftWall?.endTarget?.kind === "wall" ? "#f97316" : "#1769ff"} strokeWidth={2}/> : null}{draftLength > 0 ? <Text x={(draftStartScreen.x+draftEndScreen.x)/2+10} y={(draftStartScreen.y+draftEndScreen.y)/2-26} text={`${Math.round(draftLength)} мм`} fontSize={13} fill="#1769ff"/> : null}</> : null}
          {dimensionLabels ? (() => {
            const width = worldToScreen(dimensionLabels.width.point, viewport);
            const depth = worldToScreen(dimensionLabels.depth.point, viewport);
            return <><Text x={width.x - 45} y={width.y - 8} width={90} align="center" text={dimensionLabels.width.text} fontSize={11} fill="#1769ff"/><Text x={depth.x - 45} y={depth.y - 8} width={90} align="center" text={dimensionLabels.depth.text} fontSize={11} fill="#1769ff"/></>;
          })() : null}
          {clearanceLabelPoints.map((item) => { const screen = worldToScreen(item.point, viewport); return <Text key={`clearance-${item.side}`} x={screen.x - 38} y={screen.y - 7} width={76} align="center" text={measurementLabel(item.value)} fontSize={10} fill="#64748b" />; })}
          {errorDiagnostics.map((diagnostic,index) => diagnostic.point ? (() => { const screen=worldToScreen(diagnostic.point!,viewport); return <Circle key={`diagnostic-${diagnostic.code}-${index}`} x={screen.x} y={screen.y} radius={8} fill="#ef4444" opacity={0.85}/>; })() : null)}
        </Layer>
      </Stage>
      {errorDiagnostics.length > 0 ? <div className="topology-alert" role="status">Проверьте геометрию: {errorDiagnostics[0]?.message}</div> : null}
      <div className="canvas-help"><span>{Math.round(gridStep)} мм сетка</span><span>Колесо — масштаб</span><span>{helpText}</span><span>Space + drag / средняя кнопка — панорама</span></div>
    </div>
  );
}
