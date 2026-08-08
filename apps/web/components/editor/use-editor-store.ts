import { createPlacedObject, type PlacedObject } from "@vlezet/domain";
import {
  executeCommand,
  translatePlacedObjects,
  updatePlacedObject,
  type PlacedObjectPatch,
} from "@vlezet/editor-core";
import type { StoreApi } from "zustand/vanilla";
import {
  createEditorStore as createFoundationEditorStore,
  editorStore as foundationEditorStore,
  selectedObjectId,
  selectedOpeningId,
  selectedRoomId,
  selectedWallId,
  type CreateEditorStoreOptions,
  type EditorEntityIdKind,
  type EditorStoreState as FoundationEditorStoreState,
  type EditorTool,
  type DraftWall,
  type ObjectGestureKind,
  type TopologySnapTarget,
} from "./editor-store-foundation";
import {
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

export type EditorStoreState = Omit<
  FoundationEditorStoreState,
  | "objectGesture"
  | "beginObjectGesture"
  | "previewObjectGesture"
  | "commitObjectGesture"
  | "cancelObjectGesture"
> & {
  objectGesture: ObjectGesture | null;
  beginObjectGesture: (objectId: string, kind: ObjectGestureKind) => void;
  previewObjectGesture: (patch: PlacedObjectPatch) => void;
  commitObjectGesture: () => void;
  cancelObjectGesture: () => void;
};

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

function selectionForObject(
  state: EditorStoreState,
  objectId: string,
): EditorSelection {
  return sanitizeEditorSelection(
    state.history.document,
    replaceSelection({ kind: "placed-object", id: objectId }),
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

function enhanceEditorStore(
  foundation: StoreApi<FoundationEditorStoreState>,
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

  store.setState({
    beginObjectGesture,
    previewObjectGesture,
    commitObjectGesture,
    cancelObjectGesture: () => store.setState({ objectGesture: null }),
  });

  return store;
}

export function createEditorStore(
  options: CreateEditorStoreOptions = {},
): StoreApi<EditorStoreState> {
  return enhanceEditorStore(createFoundationEditorStore(options));
}

export const editorStore = enhanceEditorStore(foundationEditorStore);
