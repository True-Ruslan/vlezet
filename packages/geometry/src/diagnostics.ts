import { distanceBetween, type Point2 } from "./point";
import { GEOMETRY_EPSILON_MM, pointOnSegment, segmentIntersection } from "./segment";
import { deriveAtomicWallEdges, topologyVertexMap, type AtomicWallEdge, type TopologyDocumentLike } from "./topology";

export type TopologyDiagnosticCode =
  | "missing-vertex"
  | "zero-length-wall"
  | "junction-off-wall"
  | "duplicate-atomic-edge"
  | "undeclared-crossing"
  | "overlapping-walls";

export type TopologyDiagnostic = Readonly<{
  code: TopologyDiagnosticCode;
  severity: "error" | "warning";
  message: string;
  wallIds: readonly string[];
  vertexIds: readonly string[];
  point?: Readonly<{ x: number; y: number }>;
}>;

function cross(a: Point2, b: Point2, c: Point2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function sharedVertexIds(first: AtomicWallEdge, second: AtomicWallEdge): string[] {
  return [first.startVertexId, first.endVertexId].filter(
    (id) => id === second.startVertexId || id === second.endVertexId,
  );
}

function collinearOverlapLength(first: AtomicWallEdge, second: AtomicWallEdge, tolerance: number): number | null {
  const firstDx = first.end.x - first.start.x;
  const firstDy = first.end.y - first.start.y;
  const scale = Math.max(1, Math.hypot(firstDx, firstDy));
  if (Math.abs(cross(first.start, first.end, second.start)) > tolerance * scale) return null;
  if (Math.abs(cross(first.start, first.end, second.end)) > tolerance * scale) return null;

  const useX = Math.abs(firstDx) >= Math.abs(firstDy);
  const a0 = useX ? first.start.x : first.start.y;
  const a1 = useX ? first.end.x : first.end.y;
  const b0 = useX ? second.start.x : second.start.y;
  const b1 = useX ? second.end.x : second.end.y;
  const firstMin = Math.min(a0, a1);
  const firstMax = Math.max(a0, a1);
  const secondMin = Math.min(b0, b1);
  const secondMax = Math.max(b0, b1);
  return Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin);
}

export function validateTopology(
  document: TopologyDocumentLike,
  tolerance: number = GEOMETRY_EPSILON_MM,
): TopologyDiagnostic[] {
  const diagnostics: TopologyDiagnostic[] = [];
  const vertices = topologyVertexMap(document);

  for (const wall of document.walls) {
    const start = vertices.get(wall.startVertexId);
    const end = vertices.get(wall.endVertexId);

    for (const vertexId of [wall.startVertexId, wall.endVertexId, ...wall.junctionVertexIds]) {
      if (!vertices.has(vertexId)) {
        diagnostics.push({
          code: "missing-vertex",
          severity: "error",
          message: `Стена ${wall.id} ссылается на отсутствующую вершину ${vertexId}`,
          wallIds: [wall.id],
          vertexIds: [vertexId],
        });
      }
    }

    if (!start || !end) continue;
    if (distanceBetween(start.position, end.position) <= tolerance) {
      diagnostics.push({
        code: "zero-length-wall",
        severity: "error",
        message: "Длина стены должна быть больше нуля",
        wallIds: [wall.id],
        vertexIds: [start.id, end.id],
        point: start.position,
      });
      continue;
    }

    for (const junctionId of wall.junctionVertexIds) {
      const junction = vertices.get(junctionId);
      if (!junction) continue;
      if (!pointOnSegment(junction.position, start.position, end.position, tolerance)) {
        diagnostics.push({
          code: "junction-off-wall",
          severity: "error",
          message: "Соединение перегородки больше не лежит на своей стене",
          wallIds: [wall.id],
          vertexIds: [junction.id],
          point: junction.position,
        });
      }
    }
  }

  let atomicEdges: ReturnType<typeof deriveAtomicWallEdges> = [];
  try {
    atomicEdges = deriveAtomicWallEdges(document);
  } catch {
    return diagnostics;
  }

  const seenEdgeKeys = new Set<string>();
  for (const edge of atomicEdges) {
    const endpoints = [edge.startVertexId, edge.endVertexId].sort();
    const key = `${edge.wallId}:${endpoints[0]}:${endpoints[1]}`;
    if (seenEdgeKeys.has(key)) {
      diagnostics.push({
        code: "duplicate-atomic-edge",
        severity: "error",
        message: "Обнаружен дублирующий участок стены",
        wallIds: [edge.wallId],
        vertexIds: endpoints,
      });
    }
    seenEdgeKeys.add(key);
  }

  const reportedPairs = new Set<string>();
  for (let firstIndex = 0; firstIndex < atomicEdges.length; firstIndex += 1) {
    const first = atomicEdges[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < atomicEdges.length; secondIndex += 1) {
      const second = atomicEdges[secondIndex]!;
      if (first.wallId === second.wallId) continue;

      const wallIds = [first.wallId, second.wallId].sort();
      const pairKey = `${wallIds[0]}:${wallIds[1]}`;
      if (reportedPairs.has(pairKey)) continue;

      const sharedIds = sharedVertexIds(first, second);
      const overlap = collinearOverlapLength(first, second, tolerance);
      if (overlap !== null) {
        if (overlap > tolerance) {
          reportedPairs.add(pairKey);
          diagnostics.push({
            code: "overlapping-walls",
            severity: "error",
            message: "Стены накладываются друг на друга",
            wallIds,
            vertexIds: sharedIds,
          });
        } else if (overlap >= -tolerance && sharedIds.length === 0) {
          reportedPairs.add(pairKey);
          const point = [first.start, first.end, second.start, second.end].find(
            (candidate) => pointOnSegment(candidate, first.start, first.end, tolerance) && pointOnSegment(candidate, second.start, second.end, tolerance),
          );
          diagnostics.push({
            code: "undeclared-crossing",
            severity: "error",
            message: "Стены соприкасаются без явного соединения",
            wallIds,
            vertexIds: [],
            point,
          });
        }
        continue;
      }

      const intersection = segmentIntersection(first.start, first.end, second.start, second.end, tolerance);
      if (!intersection) continue;
      if (sharedIds.length > 0) continue;

      reportedPairs.add(pairKey);
      diagnostics.push({
        code: "undeclared-crossing",
        severity: "error",
        message: "Стены пересекаются без явного соединения",
        wallIds,
        vertexIds: [],
        point: intersection.point,
      });
    }
  }

  return diagnostics;
}
