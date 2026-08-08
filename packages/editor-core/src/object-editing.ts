import {
  createPlacedObject,
  type PlacedObject,
  type Point2,
  type VlezetDocument,
} from "@vlezet/domain";

export type PlacedObjectPatch = Readonly<Partial<Omit<PlacedObject, "id" | "presetId" | "category">>>;

export type PlacedObjectBatchPatch = Readonly<{
  objectId: string;
  patch: PlacedObjectPatch;
}>;

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

function assertUniqueBatchIds(ids: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate placed object id in batch: ${id}`);
    seen.add(id);
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

function patchPlacedObject(current: PlacedObject, patch: PlacedObjectPatch): PlacedObject {
  return createPlacedObject({
    ...current,
    ...patch,
    id: current.id,
    presetId: current.presetId,
    category: current.category,
    position: patch.position ? { ...patch.position } : current.position,
    clearance: patch.clearance ? { ...patch.clearance } : current.clearance,
  });
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

export function addPlacedObjects(
  document: VlezetDocument,
  objects: readonly PlacedObject[],
): VlezetDocument {
  if (objects.length === 0) return document;

  const ids = objects.map((object) => object.id);
  assertUniqueBatchIds(ids);
  for (const id of ids) assertUniqueId(document, id);

  const validated = objects.map((object) => createPlacedObject(object));
  return {
    ...document,
    placedObjects: [...document.placedObjects, ...validated],
  };
}

export function updatePlacedObject(
  document: VlezetDocument,
  objectId: string,
  patch: PlacedObjectPatch,
): VlezetDocument {
  const index = objectIndex(document, objectId);
  const current = document.placedObjects[index]!;
  return replaceAt(document, index, patchPlacedObject(current, patch));
}

export function updatePlacedObjects(
  document: VlezetDocument,
  patches: readonly PlacedObjectBatchPatch[],
): VlezetDocument {
  if (patches.length === 0) return document;

  const ids = patches.map(({ objectId }) => objectId);
  assertUniqueBatchIds(ids);

  const validatedById = new Map<string, PlacedObject>();
  for (const { objectId, patch } of patches) {
    const index = objectIndex(document, objectId);
    const current = document.placedObjects[index]!;
    validatedById.set(objectId, patchPlacedObject(current, patch));
  }

  return {
    ...document,
    placedObjects: document.placedObjects.map(
      (object) => validatedById.get(object.id) ?? object,
    ),
  };
}

export function movePlacedObject(
  document: VlezetDocument,
  objectId: string,
  position: PlacedObject["position"],
): VlezetDocument {
  return updatePlacedObject(document, objectId, { position });
}

export function translatePlacedObjects(
  document: VlezetDocument,
  objectIds: readonly string[],
  delta: Point2,
): VlezetDocument {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
    throw new RangeError("Translation delta must be finite");
  }
  if (objectIds.length === 0) return document;

  assertUniqueBatchIds(objectIds);
  const patches: PlacedObjectBatchPatch[] = objectIds.map((objectId) => {
    const index = objectIndex(document, objectId);
    const source = document.placedObjects[index]!;
    return {
      objectId,
      patch: {
        position: {
          x: source.position.x + delta.x,
          y: source.position.y + delta.y,
        },
      },
    };
  });

  return updatePlacedObjects(document, patches);
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

export function deletePlacedObjects(
  document: VlezetDocument,
  objectIds: readonly string[],
): VlezetDocument {
  if (objectIds.length === 0) return document;

  assertUniqueBatchIds(objectIds);
  for (const objectId of objectIds) objectIndex(document, objectId);

  const ids = new Set(objectIds);
  return {
    ...document,
    placedObjects: document.placedObjects.filter((object) => !ids.has(object.id)),
  };
}
