export type { EditorCommand, EditorCommandLabel } from "./commands";
export { createHistoryState, executeCommand, redo, undo } from "./history";
export type { HistoryEntry, HistoryState } from "./history";
export { evaluateHostedOpeningMove } from "./hosted-opening-move";
export type { HostedOpeningMoveResult } from "./hosted-opening-move";
export {
  addPlacedObject,
  addPlacedObjects,
  deletePlacedObject,
  deletePlacedObjects,
  duplicatePlacedObject,
  movePlacedObject,
  resizePlacedObject,
  rotatePlacedObject,
  translatePlacedObjects,
  updatePlacedObject,
  updatePlacedObjects,
} from "./object-editing";
export type { PlacedObjectBatchPatch, PlacedObjectPatch } from "./object-editing";
export { addOpening, deleteOpening, updateOpening, validateOpening } from "./opening-editing";
export type { OpeningPatch } from "./opening-editing";
export { applyPlanningCandidate } from "./planning-editing";
export { setRectangularRoomClearDimension } from "./room-dimension-editing";
export type { ClearRoomDimensionAnchor, ClearRoomDimensionAxis } from "./room-dimension-editing";
export { setRoomName } from "./room-editing";
export {
  createRoomStructuralClipboardPayload,
  createStructuralClipboardPayload,
  cutStructuralFragment,
  evaluateStructuralClipboardClosure,
  pasteStructuralFragment,
} from "./structural-clipboard";
export type {
  StructuralClipboardPayloadV1,
  StructuralClipboardScope,
  StructuralClosureResult,
} from "./structural-clipboard";
export {
  evaluateStructuralRoomTranslation,
  evaluateStructuralVertexMove,
  evaluateStructuralWallTranslation,
  evaluateWallThicknessBatch,
  resolveStructuralRoomTranslationClosure,
} from "./structural-editing";
export type {
  StructuralRoomClosureResult,
  StructuralRoomTranslationClosure,
  StructuralTransactionCode,
  StructuralTransactionResult,
} from "./structural-editing";
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
