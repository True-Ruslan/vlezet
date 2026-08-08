import { createPlacedObject, type PlacedObject, type Point2 } from "@vlezet/domain";
import { objectRectangle, orientedRectangleCorners } from "@vlezet/geometry";

export type VlezetClipboardPayloadV1 = Readonly<{
  version: 1;
  kind: "placed-objects";
  copiedAtOrigin: Point2;
  objects: readonly PlacedObject[];
}>;

export type EditorClipboardState = Readonly<{
  payload: VlezetClipboardPayloadV1 | null;
  lastPasteAnchor: Point2 | null;
  repeatedPasteCount: number;
}>;

export const EMPTY_EDITOR_CLIPBOARD_STATE: EditorClipboardState = Object.freeze({
  payload: null,
  lastPasteAnchor: null,
  repeatedPasteCount: 0,
});

function assertFinitePoint(point: Point2, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${label} must contain finite coordinates`);
  }
}

function clonePlacedObject(object: PlacedObject): PlacedObject {
  return createPlacedObject({
    ...object,
    position: { ...object.position },
    clearance: { ...object.clearance },
  });
}

function groupBoundsCenter(objects: readonly PlacedObject[]): Point2 {
  if (objects.length === 0) {
    throw new RangeError("Placed-object clipboard cannot be empty");
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const object of objects) {
    for (const point of orientedRectangleCorners(objectRectangle(object))) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

export function createPlacedObjectClipboardPayload(
  objects: readonly PlacedObject[],
): VlezetClipboardPayloadV1 {
  const snapshots = objects.map(clonePlacedObject);
  const copiedAtOrigin = groupBoundsCenter(snapshots);
  return {
    version: 1,
    kind: "placed-objects",
    copiedAtOrigin: { ...copiedAtOrigin },
    objects: snapshots,
  };
}

export function derivePasteObjects(input: Readonly<{
  payload: VlezetClipboardPayloadV1;
  anchor: Point2;
  repetition: number;
  idFactory: () => string;
}>): readonly PlacedObject[] {
  const { payload, anchor, repetition, idFactory } = input;
  if (payload.version !== 1 || payload.kind !== "placed-objects") {
    throw new RangeError("Unsupported clipboard payload");
  }
  if (payload.objects.length === 0) {
    throw new RangeError("Placed-object clipboard cannot be empty");
  }
  assertFinitePoint(payload.copiedAtOrigin, "Clipboard origin");
  assertFinitePoint(anchor, "Paste anchor");
  if (!Number.isSafeInteger(repetition) || repetition < 0) {
    throw new RangeError("Paste repetition must be a non-negative safe integer");
  }

  const repeatedOffset = repetition * 200;
  const delta = {
    x: anchor.x - payload.copiedAtOrigin.x + repeatedOffset,
    y: anchor.y - payload.copiedAtOrigin.y + repeatedOffset,
  };
  const sourceIds = new Set(payload.objects.map((object) => object.id));
  const generatedIds = new Set<string>();

  return payload.objects.map((source) => {
    const id = idFactory().trim();
    if (!id) throw new RangeError("Generated placed-object id cannot be blank");
    if (sourceIds.has(id)) {
      throw new RangeError(`Paste cannot reuse source placed-object id: ${id}`);
    }
    if (generatedIds.has(id)) {
      throw new RangeError(`Duplicate generated placed-object id: ${id}`);
    }
    generatedIds.add(id);

    return createPlacedObject({
      ...source,
      id,
      position: {
        x: source.position.x + delta.x,
        y: source.position.y + delta.y,
      },
      clearance: { ...source.clearance },
    });
  });
}
