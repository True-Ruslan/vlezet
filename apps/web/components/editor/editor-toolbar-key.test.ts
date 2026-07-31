import { describe, expect, it } from "vitest";
import { normalizedKeyboardKey } from "./editor-toolbar";

describe("editor toolbar keyboard shortcut safety", () => {
  it("ignores a keydown-like event whose key is missing", () => {
    expect(normalizedKeyboardKey({ key: undefined })).toBeNull();
    expect(normalizedKeyboardKey({})).toBeNull();
  });

  it("normalizes ordinary keyboard keys case-insensitively", () => {
    expect(normalizedKeyboardKey({ key: "M" })).toBe("m");
    expect(normalizedKeyboardKey({ key: "m" })).toBe("m");
  });
});
