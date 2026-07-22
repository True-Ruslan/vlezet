import { getWallEndpoints, type VlezetDocument } from "@vlezet/domain";
import {
  deriveRooms,
  deriveVisibleWallIntervals,
  openingSegment,
  pointAtWallOffset,
} from "@vlezet/geometry";
import type {
  Point3,
  SpatialFloor,
  SpatialOpeningMarker,
  SpatialProjectionDiagnostic,
  SpatialProjectionResult,
  SpatialWallSegment,
} from "./types";

export const DEFAULT_WALL_HEIGHT_MM = 2700;

function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function point2ToFloorPoint3(point: Readonly<{ x: number; y: number }>): Point3 {
  return { x: cleanZero(point.x), y: 0, z: cleanZero(point.y) };
}

function rotationYFromDirection(dx: number, dz: number): number {
  return cleanZero(-Math.atan2(dz, dx));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown spatial projection error";
}

export function projectDocumentToSpatialScene(document: VlezetDocument): SpatialProjectionResult {
  const wallSegments: SpatialWallSegment[] = [];
  const openingMarkers: SpatialOpeningMarker[] = [];
  const floors: SpatialFloor[] = [];
  const diagnostics: SpatialProjectionDiagnostic[] = [];

  for (const wall of document.walls) {
    try {
      const { start, end } = getWallEndpoints(document, wall);
      const dx = end.position.x - start.position.x;
      const dz = end.position.y - start.position.y;
      const wallLength = Math.hypot(dx, dz);
      if (!Number.isFinite(wallLength) || wallLength <= 0) {
        throw new Error(`Wall ${wall.id} has invalid length`);
      }
      const rotationYRad = rotationYFromDirection(dx, dz);
      const intervals = deriveVisibleWallIntervals(document, wall.id);

      intervals.forEach((interval, index) => {
        const startPoint = pointAtWallOffset(document, wall.id, interval.startOffset);
        const endPoint = pointAtWallOffset(document, wall.id, interval.endOffset);
        const lengthMm = interval.endOffset - interval.startOffset;
        wallSegments.push({
          id: `${wall.id}:segment:${index}`,
          wallId: wall.id,
          startOffsetMm: interval.startOffset,
          endOffsetMm: interval.endOffset,
          center: {
            x: cleanZero((startPoint.x + endPoint.x) / 2),
            y: DEFAULT_WALL_HEIGHT_MM / 2,
            z: cleanZero((startPoint.y + endPoint.y) / 2),
          },
          lengthMm,
          thicknessMm: wall.thickness,
          heightMm: DEFAULT_WALL_HEIGHT_MM,
          rotationYRad,
        });
      });
    } catch (error) {
      diagnostics.push({
        code: "invalid-wall",
        severity: "error",
        entityKind: "wall",
        entityId: wall.id,
        message: errorMessage(error),
      });
    }
  }

  for (const opening of document.openings) {
    try {
      const segment = openingSegment(document, opening);
      const dx = segment.end.x - segment.start.x;
      const dz = segment.end.y - segment.start.y;
      openingMarkers.push({
        id: `opening:${opening.id}`,
        openingId: opening.id,
        wallId: opening.wallId,
        kind: opening.kind,
        center: {
          x: cleanZero((segment.start.x + segment.end.x) / 2),
          y: DEFAULT_WALL_HEIGHT_MM / 2,
          z: cleanZero((segment.start.y + segment.end.y) / 2),
        },
        widthMm: opening.width,
        wallHeightMm: DEFAULT_WALL_HEIGHT_MM,
        rotationYRad: rotationYFromDirection(segment.tangent.x, segment.tangent.y),
      });
    } catch (error) {
      diagnostics.push({
        code: "invalid-opening",
        severity: "error",
        entityKind: "opening",
        entityId: opening.id,
        message: errorMessage(error),
      });
    }
  }

  const derivedRooms = deriveRooms(document);
  for (const room of derivedRooms.rooms) {
    if (room.polygon.length < 3 || room.polygon.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      diagnostics.push({
        code: "invalid-floor",
        severity: "error",
        entityKind: "room",
        entityId: room.id,
        message: `Room ${room.id} has invalid floor polygon`,
      });
      continue;
    }
    floors.push({
      id: `floor:${room.id}`,
      roomId: room.id,
      polygon: room.polygon.map(point2ToFloorPoint3),
    });
  }

  return {
    scene: { wallSegments, openingMarkers, floors },
    diagnostics,
  };
}
