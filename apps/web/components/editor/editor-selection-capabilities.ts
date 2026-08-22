import type { VlezetDocument } from "@vlezet/domain";
import {
  evaluateStructuralClipboardClosure,
  resolveStructuralRoomTranslationClosure,
} from "@vlezet/editor-core";
import type { EditorClipboardPayload } from "./editor-clipboard";
import {
  sanitizeEditorSelection,
  type EditorSelection,
} from "./editor-selection";

export type SelectionCapability = Readonly<{
  enabled: boolean;
  reason: string | null;
}>;

export type EditorClipboardKind = EditorClipboardPayload["kind"] | null;

export type SelectionCapabilities = Readonly<{
  copy: SelectionCapability;
  cut: SelectionCapability;
  paste: SelectionCapability;
  duplicate: SelectionCapability;
  delete: SelectionCapability;
  move: SelectionCapability;
  rotate: SelectionCapability;
  scale: SelectionCapability;
  wallThickness: SelectionCapability;
  selectFurnitureInRoom: SelectionCapability;
}>;

const enabled = (): SelectionCapability => ({ enabled: true, reason: null });
const disabled = (reason: string): SelectionCapability => ({ enabled: false, reason });

const NO_SELECTION_REASON = "Сначала выберите объект.";
const NO_CLIPBOARD_REASON = "Буфер обмена пуст.";
const MIXED_SELECTION_REASON = "Смешанный набор нельзя изменять одной командой. Для него доступно только безопасное копирование.";
const MULTIPLE_ROOMS_REASON = "За одну операцию можно копировать не более одной комнаты.";
const ROOM_WITH_WALLS_REASON = "Комнату и отдельные стены нельзя копировать вместе: выберите комнату или стены как один структурный корень.";
const UNSUPPORTED_COPY_REASON = "Эта комбинация объектов не имеет безопасного контракта копирования.";
const STRUCTURAL_SELECTION_REASON = "Для этой структурной выборки нет безопасной пакетной команды.";
const ROOM_DELETE_REASON = "Комнату пока нельзя удалить одной командой: сначала удалите или объедините стены вручную.";
const STRUCTURAL_MULTI_MOVE_REASON = "Пакетное перемещение стен недоступно: перемещайте конкретную стену или узел структурным жестом.";
const STRUCTURAL_ROTATE_REASON = "Поворот структуры не выполняется общей командой.";
const STRUCTURAL_SCALE_REASON = "Масштабирование структуры отключено: размеры задаются точными структурными командами.";
const WALL_THICKNESS_SELECTION_REASON = "Для общей толщины выберите не менее двух стен.";
const FURNITURE_SCALE_REASON = "Масштабирование мебели отключено: размеры предмета задаются явно.";
const FURNITURE_GROUP_ROTATE_REASON = "Групповой поворот мебели пока недоступен.";
const ROOM_CUT_REASON = "Комнату можно копировать или дублировать; вырезание контура отключено, чтобы не разрушать соседнюю топологию.";
const ROOM_FURNITURE_SELECTION_REASON = "Для выбора мебели нужна ровно одна выбранная комната без отдельных структурных объектов.";

function clipboardCapability(clipboardKind: EditorClipboardKind): SelectionCapability {
  return clipboardKind === null ? disabled(NO_CLIPBOARD_REASON) : enabled();
}

function structuralCutCapability(
  document: VlezetDocument,
  wallIds: readonly string[],
): SelectionCapability {
  const closure = evaluateStructuralClipboardClosure(document, wallIds);
  return closure.ok ? enabled() : disabled(closure.reason);
}

function roomMoveCapability(
  document: VlezetDocument,
  roomId: string,
): SelectionCapability {
  const closure = resolveStructuralRoomTranslationClosure(document, roomId);
  return closure.ok ? enabled() : disabled(closure.reason);
}

