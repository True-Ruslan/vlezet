import { createPlacedObject, type PlacedObject } from "@vlezet/domain";
import { objectRectangle, orientedRectangleCorners } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import {
  createPlacedObjectClipboardPayload,
  derivePasteObjects,
} from "./editor-clipboard";

function sourceObjects() {
  return [
    createPlacedObject({
      id: "chair-1",
      presetId: null,
      name: "Стул",
      category: "chair",
      position: { x: 1000, y: 1000 },
      width: 500,
      depth: 500,
      rotationDeg: 15,
      clearance: { front: 100, right: 50, back: 25, left: 75 },
    }),
    createPlacedObject({
      id: "table-1",
      presetId: null,
      name: "Стол",
      category: "table",
      position: { x: 3000, y: 2000 },
      width: 1000,
      depth: 600,
      rotationDeg: 45,
      clearance: { front: 200, right: 100, back: 50, left: 150 },
    }),
  ] as const;
}

function boundsCenter(objects: readonly PlacedObject[]) {
  const corners = objects.flatMap((object) => orientedRectangleCorners(objectRectangle(object)));
  return {
    x: (Math.min(...corners.map((point) => point.x)) + Math.max(...corners.map((point) => point.x))) / 2,
    y: (Math.min(...corners.map((point) => point.y)) + Math.max(...corners.map((point) => point.y))) / 2,
  };
}

function ids(...values: string[]) {
  let index = 0;
  return () => {
    const value = values[index++];
    if (!value) throw new Error("Unexpected id request");
    return value;
  };
}

describe("M8.1 semantic placed-object clipboard", () => {
  it("creates a versioned immutable payload with a stable rotation-aware bounding-box origin", () => {
    const source = sourceObjects();
    const snapshot = structuredClone(source);

    const payload = createPlacedObjectClipboardPayload(source);
    const reversed = createPlacedObjectClipboardPayload([...source].reverse());

    expect(payload.version).toBe(1);
    expect(payload.kind).toBe("placed-objects");
    expect(payload.objects).toEqual(source);
    expect(payload.objects).not.toBe(source);
    expect(payload.copiedAtOrigin).toEqual(boundsCenter(source));
    expect(payload.copiedAtOrigin).toEqual(reversed.copiedAtOrigin);
    expect(source).toEqual(snapshot);
  });

  it("pastes the complete group around the requested anchor while preserving relative transforms", () => {
    const source = sourceObjects();
    const payload = createPlacedObjectClipboardPayload(source);
    const anchor = { x: 6000, y: 5000 };

    const pasted = derivePasteObjects({
      payload,
      anchor,
      repetition: 0,
      idFactory: ids("copy-chair", "copy-table"),
    });

    expect(pasted).toHaveLength(2);
    expect(pasted.map((object) => object.id)).toEqual(["copy-chair", "copy-table"]);
    expect(pasted[0]?.rotationDeg).toBe(source[0].rotationDeg);
    expect(pasted[1]?.rotationDeg).toBe(source[1].rotationDeg);
    expect(pasted[1]!.position.x - pasted[0]!.position.x).toBe(
      source[1].position.x - source[0].position.x,
    );
    expect(pasted[1]!.position.y - pasted[0]!.position.y).toBe(
      source[1].position.y - source[0].position.y,
    );
    expect(boundsCenter(pasted)).toEqual(anchor);
  });

  it("adds a deterministic 200 mm diagonal offset for repeated paste", () => {
    const payload = createPlacedObjectClipboardPayload(sourceObjects());
    const anchor = { x: 6000, y: 5000 };

    const first = derivePasteObjects({
      payload,
      anchor,
      repetition: 0,
      idFactory: ids("first-chair", "first-table"),
    });
    const third = derivePasteObjects({
      payload,
      anchor,
      repetition: 2,
      idFactory: ids("third-chair", "third-table"),
    });

    expect(third[0]?.position).toEqual({
      x: first[0]!.position.x + 400,
      y: first[0]!.position.y + 400,
    });
    expect(third[1]?.position).toEqual({
      x: first[1]!.position.x + 400,
      y: first[1]!.position.y + 400,
    });
  });

  it("never reuses source IDs or mutates source objects/payload", () => {
    const source = sourceObjects();
    const payload = createPlacedObjectClipboardPayload(source);
    const sourceSnapshot = structuredClone(source);
    const payloadSnapshot = structuredClone(payload);

    const pasted = derivePasteObjects({
      payload,
      anchor: { x: 9000, y: 7000 },
      repetition: 1,
      idFactory: ids("new-chair", "new-table"),
    });

    expect(pasted.map((object) => object.id)).toEqual(["new-chair", "new-table"]);
    expect(pasted.map((object) => object.id)).not.toEqual(source.map((object) => object.id));
    expect(source).toEqual(sourceSnapshot);
    expect(payload).toEqual(payloadSnapshot);
    expect(pasted[0]?.clearance).not.toBe(source[0].clearance);
    expect(pasted[1]?.clearance).not.toBe(source[1].clearance);
  });
});
