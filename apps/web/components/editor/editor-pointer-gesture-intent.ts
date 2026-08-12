import type { EditorSelection } from "./editor-selection";

export type EditorPointerDirectHit =
  | Readonly<{ kind: "room-interior"; roomId: string }>
  | Readonly<{ kind: "placed-object-body"; objectId: string }>
  | Readonly<{ kind: "opening-body"; openingId: string }>
  | Readonly<{ kind: "object-transform-handle"; objectId: string }>
  | Readonly<{ kind: "structural-control"; entityId: string }>
  | Readonly<{ kind: "none" }>;

export type EditorPointerGestureIntent =
  | Readonly<{ kind: "room-composite-move"; roomId: string; objectIds: readonly string[] }>
  | Readonly<{ kind: "opening-host-move"; openingId: string }>
  | Readonly<{ kind: "placed-object-move"; objectId: string }>
  | Readonly<{ kind: "specialized-control" }>
  | Readonly<{ kind: "none" }>;

export function resolveEditorPointerGestureIntent(
  selection: EditorSelection,
  hit: EditorPointerDirectHit,
): EditorPointerGestureIntent {
  if (hit.kind === "opening-body") {
    return { kind: "opening-host-move", openingId: hit.openingId };
  }
  if (hit.kind === "object-transform-handle" || hit.kind === "structural-control") {
    return { kind: "specialized-control" };
  }
  if (hit.kind === "none") return { kind: "none" };

  const roomRefs = selection.refs.filter((ref) => ref.kind === "room");
  const objectRefs = selection.refs.filter((ref) => ref.kind === "placed-object");
  const isRoomComposite = roomRefs.length === 1 &&
    selection.refs.every((ref) => ref.kind === "room" || ref.kind === "placed-object");

  if (isRoomComposite) {
    const roomId = roomRefs[0]!.id;
    const objectIds = objectRefs.map((ref) => ref.id);
    if (hit.kind === "room-interior" && hit.roomId === roomId) {
      return { kind: "room-composite-move", roomId, objectIds };
    }
    if (
      hit.kind === "placed-object-body" &&
      objectIds.includes(hit.objectId)
    ) {
      return { kind: "room-composite-move", roomId, objectIds };
    }
  }

  if (hit.kind === "placed-object-body") {
    return { kind: "placed-object-move", objectId: hit.objectId };
  }
  return { kind: "none" };
}
