import type { PlanningCandidate } from "@vlezet/planning";
import { describe, expect, it } from "vitest";
import { createPlanningUiStore } from "./planning-ui-store";

const candidate: PlanningCandidate = {
  id: "candidate:preview",
  roomId: "room-1",
  placements: [
    { objectId: "sofa", position: { x: 1000, y: 2000 }, rotationDeg: 90 },
    { objectId: "table", position: { x: 2800, y: 2000 }, rotationDeg: 0 },
    { objectId: "chair", position: { x: 3900, y: 2400 }, rotationDeg: 0 },
  ],
  constraints: [
    { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
    { kind: "pair-min-gap", objectIds: ["chair", "table"], minimumMm: 600 },
  ],
};

describe("planning UI store", () => {
  it("keeps room and preview candidate as ephemeral UI-only state", () => {
    const store = createPlanningUiStore();
    store.getState().openForRoom("room-1");
    store.getState().setPreviewCandidate(candidate);
    expect(store.getState()).toMatchObject({
      roomId: "room-1",
      previewCandidate: candidate,
      activeExactPairKey: "chair|table",
    });

    store.getState().close();
    expect(store.getState()).toMatchObject({
      roomId: null,
      previewCandidate: null,
      activeExactPairKey: null,
    });
  });

  it("selects the first deterministic exact pair when Preview starts", () => {
    const store = createPlanningUiStore();
    store.getState().openForRoom("room-1");
    store.getState().setPreviewCandidate(candidate);
    expect(store.getState().activeExactPairKey).toBe("chair|table");
  });

  it("switches only active pair state and clears it with Preview", () => {
    const store = createPlanningUiStore();
    store.getState().openForRoom("room-1");
    store.getState().setPreviewCandidate(candidate);
    store.getState().setActiveExactPairKey("sofa|table");
    expect(store.getState()).toMatchObject({
      roomId: "room-1",
      previewCandidate: candidate,
      activeExactPairKey: "sofa|table",
    });

    store.getState().setPreviewCandidate(null);
    expect(store.getState()).toMatchObject({
      roomId: "room-1",
      previewCandidate: null,
      activeExactPairKey: null,
    });
  });

  it("clears preview and active pair when opening another room", () => {
    const store = createPlanningUiStore();
    store.getState().openForRoom("room-1");
    store.getState().setPreviewCandidate(candidate);
    store.getState().openForRoom("room-2");
    expect(store.getState()).toMatchObject({
      roomId: "room-2",
      previewCandidate: null,
      activeExactPairKey: null,
    });
  });
});
