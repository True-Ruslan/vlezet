import type { Point2 } from "@vlezet/geometry";
import {
  resolveCalibrationNudge,
  resolveCalibrationPlacement,
  resolveCalibrationWheelGesture,
  type CalibrationHandle,
} from "./calibration-stage-model";
import {
  resolveCalibrationSnap,
  type CalibrationSourceFeature,
} from "./calibration-snap";
import {
  fitCalibrationViewport,
  nudgeCalibrationImagePoint,
  panCalibrationViewport,
  viewportPointToImagePoint,
  type CalibrationViewportTransform,
} from "./calibration-viewport";

const FIT_PADDING_PX = 16;
const HANDLE_TOLERANCE_PX = 14;
const SNAP_ACQUISITION_RADIUS_PX = 14;
const SNAP_RELEASE_RADIUS_PX = 22;
const SNAP_DISTANCE_EQUIVALENCE_PX = 1.5;
const SNAP_MINIMUM_STRENGTH = 0.6;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 16;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

export type CalibrationStagePanState = Readonly<{
  pointerId: number;
  lastClient: Point2;
}>;

export type CalibrationStageSnapshot = Readonly<{
  viewport: CalibrationViewportTransform | null;
  activeHandle: CalibrationHandle | null;
  draggingHandle: CalibrationHandle | null;
  activeCandidateId: string | null;
  hoverPoint: Point2 | null;
  snapEnabled: boolean;
  panning: CalibrationStagePanState | null;
  spacePressed: boolean;
}>;

export const INITIAL_CALIBRATION_STAGE_STATE: CalibrationStageSnapshot = Object.freeze({
  viewport: null,
  activeHandle: null,
  draggingHandle: null,
  activeCandidateId: null,
  hoverPoint: null,
  snapEnabled: true,
  panning: null,
  spacePressed: false,
});

export type CalibrationStageElementLike = Readonly<{
  clientWidth: number;
  clientHeight: number;
  clientLeft?: number;
  clientTop?: number;
  getBoundingClientRect: () => Readonly<{ left: number; top: number; width: number; height: number }>;
  focus: () => void;
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
  hasPointerCapture: (pointerId: number) => boolean;
}>;

type CalibrationStageStateSetter = (
  update: CalibrationStageSnapshot | ((value: CalibrationStageSnapshot) => CalibrationStageSnapshot),
) => void;

type CalibrationStageDraft = Readonly<{
  pointA: Point2 | null;
  pointB: Point2 | null;
}>;

type CalibrationStagePointerEventLike = Readonly<{
  clientX: number;
  clientY: number;
  pointerId: number;
  button: number;
  altKey: boolean;
  currentTarget: CalibrationStageElementLike;
  preventDefault: () => void;
}>;

type CalibrationStageWheelEventLike = Readonly<{
  clientX: number;
  clientY: number;
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
}>;

type CalibrationStageKeyDownEventLike = Readonly<{
  key: string;
  shiftKey: boolean;
  repeat: boolean;
  preventDefault: () => void;
}>;

type CalibrationStageKeyUpEventLike = Readonly<{
  key: string;
  preventDefault: () => void;
}>;

type CalibrationStageSnapChangeEventLike = Readonly<{
  currentTarget: Readonly<{ checked: boolean }>;
}>;

export type CalibrationStageHandlers = Readonly<{
  onImageLoad: () => void;
  onFit: () => void;
  onWheel: (event: CalibrationStageWheelEventLike) => void;
  onPointerDown: (event: CalibrationStagePointerEventLike) => void;
  onPointerMove: (event: CalibrationStagePointerEventLike) => void;
  onPointerUp: (event: CalibrationStagePointerEventLike) => void;
  onPointerCancel: (event: CalibrationStagePointerEventLike) => void;
  onPointerLeave: () => void;
  onHandleFocus: (handle: CalibrationHandle) => void;
  onKeyDown: (event: CalibrationStageKeyDownEventLike) => void;
  onKeyUp: (event: CalibrationStageKeyUpEventLike) => void;
  onSnapChange: (event: CalibrationStageSnapChangeEventLike) => void;
}>;

function localPoint(
  element: CalibrationStageElementLike,
  clientPoint: Point2,
): Point2 {
  const rect = element.getBoundingClientRect();
  return {
    x: clientPoint.x - rect.left - (element.clientLeft ?? 0),
    y: clientPoint.y - rect.top - (element.clientTop ?? 0),
  };
}

