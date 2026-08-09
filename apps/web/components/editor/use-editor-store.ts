import { createPlacedObject, type PlacedObject, type Point2, type VlezetDocument } from "@vlezet/domain";
import {
  addPlacedObjects,
  createStructuralClipboardPayload,
  cutStructuralFragment,
  deletePlacedObjects,
  evaluateStructuralClipboardClosure,
  evaluateStructuralVertexMove,
  evaluateStructuralWallTranslation,
  evaluateWallThicknessBatch,
  executeCommand,
  pasteStructuralFragment,
  translatePlacedObjects,
  updatePlacedObject,
  type PlacedObjectPatch,
} from "@vlezet/editor-core";
import type { StoreApi } from "zustand/vanilla";
import {
  createEditorStore as createFoundationEditorStore,
  selectedObjectId,
  selectedOpeningId,
  selectedRoomId,
  selectedWallId,
  type CreateEditorStoreOptions,
  type EditorEntityIdKind,
  type EditorStoreState as FoundationEditorStoreState,
  type EditorTool,
  type DraftWall,
  type TopologySnapTarget,
} from "./editor-store-foundation";
import {
  EMPTY_EDITOR_CLIPBOARD_STATE,
  createPlacedObjectClipboardPayload,
  derivePasteObjects,
  type EditorClipboardState,
} from "./editor-clipboard";
import {
  addToSelection,
  replaceSelection,
  sameEditorEntity,
  sanitizeEditorSelection,
  type EditorEntityRef,
  type EditorSelection,
} from "./editor-selection";

export {
  selectedObjectId,
  selectedOpeningId,
  selectedRoomId,
  selectedWallId,
};
export type {
  CreateEditorStoreOptions,
  DraftWall,
  EditorEntityIdKind,
  EditorTool,
  TopologySnapTarget,
};

export type ObjectGestureKind = "move" | "transform";

export type ObjectMoveGesture = Readonly<{
  kind: "move";
  anchorObjectId: string;
  objectIds: readonly string[];
  before: readonly PlacedObject[];
  preview: readonly PlacedObject[];
}>;

export type ObjectTransformGesture = Readonly<{
  kind: "transform";
  objectId: string;
  before: PlacedObject;
  preview: PlacedObject;
}>;

export type ObjectGesture = ObjectMoveGesture | ObjectTransformGesture;

export type StructuralGesture = Readonly<{
  kind: "move-vertex" | "translate-wall";
  entityId: string;
  before: VlezetDocument;
  previewDocument: VlezetDocument;
  valid: boolean;
  reason: string | null;
  changed: boolean;
}>;

export type EditorStoreState = Omit<
  FoundationEditorStoreState,
  | "objectGesture"
  | "beginObjectGesture"
  | "previewObjectGesture"
  | "commitObjectGesture"
  | "cancelObjectGesture"
> & {
  objectGesture: ObjectGesture | null;
  structuralGesture: StructuralGesture | null;
  clipboard: EditorClipboardState;
  beginObjectGesture: (objectId: string, kind: ObjectGestureKind) => void;
  previewObjectGesture: (patch: PlacedObjectPatch) => void;
  commitObjectGesture: () => void;
  cancelObjectGesture: () => void;
  beginStructuralVertexGesture: (vertexId: string) => void;
  beginStructuralWallGesture: (wallId: string) => void;
  previewStructuralVertexGesture: (position: Point2) => void;
  previewStructuralWallGesture: (delta: Point2) => void;
  commitStructuralGesture: () => void;
  cancelStructuralGesture: () => void;
  setSelectedWallsThickness: (thicknessMm: number) => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: (anchor: Point2) => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
};

const STRUCTURAL_PASTE_OFFSET_MM = 250;

