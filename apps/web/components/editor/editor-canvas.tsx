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
  GEOMETRY_EPSILON_MM,
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
  resolveStructuralSnap,
  screenToWorld,
  vectorToCanvasAngleDeg,
  worldToScreen,
  zoomViewportAt,
  type DirectionalClearances,
  type Point2,
  type SnapResult,
  type StructuralSnapResult,
  type ViewportTransform,
} from "@vlezet/geometry";
import { DEFAULT_PROJECT_VIEWPORT, type ReferencePlan } from "@vlezet/projects";
import type { NormalizedPoint, RecognitionDraft } from "@vlezet/recognition";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Layer, Line, Stage, Text } from "react-konva";
import { useStore } from "zustand";
import { deriveExactGapAnnotation } from "../planning/exact-gap-annotation";
import { planningUiStore } from "../planning/planning-ui-store";
import { RecognitionLayer } from "../recognition/recognition-layer";
import { ReferenceLayer } from "../reference/reference-layer";
import { useReferenceImage } from "../reference/use-reference-image";
import { canvasEntityName, parseCanvasEntityName, type CanvasEntityIdentity } from "./canvas-entity-identity";
import { deriveCanvasEntityVisual } from "./canvas-entity-visual";
import { canvasTransientFeedbackStore } from "./canvas-transient-feedback-store";
import {
  deriveRectangularRoomDimensionAnnotations,
  deriveWallCentrelineDimensionAnnotation,
  formatRoomCanvasLabel,
} from "./dimension-annotations";
import { DimensionOverlay } from "./dimension-overlay";
import { ExactGapOverlay } from "./exact-gap-overlay";
import { fitStatusPresentation } from "./fit-status-badge";
import { getFurniturePreset } from "./furniture-presets";
import { geometryInspectorPreviewStore } from "./geometry-inspector-preview-store";
import { snapPlacedObject, type ObjectSnapGuide } from "./object-snapping";
import { PlacedObjectShape } from "./placed-object-shape";
import { StructuralHandleLayer } from "./structural-handle-layer";
import { StructuralSnapOverlay } from "./structural-snap-overlay";
import { structuralSnappingSettingsStore } from "./structural-snapping-settings-store";
import { TapeMeasurementTool } from "./tape-measurement-tool";
import { WallDynamicInput } from "./wall-dynamic-input";
import {
  clampFloatingInputPosition,
  parseWallAngleInput,
  parseWallLengthInput,
  resolveWallDynamicDraft,
} from "./wall-dynamic-input-model";
import type { EditorContextMenuRequest } from "./editor-context-menu";
import {
  actualSizeViewport,
  fitDocumentViewport,
  fitSelectionViewport,
  panViewportBy,
  wheelGestureToViewportAction,
  zoomViewportByCommand,
  type EditorViewportCommandRequest,
} from "./editor-viewport-controller";
import {
  deriveSelectionWorldBounds,
  entitiesAtPoint,
  entitiesIntersectingMarquee,
  type WorldRect,
} from "./editor-selection-geometry";
import type { EditorEntityRef } from "./editor-selection";
import {
  editorStore,
  selectedObjectId as selectedObjectIdFromSelection,
  selectedOpeningId as selectedOpeningIdFromSelection,
  selectedRoomId as selectedRoomIdFromSelection,
  selectedWallId as selectedWallIdFromSelection,
} from "./use-editor-store";
const MIN_SCALE = 0.01;
const MAX_SCALE = 2;
const COMMAND_ZOOM_FACTOR = 1.2;
const SNAP_TOLERANCE_PX = 12;
const STRUCTURAL_SNAP_RELEASE_PX = 18;
const STRUCTURAL_SNAP_REPLACEMENT_PX = 1;
const MARQUEE_THRESHOLD_PX = 4;
const PLACEMENT_PREVIEW_ID = "__placement-preview__";
const WALL_DYNAMIC_PANEL_SIZE = { width: 248, height: 128 } as const;
type ResolvedWall = Readonly<{ wall: Wall; start: Point2; end: Point2 }>;
type OpeningPreview = Readonly<{ wallId: string; pointerOffset: number; opening: Opening; valid: boolean }>;
type HoveredCanvasEntity = CanvasEntityIdentity | null;
type MarqueeGesture = Readonly<{
  startScreen: Point2;
  currentScreen: Point2;
  additive: boolean;
}>;
type StructuralPointerGesture =
  | Readonly<{ kind: "move-vertex"; vertexId: string }>
  | Readonly<{
      kind: "translate-wall";
      wallId: string;
      pointerStartWorld: Point2;
      anchorStartWorld: Point2;
      movedVertexIds: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "translate-room";
      roomId: string;
      pointerStartWorld: Point2;
      anchorStartWorld: Point2;
      movedVertexIds: ReadonlySet<string>;
      movedWallIds: ReadonlySet<string>;
    }>;
