import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection } from "./editor-selection";
import { availableContextMenuCommands } from "./editor-context-menu";

function documentFixture(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 5000, y: 0 } },
    ],
    walls: [
      { id: "wall-1", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [createPlacedObject({
      id: "chair-1",
      presetId: null,
      name: "Стул",
      category: "chair",
      position: { x: 1000, y: 1000 },
      width: 500,
      depth: 500,
      rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    })],
  };
}

describe("M8.2 mixed Copy context menu contract", () => {
  it("exposes Copy and fit-selection, but no destructive mixed commands", () => {
    const mixed = addToSelection(
      replaceSelection({ kind: "wall", id: "wall-1" }),
      [{ kind: "placed-object", id: "chair-1" }],
    );

    expect(availableContextMenuCommands(documentFixture(), mixed, "structural-fragment").map((item) => item.id)).toEqual([
      "selection.copy",
      "view.fitSelection",
    ]);
  });
});
