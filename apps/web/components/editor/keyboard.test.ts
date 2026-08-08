import { describe, expect, it } from "vitest";
import { getEditorLegacyShortcut } from "./keyboard";

const event = (key: string, overrides: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

describe("editor legacy keyboard shortcuts", () => {
  it("keeps furnishing catalogue outside the semantic command registry", () => {
    expect(getEditorLegacyShortcut(event("f"))).toBe("furnishing-catalog");
    expect(getEditorLegacyShortcut(event("f", { ctrlKey: true }))).toBeNull();
    expect(getEditorLegacyShortcut(event("f", { metaKey: true }))).toBeNull();
  });

  it("keeps Escape delegated to the existing one-level priority model", () => {
    expect(getEditorLegacyShortcut(event("Escape"))).toBe("cancel");
  });

  it("does not duplicate semantic command mappings", () => {
    expect(getEditorLegacyShortcut(event("z", { ctrlKey: true }))).toBeNull();
    expect(getEditorLegacyShortcut(event("d"))).toBeNull();
    expect(getEditorLegacyShortcut(event("d", { metaKey: true }))).toBeNull();
    expect(getEditorLegacyShortcut(event("Delete"))).toBeNull();
  });
});
