import {
  getVertex,
  getWallEndpoints,
  type Point2,
  type VlezetDocumentV2,
  type Vertex,
  type Wall,
} from "@vlezet/domain";
import { GEOMETRY_EPSILON_MM, pointOnSegment, projectPointToSegment } from "@vlezet/geometry";

export const MIN_WALL_THICKNESS_MM = 50;
export const MAX_WALL_THICKNESS_MM = 1000;

export type WallEndpointIntent =
  | Readonly<{ kind: "existing-vertex"; vertexId: string }>
  | Readonly<{ kind: "new-vertex"; vertexId: string; position: Point2 }>
  | Readonly<{ kind: "wall-junction"; vertexId: string; wallId: string; position: Point2 }>;

export type AddTopologicalWallInput = Readonly<{
  wallId: string;
  start: WallEndpointIntent;
  end: WallEndpointIntent;
  thickness: number;
}>;

export type DocumentEdit = Readonly<{
  document: VlezetDocumentV2;
  selectedWallId?: string;
  continuationVertexId?: string;
}>;

function assertFinitePoint(point: Point2): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError("Координаты должны быть конечными числами");
  }
}

function assertUniqueId(document: VlezetDocumentV2, kind: "vertex" | "wall", id: string): void {
  if (!id) throw new Error("Идентификатор не может быть пустым");
  const exists = kind === "vertex"
    ? document.vertices.some((vertex) => vertex.id === id)
    : document.walls.some((wall) => wall.id === id);
  if (exists) throw new Error(`${kind === "vertex" ? "Vertex" : "Wall"} already exists: ${id}`);
}

function replaceWall(document: VlezetDocumentV2, replacement: Wall): VlezetDocumentV2 {
  return {
    ...document,
    walls: document.walls.map((wall) => (wall.id === replacement.id ? replacement : wall)),
  };
}

function resolveEndpoint(
  document: VlezetDocumentV2,
  intent: WallEndpointIntent,
): Readonly<{ document: VlezetDocumentV2; vertexId: string }> {
  if (intent.kind === "existing-vertex") {
    getVertex(document, intent.vertexId);
    return { document, vertexId: intent.vertexId };
  }

  assertFinitePoint(intent.position);
  assertUniqueId(document, "vertex", intent.vertexId);

  if (intent.kind === "new-vertex") {
    const vertex: Vertex = { id: intent.vertexId, position: { ...intent.position } };
    return { document: { ...document, vertices: [...document.vertices, vertex] }, vertexId: vertex.id };
  }

  const hostWall = document.walls.find((wall) => wall.id === intent.wallId);
  if (!hostWall) throw new Error(`Wall does not exist: ${intent.wallId}`);
  const { start, end } = getWallEndpoints(document, hostWall);
  const projection = projectPointToSegment(intent.position, start.position, end.position);
  if (projection.distance > 1e-4 || projection.t <= GEOMETRY_EPSILON_MM || projection.t >= 1 - GEOMETRY_EPSILON_MM) {
    throw new Error("T-соединение должно находиться внутри выбранной стены");
  }

  const vertex: Vertex = { id: intent.vertexId, position: projection.point };
  const nextDocument: VlezetDocumentV2 = { ...document, vertices: [...document.vertices, vertex] };
  const updatedHost: Wall = {
    ...hostWall,
    junctionVertexIds: hostWall.junctionVertexIds.includes(vertex.id)
      ? hostWall.junctionVertexIds
      : [...hostWall.junctionVertexIds, vertex.id],
  };

  return { document: replaceWall(nextDocument, updatedHost), vertexId: vertex.id };
}

export function addTopologicalWall(document: VlezetDocumentV2, input: AddTopologicalWallInput): DocumentEdit {
  assertUniqueId(document, "wall", input.wallId);
  if (!Number.isFinite(input.thickness) || input.thickness < MIN_WALL_THICKNESS_MM || input.thickness > MAX_WALL_THICKNESS_MM) {
    throw new RangeError(`Толщина стены должна быть от ${MIN_WALL_THICKNESS_MM} до ${MAX_WALL_THICKNESS_MM} мм`);
  }

  const startResult = resolveEndpoint(document, input.start);
  const endResult = resolveEndpoint(startResult.document, input.end);
  if (startResult.vertexId === endResult.vertexId) throw new Error("Стена должна иметь ненулевую длину");

  const startVertex = getVertex(endResult.document, startResult.vertexId);
  const endVertex = getVertex(endResult.document, endResult.vertexId);
  if (Math.hypot(endVertex.position.x - startVertex.position.x, endVertex.position.y - startVertex.position.y) <= GEOMETRY_EPSILON_MM) {
    throw new Error("Стена должна иметь ненулевую длину");
  }

  const wall: Wall = {
    id: input.wallId,
    startVertexId: startResult.vertexId,
    endVertexId: endResult.vertexId,
    junctionVertexIds: [],
    thickness: input.thickness,
  };

  return {
    document: { ...endResult.document, walls: [...endResult.document.walls, wall] },
    selectedWallId: wall.id,
    continuationVertexId: wall.endVertexId,
  };
}

