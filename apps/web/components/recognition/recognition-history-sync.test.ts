import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import { createHistoryState, executeCommand, redo, undo } from "@vlezet/editor-core";
import { recognitionApplyHistoryTransition } from "./recognition-history-sync";

function appendRecognitionHistory(
  history: ReturnType<typeof createHistoryState>,
  marker: number,
) {
  const before = history.document;
  const after = { ...before, schemaVersion: before.schemaVersion, updatedAt: `batch-${marker}` };
  return executeCommand(history, {
    type: "document/replace",
    label: "recognition/apply",
    before,
    after,
  });
}

function recognitionHistory() {
  return appendRecognitionHistory(createHistoryState(createEmptyDocument()), 1);
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

  it("synchronizes each of two successful Apply batches independently", () => {
    const first = recognitionHistory();
    const second = appendRecognitionHistory(first, 2);

    const undoSecond = undo(second);
    expect(recognitionApplyHistoryTransition(second, undoSecond)).toBe("unapplied");
    expect(undoSecond.document).toEqual(first.document);

    const undoFirst = undo(undoSecond);
    expect(recognitionApplyHistoryTransition(undoSecond, undoFirst)).toBe("unapplied");
    expect(undoFirst.document).toEqual(createEmptyDocument());

    const redoFirst = redo(undoFirst);
    expect(recognitionApplyHistoryTransition(undoFirst, redoFirst)).toBe("applied");
    expect(redoFirst.document).toEqual(first.document);

    const redoSecond = redo(redoFirst);
    expect(recognitionApplyHistoryTransition(redoFirst, redoSecond)).toBe("applied");
    expect(redoSecond.document).toEqual(second.document);
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
