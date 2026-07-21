import { validateTopology, type TopologyDiagnostic } from "./diagnostics";
import { extractPlanarFaces, type FaceBoundaryEdge, type PlanarFace } from "./faces";
import type { Point2 } from "./point";
import { findInteriorPoint, pointInPolygon, polygonSelfIntersects, signedPolygonArea } from "./polygon";
import { GEOMETRY_EPSILON_MM } from "./segment";
import type { TopologyDocumentLike } from "./topology";

export type RoomAnnotationLike = Readonly<{
  id: string;
  name: string;
  anchor: Point2;
}>;

export type RoomDocumentLike = TopologyDocumentLike & Readonly<{
  roomAnnotations: readonly RoomAnnotationLike[];
}>;

export type RoomGeometryDiagnostic = Readonly<{
  code: "collapsed-room" | "self-intersecting-room" | "orphan-room-annotation";
  severity: "error" | "warning";
  message: string;
  roomId?: string;
  annotationId?: string;
  wallIds: readonly string[];
  vertexIds: readonly string[];
  point?: Point2;
}>;

export type DerivedRoomDiagnostic = TopologyDiagnostic | RoomGeometryDiagnostic;

export type DerivedRoom = Readonly<{
  id: string;
  faceId: string;
  polygon: readonly Point2[];
  areaMm2: number;
  areaM2: number;
  labelPoint: Point2;
  annotationId?: string;
  name: string;
}>;

export type DerivedRoomsResult = Readonly<{
  rooms: readonly DerivedRoom[];
  diagnostics: readonly DerivedRoomDiagnostic[];
}>;

type OffsetLine = Readonly<{ start: Point2; end: Point2; source: FaceBoundaryEdge }>;

function offsetBoundaryEdge(edge: FaceBoundaryEdge): OffsetLine | null {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= GEOMETRY_EPSILON_MM) return null;
  const distance = edge.thickness / 2;
  const nx = -dy / length;
  const ny = dx / length;
  return {
    start: { x: edge.start.x + nx * distance, y: edge.start.y + ny * distance },
    end: { x: edge.end.x + nx * distance, y: edge.end.y + ny * distance },
    source: edge,
  };
}

function infiniteLineIntersection(first: OffsetLine, second: OffsetLine): Point2 | null {
  const rx = first.end.x - first.start.x;
  const ry = first.end.y - first.start.y;
  const sx = second.end.x - second.start.x;
  const sy = second.end.y - second.start.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) <= GEOMETRY_EPSILON_MM) {
    return {
      x: (first.end.x + second.start.x) / 2,
      y: (first.end.y + second.start.y) / 2,
    };
  }
  const qpx = second.start.x - first.start.x;
  const qpy = second.start.y - first.start.y;
  const t = (qpx * sy - qpy * sx) / denominator;
  return { x: first.start.x + rx * t, y: first.start.y + ry * t };
}

function usablePolygon(face: PlanarFace): readonly Point2[] | null {
  const lines = face.edges.map(offsetBoundaryEdge);
  if (lines.some((line) => !line)) return null;
  const validLines = lines as OffsetLine[];
  const polygon: Point2[] = [];
  for (let index = 0; index < validLines.length; index += 1) {
    const previous = validLines[(index - 1 + validLines.length) % validLines.length]!;
    const current = validLines[index]!;
    const point = infiniteLineIntersection(previous, current);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    polygon.push(point);
  }
  return polygon;
}

export function deriveRooms(document: RoomDocumentLike): DerivedRoomsResult {
  const topologyDiagnostics = validateTopology(document);
  if (topologyDiagnostics.some((item) => item.severity === "error")) {
    return { rooms: [], diagnostics: topologyDiagnostics };
  }

  const diagnostics: DerivedRoomDiagnostic[] = [...topologyDiagnostics];
  const rawRooms: Array<Omit<DerivedRoom, "name" | "annotationId">> = [];

  for (const face of extractPlanarFaces(document)) {
    const polygon = usablePolygon(face);
    if (!polygon || polygon.length < 3) {
      diagnostics.push({
        code: "collapsed-room",
        severity: "error",
        message: "Внутренний контур комнаты схлопнулся из-за геометрии стен",
        roomId: face.id,
        wallIds: [...new Set(face.edges.map((edge) => edge.wallId))],
        vertexIds: face.vertexIds,
      });
      continue;
    }

    if (polygonSelfIntersects(polygon)) {
      diagnostics.push({
        code: "self-intersecting-room",
        severity: "error",
        message: "Внутренний контур комнаты пересекает сам себя",
        roomId: face.id,
        wallIds: [...new Set(face.edges.map((edge) => edge.wallId))],
        vertexIds: face.vertexIds,
      });
      continue;
    }

    const areaMm2 = signedPolygonArea(polygon);
    if (!Number.isFinite(areaMm2) || areaMm2 <= GEOMETRY_EPSILON_MM) {
      diagnostics.push({
        code: "collapsed-room",
        severity: "error",
        message: "Полезная площадь комнаты равна нулю или некорректна",
        roomId: face.id,
        wallIds: [...new Set(face.edges.map((edge) => edge.wallId))],
        vertexIds: face.vertexIds,
      });
      continue;
    }

    rawRooms.push({
      id: face.id,
      faceId: face.id,
      polygon,
      areaMm2,
      areaM2: areaMm2 / 1_000_000,
      labelPoint: findInteriorPoint(polygon),
    });
  }

  rawRooms.sort((a, b) => a.id.localeCompare(b.id));
  const assignedAnnotationIds = new Set<string>();
  const rooms: DerivedRoom[] = rawRooms.map((room, index) => {
    const annotation = document.roomAnnotations.find(
      (candidate) => !assignedAnnotationIds.has(candidate.id) && pointInPolygon(candidate.anchor, room.polygon),
    );
    if (annotation) assignedAnnotationIds.add(annotation.id);
    return {
      ...room,
      ...(annotation ? { annotationId: annotation.id } : {}),
      name: annotation?.name || `Комната ${index + 1}`,
    };
  });

  for (const annotation of document.roomAnnotations) {
    if (assignedAnnotationIds.has(annotation.id)) continue;
    diagnostics.push({
      code: "orphan-room-annotation",
      severity: "warning",
      message: `Название «${annotation.name}» больше не привязано к существующей комнате`,
      annotationId: annotation.id,
      wallIds: [],
      vertexIds: [],
      point: annotation.anchor,
    });
  }

  return { rooms, diagnostics };
}
