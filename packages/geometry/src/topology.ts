import { distanceBetween, type Point2 } from "./point";

export type TopologyVertexLike = Readonly<{
  id: string;
  position: Point2;
}>;

export type TopologyWallLike = Readonly<{
  id: string;
  startVertexId: string;
  endVertexId: string;
  junctionVertexIds: readonly string[];
  thickness: number;
}>;

export type TopologyDocumentLike = Readonly<{
  schemaVersion: 2 | 3;
  vertices: readonly TopologyVertexLike[];
  walls: readonly TopologyWallLike[];
}>;

export type AtomicWallEdge = Readonly<{
  wallId: string;
  startVertexId: string;
  endVertexId: string;
  start: Point2;
  end: Point2;
  thickness: number;
  startOffset: number;
  endOffset: number;
}>;

export function topologyVertexMap(document: TopologyDocumentLike): ReadonlyMap<string, TopologyVertexLike> {
  return new Map(document.vertices.map((vertex) => [vertex.id, vertex]));
}

export function deriveAtomicWallEdges(document: TopologyDocumentLike): AtomicWallEdge[] {
  const vertices = topologyVertexMap(document);
  const edges: AtomicWallEdge[] = [];

  for (const wall of document.walls) {
    const start = vertices.get(wall.startVertexId);
    const end = vertices.get(wall.endVertexId);
    if (!start) throw new Error(`Vertex does not exist: ${wall.startVertexId}`);
    if (!end) throw new Error(`Vertex does not exist: ${wall.endVertexId}`);

    const dx = end.position.x - start.position.x;
    const dy = end.position.y - start.position.y;
    const lengthSquared = dx * dx + dy * dy;
    const wallLength = Math.sqrt(lengthSquared);
    if (wallLength === 0) continue;

    const internal = wall.junctionVertexIds.map((vertexId) => {
      const vertex = vertices.get(vertexId);
      if (!vertex) throw new Error(`Vertex does not exist: ${vertexId}`);
      const t = ((vertex.position.x - start.position.x) * dx + (vertex.position.y - start.position.y) * dy) / lengthSquared;
      return { vertex, t };
    });

    internal.sort((a, b) => a.t - b.t || a.vertex.id.localeCompare(b.vertex.id));
    const chain = [start, ...internal.map(({ vertex }) => vertex), end];
    for (let index = 0; index < chain.length - 1; index += 1) {
      const edgeStart = chain[index]!;
      const edgeEnd = chain[index + 1]!;
      const startOffset = distanceBetween(start.position, edgeStart.position);
      const endOffset = distanceBetween(start.position, edgeEnd.position);
      edges.push({
        wallId: wall.id,
        startVertexId: edgeStart.id,
        endVertexId: edgeEnd.id,
        start: edgeStart.position,
        end: edgeEnd.position,
        thickness: wall.thickness,
        startOffset,
        endOffset,
      });
    }
  }

  return edges;
}

export function wallRunLength(document: TopologyDocumentLike, wallId: string): number {
  const wall = document.walls.find((candidate) => candidate.id === wallId);
  if (!wall) throw new Error(`Wall does not exist: ${wallId}`);
  const vertices = topologyVertexMap(document);
  const start = vertices.get(wall.startVertexId);
  const end = vertices.get(wall.endVertexId);
  if (!start || !end) throw new Error(`Wall ${wallId} references a missing endpoint`);
  return distanceBetween(start.position, end.position);
}
