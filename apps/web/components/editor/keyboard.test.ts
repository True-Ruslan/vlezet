import { describe, expect, it } from "vitest";
import { getEditorShortcut } from "./keyboard";

const event = (key: string, overrides: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

describe("editor keyboard shortcuts", () => {
  it("maps undo and redo across Ctrl/Cmd conventions", () => {
    expect(getEditorShortcut(event("z", { ctrlKey: true }))).toBe("undo");
    expect(getEditorShortcut(event("z", { metaKey: true, shiftKey: true }))).toBe("redo");
    expect(getEditorShortcut(event("y", { ctrlKey: true }))).toBe("redo");
  });

  it("keeps plain D for doors and command D for duplication", () => {
    expect(getEditorShortcut(event("d"))).toBe("door-tool");
    expect(getEditorShortcut(event("d", { ctrlKey: true }))).toBe("duplicate-object");
    expect(getEditorShortcut(event("d", { metaKey: true }))).toBe("duplicate-object");
  });

  it("maps furnishing and existing editor actions", () => {
    expect(getEditorShortcut(event("w"))).toBe("wall-tool");
    expect(getEditorShortcut(event("v"))).toBe("select-tool");
    expect(getEditorShortcut(event("o"))).toBe("window-tool");
    expect(getEditorShortcut(event("f"))).toBe("furnishing-catalog");
    expect(getEditorShortcut(event("r"))).toBe("rotate-object");
    expect(getEditorShortcut(event("Delete"))).toBe("delete-selection");
    expect(getEditorShortcut(event("Backspace"))).toBe("delete-selection");
    expect(getEditorShortcut(event("Escape"))).toBe("cancel");
  });
});