function fitViewport(
  element: CalibrationStageElementLike,
  sourceImage: Readonly<{ naturalWidth: number; naturalHeight: number }>,
): CalibrationViewportTransform {
  return fitCalibrationViewport({
    naturalSize: { width: sourceImage.naturalWidth, height: sourceImage.naturalHeight },
    containerSize: { width: element.clientWidth, height: element.clientHeight },
    paddingPx: FIT_PADDING_PX,
  });
}

function clampImagePoint(
  point: Point2,
  sourceImage: Readonly<{ naturalWidth: number; naturalHeight: number }>,
): Point2 {
  return nudgeCalibrationImagePoint({
    point,
    delta: { x: 0, y: 0 },
    naturalSize: { width: sourceImage.naturalWidth, height: sourceImage.naturalHeight },
  });
}

function imagePointForPointer(
  event: Pick<CalibrationStagePointerEventLike, "clientX" | "clientY" | "currentTarget">,
  viewport: CalibrationViewportTransform,
  sourceImage: Readonly<{ naturalWidth: number; naturalHeight: number }>,
): Point2 {
  return clampImagePoint(viewportPointToImagePoint({
    viewportPoint: localPoint(event.currentTarget, { x: event.clientX, y: event.clientY }),
    transform: viewport,
  }), sourceImage);
}

