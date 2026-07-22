import { extractPlanarFaces } from "./faces";
import { topologyVertexMap, type TopologyDocumentLike } from "./topology";

export type WallRoomSide = "left" | "right";

export function deriveSingleAdjacentRoomSide(
  document: TopologyDocumentLike,
  wallId: string,
): WallRoomSide | null {
  const wall = document.walls.find((candidate) => candidate.id === wallId);
  if (!wall) throw new Error(`Wall does not exist: ${wallId}`);

  const vertices = topologyVertexMap(document);
  const start = vertices.get(wall.startVertexId);
  const end = vertices.get(wall.endVertexId);
  if (!start || !end) throw new Error(`Wall ${wallId} references a missing endpoint`);

  const semanticDx = end.position.x - start.position.x;
  const semanticDy = end.position.y - start.position.y;
  const sides = new Set<WallRoomSide>();

  for (const face of extractPlanarFaces(document)) {
    for (const edge of face.edges) {
      if (edge.wallId !== wallId) continue;
      const edgeDx = edge.end.x - edge.start.x;
      const edgeDy = edge.end.y - edge.start.y;
      const sameDirection = edgeDx * semanticDx + edgeDy * semanticDy >= 0;
      sides.add(sameDirection ? "left" : "right");
    }
  }

  return sides.size === 1 ? [...sides][0]! : null;
}
