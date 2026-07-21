export { validateTopology } from "./diagnostics";
export type { TopologyDiagnostic, TopologyDiagnosticCode } from "./diagnostics";
export { extractPlanarFaces } from "./faces";
export type { FaceBoundaryEdge, PlanarFace } from "./faces";
export { chooseGridStep } from "./grid";
export { distanceBetween } from "./point";
export type { Point2 } from "./point";
export {
  GEOMETRY_EPSILON_MM,
  isProperInteriorIntersection,
  pointOnSegment,
  projectPointToSegment,
  segmentIntersection,
} from "./segment";
export type { SegmentIntersection, SegmentProjection } from "./segment";
export { snapWallPoint } from "./snapping";
export type { SnapGuide, SnapKind, SnapResult, SnapWallPointInput } from "./snapping";
export { deriveAtomicWallEdges, topologyVertexMap, wallRunLength } from "./topology";
export type {
  AtomicWallEdge,
  TopologyDocumentLike,
  TopologyVertexLike,
  TopologyWallLike,
} from "./topology";
export { screenToWorld, worldToScreen, zoomViewportAt } from "./viewport";
export type { ViewportTransform, ZoomLimits } from "./viewport";
