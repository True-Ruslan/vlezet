import { createEmptyDocument, createPlacedObject } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import { executeCommand, createHistoryState, undo, redo } from "./history";
import {
  addPlacedObject,
  deletePlacedObject,
  duplicatePlacedObject,
  movePlacedObject,
  resizePlacedObject,
  rotatePlacedObject,
  updatePlacedObject,
} from "./object-editing";

const bed = createPlacedObject({
  id: "bed",
  presetId: "double-bed",
  name: "Кровать",
  category: "sleep",
  position: { x: 2000, y: 1500 },
  width: 1600,
  depth: 2000,
  height: 450,
  rotationDeg: 0,
  clearance: { front: 700, right: 600, back: 0, left: 600 },
});

describe("placed object editing", () => {
  it("adds, moves, rotates and resizes without changing unrelated shell geometry", () => {
    const empty = createEmptyDocument();
    const added = addPlacedObject(empty, bed);
    expect(added.placedObjects).toEqual([bed]);
    expect(added.vertices).toBe(empty.vertices);

    const moved = movePlacedObject(added, "bed", { x: 3100, y: 2400 });
    expect(moved.placedObjects[0]?.position).toEqual({ x: 3100, y: 2400 });

    const rotated = rotatePlacedObject(moved, "bed", -90);
    expect(rotated.placedObjects[0]?.rotationDeg).toBe(270);

    const resized = resizePlacedObject(rotated, "bed", 1800, 2100);
    expect(resized.placedObjects[0]).toMatchObject({ width: 1800, depth: 2100 });
  });

  it("updates exact editable fields through one validated operation", () => {
    const document = addPlacedObject(createEmptyDocument(), bed);
    const updated = updatePlacedObject(document, "bed", {
      name: "Главная кровать",
      position: { x: 2500, y: 1700 },
      width: 1800,
      depth: 2100,
      height: 500,
      rotationDeg: 450,
      clearance: { front: 800, right: 650, back: 0, left: 650 },
    });
    expect(updated.placedObjects[0]).toMatchObject({
      name: "Главная кровать",
      position: { x: 2500, y: 1700 },
      width: 1800,
      depth: 2100,
      height: 500,
      rotationDeg: 90,
    });
  });

  it("duplicates with a stable new id and predictable offset", () => {
    const document = addPlacedObject(createEmptyDocument(), bed);
    const duplicated = duplicatePlacedObject(document, "bed", "bed-copy");
    expect(duplicated.placedObjects[1]).toEqual({
      ...bed,
      id: "bed-copy",
      position: { x: 2200, y: 1700 },
    });
  });

  it("deletes only the selected object", () => {
    const copy = { ...bed, id: "copy", position: { x: 4000, y: 1500 } };
    const document = addPlacedObject(addPlacedObject(createEmptyDocument(), bed), copy);
    expect(deletePlacedObject(document, "bed").placedObjects).toEqual([copy]);
  });

  it("rejects duplicate and missing ids", () => {
    const document = addPlacedObject(createEmptyDocument(), bed);
    expect(() => addPlacedObject(document, bed)).toThrow(/already exists/i);
    expect(() => movePlacedObject(document, "missing", { x: 0, y: 0 })).toThrow(/does not exist/i);
    expect(() => duplicatePlacedObject(document, "bed", "bed")).toThrow(/already exists/i);
  });

  it("supports one semantic history entry with exact undo and redo", () => {
    const initial = createHistoryState();
    const after = addPlacedObject(initial.document, bed);
    const executed = executeCommand(initial, {
      type: "document/replace",
      label: "object/add",
      before: initial.document,
      after,
    });
    expect(executed.past).toHaveLength(1);
    expect(undo(executed).document).toEqual(initial.document);
    expect(redo(undo(executed)).document).toEqual(after);
  });
});
