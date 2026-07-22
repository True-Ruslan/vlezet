export { deriveDocumentBounds, fitViewportToBounds, unionWorldBounds } from "./content-bounds";
export type { DeriveDocumentBoundsOptions, ViewportSize, WorldBounds } from "./content-bounds";
export { validateTopology } from "./diagnostics";
export type { TopologyDiagnostic, TopologyDiagnosticCode } from "./diagnostics";
export { extractPlanarFaces } from "./faces";
export type { FaceBoundaryEdge, PlanarFace } from "./faces";
export { doorSwingPolygon, evaluateObjectFits, objectRectangle } from "./fit";
export type {
  FitDiagnostic, FitDiagnosticCode, FitDocumentLike, FitDoorSwingLike, FitEvaluation,
  FitOpeningLike, FitPlacedObjectLike, FitStatus, ObjectFitResult,
} from "./fit";
export { chooseGridStep } from "./grid";
export { measureObjectClearances } from "./measurements";
export type { DirectionalClearances } from "./measurements";
export {
  expandedOrientedRectangle, localToWorld, orientedRectangleAxes, orientedRectangleCorners,
  orientedRectangleEdges, orientedRectanglesIntersect, pointInOrientedRectangle, worldToLocal,
} from "./oriented-rectangle";
export type { OrientedRectangle, RectangleAxes, RectangleMargins } from "./oriented-rectangle";
export {
  deriveVisibleWallIntervals, openingSegment, pointAtWallOffset, projectPointToWallOffset,
  proposeOpeningPlacement,
} from "./openings";
export type { OpeningDocumentLike, OpeningLike, OpeningWorldSegment, WallInterval } from "./openings";
export { distanceBetween } from "./point";
export type { Point2 } from "./point";
export { findInteriorPoint, pointInPolygon, polygonPerimeter, polygonSelfIntersects, signedPolygonArea } from "./polygon";
export {
  alignReferenceCalibration,
  calibrateReferencePlan,
  imagePointToWorld,
  referencePlanBounds,
  referencePlanWorldCorners,
  worldPointToImage,
} from "./reference-plan";
export type {
  Bounds2,
  CalibratedReference,
  CalibrationInput,
  ReferenceAlignment,
  ReferenceCalibration,
  ReferenceTransform,
} from "./reference-plan";
export { deriveRectangularRoomDimensions } from "./room-dimensions";
export type { RectangularRoomDimensions } from "./room-dimensions";
export { deriveRooms } from "./rooms";
export type {
  DerivedRoom, DerivedRoomDiagnostic, DerivedRoomsResult, RoomAnnotationLike,
  RoomDocumentLike, RoomGeometryDiagnostic,
} from "./rooms";
export { GEOMETRY_EPSILON_MM, isProperInteriorIntersection, pointOnSegment, projectPointToSegment, segmentIntersection } from "./segment";
export type { SegmentIntersection, SegmentProjection } from "./segment";
export { snapWallPoint } from "./snapping";
export type { SnapGuide, SnapKind, SnapResult, SnapWallPointInput } from "./snapping";
export { deriveAtomicWallEdges, topologyVertexMap, wallRunLength } from "./topology";
export type { AtomicWallEdge, TopologyDocumentLike, TopologyVertexLike, TopologyWallLike } from "./topology";
export { screenToWorld, worldToScreen, zoomViewportAt } from "./viewport";
export type { ViewportTransform, ZoomLimits } from "./viewport";
export { deriveSingleAdjacentRoomSide } from "./wall-room-side";
export type { WallRoomSide } from "./wall-room-side";
