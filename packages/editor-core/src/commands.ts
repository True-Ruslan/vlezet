import type { VlezetDocument } from "@vlezet/domain";

export type EditorCommandLabel =
  | "vertex/move"
  | "wall/add-connected"
  | "wall/add-t-junction"
  | "wall/set-length"
  | "wall/set-thickness"
  | "opening/add"
  | "opening/update"
  | "opening/delete"
  | "room-annotation/set-name"
  | "object/add"
  | "object/move"
  | "object/rotate"
  | "object/resize"
  | "object/update"
  | "object/duplicate"
  | "object/delete"
  | "recognition/apply";

export type EditorCommand = Readonly<{
  type: "document/replace";
  label: EditorCommandLabel;
  before: VlezetDocument;
  after: VlezetDocument;
}>;

export type InternalEditorCommand = EditorCommand;

export function applyEditorCommand(_document: VlezetDocument, command: InternalEditorCommand): VlezetDocument {
  return command.after;
}

export function invertEditorCommand(command: EditorCommand): InternalEditorCommand {
  return {
    ...command,
    before: command.after,
    after: command.before,
  };
}
