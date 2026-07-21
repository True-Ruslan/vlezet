import { describe, expect, it } from "vitest";
import { createEmptyDocument, createWall } from "@vlezet/domain";
import { createHistoryState, executeCommand, redo, undo } from "./history";

const wallA = createWall({ id: "wall-a", start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 150 });

describe("command history", () => {
  it("adds, undoes, and redoes an exact wall document", () => {
    const initial = createHistoryState(createEmptyDocument());
    const added = executeCommand(initial, { type: "wall/add", wall: wallA });
    const undone = undo(added);
    const redone = redo(undone);
    expect(added.document.walls).toEqual([wallA]);
    expect(undone.document).toEqual(initial.document);
    expect(redone.document).toEqual(added.document);
  });

  it("clears redo history when a new command is executed", () => {
    const initial = createHistoryState();
    const added = executeCommand(initial, { type: "wall/add", wall: wallA });
    const undone = undo(added);
    const replacement = createWall({ id: "wall-b", start: { x: 0, y: 0 }, end: { x: 0, y: 2000 }, thickness: 150 });
    const branched = executeCommand(undone, { type: "wall/add", wall: replacement });
    expect(branched.future).toEqual([]);
    expect(redo(branched)).toEqual(branched);
  });
});
