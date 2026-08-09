import { distanceBetween, type Point2 } from "./point";
import { GEOMETRY_EPSILON_MM, projectPointToSegment } from "./segment";
import { topologyVertexMap, type TopologyDocumentLike, type TopologyWallLike } from "./topology";

export type StructuralSnapKind =
  | "endpoint"
  | "junction"
  | "midpoint"
  | "intersection"
  | "wall-axis"
  | "parallel"
  | "perpendicular"
  | "horizontal"
  | "vertical"
  | "grid"
  | "none";

export type StructuralSnapTarget =
  | Readonly<{ kind: "vertex"; vertexId: string; point: Point2 }>
  | Readonly<{ kind: "wall"; wallId: string; point: Point2 }>
  | null;

export type StructuralSnapGuide =
  | Readonly<{ kind: "axis"; axis: "x" | "y"; value: number }>
  | Readonly<{ kind: "segment"; start: Point2; end: Point2 }>
  | Readonly<{ kind: "point"; point: Point2 }>;

export type StructuralSnapResult = Readonly<{
  candidateId: string | null;
  point: Point2;
  kind: StructuralSnapKind;
  label: string | null;
  guides: readonly StructuralSnapGuide[];
  target: StructuralSnapTarget;
}>;

export type ResolveStructuralSnapInput = Readonly<{
  document: TopologyDocumentLike;
  rawPoint: Point2;
  startPoint?: Point2 | null;
  gridStep: number;
  acquisitionTolerance: number;
  releaseTolerance: number;
  replacementAdvantage: number;
  activeCandidateId?: string | null;
  snappingEnabled: boolean;
  excludeVertexIds?: ReadonlySet<string>;
  excludeWallIds?: ReadonlySet<string>;
}>;

type Candidate = StructuralSnapResult & Readonly<{
  priority: number;
  distance: number;
  sourceOrder: number;
}>;

type ResolvedWall = Readonly<{
  wall: TopologyWallLike;
  start: Point2;
  end: Point2;
  sourceOrder: number;
}>;

type ConstructionGuide = Readonly<{
  id: string;
  kind: "parallel" | "perpendicular" | "horizontal" | "vertical";
  label: string;
  direction: Point2;
  priority: number;
  sourceOrder: number;
}>;

const PRIORITY = {
  endpoint: 0,
  junction: 0,
  midpoint: 1,
  intersection: 2,
  wallAxis: 3,
  angular: 4,
  axis: 5,
  grid: 6,
} as const;

