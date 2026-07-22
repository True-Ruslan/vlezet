import type { ObjectCategory } from "@vlezet/domain";

export type Point3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type SpatialWallSegment = Readonly<{
  id: string;
  wallId: string;
  startOffsetMm: number;
  endOffsetMm: number;
  center: Point3;
  lengthMm: number;
  thicknessMm: number;
  heightMm: number;
  rotationYRad: number;
}>;

export type SpatialOpeningMarker = Readonly<{
  id: string;
  openingId: string;
  wallId: string;
  kind: "door" | "window";
  center: Point3;
  widthMm: number;
  wallHeightMm: number;
  rotationYRad: number;
}>;

export type SpatialFloor = Readonly<{
  id: string;
  roomId: string;
  polygon: readonly Point3[];
}>;

export type SpatialObject = Readonly<{
  id: string;
  objectId: string;
  name: string;
  category: ObjectCategory;
  center: Point3;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  rotationYRad: number;
  heightWasDefaulted: boolean;
}>;

export type SpatialScene = Readonly<{
  wallSegments: readonly SpatialWallSegment[];
  openingMarkers: readonly SpatialOpeningMarker[];
  floors: readonly SpatialFloor[];
  objects: readonly SpatialObject[];
}>;

export type SpatialProjectionDiagnostic = Readonly<{
  code: "invalid-wall" | "invalid-opening" | "invalid-floor" | "invalid-object";
  severity: "error" | "warning";
  entityKind: "wall" | "opening" | "room" | "placed-object";
  entityId: string;
  message: string;
}>;

export type SpatialProjectionResult = Readonly<{
  scene: SpatialScene;
  diagnostics: readonly SpatialProjectionDiagnostic[];
}>;
