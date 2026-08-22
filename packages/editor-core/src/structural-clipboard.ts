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
  | Readonly<{ ok: true; wallIds: readonly string[]; vertexIds: readonly string[]; openingIds: readonly string[] }>
  | Readonly<{ ok: false; reason: string }>;

const STRUCTURAL_PASTE_FALLBACK_ATTEMPTS = 8;
const STRUCTURAL_PASTE_GAP_MM = 250;

function wallReferencesVertex(wall: Wall, vertexId: string): boolean {
  return wall.startVertexId === vertexId || wall.endVertexId === vertexId || wall.junctionVertexIds.includes(vertexId);
}
function copyVertex(vertex: Vertex): Vertex { return { ...vertex, position: { ...vertex.position } }; }
function copyWall(wall: Wall): Wall { return { ...wall, junctionVertexIds: [...wall.junctionVertexIds] }; }
function copyOpening(opening: Opening): Opening { return { ...opening, ...(opening.doorSwing ? { doorSwing: { ...opening.doorSwing } } : {}) }; }
function copyRoomAnnotation(annotation: RoomAnnotation): RoomAnnotation { return { ...annotation, anchor: { ...annotation.anchor } }; }
function payloadOrigin(vertices: readonly Vertex[]): Point2 {
  if (vertices.length === 0) throw new Error("Структурный фрагмент не содержит вершин");
  return { x: Math.min(...vertices.map((v) => v.position.x)), y: Math.min(...vertices.map((v) => v.position.y)) };
}
function payloadSize(vertices: readonly Vertex[]) {
  if (vertices.length === 0) throw new Error("Структурный фрагмент не содержит вершин");
  const xs = vertices.map((v) => v.position.x), ys = vertices.map((v) => v.position.y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
function requestedWalls(document: VlezetDocument, wallIds: readonly string[]): readonly Wall[] {
  if (wallIds.length === 0) throw new Error("Для копирования выберите хотя бы одну стену");
  const requested = new Set<string>();
  for (const wallId of wallIds) {
    if (!wallId) throw new Error("Идентификатор стены не может быть пустым");
    if (requested.has(wallId)) throw new Error("Выбранный структурный фрагмент содержит дубликаты стен");
    if (!document.walls.some((wall) => wall.id === wallId)) throw new Error(`Стена не существует: ${wallId}`);
    requested.add(wallId);
  }
  return document.walls.filter((wall) => requested.has(wall.id));
}
function requireClosure(document: VlezetDocument, wallIds: readonly string[]) {
  const closure = evaluateStructuralClipboardClosure(document, wallIds);
  if (!closure.ok) throw new Error(closure.reason);
  return closure;
}

export function evaluateStructuralClipboardClosure(document: VlezetDocument, wallIds: readonly string[]): StructuralClosureResult {
  if (wallIds.length === 0) return { ok: false, reason: "Для копирования выберите хотя бы одну стену" };
  const requested = new Set<string>();
  for (const wallId of wallIds) {
    if (!wallId) return { ok: false, reason: "Идентификатор стены не может быть пустым" };
    if (requested.has(wallId)) return { ok: false, reason: "Выбранный структурный фрагмент содержит дубликаты стен" };
    if (!document.walls.some((wall) => wall.id === wallId)) return { ok: false, reason: `Стена не существует: ${wallId}` };
    requested.add(wallId);
  }
  const orderedWalls = document.walls.filter((wall) => requested.has(wall.id));
  const vertexSet = new Set<string>();
  for (const wall of orderedWalls) {
    vertexSet.add(wall.startVertexId); vertexSet.add(wall.endVertexId);
    for (const id of wall.junctionVertexIds) vertexSet.add(id);
  }
  for (const vertex of document.vertices) {
    if (!vertexSet.has(vertex.id)) continue;
    const externalWall = document.walls.find((wall) => !requested.has(wall.id) && wallReferencesVertex(wall, vertex.id));
    if (externalWall) return { ok: false, reason: `Для копирования выберите весь связанный фрагмент: вершина ${vertex.id} связана со стеной ${externalWall.id}` };
  }
  const orderedVertexIds = document.vertices.filter((v) => vertexSet.has(v.id)).map((v) => v.id);
  if (orderedVertexIds.length !== vertexSet.size) {
    const missing = [...vertexSet].find((id) => !document.vertices.some((v) => v.id === id));
    return { ok: false, reason: `Структурный фрагмент ссылается на отсутствующую вершину: ${missing ?? "неизвестная"}` };
  }
  const openingIds = document.openings.filter((o) => requested.has(o.wallId)).map((o) => o.id);
  return { ok: true, wallIds: orderedWalls.map((w) => w.id), vertexIds: orderedVertexIds, openingIds };
}

function detachedSelectedWalls(selectedWalls: readonly Wall[]): readonly Wall[] {
  return selectedWalls.map((wall) => ({ ...copyWall(wall), junctionVertexIds: wall.junctionVertexIds.filter((id) => selectedWalls.some((other) => other.id !== wall.id && wallReferencesVertex(other, id))) }));
}

export function createStructuralClipboardPayload(document: VlezetDocument, wallIds: readonly string[]): StructuralClipboardPayloadV1 {
  const walls = detachedSelectedWalls(requestedWalls(document, wallIds));
  const vertexIds = new Set<string>();
  for (const wall of walls) { vertexIds.add(wall.startVertexId); vertexIds.add(wall.endVertexId); for (const id of wall.junctionVertexIds) vertexIds.add(id); }
  const vertices = document.vertices.filter((v) => vertexIds.has(v.id)).map(copyVertex);
  if (vertices.length !== vertexIds.size) {
    const missing = [...vertexIds].find((id) => !document.vertices.some((v) => v.id === id));
    throw new Error(`Структурный фрагмент ссылается на отсутствующую вершину: ${missing ?? "неизвестная"}`);
  }
  const selectedWallIds = new Set(walls.map((w) => w.id));
  const openings = document.openings.filter((o) => selectedWallIds.has(o.wallId)).map(copyOpening);
  const origin = payloadOrigin(vertices);
  return { version: 1, kind: "structural-fragment", scope: { kind: "walls" }, origin, copiedAtOrigin: { ...origin }, vertices, walls, openings, roomAnnotations: [] };
}

function reverseDoorSwing(opening: Opening): Opening["doorSwing"] {
  if (!opening.doorSwing) return undefined;
  return { hinge: opening.doorSwing.hinge === "start" ? "end" : "start", side: opening.doorSwing.side === "left" ? "right" : "left" };
}

export function createRoomStructuralClipboardPayload(document: VlezetDocument, roomId: string): StructuralClipboardPayloadV1 {
  if (!roomId) throw new Error("Идентификатор комнаты не может быть пустым");
  const room = deriveRooms(document).rooms.find((candidate) => candidate.id === roomId);
  if (!room) throw new Error(`Комната не существует: ${roomId}`);
  const face = extractPlanarFaces(document).find((candidate) => candidate.id === room.faceId);
  if (!face) throw new Error(`Не удалось восстановить структурный контур комнаты: ${roomId}`);
  const sourceVertexIds = new Set(face.vertexIds);
  const vertices = document.vertices.filter((v) => sourceVertexIds.has(v.id)).map(copyVertex);
  if (vertices.length !== sourceVertexIds.size) throw new Error(`Контур комнаты ${roomId} ссылается на отсутствующую вершину`);
  const payloadWalls: Wall[] = [], payloadOpenings: Opening[] = [], includedOpeningIds = new Set<string>();
  for (const [index, edge] of face.edges.entries()) {
    const wallId = `room-edge:${roomId}:${index}:${edge.wallId}`;
    payloadWalls.push({ id: wallId, startVertexId: edge.startVertexId, endVertexId: edge.endVertexId, junctionVertexIds: [], thickness: edge.thickness });
    const startOffset = projectPointToWallOffset(document, edge.wallId, edge.start);
    const endOffset = projectPointToWallOffset(document, edge.wallId, edge.end);
    const low = Math.min(startOffset, endOffset), high = Math.max(startOffset, endOffset), forward = endOffset >= startOffset;
    for (const sourceOpening of document.openings.filter((o) => o.wallId === edge.wallId)) {
      const openingStart = sourceOpening.offset, openingEnd = sourceOpening.offset + sourceOpening.width;
      const overlaps = openingEnd > low + GEOMETRY_EPSILON_MM && openingStart < high - GEOMETRY_EPSILON_MM;
      if (!overlaps) continue;
      const contained = openingStart >= low - GEOMETRY_EPSILON_MM && openingEnd <= high + GEOMETRY_EPSILON_MM;
      if (!contained) throw new Error(`Проём ${sourceOpening.id} пересекает границу копируемого участка стены ${edge.wallId}`);
      if (includedOpeningIds.has(sourceOpening.id)) throw new Error(`Проём ${sourceOpening.id} неоднозначно принадлежит контуру комнаты`);
      includedOpeningIds.add(sourceOpening.id);
      const offset = forward ? openingStart - low : high - openingEnd;
      payloadOpenings.push({ ...copyOpening(sourceOpening), wallId, offset: Math.max(0, offset), ...(forward || !sourceOpening.doorSwing ? {} : { doorSwing: reverseDoorSwing(sourceOpening) }) });
    }
  }
  const roomAnnotations = room.annotationId ? document.roomAnnotations.filter((a) => a.id === room.annotationId).map(copyRoomAnnotation) : [];
  const origin = payloadOrigin(vertices);
  return { version: 1, kind: "structural-fragment", scope: { kind: "room", sourceRoomId: room.id }, origin, copiedAtOrigin: { ...origin }, vertices, walls: payloadWalls, openings: payloadOpenings, roomAnnotations };
}

function removeStructuralFragment(
  document: VlezetDocument,
  wallIds: readonly string[],
): Readonly<{ document: VlezetDocument; closure: Extract<StructuralClosureResult, { ok: true }> }> {
  const closure = requireClosure(document, wallIds);
  const wallIdSet = new Set(closure.wallIds);
  const vertexIdSet = new Set(closure.vertexIds);
  const openingIdSet = new Set(closure.openingIds);
  const candidate: VlezetDocument = {
    ...document,
    walls: document.walls.filter((w) => !wallIdSet.has(w.id)),
    vertices: document.vertices.filter((v) => !vertexIdSet.has(v.id)),
    openings: document.openings.filter((o) => !openingIdSet.has(o.id)),
  };
  const validation = validateStructuralCandidate(document, candidate, { affectedVertexIds: closure.vertexIds, affectedWallIds: closure.wallIds, preserveDirectionsForWallIds: [] });
  if (!validation.ok) throw new Error(validation.reason);
  return { document: validation.document, closure };
}

export function cutStructuralFragment(document: VlezetDocument, wallIds: readonly string[]): Readonly<{ document: VlezetDocument; payload: StructuralClipboardPayloadV1 }> {
  const removal = removeStructuralFragment(document, wallIds);
  const payload = createStructuralClipboardPayload(document, removal.closure.wallIds);
  return { document: removal.document, payload };
}

export function deleteStructuralFragment(document: VlezetDocument, wallIds: readonly string[]): VlezetDocument {
  return removeStructuralFragment(document, wallIds).document;
}

function freshId(documentIds: ReadonlySet<string>, generatedIds: Set<string>, idFactory: () => string, kind: string): string {
  const id = idFactory();
  if (!id || documentIds.has(id) || generatedIds.has(id)) throw new Error(`Не удалось создать уникальный идентификатор ${kind}`);
  generatedIds.add(id); return id;
}

export function pasteStructuralFragment(
  document: VlezetDocument,
  payload: StructuralClipboardPayloadV1,
  anchor: Point2,
  idFactory: (kind: "vertex" | "wall" | "opening" | "room-annotation") => string,
): Readonly<{ document: VlezetDocument; wallIds: readonly string[]; vertexIds: readonly string[]; openingIds: readonly string[]; roomAnnotationIds: readonly string[]; appliedDelta: Point2 }> {
  if (payload.version !== 1 || payload.kind !== "structural-fragment") throw new Error("Неподдерживаемая версия структурного буфера обмена");
  if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) throw new RangeError("Точка вставки должна содержать конечные координаты");
  if (!Number.isFinite(payload.origin.x) || !Number.isFinite(payload.origin.y)) throw new RangeError("Структурный буфер содержит некорректную точку отсчёта");
  const annotations = payload.roomAnnotations ?? [];
  const existingIds = new Set([...document.vertices.map((v) => v.id), ...document.walls.map((w) => w.id), ...document.openings.map((o) => o.id), ...document.roomAnnotations.map((a) => a.id)]);
  const generatedIds = new Set<string>(), vertexMap = new Map<string, string>(), wallMap = new Map<string, string>(), openingMap = new Map<string, string>(), annotationMap = new Map<string, string>();
  for (const vertex of payload.vertices) { if (vertexMap.has(vertex.id)) throw new Error(`Структурный буфер содержит дубликат вершины: ${vertex.id}`); vertexMap.set(vertex.id, freshId(existingIds, generatedIds, () => idFactory("vertex"), "вершины")); }
  for (const wall of payload.walls) { if (wallMap.has(wall.id)) throw new Error(`Структурный буфер содержит дубликат стены: ${wall.id}`); wallMap.set(wall.id, freshId(existingIds, generatedIds, () => idFactory("wall"), "стены")); }
  for (const opening of payload.openings) { if (openingMap.has(opening.id)) throw new Error(`Структурный буфер содержит дубликат проёма: ${opening.id}`); openingMap.set(opening.id, freshId(existingIds, generatedIds, () => idFactory("opening"), "проёма")); }
  for (const annotation of annotations) { if (annotationMap.has(annotation.id)) throw new Error(`Структурный буфер содержит дубликат названия комнаты: ${annotation.id}`); annotationMap.set(annotation.id, freshId(existingIds, generatedIds, () => idFactory("room-annotation"), "названия комнаты")); }
  const delta = { x: anchor.x - payload.origin.x, y: anchor.y - payload.origin.y };
  const pastedVertices: Vertex[] = payload.vertices.map((v) => ({ ...copyVertex(v), id: vertexMap.get(v.id)!, position: { x: v.position.x + delta.x, y: v.position.y + delta.y } }));
  const pastedWalls: Wall[] = payload.walls.map((wall) => {
    const startVertexId = vertexMap.get(wall.startVertexId), endVertexId = vertexMap.get(wall.endVertexId), junctionVertexIds = wall.junctionVertexIds.map((id) => vertexMap.get(id));
    if (!startVertexId || !endVertexId || junctionVertexIds.some((id) => !id)) throw new Error(`Структурный буфер стены ${wall.id} содержит внешнюю ссылку на вершину`);
    return { ...copyWall(wall), id: wallMap.get(wall.id)!, startVertexId, endVertexId, junctionVertexIds: junctionVertexIds as string[] };
  });
  const pastedOpenings: Opening[] = payload.openings.map((opening) => { const wallId = wallMap.get(opening.wallId); if (!wallId) throw new Error(`Структурный буфер проёма ${opening.id} ссылается на внешнюю стену`); return { ...copyOpening(opening), id: openingMap.get(opening.id)!, wallId }; });
  const pastedAnnotations: RoomAnnotation[] = annotations.map((annotation) => {
    if (!Number.isFinite(annotation.anchor.x) || !Number.isFinite(annotation.anchor.y)) throw new Error(`Структурный буфер названия комнаты ${annotation.id} содержит некорректную точку`);
    return { ...copyRoomAnnotation(annotation), id: annotationMap.get(annotation.id)!, anchor: { x: annotation.anchor.x + delta.x, y: annotation.anchor.y + delta.y } };
  });
  const vertexIds = pastedVertices.map((v) => v.id), wallIds = pastedWalls.map((w) => w.id), openingIds = pastedOpenings.map((o) => o.id), roomAnnotationIds = pastedAnnotations.map((a) => a.id);
  const validateAtAdditionalDelta = (additionalDelta: Point2) => {
    const candidateVertices = pastedVertices.map((v) => ({ ...v, position: { x: v.position.x + additionalDelta.x, y: v.position.y + additionalDelta.y } }));
    const candidateAnnotations = pastedAnnotations.map((a) => ({ ...a, anchor: { x: a.anchor.x + additionalDelta.x, y: a.anchor.y + additionalDelta.y } }));
    const candidate: VlezetDocument = { ...document, vertices: [...document.vertices, ...candidateVertices], walls: [...document.walls, ...pastedWalls], openings: [...document.openings, ...pastedOpenings], roomAnnotations: [...document.roomAnnotations, ...candidateAnnotations] };
    return validateStructuralCandidate(document, candidate, { affectedVertexIds: vertexIds, affectedWallIds: wallIds, preserveDirectionsForWallIds: [] });
  };
  let appliedAdditionalDelta: Point2 = { x: 0, y: 0 };
  let validation = validateAtAdditionalDelta(appliedAdditionalDelta);
  const requestedAnchorDiffersFromOrigin = anchor.x !== payload.origin.x || anchor.y !== payload.origin.y;
  const allowsSafeFallback = payload.scope?.kind === "room" || (payload.scope?.kind === "walls" && requestedAnchorDiffersFromOrigin);
  if (!validation.ok && allowsSafeFallback) {
    const size = payloadSize(payload.vertices), strideX = Math.max(size.width, STRUCTURAL_PASTE_GAP_MM) + STRUCTURAL_PASTE_GAP_MM, strideY = Math.max(size.height, STRUCTURAL_PASTE_GAP_MM) + STRUCTURAL_PASTE_GAP_MM;
    let found = false;
    for (let step = 1; step <= STRUCTURAL_PASTE_FALLBACK_ATTEMPTS && !found; step += 1) {
      const fallbackAnchors: Point2[] = [
        { x: payload.origin.x + strideX * step, y: payload.origin.y },
        { x: payload.origin.x, y: payload.origin.y + strideY * step },
        { x: payload.origin.x + strideX * step, y: payload.origin.y + strideY * step },
      ];
      for (const fallbackAnchor of fallbackAnchors) {
        const additionalDelta = { x: fallbackAnchor.x - anchor.x, y: fallbackAnchor.y - anchor.y };
        const fallbackValidation = validateAtAdditionalDelta(additionalDelta);
        if (!fallbackValidation.ok) continue;
        validation = fallbackValidation; appliedAdditionalDelta = additionalDelta; found = true; break;
      }
    }
  }
  if (!validation.ok) throw new Error(validation.reason);
  return { document: validation.document, vertexIds, wallIds, openingIds, roomAnnotationIds, appliedDelta: { x: delta.x + appliedAdditionalDelta.x, y: delta.y + appliedAdditionalDelta.y } };
}