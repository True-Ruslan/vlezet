import type {
  Opening,
  Point2,
  RoomAnnotation,
  Vertex,
  VlezetDocument,
  Wall,
} from "@vlezet/domain";
import {
  deriveRooms,
  extractPlanarFaces,
  GEOMETRY_EPSILON_MM,
  projectPointToWallOffset,
} from "@vlezet/geometry";
import { validateStructuralCandidate } from "./structural-editing";

export type StructuralClipboardScope =
  | Readonly<{ kind: "walls" }>
  | Readonly<{ kind: "room"; sourceRoomId: string }>;

export type StructuralClipboardPayloadV1 = Readonly<{
  version: 1;
  kind: "structural-fragment";
  origin: Point2;
  copiedAtOrigin: Point2;
  vertices: readonly Vertex[];
  walls: readonly Wall[];
  openings: readonly Opening[];
  scope?: StructuralClipboardScope;
  roomAnnotations?: readonly RoomAnnotation[];
}>;

export type StructuralClosureResult =
  | Readonly<{
      ok: true;
      wallIds: readonly string[];
      vertexIds: readonly string[];
      openingIds: readonly string[];
    }>
  | Readonly<{
      ok: false;
      reason: string;
    }>;

function wallReferencesVertex(wall: Wall, vertexId: string): boolean {
  return wall.startVertexId === vertexId ||
    wall.endVertexId === vertexId ||
    wall.junctionVertexIds.includes(vertexId);
}

function copyVertex(vertex: Vertex): Vertex {
  return { ...vertex, position: { ...vertex.position } };
}

function copyWall(wall: Wall): Wall {
  return { ...wall, junctionVertexIds: [...wall.junctionVertexIds] };
}

function copyOpening(opening: Opening): Opening {
  return {
    ...opening,
    ...(opening.doorSwing ? { doorSwing: { ...opening.doorSwing } } : {}),
  };
}

function copyRoomAnnotation(annotation: RoomAnnotation): RoomAnnotation {
  return { ...annotation, anchor: { ...annotation.anchor } };
}

function payloadOrigin(vertices: readonly Vertex[]): Point2 {
  if (vertices.length === 0) throw new Error("Структурный фрагмент не содержит вершин");
  return {
    x: Math.min(...vertices.map((vertex) => vertex.position.x)),
    y: Math.min(...vertices.map((vertex) => vertex.position.y)),
  };
}

function requestedWalls(
  document: VlezetDocument,
  wallIds: readonly string[],
): readonly Wall[] {
  if (wallIds.length === 0) throw new Error("Для копирования выберите хотя бы одну стену");

  const requested = new Set<string>();
  for (const wallId of wallIds) {
    if (!wallId) throw new Error("Идентификатор стены не может быть пустым");
    if (requested.has(wallId)) {
      throw new Error("Выбранный структурный фрагмент содержит дубликаты стен");
    }
    if (!document.walls.some((wall) => wall.id === wallId)) {
      throw new Error(`Стена не существует: ${wallId}`);
    }
    requested.add(wallId);
  }
  return document.walls.filter((wall) => requested.has(wall.id));
}

function requireClosure(document: VlezetDocument, wallIds: readonly string[]) {
  const closure = evaluateStructuralClipboardClosure(document, wallIds);
  if (!closure.ok) throw new Error(closure.reason);
  return closure;
}

export function evaluateStructuralClipboardClosure(
  document: VlezetDocument,
  wallIds: readonly string[],
): StructuralClosureResult {
  if (wallIds.length === 0) {
    return { ok: false, reason: "Для копирования выберите хотя бы одну стену" };
  }

  const requested = new Set<string>();
  for (const wallId of wallIds) {
    if (!wallId) return { ok: false, reason: "Идентификатор стены не может быть пустым" };
    if (requested.has(wallId)) {
      return { ok: false, reason: "Выбранный структурный фрагмент содержит дубликаты стен" };
    }
    if (!document.walls.some((wall) => wall.id === wallId)) {
      return { ok: false, reason: `Стена не существует: ${wallId}` };
    }
    requested.add(wallId);
  }

  const orderedWalls = document.walls.filter((wall) => requested.has(wall.id));
  const vertexSet = new Set<string>();
  for (const wall of orderedWalls) {
    vertexSet.add(wall.startVertexId);
    vertexSet.add(wall.endVertexId);
    for (const junctionVertexId of wall.junctionVertexIds) vertexSet.add(junctionVertexId);
  }

  for (const vertex of document.vertices) {
    if (!vertexSet.has(vertex.id)) continue;
    const externalWall = document.walls.find((wall) =>
      !requested.has(wall.id) && wallReferencesVertex(wall, vertex.id));
    if (externalWall) {
      return {
        ok: false,
        reason: `Для копирования выберите весь связанный фрагмент: вершина ${vertex.id} связана со стеной ${externalWall.id}`,
      };
    }
  }

  const orderedVertexIds = document.vertices
    .filter((vertex) => vertexSet.has(vertex.id))
    .map((vertex) => vertex.id);
  if (orderedVertexIds.length !== vertexSet.size) {
    const missing = [...vertexSet].find((vertexId) => !document.vertices.some((vertex) => vertex.id === vertexId));
    return { ok: false, reason: `Структурный фрагмент ссылается на отсутствующую вершину: ${missing ?? "неизвестная"}` };
  }

  const openingIds = document.openings
    .filter((opening) => requested.has(opening.wallId))
    .map((opening) => opening.id);

  return {
    ok: true,
    wallIds: orderedWalls.map((wall) => wall.id),
    vertexIds: orderedVertexIds,
    openingIds,
  };
}

