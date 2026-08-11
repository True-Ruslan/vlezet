import { describe, expect, it } from "vitest";
import {
  EDITOR_COMMANDS,
  commandForKeyboardEvent,
  isNativeEditableTarget,
  type EditorCommandId,
} from "./editor-commands";

const keyEvent = (
  key: string,
  overrides: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {},
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

function target(input: Readonly<{
  tagName?: string;
  isContentEditable?: boolean;
  nativeEditable?: boolean;
}>) {
  return {
    tagName: input.tagName,
    isContentEditable: input.isContentEditable ?? false,
    getAttribute: (name: string) => name === "data-editor-native-editable" && input.nativeEditable ? "true" : null,
  } as unknown as EventTarget;
}

describe("M8.1 central editor command registry", () => {
  it("contains one descriptor for every supported semantic command", () => {
    const expected: readonly EditorCommandId[] = [
      "history.undo",
      "history.redo",
      "selection.selectAll",
      "selection.copy",
      "selection.cut",
      "selection.paste",
      "selection.duplicate",
      "selection.delete",
      "selection.select-furniture-in-room",
      "selection.clear",
      "view.zoomIn",
      "view.zoomOut",
      "view.actualSize",
      "view.fitPlan",
      "view.fitSelection",
      "tool.select",
      "tool.wall",
      "tool.door",
      "tool.window",
      "object.rotate90",
    ];

    expect(EDITOR_COMMANDS.map((command) => command.id)).toEqual(expected);
    expect(new Set(EDITOR_COMMANDS.map((command) => command.id)).size).toBe(expected.length);
    expect(EDITOR_COMMANDS.every((command) => command.label.trim().length > 0)).toBe(true);
  });

  it.each([
    ["c", { metaKey: true }, "selection.copy"],
    ["c", { ctrlKey: true }, "selection.copy"],
    ["x", { metaKey: true }, "selection.cut"],
    ["v", { ctrlKey: true }, "selection.paste"],
    ["a", { metaKey: true }, "selection.selectAll"],
    ["d", { ctrlKey: true }, "selection.duplicate"],
    ["z", { metaKey: true }, "history.undo"],
    ["z", { ctrlKey: true, shiftKey: true }, "history.redo"],
    ["y", { ctrlKey: true }, "history.redo"],
  ] as const)("maps command-modified %s to %s", (key, modifiers, command) => {
    expect(commandForKeyboardEvent(keyEvent(key, modifiers))).toBe(command);
  });

  it("keeps plain tool/object/delete shortcuts semantic and separate from command-modified keys", () => {
    expect(commandForKeyboardEvent(keyEvent("v"))).toBe("tool.select");
    expect(commandForKeyboardEvent(keyEvent("w"))).toBe("tool.wall");
    expect(commandForKeyboardEvent(keyEvent("d"))).toBe("tool.door");
    expect(commandForKeyboardEvent(keyEvent("o"))).toBe("tool.window");
    expect(commandForKeyboardEvent(keyEvent("r"))).toBe("object.rotate90");
    expect(commandForKeyboardEvent(keyEvent("Delete"))).toBe("selection.delete");
    expect(commandForKeyboardEvent(keyEvent("Backspace"))).toBe("selection.delete");
  });

  it("keeps view commands available to UI surfaces without advertising bare-key shortcuts", () => {
    const viewCommands = EDITOR_COMMANDS.filter((command) => command.id.startsWith("view."));

    expect(viewCommands.map((command) => command.id)).toEqual([
      "view.zoomIn",
      "view.zoomOut",
      "view.actualSize",
      "view.fitPlan",
      "view.fitSelection",
    ]);
    expect(viewCommands.every((command) => command.shortcut === null)).toBe(true);
  });

  it("does not bind bare number or zoom punctuation keys to viewport changes", () => {
    for (const key of ["+", "=", "-", "0", "1", "2"] as const) {
      expect(commandForKeyboardEvent(keyEvent(key)), key).toBeNull();
    }
    expect(commandForKeyboardEvent(keyEvent("Escape"))).toBeNull();
  });

  it("does not invent native editing commands for unmodified text keys", () => {
    expect(commandForKeyboardEvent(keyEvent("c"))).toBeNull();
    expect(commandForKeyboardEvent(keyEvent("x"))).toBeNull();
    expect(commandForKeyboardEvent(keyEvent("a"))).toBeNull();
  });

  it("recognises native editable controls without depending on browser-only globals", () => {
    expect(isNativeEditableTarget(target({ tagName: "INPUT" }))).toBe(true);
    expect(isNativeEditableTarget(target({ tagName: "textarea" }))).toBe(true);
    expect(isNativeEditableTarget(target({ tagName: "Select" }))).toBe(true);
    expect(isNativeEditableTarget(target({ tagName: "DIV", isContentEditable: true }))).toBe(true);
    expect(isNativeEditableTarget(target({ tagName: "DIV", nativeEditable: true }))).toBe(true);
    expect(isNativeEditableTarget(target({ tagName: "BUTTON" }))).toBe(false);
    expect(isNativeEditableTarget(null)).toBe(false);
  });
});
