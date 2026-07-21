import { openingSegment, type OpeningDocumentLike, type OpeningLike } from "./openings";
import {
  expandedOrientedRectangle,
  orientedRectangleCorners,
  orientedRectangleEdges,
  orientedRectanglesIntersect,
  pointInOrientedRectangle,
  worldToLocal,
  type OrientedRectangle,
  type RectangleMargins,
} from "./oriented-rectangle";
import type { Point2 } from "./point";
import { pointInPolygon } from "./polygon";
import { deriveRooms, type DerivedRoom, type RoomDocumentLike } from "./rooms";
import { GEOMETRY_EPSILON_MM, pointOnSegment, segmentIntersection } from "./segment";

export type FitPlacedObjectLike = Readonly<{
  id: string;
  name: string;
  position: Point2;
  width: number;
  depth: number;
  rotationDeg: number;
  clearance: RectangleMargins;
}>;

export type FitDoorSwingLike = Readonly<{
  hinge: "start" | "end";
  side: "left" | "right";
}>;

export type FitOpeningLike = OpeningLike & Readonly<{
  doorSwing?: FitDoorSwingLike;
}>;

export type FitDocumentLike = RoomDocumentLike & OpeningDocumentLike & Readonly<{
  openings: readonly FitOpeningLike[];
  placedObjects: readonly FitPlacedObjectLike[];
}>;

export type FitStatus = "fits" | "tight" | "blocked";

export type FitDiagnosticCode =
  | "plan-invalid"
  | "outside-room"
  | "object-collision"
  | "door-obstructed"
  | "clearance-wall"
  | "clearance-object"
  | "clearance-door";

export type FitDiagnostic = Readonly<{
  code: FitDiagnosticCode;
  severity: "collision" | "recommendation";
  objectId: string;
  relatedObjectId?: string;
  relatedOpeningId?: string;
  message: string;
}>;

export type ObjectFitResult = Readonly<{
  objectId: string;
  status: FitStatus;
  roomId?: string;
  diagnostics: readonly FitDiagnostic[];
}>;

export type FitEvaluation = Readonly<{
  byObjectId: ReadonlyMap<string, ObjectFitResult>;
  planValid: boolean;
}>;

export function objectRectangle(object: FitPlacedObjectLike): OrientedRectangle {
  return {
    center: { ...object.position },
    width: object.width,
    depth: object.depth,
    rotationDeg: object.rotationDeg,
  };
}

function polygonEdges(polygon: readonly Point2[]): readonly Readonly<{ start: Point2; end: Point2 }>[] {
  return polygon.map((start, index) => ({ start, end: polygon[(index + 1) % polygon.length]! }));
}

function pointOnPolygonBoundary(point: Point2, polygon: readonly Point2[]): boolean {
  return polygonEdges(polygon).some((edge) => pointOnSegment(point, edge.start, edge.end));
}

function pointStrictlyInPolygon(point: Point2, polygon: readonly Point2[]): boolean {
  return pointInPolygon(point, polygon) && !pointOnPolygonBoundary(point, polygon);
}

function polygonsStrictlyOverlap(first: readonly Point2[], second: readonly Point2[]): boolean {
  for (const firstEdge of polygonEdges(first)) {
    for (const secondEdge of polygonEdges(second)) {
      const intersection = segmentIntersection(firstEdge.start, firstEdge.end, secondEdge.start, secondEdge.end);
      if (!intersection) continue;
      if (
        intersection.t > GEOMETRY_EPSILON_MM &&
        intersection.t < 1 - GEOMETRY_EPSILON_MM &&
        intersection.u > GEOMETRY_EPSILON_MM &&
        intersection.u < 1 - GEOMETRY_EPSILON_MM
      ) {
        return true;
      }
    }
  }
  return first.some((point) => pointStrictlyInPolygon(point, second)) ||
    second.some((point) => pointStrictlyInPolygon(point, first));
}

function pointStrictlyInRectangle(point: Point2, rectangle: OrientedRectangle): boolean {
  const local = worldToLocal(rectangle, point);
  return Math.abs(local.x) < rectangle.width / 2 - GEOMETRY_EPSILON_MM &&
    Math.abs(local.y) < rectangle.depth / 2 - GEOMETRY_EPSILON_MM;
}

