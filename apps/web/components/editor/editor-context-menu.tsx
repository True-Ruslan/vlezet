"use client";

import type { VlezetDocument } from "@vlezet/domain";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EDITOR_COMMANDS, type EditorCommandId } from "./editor-commands";
import { deriveSelectionCapabilities } from "./editor-selection-capabilities";
import {
  EMPTY_EDITOR_SELECTION,
  replaceSelection,
  sameEditorEntity,
  sanitizeEditorSelection,
  type EditorEntityRef,
  type EditorSelection,
} from "./editor-selection";

const COMMAND_BY_ID = new Map(EDITOR_COMMANDS.map((descriptor) => [descriptor.id, descriptor]));
const CONTEXT_MENU_VIEWPORT_MARGIN = 8;

export type ShortcutPlatform = "mac" | "other";

export type EditorContextMenuRequest = Readonly<{
  position: Readonly<{ x: number; y: number }>;
  target: EditorEntityRef | null;
}>;

export type EditorContextMenuCommand = Readonly<{
  id: EditorCommandId;
  label: string;
  shortcut: string | null;
  separatorBefore: boolean;
}>;

type ContextMenuSize = Readonly<{ width: number; height: number }>;

function registeredCommand(
  id: EditorCommandId,
  separatorBefore = false,
): EditorContextMenuCommand | null {
  const descriptor = COMMAND_BY_ID.get(id);
  return descriptor ? {
    id,
    label: descriptor.label,
    shortcut: descriptor.shortcut,
    separatorBefore,
  } : null;
}

function detectShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === "undefined") return "other";
  const navigatorWithData = navigator as Navigator & {
    userAgentData?: Readonly<{ platform?: string }>;
  };
  const platform = navigatorWithData.userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform) ? "mac" : "other";
}

function formatShortcut(shortcut: string | null, platform: ShortcutPlatform): string | null {
  if (!shortcut) return null;
  if (shortcut === "Delete") return "⌫";
  if (shortcut.startsWith("Cmd/Ctrl+")) {
    const key = shortcut.slice("Cmd/Ctrl+".length);
    return platform === "mac" ? `⌘${key}` : `Ctrl+${key}`;
  }
  return shortcut;
}

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
  target: EditorEntityRef | null,
): EditorSelection {
  if (!target) return EMPTY_EDITOR_SELECTION;
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
  const commands: EditorContextMenuCommand[] = [];
  const append = (id: EditorCommandId, separatorBefore = false) => {
    const command = registeredCommand(id, separatorBefore);
    if (command) commands.push(command);
  };

  if (safeSelection.refs.length === 0) {
    if (capabilities.paste.enabled) append("selection.paste");
    append("selection.selectAll");
    append("view.fitPlan", commands.length > 0);
    return commands;
  }

  if (capabilities.copy.enabled) append("selection.copy");
  if (capabilities.cut.enabled) append("selection.cut");
  if (capabilities.duplicate.enabled) append("selection.duplicate");
  append("view.fitSelection", commands.length > 0);
  if (capabilities.delete.enabled) append("selection.delete", true);
  return commands;
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
  shortcutPlatform,
  executeCommand,
  onDismiss,
}: Readonly<{
  position: Readonly<{ x: number; y: number }>;
  document: VlezetDocument;
  selection: EditorSelection;
  hasPlacedObjectClipboard: boolean;
  shortcutPlatform?: ShortcutPlatform;
  executeCommand: (command: EditorCommandId) => unknown;
  onDismiss: () => void;
}>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<ShortcutPlatform>("other");
  const platform = shortcutPlatform ?? detectedPlatform;
  const commands = availableContextMenuCommands(
    document,
    selection,
    hasPlacedObjectClipboard,
  );

  useEffect(() => {
    if (shortcutPlatform) return;
    setDetectedPlatform(detectShortcutPlatform());
  }, [shortcutPlatform]);

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
  }, [commands.length, platform, position]);

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
      aria-label={selection.refs.length === 0 ? "Действия на холсте" : "Действия с выделением"}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {commands.length === 0 ? (
        <p className="editor-context-menu-empty">Нет доступных действий</p>
      ) : commands.map((command) => {
        const shortcut = formatShortcut(command.shortcut, platform);
        return (
          <Fragment key={command.id}>
            {command.separatorBefore ? (
              <div
                className="editor-context-menu-separator"
                role="separator"
                style={{ height: 1, margin: "4px 6px", background: "var(--line)" }}
              />
            ) : null}
            <button
              type="button"
              role="menuitem"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
              onClick={() => runContextMenuCommand(command.id, executeCommand, onDismiss)}
            >
              <span>{command.label}</span>
              {shortcut ? <kbd>{shortcut}</kbd> : null}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