function detachedSelectedWalls(
  document: VlezetDocument,
  selectedWalls: readonly Wall[],
): readonly Wall[] {
  return selectedWalls.map((wall) => ({
    ...copyWall(wall),
    junctionVertexIds: wall.junctionVertexIds.filter((junctionVertexId) =>
      selectedWalls.some((other) =>
        other.id !== wall.id && wallReferencesVertex(other, junctionVertexId)),
    ),
  }));
}

export function createStructuralClipboardPayload(
  document: VlezetDocument,
  wallIds: readonly string[],
): StructuralClipboardPayloadV1 {
  const selectedWalls = requestedWalls(document, wallIds);
  const walls = detachedSelectedWalls(document, selectedWalls);
  const vertexIds = new Set<string>();
  for (const wall of walls) {
    vertexIds.add(wall.startVertexId);
    vertexIds.add(wall.endVertexId);
    for (const junctionVertexId of wall.junctionVertexIds) vertexIds.add(junctionVertexId);
  }
  const vertices = document.vertices.filter((vertex) => vertexIds.has(vertex.id)).map(copyVertex);
  if (vertices.length !== vertexIds.size) {
    const missing = [...vertexIds].find((vertexId) => !document.vertices.some((vertex) => vertex.id === vertexId));
    throw new Error(`Структурный фрагмент ссылается на отсутствующую вершину: ${missing ?? "неизвестная"}`);
  }
  const selectedWallIds = new Set(walls.map((wall) => wall.id));
  const openings = document.openings
    .filter((opening) => selectedWallIds.has(opening.wallId))
    .map(copyOpening);
  const origin = payloadOrigin(vertices);

  return {
    version: 1,
    kind: "structural-fragment",
    scope: { kind: "walls" },
    origin,
    copiedAtOrigin: { ...origin },
    vertices,
    walls,
    openings,
    roomAnnotations: [],
  };
}

function reverseDoorSwing(opening: Opening): Opening["doorSwing"] {
  if (!opening.doorSwing) return undefined;
  return {
    hinge: opening.doorSwing.hinge === "start" ? "end" : "start",
    side: opening.doorSwing.side === "left" ? "right" : "left",
  };
}

