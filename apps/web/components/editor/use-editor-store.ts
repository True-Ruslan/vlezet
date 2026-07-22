import {
  createPlacedObject,
  getVertex,
  type PlacedObject,
  type Point2,
} from "@vlezet/domain";
import {
  addOpening,
  addPlacedObject,
  addTopologicalWall,
  createHistoryState,
  deleteOpening,
  deletePlacedObject,
  duplicatePlacedObject,
  executeCommand,
  redo as redoHistory,
  setRectangularRoomClearDimension,
  setRoomName,
  setTopologicalWallLength,
  setWallThickness,
  undo as undoHistory,
  updateOpening,
  updatePlacedObject,
  type ClearRoomDimensionAnchor,
  type ClearRoomDimensionAxis,
  type HistoryState,
  type OpeningPatch,
  type PlacedObjectPatch,
  type WallEndpointIntent,
  type WallLengthAnchor,
} from "@vlezet/editor-core";
import { deriveRooms, proposeOpeningPlacement, type SnapResult } from "@vlezet/geometry";
import { createStore, type StoreApi } from "zustand/vanilla";
import { getFurniturePreset } from "./furniture-presets";

export type EditorTool = "select" | "wall" | "door" | "window";
export type EditorEntityIdKind = "wall" | "vertex" | "room-annotation" | "opening" | "placed-object";
export type ObjectGestureKind = "move" | "transform";

export type TopologySnapTarget =
  | Readonly<{ kind: "vertex"; vertexId: string; point: Point2 }>
  | Readonly<{ kind: "wall"; wallId: string; point: Point2 }>;

export type DraftWall = Readonly<{
  start: Point2;
  end: Point2;
  snap: SnapResult;
  startTarget: TopologySnapTarget | null;
  endTarget: TopologySnapTarget | null;
}>;

export type ObjectGesture = Readonly<{
  kind: ObjectGestureKind;
  objectId: string;
  before: PlacedObject;
  preview: PlacedObject;
}>;

export type EditorStoreState = {
  history: HistoryState;
  tool: EditorTool;
  selectedWallId: string | null;
  selectedRoomId: string | null;
  selectedOpeningId: string | null;
  selectedObjectId: string | null;
  placementPresetId: string | null;
  draftWall: DraftWall | null;
  objectGesture: ObjectGesture | null;
  setTool: (tool: EditorTool) => void;
  setPlacementPreset: (presetId: string | null) => void;
  selectWall: (wallId: string | null) => void;
  selectRoom: (roomId: string | null) => void;
  selectOpening: (openingId: string | null) => void;
  selectObject: (objectId: string | null) => void;
  beginWall: (point: Point2, target?: TopologySnapTarget | null) => void;
  updateDraftWall: (snap: SnapResult, target?: TopologySnapTarget | null) => void;
  commitDraftWall: () => void;
  cancelDraft: () => void;
  cancelCurrentAction: () => void;
  setSelectedWallLength: (lengthMm: number, anchor?: WallLengthAnchor) => void;
  setSelectedWallThickness: (thicknessMm: number) => void;
  setSelectedRoomName: (name: string) => void;
  setSelectedRoomClearDimension: (axis: ClearRoomDimensionAxis, lengthMm: number, anchor?: ClearRoomDimensionAnchor) => void;
  addOpeningAt: (wallId: string, pointerOffset: number) => void;
  updateSelectedOpening: (patch: OpeningPatch) => void;
  deleteSelectedOpening: () => void;
  placeSelectedPreset: (position: Point2) => void;
  updateSelectedObject: (patch: PlacedObjectPatch) => void;
  rotateSelectedObject90: () => void;
  duplicateSelectedObject: () => void;
  deleteSelectedObject: () => void;
  beginObjectGesture: (objectId: string, kind: ObjectGestureKind) => void;
  previewObjectGesture: (patch: PlacedObjectPatch) => void;
  commitObjectGesture: () => void;
  cancelObjectGesture: () => void;
  undo: () => void;
  redo: () => void;
};

export type CreateEditorStoreOptions = Readonly<{
  idFactory?: (kind: EditorEntityIdKind) => string;
  defaultWallThicknessMm?: number;
}>;

function emptySnap(point: Point2): SnapResult {
  return { point, kind: "none", guides: [] };
}

