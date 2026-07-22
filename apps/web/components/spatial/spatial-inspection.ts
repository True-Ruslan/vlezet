import { getWallEndpoints, type ObjectCategory, type VlezetDocument } from "@vlezet/domain";
import {
  deriveRectangularRoomDimensions,
  deriveRooms,
  evaluateObjectFits,
  type FitStatus,
} from "@vlezet/geometry";
import type { SpatialScene } from "@vlezet/spatial";

export type SpatialInspectionTarget =
  | Readonly<{ kind: "room"; id: string }>
  | Readonly<{ kind: "wall"; id: string }>
  | Readonly<{ kind: "placed-object"; id: string }>;

export type SpatialRoomInspectionDetails = Readonly<{
  kind: "room";
  id: string;
  name: string;
  areaM2: number;
  clearWidthMm?: number;
  clearLengthMm?: number;
}>;

export type SpatialWallInspectionDetails = Readonly<{
  kind: "wall";
  id: string;
  lengthMm: number;
  thicknessMm: number;
  visibleSegmentCount: number;
}>;

export type SpatialObjectInspectionDetails = Readonly<{
  kind: "placed-object";
  id: string;
  name: string;
  category: ObjectCategory;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  heightWasDefaulted: boolean;
  rotationDeg: number;
  fitStatus: FitStatus;
  diagnostics: readonly string[];
}>;

export type SpatialInspectionDetails =
  | SpatialRoomInspectionDetails
  | SpatialWallInspectionDetails
  | SpatialObjectInspectionDetails;

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function spatialInspectionTargetFromUserData(
  userData: Readonly<Record<string, unknown>>,
): SpatialInspectionTarget | null {
  switch (userData.kind) {
    case "floor": {
      const roomId = nonEmptyString(userData.roomId);
      return roomId ? { kind: "room", id: roomId } : null;
    }
    case "wall": {
      const wallId = nonEmptyString(userData.wallId);
      return wallId ? { kind: "wall", id: wallId } : null;
    }
    case "placed-object": {
      const objectId = nonEmptyString(userData.objectId);
      return objectId ? { kind: "placed-object", id: objectId } : null;
    }
    default:
      return null;
  }
}

export function sameSpatialInspectionTarget(
  first: SpatialInspectionTarget | null,
  second: SpatialInspectionTarget | null,
): boolean {
  if (first === second) return true;
  if (!first || !second) return false;
  return first.kind === second.kind && first.id === second.id;
}

export function buildSpatialInspectionDetails(
  document: VlezetDocument,
  scene: SpatialScene,
  target: SpatialInspectionTarget,
): SpatialInspectionDetails | null {
  if (target.kind === "room") {
    const room = deriveRooms(document).rooms.find((candidate) => candidate.id === target.id);
    if (!room) return null;
    const dimensions = deriveRectangularRoomDimensions(room);
    return {
      kind: "room",
      id: room.id,
      name: room.name,
      areaM2: room.areaM2,
      ...(dimensions
        ? { clearWidthMm: dimensions.widthMm, clearLengthMm: dimensions.heightMm }
        : {}),
    };
  }

  if (target.kind === "wall") {
    const wall = document.walls.find((candidate) => candidate.id === target.id);
    if (!wall) return null;
    const { start, end } = getWallEndpoints(document, wall);
    return {
      kind: "wall",
      id: wall.id,
      lengthMm: Math.hypot(end.position.x - start.position.x, end.position.y - start.position.y),
      thicknessMm: wall.thickness,
      visibleSegmentCount: scene.wallSegments.filter((segment) => segment.wallId === wall.id).length,
    };
  }

  const object = document.placedObjects.find((candidate) => candidate.id === target.id);
  const spatialObject = scene.objects.find((candidate) => candidate.objectId === target.id);
  if (!object || !spatialObject) return null;
  const fit = evaluateObjectFits(document).byObjectId.get(object.id);
  if (!fit) return null;

  return {
    kind: "placed-object",
    id: object.id,
    name: object.name,
    category: object.category,
    widthMm: object.width,
    depthMm: object.depth,
    heightMm: spatialObject.heightMm,
    heightWasDefaulted: spatialObject.heightWasDefaulted,
    rotationDeg: object.rotationDeg,
    fitStatus: fit.status,
    diagnostics: fit.diagnostics.map((diagnostic) => diagnostic.message),
  };
}
