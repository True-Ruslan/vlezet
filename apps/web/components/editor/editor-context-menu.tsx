"use client";

import type { VlezetDocument } from "@vlezet/domain";
import { useEffect, useLayoutEffect, useRef } from "react";
import { EDITOR_COMMANDS, type EditorCommandId } from "./editor-commands";
import { deriveSelectionCapabilities } from "./editor-selection-capabilities";
import {
  replaceSelection,
  sameEditorEntity,
  sanitizeEditorSelection,
  type EditorEntityRef,
  type EditorSelection,
} from "./editor-selection";

const CONTEXT_COMMANDS: readonly Readonly<{
  id: EditorCommandId;
  capability: "copy" | "cut" | "paste" | "duplicate" | "rotate" | "delete";
}>[] = [
  { id: "selection.copy", capability: "copy" },
  { id: "selection.cut", capability: "cut" },
  { id: "selection.paste", capability: "paste" },
  { id: "selection.duplicate", capability: "duplicate" },
  { id: "object.rotate90", capability: "rotate" },
  { id: "selection.delete", capability: "delete" },
];

const COMMAND_BY_ID = new Map(EDITOR_COMMANDS.map((descriptor) => [descriptor.id, descriptor]));
const CONTEXT_MENU_VIEWPORT_MARGIN = 8;

export type EditorContextMenuRequest = Readonly<{
  position: Readonly<{ x: number; y: number }>;
  target: EditorEntityRef;
}>;

export type EditorContextMenuCommand = Readonly<{
  id: EditorCommandId;
  label: string;
}>;

type ContextMenuSize = Readonly<{ width: number; height: number }>;

export function clampContextMenuPosition(
  anchor: Readonly<{ x: number; y: number }>,
  menuSize: ContextMenuSize,
  viewportSize: ContextMenuSize,
  margin = CONTEXT_MENU_VIEWPORT_MARGIN,
): Readonly<{ x: number; y: number }> {
  const maxX = Math.max(margin, viewportSize.width - menuSize.width - margin);
  const maxY = Math.max(margin, viewportSize.height - menuSize.height - margin);
  return {
    x: Math.min(Math.max(anchor.x, margin), maxX),
    y: Math.min(Math.max(anchor.y, margin), maxY),
  };
}

export function selectionForContextMenuTarget(
  selection: EditorSelection,
  target: EditorEntityRef,
): EditorSelection {
  return selection.refs.some((ref) => sameEditorEntity(ref, target))
    ? selection
    : replaceSelection(target);
}

export function availableContextMenuCommands(
  document: VlezetDocument,
  selection: EditorSelection,
  hasPlacedObjectClipboard: boolean,
): readonly EditorContextMenuCommand[] {
  const safeSelection = sanitizeEditorSelection(document, selection);
  const capabilities = deriveSelectionCapabilities({
    document,
    selection: safeSelection,
    hasPlacedObjectClipboard,
  });

  return CONTEXT_COMMANDS.flatMap(({ id, capability }) => {
    if (!capabilities[capability].enabled) return [];
    const descriptor = COMMAND_BY_ID.get(id);
    return descriptor ? [{ id, label: descriptor.label }] : [];
  });
}

export function runContextMenuCommand(
  command: EditorCommandId,
  executeCommand: (command: EditorCommandId) => unknown,
  onDismiss: () => void,
): boolean {
  const result = executeCommand(command);
  onDismiss();
  return result === undefined ? true : Boolean(result);
}

export function shouldDismissContextMenuOnKey(key: string): boolean {
  return key === "Escape";
}

export function EditorContextMenu({
  position,
  document,
  selection,
  hasPlacedObjectClipboard,
  executeCommand,
  onDismiss,
}: Readonly<{
  position: Readonly<{ x: number; y: number }>;
  document: VlezetDocument;
  selection: EditorSelection;
  hasPlacedObjectClipboard: boolean;
  executeCommand: (command: EditorCommandId) => unknown;
  onDismiss: () => void;
}>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const commands = availableContextMenuCommands(
    document,
    selection,
    hasPlacedObjectClipboard,
  );

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const updatePosition = () => {
      const bounds = menu.getBoundingClientRect();
      const next = clampContextMenuPosition(
        position,
        { width: bounds.width, height: bounds.height },
        { width: window.innerWidth, height: window.innerHeight },
      );
      menu.style.left = `${next.x}px`;
      menu.style.top = `${next.y}px`;
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [commands.length, position]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldDismissContextMenuOnKey(event.key)) return;
      event.preventDefault();
      onDismiss();
    };
    const onPointerDown = () => onDismiss();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onDismiss]);

  return (
    <div
      ref={menuRef}
      className="editor-context-menu"
      role="menu"
      aria-label="Действия с выделением"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {commands.length === 0 ? (
        <p className="editor-context-menu-empty">Нет доступных действий</p>
      ) : commands.map((command) => (
        <button
          key={command.id}
          type="button"
          role="menuitem"
          onClick={() => runContextMenuCommand(command.id, executeCommand, onDismiss)}
        >
          {command.label}
        </button>
      ))}
    </div>
  );
}