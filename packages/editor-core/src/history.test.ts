import { describe, expect, it } from "vitest";
import { createEmptyDocument, type VlezetDocumentV2 } from "@vlezet/domain";
import { createHistoryState, executeCommand, redo, undo } from "./history";

const initial = createEmptyDocument();
const changed: VlezetDocumentV2 = {
  ...initial,
  vertices: [
    { id: "a", position: { x: 0, y: 0 } },
    { id: "b", position: { x: 3000, y: 0 } },
  ],
  walls: [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
};

describe("command history", () => {
  it("undoes and redoes one semantic document transition exactly", () => {
    const state = createHistoryState(initial);
    const executed = executeCommand(state, {
      type: "document/replace",
      label: "wall/add-connected",
      before: initial,
      after: changed,
    });

    expect(executed.document).toEqual(changed);
    expect(undo(executed).document).toEqual(initial);
    expect(redo(undo(executed)).document).toEqual(changed);
  });

  it("clears redo history when a new semantic transition is executed", () => {
    const first = executeCommand(createHistoryState(initial), {
      type: "document/replace",
      label: "wall/add-connected",
      before: initial,
      after: changed,
    });
    const undone = undo(first);
    const alternative: VlezetDocumentV2 = { ...initial, roomAnnotations: [] };
    const branched = executeCommand(undone, {
      type: "document/replace",
      label: "wall/set-thickness",
      before: initial,
      after: alternative,
    });

    expect(branched.future).toEqual([]);
    expect(redo(branched)).toEqual(branched);
  });
});
