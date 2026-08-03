import type { HistoryEntry, HistoryState } from "@vlezet/editor-core";

export type RecognitionApplyHistoryTransition = "applied" | "unapplied";

function isRecognitionApply(entry: HistoryEntry | undefined): boolean {
  return entry?.forward.label === "recognition/apply";
}

export function recognitionApplyHistoryTransition(
  previous: HistoryState,
  current: HistoryState,
): RecognitionApplyHistoryTransition | null {
  const undoneEntry = previous.past.at(-1);
  const recognitionApplyUndone = previous.past.length === current.past.length + 1
    && current.future.length === previous.future.length + 1
    && isRecognitionApply(undoneEntry)
    && current.future.at(-1) === undoneEntry;
  if (recognitionApplyUndone) return "unapplied";

  const redoneEntry = previous.future.at(-1);
  const recognitionApplyRedone = current.past.length === previous.past.length + 1
    && previous.future.length === current.future.length + 1
    && isRecognitionApply(redoneEntry)
    && current.past.at(-1) === redoneEntry;
  return recognitionApplyRedone ? "applied" : null;
}
