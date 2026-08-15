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
  onKeyDown: (event: CalibrationStageKeyDownEventLike) => void;
  onKeyUp: (event: CalibrationStageKeyUpEventLike) => void;
  onSnapChange: (event: CalibrationStageSnapChangeEventLike) => void;
}>;

function localPoint(
  element: CalibrationStageElementLike,
  clientPoint: Point2,
): Point2 {
  const rect = element.getBoundingClientRect();
  return { x: clientPoint.x - rect.left, y: clientPoint.y - rect.top };
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
  const setViewportFit = () => {
    const element = input.stage();
    if (!element) return;
    input.setState((state) => ({ ...state, viewport: fitViewport(element, input.sourceImage) }));
  };

  const resolvePoint = (
    rawPoint: Point2,
    handle: CalibrationHandle,
    suppressed: boolean,
  ) => {
    const features = input.state.snapEnabled && !suppressed ? input.readFeatures(rawPoint) : [];
    return resolveCalibrationSnap({
      rawPoint,
      features,
      viewportScale: input.state.viewport?.scale ?? 1,
      acquisitionRadiusPx: SNAP_ACQUISITION_RADIUS_PX,
      releaseRadiusPx: SNAP_RELEASE_RADIUS_PX,
      distanceEquivalencePx: SNAP_DISTANCE_EQUIVALENCE_PX,
      minimumStrength: SNAP_MINIMUM_STRENGTH,
      activeCandidateId: input.state.activeHandle === handle ? input.state.activeCandidateId : null,
      snappingEnabled: input.state.snapEnabled,
      suppressed,
    });
  };

  const updateHandle = (
    handle: CalibrationHandle,
    rawPoint: Point2,
    suppressed: boolean,
  ) => {
    const resolved = resolvePoint(rawPoint, handle, suppressed);
    input.onChange(handle === "a" ? { pointA: resolved.point } : { pointB: resolved.point });
    input.setState((state) => ({
      ...state,
      activeHandle: handle,
      activeCandidateId: resolved.candidateId,
      hoverPoint: resolved.point,
    }));
    return resolved;
  };

  const finishPointerGesture = (event: CalibrationStagePointerEventLike) => {
    const element = event.currentTarget;
    input.setState((state) => ({
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
      const viewport = input.state.viewport;
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
      input.setState((state) => ({ ...state, viewport: next }));
    },
    onPointerDown(event) {
      const element = event.currentTarget;
      const viewport = input.state.viewport;
      element.focus();
      if (!viewport) return;

      if (event.button === 1 || input.state.spacePressed) {
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        input.setState((state) => ({
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
        pointA: input.draft.pointA,
        pointB: input.draft.pointB,
        viewportScale: viewport.scale,
        handleTolerancePx: HANDLE_TOLERANCE_PX,
      });
      const resolved = updateHandle(placement.handle, rawPoint, event.altKey);
      element.setPointerCapture(event.pointerId);
      input.setState((state) => ({
        ...state,
        activeHandle: placement.handle,
        draggingHandle: placement.handle,
        activeCandidateId: resolved.candidateId,
        hoverPoint: resolved.point,
      }));
    },
    onPointerMove(event) {
      const viewport = input.state.viewport;
      if (!viewport) return;
      const panning = input.state.panning;
      if (panning?.pointerId === event.pointerId) {
        event.preventDefault();
        const delta = {
          x: event.clientX - panning.lastClient.x,
          y: event.clientY - panning.lastClient.y,
        };
        const next = panCalibrationViewport(viewport, delta);
        input.setState((state) => ({
          ...state,
          viewport: next,
          panning: { pointerId: event.pointerId, lastClient: { x: event.clientX, y: event.clientY } },
        }));
        return;
      }

      const rawPoint = imagePointForPointer(event, viewport, input.sourceImage);
      if (input.state.draggingHandle === null) {
        input.setState((state) => ({ ...state, hoverPoint: rawPoint }));
        return;
      }

      event.preventDefault();
      updateHandle(input.state.draggingHandle, rawPoint, event.altKey);
    },
    onPointerUp: finishPointerGesture,
    onPointerCancel: finishPointerGesture,
    onPointerLeave() {
      if (input.state.draggingHandle !== null || input.state.panning !== null) return;
      input.setState((state) => ({ ...state, hoverPoint: null }));
    },
    onKeyDown(event) {
      if (event.key === " ") {
        event.preventDefault();
        if (!event.repeat) input.setState((state) => ({ ...state, spacePressed: true }));
        return;
      }
      const placement = resolveCalibrationNudge({
        key: event.key,
        shiftKey: event.shiftKey,
        activeHandle: input.state.activeHandle,
        pointA: input.draft.pointA,
        pointB: input.draft.pointB,
        naturalSize: { width: input.sourceImage.naturalWidth, height: input.sourceImage.naturalHeight },
      });
      if (!placement) return;
      event.preventDefault();
      input.onChange(placement.handle === "a" ? { pointA: placement.point } : { pointB: placement.point });
      input.setState((state) => ({ ...state, activeCandidateId: null, hoverPoint: placement.point }));
    },
    onKeyUp(event) {
      if (event.key !== " ") return;
      event.preventDefault();
      input.setState((state) => ({ ...state, spacePressed: false }));
    },
    onSnapChange(event) {
      input.setState((state) => ({
        ...state,
        snapEnabled: event.currentTarget.checked,
        activeCandidateId: null,
      }));
    },
  };
}
