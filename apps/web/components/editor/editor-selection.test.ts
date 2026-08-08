import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import {
  EMPTY_EDITOR_SELECTION,
  addToSelection,
  clearSelection,
  replaceSelection,
  sameEditorEntity,
  sanitizeEditorSelection,
  toggleSelection,
  type EditorEntityRef,
  type EditorSelection,
} from "./editor-selection";

function selectionDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "shared", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 150 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 150 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 150 },
    ],
    openings: [
      { id: "door-1", wallId: "shared", kind: "door", offset: 1000, width: 900 },
    ],
    roomAnnotations: [],
    placedObjects: [
      {
        id: "shared",
        presetId: null,
        name: "Стол",
        category: "table",
        position: { x: 2000, y: 1500 },
        width: 1200,
        depth: 700,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
    ],
  };
}

const wall = (id: string): EditorEntityRef => ({ kind: "wall", id });
const objectRef = (id: string): EditorEntityRef => ({ kind: "placed-object", id });

describe("editor selection value model", () => {
  it("replaces selection with exactly one primary ref", () => {
    const ref = wall("wall-1");

    expect(replaceSelection(ref)).toEqual({ refs: [ref], primary: ref });
    expect(replaceSelection(null)).toEqual(EMPTY_EDITOR_SELECTION);
    expect(clearSelection()).toEqual(EMPTY_EDITOR_SELECTION);
  });

  it("toggle adds an entity and makes it primary", () => {
    const first = wall("wall-1");
    const second = objectRef("object-1");

    expect(toggleSelection(replaceSelection(first), second)).toEqual({
      refs: [first, second],
      primary: second,
    });
  });

  it("removing the primary chooses the last remaining ref", () => {
    const first = wall("wall-1");
    const second = objectRef("object-1");
    const third: EditorEntityRef = { kind: "opening", id: "opening-1" };
    const selection = addToSelection(replaceSelection(first), [second, third]);

    expect(toggleSelection(selection, third)).toEqual({
      refs: [first, second],
      primary: second,
    });
    expect(toggleSelection(replaceSelection(first), first)).toEqual(EMPTY_EDITOR_SELECTION);
  });

  it("never duplicates the same kind and id pair", () => {
    const ref = wall("shared");
    const selection = addToSelection(replaceSelection(ref), [ref, { ...ref }, ref]);

    expect(selection.refs).toEqual([ref]);
    expect(selection.primary).toEqual(ref);
  });

  it("preserves deterministic insertion order for additive selection", () => {
    const first = wall("wall-1");
    const second = objectRef("object-1");
    const third: EditorEntityRef = { kind: "opening", id: "opening-1" };

    const selection = addToSelection(replaceSelection(first), [third, second, third]);

    expect(selection.refs).toEqual([first, third, second]);
    expect(selection.primary).toEqual(second);
  });

  it("sanitises deleted refs while preserving surviving order across entity kinds", () => {
    const document = selectionDocument();
    const roomId = deriveRooms(document).rooms[0]?.id;
    expect(roomId).toBeTruthy();

    const refs: EditorEntityRef[] = [
      objectRef("shared"),
      { kind: "opening", id: "missing-opening" },
      wall("shared"),
      { kind: "vertex", id: "a" },
      { kind: "room", id: roomId! },
      { kind: "opening", id: "door-1" },
      { kind: "placed-object", id: "missing-object" },
    ];
    const selection: EditorSelection = { refs, primary: refs[5]! };

    expect(sanitizeEditorSelection(document, selection)).toEqual({
      refs: [objectRef("shared"), wall("shared"), { kind: "vertex", id: "a" }, { kind: "room", id: roomId! }, { kind: "opening", id: "door-1" }],
      primary: { kind: "opening", id: "door-1" },
    });
  });

  it("falls back deterministically when sanitisation removes the primary", () => {
    const document = selectionDocument();
    const selection: EditorSelection = {
      refs: [wall("shared"), { kind: "opening", id: "missing" }, objectRef("shared")],
      primary: { kind: "opening", id: "missing" },
    };

    expect(sanitizeEditorSelection(document, selection)).toEqual({
      refs: [wall("shared"), objectRef("shared")],
      primary: objectRef("shared"),
    });
  });

  it("keeps identical string ids distinct when entity kinds differ", () => {
    const wallRef = wall("shared");
    const placedObjectRef = objectRef("shared");

    expect(sameEditorEntity(wallRef, placedObjectRef)).toBe(false);
    expect(addToSelection(replaceSelection(wallRef), [placedObjectRef]).refs).toEqual([
      wallRef,
      placedObjectRef,
    ]);
  });

  it("does not mutate caller-owned selection arrays", () => {
    const first = wall("wall-1");
    const originalRefs = Object.freeze<EditorEntityRef[]>([first]);
    const selection: EditorSelection = { refs: originalRefs, primary: first };

    const result = addToSelection(selection, [objectRef("object-1")]);

    expect(originalRefs).toEqual([first]);
    expect(result.refs).toEqual([first, objectRef("object-1")]);
    expect(result.refs).not.toBe(originalRefs);
  });
});