function assertFinitePoint(point: Point2, name: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${name} must contain finite coordinates`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function pointAlongInfiniteLine(point: Point2, lineOrigin: Point2, unit: Point2): Point2 {
  const dx = point.x - lineOrigin.x;
  const dy = point.y - lineOrigin.y;
  const t = dx * unit.x + dy * unit.y;
  return { x: lineOrigin.x + unit.x * t, y: lineOrigin.y + unit.y * t };
}

function normalizeDirection(vector: Point2): Point2 | null {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= GEOMETRY_EPSILON_MM) return null;
  return { x: vector.x / length, y: vector.y / length };
}

function snapGrid(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function lineSegmentIntersection(
  origin: Point2,
  direction: Point2,
  segmentStart: Point2,
  segmentEnd: Point2,
): Readonly<{ point: Point2; segmentT: number }> | null {
  const sx = segmentEnd.x - segmentStart.x;
  const sy = segmentEnd.y - segmentStart.y;
  const denominator = direction.x * sy - direction.y * sx;
  if (Math.abs(denominator) <= GEOMETRY_EPSILON_MM) return null;

  const qx = segmentStart.x - origin.x;
  const qy = segmentStart.y - origin.y;
  const lineT = (qx * sy - qy * sx) / denominator;
  const segmentT = (qx * direction.y - qy * direction.x) / denominator;
  if (segmentT <= GEOMETRY_EPSILON_MM || segmentT >= 1 - GEOMETRY_EPSILON_MM) return null;

  return {
    point: {
      x: origin.x + direction.x * lineT,
      y: origin.y + direction.y * lineT,
    },
    segmentT,
  };
}

function candidateSort(first: Candidate, second: Candidate): number {
  return first.priority - second.priority ||
    first.distance - second.distance ||
    first.sourceOrder - second.sourceOrder ||
    (first.candidateId ?? "").localeCompare(second.candidateId ?? "");
}

function resultFromCandidate(candidate: Candidate): StructuralSnapResult {
  return {
    candidateId: candidate.candidateId,
    point: candidate.point,
    kind: candidate.kind,
    label: candidate.label,
    guides: candidate.guides,
    target: candidate.target,
  };
}

function noSnap(point: Point2): StructuralSnapResult {
  return {
    candidateId: null,
    point,
    kind: "none",
    label: null,
    guides: [],
    target: null,
  };
}

export function resolveStructuralSnap(input: ResolveStructuralSnapInput): StructuralSnapResult {
  const {
    document,
    rawPoint,
    startPoint = null,
    gridStep,
    acquisitionTolerance,
    releaseTolerance,
    replacementAdvantage,
    activeCandidateId = null,
    snappingEnabled,
    excludeVertexIds = new Set<string>(),
    excludeWallIds = new Set<string>(),
  } = input;

  assertFinitePoint(rawPoint, "rawPoint");
  if (startPoint) assertFinitePoint(startPoint, "startPoint");
  assertNonNegativeFinite(acquisitionTolerance, "acquisitionTolerance");
  assertNonNegativeFinite(releaseTolerance, "releaseTolerance");
  assertNonNegativeFinite(replacementAdvantage, "replacementAdvantage");
  if (releaseTolerance < acquisitionTolerance) {
    throw new RangeError("releaseTolerance must be greater than or equal to acquisitionTolerance");
  }
  if (!snappingEnabled) return noSnap(rawPoint);

  const vertices = topologyVertexMap(document);
  const resolvedWalls: ResolvedWall[] = [];
  for (let index = 0; index < document.walls.length; index += 1) {
    const wall = document.walls[index]!;
    if (excludeWallIds.has(wall.id)) continue;
    const start = vertices.get(wall.startVertexId);
    const end = vertices.get(wall.endVertexId);
    if (!start || !end) continue;
    resolvedWalls.push({ wall, start: start.position, end: end.position, sourceOrder: index });
  }

  const junctionIds = new Set<string>();
  for (const { wall } of resolvedWalls) {
    for (const vertexId of wall.junctionVertexIds) junctionIds.add(vertexId);
  }

  const candidates: Candidate[] = [];
  let sequence = 0;
  const add = (
    candidate: Omit<Candidate, "sourceOrder"> & Readonly<{ sourceOrder?: number }>,
  ) => {
    candidates.push({ ...candidate, sourceOrder: candidate.sourceOrder ?? sequence++ });
  };

  for (let index = 0; index < document.vertices.length; index += 1) {
    const vertex = document.vertices[index]!;
    if (excludeVertexIds.has(vertex.id)) continue;
    const distance = distanceBetween(rawPoint, vertex.position);
    if (distance > releaseTolerance) continue;
    const isJunction = junctionIds.has(vertex.id);
    add({
      candidateId: `vertex:${vertex.id}`,
      point: vertex.position,
      kind: isJunction ? "junction" : "endpoint",
      label: isJunction ? "Соединение" : "Конечная точка",
      guides: [{ kind: "point", point: vertex.position }],
      target: { kind: "vertex", vertexId: vertex.id, point: vertex.position },
      priority: PRIORITY.endpoint,
      distance,
      sourceOrder: index,
    });
  }

  for (const resolved of resolvedWalls) {
    const midpoint = {
      x: (resolved.start.x + resolved.end.x) / 2,
      y: (resolved.start.y + resolved.end.y) / 2,
    };
    const midpointDistance = distanceBetween(rawPoint, midpoint);
    if (midpointDistance <= releaseTolerance) {
      add({
        candidateId: `midpoint:${resolved.wall.id}`,
        point: midpoint,
        kind: "midpoint",
        label: "Середина",
        guides: [{ kind: "point", point: midpoint }],
        target: { kind: "wall", wallId: resolved.wall.id, point: midpoint },
        priority: PRIORITY.midpoint,
        distance: midpointDistance,
        sourceOrder: resolved.sourceOrder,
      });
    }

    const projection = projectPointToSegment(rawPoint, resolved.start, resolved.end);
    if (
      projection.distance <= releaseTolerance &&
      projection.t > GEOMETRY_EPSILON_MM &&
      projection.t < 1 - GEOMETRY_EPSILON_MM
    ) {
      add({
        candidateId: `wall-axis:${resolved.wall.id}`,
        point: projection.point,
        kind: "wall-axis",
        label: "По стене",
        guides: [{ kind: "segment", start: resolved.start, end: resolved.end }],
        target: { kind: "wall", wallId: resolved.wall.id, point: projection.point },
        priority: PRIORITY.wallAxis,
        distance: projection.distance,
        sourceOrder: resolved.sourceOrder,
      });
    }
  }

  const constructionGuides: ConstructionGuide[] = [];
  if (startPoint) {
    constructionGuides.push(
      {
        id: "horizontal",
        kind: "horizontal",
        label: "Горизонталь",
        direction: { x: 1, y: 0 },
        priority: PRIORITY.axis,
        sourceOrder: 0,
      },
      {
        id: "vertical",
        kind: "vertical",
        label: "Вертикаль",
        direction: { x: 0, y: 1 },
        priority: PRIORITY.axis,
        sourceOrder: 1,
      },
    );

    for (const resolved of resolvedWalls) {
      const nearStart = projectPointToSegment(startPoint, resolved.start, resolved.end);
      if (nearStart.distance > releaseTolerance) continue;
      const unit = normalizeDirection({
        x: resolved.end.x - resolved.start.x,
        y: resolved.end.y - resolved.start.y,
      });
      if (!unit) continue;
      constructionGuides.push(
        {
          id: `parallel:${resolved.wall.id}`,
          kind: "parallel",
          label: "Параллельно",
          direction: unit,
          priority: PRIORITY.angular,
          sourceOrder: 1000 + resolved.sourceOrder * 2,
        },
        {
          id: `perpendicular:${resolved.wall.id}`,
          kind: "perpendicular",
          label: "Перпендикулярно",
          direction: { x: -unit.y, y: unit.x },
          priority: PRIORITY.angular,
          sourceOrder: 1001 + resolved.sourceOrder * 2,
        },
      );
    }

    for (const guide of constructionGuides) {
      const projected = pointAlongInfiniteLine(rawPoint, startPoint, guide.direction);
      const distance = distanceBetween(rawPoint, projected);
      if (distance <= releaseTolerance) {
        add({
          candidateId: guide.id,
          point: projected,
          kind: guide.kind,
          label: guide.label,
          guides: guide.kind === "horizontal"
            ? [{ kind: "axis", axis: "y", value: startPoint.y }]
            : guide.kind === "vertical"
              ? [{ kind: "axis", axis: "x", value: startPoint.x }]
              : [{ kind: "segment", start: startPoint, end: projected }],
          target: null,
          priority: guide.priority,
          distance,
          sourceOrder: guide.sourceOrder,
        });
      }

      const intersections = resolvedWalls.flatMap((resolved) => {
        const intersection = lineSegmentIntersection(
          startPoint,
          guide.direction,
          resolved.start,
          resolved.end,
        );
        if (!intersection) return [];
        const intersectionDistance = distanceBetween(rawPoint, intersection.point);
        if (intersectionDistance > releaseTolerance) return [];
        return [{ resolved, point: intersection.point, distance: intersectionDistance }];
      });

      // More than one wall requiring materialisation at the current construction line is
      // intentionally ambiguous in M8.2: never create a hidden multi-wall split/repair.
      if (intersections.length === 1) {
        const [{ resolved, point, distance }] = intersections;
        add({
          candidateId: `intersection:${guide.id}:${resolved.wall.id}`,
          point,
          kind: "intersection",
          label: "Пересечение",
          guides: [
            { kind: "segment", start: startPoint, end: point },
            { kind: "point", point },
          ],
          target: { kind: "wall", wallId: resolved.wall.id, point },
          priority: PRIORITY.intersection,
          distance,
          sourceOrder: guide.sourceOrder * 10000 + resolved.sourceOrder,
        });
      }
    }
  }

  if (Number.isFinite(gridStep) && gridStep > 0) {
    const point = {
      x: snapGrid(rawPoint.x, gridStep),
      y: snapGrid(rawPoint.y, gridStep),
    };
    add({
      candidateId: `grid:${point.x}:${point.y}`,
      point,
      kind: "grid",
      label: "Сетка",
      guides: [],
      target: null,
      priority: PRIORITY.grid,
      distance: distanceBetween(rawPoint, point),
      sourceOrder: Number.MAX_SAFE_INTEGER,
    });
  }

  const active = activeCandidateId
    ? candidates.find((candidate) => candidate.candidateId === activeCandidateId && candidate.distance <= releaseTolerance) ?? null
    : null;
  const acquired = candidates
    .filter((candidate) => candidate.priority === PRIORITY.grid || candidate.distance <= acquisitionTolerance)
    .sort(candidateSort);
  const best = acquired[0] ?? null;

  if (active) {
    if (!best) return resultFromCandidate(active);
    if (best.candidateId === active.candidateId) return resultFromCandidate(active);
    if (best.priority < active.priority) return resultFromCandidate(best);
    if (best.priority > active.priority) return resultFromCandidate(active);
    if (best.distance + replacementAdvantage < active.distance) return resultFromCandidate(best);
    return resultFromCandidate(active);
  }

  return best ? resultFromCandidate(best) : noSnap(rawPoint);
}
