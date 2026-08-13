import type { VlezetDocument } from "@vlezet/domain";
import {
  deriveRooms,
  objectRectangle,
  orientedRectangleCorners,
  polygonContainsPolygonInclusive,
} from "@vlezet/geometry";
import {
  addToSelection,
  sanitizeEditorSelection,
  type EditorSelection,
} from "./editor-selection";

export function selectFurnitureInSelectedRoom(
  document: VlezetDocument,
  selection: EditorSelection,
): EditorSelection {
  const sanitized = sanitizeEditorSelection(document, selection);
  const roomRefs = sanitized.refs.filter((ref) => ref.kind === "room");
  const unsupported = sanitized.refs.some(
    (ref) => ref.kind !== "room" && ref.kind !== "placed-object",
  );

  if (roomRefs.length !== 1 || unsupported) return selection;

  const room = deriveRooms(document).rooms.find((candidate) => candidate.id === roomRefs[0]!.id);
  if (!room) return selection;

  const contained = document.placedObjects.flatMap((object) => {
    const footprint = orientedRectangleCorners(objectRectangle(object));
    return polygonContainsPolygonInclusive(room.polygon, footprint)
      ? [{ kind: "placed-object" as const, id: object.id }]
      : [];
  });

  return addToSelection(sanitized, contained);
}
