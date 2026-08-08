import {
  createPlacedObject,
  getVertex,
  type PlacedObject,
  type Point2,
  type VlezetDocument,
} from "@vlezet/domain";
import {
  addOpening,
  applyPlanningCandidate as applyPlanningCandidateEdit,
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
  type WallThicknessAlignment,
} from "@vlezet/editor-core";
import { proposeOpeningPlacement, type SnapResult } from "@vlezet/geometry";
import type { PlanningCandidate } from "@vlezet/planning";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  EMPTY_EDITOR_SELECTION,
  addToSelection,
  replaceSelection,
  sameEditorEntity,
  sanitizeEditorSelection,
  toggleSelection,
  type EditorEntityRef,
  type EditorSelection,
} from "./editor-selection";
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
  selection: EditorSelection;
  placementPresetId: string | null;
  draftWall: DraftWall | null;
  objectGesture: ObjectGesture | null;
  setTool: (tool: EditorTool) => void;
  setPlacementPreset: (presetId: string | null) => void;
  replaceSelection: (ref: EditorEntityRef | null) => void;
  toggleSelection: (ref: EditorEntityRef) => void;
  addSelection: (refs: readonly EditorEntityRef[]) => void;
  clearSelection: () => void;
  selectAllConcreteEntities: () => void;
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
  setSelectedWallThickness: (thicknessMm: number, alignment?: WallThicknessAlignment) => void;
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
  applyPlanningCandidate: (candidate: PlanningCandidate) => void;
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

function selectedId(selection: EditorSelection, kind: EditorEntityRef["kind"]): string | null {
  if (selection.refs.length !== 1 || selection.primary === null) return null;
  const ref = selection.refs[0];
  if (!ref || ref.kind !== kind || !sameEditorEntity(ref, selection.primary)) return null;
  return ref.id;
}

export function selectedWallId(selection: EditorSelection): string | null {
  return selectedId(selection, "wall");
}

export function selectedRoomId(selection: EditorSelection): string | null {
  return selectedId(selection, "room");
}

export function selectedOpeningId(selection: EditorSelection): string | null {
  return selectedId(selection, "opening");
}

export function selectedObjectId(selection: EditorSelection): string | null {
  return selectedId(selection, "placed-object");
}

function emptySnap(point: Point2): SnapResult {
  return { point, kind: "none", guides: [] };
}

function targetPoint(point: Point2, target: TopologySnapTarget | null): Point2 {
  return target ? target.point : point;
}

