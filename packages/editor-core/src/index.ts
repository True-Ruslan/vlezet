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
} from "./topology-editing";
