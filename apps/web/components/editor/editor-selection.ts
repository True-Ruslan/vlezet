import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";

export type EditorEntityKind = "wall" | "vertex" | "room" | "opening" | "placed-object";

export type EditorEntityRef = Readonly<{
  kind: EditorEntityKind;
  id: string;
}>;

export type EditorSelection = Readonly<{
  refs: readonly EditorEntityRef[];
  primary: EditorEntityRef | null;
}>;

export const EMPTY_EDITOR_SELECTION: EditorSelection = {
  refs: [],
  primary: null,
};

export function sameEditorEntity(first: EditorEntityRef, second: EditorEntityRef): boolean {
  return first.kind === second.kind && first.id === second.id;
}

export function replaceSelection(ref: EditorEntityRef | null): EditorSelection {
  return ref ? { refs: [ref], primary: ref } : EMPTY_EDITOR_SELECTION;
}

export function clearSelection(): EditorSelection {
  return EMPTY_EDITOR_SELECTION;
}

export function toggleSelection(selection: EditorSelection, ref: EditorEntityRef): EditorSelection {
  const existingIndex = selection.refs.findIndex((candidate) => sameEditorEntity(candidate, ref));
  if (existingIndex < 0) {
    return {
      refs: [...selection.refs, ref],
      primary: ref,
    };
  }

  const refs = selection.refs.filter((_, index) => index !== existingIndex);
  if (refs.length === 0) return EMPTY_EDITOR_SELECTION;

  const removedPrimary = selection.primary !== null && sameEditorEntity(selection.primary, ref);
  const primary = removedPrimary
    ? refs.at(-1) ?? null
    : refs.find((candidate) => selection.primary !== null && sameEditorEntity(candidate, selection.primary)) ?? refs.at(-1) ?? null;

  return { refs, primary };
}

export function addToSelection(
  selection: EditorSelection,
  refsToAdd: readonly EditorEntityRef[],
): EditorSelection {
  const refs = [...selection.refs];
  let primary = selection.primary;

  for (const ref of refsToAdd) {
    if (refs.some((candidate) => sameEditorEntity(candidate, ref))) continue;
    refs.push(ref);
    primary = ref;
  }

  return { refs, primary };
}

export function sanitizeEditorSelection(
  document: VlezetDocument,
  selection: EditorSelection,
): EditorSelection {
  const roomIds = new Set(deriveRooms(document).rooms.map((room) => room.id));

  const exists = (ref: EditorEntityRef): boolean => {
    switch (ref.kind) {
      case "wall":
        return document.walls.some((wall) => wall.id === ref.id);
      case "vertex":
        return document.vertices.some((vertex) => vertex.id === ref.id);
      case "room":
        return roomIds.has(ref.id);
      case "opening":
        return document.openings.some((opening) => opening.id === ref.id);
      case "placed-object":
        return document.placedObjects.some((object) => object.id === ref.id);
    }
  };

  const refs: EditorEntityRef[] = [];
  for (const ref of selection.refs) {
    if (!exists(ref)) continue;
    if (refs.some((candidate) => sameEditorEntity(candidate, ref))) continue;
    refs.push(ref);
  }

  if (refs.length === 0) return EMPTY_EDITOR_SELECTION;

  const survivingPrimary = selection.primary
    ? refs.find((candidate) => sameEditorEntity(candidate, selection.primary!)) ?? null
    : null;

  return {
    refs,
    primary: survivingPrimary ?? refs.at(-1) ?? null,
  };
}
