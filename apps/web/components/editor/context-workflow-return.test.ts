import { createEmptyDocument, createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import {
  captureEditorWorkflowReturnTarget,
  selectionForWorkflowReturnTarget,
  workflowReturnActionLabel,
} from "./context-workflow-return";

function documentFixture(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } },
      { id: "v2", position: { x: 4000, y: 0 } },
      { id: "v3", position: { x: 4000, y: 3000 } },
      { id: "v4", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "w1", startVertexId: "v1", endVertexId: "v2", junctionVertexIds: [], thickness: 100 },
      { id: "w2", startVertexId: "v2", endVertexId: "v3", junctionVertexIds: [], thickness: 100 },
      { id: "w3", startVertexId: "v3", endVertexId: "v4", junctionVertexIds: [], thickness: 100 },
      { id: "w4", startVertexId: "v4", endVertexId: "v1", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [{ id: "door-1", wallId: "w1", kind: "door", offset: 500, width: 900, doorSwing: { hinge: "start", side: "left" } }],
    roomAnnotations: [{ id: "room-label", name: "Гостиная", anchor: { x: 2000, y: 1500 } }],
    placedObjects: [createPlacedObject({
      id: "object-1", presetId: "sofa", name: "Диван", category: "seating",
      position: { x: 1200, y: 1200 }, width: 1800, depth: 900, rotationDeg: 0,
      clearance: { front: 600, right: 100, back: 100, left: 100 },
    })],
  };
}

const emptySelection = {
  selectedWallId: null,
  selectedRoomId: null,
  selectedOpeningId: null,
  selectedObjectId: null,
} as const;

describe("workflow return selection", () => {
  it("captures the currently selected semantic entity with user-facing labels", () => {
    const document = documentFixture();
    const room = deriveRooms(document).rooms[0]!;

    expect(captureEditorWorkflowReturnTarget({ ...emptySelection, selectedObjectId: "object-1" }, document)).toEqual({ kind: "object", objectId: "object-1", label: "Предмет «Диван»" });
    expect(captureEditorWorkflowReturnTarget({ ...emptySelection, selectedOpeningId: "door-1" }, document)).toEqual({ kind: "opening-door", openingId: "door-1", label: "Дверь" });
    expect(captureEditorWorkflowReturnTarget({ ...emptySelection, selectedRoomId: room.id }, document)).toEqual({ kind: "room", roomId: room.id, label: "Комната «Гостиная»" });
    expect(captureEditorWorkflowReturnTarget({ ...emptySelection, selectedWallId: "w1" }, document)).toEqual({ kind: "wall", wallId: "w1", label: "Стена" });
    expect(captureEditorWorkflowReturnTarget(emptySelection, document)).toEqual({ kind: "empty", label: "Ничего не выбрано" });
  });

  it("produces exactly one ordinary selection and fails closed for stale targets", () => {
    const document = documentFixture();
    const room = deriveRooms(document).rooms[0]!;

    expect(selectionForWorkflowReturnTarget({ kind: "room", roomId: room.id, label: "Комната «Гостиная»" }, document)).toEqual({
      selectedWallId: null, selectedRoomId: room.id, selectedOpeningId: null, selectedObjectId: null,
    });
    expect(selectionForWorkflowReturnTarget({ kind: "object", objectId: "object-1", label: "Предмет «Диван»" }, document)).toEqual({
      selectedWallId: null, selectedRoomId: null, selectedOpeningId: null, selectedObjectId: "object-1",
    });
    expect(selectionForWorkflowReturnTarget({ kind: "object", objectId: "deleted", label: "Предмет «Удалённый»" }, document)).toEqual(emptySelection);
  });

  it("uses an explicit back label rather than ambiguous close copy", () => {
    expect(workflowReturnActionLabel({ kind: "object", objectId: "object-1", label: "Предмет «Диван»" })).toBe("К предмету «Диван»");
    expect(workflowReturnActionLabel({ kind: "empty", label: "Ничего не выбрано" })).toBe("Закрыть workflow");
  });
});
