import {
  fitViewportToBounds,
  zoomViewportAt,
  type Point2,
  type ViewportSize,
  type ViewportTransform,
  type WorldBounds,
  type ZoomLimits,
} from "@vlezet/geometry";

export type EditorViewportCommand =
  | "zoom-in"
  | "zoom-out"
  | "actual-size"
  | "fit-plan"
  | "fit-selection";

export type EditorViewportCommandRequest = Readonly<{
  serial: number;
  command: EditorViewportCommand;
}>;

export type WheelViewportAction =
  | Readonly<{ kind: "pan"; delta: Point2 }>
  | Readonly<{ kind: "zoom"; deltaY: number; factor: number }>;

const WHEEL_LINE_HEIGHT_PX = 40;
const WHEEL_PAGE_HEIGHT_PX = 800;
const MAX_ZOOM_DELTA_PX = 10;
const ZOOM_EXPONENT_PER_PIXEL = 0.01;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
}

function validateLimits(limits: ZoomLimits): void {
  assertFinite(limits.min, "Minimum zoom");
  assertFinite(limits.max, "Maximum zoom");
  if (limits.min <= 0 || limits.max < limits.min) {
    throw new RangeError("Zoom limits are invalid");
  }
}

function normalizedViewportSize(size: ViewportSize): ViewportSize {
  assertFinite(size.width, "Viewport width");
  assertFinite(size.height, "Viewport height");
  return {
    width: Math.max(1, size.width),
    height: Math.max(1, size.height),
  };
}

function unionWorldBounds(first: WorldBounds, second: WorldBounds): WorldBounds {
  return {
    minX: Math.min(first.minX, second.minX),
    minY: Math.min(first.minY, second.minY),
    maxX: Math.max(first.maxX, second.maxX),
    maxY: Math.max(first.maxY, second.maxY),
  };
}

function wheelDeltaToPixels(delta: number, deltaMode: number): number {
  if (deltaMode === 1) return delta * WHEEL_LINE_HEIGHT_PX;
  if (deltaMode === 2) return delta * WHEEL_PAGE_HEIGHT_PX;
  return delta;
}

function modifiedWheelZoomFactor(deltaY: number, deltaMode: number): number {
  const pixelDelta = wheelDeltaToPixels(deltaY, deltaMode);
  const boundedDelta = Math.max(-MAX_ZOOM_DELTA_PX, Math.min(MAX_ZOOM_DELTA_PX, pixelDelta));
  return Math.exp(-boundedDelta * ZOOM_EXPONENT_PER_PIXEL);
}

export function panViewportBy(
  viewport: ViewportTransform,
  delta: Readonly<{ x: number; y: number }>,
): ViewportTransform {
  assertFinite(delta.x, "Pan X");
  assertFinite(delta.y, "Pan Y");
  return {
    ...viewport,
    offsetX: viewport.offsetX + delta.x,
    offsetY: viewport.offsetY + delta.y,
  };
}

export function zoomViewportByCommand(
  viewport: ViewportTransform,
  viewportSize: ViewportSize,
  factor: number,
  limits: ZoomLimits,
): ViewportTransform {
  assertFinite(factor, "Zoom factor");
  if (factor <= 0) throw new RangeError("Zoom factor must be positive");
  validateLimits(limits);
  const size = normalizedViewportSize(viewportSize);
  return zoomViewportAt(
    viewport,
    { x: size.width / 2, y: size.height / 2 },
    factor,
    limits,
  );
}

export function fitWorldBounds(
  bounds: WorldBounds,
  viewportSize: ViewportSize,
  paddingPx: number,
  limits: ZoomLimits,
): ViewportTransform {
  validateLimits(limits);
  assertFinite(paddingPx, "Viewport padding");
  const size = normalizedViewportSize(viewportSize);
  const fitted = fitViewportToBounds(bounds, size, paddingPx);
  const pixelsPerMillimeter = Math.min(
    limits.max,
    Math.max(limits.min, fitted.pixelsPerMillimeter),
  );
  if (pixelsPerMillimeter === fitted.pixelsPerMillimeter) return fitted;

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    pixelsPerMillimeter,
    offsetX: size.width / 2 - centerX * pixelsPerMillimeter,
    offsetY: size.height / 2 - centerY * pixelsPerMillimeter,
  };
}

export function fitDocumentViewport(
  documentBounds: WorldBounds | null,
  referenceBounds: WorldBounds | null,
  viewportSize: ViewportSize,
  paddingPx: number,
  limits: ZoomLimits,
): ViewportTransform | null {
  if (!documentBounds && !referenceBounds) return null;
  const bounds = documentBounds && referenceBounds
    ? unionWorldBounds(documentBounds, referenceBounds)
    : documentBounds ?? referenceBounds;
  if (!bounds) return null;
  return fitWorldBounds(bounds, viewportSize, paddingPx, limits);
}

export function fitSelectionViewport(
  selectionBounds: WorldBounds | null,
  viewportSize: ViewportSize,
  paddingPx: number,
  limits: ZoomLimits,
): ViewportTransform | null {
  if (!selectionBounds) return null;
  return fitWorldBounds(selectionBounds, viewportSize, paddingPx, limits);
}

export function actualSizeViewport(
  viewport: ViewportTransform,
  viewportSize: ViewportSize,
  baselinePixelsPerMillimeter: number,
  limits: ZoomLimits,
): ViewportTransform {
  assertFinite(viewport.pixelsPerMillimeter, "Current zoom");
  if (viewport.pixelsPerMillimeter <= 0) throw new RangeError("Current zoom must be positive");
  assertFinite(baselinePixelsPerMillimeter, "Baseline zoom");
  if (baselinePixelsPerMillimeter <= 0) throw new RangeError("Baseline zoom must be positive");
  validateLimits(limits);

  const target = Math.min(limits.max, Math.max(limits.min, baselinePixelsPerMillimeter));
  return zoomViewportByCommand(
    viewport,
    viewportSize,
    target / viewport.pixelsPerMillimeter,
    limits,
  );
}

export function wheelGestureToViewportAction(event: Readonly<{
  deltaX: number;
  deltaY: number;
  deltaMode?: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}>): WheelViewportAction {
  assertFinite(event.deltaX, "Wheel deltaX");
  assertFinite(event.deltaY, "Wheel deltaY");
  const deltaMode = event.deltaMode ?? 0;
  assertFinite(deltaMode, "Wheel deltaMode");

  if (event.ctrlKey || event.metaKey) {
    return {
      kind: "zoom",
      deltaY: event.deltaY,
      factor: modifiedWheelZoomFactor(event.deltaY, deltaMode),
    };
  }

  const verticalOnlyShift = event.shiftKey && Math.abs(event.deltaX) <= 1e-9;
  if (verticalOnlyShift) {
    return { kind: "pan", delta: { x: -event.deltaY, y: 0 } };
  }

  return {
    kind: "pan",
    delta: { x: -event.deltaX, y: -event.deltaY },
  };
}
