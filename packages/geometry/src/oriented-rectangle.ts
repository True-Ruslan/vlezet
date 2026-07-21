import type { Point2 } from "./point";

const GEOMETRY_EPSILON = 1e-6;

export type OrientedRectangle = Readonly<{
  center: Point2;
  width: number;
  depth: number;
  rotationDeg: number;
}>;

export type RectangleAxes = Readonly<{
  widthAxis: Point2;
  depthAxis: Point2;
}>;

export type RectangleMargins = Readonly<{
  front: number;
  right: number;
  back: number;
  left: number;
}>;

function assertRectangle(rectangle: OrientedRectangle): void {
  for (const [label, value] of [
    ["center.x", rectangle.center.x],
    ["center.y", rectangle.center.y],
    ["width", rectangle.width],
    ["depth", rectangle.depth],
    ["rotationDeg", rectangle.rotationDeg],
  ] as const) {
    if (!Number.isFinite(value)) throw new RangeError(`Rectangle ${label} must be finite`);
  }
  if (rectangle.width <= 0 || rectangle.depth <= 0) {
    throw new RangeError("Rectangle dimensions must be positive");
  }
}

function cleanNumber(value: number): number {
  if (Math.abs(value) <= 1e-10) return 0;
  const integer = Math.round(value);
  if (Math.abs(value - integer) <= 1e-10) return integer;
  return value;
}

function dot(a: Point2, b: Point2): number {
  return a.x * b.x + a.y * b.y;
}

export function orientedRectangleAxes(rectangle: OrientedRectangle): RectangleAxes {
  assertRectangle(rectangle);
  const radians = (rectangle.rotationDeg * Math.PI) / 180;
  const cosine = cleanNumber(Math.cos(radians));
  const sine = cleanNumber(Math.sin(radians));
  return {
    widthAxis: { x: cosine, y: sine },
    depthAxis: { x: -sine, y: cosine },
  };
}

export function localToWorld(rectangle: OrientedRectangle, local: Point2): Point2 {
  assertRectangle(rectangle);
  if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) throw new RangeError("Local point must be finite");
  const { widthAxis, depthAxis } = orientedRectangleAxes(rectangle);
  return {
    x: cleanNumber(rectangle.center.x + widthAxis.x * local.x + depthAxis.x * local.y),
    y: cleanNumber(rectangle.center.y + widthAxis.y * local.x + depthAxis.y * local.y),
  };
}

export function worldToLocal(rectangle: OrientedRectangle, world: Point2): Point2 {
  assertRectangle(rectangle);
  if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) throw new RangeError("World point must be finite");
  const delta = { x: world.x - rectangle.center.x, y: world.y - rectangle.center.y };
  const { widthAxis, depthAxis } = orientedRectangleAxes(rectangle);
  return {
    x: cleanNumber(dot(delta, widthAxis)),
    y: cleanNumber(dot(delta, depthAxis)),
  };
}

export function orientedRectangleCorners(rectangle: OrientedRectangle): readonly Point2[] {
  assertRectangle(rectangle);
  const halfWidth = rectangle.width / 2;
  const halfDepth = rectangle.depth / 2;
  return [
    localToWorld(rectangle, { x: -halfWidth, y: -halfDepth }),
    localToWorld(rectangle, { x: halfWidth, y: -halfDepth }),
    localToWorld(rectangle, { x: halfWidth, y: halfDepth }),
    localToWorld(rectangle, { x: -halfWidth, y: halfDepth }),
  ];
}

export function orientedRectangleEdges(
  rectangle: OrientedRectangle,
): readonly Readonly<{ start: Point2; end: Point2 }>[] {
  const corners = orientedRectangleCorners(rectangle);
  return corners.map((start, index) => ({ start, end: corners[(index + 1) % corners.length]! }));
}

export function pointInOrientedRectangle(
  point: Point2,
  rectangle: OrientedRectangle,
  epsilon = GEOMETRY_EPSILON,
): boolean {
  const local = worldToLocal(rectangle, point);
  return Math.abs(local.x) <= rectangle.width / 2 + epsilon && Math.abs(local.y) <= rectangle.depth / 2 + epsilon;
}

function project(points: readonly Point2[], axis: Point2): Readonly<{ min: number; max: number }> {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const value = dot(point, axis);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

export function orientedRectanglesIntersect(
  first: OrientedRectangle,
  second: OrientedRectangle,
  epsilon = GEOMETRY_EPSILON,
): boolean {
  const firstCorners = orientedRectangleCorners(first);
  const secondCorners = orientedRectangleCorners(second);
  const firstAxes = orientedRectangleAxes(first);
  const secondAxes = orientedRectangleAxes(second);
  const axes = [firstAxes.widthAxis, firstAxes.depthAxis, secondAxes.widthAxis, secondAxes.depthAxis];

  for (const axis of axes) {
    const firstProjection = project(firstCorners, axis);
    const secondProjection = project(secondCorners, axis);
    const overlap = Math.min(firstProjection.max, secondProjection.max) - Math.max(firstProjection.min, secondProjection.min);
    if (overlap <= epsilon) return false;
  }
  return true;
}

function assertMargin(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} margin must be a non-negative finite number`);
}

export function expandedOrientedRectangle(
  rectangle: OrientedRectangle,
  margins: RectangleMargins,
): OrientedRectangle {
  assertRectangle(rectangle);
  assertMargin(margins.front, "Front");
  assertMargin(margins.right, "Right");
  assertMargin(margins.back, "Back");
  assertMargin(margins.left, "Left");

  const localShift = {
    x: (margins.right - margins.left) / 2,
    y: (margins.front - margins.back) / 2,
  };
  return {
    center: localToWorld(rectangle, localShift),
    width: rectangle.width + margins.left + margins.right,
    depth: rectangle.depth + margins.back + margins.front,
    rotationDeg: rectangle.rotationDeg,
  };
}
