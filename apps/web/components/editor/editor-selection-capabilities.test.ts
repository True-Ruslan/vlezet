import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { replaceSelection, type EditorEntityRef, type EditorSelection } from "./editor-selection";
import { deriveSelectionCapabilities } from "./editor-selection-capabilities";

function capabilityDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
    ],
    walls: [
      { id: "wall-1", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
      { id: "wall-2", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 200 },
    ],
    openings: [
      { id: "opening-1", wallId: "wall-1", kind: "door", offset: 1200, width: 900 },
    ],
    roomAnnotations: [],
    placedObjects: ["object-1", "object-2", "object-3"].map((id, index) => ({
      id,
      presetId: null,
      name: `Стул ${index + 1}`,
      category: "chair" as const,
      position: { x: 800 + index * 900, y: 1200 },
      width: 500,
      depth: 500,
      rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    })),
  };
}

function standaloneWallDocument(): VlezetDocument {
  const document = capabilityDocument();
  return {
    ...document,
    vertices: document.vertices.filter((vertex) => vertex.id !== "c"),
    walls: document.walls.filter((wall) => wall.id === "wall-1"),
  };
}

function closedRoomDocument(): VlezetDocument {
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
      id: "object-1",
      presetId: null,
      name: "Диван",
      category: "chair",
      position: { x: 1800, y: 1800 },
      width: 1600,
      depth: 800,
      rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    }],
  };
}

function twoRoomDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 3000, y: 0 } },
      { id: "c", position: { x: 6000, y: 0 } },
      { id: "d", position: { x: 6000, y: 4000 } },
      { id: "e", position: { x: 3000, y: 4000 } },
      { id: "f", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "top-left", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "top-right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "right", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "bottom-right", startVertexId: "d", endVertexId: "e", junctionVertexIds: [], thickness: 180 },
      { id: "bottom-left", startVertexId: "e", endVertexId: "f", junctionVertexIds: [], thickness: 180 },
      { id: "left", startVertexId: "f", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
      { id: "divider", startVertexId: "b", endVertexId: "e", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  };
}

const ref = (kind: EditorEntityRef["kind"], id: string): EditorEntityRef => ({ kind, id });

function selection(...refs: EditorEntityRef[]): EditorSelection {
  return refs.length === 0
    ? { refs: [], primary: null }
    : { refs, primary: refs.at(-1)! };
}

const enabledState = (capabilities: ReturnType<typeof deriveSelectionCapabilities>) => ({
  copy: capabilities.copy.enabled,
  cut: capabilities.cut.enabled,
  paste: capabilities.paste.enabled,
  duplicate: capabilities.duplicate.enabled,
  delete: capabilities.delete.enabled,
  move: capabilities.move.enabled,
  rotate: capabilities.rotate.enabled,
  scale: capabilities.scale.enabled,
  wallThickness: capabilities.wallThickness.enabled,
});

describe("semantic selection capabilities", () => {
  const document = capabilityDocument();

  it.each([
    {
      name: "empty selection",
      selection: selection(),
      expected: { copy: false, cut: false, paste: false, duplicate: false, delete: false, move: false, rotate: false, scale: false, wallThickness: false },
    },
    {
      name: "one placed object",
      selection: replaceSelection(ref("placed-object", "object-1")),
      expected: { copy: true, cut: true, paste: false, duplicate: true, delete: true, move: true, rotate: true, scale: false, wallThickness: false },
    },
    {
      name: "three placed objects",
      selection: selection(
        ref("placed-object", "object-1"),
        ref("placed-object", "object-2"),
        ref("placed-object", "object-3"),
      ),
      expected: { copy: true, cut: true, paste: false, duplicate: true, delete: true, move: true, rotate: false, scale: false, wallThickness: false },
    },
    {
      name: "one wall from an open structural fragment",
      selection: replaceSelection(ref("wall", "wall-1")),
      expected: { copy: true, cut: false, paste: false, duplicate: true, delete: false, move: true, rotate: false, scale: false, wallThickness: false },
    },
    {
      name: "closed two-wall structural fragment",
      selection: selection(ref("wall", "wall-1"), ref("wall", "wall-2")),
      expected: { copy: true, cut: true, paste: false, duplicate: true, delete: true, move: false, rotate: false, scale: false, wallThickness: true },
    },
    {
      name: "wall plus opening",
      selection: selection(ref("wall", "wall-1"), ref("opening", "opening-1")),
      expected: { copy: false, cut: false, paste: false, duplicate: false, delete: false, move: false, rotate: false, scale: false, wallThickness: false },
    },
    {
      name: "furniture plus wall",
      selection: selection(ref("placed-object", "object-1"), ref("wall", "wall-1")),
      expected: { copy: true, cut: false, paste: false, duplicate: false, delete: false, move: false, rotate: false, scale: false, wallThickness: false },
    },
  ])("derives the fail-closed matrix for $name", ({ selection: currentSelection, expected }) => {
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: currentSelection,
      clipboardKind: null,
    });

    expect(enabledState(capabilities)).toEqual(expected);
  });

  it("enables Copy only for the approved mixed room/object family", () => {
    const roomDocument = closedRoomDocument();
    const room = deriveRooms(roomDocument).rooms[0]!;
    const supported = deriveSelectionCapabilities({
      document: roomDocument,
      selection: selection(ref("room", room.id), ref("placed-object", "object-1")),
      clipboardKind: null,
    });
    const unsupportedRoomWall = deriveSelectionCapabilities({
      document: roomDocument,
      selection: selection(ref("room", room.id), ref("wall", "top")),
      clipboardKind: null,
    });

    expect(supported.copy.enabled).toBe(true);
    expect(supported.cut.enabled).toBe(false);
    expect(supported.duplicate.enabled).toBe(false);
    expect(unsupportedRoomWall.copy.enabled).toBe(false);
    expect(unsupportedRoomWall.copy.reason).toMatch(/[А-Яа-яЁё]/);
  });

  it("rejects multiple room roots and standalone openings", () => {
    const twoRooms = twoRoomDocument();
    const rooms = deriveRooms(twoRooms).rooms;
    expect(rooms).toHaveLength(2);

    const multipleRooms = deriveSelectionCapabilities({
      document: twoRooms,
      selection: selection(ref("room", rooms[0]!.id), ref("room", rooms[1]!.id)),
      clipboardKind: null,
    });
    const openingOnly = deriveSelectionCapabilities({
      document,
      selection: replaceSelection(ref("opening", "opening-1")),
      clipboardKind: null,
    });

    expect(multipleRooms.copy.enabled).toBe(false);
    expect(openingOnly.copy.enabled).toBe(false);
  });

  it("enables all safe structural clipboard actions for a standalone wall, including Delete since its closure is safe", () => {
    const capabilities = deriveSelectionCapabilities({
      document: standaloneWallDocument(),
      selection: replaceSelection(ref("wall", "wall-1")),
      clipboardKind: null,
    });

    expect(capabilities.copy.enabled).toBe(true);
    expect(capabilities.cut.enabled).toBe(true);
    expect(capabilities.duplicate.enabled).toBe(true);
    expect(capabilities.move.enabled).toBe(true);
    expect(capabilities.delete.enabled).toBe(true);
  });

  it("keeps wall Delete exactly as safe as Cut: disabled with the same closure reason for an open fragment", () => {
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: replaceSelection(ref("wall", "wall-1")),
      clipboardKind: null,
    });

    expect(capabilities.cut.enabled).toBe(false);
    expect(capabilities.delete.enabled).toBe(false);
    expect(capabilities.delete.reason).toBe(capabilities.cut.reason);
  });

  it("gives a room-specific Delete reason instead of a generic structural-selection message", () => {
    const roomDocument = closedRoomDocument();
    const room = deriveRooms(roomDocument).rooms[0]!;
    const capabilities = deriveSelectionCapabilities({
      document: roomDocument,
      selection: replaceSelection(ref("room", room.id)),
      clipboardKind: null,
    });

    expect(capabilities.delete.enabled).toBe(false);
    expect(capabilities.delete.reason).toMatch(/удалить одной командой/);
  });

  it("makes paste depend on any supported clipboard kind rather than current selection", () => {
    for (const currentSelection of [
      selection(),
      replaceSelection(ref("wall", "wall-1")),
      selection(ref("placed-object", "object-1"), ref("wall", "wall-1")),
    ]) {
      const withoutClipboard = deriveSelectionCapabilities({
        document,
        selection: currentSelection,
        clipboardKind: null,
      });
      const withObjectClipboard = deriveSelectionCapabilities({
        document,
        selection: currentSelection,
        clipboardKind: "placed-objects",
      });
      const withStructuralClipboard = deriveSelectionCapabilities({
        document,
        selection: currentSelection,
        clipboardKind: "structural-fragment",
      });
      const withCompositeClipboard = deriveSelectionCapabilities({
        document,
        selection: currentSelection,
        clipboardKind: "composite-selection",
      });

      expect(withoutClipboard.paste.enabled).toBe(false);
      expect(withObjectClipboard.paste.enabled).toBe(true);
      expect(withStructuralClipboard.paste.enabled).toBe(true);
      expect(withCompositeClipboard.paste.enabled).toBe(true);
    }
  });

  it("keeps destructive Cut strict while non-destructive Copy and Duplicate project a safe wall fragment", () => {
    const structural = deriveSelectionCapabilities({
      document,
      selection: replaceSelection(ref("wall", "wall-1")),
      clipboardKind: null,
    });
    const mixed = deriveSelectionCapabilities({
      document,
      selection: selection(ref("placed-object", "object-1"), ref("wall", "wall-1")),
      clipboardKind: null,
    });

    expect(structural.copy.enabled).toBe(true);
    expect(structural.duplicate.enabled).toBe(true);
    expect(structural.cut.enabled).toBe(false);
    expect(structural.cut.reason).toContain("весь связанный фрагмент");
    expect(mixed.copy.enabled).toBe(true);
    expect(mixed.move.reason).toMatch(/[А-Яа-яЁё]/);
    expect(mixed.delete.reason).toMatch(/[А-Яа-яЁё]/);
  });

  it("does not grant capabilities to stale selection refs", () => {
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: replaceSelection(ref("placed-object", "missing-object")),
      clipboardKind: null,
    });

    expect(enabledState(capabilities)).toEqual({
      copy: false,
      cut: false,
      paste: false,
      duplicate: false,
      delete: false,
      move: false,
      rotate: false,
      scale: false,
      wallThickness: false,
    });
  });
});