type WallInputState = Readonly<{
  lengthValue: string;
  angleValue: string;
  lengthEdited: boolean;
  angleEdited: boolean;
}>;
const EMPTY_WALL_INPUT: WallInputState = {
  lengthValue: "",
  angleValue: "",
  lengthEdited: false,
  angleEdited: false,
};
function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && (
      target.isContentEditable || target.closest("[data-editor-native-editable]") !== null
    ));
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
function visualStroke(role: ReturnType<typeof deriveCanvasEntityVisual>["strokeRole"], ordinary: string): string {
  if (role === "accent") return "#1769ff";
  if (role === "danger") return "#ef4444";
  if (role === "hover") return "#5b8def";
  return ordinary;
}
function canvasEntityFromKonvaNode(node: Konva.Node | null): HoveredCanvasEntity {
  let current = node;
  while (current) {
    const identity = parseCanvasEntityName(current.name());
    if (identity) return identity;
    current = current.getParent();
  }
  return null;
}
function entityKey(kind: EditorEntityRef["kind"], id: string): string {
  return `${kind}:${id}`;
}
function draftSnapFromStructural(snap: StructuralSnapResult): SnapResult {
  const kind: SnapResult["kind"] = snap.kind === "endpoint" || snap.kind === "junction"
    ? "endpoint"
    : snap.kind === "midpoint" || snap.kind === "intersection" || snap.kind === "wall-axis"
      ? "wall"
      : snap.kind === "grid"
        ? "grid"
        : snap.kind === "none"
          ? "none"
          : "axis";
  return { point: snap.point, kind, guides: [] };
}
function formatDynamicNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
export type EditorCanvasProps = Readonly<{
  initialViewport: ViewportTransform;
  onViewportChange: (viewport: ViewportTransform) => void;
  onPointerWorldChange: (point: Point2) => void;
  viewCommandRequest: EditorViewportCommandRequest | null;
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
  onContextMenuRequest: (request: EditorContextMenuRequest | null) => void;
}>;
type ViewportUpdater = ViewportTransform | ((current: ViewportTransform) => ViewportTransform);
export function EditorCanvas({ initialViewport, onViewportChange, onPointerWorldChange, viewCommandRequest, fitReferenceRequest, referencePlan, referenceAssetBlob, tracingMode, recognitionDraft, selectedRecognitionCandidateId, recognitionReviewActive, onSelectRecognitionCandidate, onEditRecognitionWall, onReferenceMoveEnd, onContextMenuRequest }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const panRef = useRef<{ active: boolean; last: Point2 }>({ active: false, last: { x: 0, y: 0 } });
  const structuralPointerGestureRef = useRef<StructuralPointerGesture | null>(null);
  const wallPointerWorldRef = useRef<Point2 | null>(null);
  const handledViewCommandSerialRef = useRef(viewCommandRequest?.serial ?? 0);
  const handledFitReferenceRequestRef = useRef(fitReferenceRequest);
  const viewportRef = useRef<ViewportTransform>({ ...initialViewport });
  const suppressGeometryClickRef = useRef(false);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [panActive, setPanActive] = useState(false);
  const [openingPreview, setOpeningPreview] = useState<OpeningPreview | null>(null);
  const [placementPreview, setPlacementPreview] = useState<PlacedObject | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<HoveredCanvasEntity>(null);
  const [objectGuides, setObjectGuides] = useState<readonly ObjectSnapGuide[]>([]);
  const [marqueeGesture, setMarqueeGesture] = useState<MarqueeGesture | null>(null);
  const [activeStructuralSnap, setActiveStructuralSnap] = useState<StructuralSnapResult | null>(null);
  const [wallInput, setWallInput] = useState<WallInputState>(EMPTY_WALL_INPUT);
  const [viewport, setViewport] = useState<ViewportTransform>(() => ({ ...initialViewport }));
  const setHoveredCanvasEntity = useCallback((next: HoveredCanvasEntity) => {
    setHoveredEntity(next);
  }, []);
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
  const structuralGesture = useStore(editorStore, (state) => state.structuralGesture);
  const selection = useStore(editorStore, (state) => state.selection);
  const snappingEnabled = useStore(structuralSnappingSettingsStore, (state) => state.enabled);
  const structuralDisplayDocument = structuralGesture?.previewDocument ?? document;
  const selectedWallId = selectedWallIdFromSelection(selection);
  const selectedRoomId = selectedRoomIdFromSelection(selection);
  const selectedRoomRootId = useMemo(() => {
    const roomRefs = selection.refs.filter((ref) => ref.kind === "room");
    return roomRefs.length === 1 ? roomRefs[0]!.id : null;
  }, [selection]);
  const selectedOpeningId = selectedOpeningIdFromSelection(selection);
  const selectedObjectId = selectedObjectIdFromSelection(selection);
  const selectedObjectIds = useMemo(
    () => new Set(selection.refs.filter((ref) => ref.kind === "placed-object").map((ref) => ref.id)),
    [selection],
  );
  const selectedEntityKeys = useMemo(
    () => new Set(selection.refs.map((ref) => entityKey(ref.kind, ref.id))),
    [selection],
  );
  const isEntitySelected = useCallback(
    (kind: EditorEntityRef["kind"], id: string) => selectedEntityKeys.has(entityKey(kind, id)),
    [selectedEntityKeys],
  );
  const placementPresetId = useStore(editorStore, (state) => state.placementPresetId);
  const objectGesture = useStore(editorStore, (state) => state.objectGesture);
  const planningPreviewCandidate = useStore(planningUiStore, (state) => state.previewCandidate);
  const activeExactPairKey = useStore(planningUiStore, (state) => state.activeExactPairKey);
  const roomSpanPreview = useStore(geometryInspectorPreviewStore, (state) => state.roomSpan);
  const doorSwingPreview = useStore(geometryInspectorPreviewStore, (state) => state.doorSwing);
  const hoverEnabled = tool === "select" && !placementPresetId && !recognitionReviewActive && !structuralGesture;
  const visibleHoveredEntity = hoverEnabled ? hoveredEntity : null;
  const visibleOpeningPreview = (tool === "door" || tool === "window") && openingPreview?.opening.kind === tool
    ? openingPreview
    : null;
  const visiblePlacementPreview = placementPresetId && placementPreview?.presetId === placementPresetId ? placementPreview : null;
  const visibleObjectGuides = placementPresetId || objectGesture ? objectGuides : [];
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
    if (!viewCommandRequest ||
      viewCommandRequest.serial === handledViewCommandSerialRef.current ||
      size.width <= 1 || size.height <= 1) return;
    handledViewCommandSerialRef.current = viewCommandRequest.serial;
    const limits = { min: MIN_SCALE, max: MAX_SCALE } as const;
    let next: ViewportTransform | null = null;
    switch (viewCommandRequest.command) {
      case "zoom-in":
        next = zoomViewportByCommand(viewportRef.current, size, COMMAND_ZOOM_FACTOR, limits);
        break;
      case "zoom-out":
        next = zoomViewportByCommand(viewportRef.current, size, 1 / COMMAND_ZOOM_FACTOR, limits);
        break;
      case "actual-size":
        next = actualSizeViewport(
          viewportRef.current,
          size,
          DEFAULT_PROJECT_VIEWPORT.pixelsPerMillimeter,
          limits,
        );
        break;
      case "fit-plan":
        next = fitDocumentViewport(
          deriveDocumentBounds(document),
          visibleReferenceBounds,
          size,
          64,
          limits,
        );
        break;
      case "fit-selection":
        next = fitSelectionViewport(
          deriveSelectionWorldBounds(document, selection),
          size,
          64,
          limits,
        );
        break;
    }
    if (next) commitViewport(next);
  }, [commitViewport, document, selection, size, viewCommandRequest, visibleReferenceBounds]);
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
  useEffect(() => {
    if (panActive) return;
    canvasTransientFeedbackStore.getState().setPanState(spacePressed ? "ready" : "idle");
  }, [panActive, spacePressed]);
  useEffect(() => {
    canvasTransientFeedbackStore.getState().setHoveredSelectable(visibleHoveredEntity !== null);
  }, [visibleHoveredEntity]);
  useEffect(() => () => canvasTransientFeedbackStore.getState().reset(), []);
  const objectGesturePreviewById = useMemo(() => {
    const previewById = new Map<string, PlacedObject>();
    if (!objectGesture) return previewById;
    if (objectGesture.kind === "move") {
      for (const object of objectGesture.preview) previewById.set(object.id, object);
      return previewById;
    }
    previewById.set(objectGesture.objectId, objectGesture.preview);
    return previewById;
  }, [objectGesture]);
  const displayedObjects = useMemo(
    () => structuralDisplayDocument.placedObjects.map((object) => objectGesturePreviewById.get(object.id) ?? object),
    [structuralDisplayDocument.placedObjects, objectGesturePreviewById],
  );
  const selectionPreviewDocument = useMemo(() => ({
    ...structuralDisplayDocument,
    placedObjects: displayedObjects,
  }), [displayedObjects, structuralDisplayDocument]);
  const evaluationDocument = useMemo(() => ({
    ...structuralDisplayDocument,
    placedObjects: visiblePlacementPreview ? [...displayedObjects, visiblePlacementPreview] : displayedObjects,
  }), [displayedObjects, structuralDisplayDocument, visiblePlacementPreview]);
  const fitEvaluation = useMemo(() => evaluateObjectFits(evaluationDocument), [evaluationDocument]);
  const placementPreviewFitStatus = visiblePlacementPreview
    ? fitEvaluation.byObjectId.get(PLACEMENT_PREVIEW_ID)?.status ?? "blocked"
    : null;
  const placementPreviewFitLabel = placementPreviewFitStatus
    ? fitStatusPresentation(placementPreviewFitStatus).label
    : null;
  const livePreviewState = structuralGesture
    ? (structuralGesture.valid ? "valid" : "invalid")
    : visibleOpeningPreview
      ? (visibleOpeningPreview.valid ? "valid" : "invalid")
      : visiblePlacementPreview
        ? "valid"
        : "none";
  useEffect(() => {
    canvasTransientFeedbackStore.getState().setPreviewState(livePreviewState);
  }, [livePreviewState]);
  const planningPreviewObjects = useMemo(() => {
    if (!planningPreviewCandidate) return [];
    const placements = new Map(planningPreviewCandidate.placements.map((placement) => [placement.objectId, placement]));
    return displayedObjects.flatMap((object) => {
      const placement = placements.get(object.id);
      return placement ? [{ ...object, position: { ...placement.position }, rotationDeg: placement.rotationDeg }] : [];
    });
  }, [displayedObjects, planningPreviewCandidate]);
  const planningPreviewDocument = useMemo(() => {
    if (!planningPreviewCandidate) return document;
    const placements = new Map(planningPreviewCandidate.placements.map((placement) => [placement.objectId, placement]));
    return {
      ...document,
      placedObjects: document.placedObjects.map((object) => {
        const placement = placements.get(object.id);
        return placement ? { ...object, position: { ...placement.position }, rotationDeg: placement.rotationDeg } : object;
      }),
    };
  }, [document, planningPreviewCandidate]);
  const planningPreviewFit = useMemo(() => evaluateObjectFits(planningPreviewDocument), [planningPreviewDocument]);
  const exactGapAnnotation = useMemo(
    () => deriveExactGapAnnotation(planningPreviewDocument, planningPreviewCandidate, activeExactPairKey),
    [activeExactPairKey, planningPreviewCandidate, planningPreviewDocument],
  );
  const selectedObject = displayedObjects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedClearances = useMemo<DirectionalClearances | null>(() => {
    if (!selectedObject) return null;
    try { return measureObjectClearances(evaluationDocument, selectedObject.id); } catch { return null; }
  }, [evaluationDocument, selectedObject]);
  const vertexMap = useMemo(() => new Map(structuralDisplayDocument.vertices.map((vertex) => [vertex.id, vertex])), [structuralDisplayDocument.vertices]);
  const resolvedWalls = useMemo<ResolvedWall[]>(() => structuralDisplayDocument.walls.flatMap((wall) => {
    const start = vertexMap.get(wall.startVertexId);
    const end = vertexMap.get(wall.endVertexId);
    return start && end ? [{ wall, start: start.position, end: end.position }] : [];
  }), [structuralDisplayDocument.walls, vertexMap]);
  const derivedRooms = useMemo(() => deriveRooms(structuralDisplayDocument), [structuralDisplayDocument]);
  const selectedRoom = derivedRooms.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedResolvedWall = resolvedWalls.find(({ wall }) => wall.id === selectedWallId) ?? null;
  const emphasizedRoomAxis = roomSpanPreview && roomSpanPreview.roomId === selectedRoom?.id
    ? roomSpanPreview.axis
    : null;
  const canvasDimensionAnnotations = useMemo(() => {
    if (selectedRoom) return deriveRectangularRoomDimensionAnnotations(selectedRoom, emphasizedRoomAxis);
    if (selectedResolvedWall) {
      const annotation = deriveWallCentrelineDimensionAnnotation(selectedResolvedWall.start, selectedResolvedWall.end);
      return annotation ? [annotation] : [];
    }
    return [];
  }, [emphasizedRoomAxis, selectedResolvedWall, selectedRoom]);
  const errorDiagnostics = derivedRooms.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const gridStep = chooseGridStep(viewport.pixelsPerMillimeter);
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
  const selectionGroupBounds = useMemo(
    () => selection.refs.length > 1 ? deriveSelectionWorldBounds(selectionPreviewDocument, selection) : null,
    [selection, selectionPreviewDocument],
  );
  const groupSelectionVisual = deriveCanvasEntityVisual("group-selection");
  const draftStartScreen = draftWall ? worldToScreen(draftWall.start, viewport) : null;
  const draftEndScreen = draftWall ? worldToScreen(draftWall.end, viewport) : null;
  const draftLength = draftWall ? Math.hypot(draftWall.end.x - draftWall.start.x, draftWall.end.y - draftWall.start.y) : 0;
  const draftAngle = draftWall && draftLength > GEOMETRY_EPSILON_MM
    ? vectorToCanvasAngleDeg(draftWall.start, draftWall.end)
    : 0;
  const draftTargetScreen = draftWall?.endTarget ? worldToScreen(draftWall.endTarget.point, viewport) : null;
  const displayedWallLengthValue = wallInput.lengthEdited ? wallInput.lengthValue : (draftWall ? formatDynamicNumber(draftLength) : "");
  const displayedWallAngleValue = wallInput.angleEdited ? wallInput.angleValue : (draftWall && draftLength > GEOMETRY_EPSILON_MM ? formatDynamicNumber(draftAngle) : "");
  const parsedWallLength = wallInput.lengthEdited && wallInput.lengthValue.trim() !== ""
    ? parseWallLengthInput(wallInput.lengthValue)
    : null;
  const parsedWallAngle = wallInput.angleEdited && wallInput.angleValue.trim() !== ""
    ? parseWallAngleInput(wallInput.angleValue)
    : null;
  const wallLengthError = wallInput.lengthEdited && wallInput.lengthValue.trim() !== "" && parsedWallLength === null
    ? "Длина стены должна быть больше 0 мм"
    : draftWall && draftLength <= GEOMETRY_EPSILON_MM
      ? "Длина стены должна быть больше 0 мм"
      : null;
  const wallAngleError = wallInput.angleEdited && wallInput.angleValue.trim() !== "" && parsedWallAngle === null
    ? "Введите угол числом"
    : null;
  const dynamicInputPosition = draftEndScreen
    ? clampFloatingInputPosition(
        { x: draftEndScreen.x + 16, y: draftEndScreen.y + 16 },
        WALL_DYNAMIC_PANEL_SIZE,
        size,
      )
    : null;
  const pointerPosition = (event: KonvaEventObject<MouseEvent | TouchEvent | WheelEvent>): Point2 | null => event.target.getStage()?.getPointerPosition() ?? null;
  const selectEntityFromPointer = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
    fallback: EditorEntityRef,
  ) => {
    event.cancelBubble = true;
    if ("button" in event.evt && event.evt.button !== 0) return;
    const pointer = event.target.getStage()?.getPointerPosition() ?? null;
    const ref = pointer ? (() => {
      const world = screenToWorld(pointer, viewport);
      return entitiesIntersectingMarquee(document, {
        minX: world.x,
        minY: world.y,
        maxX: world.x,
        maxY: world.y,
      })[0] ?? fallback;
    })() : fallback;
    const store = editorStore.getState();
    const toggle = event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey;
    if (toggle) store.toggleSelection(ref);
    else store.replaceSelection(ref);
  };
  const onCanvasClick = (event: KonvaEventObject<MouseEvent>) => {
    if (tool !== "select" || placementPresetId || recognitionReviewActive || structuralGesture || event.evt.button !== 0) return;
    if (suppressGeometryClickRef.current) {
      suppressGeometryClickRef.current = false;
      return;
    }
    const pointer = pointerPosition(event);
    if (!pointer) return;
    const world = screenToWorld(pointer, viewport);
    const target = entitiesIntersectingMarquee(document, {
      minX: world.x,
      minY: world.y,
      maxX: world.x,
      maxY: world.y,
    })[0] ?? null;
    if (!target) return;
    const store = editorStore.getState();
    const toggle = event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey;
    if (toggle) store.toggleSelection(target);
    else store.replaceSelection(target);
  };
  const resolveCanvasStructuralSnap = (
    screenPoint: Point2,
    startPoint: Point2 | null,
    event: KonvaEventObject<MouseEvent | TouchEvent>,
    exclusions: Readonly<{
      vertexIds?: ReadonlySet<string>;
      wallIds?: ReadonlySet<string>;
    }> = {},
  ): StructuralSnapResult => {
    const rawPoint = screenToWorld(screenPoint, viewport);
    const acquisitionTolerance = SNAP_TOLERANCE_PX / viewport.pixelsPerMillimeter;
    const releaseTolerance = STRUCTURAL_SNAP_RELEASE_PX / viewport.pixelsPerMillimeter;
    const replacementAdvantage = STRUCTURAL_SNAP_REPLACEMENT_PX / viewport.pixelsPerMillimeter;
    const resolved = resolveStructuralSnap({
      document,
      rawPoint,
      startPoint,
      gridStep,
      acquisitionTolerance,
      releaseTolerance,
      replacementAdvantage,
      activeCandidateId: draftWall || structuralGesture ? activeStructuralSnap?.candidateId ?? null : null,
      snappingEnabled: snappingEnabled && !event.evt.altKey,
      excludeVertexIds: exclusions.vertexIds,
      excludeWallIds: exclusions.wallIds,
    });
    setActiveStructuralSnap(resolved.kind === "none" ? null : resolved);
    return resolved;
  };
  const targetForExactPoint = (point: Point2, snap: StructuralSnapResult | null) => {
    if (!snap?.target) return null;
    return distanceBetween(point, snap.point) <= GEOMETRY_EPSILON_MM ? snap.target : null;
  };
  const applyWallDynamicInput = (next: WallInputState) => {
    setWallInput(next);
    const current = editorStore.getState().draftWall;
    if (!current) return;
    const pointerPoint = wallPointerWorldRef.current ?? current.end;
    const lengthMm = next.lengthEdited && next.lengthValue.trim() !== "" ? parseWallLengthInput(next.lengthValue) : null;
    const angleDeg = next.angleEdited && next.angleValue.trim() !== "" ? parseWallAngleInput(next.angleValue) : null;
    if (next.lengthEdited && next.lengthValue.trim() !== "" && lengthMm === null) return;
    if (next.angleEdited && next.angleValue.trim() !== "" && angleDeg === null) return;
    try {
      const exact = resolveWallDynamicDraft(current.start, pointerPoint, { lengthMm, angleDeg });
      const target = targetForExactPoint(exact.point, activeStructuralSnap);
      editorStore.getState().updateDraftWall(
        { point: exact.point, kind: "none", guides: [] },
        target,
      );
      if (!target && distanceBetween(exact.point, activeStructuralSnap?.point ?? exact.point) > GEOMETRY_EPSILON_MM) {
        setActiveStructuralSnap(null);
      }
    } catch {
      // Invalid numeric state remains local to the input and never mutates the draft/history.
    }
  };
  const updateWallDraftFromPointer = (
    pointer: Point2,
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const current = editorStore.getState().draftWall;
    if (!current) return;
    const resolved = resolveCanvasStructuralSnap(pointer, current.start, event);
    wallPointerWorldRef.current = resolved.point;
    let point = resolved.point;
    if (parsedWallLength !== null || parsedWallAngle !== null) {
      try {
        point = resolveWallDynamicDraft(current.start, resolved.point, {
          lengthMm: parsedWallLength,
          angleDeg: parsedWallAngle,
        }).point;
      } catch {
        return;
      }
    }
    const target = targetForExactPoint(point, resolved);
    if (!target && distanceBetween(point, resolved.point) > GEOMETRY_EPSILON_MM) setActiveStructuralSnap(null);
    editorStore.getState().updateDraftWall(
      { ...draftSnapFromStructural(resolved), point },
      target,
    );
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
    const source = gesture?.kind === "move" && gesture.anchorObjectId === objectId
      ? gesture.preview.find((object) => object.id === objectId)
      : gesture?.kind === "transform" && gesture.objectId === objectId
        ? gesture.preview
        : state.history.document.placedObjects.find((object) => object.id === objectId);
    if (!source) return;
    if (patch.position) {
      const moving = { ...source, position: patch.position };
      const excludedIds = gesture?.kind === "move" && gesture.anchorObjectId === objectId
        ? new Set(gesture.objectIds)
        : new Set([objectId]);
      const snap = snapPlacedObject({
        rawPosition: patch.position,
        moving,
        others: displayedObjects.filter((object) => !excludedIds.has(object.id)),
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
    const action = wheelGestureToViewportAction(event.evt);
    if (action.kind === "pan") {
      event.evt.preventDefault();
      updateViewport((current) => panViewportBy(current, action.delta));
      return;
    }
    const pointer = pointerPosition(event);
    if (!pointer) return;
    event.evt.preventDefault();
    updateViewport((current) => zoomViewportAt(
      current,
      pointer,
      action.factor,
      { min: MIN_SCALE, max: MAX_SCALE },
    ));
  };
  const onCanvasContextMenu = (event: KonvaEventObject<MouseEvent>) => {
    if (tool !== "select" || placementPresetId || recognitionReviewActive || structuralGesture) {
      onContextMenuRequest(null);
      return;
    }
    const pointer = pointerPosition(event);
    if (!pointer) {
      onContextMenuRequest(null);
      return;
    }
    const world = screenToWorld(pointer, viewport);
    const target = entitiesIntersectingMarquee(document, {
      minX: world.x,
      minY: world.y,
      maxX: world.x,
      maxY: world.y,
    })[0] ?? null;
    event.evt.preventDefault();
    event.cancelBubble = true;
    setMarqueeGesture(null);
    onContextMenuRequest({
      position: { x: event.evt.clientX, y: event.evt.clientY },
      target,
    });
  };
  const finalizeMarquee = (endScreen: Point2) => {
    const gesture = marqueeGesture;
    if (!gesture) return;
    setMarqueeGesture(null);
    const distance = Math.hypot(
      endScreen.x - gesture.startScreen.x,
      endScreen.y - gesture.startScreen.y,
    );
    const store = editorStore.getState();
    if (distance < MARQUEE_THRESHOLD_PX) {
      if (!gesture.additive) store.clearSelection();
      return;
    }
    suppressGeometryClickRef.current = true;
    const startWorld = screenToWorld(gesture.startScreen, viewport);
    const endWorld = screenToWorld(endScreen, viewport);
    const worldRect: WorldRect = {
      minX: Math.min(startWorld.x, endWorld.x),
      minY: Math.min(startWorld.y, endWorld.y),
      maxX: Math.max(startWorld.x, endWorld.x),
      maxY: Math.max(startWorld.y, endWorld.y),
    };
    const hits = entitiesIntersectingMarquee(document, worldRect);
    if (gesture.additive) {
      store.addSelection(hits);
      return;
    }
    store.clearSelection();
    store.addSelection(hits);
  };
  const beginStructuralVertexGesture = (
    vertexId: string,
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    if (tool !== "select" || recognitionReviewActive || placementPresetId || structuralPointerGestureRef.current) return;
    if ("button" in event.evt && event.evt.button !== 0) return;
    event.cancelBubble = true;
    event.evt.preventDefault();
    editorStore.getState().beginStructuralVertexGesture(vertexId);
    structuralPointerGestureRef.current = { kind: "move-vertex", vertexId };
    setMarqueeGesture(null);
    setActiveStructuralSnap(null);
  };
  const beginStructuralWallGesture = (
    wallId: string,
    event: KonvaEventObject<MouseEvent>,
  ) => {
    if (tool !== "select" || recognitionReviewActive || placementPresetId || structuralPointerGestureRef.current) return;
    if (event.evt.button !== 0 || selectedWallId !== wallId || spacePressed) return;
    const pointer = pointerPosition(event);
    const wall = document.walls.find((candidate) => candidate.id === wallId);
    if (!pointer || !wall) return;
    const vertices = new Map(document.vertices.map((vertex) => [vertex.id, vertex.position]));
    const anchorStartWorld = vertices.get(wall.startVertexId);
    if (!anchorStartWorld) return;
    event.cancelBubble = true;
    event.evt.preventDefault();
    const movedVertexIds = new Set([wall.startVertexId, wall.endVertexId, ...wall.junctionVertexIds]);
    editorStore.getState().beginStructuralWallGesture(wallId);
    structuralPointerGestureRef.current = {
      kind: "translate-wall",
      wallId,
      pointerStartWorld: screenToWorld(pointer, viewport),
      anchorStartWorld,
      movedVertexIds,
    };
    setMarqueeGesture(null);
    setActiveStructuralSnap(null);
  };
  const beginStructuralRoomGesture = (
    pointer: Point2,
    event: KonvaEventObject<MouseEvent>,
  ): boolean => {
    if (tool !== "select" || recognitionReviewActive || placementPresetId || structuralPointerGestureRef.current || spacePressed) return false;
    if (event.evt.button !== 0 || !selectedRoomRootId) return false;
    if (event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey) return false;

    const stage = event.target.getStage();
    const hitNode = stage?.getIntersection(pointer) ?? event.target;
    const hitEntity = canvasEntityFromKonvaNode(hitNode);
    const directEntity = hitEntity?.kind === "room" ? null : hitEntity;
    if (directEntity) return false;

    const pointerWorld = screenToWorld(pointer, viewport);
    const roomId = entitiesAtPoint(document, pointerWorld)
      .find((ref) => ref.kind === "room" && ref.id === selectedRoomRootId)?.id ?? null;
    if (!roomId) return false;

    editorStore.getState().beginStructuralRoomGesture(roomId);
    const roomGesture = editorStore.getState().structuralGesture;
    if (roomGesture?.kind !== "translate-room") return false;

    event.cancelBubble = true;
    event.evt.preventDefault();
    suppressGeometryClickRef.current = true;
    structuralPointerGestureRef.current = {
      kind: "translate-room",
      roomId,
      pointerStartWorld: pointerWorld,
      anchorStartWorld: pointerWorld,
      movedVertexIds: new Set(roomGesture.movedVertexIds),
      movedWallIds: new Set(roomGesture.movedWallIds),
    };
    setMarqueeGesture(null);
    setActiveStructuralSnap(null);
    return true;
  };
  const previewStructuralPointerGesture = (
    pointer: Point2,
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ): boolean => {
    const pointerGesture = structuralPointerGestureRef.current;
    if (!pointerGesture) return false;
    if (pointerGesture.kind === "move-vertex") {
      const resolved = resolveCanvasStructuralSnap(
        pointer,
        null,
        event,
        { vertexIds: new Set([pointerGesture.vertexId]) },
      );
      editorStore.getState().previewStructuralVertexGesture(resolved.point);
      return true;
    }
    const pointerWorld = screenToWorld(pointer, viewport);
    const rawAnchor = {
      x: pointerGesture.anchorStartWorld.x + pointerWorld.x - pointerGesture.pointerStartWorld.x,
      y: pointerGesture.anchorStartWorld.y + pointerWorld.y - pointerGesture.pointerStartWorld.y,
    };
    const rawAnchorScreen = worldToScreen(rawAnchor, viewport);
    if (pointerGesture.kind === "translate-room") {
      const resolved = resolveCanvasStructuralSnap(
        rawAnchorScreen,
        pointerGesture.anchorStartWorld,
        event,
        {
          vertexIds: pointerGesture.movedVertexIds,
          wallIds: pointerGesture.movedWallIds,
        },
      );
      editorStore.getState().previewStructuralRoomGesture({
        x: resolved.point.x - pointerGesture.anchorStartWorld.x,
        y: resolved.point.y - pointerGesture.anchorStartWorld.y,
      });
      return true;
    }
    const resolved = resolveCanvasStructuralSnap(
      rawAnchorScreen,
      pointerGesture.anchorStartWorld,
      event,
      {
        vertexIds: pointerGesture.movedVertexIds,
        wallIds: new Set([pointerGesture.wallId]),
      },
    );
    editorStore.getState().previewStructuralWallGesture({
      x: resolved.point.x - pointerGesture.anchorStartWorld.x,
      y: resolved.point.y - pointerGesture.anchorStartWorld.y,
    });
    return true;
  };
  const finishStructuralPointerGesture = () => {
    if (!structuralPointerGestureRef.current) return false;
    const store = editorStore.getState();
    if (store.structuralGesture?.valid) store.commitStructuralGesture();
    else store.cancelStructuralGesture();
    structuralPointerGestureRef.current = null;
    setActiveStructuralSnap(null);
    return true;
  };
  const cancelStructuralPointerGesture = () => {
    if (!structuralPointerGestureRef.current && !editorStore.getState().structuralGesture) return;
    structuralPointerGestureRef.current = null;
    editorStore.getState().cancelStructuralGesture();
    setActiveStructuralSnap(null);
  };
  const commitWallDraft = () => {
    if (!editorStore.getState().draftWall || wallLengthError || wallAngleError) return;
    editorStore.getState().commitDraftWall();
    setWallInput(EMPTY_WALL_INPUT);
    wallPointerWorldRef.current = null;
    setActiveStructuralSnap(null);
  };
  const onMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    const pointer = pointerPosition(event); if (!pointer) return;
    const shouldPan = event.evt.button === 1 || (event.evt.button === 0 && spacePressed);
    if (shouldPan) {
      event.evt.preventDefault();
      panRef.current = { active: true, last: pointer };
      setPanActive(true);
      canvasTransientFeedbackStore.getState().setPanState("active");
      return;
    }
    if (event.evt.button !== 0) return;
    suppressGeometryClickRef.current = false;
    if (recognitionReviewActive) { onSelectRecognitionCandidate(null); return; }
    if (structuralPointerGestureRef.current) return;
    if (placementPresetId && visiblePlacementPreview) {
      editorStore.getState().placeSelectedPreset(visiblePlacementPreview.position);
      setPlacementPreview(null);
      setObjectGuides([]);
      return;
    }
    if (tool === "wall") {
      const resolved = resolveCanvasStructuralSnap(pointer, draftWall?.start ?? null, event);
      if (!draftWall) {
        editorStore.getState().beginWall(resolved.point, resolved.target);
        wallPointerWorldRef.current = resolved.point;
        setWallInput(EMPTY_WALL_INPUT);
      } else {
        updateWallDraftFromPointer(pointer, event);
        commitWallDraft();
      }
      return;
    }
    if ((tool === "door" || tool === "window") && visibleOpeningPreview?.valid) {
      editorStore.getState().addOpeningAt(visibleOpeningPreview.wallId, visibleOpeningPreview.pointerOffset);
      return;
    }
    if (tool === "select" && beginStructuralRoomGesture(pointer, event)) return;
    if (tool === "select") {
      setMarqueeGesture({
        startScreen: pointer,
        currentScreen: pointer,
        additive: event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey,
      });
    }
  };
  const onMouseMove = (event: KonvaEventObject<MouseEvent>) => {
    const pointer = pointerPosition(event); if (!pointer) return;
    onPointerWorldChange(screenToWorld(pointer, viewport));
    if (panRef.current.active) {
      const dx = pointer.x - panRef.current.last.x, dy = pointer.y - panRef.current.last.y;
      panRef.current = { active: true, last: pointer };
      updateViewport((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));
      return;
    }
    if (previewStructuralPointerGesture(pointer, event)) return;
    if (marqueeGesture) {
      setMarqueeGesture({ ...marqueeGesture, currentScreen: pointer });
      return;
    }
    const stage = event.target.getStage();
    const hitNode = stage?.getIntersection(pointer) ?? event.target;
    if (hoverEnabled) {
      const hoveredFromNode = canvasEntityFromKonvaNode(hitNode);
      const pointerWorld = screenToWorld(pointer, viewport);
      const hoveredRoom = hoveredFromNode
        ? null
        : entitiesAtPoint(structuralDisplayDocument, pointerWorld).find((ref) => ref.kind === "room") ?? null;
      setHoveredCanvasEntity(hoveredFromNode ?? hoveredRoom);
    } else {
      setHoveredCanvasEntity(null);
    }
    if (recognitionReviewActive) return;
    if (placementPresetId) updatePlacementPreview(pointer);
    else if (tool === "wall" && draftWall) updateWallDraftFromPointer(pointer, event);
    else if (tool === "door" || tool === "window") updateOpeningPreview(pointer);
  };
  const endPan = () => {
    panRef.current.active = false;
    setPanActive(false);
    canvasTransientFeedbackStore.getState().setPanState(spacePressed ? "ready" : "idle");
  };
  const onMouseUp = (event: KonvaEventObject<MouseEvent>) => {
    if (panRef.current.active) {
      endPan();
      return;
    }
    if (finishStructuralPointerGesture()) return;
    const pointer = pointerPosition(event);
    if (pointer) finalizeMarquee(pointer);
  };
  const onTouchMove = (event: KonvaEventObject<TouchEvent>) => {
    const pointer = pointerPosition(event);
    if (pointer) previewStructuralPointerGesture(pointer, event);
  };
  const onTouchEnd = () => {
    finishStructuralPointerGesture();
  };
  const clearTransientCanvasState = () => {
    endPan();
    cancelStructuralPointerGesture();
    setMarqueeGesture(null);
    setHoveredCanvasEntity(null);
    setOpeningPreview(null);
    setPlacementPreview(null);
    setObjectGuides([]);
    canvasTransientFeedbackStore.getState().setPreviewState("none");
  };
  const marqueeScreenRect = marqueeGesture && Math.hypot(
    marqueeGesture.currentScreen.x - marqueeGesture.startScreen.x,
    marqueeGesture.currentScreen.y - marqueeGesture.startScreen.y,
  ) >= MARQUEE_THRESHOLD_PX ? {
      minX: Math.min(marqueeGesture.startScreen.x, marqueeGesture.currentScreen.x),
      minY: Math.min(marqueeGesture.startScreen.y, marqueeGesture.currentScreen.y),
      maxX: Math.max(marqueeGesture.startScreen.x, marqueeGesture.currentScreen.x),
      maxY: Math.max(marqueeGesture.startScreen.y, marqueeGesture.currentScreen.y),
    } : null;
  const renderOpeningSymbol = (opening: Opening, preview = false) => {
    const sourceDocument = preview ? document : structuralDisplayDocument;
    const segment = openingSegment(sourceDocument, opening);
    const start = worldToScreen(segment.start, viewport), end = worldToScreen(segment.end, viewport);
    const selected = isEntitySelected("opening", opening.id);
    const hovered = !preview && visibleHoveredEntity?.kind === "opening" && visibleHoveredEntity.id === opening.id;
    const visual = deriveCanvasEntityVisual(preview
      ? (visibleOpeningPreview?.valid ? "preview-valid" : "preview-invalid")
      : selected
        ? "selected"
        : hovered
          ? "hover"
          : "ordinary");
    const stroke = visualStroke(visual.strokeRole, "#374151");
    const wall = sourceDocument.walls.find((candidate) => candidate.id === opening.wallId)!;
    const gapWidth = Math.max(3, wall.thickness * viewport.pixelsPerMillimeter + 3);
    const enter = () => {
      if (!preview && hoverEnabled) setHoveredCanvasEntity({ kind: "opening", id: opening.id });
    };
    const leave = () => {
      if (!preview && visibleHoveredEntity?.kind === "opening" && visibleHoveredEntity.id === opening.id) setHoveredCanvasEntity(null);
    };
    const elements = [<Line key={`${opening.id}-gap`} points={[start.x, start.y, end.x, end.y]} stroke="#ffffff" strokeWidth={gapWidth} listening={false} />];
    if (opening.kind === "window") {
      const normal = { x: segment.leftNormal.x * wall.thickness * 0.22, y: segment.leftNormal.y * wall.thickness * 0.22 };
      for (const sign of [-1, 1]) {
        const a = worldToScreen({ x: segment.start.x + normal.x * sign, y: segment.start.y + normal.y * sign }, viewport);
        const b = worldToScreen({ x: segment.end.x + normal.x * sign, y: segment.end.y + normal.y * sign }, viewport);
        elements.push(<Line key={`${opening.id}-window-${sign}`} name={!preview ? canvasEntityName("opening", opening.id) : undefined} points={[a.x, a.y, b.x, b.y]} stroke={stroke} strokeWidth={visual.emphasized ? 2 : 1.5} dash={visual.dash ? [...visual.dash] : undefined} listening={!preview} onMouseEnter={enter} onMouseLeave={leave} />);
      }
    } else {
      const effectiveDoorSwing = doorSwingPreview?.openingId === opening.id && opening.id === selectedOpeningId
        ? doorSwingPreview.value
        : opening.doorSwing;
      const hingeAtStart = effectiveDoorSwing?.hinge !== "end";
      const hinge = hingeAtStart ? segment.start : segment.end;
      const closedDirection = hingeAtStart ? segment.tangent : { x: -segment.tangent.x, y: -segment.tangent.y };
      const sideSign = effectiveDoorSwing?.side === "right" ? -1 : 1;
      const openDirection = { x: segment.leftNormal.x * sideSign, y: segment.leftNormal.y * sideSign };
      const openEnd = { x: hinge.x + openDirection.x * opening.width, y: hinge.y + openDirection.y * opening.width };
      const hingeScreen = worldToScreen(hinge, viewport), openScreen = worldToScreen(openEnd, viewport);
      elements.push(<Line key={`${opening.id}-leaf`} name={!preview ? canvasEntityName("opening", opening.id) : undefined} points={[hingeScreen.x, hingeScreen.y, openScreen.x, openScreen.y]} stroke={stroke} strokeWidth={visual.emphasized ? 2.5 : 2} dash={visual.dash ? [...visual.dash] : undefined} hitStrokeWidth={12} listening={!preview} onMouseEnter={enter} onMouseLeave={leave} />);
      const arc = arcPoints(hinge, closedDirection, openDirection, opening.width).flatMap((point) => { const s = worldToScreen(point, viewport); return [s.x, s.y]; });
      elements.push(<Line key={`${opening.id}-arc`} points={arc} stroke={stroke} strokeWidth={1} dash={preview ? [7, 5] : [4, 3]} opacity={0.75} listening={false} />);
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
  const helpText = structuralGesture
    ? (structuralGesture.valid ? "Отпустите, чтобы применить изменение" : structuralGesture.reason ?? "Изменение недопустимо")
    : placementPresetId
      ? "Выберите место для предмета"
      : tool === "door" || tool === "window"
        ? "Наведите на стену и кликните"
        : "Синие узлы — соединения";
  const cursorClass = panActive
    ? " is-pan-active"
    : spacePressed
      ? " is-pan-ready"
      : structuralGesture && !structuralGesture.valid
        ? " is-preview-invalid"
        : structuralGesture
          ? " is-pan-active"
          : visibleHoveredEntity
            ? " is-hovering-selectable"
            : livePreviewState === "invalid"
              ? " is-preview-invalid"
              : livePreviewState === "valid"
                ? " is-preview-valid"
                : "";
  return (
    <div ref={containerRef} className={`canvas-shell tool-${tool}${placementPresetId ? " is-placing-object" : ""}${cursorClass}`} data-preview-state={livePreviewState}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={onWheel}
        onClick={onCanvasClick}
        onContextMenu={onCanvasContextMenu}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={clearTransientCanvasState}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelStructuralPointerGesture}
      >
        <Layer listening={false}>{gridLines.map((line) => <Line key={line.key} points={line.points} stroke={line.major ? "#d9dde3" : "#eceff3"} strokeWidth={1} perfectDrawEnabled={false} />)}</Layer>
        {referencePlan && referenceImage ? <Layer><ReferenceLayer referencePlan={referencePlan} image={referenceImage} viewport={viewport} onMoveEnd={onReferenceMoveEnd} /></Layer> : null}
        <Layer>
          {derivedRooms.rooms.map((room) => {
            const selected = isEntitySelected("room", room.id);
            const hovered = visibleHoveredEntity?.kind === "room" && visibleHoveredEntity.id === room.id;
            const visual = deriveCanvasEntityVisual(selected ? "selected" : hovered ? "hover" : "ordinary");
            return <Line
              key={room.id}
              name={canvasEntityName("room", room.id)}
              points={screenPolygon(room.polygon, viewport)}
              closed
              fill={selected ? "#dbeafe" : hovered ? "#eef4ff" : "#f4f7fb"}
              stroke={visual.strokeRole === "ordinary" ? undefined : visualStroke(visual.strokeRole, "#93c5fd")}
              strokeWidth={selected ? 1.8 : hovered ? 1.4 : 0}
              dash={visual.dash ? [...visual.dash] : undefined}
              opacity={tracingMode ? (selected ? 0.42 : hovered ? 0.3 : 0.2) : (selected ? 0.9 : hovered ? 0.82 : 0.72)}
              onMouseEnter={() => { if (hoverEnabled) setHoveredCanvasEntity({ kind: "room", id: room.id }); }}
              onMouseLeave={() => { if (visibleHoveredEntity?.kind === "room" && visibleHoveredEntity.id === room.id) setHoveredCanvasEntity(null); }}
            />;
          })}
          {derivedRooms.rooms.map((room) => {
            const label = worldToScreen(room.labelPoint, viewport);
            const text = formatRoomCanvasLabel(room);
            const lineCount = text.split("\n").length;
            return <Text key={`label-${room.id}`} x={label.x - 100} y={label.y - (lineCount === 3 ? 27 : 18)} width={200} align="center" text={text} fontSize={11} lineHeight={1.35} fill="#4b5563" listening={false} />;
          })}
          {resolvedWalls.flatMap(({ wall }) => deriveVisibleWallIntervals(structuralDisplayDocument, wall.id).map((interval, index) => {
            const a = worldToScreen(pointAtWallOffset(structuralDisplayDocument, wall.id, interval.startOffset), viewport);
            const b = worldToScreen(pointAtWallOffset(structuralDisplayDocument, wall.id, interval.endOffset), viewport);
            const selected = isEntitySelected("wall", wall.id);
            const hovered = visibleHoveredEntity?.kind === "wall" && visibleHoveredEntity.id === wall.id;
            const visual = deriveCanvasEntityVisual(selected ? "selected" : hovered ? "hover" : "ordinary");
            const visualWidth = Math.max(2, wall.thickness * viewport.pixelsPerMillimeter);
            return <Line
              key={`${wall.id}-visible-${index}`}
              name={canvasEntityName("wall", wall.id)}
              points={[a.x, a.y, b.x, b.y]}
              stroke={visualStroke(visual.strokeRole, "#232830")}
              strokeWidth={visualWidth + (selected ? 2 : hovered ? 1 : 0)}
              dash={visual.dash ? [...visual.dash] : undefined}
              hitStrokeWidth={Math.max(14, visualWidth)}
              lineCap="square"
              lineJoin="miter"
              onMouseDown={(event) => beginStructuralWallGesture(wall.id, event)}
              onMouseEnter={() => { if (hoverEnabled) setHoveredCanvasEntity({ kind: "wall", id: wall.id }); }}
              onMouseLeave={() => { if (visibleHoveredEntity?.kind === "wall" && visibleHoveredEntity.id === wall.id) setHoveredCanvasEntity(null); }}
            />;
          }))}
          {structuralDisplayDocument.openings.flatMap((opening) => renderOpeningSymbol(opening))}
          {visibleOpeningPreview ? renderOpeningSymbol(visibleOpeningPreview.opening, true) : null}
          {visibleOpeningPreview ? (() => {
            const segment = openingSegment(document, visibleOpeningPreview.opening);
            const midpoint = worldToScreen({ x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 }, viewport);
            return <Text
              x={midpoint.x - 58}
              y={midpoint.y - 28}
              width={116}
              align="center"
              text={visibleOpeningPreview.valid ? "Предпросмотр" : "Недопустимо"}
              fontSize={12}
              fontStyle="bold"
              fill={visibleOpeningPreview.valid ? "#175cd3" : "#b42318"}
              listening={false}
            />;
          })() : null}
          {tool === "wall" && !recognitionReviewActive ? structuralDisplayDocument.vertices.map((vertex) => { const screen = worldToScreen(vertex.position, viewport); const isJunction = structuralDisplayDocument.walls.some((wall) => wall.junctionVertexIds.includes(vertex.id)); return <Circle key={vertex.id} x={screen.x} y={screen.y} radius={isJunction ? 4.5 : 3.5} fill={isJunction ? "#fff" : "#1769ff"} stroke="#1769ff" strokeWidth={1.5} opacity={0.8} listening={false} />; }) : null}
          {tool === "select" && !recognitionReviewActive && !placementPresetId ? (
            <StructuralHandleLayer
              document={structuralDisplayDocument}
              wallId={selectedWallId}
              viewport={viewport}
              onHandlePointerDown={beginStructuralVertexGesture}
            />
          ) : null}
          {recognitionDraft && referencePlan ? <RecognitionLayer draft={recognitionDraft} referencePlan={referencePlan} viewport={viewport} selectedCandidateId={selectedRecognitionCandidateId} onSelect={onSelectRecognitionCandidate} onEditWall={onEditRecognitionWall} /> : null}
        </Layer>
        <Layer>
          {clearancePolygon ? <Line points={screenPolygon(clearancePolygon, viewport)} closed fill="#f59e0b" opacity={0.08} stroke="#d97706" strokeWidth={1.2} dash={[6, 5]} listening={false} /> : null}
          {displayedObjects.map((object) => {
            const objectSelected = selectedObjectIds.has(object.id) && isEntitySelected("placed-object", object.id);
            return (
              <PlacedObjectShape
                key={object.id}
                object={object}
                viewport={viewport}
                selected={objectSelected}
                transformEnabled={selectedObjectId === object.id}
                hovered={visibleHoveredEntity?.kind === "object" && visibleHoveredEntity.id === object.id}
                fitStatus={fitEvaluation.byObjectId.get(object.id)?.status ?? "blocked"}
                onSelect={(event) => selectEntityFromPointer(event, { kind: "placed-object", id: object.id })}
                onGestureStart={(kind) => editorStore.getState().beginObjectGesture(object.id, kind)}
                onGesturePreview={(patch) => previewObjectGesture(object.id, patch)}
                onGestureCommit={() => { editorStore.getState().commitObjectGesture(); setObjectGuides([]); }}
              />
            );
          })}
          {planningPreviewObjects.map((object) => (
            <PlacedObjectShape
              key={`planning-preview:${object.id}`}
              object={object}
              viewport={viewport}
              selected={false}
              preview
              fitStatus={planningPreviewFit.byObjectId.get(object.id)?.status ?? "blocked"}
            />
          ))}
          {exactGapAnnotation ? (
            <ExactGapOverlay annotation={exactGapAnnotation} viewport={viewport} stageSize={size} />
          ) : null}
          {visiblePlacementPreview ? (
            <PlacedObjectShape
              object={visiblePlacementPreview}
              viewport={viewport}
              selected={false}
              preview
              fitStatus={placementPreviewFitStatus ?? "blocked"}
            />
          ) : null}
          <TapeMeasurementTool width={size.width} height={size.height} viewport={viewport} gridStep={gridStep} />
        </Layer>
        <Layer listening={false}>
          <DimensionOverlay annotations={canvasDimensionAnnotations} viewport={viewport} />
          {selectionGroupBounds ? (() => {
            const topLeft = worldToScreen({ x: selectionGroupBounds.minX, y: selectionGroupBounds.minY }, viewport);
            const bottomRight = worldToScreen({ x: selectionGroupBounds.maxX, y: selectionGroupBounds.maxY }, viewport);
            return <Line
              name="selection-group-bounds"
              points={[
                topLeft.x, topLeft.y,
                bottomRight.x, topLeft.y,
                bottomRight.x, bottomRight.y,
                topLeft.x, bottomRight.y,
              ]}
              closed
              stroke={visualStroke(groupSelectionVisual.strokeRole, "#1769ff")}
              strokeWidth={1.5}
              dash={groupSelectionVisual.dash ? [...groupSelectionVisual.dash] : undefined}
              listening={false}
            />;
          })() : null}
          {marqueeScreenRect ? <Line
            name="selection-marquee"
            points={[
              marqueeScreenRect.minX, marqueeScreenRect.minY,
              marqueeScreenRect.maxX, marqueeScreenRect.minY,
              marqueeScreenRect.maxX, marqueeScreenRect.maxY,
              marqueeScreenRect.minX, marqueeScreenRect.maxY,
            ]}
            closed
            fill="#1769ff"
            opacity={0.08}
            stroke="#1769ff"
            strokeWidth={1.25}
            dash={[5, 4]}
            listening={false}
          /> : null}
          {visibleObjectGuides.map((guide, index) => guide.axis === "x"
            ? <Line key={`object-guide-x-${index}`} points={[worldToScreen({ x: guide.value, y: 0 }, viewport).x, 0, worldToScreen({ x: guide.value, y: 0 }, viewport).x, size.height]} stroke="#0ea5e9" strokeWidth={1} dash={[5, 5]} opacity={0.72} />
            : <Line key={`object-guide-y-${index}`} points={[0, worldToScreen({ x: 0, y: guide.value }, viewport).y, size.width, worldToScreen({ x: 0, y: guide.value }, viewport).y]} stroke="#0ea5e9" strokeWidth={1} dash={[5, 5]} opacity={0.72} />)}
          <StructuralSnapOverlay snap={draftWall || structuralGesture ? activeStructuralSnap : null} viewport={viewport} size={size} />
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
      {draftWall && dynamicInputPosition ? (
        <WallDynamicInput
          position={dynamicInputPosition}
          lengthValue={displayedWallLengthValue}
          angleValue={displayedWallAngleValue}
          lengthError={wallLengthError}
          angleError={wallAngleError}
          onLengthChange={(value) => applyWallDynamicInput({ ...wallInput, lengthValue: value, lengthEdited: true })}
          onAngleChange={(value) => applyWallDynamicInput({ ...wallInput, angleValue: value, angleEdited: true })}
          onCommit={commitWallDraft}
          onCancelNumericEditing={() => applyWallDynamicInput(EMPTY_WALL_INPUT)}
        />
      ) : null}
      {visiblePlacementPreview && placementPreviewFitLabel ? (
        <div
          className="placement-fit-label"
          data-fit-status={placementPreviewFitStatus}
          role="status"
          aria-live="polite"
        >
          {placementPreviewFitLabel}
        </div>
      ) : null}
      {selectedObject ? (
        <div className="object-canvas-legend" aria-label="Обозначения выбранного предмета">
          <span><i className="object-canvas-legend-swatch is-dimension" aria-hidden="true" />Размер предмета</span>
          <span><i className="object-canvas-legend-swatch is-recommended" aria-hidden="true" />Рекомендуемая зона использования</span>
          <span><i className="object-canvas-legend-swatch is-actual" aria-hidden="true" />Свободно сейчас</span>
        </div>
      ) : null}
      {structuralGesture && !structuralGesture.valid ? <div className="topology-alert" role="status">Изменение недопустимо: {structuralGesture.reason ?? "проверьте геометрию"}</div> : errorDiagnostics.length > 0 ? <div className="topology-alert" role="status">Проверьте геометрию: {errorDiagnostics[0]?.message}</div> : null}
      <div className="canvas-help"><span>{Math.round(gridStep)} мм сетка</span><span>Колесо/трекпад — панорама</span><span>Ctrl/Cmd + колесо — масштаб</span><span>{helpText}</span><span>Space + drag / средняя кнопка — панорама</span></div>
    </div>
  );
}