function objectById(
  state: EditorStoreState,
  objectId: string,
): PlacedObject {
  const object = state.history.document.placedObjects.find((candidate) => candidate.id === objectId);
  if (!object) throw new Error(`Placed object does not exist: ${objectId}`);
  return object;
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

function selectedPlacedObjectIds(selection: EditorSelection): readonly string[] | null {
  if (selection.refs.length === 0) return null;
  if (selection.refs.some((ref) => ref.kind !== "placed-object")) return null;
  return selection.refs.map((ref) => ref.id);
}

function selectedWallIds(selection: EditorSelection): readonly string[] | null {
  if (selection.refs.length === 0) return null;
  if (selection.refs.some((ref) => ref.kind !== "wall")) return null;
  return selection.refs.map((ref) => ref.id);
}

function selectedPlacedObjects(state: EditorStoreState): readonly PlacedObject[] | null {
  const objectIds = selectedPlacedObjectIds(state.selection);
  if (!objectIds) return null;
  const byId = new Map(state.history.document.placedObjects.map((object) => [object.id, object]));
  const objects: PlacedObject[] = [];
  for (const objectId of objectIds) {
    const object = byId.get(objectId);
    if (!object) return null;
    objects.push(object);
  }
  return objects;
}

function selectionForObject(
  state: EditorStoreState,
  objectId: string,
): EditorSelection {
  return sanitizeEditorSelection(
    state.history.document,
    replaceSelection({ kind: "placed-object", id: objectId }),
  );
}

function selectionForPlacedObjects(
  objects: readonly PlacedObject[],
): EditorSelection {
  const [first, ...rest] = objects;
  if (!first) return { refs: [], primary: null };
  return addToSelection(
    replaceSelection({ kind: "placed-object", id: first.id }),
    rest.map((object) => ({ kind: "placed-object" as const, id: object.id })),
  );
}

function selectionForWalls(
  document: VlezetDocument,
  wallIds: readonly string[],
): EditorSelection {
  const [first, ...rest] = wallIds;
  if (!first) return { refs: [], primary: null };
  return sanitizeEditorSelection(
    document,
    addToSelection(
      replaceSelection({ kind: "wall", id: first }),
      rest.map((id) => ({ kind: "wall" as const, id })),
    ),
  );
}

function selectionWithPrimary(
  selection: EditorSelection,
  primary: EditorEntityRef,
): EditorSelection {
  return {
    refs: [...selection.refs],
    primary,
  };
}

function samePoint(first: Point2 | null, second: Point2): boolean {
  return first !== null && first.x === second.x && first.y === second.y;
}

function structuralSelectionBounds(document: VlezetDocument, wallIds: readonly string[]) {
  const selected = new Set(wallIds);
  const vertexIds = new Set<string>();
  for (const wall of document.walls) {
    if (!selected.has(wall.id)) continue;
    vertexIds.add(wall.startVertexId);
    vertexIds.add(wall.endVertexId);
    for (const junctionId of wall.junctionVertexIds) vertexIds.add(junctionId);
  }
  const vertices = document.vertices.filter((vertex) => vertexIds.has(vertex.id));
  if (vertices.length === 0) return null;
  return {
    minX: Math.min(...vertices.map((vertex) => vertex.position.x)),
    minY: Math.min(...vertices.map((vertex) => vertex.position.y)),
    maxX: Math.max(...vertices.map((vertex) => vertex.position.x)),
    maxY: Math.max(...vertices.map((vertex) => vertex.position.y)),
  };
}

function enhanceEditorStore(
  foundation: StoreApi<FoundationEditorStoreState>,
  idFactory: (kind: EditorEntityIdKind) => string,
): StoreApi<EditorStoreState> {
  const store = foundation as unknown as StoreApi<EditorStoreState>;

  const beginObjectGesture = (objectId: string, kind: ObjectGestureKind) => {
    const state = store.getState();
    const object = objectById(state, objectId);
    const objectRef: EditorEntityRef = { kind: "placed-object", id: objectId };

    if (kind === "transform") {
      store.setState({
        objectGesture: {
          kind: "transform",
          objectId,
          before: object,
          preview: object,
        },
        structuralGesture: null,
        selection: selectionForObject(state, objectId),
        placementPresetId: null,
        tool: "select",
      });
      return;
    }

    const anchorSelected = state.selection.refs.some((ref) => sameEditorEntity(ref, objectRef));
    if (anchorSelected) {
      const objectIds = selectedPlacedObjectIds(state.selection);
      if (!objectIds) return;
      const before = objectIds.map((id) => objectById(state, id));
      store.setState({
        objectGesture: {
          kind: "move",
          anchorObjectId: objectId,
          objectIds,
          before,
          preview: before,
        },
        structuralGesture: null,
        selection: selectionWithPrimary(state.selection, objectRef),
        placementPresetId: null,
        tool: "select",
      });
      return;
    }

    store.setState({
      objectGesture: {
        kind: "move",
        anchorObjectId: objectId,
        objectIds: [objectId],
        before: [object],
        preview: [object],
      },
      structuralGesture: null,
      selection: selectionForObject(state, objectId),
      placementPresetId: null,
      tool: "select",
    });
  };

  const previewObjectGesture = (patch: PlacedObjectPatch) => {
    const gesture = store.getState().objectGesture;
    if (!gesture) return;

    if (gesture.kind === "move") {
      if (!patch.position) return;
      const anchor = gesture.before.find((object) => object.id === gesture.anchorObjectId);
      if (!anchor) throw new Error(`Move anchor does not exist: ${gesture.anchorObjectId}`);
      const delta = {
        x: patch.position.x - anchor.position.x,
        y: patch.position.y - anchor.position.y,
      };
      const preview = gesture.before.map((object) => createPlacedObject({
        ...object,
        position: {
          x: object.position.x + delta.x,
          y: object.position.y + delta.y,
        },
      }));
      store.setState({ objectGesture: { ...gesture, preview } });
      return;
    }

    const preview = createPlacedObject({
      ...gesture.preview,
      ...patch,
      id: gesture.before.id,
      presetId: gesture.before.presetId,
      category: gesture.before.category,
      position: patch.position ? { ...patch.position } : gesture.preview.position,
      clearance: patch.clearance ? { ...patch.clearance } : gesture.preview.clearance,
    });
    store.setState({ objectGesture: { ...gesture, preview } });
  };

  const commitObjectGesture = () => {
    const state = store.getState();
    const gesture = state.objectGesture;
    if (!gesture) return;

    if (gesture.kind === "move") {
      const anchorBefore = gesture.before.find((object) => object.id === gesture.anchorObjectId);
      const anchorPreview = gesture.preview.find((object) => object.id === gesture.anchorObjectId);
      if (!anchorBefore || !anchorPreview) throw new Error("Move anchor preview is incomplete");
      const delta = {
        x: anchorPreview.position.x - anchorBefore.position.x,
        y: anchorPreview.position.y - anchorBefore.position.y,
      };
      if (delta.x === 0 && delta.y === 0) {
        store.setState({ objectGesture: null });
        return;
      }
      const before = state.history.document;
      const after = translatePlacedObjects(before, gesture.objectIds, delta);
      store.setState({
        history: executeCommand(state.history, {
          type: "document/replace",
          label: "object/batch-move",
          before,
          after,
        }),
        selection: sanitizeEditorSelection(after, state.selection),
        objectGesture: null,
      });
      return;
    }

    if (objectsEqual(gesture.before, gesture.preview)) {
      store.setState({ objectGesture: null });
      return;
    }
    const before = state.history.document;
    const after = updatePlacedObject(before, gesture.objectId, objectPatchFrom(gesture.preview));
    store.setState({
      history: executeCommand(state.history, {
        type: "document/replace",
        label: "object/update",
        before,
        after,
      }),
      selection: sanitizeEditorSelection(after, state.selection),
      objectGesture: null,
    });
  };

  const beginStructuralVertexGesture = (vertexId: string) => {
    const state = store.getState();
    if (!state.history.document.vertices.some((vertex) => vertex.id === vertexId)) return;
    store.setState({
      structuralGesture: {
        kind: "move-vertex",
        entityId: vertexId,
        before: state.history.document,
        previewDocument: state.history.document,
        valid: true,
        reason: null,
        changed: false,
      },
      objectGesture: null,
      placementPresetId: null,
      selection: sanitizeEditorSelection(
        state.history.document,
        replaceSelection({ kind: "vertex", id: vertexId }),
      ),
      tool: "select",
    });
  };

  const beginStructuralWallGesture = (wallId: string) => {
    const state = store.getState();
    if (!state.history.document.walls.some((wall) => wall.id === wallId)) return;
    store.setState({
      structuralGesture: {
        kind: "translate-wall",
        entityId: wallId,
        before: state.history.document,
        previewDocument: state.history.document,
        valid: true,
        reason: null,
        changed: false,
      },
      objectGesture: null,
      placementPresetId: null,
      selection: sanitizeEditorSelection(
        state.history.document,
        replaceSelection({ kind: "wall", id: wallId }),
      ),
      tool: "select",
    });
  };

  const previewStructuralVertexGesture = (position: Point2) => {
    const gesture = store.getState().structuralGesture;
    if (!gesture || gesture.kind !== "move-vertex") return;
    const source = gesture.before.vertices.find((vertex) => vertex.id === gesture.entityId);
    if (!source) return;
    const result = evaluateStructuralVertexMove(gesture.before, gesture.entityId, position);
    store.setState({
      structuralGesture: {
        ...gesture,
        previewDocument: result.ok ? result.document : (result.candidate ?? gesture.before),
        valid: result.ok,
        reason: result.ok ? null : result.reason,
        changed: source.position.x !== position.x || source.position.y !== position.y,
      },
    });
  };

  const previewStructuralWallGesture = (delta: Point2) => {
    const gesture = store.getState().structuralGesture;
    if (!gesture || gesture.kind !== "translate-wall") return;
    const result = evaluateStructuralWallTranslation(gesture.before, gesture.entityId, delta);
    store.setState({
      structuralGesture: {
        ...gesture,
        previewDocument: result.ok ? result.document : (result.candidate ?? gesture.before),
        valid: result.ok,
        reason: result.ok ? null : result.reason,
        changed: delta.x !== 0 || delta.y !== 0,
      },
    });
  };

  const commitStructuralGesture = () => {
    const state = store.getState();
    const gesture = state.structuralGesture;
    if (!gesture) return;
    if (!gesture.valid) return;
    if (!gesture.changed) {
      store.setState({ structuralGesture: null });
      return;
    }
    if (state.history.document !== gesture.before) {
      store.setState({
        structuralGesture: {
          ...gesture,
          valid: false,
          reason: "Документ изменился во время структурного жеста",
        },
      });
      return;
    }
    const after = gesture.previewDocument;
    store.setState({
      history: executeCommand(state.history, {
        type: "document/replace",
        label: gesture.kind === "move-vertex" ? "vertex/move-structural" : "wall/translate",
        before: gesture.before,
        after,
      }),
      selection: sanitizeEditorSelection(after, state.selection),
      structuralGesture: null,
      objectGesture: null,
      placementPresetId: null,
    });
  };

  const setSelectedWallsThickness = (thicknessMm: number) => {
    const state = store.getState();
    const wallIds = selectedWallIds(state.selection);
    if (!wallIds) return;
    const before = state.history.document;
    const result = evaluateWallThicknessBatch(before, wallIds, thicknessMm);
    if (!result.ok || result.document === before) return;
    store.setState({
      history: executeCommand(state.history, {
        type: "document/replace",
        label: "wall/batch-set-thickness",
        before,
        after: result.document,
      }),
      selection: sanitizeEditorSelection(result.document, state.selection),
      structuralGesture: null,
    });
  };

  const copySelection = () => {
    const state = store.getState();
    const objects = selectedPlacedObjects(state);
    if (objects) {
      store.setState({
        clipboard: {
          payload: createPlacedObjectClipboardPayload(objects),
          lastPasteAnchor: null,
          repeatedPasteCount: 0,
        },
      });
      return;
    }

    const wallIds = selectedWallIds(state.selection);
    if (!wallIds) return;
    const closure = evaluateStructuralClipboardClosure(state.history.document, wallIds);
    if (!closure.ok) return;
    store.setState({
      clipboard: {
        payload: createStructuralClipboardPayload(state.history.document, closure.wallIds),
        lastPasteAnchor: null,
        repeatedPasteCount: 0,
      },
    });
  };

  const cutSelection = () => {
    const state = store.getState();
    const objects = selectedPlacedObjects(state);
    if (objects) {
      const payload = createPlacedObjectClipboardPayload(objects);
      const before = state.history.document;
      const after = deletePlacedObjects(before, objects.map((object) => object.id));
      store.setState({
        history: executeCommand(state.history, {
          type: "document/replace",
          label: "object/batch-delete",
          before,
          after,
        }),
        clipboard: {
          payload,
          lastPasteAnchor: null,
          repeatedPasteCount: 0,
        },
        selection: sanitizeEditorSelection(after, state.selection),
        objectGesture: null,
        structuralGesture: null,
        placementPresetId: null,
        tool: "select",
      });
      return;
    }

    const wallIds = selectedWallIds(state.selection);
    if (!wallIds) return;
    let result: ReturnType<typeof cutStructuralFragment>;
    try {
      result = cutStructuralFragment(state.history.document, wallIds);
    } catch {
      return;
    }
    store.setState({
      history: executeCommand(state.history, {
        type: "document/replace",
        label: "structure/cut",
        before: state.history.document,
        after: result.document,
      }),
      clipboard: {
        payload: result.payload,
        lastPasteAnchor: null,
        repeatedPasteCount: 0,
      },
      selection: sanitizeEditorSelection(result.document, state.selection),
      objectGesture: null,
      structuralGesture: null,
      placementPresetId: null,
      tool: "select",
    });
  };

  const deleteSelection = () => {
    const state = store.getState();
    const objects = selectedPlacedObjects(state);
    if (!objects) return;
    const before = state.history.document;
    const after = deletePlacedObjects(before, objects.map((object) => object.id));
    store.setState({
      history: executeCommand(state.history, {
        type: "document/replace",
        label: "object/batch-delete",
        before,
        after,
      }),
      selection: sanitizeEditorSelection(after, state.selection),
      objectGesture: null,
      structuralGesture: null,
      placementPresetId: null,
      tool: "select",
    });
  };

  const pasteClipboard = (anchor: Point2) => {
    const state = store.getState();
    const payload = state.clipboard.payload;
    if (!payload) return;
    const repetition = samePoint(state.clipboard.lastPasteAnchor, anchor)
      ? state.clipboard.repeatedPasteCount
      : 0;

    if (payload.kind === "placed-objects") {
      const pasted = derivePasteObjects({
        payload,
        anchor,
        repetition,
        idFactory: () => idFactory("placed-object"),
      });
      const before = state.history.document;
      const after = addPlacedObjects(before, pasted);
      store.setState({
        history: executeCommand(state.history, {
          type: "document/replace",
          label: "object/batch-add",
          before,
          after,
        }),
        clipboard: {
          payload,
          lastPasteAnchor: { ...anchor },
          repeatedPasteCount: repetition + 1,
        },
        selection: selectionForPlacedObjects(pasted),
        objectGesture: null,
        structuralGesture: null,
        placementPresetId: null,
        tool: "select",
      });
      return;
    }

    const effectiveAnchor = {
      x: anchor.x + repetition * STRUCTURAL_PASTE_OFFSET_MM,
      y: anchor.y + repetition * STRUCTURAL_PASTE_OFFSET_MM,
    };
    let pasted: ReturnType<typeof pasteStructuralFragment>;
    try {
      pasted = pasteStructuralFragment(
        state.history.document,
        payload,
        effectiveAnchor,
        (kind) => idFactory(kind),
      );
    } catch {
      return;
    }
    store.setState({
      history: executeCommand(state.history, {
        type: "document/replace",
        label: "structure/paste",
        before: state.history.document,
        after: pasted.document,
      }),
      clipboard: {
        payload,
        lastPasteAnchor: { ...anchor },
        repeatedPasteCount: repetition + 1,
      },
      selection: selectionForWalls(pasted.document, pasted.wallIds),
      objectGesture: null,
      structuralGesture: null,
      placementPresetId: null,
      tool: "select",
    });
  };

  const duplicateSelection = () => {
    const state = store.getState();
    const objects = selectedPlacedObjects(state);
    if (objects) {
      const payload = createPlacedObjectClipboardPayload(objects);
      const duplicated = derivePasteObjects({
        payload,
        anchor: payload.copiedAtOrigin,
        repetition: 1,
        idFactory: () => idFactory("placed-object"),
      });
      const before = state.history.document;
      const after = addPlacedObjects(before, duplicated);
      store.setState({
        history: executeCommand(state.history, {
          type: "document/replace",
          label: "object/batch-add",
          before,
          after,
        }),
        selection: selectionForPlacedObjects(duplicated),
        objectGesture: null,
        structuralGesture: null,
        placementPresetId: null,
        tool: "select",
      });
      return;
    }

    const wallIds = selectedWallIds(state.selection);
    if (!wallIds) return;
    const closure = evaluateStructuralClipboardClosure(state.history.document, wallIds);
    if (!closure.ok) return;
    const bounds = structuralSelectionBounds(state.history.document, closure.wallIds);
    if (!bounds) return;
    const payload = createStructuralClipboardPayload(state.history.document, closure.wallIds);
    const offset = Math.max(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      STRUCTURAL_PASTE_OFFSET_MM,
    ) + STRUCTURAL_PASTE_OFFSET_MM;
    let pasted: ReturnType<typeof pasteStructuralFragment>;
    try {
      pasted = pasteStructuralFragment(
        state.history.document,
        payload,
        { x: payload.origin.x + offset, y: payload.origin.y + offset },
        (kind) => idFactory(kind),
      );
    } catch {
      return;
    }
    store.setState({
      history: executeCommand(state.history, {
        type: "document/replace",
        label: "structure/paste",
        before: state.history.document,
        after: pasted.document,
      }),
      selection: selectionForWalls(pasted.document, pasted.wallIds),
      objectGesture: null,
      structuralGesture: null,
      placementPresetId: null,
      tool: "select",
    });
  };

  store.setState({
    clipboard: EMPTY_EDITOR_CLIPBOARD_STATE,
    structuralGesture: null,
    beginObjectGesture,
    previewObjectGesture,
    commitObjectGesture,
    cancelObjectGesture: () => store.setState({ objectGesture: null }),
    beginStructuralVertexGesture,
    beginStructuralWallGesture,
    previewStructuralVertexGesture,
    previewStructuralWallGesture,
    commitStructuralGesture,
    cancelStructuralGesture: () => store.setState({ structuralGesture: null }),
    setSelectedWallsThickness,
    copySelection,
    cutSelection,
    pasteClipboard,
    duplicateSelection,
    deleteSelection,
  });

  return store;
}

export function createEditorStore(
  options: CreateEditorStoreOptions = {},
): StoreApi<EditorStoreState> {
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const foundation = createFoundationEditorStore({ ...options, idFactory });
  return enhanceEditorStore(foundation, idFactory);
}

export const editorStore = createEditorStore();