function selectedWallAfterHistory(history: HistoryState, id: string | null): string | null {
  return id && history.document.walls.some((wall) => wall.id === id) ? id : null;
}
function selectedRoomAfterHistory(history: HistoryState, id: string | null): string | null {
  return id && deriveRooms(history.document).rooms.some((room) => room.id === id) ? id : null;
}
function selectedOpeningAfterHistory(history: HistoryState, id: string | null): string | null {
  return id && history.document.openings.some((opening) => opening.id === id) ? id : null;
}
function selectedObjectAfterHistory(history: HistoryState, id: string | null): string | null {
  return id && history.document.placedObjects.some((object) => object.id === id) ? id : null;
}
function targetPoint(point: Point2, target: TopologySnapTarget | null): Point2 {
  return target ? target.point : point;
}
function endpointIntent(point: Point2, target: TopologySnapTarget | null, idFactory: (kind: EditorEntityIdKind) => string): WallEndpointIntent {
  if (target?.kind === "vertex") return { kind: "existing-vertex", vertexId: target.vertexId };
  if (target?.kind === "wall") return { kind: "wall-junction", vertexId: idFactory("vertex"), wallId: target.wallId, position: target.point };
  return { kind: "new-vertex", vertexId: idFactory("vertex"), position: point };
}

function objectPatchFrom(object: PlacedObject): PlacedObjectPatch {
  return {
    name: object.name,
    position: object.position,
    width: object.width,
    depth: object.depth,
    ...(object.height === undefined ? {} : { height: object.height }),
    rotationDeg: object.rotationDeg,
    clearance: object.clearance,
  };
}

function objectsEqual(first: PlacedObject, second: PlacedObject): boolean {
  return first.name === second.name &&
    first.position.x === second.position.x &&
    first.position.y === second.position.y &&
    first.width === second.width &&
    first.depth === second.depth &&
    first.height === second.height &&
    first.rotationDeg === second.rotationDeg &&
    first.clearance.front === second.clearance.front &&
    first.clearance.right === second.clearance.right &&
    first.clearance.back === second.clearance.back &&
    first.clearance.left === second.clearance.left;
}

