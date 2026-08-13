import { describe, expect, it } from "vitest";
import type { EditorSelection } from "./editor-selection";
import { resolveEditorPointerGestureIntent } from "./editor-pointer-gesture-intent";

const roomAndObjects: EditorSelection = {
  refs: [
    { kind: "room", id: "room-a" },
    { kind: "placed-object", id: "sofa" },
    { kind: "placed-object", id: "table" },
  ],
  primary: { kind: "placed-object", id: "sofa" },
};

describe("resolveEditorPointerGestureIntent", () => {
  it("routes an already selected furniture body to the explicit room composite move", () => {
    expect(resolveEditorPointerGestureIntent(roomAndObjects, {
      kind: "placed-object-body",
      objectId: "sofa",
    })).toEqual({
      kind: "room-composite-move",
      roomId: "room-a",
      objectIds: ["sofa", "table"],
    });
  });

  it("routes free interior of the selected room to the same room composite membership", () => {
    expect(resolveEditorPointerGestureIntent(roomAndObjects, {
      kind: "room-interior",
      roomId: "room-a",
    })).toEqual({
      kind: "room-composite-move",
      roomId: "room-a",
      objectIds: ["sofa", "table"],
    });
  });

  it("preserves deterministic selected object membership regardless of which selected member starts drag", () => {
    expect(resolveEditorPointerGestureIntent(roomAndObjects, {
      kind: "placed-object-body",
      objectId: "table",
    })).toEqual({
      kind: "room-composite-move",
      roomId: "room-a",
      objectIds: ["sofa", "table"],
    });
  });

  it("keeps an unselected furniture body on the ordinary placed-object path", () => {
    expect(resolveEditorPointerGestureIntent(roomAndObjects, {
      kind: "placed-object-body",
      objectId: "chair-unselected",
    })).toEqual({ kind: "placed-object-move", objectId: "chair-unselected" });
  });

  it("gives hosted opening movement priority over a room composite", () => {
    expect(resolveEditorPointerGestureIntent(roomAndObjects, {
      kind: "opening-body",
      openingId: "door-a",
    })).toEqual({ kind: "opening-host-move", openingId: "door-a" });
  });

  it("gives object transform handles priority over a room composite", () => {
    expect(resolveEditorPointerGestureIntent(roomAndObjects, {
      kind: "object-transform-handle",
      objectId: "sofa",
    })).toEqual({ kind: "specialized-control" });
  });

  it("gives structural controls priority over a room composite", () => {
    expect(resolveEditorPointerGestureIntent(roomAndObjects, {
      kind: "structural-control",
      entityId: "vertex-a",
    })).toEqual({ kind: "specialized-control" });
  });

  it("never creates a room composite gesture for an unsupported room plus wall selection", () => {
    const unsupported: EditorSelection = {
      refs: [
        { kind: "room", id: "room-a" },
        { kind: "wall", id: "wall-a" },
      ],
      primary: { kind: "room", id: "room-a" },
    };

    expect(resolveEditorPointerGestureIntent(unsupported, {
      kind: "room-interior",
      roomId: "room-a",
    })).toEqual({ kind: "none" });
  });
});
