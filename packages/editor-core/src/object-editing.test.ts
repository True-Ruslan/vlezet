import { createEmptyDocument, createPlacedObject } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import { executeCommand, createHistoryState, undo, redo } from "./history";
import {
  addPlacedObject,
  addPlacedObjects,
  deletePlacedObject,
  deletePlacedObjects,
  duplicatePlacedObject,
  movePlacedObject,
  resizePlacedObject,
  rotatePlacedObject,
  translatePlacedObjects,
  updatePlacedObject,
  updatePlacedObjects,
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

const table = createPlacedObject({
  id: "table",
  presetId: "desk",
  name: "Стол",
  category: "work",
  position: { x: 4600, y: 1800 },
  width: 1400,
  depth: 700,
  height: 750,
  rotationDeg: 90,
  clearance: { front: 800, right: 0, back: 0, left: 0 },
});

function furnishedDocument() {
  return addPlacedObject(addPlacedObject(createEmptyDocument(), bed), table);
}

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

describe("atomic placed-object batch editing", () => {
  it("translates two objects rigidly without changing relative geometry or physical fields", () => {
    const document = furnishedDocument();
    const beforeVector = {
      x: table.position.x - bed.position.x,
      y: table.position.y - bed.position.y,
    };

    const moved = translatePlacedObjects(document, ["bed", "table"], { x: 350, y: -225 });
    const movedBed = moved.placedObjects.find((object) => object.id === "bed")!;
    const movedTable = moved.placedObjects.find((object) => object.id === "table")!;

    expect(movedBed.position).toEqual({ x: 2350, y: 1275 });
    expect(movedTable.position).toEqual({ x: 4950, y: 1575 });
    expect({
      x: movedTable.position.x - movedBed.position.x,
      y: movedTable.position.y - movedBed.position.y,
    }).toEqual(beforeVector);
    expect(movedBed).toMatchObject({ width: bed.width, depth: bed.depth, rotationDeg: bed.rotationDeg });
    expect(movedTable).toMatchObject({ width: table.width, depth: table.depth, rotationDeg: table.rotationDeg });
    expect(document.placedObjects).toEqual([bed, table]);
  });

  it("updates a batch atomically and preserves document object order", () => {
    const document = furnishedDocument();
    const updated = updatePlacedObjects(document, [
      { objectId: "table", patch: { name: "Рабочий стол", rotationDeg: 450 } },
      { objectId: "bed", patch: { width: 1800 } },
    ]);

    expect(updated.placedObjects.map((object) => object.id)).toEqual(["bed", "table"]);
    expect(updated.placedObjects[0]).toMatchObject({ id: "bed", width: 1800 });
    expect(updated.placedObjects[1]).toMatchObject({ id: "table", name: "Рабочий стол", rotationDeg: 90 });
    expect(document.placedObjects).toEqual([bed, table]);
  });

  it("rejects the whole update when one source id or resulting object is invalid", () => {
    const document = furnishedDocument();
    const snapshot = structuredClone(document);

    expect(() => updatePlacedObjects(document, [
      { objectId: "bed", patch: { width: 1800 } },
      { objectId: "missing", patch: { width: 900 } },
    ])).toThrow(/does not exist/i);
    expect(document).toEqual(snapshot);

    expect(() => updatePlacedObjects(document, [
      { objectId: "bed", patch: { width: 1800 } },
      { objectId: "table", patch: { width: 0 } },
    ])).toThrow();
    expect(document).toEqual(snapshot);
  });

  it("rejects duplicate source ids and non-finite translation before returning a result", () => {
    const document = furnishedDocument();
    const snapshot = structuredClone(document);

    expect(() => translatePlacedObjects(document, ["bed", "bed"], { x: 10, y: 20 })).toThrow(/duplicate/i);
    expect(() => translatePlacedObjects(document, ["bed", "table"], { x: Number.NaN, y: 20 })).toThrow(/finite/i);
    expect(() => deletePlacedObjects(document, ["table", "table"])).toThrow(/duplicate/i);
    expect(document).toEqual(snapshot);
  });

  it("adds validated objects in supplied order and rejects destination id conflicts atomically", () => {
    const empty = createEmptyDocument();
    const added = addPlacedObjects(empty, [bed, table]);
    expect(added.placedObjects).toEqual([bed, table]);
    expect(empty.placedObjects).toEqual([]);

    const conflicting = { ...table, id: "bed" };
    expect(() => addPlacedObjects(empty, [bed, conflicting])).toThrow(/duplicate|already exists/i);
    expect(() => addPlacedObjects(addPlacedObject(empty, bed), [table, { ...table, id: "bed" }])).toThrow(/already exists/i);
    expect(empty.placedObjects).toEqual([]);
  });

  it("rejects an invalid batch addition without exposing a partial document", () => {
    const empty = createEmptyDocument();
    const invalid = { ...table, id: "invalid", width: 0 };

    expect(() => addPlacedObjects(empty, [bed, invalid])).toThrow();
    expect(empty.placedObjects).toEqual([]);
  });

  it("deletes a batch atomically while preserving surviving order", () => {
    const lamp = createPlacedObject({ ...table, id: "lamp", name: "Лампа", position: { x: 6000, y: 1800 } });
    const document = addPlacedObjects(createEmptyDocument(), [bed, table, lamp]);

    const after = deletePlacedObjects(document, ["bed", "lamp"]);
    expect(after.placedObjects).toEqual([table]);
    expect(document.placedObjects).toEqual([bed, table, lamp]);
    expect(() => deletePlacedObjects(document, ["bed", "missing"])).toThrow(/does not exist/i);
    expect(document.placedObjects).toEqual([bed, table, lamp]);
  });

  it("records a rigid batch move as one semantic history command", () => {
    const initial = { ...createHistoryState(), document: furnishedDocument() };
    const after = translatePlacedObjects(initial.document, ["bed", "table"], { x: 500, y: 250 });
    const executed = executeCommand(initial, {
      type: "document/replace",
      label: "object/batch-move",
      before: initial.document,
      after,
    });

    expect(executed.past).toHaveLength(1);
    expect(undo(executed).document).toEqual(initial.document);
    expect(redo(undo(executed)).document).toEqual(after);
  });
});