export function createCalibrationStageHandlers(input: Readonly<{
  state: CalibrationStageSnapshot;
  setState: CalibrationStageStateSetter;
  draft: CalibrationStageDraft;
  onChange: (patch: Partial<CalibrationStageDraft>) => void;
  stage: () => CalibrationStageElementLike | null;
  sourceImage: Readonly<{ naturalWidth: number; naturalHeight: number }>;
  readFeatures: (point: Point2) => readonly CalibrationSourceFeature[];
}>): CalibrationStageHandlers {
  let currentState = input.state;
  let currentDraft = input.draft;

  const setCurrentState: CalibrationStageStateSetter = (update) => {
    currentState = typeof update === "function" ? update(currentState) : update;
    input.setState(currentState);
  };

  const changeDraft = (patch: Partial<CalibrationStageDraft>) => {
    currentDraft = { ...currentDraft, ...patch };
    input.onChange(patch);
  };

  const setViewportFit = () => {
    const element = input.stage();
    if (!element) return;
    setCurrentState((state) => ({ ...state, viewport: fitViewport(element, input.sourceImage) }));
  };

  const resolvePoint = (
    rawPoint: Point2,
    handle: CalibrationHandle,
    suppressed: boolean,
  ) => {
    const features = currentState.snapEnabled && !suppressed ? input.readFeatures(rawPoint) : [];
    return resolveCalibrationSnap({
      rawPoint,
      features,
      viewportScale: currentState.viewport?.scale ?? 1,
      acquisitionRadiusPx: SNAP_ACQUISITION_RADIUS_PX,
      releaseRadiusPx: SNAP_RELEASE_RADIUS_PX,
      distanceEquivalencePx: SNAP_DISTANCE_EQUIVALENCE_PX,
      minimumStrength: SNAP_MINIMUM_STRENGTH,
      activeCandidateId: currentState.activeHandle === handle ? currentState.activeCandidateId : null,
      snappingEnabled: currentState.snapEnabled,
      suppressed,
    });
  };

  const updateHandle = (
    handle: CalibrationHandle,
    rawPoint: Point2,
    suppressed: boolean,
  ) => {
    const resolved = resolvePoint(rawPoint, handle, suppressed);
    changeDraft(handle === "a" ? { pointA: resolved.point } : { pointB: resolved.point });
    setCurrentState((state) => ({
      ...state,
      activeHandle: handle,
      activeCandidateId: resolved.candidateId,
      hoverPoint: resolved.point,
    }));
    return resolved;
  };

  const finishPointerGesture = (event: CalibrationStagePointerEventLike) => {
    const element = event.currentTarget;
    setCurrentState((state) => ({
      ...state,
      panning: state.panning?.pointerId === event.pointerId ? null : state.panning,
      draggingHandle: null,
    }));
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };

  return {
    onImageLoad: setViewportFit,
    onFit: setViewportFit,
    onWheel(event) {
      const element = input.stage();
      const viewport = currentState.viewport;
      if (!element || !viewport) return;
      event.preventDefault();
      const point = localPoint(element, { x: event.clientX, y: event.clientY });
      const zoomModifier = event.ctrlKey || event.metaKey;
      const zoomFactor = zoomModifier ? Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY) : 1;
      const next = resolveCalibrationWheelGesture({
        transform: viewport,
        localPoint: point,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        zoomModifier,
        zoomFactor,
        limits: { minScale: MIN_ZOOM, maxScale: MAX_ZOOM },
      });
      setCurrentState((state) => ({ ...state, viewport: next }));
    },
    onPointerDown(event) {
      const element = event.currentTarget;
      const viewport = currentState.viewport;
      element.focus();
      if (!viewport) return;

      if (event.button === 1 || currentState.spacePressed) {
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        setCurrentState((state) => ({
          ...state,
          panning: {
            pointerId: event.pointerId,
            lastClient: { x: event.clientX, y: event.clientY },
          },
        }));
        return;
      }
      if (event.button !== 0) return;

      event.preventDefault();
      const rawPoint = imagePointForPointer(event, viewport, input.sourceImage);
      const placement = resolveCalibrationPlacement({
        point: rawPoint,
        pointA: currentDraft.pointA,
        pointB: currentDraft.pointB,
        viewportScale: viewport.scale,
        handleTolerancePx: HANDLE_TOLERANCE_PX,
      });
      const resolved = updateHandle(placement.handle, rawPoint, event.altKey);
      element.setPointerCapture(event.pointerId);
      setCurrentState((state) => ({
        ...state,
        activeHandle: placement.handle,
        draggingHandle: placement.handle,
        activeCandidateId: resolved.candidateId,
        hoverPoint: resolved.point,
      }));
    },
    onPointerMove(event) {
      const viewport = currentState.viewport;
      if (!viewport) return;
      const panning = currentState.panning;
      if (panning?.pointerId === event.pointerId) {
        event.preventDefault();
        const delta = {
          x: event.clientX - panning.lastClient.x,
          y: event.clientY - panning.lastClient.y,
        };
        const next = panCalibrationViewport(viewport, delta);
        setCurrentState((state) => ({
          ...state,
          viewport: next,
          panning: { pointerId: event.pointerId, lastClient: { x: event.clientX, y: event.clientY } },
        }));
        return;
      }

      const rawPoint = imagePointForPointer(event, viewport, input.sourceImage);
      if (currentState.draggingHandle === null) {
        setCurrentState((state) => ({ ...state, hoverPoint: rawPoint }));
        return;
      }

      event.preventDefault();
      updateHandle(currentState.draggingHandle, rawPoint, event.altKey);
    },
    onPointerUp: finishPointerGesture,
    onPointerCancel: finishPointerGesture,
    onPointerLeave() {
      if (currentState.draggingHandle !== null || currentState.panning !== null) return;
      setCurrentState((state) => ({ ...state, hoverPoint: null }));
    },
    onHandleFocus(handle) {
      const pointByHandle: Readonly<Record<CalibrationHandle, Point2 | null>> = {
        a: currentDraft.pointA,
        b: currentDraft.pointB,
      };
      setCurrentState((state) => ({
        ...state,
        activeHandle: handle,
        activeCandidateId: null,
        hoverPoint: pointByHandle[handle],
      }));
    },
    onKeyDown(event) {
      if (event.key === " ") {
        event.preventDefault();
        if (!event.repeat) setCurrentState((state) => ({ ...state, spacePressed: true }));
        return;
      }
      const placement = resolveCalibrationNudge({
        key: event.key,
        shiftKey: event.shiftKey,
        activeHandle: currentState.activeHandle,
        pointA: currentDraft.pointA,
        pointB: currentDraft.pointB,
        naturalSize: { width: input.sourceImage.naturalWidth, height: input.sourceImage.naturalHeight },
      });
      if (!placement) return;
      event.preventDefault();
      changeDraft(placement.handle === "a" ? { pointA: placement.point } : { pointB: placement.point });
      setCurrentState((state) => ({ ...state, activeCandidateId: null, hoverPoint: placement.point }));
    },
    onKeyUp(event) {
      if (event.key !== " ") return;
      event.preventDefault();
      setCurrentState((state) => ({ ...state, spacePressed: false }));
    },
    onSnapChange(event) {
      setCurrentState((state) => ({
        ...state,
        snapEnabled: event.currentTarget.checked,
        activeCandidateId: null,
      }));
    },
  };
}
