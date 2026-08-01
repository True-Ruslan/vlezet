import { describe, expect, it } from "vitest";
import { createGeometryInspectorPreviewStore } from "./geometry-inspector-preview-store";

describe("geometry inspector preview store", () => {
  it("stores only presentation intent", () => {
    const store = createGeometryInspectorPreviewStore();
    store.getState().setRoomSpan({ roomId: "room-a", axis: "horizontal" });
    store.getState().setDoorSwing({ openingId: "door-a", value: { hinge: "start", side: "left" } });

    expect(store.getState().roomSpan).toEqual({ roomId: "room-a", axis: "horizontal" });
    expect(store.getState().doorSwing).toEqual({
      openingId: "door-a",
      value: { hinge: "start", side: "left" },
    });
    expect(Object.keys(store.getState())).not.toContain("document");
    expect(Object.keys(store.getState())).not.toContain("geometry");
  });

  it("retains previews for the same selected entities", () => {
    const store = createGeometryInspectorPreviewStore();
    store.getState().setRoomSpan({ roomId: "room-a", axis: "vertical" });
    store.getState().setDoorSwing({ openingId: "door-a", value: { hinge: "end", side: "right" } });

    store.getState().clearForSelection({ roomId: "room-a", openingId: "door-a" });

    expect(store.getState().roomSpan?.axis).toBe("vertical");
    expect(store.getState().doorSwing?.value).toEqual({ hinge: "end", side: "right" });
  });

  it("clears stale preview when the selected entity changes", () => {
    const store = createGeometryInspectorPreviewStore();
    store.getState().setRoomSpan({ roomId: "room-a", axis: "horizontal" });
    store.getState().setDoorSwing({ openingId: "door-a", value: { hinge: "start", side: "left" } });

    store.getState().clearForSelection({ roomId: "room-b", openingId: "door-b" });

    expect(store.getState().roomSpan).toBeNull();
    expect(store.getState().doorSwing).toBeNull();
  });

  it("clears each preview independently", () => {
    const store = createGeometryInspectorPreviewStore();
    store.getState().setRoomSpan({ roomId: "room-a", axis: "horizontal" });
    store.getState().setDoorSwing({ openingId: "door-a", value: { hinge: "start", side: "left" } });

    store.getState().clearForSelection({ roomId: "room-a", openingId: null });

    expect(store.getState().roomSpan).not.toBeNull();
    expect(store.getState().doorSwing).toBeNull();
  });

  it("resets all runtime intent", () => {
    const store = createGeometryInspectorPreviewStore();
    store.getState().setRoomSpan({ roomId: "room-a", axis: "horizontal" });
    store.getState().setDoorSwing({ openingId: "door-a", value: { hinge: "start", side: "left" } });

    store.getState().reset();

    expect(store.getState().roomSpan).toBeNull();
    expect(store.getState().doorSwing).toBeNull();
  });
});
