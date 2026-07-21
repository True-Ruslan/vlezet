import { describe, expect, it } from "vitest";
import { getEditorShortcut } from "./keyboard";

describe("editor keyboard shortcuts", () => {
  it("maps undo and redo across Ctrl/Cmd conventions", () => {
    expect(getEditorShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false })).toBe("undo");
    expect(getEditorShortcut({ key: "z", ctrlKey: false, metaKey: true, shiftKey: true })).toBe("redo");
    expect(getEditorShortcut({ key: "y", ctrlKey: true, metaKey: false, shiftKey: false })).toBe("redo");
  });

  it("maps editor tool and cancel shortcuts", () => {
    expect(getEditorShortcut({ key: "w", ctrlKey: false, metaKey: false, shiftKey: false })).toBe("wall-tool");
    expect(getEditorShortcut({ key: "v", ctrlKey: false, metaKey: false, shiftKey: false })).toBe("select-tool");
    expect(getEditorShortcut({ key: "Escape", ctrlKey: false, metaKey: false, shiftKey: false })).toBe("cancel");
  });
});
