import { createEmptyDocument, type VlezetDocument } from "@vlezet/domain";
import { applyEditorCommand, invertEditorCommand, type EditorCommand, type InternalEditorCommand } from "./commands";

export type HistoryEntry = Readonly<{
  forward: EditorCommand;
  inverse: InternalEditorCommand;
}>;

export type HistoryState = Readonly<{
  document: VlezetDocument;
  past: readonly HistoryEntry[];
  future: readonly HistoryEntry[];
}>;

export function createHistoryState(document: VlezetDocument = createEmptyDocument()): HistoryState {
  return { document, past: [], future: [] };
}

export function executeCommand(state: HistoryState, command: EditorCommand): HistoryState {
  const entry: HistoryEntry = { forward: command, inverse: invertEditorCommand(command) };
  return {
    document: applyEditorCommand(state.document, command),
    past: [...state.past, entry],
    future: [],
  };
}

export function undo(state: HistoryState): HistoryState {
  const entry = state.past[state.past.length - 1];
  if (!entry) return state;
  return {
    document: applyEditorCommand(state.document, entry.inverse),
    past: state.past.slice(0, -1),
    future: [...state.future, entry],
  };
}

export function redo(state: HistoryState): HistoryState {
  const entry = state.future[state.future.length - 1];
  if (!entry) return state;
  return {
    document: applyEditorCommand(state.document, entry.forward),
    past: [...state.past, entry],
    future: state.future.slice(0, -1),
  };
}