function endpointIntent(
  point: Point2,
  target: TopologySnapTarget | null,
  idFactory: (kind: EditorEntityIdKind) => string,
): WallEndpointIntent {
  if (target?.kind === "vertex") return { kind: "existing-vertex", vertexId: target.vertexId };
  if (target?.kind === "wall") {
    return {
      kind: "wall-junction",
      vertexId: idFactory("vertex"),
      wallId: target.wallId,
      position: target.point,
    };
  }
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

function selectionFor(document: VlezetDocument, ref: EditorEntityRef | null): EditorSelection {
  return sanitizeEditorSelection(document, replaceSelection(ref));
}

function concreteEntityRefs(document: VlezetDocument): EditorEntityRef[] {
  return [
    ...document.walls.map((wall) => ({ kind: "wall" as const, id: wall.id })),
    ...document.openings.map((opening) => ({ kind: "opening" as const, id: opening.id })),
    ...document.placedObjects.map((object) => ({ kind: "placed-object" as const, id: object.id })),
  ];
}

export function createEditorStore(options: CreateEditorStoreOptions = {}): StoreApi<EditorStoreState> {
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const defaultWallThicknessMm = options.defaultWallThicknessMm ?? 150;

  return createStore<EditorStoreState>((set, get) => ({
    history: createHistoryState(),
    tool: "select",
    selection: EMPTY_EDITOR_SELECTION,
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
        selection: EMPTY_EDITOR_SELECTION,
      });
    },
    replaceSelection: (ref) => set({
      selection: selectionFor(get().history.document, ref),
      placementPresetId: null,
      objectGesture: null,
    }),
    toggleSelection: (ref) => set({
      selection: sanitizeEditorSelection(
        get().history.document,
        toggleSelection(get().selection, ref),
      ),
      placementPresetId: null,
      objectGesture: null,
    }),
    addSelection: (refs) => set({
      selection: sanitizeEditorSelection(
        get().history.document,
        addToSelection(get().selection, refs),
      ),
      placementPresetId: null,
      objectGesture: null,
    }),
    clearSelection: () => set({ selection: EMPTY_EDITOR_SELECTION, objectGesture: null }),
    selectAllConcreteEntities: () => {
      const document = get().history.document;
      set({
        selection: addToSelection(EMPTY_EDITOR_SELECTION, concreteEntityRefs(document)),
        placementPresetId: null,
        objectGesture: null,
        tool: "select",
      });
    },
    selectWall: (wallId) => get().replaceSelection(wallId ? { kind: "wall", id: wallId } : null),
    selectRoom: (roomId) => get().replaceSelection(roomId ? { kind: "room", id: roomId } : null),
    selectOpening: (openingId) => get().replaceSelection(openingId ? { kind: "opening", id: openingId } : null),
    selectObject: (objectId) => {
      get().replaceSelection(objectId ? { kind: "placed-object", id: objectId } : null);
      if (objectId) set({ tool: "select" });
    },
    beginWall: (point, target = null) => {
      const resolved = targetPoint(point, target);
      set({
        draftWall: {
          start: resolved,
          end: resolved,
          snap: emptySnap(resolved),
          startTarget: target,
          endTarget: null,
        },
      });
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
      const edit = addTopologicalWall(before, {
        wallId,
        start,
        end,
        thickness: defaultWallThicknessMm,
      });
      const label = start.kind === "wall-junction" || end.kind === "wall-junction"
        ? "wall/add-t-junction"
        : "wall/add-connected";
      const history = executeCommand(get().history, {
        type: "document/replace",
        label,
        before,
        after: edit.document,
      });
      const continuation = edit.continuationVertexId
        ? getVertex(edit.document, edit.continuationVertexId)
        : null;
      const continuationTarget = continuation
        ? ({ kind: "vertex", vertexId: continuation.id, point: continuation.position } as const)
        : null;
      set({
        history,
        selection: selectionFor(edit.document, {
          kind: "wall",
          id: edit.selectedWallId ?? wallId,
        }),
        placementPresetId: null,
        draftWall: get().tool === "wall" && continuation
          ? {
              start: continuation.position,
              end: continuation.position,
              snap: emptySnap(continuation.position),
              startTarget: continuationTarget,
              endTarget: null,
            }
          : null,
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
      const { history, selection } = get();
      const wallId = selectedWallId(selection);
      if (!wallId) return;
      const before = history.document;
      const after = setTopologicalWallLength(before, wallId, lengthMm, anchor);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "wall/set-length",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
      });
    },
    setSelectedWallThickness: (thicknessMm, alignment = "center") => {
      const { history, selection } = get();
      const wallId = selectedWallId(selection);
      if (!wallId) return;
      const before = history.document;
      const after = setWallThickness(before, wallId, thicknessMm, alignment);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "wall/set-thickness",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
      });
    },
    setSelectedRoomName: (name) => {
      const { history, selection } = get();
      const roomId = selectedRoomId(selection);
      if (!roomId) return;
      const before = history.document;
      const after = setRoomName(before, roomId, name, idFactory("room-annotation"));
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "room-annotation/set-name",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
      });
    },
    setSelectedRoomClearDimension: (axis, lengthMm, anchor = "min") => {
      const { history, selection } = get();
      const roomId = selectedRoomId(selection);
      if (!roomId) return;
      const before = history.document;
      const after = setRectangularRoomClearDimension(before, roomId, axis, lengthMm, anchor);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "room/set-clear-dimension",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
      });
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
        ...(tool === "door"
          ? { doorSwing: { hinge: "start" as const, side: "left" as const } }
          : {}),
      };
      const before = history.document;
      const after = addOpening(before, opening);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "opening/add",
          before,
          after,
        }),
        selection: selectionFor(after, { kind: "opening", id: opening.id }),
      });
    },
    updateSelectedOpening: (patch) => {
      const { history, selection } = get();
      const openingId = selectedOpeningId(selection);
      if (!openingId) return;
      const before = history.document;
      const after = updateOpening(before, openingId, patch);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "opening/update",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
      });
    },
    deleteSelectedOpening: () => {
      const { history, selection } = get();
      const openingId = selectedOpeningId(selection);
      if (!openingId) return;
      const before = history.document;
      const after = deleteOpening(before, openingId);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "opening/delete",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
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
        history: executeCommand(history, {
          type: "document/replace",
          label: "object/add",
          before,
          after,
        }),
        selection: selectionFor(after, { kind: "placed-object", id: object.id }),
        placementPresetId: null,
        tool: "select",
      });
    },
    updateSelectedObject: (patch) => {
      const { history, selection } = get();
      const objectId = selectedObjectId(selection);
      if (!objectId) return;
      const before = history.document;
      const after = updatePlacedObject(before, objectId, patch);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "object/update",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
      });
    },
    rotateSelectedObject90: () => {
      const { history, selection } = get();
      const objectId = selectedObjectId(selection);
      if (!objectId) return;
      const current = history.document.placedObjects.find((object) => object.id === objectId);
      if (!current) return;
      const before = history.document;
      const after = updatePlacedObject(before, objectId, { rotationDeg: current.rotationDeg + 90 });
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "object/rotate",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
      });
    },
    duplicateSelectedObject: () => {
      const { history, selection } = get();
      const objectId = selectedObjectId(selection);
      if (!objectId) return;
      const duplicateId = idFactory("placed-object");
      const before = history.document;
      const after = duplicatePlacedObject(before, objectId, duplicateId);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "object/duplicate",
          before,
          after,
        }),
        selection: selectionFor(after, { kind: "placed-object", id: duplicateId }),
      });
    },
    deleteSelectedObject: () => {
      const { history, selection } = get();
      const objectId = selectedObjectId(selection);
      if (!objectId) return;
      const before = history.document;
      const after = deletePlacedObject(before, objectId);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "object/delete",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
        objectGesture: null,
      });
    },
    applyPlanningCandidate: (candidate) => {
      const { history } = get();
      const before = history.document;
      const after = applyPlanningCandidateEdit(before, candidate);
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: "planning/apply-candidate",
          before,
          after,
        }),
        selection: selectionFor(after, { kind: "room", id: candidate.roomId }),
        objectGesture: null,
        placementPresetId: null,
      });
    },
    beginObjectGesture: (objectId, kind) => {
      const object = get().history.document.placedObjects.find((candidate) => candidate.id === objectId);
      if (!object) throw new Error(`Placed object does not exist: ${objectId}`);
      set({
        objectGesture: { kind, objectId, before: object, preview: object },
        selection: selectionFor(get().history.document, { kind: "placed-object", id: objectId }),
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
      const { history, objectGesture, selection } = get();
      if (!objectGesture) return;
      if (objectsEqual(objectGesture.before, objectGesture.preview)) {
        set({ objectGesture: null });
        return;
      }
      const before = history.document;
      const after = updatePlacedObject(
        before,
        objectGesture.objectId,
        objectPatchFrom(objectGesture.preview),
      );
      set({
        history: executeCommand(history, {
          type: "document/replace",
          label: objectGesture.kind === "move" ? "object/move" : "object/update",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, selection),
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
        selection: sanitizeEditorSelection(history.document, current.selection),
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
        selection: sanitizeEditorSelection(history.document, current.selection),
      });
    },
  }));
}

export const editorStore = createEditorStore();