export function addConnectedWall(
  document: VlezetDocumentV2,
  input: Readonly<{
    wallId: string;
    startVertexId: string;
    endVertexId: string;
    endPosition: Point2;
    thickness: number;
  }>,
): DocumentEdit {
  return addTopologicalWall(document, {
    wallId: input.wallId,
    start: { kind: "existing-vertex", vertexId: input.startVertexId },
    end: { kind: "new-vertex", vertexId: input.endVertexId, position: input.endPosition },
    thickness: input.thickness,
  });
}

export function addTJunctionWall(
  document: VlezetDocumentV2,
  input: Readonly<{
    wallId: string;
    start: WallEndpointIntent;
    junctionVertexId: string;
    hostWallId: string;
    junctionPosition: Point2;
    thickness: number;
  }>,
): DocumentEdit {
  return addTopologicalWall(document, {
    wallId: input.wallId,
    start: input.start,
    end: {
      kind: "wall-junction",
      vertexId: input.junctionVertexId,
      wallId: input.hostWallId,
      position: input.junctionPosition,
    },
    thickness: input.thickness,
  });
}

export function topologicalWallLength(document: VlezetDocumentV2, wallId: string): number {
  const wall = document.walls.find((candidate) => candidate.id === wallId);
  if (!wall) throw new Error(`Wall does not exist: ${wallId}`);
  const { start, end } = getWallEndpoints(document, wall);
  return Math.hypot(end.position.x - start.position.x, end.position.y - start.position.y);
}

function assertMovedVertexStaysOnHostWalls(document: VlezetDocumentV2, vertexId: string, nextPosition: Point2): void {
  for (const hostWall of document.walls) {
    if (!hostWall.junctionVertexIds.includes(vertexId)) continue;
    const { start, end } = getWallEndpoints(document, hostWall);
    if (!pointOnSegment(nextPosition, start.position, end.position, 1e-4)) {
      throw new Error("Нельзя переместить соединение за пределы несущей его стены");
    }
  }
}

export function setTopologicalWallLength(
  document: VlezetDocumentV2,
  wallId: string,
  lengthMm: number,
): VlezetDocumentV2 {
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) {
    throw new RangeError("Длина стены должна быть положительным конечным числом");
  }

  const wall = document.walls.find((candidate) => candidate.id === wallId);
  if (!wall) throw new Error(`Wall does not exist: ${wallId}`);
  const { start, end } = getWallEndpoints(document, wall);
  const dx = end.position.x - start.position.x;
  const dy = end.position.y - start.position.y;
  const currentLength = Math.hypot(dx, dy);
  if (currentLength <= GEOMETRY_EPSILON_MM) throw new RangeError("Нельзя изменить длину нулевой стены");

  const ux = dx / currentLength;
  const uy = dy / currentLength;

  for (const junctionId of wall.junctionVertexIds) {
    const junction = getVertex(document, junctionId);
    const offset = (junction.position.x - start.position.x) * ux + (junction.position.y - start.position.y) * uy;
    if (offset >= lengthMm - GEOMETRY_EPSILON_MM) {
      throw new Error("Нельзя укоротить стену дальше существующего соединения");
    }
  }

  for (const opening of document.openings) {
    if (opening.wallId === wallId && opening.offset + opening.width > lengthMm + GEOMETRY_EPSILON_MM) {
      throw new Error("Нельзя укоротить стену дальше существующего проёма");
    }
  }

  const nextPosition = {
    x: start.position.x + ux * lengthMm,
    y: start.position.y + uy * lengthMm,
  };
  assertMovedVertexStaysOnHostWalls(document, end.id, nextPosition);

  return {
    ...document,
    vertices: document.vertices.map((vertex) =>
      vertex.id === end.id ? { ...vertex, position: nextPosition } : vertex,
    ),
  };
}

export function setWallThickness(document: VlezetDocumentV2, wallId: string, thicknessMm: number): VlezetDocumentV2 {
  if (
    !Number.isFinite(thicknessMm) ||
    thicknessMm < MIN_WALL_THICKNESS_MM ||
    thicknessMm > MAX_WALL_THICKNESS_MM
  ) {
    throw new RangeError(`Толщина стены должна быть от ${MIN_WALL_THICKNESS_MM} до ${MAX_WALL_THICKNESS_MM} мм`);
  }

  const wall = document.walls.find((candidate) => candidate.id === wallId);
  if (!wall) throw new Error(`Wall does not exist: ${wallId}`);
  return replaceWall(document, { ...wall, thickness: thicknessMm });
}

export function moveVertex(document: VlezetDocumentV2, vertexId: string, position: Point2): VlezetDocumentV2 {
  assertFinitePoint(position);
  getVertex(document, vertexId);
  assertMovedVertexStaysOnHostWalls(document, vertexId, position);
  return {
    ...document,
    vertices: document.vertices.map((vertex) =>
      vertex.id === vertexId ? { ...vertex, position: { ...position } } : vertex,
    ),
  };
}
