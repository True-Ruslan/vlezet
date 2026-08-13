import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import type { EditorEntityRef, EditorSelection } from "./editor-selection";
import { deriveSelectionCapabilities } from "./editor-selection-capabilities";

const ref = (kind: EditorEntityRef["kind"], id: string): EditorEntityRef => ({ kind, id });
const selection = (...refs: EditorEntityRef[]): EditorSelection => ({
  refs,
  primary: refs.at(-1) ?? null,
});

function isolatedRoom(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 5000, y: 0 } },
      { id: "c", position: { x: 5000, y: 4000 } },
      { id: "d", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [{
      id: "chair",
      presetId: null,
      name: "Стул",
      category: "chair",
      position: { x: 1600, y: 1500 },
      width: 500,
      depth: 500,
      rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    }],
  };
}

function adjacentRooms(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
      { id: "e", position: { x: 8000, y: 0 } },
      { id: "f", position: { x: 8000, y: 3000 } },
    ],
    walls: [
      { id: "ab", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "shared", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "cd", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "da", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
      { id: "be", startVertexId: "b", endVertexId: "e", junctionVertexIds: [], thickness: 180 },
      { id: "ef", startVertexId: "e", endVertexId: "f", junctionVertexIds: [], thickness: 180 },
      { id: "fc", startVertexId: "f", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  };
}

describe("M8.2 room translation capabilities", () => {
  it("enables room move and room furniture helper for an independently movable room", () => {
    const document = isolatedRoom();
    const room = deriveRooms(document).rooms[0]!;
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: selection(ref("room", room.id)),
      clipboardKind: null,
    });

    expect(capabilities.move.enabled).toBe(true);
    expect(capabilities.selectFurnitureInRoom.enabled).toBe(true);
  });

  it("enables one rigid room+explicit-furniture move while keeping other mixed mutations strict", () => {
    const document = isolatedRoom();
    const room = deriveRooms(document).rooms[0]!;
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: selection(ref("room", room.id), ref("placed-object", "chair")),
      clipboardKind: null,
    });

    expect(capabilities.move.enabled).toBe(true);
    expect(capabilities.selectFurnitureInRoom.enabled).toBe(true);
    expect(capabilities.cut.enabled).toBe(false);
    expect(capabilities.delete.enabled).toBe(false);
    expect(capabilities.rotate.enabled).toBe(false);
    expect(capabilities.scale.enabled).toBe(false);
  });

  it("keeps unsafe shared topology fail-closed for move while still allowing explicit furniture selection", () => {
    const document = adjacentRooms();
    const room = [...deriveRooms(document).rooms]
      .sort((first, second) => first.labelPoint.x - second.labelPoint.x)[0]!;
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: selection(ref("room", room.id)),
      clipboardKind: null,
    });

    expect(capabilities.move.enabled).toBe(false);
    expect(capabilities.move.reason).toMatch(/общ|сосед|связан/i);
    expect(capabilities.selectFurnitureInRoom.enabled).toBe(true);
  });

  it("does not offer room move/helper for ambiguous room roots", () => {
    const isolated = isolatedRoom();
    const room = deriveRooms(isolated).rooms[0]!;
    const roomWithWall = deriveSelectionCapabilities({
      document: isolated,
      selection: selection(ref("room", room.id), ref("wall", "top")),
      clipboardKind: null,
    });

    const adjacent = adjacentRooms();
    const rooms = deriveRooms(adjacent).rooms;
    const multipleRooms = deriveSelectionCapabilities({
      document: adjacent,
      selection: selection(ref("room", rooms[0]!.id), ref("room", rooms[1]!.id)),
      clipboardKind: null,
    });

    expect(roomWithWall.move.enabled).toBe(false);
    expect(roomWithWall.selectFurnitureInRoom.enabled).toBe(false);
    expect(multipleRooms.move.enabled).toBe(false);
    expect(multipleRooms.selectFurnitureInRoom.enabled).toBe(false);
  });
});
