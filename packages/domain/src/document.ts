import type { Vertex } from "./vertex";
import type { Point2, V1Wall, Wall } from "./wall";

export type OpeningKind = "door" | "window";

export type DoorSwing = Readonly<{
  hinge: "start" | "end";
  side: "left" | "right";
}>;

export type Opening = Readonly<{
  id: string;
  wallId: string;
  kind: OpeningKind;
  offset: number;
  width: number;
  doorSwing?: DoorSwing;
}>;

export type RoomAnnotation = Readonly<{
  id: string;
  name: string;
  anchor: Point2;
}>;

export type VlezetDocumentV1 = Readonly<{
  schemaVersion: 1;
  walls: readonly V1Wall[];
}>;

export type VlezetDocumentV2 = Readonly<{
  schemaVersion: 2;
  vertices: readonly Vertex[];
  walls: readonly Wall[];
  openings: readonly Opening[];
  roomAnnotations: readonly RoomAnnotation[];
}>;

export type VlezetDocument = VlezetDocumentV2;

export function createEmptyDocument(): VlezetDocumentV2 {
  return {
    schemaVersion: 2,
    vertices: [],
    walls: [],
    openings: [],
    roomAnnotations: [],
  };
}

export function migrateDocument(input: VlezetDocumentV1 | VlezetDocumentV2): VlezetDocumentV2 {
  if (input.schemaVersion === 2) return input;

  const vertices: Vertex[] = [];
  const vertexIdByCoordinate = new Map<string, string>();

  const resolveVertexId = (point: Point2): string => {
    const key = `${point.x}\u0000${point.y}`;
    const existing = vertexIdByCoordinate.get(key);
    if (existing) return existing;

    const id = `v1-vertex-${vertices.length}`;
    vertexIdByCoordinate.set(key, id);
    vertices.push({ id, position: { ...point } });
    return id;
  };

  return {
    schemaVersion: 2,
    vertices,
    walls: input.walls.map((wall) => ({
      id: wall.id,
      startVertexId: resolveVertexId(wall.start),
      endVertexId: resolveVertexId(wall.end),
      junctionVertexIds: [],
      thickness: wall.thickness,
    })),
    openings: [],
    roomAnnotations: [],
  };
}

export function getVertex(document: VlezetDocumentV2, vertexId: string): Vertex {
  const vertex = document.vertices.find((candidate) => candidate.id === vertexId);
  if (!vertex) throw new Error(`Vertex does not exist: ${vertexId}`);
  return vertex;
}

export function getWallEndpoints(document: VlezetDocumentV2, wall: Wall): Readonly<{ start: Vertex; end: Vertex }> {
  return {
    start: getVertex(document, wall.startVertexId),
    end: getVertex(document, wall.endVertexId),
  };
}
