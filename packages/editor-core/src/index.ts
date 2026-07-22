export type { EditorCommand, EditorCommandLabel } from "./commands";
export { createHistoryState, executeCommand, redo, undo } from "./history";
export type { HistoryEntry, HistoryState } from "./history";
export {
  addPlacedObject,
  deletePlacedObject,
  duplicatePlacedObject,
  movePlacedObject,
  resizePlacedObject,
  rotatePlacedObject,
  updatePlacedObject,
} from "./object-editing";
export type { PlacedObjectPatch } from "./object-editing";
export { addOpening, deleteOpening, updateOpening, validateOpening } from "./opening-editing";
export type { OpeningPatch } from "./opening-editing";
export { applyPlanningCandidate } from "./planning-editing";
export { setRectangularRoomClearDimension } from "./room-dimension-editing";
export type { ClearRoomDimensionAnchor, ClearRoomDimensionAxis } from "./room-dimension-editing";
export { setRoomName } from "./room-editing";
export {
  addConnectedWall,
  addTJunctionWall,
  addTopologicalWall,
  MAX_WALL_THICKNESS_MM,
  MIN_WALL_THICKNESS_MM,
  moveVertex,
  setTopologicalWallLength,
  setWallThickness,
  topologicalWallLength,
} from "./topology-editing";
export type {
  AddTopologicalWallInput,
  DocumentEdit,
  WallEndpointIntent,
  WallLengthAnchor,
  WallThicknessAlignment,
} from "./topology-editing";
