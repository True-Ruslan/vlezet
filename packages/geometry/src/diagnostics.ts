import { distanceBetween } from "./point";
import { GEOMETRY_EPSILON_MM, isProperInteriorIntersection, pointOnSegment, segmentIntersection } from "./segment";
import { deriveAtomicWallEdges, topologyVertexMap, type TopologyDocumentLike } from "./topology";

export type TopologyDiagnosticCode =
  | "missing-vertex"
  | "zero-length-wall"
  | "junction-off-wall"
  | "duplicate-atomic-edge"
  | "undeclared-crossing";

export type TopologyDiagnostic = Readonly<{
  code: TopologyDiagnosticCode;
  severity: "error" | "warning";
  message: string;
  wallIds: readonly string[];
  vertexIds: readonly string[];
  point?: Readonly<{ x: number; y: number }>;
}>;

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

  const crossingPairs = new Set<string>();
  for (let firstIndex = 0; firstIndex < atomicEdges.length; firstIndex += 1) {
    const first = atomicEdges[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < atomicEdges.length; secondIndex += 1) {
      const second = atomicEdges[secondIndex]!;
      if (first.wallId === second.wallId) continue;
      if (
        first.startVertexId === second.startVertexId ||
        first.startVertexId === second.endVertexId ||
        first.endVertexId === second.startVertexId ||
        first.endVertexId === second.endVertexId
      ) {
        continue;
      }

      const intersection = segmentIntersection(first.start, first.end, second.start, second.end, tolerance);
      if (!intersection || !isProperInteriorIntersection(intersection, tolerance)) continue;

      const wallIds = [first.wallId, second.wallId].sort();
      const pairKey = `${wallIds[0]}:${wallIds[1]}`;
      if (crossingPairs.has(pairKey)) continue;
      crossingPairs.add(pairKey);

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
