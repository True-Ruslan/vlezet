import { distanceBetween, type Point2 } from "./point";

export type SnapKind = "endpoint" | "axis" | "grid" | "none";

export type SnapGuide = Readonly<{
  axis: "x" | "y";
  value: number;
}>;

export type SnapResult = Readonly<{
  point: Point2;
  kind: SnapKind;
  guides: readonly SnapGuide[];
}>;

export type SnapWallPointInput = Readonly<{
  rawPoint: Point2;
  startPoint?: Point2 | null;
  endpoints: readonly Point2[];
  gridStep: number;
  tolerance: number;
}>;

function snapToGrid(value: number, gridStep: number): number {
  return Math.round(value / gridStep) * gridStep;
}

export function snapWallPoint(input: SnapWallPointInput): SnapResult {
  const { rawPoint, startPoint, endpoints, gridStep, tolerance } = input;

  const endpoint = endpoints
    .map((point, index) => ({ point, index, distance: distanceBetween(rawPoint, point) }))
    .filter((candidate) => candidate.distance <= tolerance)
    .sort((a, b) => a.distance - b.distance || a.index - b.index)[0];

  if (endpoint) {
    return { point: endpoint.point, kind: "endpoint", guides: [] };
  }

  if (startPoint) {
    const xDeviation = Math.abs(rawPoint.x - startPoint.x);
    const yDeviation = Math.abs(rawPoint.y - startPoint.y);

    if (xDeviation <= tolerance || yDeviation <= tolerance) {
      if (yDeviation <= xDeviation) {
        return {
          point: {
            x: gridStep > 0 ? snapToGrid(rawPoint.x, gridStep) : rawPoint.x,
            y: startPoint.y,
          },
          kind: "axis",
          guides: [{ axis: "y", value: startPoint.y }],
        };
      }

      return {
        point: {
          x: startPoint.x,
          y: gridStep > 0 ? snapToGrid(rawPoint.y, gridStep) : rawPoint.y,
        },
        kind: "axis",
        guides: [{ axis: "x", value: startPoint.x }],
      };
    }
  }

  if (Number.isFinite(gridStep) && gridStep > 0) {
    return {
      point: {
        x: snapToGrid(rawPoint.x, gridStep),
        y: snapToGrid(rawPoint.y, gridStep),
      },
      kind: "grid",
      guides: [],
    };
  }

  return { point: rawPoint, kind: "none", guides: [] };
}
