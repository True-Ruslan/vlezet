import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import { createHistoryState, executeCommand, redo, undo } from "@vlezet/editor-core";
import { recognitionApplyHistoryTransition } from "./recognition-history-sync";

function recognitionHistory() {
  const before = createEmptyDocument();
  const after = { ...before, schemaVersion: before.schemaVersion };
  return executeCommand(createHistoryState(before), {
    type: "document/replace",
    label: "recognition/apply",
    before,
    after,
  });
}

describe("recognition apply history synchronization", () => {
  it("marks the draft reviewable when the recognition batch itself is undone", () => {
    const applied = recognitionHistory();
    const undone = undo(applied);
    expect(recognitionApplyHistoryTransition(applied, undone)).toBe("unapplied");
  });

  it("marks the draft applied again when the recognition batch is redone", () => {
    const applied = recognitionHistory();
    const undone = undo(applied);
    const redone = redo(undone);
    expect(recognitionApplyHistoryTransition(undone, redone)).toBe("applied");
  });

  it("does not treat the initial commit or unrelated history changes as undo/redo synchronization", () => {
    const empty = createHistoryState();
    const applied = recognitionHistory();
    expect(recognitionApplyHistoryTransition(empty, applied)).toBeNull();

    const before = createEmptyDocument();
    const after = { ...before, schemaVersion: before.schemaVersion };
    const normal = executeCommand(createHistoryState(before), {
      type: "document/replace",
      label: "object/add",
      before,
      after,
    });
    expect(recognitionApplyHistoryTransition(normal, undo(normal))).toBeNull();
  });
});
