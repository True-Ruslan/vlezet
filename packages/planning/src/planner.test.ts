import { describe, expect, it } from "vitest";
import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import {
  MAX_SELECTED_PLANNING_OBJECTS,
  PlanningError,
  validatePlanningRequest,
} from "./contracts";

function rectangularDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
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
    openings: [],
    roomAnnotations: [],
    placedObjects: [
      {
        id: "sofa",
        presetId: null,
        name: "Диван",
        category: "seating",
        position: { x: 1200, y: 1000 },
        width: 1200,
        depth: 700,
        height: 850,
        rotationDeg: 0,
        clearance: { front: 300, right: 0, back: 0, left: 0 },
      },
      {
        id: "table",
        presetId: null,
        name: "Стол",
        category: "table",
        position: { x: 2900, y: 1800 },
        width: 900,
        depth: 600,
        height: 750,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
    ],
  };
}

function lShapedDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } },
      { id: "v2", position: { x: 4000, y: 0 } },
      { id: "v3", position: { x: 4000, y: 2000 } },
      { id: "v4", position: { x: 2500, y: 2000 } },
      { id: "v5", position: { x: 2500, y: 3500 } },
      { id: "v6", position: { x: 0, y: 3500 } },
    ],
    walls: [
      { id: "w1", startVertexId: "v1", endVertexId: "v2", junctionVertexIds: [], thickness: 100 },
      { id: "w2", startVertexId: "v2", endVertexId: "v3", junctionVertexIds: [], thickness: 100 },
      { id: "w3", startVertexId: "v3", endVertexId: "v4", junctionVertexIds: [], thickness: 100 },
      { id: "w4", startVertexId: "v4", endVertexId: "v5", junctionVertexIds: [], thickness: 100 },
      { id: "w5", startVertexId: "v5", endVertexId: "v6", junctionVertexIds: [], thickness: 100 },
      { id: "w6", startVertexId: "v6", endVertexId: "v1", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [
      {
        id: "chair",
        presetId: null,
        name: "Стул",
        category: "chair",
        position: { x: 1000, y: 1000 },
        width: 500,
        depth: 500,
        height: 900,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
    ],
  };
}

function roomId(document: VlezetDocument): string {
  const room = deriveRooms(document).rooms[0];
  if (!room) throw new Error("Expected fixture room");
  return room.id;
}

describe("validatePlanningRequest", () => {
  it("accepts one to three unique existing objects inside a rectangular target room", () => {
    const document = rectangularDocument();
    const context = validatePlanningRequest(document, {
      roomId: roomId(document),
      objectIds: ["sofa", "table"],
    });

    expect(context.room.id).toBe(roomId(document));
    expect(context.selectedObjects.map((object) => object.id)).toEqual(["sofa", "table"]);
  });

  it("fails closed for empty, duplicate or oversized object selections", () => {
    const document = rectangularDocument();
    const targetRoomId = roomId(document);

    for (const objectIds of [
      [],
      ["sofa", "sofa"],
      Array.from({ length: MAX_SELECTED_PLANNING_OBJECTS + 1 }, (_, index) => `object-${index}`),
    ]) {
      expect(() => validatePlanningRequest(document, { roomId: targetRoomId, objectIds }))
        .toThrowError(PlanningError);
    }
  });

  it("fails closed when room or selected object is missing", () => {
    const document = rectangularDocument();

    expect(() => validatePlanningRequest(document, { roomId: "missing-room", objectIds: ["sofa"] }))
      .toThrowError(expect.objectContaining({ code: "room-missing" }));
    expect(() => validatePlanningRequest(document, { roomId: roomId(document), objectIds: ["missing-object"] }))
      .toThrowError(expect.objectContaining({ code: "object-missing" }));
  });

  it("fails closed for a non-rectangular target room", () => {
    const document = lShapedDocument();

    expect(() => validatePlanningRequest(document, { roomId: roomId(document), objectIds: ["chair"] }))
      .toThrowError(expect.objectContaining({ code: "room-unsupported" }));
  });
});
