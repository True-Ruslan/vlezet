import { doorSwingPolygon, type FitDocumentLike } from "./fit";
import { expandedOrientedRectangle, orientedRectangleCorners } from "./oriented-rectangle";
import { topologyVertexMap } from "./topology";
import type { Point2 } from "./point";
import type { ViewportTransform } from "./viewport";

export type WorldBounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;
export type ViewportSize = Readonly<{ width: number; height: number }>;
export type DeriveDocumentBoundsOptions = Readonly<{
  includeClearance?: boolean;
  additionalBounds?: WorldBounds | null;
}>;

const DEFAULT_VIEWPORT: ViewportTransform = Object.freeze({ offsetX: 140, offsetY: 140, pixelsPerMillimeter: 0.12 });
const MIN_SCALE = 0.01;
const MAX_SCALE = 2;

function extend(bounds: WorldBounds | null, point: Point2): WorldBounds {
  if (!bounds) return { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y };
  return {
    minX: Math.min(bounds.minX, point.x), minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x), maxY: Math.max(bounds.maxY, point.y),
  };
}

export function unionWorldBounds(first: WorldBounds | null, second: WorldBounds | null): WorldBounds | null {
  if (!first) return second ? { ...second } : null;
  if (!second) return { ...first };
  return {
    minX: Math.min(first.minX, second.minX), minY: Math.min(first.minY, second.minY),
    maxX: Math.max(first.maxX, second.maxX), maxY: Math.max(first.maxY, second.maxY),
  };
}

function wallCorners(start: Point2, end: Point2, thickness: number): readonly Point2[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return [];
  const normal = { x: -dy / length, y: dx / length };
  const half = thickness / 2;
  return [
    { x: start.x + normal.x * half, y: start.y + normal.y * half },
    { x: start.x - normal.x * half, y: start.y - normal.y * half },
    { x: end.x + normal.x * half, y: end.y + normal.y * half },
    { x: end.x - normal.x * half, y: end.y - normal.y * half },
  ];
}

export function deriveDocumentBounds(document: FitDocumentLike, options: DeriveDocumentBoundsOptions = {}): WorldBounds | null {
  let bounds: WorldBounds | null = null;
  const vertices = topologyVertexMap(document);
  for (const wall of document.walls) {
    const start = vertices.get(wall.startVertexId)?.position;
    const end = vertices.get(wall.endVertexId)?.position;
    if (!start || !end) continue;
    for (const corner of wallCorners(start, end, wall.thickness)) bounds = extend(bounds, corner);
  }
  for (const object of document.placedObjects) {
    const rectangle = options.includeClearance
      ? expandedOrientedRectangle({ center: object.position, width: object.width, depth: object.depth, rotationDeg: object.rotationDeg }, object.clearance)
      : { center: object.position, width: object.width, depth: object.depth, rotationDeg: object.rotationDeg };
    for (const corner of orientedRectangleCorners(rectangle)) bounds = extend(bounds, corner);
  }
  for (const opening of document.openings) {
    if (opening.kind !== "door") continue;
    try { for (const point of doorSwingPolygon(document, opening)) bounds = extend(bounds, point); }
    catch { /* Invalid topology remains visible through editor diagnostics. */ }
  }
  return unionWorldBounds(bounds, options.additionalBounds ?? null);
}

export function fitViewportToBounds(bounds: WorldBounds | null, size: ViewportSize, paddingPx = 64): ViewportTransform {
  if (!bounds) return { ...DEFAULT_VIEWPORT };
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const padding = Math.max(0, Math.min(paddingPx, Math.min(width, height) / 2 - 1));
  const worldWidth = Math.max(1e-6, bounds.maxX - bounds.minX);
  const worldHeight = Math.max(1e-6, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const pixelsPerMillimeter = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(availableWidth / worldWidth, availableHeight / worldHeight)));
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return { pixelsPerMillimeter, offsetX: width / 2 - centerX * pixelsPerMillimeter, offsetY: height / 2 - centerY * pixelsPerMillimeter };
}