export function createRoomStructuralClipboardPayload(
  document: VlezetDocument,
  roomId: string,
): StructuralClipboardPayloadV1 {
  if (!roomId) throw new Error("Идентификатор комнаты не может быть пустым");
  const room = deriveRooms(document).rooms.find((candidate) => candidate.id === roomId);
  if (!room) throw new Error(`Комната не существует: ${roomId}`);
  const face = extractPlanarFaces(document).find((candidate) => candidate.id === room.faceId);
  if (!face) throw new Error(`Не удалось восстановить структурный контур комнаты: ${roomId}`);

  const sourceVertexIds = new Set(face.vertexIds);
  const vertices = document.vertices
    .filter((vertex) => sourceVertexIds.has(vertex.id))
    .map(copyVertex);
  if (vertices.length !== sourceVertexIds.size) {
    throw new Error(`Контур комнаты ${roomId} ссылается на отсутствующую вершину`);
  }

  const payloadWalls: Wall[] = [];
  const payloadOpenings: Opening[] = [];
  const includedOpeningIds = new Set<string>();

  for (const [index, edge] of face.edges.entries()) {
    const wallId = `room-edge:${roomId}:${index}:${edge.wallId}`;
    payloadWalls.push({
      id: wallId,
      startVertexId: edge.startVertexId,
      endVertexId: edge.endVertexId,
      junctionVertexIds: [],
      thickness: edge.thickness,
    });

    const startOffset = projectPointToWallOffset(document, edge.wallId, edge.start);
    const endOffset = projectPointToWallOffset(document, edge.wallId, edge.end);
    const low = Math.min(startOffset, endOffset);
    const high = Math.max(startOffset, endOffset);
    const forward = endOffset >= startOffset;

    for (const sourceOpening of document.openings.filter((opening) => opening.wallId === edge.wallId)) {
      const openingStart = sourceOpening.offset;
      const openingEnd = sourceOpening.offset + sourceOpening.width;
      const overlaps = openingEnd > low + GEOMETRY_EPSILON_MM &&
        openingStart < high - GEOMETRY_EPSILON_MM;
      if (!overlaps) continue;

      const contained = openingStart >= low - GEOMETRY_EPSILON_MM &&
        openingEnd <= high + GEOMETRY_EPSILON_MM;
      if (!contained) {
        throw new Error(`Проём ${sourceOpening.id} пересекает границу копируемого участка стены ${edge.wallId}`);
      }
      if (includedOpeningIds.has(sourceOpening.id)) {
        throw new Error(`Проём ${sourceOpening.id} неоднозначно принадлежит контуру комнаты`);
      }
      includedOpeningIds.add(sourceOpening.id);

      const offset = forward
        ? openingStart - low
        : high - openingEnd;
      payloadOpenings.push({
        ...copyOpening(sourceOpening),
        wallId,
        offset: Math.max(0, offset),
        ...(forward || !sourceOpening.doorSwing
          ? {}
          : { doorSwing: reverseDoorSwing(sourceOpening) }),
      });
    }
  }

  const roomAnnotations = room.annotationId
    ? document.roomAnnotations
      .filter((annotation) => annotation.id === room.annotationId)
      .map(copyRoomAnnotation)
    : [];
  const origin = payloadOrigin(vertices);

  return {
    version: 1,
    kind: "structural-fragment",
    scope: { kind: "room", sourceRoomId: room.id },
    origin,
    copiedAtOrigin: { ...origin },
    vertices,
    walls: payloadWalls,
    openings: payloadOpenings,
    roomAnnotations,
  };
}

export function cutStructuralFragment(
  document: VlezetDocument,
  wallIds: readonly string[],
): Readonly<{ document: VlezetDocument; payload: StructuralClipboardPayloadV1 }> {
  const closure = requireClosure(document, wallIds);
  const payload = createStructuralClipboardPayload(document, closure.wallIds);
  const removedWallIds = new Set(closure.wallIds);
  const removedVertexIds = new Set(closure.vertexIds);
  const removedOpeningIds = new Set(closure.openingIds);
  const candidate: VlezetDocument = {
    ...document,
    walls: document.walls.filter((wall) => !removedWallIds.has(wall.id)),
    vertices: document.vertices.filter((vertex) => !removedVertexIds.has(vertex.id)),
    openings: document.openings.filter((opening) => !removedOpeningIds.has(opening.id)),
  };

  const validation = validateStructuralCandidate(document, candidate, {
    affectedVertexIds: closure.vertexIds,
    affectedWallIds: closure.wallIds,
    preserveDirectionsForWallIds: [],
  });
  if (!validation.ok) throw new Error(validation.reason);
  return { document: validation.document, payload };
}

function freshId(
  documentIds: ReadonlySet<string>,
  generatedIds: Set<string>,
  idFactory: () => string,
  kind: string,
): string {
  const id = idFactory();
  if (!id || documentIds.has(id) || generatedIds.has(id)) {
    throw new Error(`Не удалось создать уникальный идентификатор ${kind}`);
  }
  generatedIds.add(id);
  return id;
}

