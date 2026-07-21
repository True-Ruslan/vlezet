import type { PlacedObject } from "./placed-object";
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

export type VlezetDocumentV3 = Readonly<{
  schemaVersion: 3;
  vertices: readonly Vertex[];
  walls: readonly Wall[];
  openings: readonly Opening[];
  roomAnnotations: readonly RoomAnnotation[];
  placedObjects: readonly PlacedObject[];
}>;

export type VlezetDocument = VlezetDocumentV3;
export type VlezetShellDocument = VlezetDocumentV2 | VlezetDocumentV3;

export function createEmptyDocument(): VlezetDocumentV3 {
  return {
    schemaVersion: 3,
    vertices: [],
    walls: [],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  };
}

function migrateV1Shell(input: VlezetDocumentV1): Omit<VlezetDocumentV2, "schemaVersion"> {
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

  const walls = input.walls.map((wall) => ({
    id: wall.id,
    startVertexId: resolveVertexId(wall.start),
    endVertexId: resolveVertexId(wall.end),
    junctionVertexIds: [] as readonly string[],
    thickness: wall.thickness,
  }));

  return {
    vertices,
    walls,
    openings: [],
    roomAnnotations: [],
  };
}

export function migrateDocument(
  input: VlezetDocumentV1 | VlezetDocumentV2 | VlezetDocumentV3,
): VlezetDocumentV3 {
  if (input.schemaVersion === 3) return input;

  if (input.schemaVersion === 2) {
    return {
      schemaVersion: 3,
      vertices: input.vertices,
      walls: input.walls,
      openings: input.openings,
      roomAnnotations: input.roomAnnotations,
      placedObjects: [],
    };
  }

  return {
    schemaVersion: 3,
    ...migrateV1Shell(input),
    placedObjects: [],
  };
}

export function getVertex(document: VlezetShellDocument, vertexId: string): Vertex {
  const vertex = document.vertices.find((candidate) => candidate.id === vertexId);
  if (!vertex) throw new Error(`Vertex does not exist: ${vertexId}`);
  return vertex;
}

export function getWallEndpoints(
  document: VlezetShellDocument,
  wall: Wall,
): Readonly<{ start: Vertex; end: Vertex }> {
  return {
    start: getVertex(document, wall.startVertexId),
    end: getVertex(document, wall.endVertexId),
  };
}
