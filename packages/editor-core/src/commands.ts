import type { VlezetDocumentV2 } from "@vlezet/domain";

export type EditorCommandLabel =
  | "vertex/move"
  | "wall/add-connected"
  | "wall/add-t-junction"
  | "wall/set-length"
  | "wall/set-thickness"
  | "opening/add"
  | "opening/update"
  | "opening/delete"
  | "room-annotation/set-name";

export type EditorCommand = Readonly<{
  type: "document/replace";
  label: EditorCommandLabel;
  before: VlezetDocumentV2;
  after: VlezetDocumentV2;
}>;

export type InternalEditorCommand = EditorCommand;

export function applyEditorCommand(_document: VlezetDocumentV2, command: InternalEditorCommand): VlezetDocumentV2 {
  return command.after;
}

export function invertEditorCommand(command: EditorCommand): InternalEditorCommand {
  return {
    ...command,
    before: command.after,
    after: command.before,
  };
}