export function pasteStructuralFragment(
  document: VlezetDocument,
  payload: StructuralClipboardPayloadV1,
  anchor: Point2,
  idFactory: (kind: "vertex" | "wall" | "opening" | "room-annotation") => string,
): Readonly<{
  document: VlezetDocument;
  wallIds: readonly string[];
  vertexIds: readonly string[];
  openingIds: readonly string[];
  roomAnnotationIds: readonly string[];
}> {
  if (payload.version !== 1 || payload.kind !== "structural-fragment") {
    throw new Error("Неподдерживаемая версия структурного буфера обмена");
  }
  if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    throw new RangeError("Точка вставки должна содержать конечные координаты");
  }
  if (!Number.isFinite(payload.origin.x) || !Number.isFinite(payload.origin.y)) {
    throw new RangeError("Структурный буфер содержит некорректную точку отсчёта");
  }

  const annotations = payload.roomAnnotations ?? [];
  const existingIds = new Set([
    ...document.vertices.map((vertex) => vertex.id),
    ...document.walls.map((wall) => wall.id),
    ...document.openings.map((opening) => opening.id),
    ...document.roomAnnotations.map((annotation) => annotation.id),
  ]);
  const generatedIds = new Set<string>();
  const vertexMap = new Map<string, string>();
  const wallMap = new Map<string, string>();
  const openingMap = new Map<string, string>();
  const annotationMap = new Map<string, string>();

  for (const vertex of payload.vertices) {
    if (vertexMap.has(vertex.id)) throw new Error(`Структурный буфер содержит дубликат вершины: ${vertex.id}`);
    vertexMap.set(vertex.id, freshId(existingIds, generatedIds, () => idFactory("vertex"), "вершины"));
  }
  for (const wall of payload.walls) {
    if (wallMap.has(wall.id)) throw new Error(`Структурный буфер содержит дубликат стены: ${wall.id}`);
    wallMap.set(wall.id, freshId(existingIds, generatedIds, () => idFactory("wall"), "стены"));
  }
  for (const opening of payload.openings) {
    if (openingMap.has(opening.id)) throw new Error(`Структурный буфер содержит дубликат проёма: ${opening.id}`);
    openingMap.set(opening.id, freshId(existingIds, generatedIds, () => idFactory("opening"), "проёма"));
  }
  for (const annotation of annotations) {
    if (annotationMap.has(annotation.id)) {
      throw new Error(`Структурный буфер содержит дубликат названия комнаты: ${annotation.id}`);
    }
    annotationMap.set(
      annotation.id,
      freshId(existingIds, generatedIds, () => idFactory("room-annotation"), "названия комнаты"),
    );
  }

  const delta = {
    x: anchor.x - payload.origin.x,
    y: anchor.y - payload.origin.y,
  };
  const pastedVertices: Vertex[] = payload.vertices.map((vertex) => ({
    ...copyVertex(vertex),
    id: vertexMap.get(vertex.id)!,
    position: {
      x: vertex.position.x + delta.x,
      y: vertex.position.y + delta.y,
    },
  }));
  const pastedWalls: Wall[] = payload.walls.map((wall) => {
    const startVertexId = vertexMap.get(wall.startVertexId);
    const endVertexId = vertexMap.get(wall.endVertexId);
    const junctionVertexIds = wall.junctionVertexIds.map((vertexId) => vertexMap.get(vertexId));
    if (!startVertexId || !endVertexId || junctionVertexIds.some((vertexId) => !vertexId)) {
      throw new Error(`Структурный буфер стены ${wall.id} содержит внешнюю ссылку на вершину`);
    }
    return {
      ...copyWall(wall),
      id: wallMap.get(wall.id)!,
      startVertexId,
      endVertexId,
      junctionVertexIds: junctionVertexIds as string[],
    };
  });
  const pastedOpenings: Opening[] = payload.openings.map((opening) => {
    const wallId = wallMap.get(opening.wallId);
    if (!wallId) throw new Error(`Структурный буфер проёма ${opening.id} ссылается на внешнюю стену`);
    return {
      ...copyOpening(opening),
      id: openingMap.get(opening.id)!,
      wallId,
    };
  });
  const pastedAnnotations: RoomAnnotation[] = annotations.map((annotation) => {
    if (!Number.isFinite(annotation.anchor.x) || !Number.isFinite(annotation.anchor.y)) {
      throw new Error(`Структурный буфер названия комнаты ${annotation.id} содержит некорректную точку`);
    }
    return {
      ...copyRoomAnnotation(annotation),
      id: annotationMap.get(annotation.id)!,
      anchor: {
        x: annotation.anchor.x + delta.x,
        y: annotation.anchor.y + delta.y,
      },
    };
  });

  const candidate: VlezetDocument = {
    ...document,
    vertices: [...document.vertices, ...pastedVertices],
    walls: [...document.walls, ...pastedWalls],
    openings: [...document.openings, ...pastedOpenings],
    roomAnnotations: [...document.roomAnnotations, ...pastedAnnotations],
  };
  const vertexIds = pastedVertices.map((vertex) => vertex.id);
  const wallIds = pastedWalls.map((wall) => wall.id);
  const openingIds = pastedOpenings.map((opening) => opening.id);
  const roomAnnotationIds = pastedAnnotations.map((annotation) => annotation.id);
  const validation = validateStructuralCandidate(document, candidate, {
    affectedVertexIds: vertexIds,
    affectedWallIds: wallIds,
    preserveDirectionsForWallIds: [],
  });
  if (!validation.ok) throw new Error(validation.reason);

  return {
    document: validation.document,
    vertexIds,
    wallIds,
    openingIds,
    roomAnnotationIds,
  };
}
