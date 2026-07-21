import {
  createPlacedObject,
  type PlacedObject,
  type VlezetDocument,
} from "@vlezet/domain";

export type PlacedObjectPatch = Readonly<Partial<Omit<PlacedObject, "id" | "presetId" | "category">>>;

function objectIndex(document: VlezetDocument, objectId: string): number {
  const index = document.placedObjects.findIndex((candidate) => candidate.id === objectId);
  if (index < 0) throw new Error(`Placed object does not exist: ${objectId}`);
  return index;
}

function assertUniqueId(document: VlezetDocument, objectId: string): void {
  if (document.placedObjects.some((candidate) => candidate.id === objectId)) {
    throw new Error(`Placed object already exists: ${objectId}`);
  }
}

function replaceAt(
  document: VlezetDocument,
  index: number,
  object: PlacedObject,
): VlezetDocument {
  return {
    ...document,
    placedObjects: document.placedObjects.map((candidate, candidateIndex) =>
      candidateIndex === index ? object : candidate,
    ),
  };
}

export function addPlacedObject(
  document: VlezetDocument,
  object: PlacedObject,
): VlezetDocument {
  assertUniqueId(document, object.id);
  const validated = createPlacedObject(object);
  return {
    ...document,
    placedObjects: [...document.placedObjects, validated],
  };
}

export function updatePlacedObject(
  document: VlezetDocument,
  objectId: string,
  patch: PlacedObjectPatch,
): VlezetDocument {
  const index = objectIndex(document, objectId);
  const current = document.placedObjects[index]!;
  const updated = createPlacedObject({
    ...current,
    ...patch,
    id: current.id,
    presetId: current.presetId,
    category: current.category,
    position: patch.position ? { ...patch.position } : current.position,
    clearance: patch.clearance ? { ...patch.clearance } : current.clearance,
  });
  return replaceAt(document, index, updated);
}

export function movePlacedObject(
  document: VlezetDocument,
  objectId: string,
  position: PlacedObject["position"],
): VlezetDocument {
  return updatePlacedObject(document, objectId, { position });
}

export function rotatePlacedObject(
  document: VlezetDocument,
  objectId: string,
  rotationDeg: number,
): VlezetDocument {
  return updatePlacedObject(document, objectId, { rotationDeg });
}

export function resizePlacedObject(
  document: VlezetDocument,
  objectId: string,
  width: number,
  depth: number,
): VlezetDocument {
  return updatePlacedObject(document, objectId, { width, depth });
}

export function duplicatePlacedObject(
  document: VlezetDocument,
  objectId: string,
  newObjectId: string,
  offset: Readonly<{ x: number; y: number }> = { x: 200, y: 200 },
): VlezetDocument {
  const index = objectIndex(document, objectId);
  assertUniqueId(document, newObjectId);
  if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) {
    throw new RangeError("Duplicate offset must be finite");
  }
  const source = document.placedObjects[index]!;
  return addPlacedObject(document, {
    ...source,
    id: newObjectId,
    position: {
      x: source.position.x + offset.x,
      y: source.position.y + offset.y,
    },
  });
}

export function deletePlacedObject(
  document: VlezetDocument,
  objectId: string,
): VlezetDocument {
  objectIndex(document, objectId);
  return {
    ...document,
    placedObjects: document.placedObjects.filter((candidate) => candidate.id !== objectId),
  };
}