function rectangleInsideRoom(rectangle: OrientedRectangle, room: DerivedRoom): boolean {
  const corners = orientedRectangleCorners(rectangle);
  if (!corners.every((corner) => pointInPolygon(corner, room.polygon))) return false;

  for (const edge of orientedRectangleEdges(rectangle)) {
    for (const boundary of polygonEdges(room.polygon)) {
      const intersection = segmentIntersection(edge.start, edge.end, boundary.start, boundary.end);
      if (!intersection) continue;
      if (intersection.t > GEOMETRY_EPSILON_MM && intersection.t < 1 - GEOMETRY_EPSILON_MM) return false;
    }
  }

  if (room.polygon.some((point) => pointStrictlyInRectangle(point, rectangle))) return false;
  return true;
}

function containingRoom(rectangle: OrientedRectangle, rooms: readonly DerivedRoom[]): DerivedRoom | undefined {
  return rooms.find((room) => rectangleInsideRoom(rectangle, room));
}

function arcPoints(
  hinge: Point2,
  closedDirection: Point2,
  openDirection: Point2,
  radius: number,
): Point2[] {
  const start = Math.atan2(closedDirection.y, closedDirection.x);
  const end = Math.atan2(openDirection.y, openDirection.x);
  let delta = end - start;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Array.from({ length: 17 }, (_, index) => {
    const angle = start + delta * (index / 16);
    return {
      x: hinge.x + Math.cos(angle) * radius,
      y: hinge.y + Math.sin(angle) * radius,
    };
  });
}

export function doorSwingPolygon(document: FitDocumentLike, opening: FitOpeningLike): readonly Point2[] {
  if (opening.kind !== "door") return [];
  const segment = openingSegment(document, opening);
  const hingeAtStart = opening.doorSwing?.hinge !== "end";
  const hinge = hingeAtStart ? segment.start : segment.end;
  const closedDirection = hingeAtStart
    ? segment.tangent
    : { x: -segment.tangent.x, y: -segment.tangent.y };
  const sideSign = opening.doorSwing?.side === "right" ? -1 : 1;
  const openDirection = {
    x: segment.leftNormal.x * sideSign,
    y: segment.leftNormal.y * sideSign,
  };
  return [hinge, ...arcPoints(hinge, closedDirection, openDirection, opening.width)];
}

function addDiagnostic(
  diagnosticsByObjectId: Map<string, FitDiagnostic[]>,
  diagnostic: FitDiagnostic,
): void {
  const diagnostics = diagnosticsByObjectId.get(diagnostic.objectId);
  if (!diagnostics) throw new Error(`Missing fit accumulator for object ${diagnostic.objectId}`);
  const key = [
    diagnostic.code,
    diagnostic.objectId,
    diagnostic.relatedObjectId ?? "",
    diagnostic.relatedOpeningId ?? "",
  ].join(":");
  if (diagnostics.some((candidate) => [
    candidate.code,
    candidate.objectId,
    candidate.relatedObjectId ?? "",
    candidate.relatedOpeningId ?? "",
  ].join(":") === key)) return;
  diagnostics.push(diagnostic);
}

function statusFor(diagnostics: readonly FitDiagnostic[]): FitStatus {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "collision")) return "blocked";
  if (diagnostics.some((diagnostic) => diagnostic.severity === "recommendation")) return "tight";
  return "fits";
}

