import { orientedRectangleCorners, type Point2 } from "@vlezet/geometry";

export type SnappablePlacedObject = Readonly<{
  id: string;
  position: Point2;
  width: number;
  depth: number;
  rotationDeg: number;
}>;

export type ObjectSnapGuide = Readonly<{
  axis: "x" | "y";
  value: number;
  source: "edge" | "centre";
}>;

export type ObjectSnapResult = Readonly<{
  position: Point2;
  kind: "edge" | "centre" | "grid" | "none";
  guides: readonly ObjectSnapGuide[];
}>;

export type SnapPlacedObjectInput = Readonly<{
  rawPosition: Point2;
  moving: SnappablePlacedObject;
  others: readonly SnappablePlacedObject[];
  tolerance: number;
  gridStep: number;
}>;

type Bounds = Readonly<{ minX: number; maxX: number; minY: number; maxY: number; centerX: number; centerY: number }>;

function boundsFor(object: SnappablePlacedObject, position: Point2 = object.position): Bounds {
  const corners = orientedRectangleCorners({
    center: position,
    width: object.width,
    depth: object.depth,
    rotationDeg: object.rotationDeg,
  });
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    centerX: position.x,
    centerY: position.y,
  };
}

function nearestCandidate(
  values: readonly Readonly<{ delta: number; guide: ObjectSnapGuide }>[],
  tolerance: number,
): Readonly<{ delta: number; guide: ObjectSnapGuide }> | null {
  return values
    .filter((candidate) => Math.abs(candidate.delta) <= tolerance)
    .sort((first, second) => Math.abs(first.delta) - Math.abs(second.delta) || first.guide.value - second.guide.value)[0] ?? null;
}

function grid(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function snapPlacedObject(input: SnapPlacedObjectInput): ObjectSnapResult {
  const { rawPosition, moving, tolerance } = input;
  if (![rawPosition.x, rawPosition.y, tolerance].every(Number.isFinite) || tolerance < 0) {
    throw new RangeError("Object snap input must be finite");
  }

  const movingBounds = boundsFor(moving, rawPosition);
  const others = input.others.filter((other) => other.id !== moving.id);
  const edgeX: Array<{ delta: number; guide: ObjectSnapGuide }> = [];
  const edgeY: Array<{ delta: number; guide: ObjectSnapGuide }> = [];
  const centreX: Array<{ delta: number; guide: ObjectSnapGuide }> = [];
  const centreY: Array<{ delta: number; guide: ObjectSnapGuide }> = [];

  for (const other of others) {
    const bounds = boundsFor(other);
    for (const movingEdge of [movingBounds.minX, movingBounds.maxX]) {
      for (const targetEdge of [bounds.minX, bounds.maxX]) {
        edgeX.push({ delta: targetEdge - movingEdge, guide: { axis: "x", value: targetEdge, source: "edge" } });
      }
    }
    for (const movingEdge of [movingBounds.minY, movingBounds.maxY]) {
      for (const targetEdge of [bounds.minY, bounds.maxY]) {
        edgeY.push({ delta: targetEdge - movingEdge, guide: { axis: "y", value: targetEdge, source: "edge" } });
      }
    }
    centreX.push({ delta: bounds.centerX - movingBounds.centerX, guide: { axis: "x", value: bounds.centerX, source: "centre" } });
    centreY.push({ delta: bounds.centerY - movingBounds.centerY, guide: { axis: "y", value: bounds.centerY, source: "centre" } });
  }

  const xEdge = nearestCandidate(edgeX, tolerance);
  const yEdge = nearestCandidate(edgeY, tolerance);
  if (xEdge || yEdge) {
    return {
      position: {
        x: rawPosition.x + (xEdge?.delta ?? 0),
        y: rawPosition.y + (yEdge?.delta ?? 0),
      },
      kind: "edge",
      guides: [xEdge?.guide, yEdge?.guide].filter((guide): guide is ObjectSnapGuide => Boolean(guide)),
    };
  }

  const xCentre = nearestCandidate(centreX, tolerance);
  const yCentre = nearestCandidate(centreY, tolerance);
  if (xCentre || yCentre) {
    return {
      position: {
        x: rawPosition.x + (xCentre?.delta ?? 0),
        y: rawPosition.y + (yCentre?.delta ?? 0),
      },
      kind: "centre",
      guides: [xCentre?.guide, yCentre?.guide].filter((guide): guide is ObjectSnapGuide => Boolean(guide)),
    };
  }

  if (Number.isFinite(input.gridStep) && input.gridStep > 0) {
    return {
      position: { x: grid(rawPosition.x, input.gridStep), y: grid(rawPosition.y, input.gridStep) },
      kind: "grid",
      guides: [],
    };
  }

  return { position: rawPosition, kind: "none", guides: [] };
}