export function createEditorStore(options: CreateEditorStoreOptions = {}): StoreApi<EditorStoreState> {
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const defaultWallThicknessMm = options.defaultWallThicknessMm ?? 150;

  return createStore<EditorStoreState>((set, get) => ({
    history: createHistoryState(),
    tool: "select",
    selectedWallId: null,
    selectedRoomId: null,
    selectedOpeningId: null,
    selectedObjectId: null,
    placementPresetId: null,
    draftWall: null,
    objectGesture: null,

    setTool: (tool) => set({
      tool,
      placementPresetId: null,
      objectGesture: null,
      draftWall: tool === "wall" ? get().draftWall : null,
    }),
    setPlacementPreset: (placementPresetId) => {
      if (placementPresetId) getFurniturePreset(placementPresetId);
      set({
        placementPresetId,
        tool: "select",
        draftWall: null,
        objectGesture: null,
        selectedWallId: null,
        selectedRoomId: null,
        selectedOpeningId: null,
        selectedObjectId: null,
      });
    },
    selectWall: (selectedWallId) => set({
      selectedWallId,
      selectedRoomId: null,
      selectedOpeningId: null,
      selectedObjectId: null,
      placementPresetId: null,
      objectGesture: null,
    }),
    selectRoom: (selectedRoomId) => set({
      selectedRoomId,
      selectedWallId: null,
      selectedOpeningId: null,
      selectedObjectId: null,
      placementPresetId: null,
      objectGesture: null,
    }),
    selectOpening: (selectedOpeningId) => set({
      selectedOpeningId,
      selectedWallId: null,
      selectedRoomId: null,
      selectedObjectId: null,
      placementPresetId: null,
      objectGesture: null,
    }),
    selectObject: (selectedObjectId) => set({
      selectedObjectId,
      selectedWallId: null,
      selectedRoomId: null,
      selectedOpeningId: null,
      placementPresetId: null,
      objectGesture: null,
      tool: "select",
    }),
    beginWall: (point, target = null) => {
      const resolved = targetPoint(point, target);
      set({ draftWall: { start: resolved, end: resolved, snap: emptySnap(resolved), startTarget: target, endTarget: null } });
    },
    updateDraftWall: (snap, target = null) => {
      const current = get().draftWall;
      if (!current) return;
      const end = targetPoint(snap.point, target);
      set({ draftWall: { ...current, end, snap: { ...snap, point: end }, endTarget: target } });
    },
    commitDraftWall: () => {
      const current = get().draftWall;
      if (!current || (current.start.x === current.end.x && current.start.y === current.end.y)) return;
      const before = get().history.document;
      const start = endpointIntent(current.start, current.startTarget, idFactory);
      const end = endpointIntent(current.end, current.endTarget, idFactory);
      const wallId = idFactory("wall");
      const edit = addTopologicalWall(before, { wallId, start, end, thickness: defaultWallThicknessMm });
      const label = start.kind === "wall-junction" || end.kind === "wall-junction" ? "wall/add-t-junction" : "wall/add-connected";
      const history = executeCommand(get().history, { type: "document/replace", label, before, after: edit.document });
      const continuation = edit.continuationVertexId ? getVertex(edit.document, edit.continuationVertexId) : null;
      const continuationTarget = continuation ? ({ kind: "vertex", vertexId: continuation.id, point: continuation.position } as const) : null;
      set({
        history,
        selectedWallId: edit.selectedWallId ?? wallId,
        selectedRoomId: null,
        selectedOpeningId: null,
        selectedObjectId: null,
        placementPresetId: null,
        draftWall: get().tool === "wall" && continuation ? {
          start: continuation.position,
          end: continuation.position,
          snap: emptySnap(continuation.position),
          startTarget: continuationTarget,
          endTarget: null,
        } : null,
      });
    },
    cancelDraft: () => set({ draftWall: null }),
    cancelCurrentAction: () => {
      const current = get();
      if (current.objectGesture) {
        set({ objectGesture: null });
        return;
      }
      if (current.placementPresetId) {
        set({ placementPresetId: null });
        return;
      }
      set({ draftWall: null, tool: "select" });
    },
    setSelectedWallLength: (lengthMm, anchor = "start") => {
      const { history, selectedWallId } = get();
      if (!selectedWallId) return;
      const before = history.document;
      const after = setTopologicalWallLength(before, selectedWallId, lengthMm, anchor);
      set({ history: executeCommand(history, { type: "document/replace", label: "wall/set-length", before, after }) });
    },
    setSelectedWallThickness: (thicknessMm) => {
      const { history, selectedWallId } = get();
      if (!selectedWallId) return;
      const before = history.document;
      const after = setWallThickness(before, selectedWallId, thicknessMm);
      set({ history: executeCommand(history, { type: "document/replace", label: "wall/set-thickness", before, after }) });
    },
    setSelectedRoomName: (name) => {
      const { history, selectedRoomId } = get();
      if (!selectedRoomId) return;
      const before = history.document;
      const after = setRoomName(before, selectedRoomId, name, idFactory("room-annotation"));
      set({ history: executeCommand(history, { type: "document/replace", label: "room-annotation/set-name", before, after }) });
    },
    setSelectedRoomClearDimension: (axis, lengthMm, anchor = "min") => {
      const { history, selectedRoomId } = get();
      if (!selectedRoomId) return;
      const before = history.document;
      const after = setRectangularRoomClearDimension(before, selectedRoomId, axis, lengthMm, anchor);
      set({ history: executeCommand(history, { type: "document/replace", label: "room/set-clear-dimension", before, after }) });
    },
    addOpeningAt: (wallId, pointerOffset) => {
      const { history, tool } = get();
      if (tool !== "door" && tool !== "window") return;
      const width = tool === "door" ? 900 : 1200;
      const placement = proposeOpeningPlacement(history.document, wallId, pointerOffset, width);
      const opening = {
        id: idFactory("opening"),
        wallId,
        kind: tool,
        ...placement,
        ...(tool === "door" ? { doorSwing: { hinge: "start" as const, side: "left" as const } } : {}),
      };
      const before = history.document;
      const after = addOpening(before, opening);
      set({
        history: executeCommand(history, { type: "document/replace", label: "opening/add", before, after }),
        selectedOpeningId: opening.id,
        selectedWallId: null,
        selectedRoomId: null,
        selectedObjectId: null,
      });
    },
    updateSelectedOpening: (patch) => {
      const { history, selectedOpeningId } = get();
      if (!selectedOpeningId) return;
      const before = history.document;
      const after = updateOpening(before, selectedOpeningId, patch);
      set({ history: executeCommand(history, { type: "document/replace", label: "opening/update", before, after }) });
    },
    deleteSelectedOpening: () => {
      const { history, selectedOpeningId } = get();
      if (!selectedOpeningId) return;
      const before = history.document;
      const after = deleteOpening(before, selectedOpeningId);
      set({
        history: executeCommand(history, { type: "document/replace", label: "opening/delete", before, after }),
        selectedOpeningId: null,
      });
    },
    placeSelectedPreset: (position) => {
      const { history, placementPresetId } = get();
      if (!placementPresetId) return;
      const preset = getFurniturePreset(placementPresetId);
      const object = createPlacedObject({
        id: idFactory("placed-object"),
        presetId: preset.id,
        name: preset.name,
        category: preset.category,
        position,
        width: preset.width,
        depth: preset.depth,
        ...(preset.height === undefined ? {} : { height: preset.height }),
        rotationDeg: 0,
        clearance: preset.clearance,
      });
      const before = history.document;
      const after = addPlacedObject(before, object);
      set({
        history: executeCommand(history, { type: "document/replace", label: "object/add", before, after }),
        selectedObjectId: object.id,
        selectedWallId: null,
        selectedRoomId: null,
        selectedOpeningId: null,
        placementPresetId: null,
        tool: "select",
      });
    },
    updateSelectedObject: (patch) => {
      const { history, selectedObjectId } = get();
      if (!selectedObjectId) return;
      const before = history.document;
      const after = updatePlacedObject(before, selectedObjectId, patch);
      set({ history: executeCommand(history, { type: "document/replace", label: "object/update", before, after }) });
    },
    rotateSelectedObject90: () => {
      const { history, selectedObjectId } = get();
      if (!selectedObjectId) return;
      const current = history.document.placedObjects.find((object) => object.id === selectedObjectId);
      if (!current) return;
      const before = history.document;
      const after = updatePlacedObject(before, selectedObjectId, { rotationDeg: current.rotationDeg + 90 });
      set({ history: executeCommand(history, { type: "document/replace", label: "object/rotate", before, after }) });
    },
    duplicateSelectedObject: () => {
      const { history, selectedObjectId } = get();
      if (!selectedObjectId) return;
      const duplicateId = idFactory("placed-object");
      const before = history.document;
      const after = duplicatePlacedObject(before, selectedObjectId, duplicateId);
      set({
        history: executeCommand(history, { type: "document/replace", label: "object/duplicate", before, after }),
        selectedObjectId: duplicateId,
      });
    },
    deleteSelectedObject: () => {
      const { history, selectedObjectId } = get();
      if (!selectedObjectId) return;
      const before = history.document;
      const after = deletePlacedObject(before, selectedObjectId);
      set({
        history: executeCommand(history, { type: "document/replace", label: "object/delete", before, after }),
        selectedObjectId: null,
        objectGesture: null,
      });
    },
    beginObjectGesture: (objectId, kind) => {
      const object = get().history.document.placedObjects.find((candidate) => candidate.id === objectId);
      if (!object) throw new Error(`Placed object does not exist: ${objectId}`);
      set({
        objectGesture: { kind, objectId, before: object, preview: object },
        selectedObjectId: objectId,
        selectedWallId: null,
        selectedRoomId: null,
        selectedOpeningId: null,
        placementPresetId: null,
        tool: "select",
      });
    },
    previewObjectGesture: (patch) => {
      const gesture = get().objectGesture;
      if (!gesture) return;
      const preview = createPlacedObject({
        ...gesture.preview,
        ...patch,
        id: gesture.before.id,
        presetId: gesture.before.presetId,
        category: gesture.before.category,
        position: patch.position ? { ...patch.position } : gesture.preview.position,
        clearance: patch.clearance ? { ...patch.clearance } : gesture.preview.clearance,
      });
      set({ objectGesture: { ...gesture, preview } });
    },
    commitObjectGesture: () => {
      const { history, objectGesture } = get();
      if (!objectGesture) return;
      if (objectsEqual(objectGesture.before, objectGesture.preview)) {
        set({ objectGesture: null });
        return;
      }
      const before = history.document;
      const after = updatePlacedObject(before, objectGesture.objectId, objectPatchFrom(objectGesture.preview));
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: objectGesture.kind === "move" ? "object/move" : "object/update",
          before,
          after,
        }),
        objectGesture: null,
      });
    },
    cancelObjectGesture: () => set({ objectGesture: null }),
    undo: () => {
      const current = get();
      const history = undoHistory(current.history);
      set({
        history,
        draftWall: null,
        objectGesture: null,
        placementPresetId: null,
        selectedWallId: selectedWallAfterHistory(history, current.selectedWallId),
        selectedRoomId: selectedRoomAfterHistory(history, current.selectedRoomId),
        selectedOpeningId: selectedOpeningAfterHistory(history, current.selectedOpeningId),
        selectedObjectId: selectedObjectAfterHistory(history, current.selectedObjectId),
      });
    },
    redo: () => {
      const current = get();
      const history = redoHistory(current.history);
      set({
        history,
        draftWall: null,
        objectGesture: null,
        placementPresetId: null,
        selectedWallId: selectedWallAfterHistory(history, current.selectedWallId),
        selectedRoomId: selectedRoomAfterHistory(history, current.selectedRoomId),
        selectedOpeningId: selectedOpeningAfterHistory(history, current.selectedOpeningId),
        selectedObjectId: selectedObjectAfterHistory(history, current.selectedObjectId),
      });
    },
  }));
}

export const editorStore = createEditorStore();