export function deriveSelectionCapabilities(input: Readonly<{
  document: VlezetDocument;
  selection: EditorSelection;
  clipboardKind: EditorClipboardKind;
}>): SelectionCapabilities {
  const selection = sanitizeEditorSelection(input.document, input.selection);
  const paste = clipboardCapability(input.clipboardKind);

  if (selection.refs.length === 0) {
    const none = disabled(NO_SELECTION_REASON);
    return {
      copy: none,
      cut: none,
      paste,
      duplicate: none,
      delete: none,
      move: none,
      rotate: none,
      scale: none,
      wallThickness: none,
      selectFurnitureInRoom: none,
    };
  }

  const rooms = selection.refs.filter((ref) => ref.kind === "room");
  const walls = selection.refs.filter((ref) => ref.kind === "wall");
  const objects = selection.refs.filter((ref) => ref.kind === "placed-object");
  const unsupported = selection.refs.filter((ref) =>
    ref.kind !== "room" && ref.kind !== "wall" && ref.kind !== "placed-object");

  if (rooms.length > 1) {
    const structural = disabled(STRUCTURAL_SELECTION_REASON);
    return {
      copy: disabled(MULTIPLE_ROOMS_REASON),
      cut: structural,
      paste,
      duplicate: structural,
      delete: structural,
      move: structural,
      rotate: structural,
      scale: structural,
      wallThickness: structural,
      selectFurnitureInRoom: disabled(ROOM_FURNITURE_SELECTION_REASON),
    };
  }

  const kinds = new Set(selection.refs.map((ref) => ref.kind));
  if (kinds.size > 1) {
    let copy = disabled(UNSUPPORTED_COPY_REASON);
    if (unsupported.length === 0 && rooms.length === 1 && walls.length > 0) {
      copy = disabled(ROOM_WITH_WALLS_REASON);
    } else if (
      unsupported.length === 0 &&
      objects.length > 0 &&
      ((rooms.length === 1 && walls.length === 0) || (rooms.length === 0 && walls.length > 0))
    ) {
      copy = enabled();
    }

    const mixed = disabled(MIXED_SELECTION_REASON);
    const roomObjectSelection = unsupported.length === 0 && rooms.length === 1 && walls.length === 0 && objects.length > 0;
    return {
      copy,
      cut: mixed,
      paste,
      duplicate: mixed,
      delete: mixed,
      move: roomObjectSelection ? roomMoveCapability(input.document, rooms[0]!.id) : mixed,
      rotate: mixed,
      scale: mixed,
      wallThickness: mixed,
      selectFurnitureInRoom: roomObjectSelection
        ? enabled()
        : disabled(ROOM_FURNITURE_SELECTION_REASON),
    };
  }

  const onlyKind = selection.refs[0]!.kind;
  if (onlyKind === "placed-object") {
    const rotate = selection.refs.length === 1
      ? enabled()
      : disabled(FURNITURE_GROUP_ROTATE_REASON);
    return {
      copy: enabled(),
      cut: enabled(),
      paste,
      duplicate: enabled(),
      delete: enabled(),
      move: enabled(),
      rotate,
      scale: disabled(FURNITURE_SCALE_REASON),
      wallThickness: disabled(STRUCTURAL_SELECTION_REASON),
      selectFurnitureInRoom: disabled(ROOM_FURNITURE_SELECTION_REASON),
    };
  }

  if (onlyKind === "wall") {
    const wallIds = selection.refs.map((ref) => ref.id);
    const cut = structuralCutCapability(input.document, wallIds);
    return {
      copy: enabled(),
      cut,
      paste,
      duplicate: enabled(),
      delete: cut,
      move: selection.refs.length === 1 ? enabled() : disabled(STRUCTURAL_MULTI_MOVE_REASON),
      rotate: disabled(STRUCTURAL_ROTATE_REASON),
      scale: disabled(STRUCTURAL_SCALE_REASON),
      wallThickness: selection.refs.length >= 2
        ? enabled()
        : disabled(WALL_THICKNESS_SELECTION_REASON),
      selectFurnitureInRoom: disabled(ROOM_FURNITURE_SELECTION_REASON),
    };
  }

  if (onlyKind === "room" && selection.refs.length === 1) {
    return {
      copy: enabled(),
      cut: disabled(ROOM_CUT_REASON),
      paste,
      duplicate: enabled(),
      delete: disabled(ROOM_DELETE_REASON),
      move: roomMoveCapability(input.document, selection.refs[0]!.id),
      rotate: disabled(STRUCTURAL_ROTATE_REASON),
      scale: disabled(STRUCTURAL_SCALE_REASON),
      wallThickness: disabled(STRUCTURAL_SELECTION_REASON),
      selectFurnitureInRoom: enabled(),
    };
  }

  const structural = disabled(STRUCTURAL_SELECTION_REASON);
  return {
    copy: structural,
    cut: structural,
    paste,
    duplicate: structural,
    delete: structural,
    move: structural,
    rotate: structural,
    scale: structural,
    wallThickness: structural,
    selectFurnitureInRoom: disabled(ROOM_FURNITURE_SELECTION_REASON),
  };
}
