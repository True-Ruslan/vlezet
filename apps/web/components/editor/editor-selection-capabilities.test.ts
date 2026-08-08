import type { VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import { replaceSelection, type EditorEntityRef, type EditorSelection } from "./editor-selection";
import { deriveSelectionCapabilities } from "./editor-selection-capabilities";

function capabilityDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
    ],
    walls: [
      { id: "wall-1", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
    ],
    openings: [
      { id: "opening-1", wallId: "wall-1", kind: "door", offset: 1200, width: 900 },
    ],
    roomAnnotations: [],
    placedObjects: ["object-1", "object-2", "object-3"].map((id, index) => ({
      id,
      presetId: null,
      name: `Стул ${index + 1}`,
      category: "chair" as const,
      position: { x: 800 + index * 900, y: 1200 },
      width: 500,
      depth: 500,
      rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    })),
  };
}

const ref = (kind: EditorEntityRef["kind"], id: string): EditorEntityRef => ({ kind, id });

function selection(...refs: EditorEntityRef[]): EditorSelection {
  return refs.length === 0
    ? { refs: [], primary: null }
    : { refs, primary: refs.at(-1)! };
}

const enabledState = (capabilities: ReturnType<typeof deriveSelectionCapabilities>) => ({
  copy: capabilities.copy.enabled,
  cut: capabilities.cut.enabled,
  paste: capabilities.paste.enabled,
  duplicate: capabilities.duplicate.enabled,
  delete: capabilities.delete.enabled,
  move: capabilities.move.enabled,
  rotate: capabilities.rotate.enabled,
  scale: capabilities.scale.enabled,
});

describe("semantic selection capabilities", () => {
  const document = capabilityDocument();

  it.each([
    {
      name: "empty selection",
      selection: selection(),
      clipboard: false,
      expected: { copy: false, cut: false, paste: false, duplicate: false, delete: false, move: false, rotate: false, scale: false },
    },
    {
      name: "one placed object",
      selection: replaceSelection(ref("placed-object", "object-1")),
      clipboard: false,
      expected: { copy: true, cut: true, paste: false, duplicate: true, delete: true, move: true, rotate: true, scale: false },
    },
    {
      name: "three placed objects",
      selection: selection(
        ref("placed-object", "object-1"),
        ref("placed-object", "object-2"),
        ref("placed-object", "object-3"),
      ),
      clipboard: false,
      expected: { copy: true, cut: true, paste: false, duplicate: true, delete: true, move: true, rotate: false, scale: false },
    },
    {
      name: "one structural wall",
      selection: replaceSelection(ref("wall", "wall-1")),
      clipboard: false,
      expected: { copy: false, cut: false, paste: false, duplicate: false, delete: false, move: false, rotate: false, scale: false },
    },
    {
      name: "wall plus opening",
      selection: selection(ref("wall", "wall-1"), ref("opening", "opening-1")),
      clipboard: false,
      expected: { copy: false, cut: false, paste: false, duplicate: false, delete: false, move: false, rotate: false, scale: false },
    },
    {
      name: "furniture plus wall",
      selection: selection(ref("placed-object", "object-1"), ref("wall", "wall-1")),
      clipboard: false,
      expected: { copy: false, cut: false, paste: false, duplicate: false, delete: false, move: false, rotate: false, scale: false },
    },
  ])("derives the fail-closed matrix for $name", ({ selection: currentSelection, clipboard, expected }) => {
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: currentSelection,
      hasPlacedObjectClipboard: clipboard,
    });

    expect(enabledState(capabilities)).toEqual(expected);
  });

  it("makes paste depend on the placed-object clipboard rather than current selection", () => {
    for (const currentSelection of [
      selection(),
      replaceSelection(ref("wall", "wall-1")),
      selection(ref("placed-object", "object-1"), ref("wall", "wall-1")),
    ]) {
      const withoutClipboard = deriveSelectionCapabilities({
        document,
        selection: currentSelection,
        hasPlacedObjectClipboard: false,
      });
      const withClipboard = deriveSelectionCapabilities({
        document,
        selection: currentSelection,
        hasPlacedObjectClipboard: true,
      });

      expect(withoutClipboard.paste.enabled).toBe(false);
      expect(withClipboard.paste.enabled).toBe(true);
    }
  });

  it("explains important mixed and structural restrictions in Russian", () => {
    const structural = deriveSelectionCapabilities({
      document,
      selection: selection(ref("wall", "wall-1"), ref("opening", "opening-1")),
      hasPlacedObjectClipboard: false,
    });
    const mixed = deriveSelectionCapabilities({
      document,
      selection: selection(ref("placed-object", "object-1"), ref("wall", "wall-1")),
      hasPlacedObjectClipboard: false,
    });

    expect(structural.move.reason).toMatch(/[А-Яа-яЁё]/);
    expect(structural.copy.reason).toMatch(/[А-Яа-яЁё]/);
    expect(mixed.move.reason).toMatch(/[А-Яа-яЁё]/);
    expect(mixed.delete.reason).toMatch(/[А-Яа-яЁё]/);
  });

  it("does not grant capabilities to stale selection refs", () => {
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: replaceSelection(ref("placed-object", "missing-object")),
      hasPlacedObjectClipboard: false,
    });

    expect(enabledState(capabilities)).toEqual({
      copy: false,
      cut: false,
      paste: false,
      duplicate: false,
      delete: false,
      move: false,
      rotate: false,
      scale: false,
    });
  });
});
