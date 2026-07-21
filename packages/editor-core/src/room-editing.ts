import type { VlezetDocumentV2 } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";

export function setRoomName(
  document: VlezetDocumentV2,
  roomId: string,
  name: string,
  annotationId: string,
): VlezetDocumentV2 {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Название комнаты не может быть пустым");
  if (normalizedName.length > 80) throw new Error("Название комнаты слишком длинное");

  const room = deriveRooms(document).rooms.find((candidate) => candidate.id === roomId);
  if (!room) throw new Error(`Room does not exist: ${roomId}`);

  if (room.annotationId) {
    return {
      ...document,
      roomAnnotations: document.roomAnnotations.map((annotation) =>
        annotation.id === room.annotationId ? { ...annotation, name: normalizedName } : annotation,
      ),
    };
  }

  if (!annotationId) throw new Error("Room annotation id must not be empty");
  if (document.roomAnnotations.some((annotation) => annotation.id === annotationId)) {
    throw new Error(`Room annotation already exists: ${annotationId}`);
  }

  return {
    ...document,
    roomAnnotations: [
      ...document.roomAnnotations,
      {
        id: annotationId,
        name: normalizedName,
        anchor: room.labelPoint,
      },
    ],
  };
}
