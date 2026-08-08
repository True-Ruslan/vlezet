import type { VlezetDocument } from "@vlezet/domain";
import { sanitizeEditorSelection, type EditorSelection } from "./editor-selection";

export type SelectionCapability = Readonly<{
  enabled: boolean;
  reason?: string;
}>;

export type SelectionCapabilities = Readonly<{
  copy: SelectionCapability;
  cut: SelectionCapability;
  paste: SelectionCapability;
  duplicate: SelectionCapability;
  delete: SelectionCapability;
  move: SelectionCapability;
  rotate: SelectionCapability;
  scale: SelectionCapability;
}>;

const ENABLED: SelectionCapability = { enabled: true };
const DISABLED: SelectionCapability = { enabled: false };
const SCALE_DISABLED: SelectionCapability = {
  enabled: false,
  reason: "Групповое масштабирование недоступно: размеры должны оставаться физическими.",
};

function disabled(reason: string): SelectionCapability {
  return { enabled: false, reason };
}

export function deriveSelectionCapabilities(input: Readonly<{
  document: VlezetDocument;
  selection: EditorSelection;
  hasPlacedObjectClipboard: boolean;
}>): SelectionCapabilities {
  const selection = sanitizeEditorSelection(input.document, input.selection);
  const paste = input.hasPlacedObjectClipboard ? ENABLED : DISABLED;

  if (selection.refs.length === 0) {
    return {
      copy: DISABLED,
      cut: DISABLED,
      paste,
      duplicate: DISABLED,
      delete: DISABLED,
      move: DISABLED,
      rotate: DISABLED,
      scale: SCALE_DISABLED,
    };
  }

  const placedObjectCount = selection.refs.filter((ref) => ref.kind === "placed-object").length;
  const allPlacedObjects = placedObjectCount === selection.refs.length;

  if (allPlacedObjects) {
    return {
      copy: ENABLED,
      cut: ENABLED,
      paste,
      duplicate: ENABLED,
      delete: ENABLED,
      move: ENABLED,
      rotate:
        selection.refs.length === 1
          ? ENABLED
          : disabled("Групповой поворот мебели будет добавлен в отдельном этапе."),
      scale: SCALE_DISABLED,
    };
  }

  const mixed = placedObjectCount > 0;
  const reason = mixed
    ? "Смешанный набор нельзя изменять одной командой: выберите только мебель или редактируйте структуру отдельно."
    : selection.refs.length === 1
      ? "Структурный объект редактируется отдельными точными командами."
      : "Структурные объекты нельзя изменять пакетно без проверки топологии.";
  const blocked = disabled(reason);

  return {
    copy: blocked,
    cut: blocked,
    paste,
    duplicate: blocked,
    delete: blocked,
    move: blocked,
    rotate: blocked,
    scale: SCALE_DISABLED,
  };
}