export function evaluateObjectFits(document: FitDocumentLike): FitEvaluation {
  const roomsResult = deriveRooms(document);
  const planValid = !roomsResult.diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const diagnosticsByObjectId = new Map<string, FitDiagnostic[]>();
  const roomIdByObjectId = new Map<string, string>();
  const rectangles = new Map<string, OrientedRectangle>();

  for (const object of document.placedObjects) {
    diagnosticsByObjectId.set(object.id, []);
    rectangles.set(object.id, objectRectangle(object));
  }

  for (const object of document.placedObjects) {
    const rectangle = rectangles.get(object.id)!;
    if (!planValid) {
      addDiagnostic(diagnosticsByObjectId, {
        code: "plan-invalid",
        severity: "collision",
        objectId: object.id,
        message: "Планировка содержит ошибку, поэтому размещение нельзя проверить достоверно.",
      });
      continue;
    }

    const room = containingRoom(rectangle, roomsResult.rooms);
    if (!room) {
      addDiagnostic(diagnosticsByObjectId, {
        code: "outside-room",
        severity: "collision",
        objectId: object.id,
        message: "Предмет выходит за внутренние границы комнаты.",
      });
    } else {
      roomIdByObjectId.set(object.id, room.id);
    }
  }

  for (let firstIndex = 0; firstIndex < document.placedObjects.length; firstIndex += 1) {
    const first = document.placedObjects[firstIndex]!;
    const firstRectangle = rectangles.get(first.id)!;
    for (let secondIndex = firstIndex + 1; secondIndex < document.placedObjects.length; secondIndex += 1) {
      const second = document.placedObjects[secondIndex]!;
      const secondRectangle = rectangles.get(second.id)!;
      if (!orientedRectanglesIntersect(firstRectangle, secondRectangle)) continue;
      addDiagnostic(diagnosticsByObjectId, {
        code: "object-collision",
        severity: "collision",
        objectId: first.id,
        relatedObjectId: second.id,
        message: `Пересекается с «${second.name}».`,
      });
      addDiagnostic(diagnosticsByObjectId, {
        code: "object-collision",
        severity: "collision",
        objectId: second.id,
        relatedObjectId: first.id,
        message: `Пересекается с «${first.name}».`,
      });
    }
  }

  const doors = document.openings
    .filter((opening) => opening.kind === "door")
    .map((opening) => ({ opening, polygon: doorSwingPolygon(document, opening) }));

  for (const object of document.placedObjects) {
    const rectangle = rectangles.get(object.id)!;
    const footprint = orientedRectangleCorners(rectangle);
    for (const door of doors) {
      if (!polygonsStrictlyOverlap(footprint, door.polygon)) continue;
      addDiagnostic(diagnosticsByObjectId, {
        code: "door-obstructed",
        severity: "collision",
        objectId: object.id,
        relatedOpeningId: door.opening.id,
        message: "Предмет перекрывает открывание двери.",
      });
    }
  }

  if (planValid) {
    for (const object of document.placedObjects) {
      const rectangle = rectangles.get(object.id)!;
      const roomId = roomIdByObjectId.get(object.id);
      if (!roomId) continue;
      const room = roomsResult.rooms.find((candidate) => candidate.id === roomId)!;
      const clearanceRectangle = expandedOrientedRectangle(rectangle, object.clearance);
      const hasClearance = Object.values(object.clearance).some((value) => value > 0);
      if (!hasClearance) continue;

      if (!rectangleInsideRoom(clearanceRectangle, room)) {
        addDiagnostic(diagnosticsByObjectId, {
          code: "clearance-wall",
          severity: "recommendation",
          objectId: object.id,
          message: "Рекомендуемая зона использования упирается в стену.",
        });
      }

      for (const other of document.placedObjects) {
        if (other.id === object.id) continue;
        const otherRectangle = rectangles.get(other.id)!;
        if (orientedRectanglesIntersect(rectangle, otherRectangle)) continue;
        if (!orientedRectanglesIntersect(clearanceRectangle, otherRectangle)) continue;
        addDiagnostic(diagnosticsByObjectId, {
          code: "clearance-object",
          severity: "recommendation",
          objectId: object.id,
          relatedObjectId: other.id,
          message: `Для использования не хватает места рядом с «${other.name}».`,
        });
      }

      const clearancePolygon = orientedRectangleCorners(clearanceRectangle);
      for (const door of doors) {
        if (polygonsStrictlyOverlap(footprintOrEmpty(rectangle), door.polygon)) continue;
        if (!polygonsStrictlyOverlap(clearancePolygon, door.polygon)) continue;
        addDiagnostic(diagnosticsByObjectId, {
          code: "clearance-door",
          severity: "recommendation",
          objectId: object.id,
          relatedOpeningId: door.opening.id,
          message: "Рекомендуемая зона использования пересекается с зоной открывания двери.",
        });
      }
    }
  }

  const byObjectId = new Map<string, ObjectFitResult>();
  for (const object of document.placedObjects) {
    const diagnostics = diagnosticsByObjectId.get(object.id)!;
    const roomId = roomIdByObjectId.get(object.id);
    byObjectId.set(object.id, {
      objectId: object.id,
      status: statusFor(diagnostics),
      ...(roomId ? { roomId } : {}),
      diagnostics,
    });
  }

  return { byObjectId, planValid };
}

function footprintOrEmpty(rectangle: OrientedRectangle): readonly Point2[] {
  return orientedRectangleCorners(rectangle);
}
