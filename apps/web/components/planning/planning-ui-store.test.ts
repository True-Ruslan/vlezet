import type { PlanningCandidate } from "@vlezet/planning";
import { describe, expect, it } from "vitest";
import { createPlanningUiStore } from "./planning-ui-store";

const candidate: PlanningCandidate = {
  id: "candidate:preview",
  roomId: "room-1",
  placements: [{ objectId: "sofa", position: { x: 1000, y: 2000 }, rotationDeg: 90 }],
};

describe("planning UI store", () => {
  it("keeps room and preview candidate as ephemeral UI-only state", () => {
    const store = createPlanningUiStore();
    store.getState().openForRoom("room-1");
    store.getState().setPreviewCandidate(candidate);
    expect(store.getState()).toMatchObject({ roomId: "room-1", previewCandidate: candidate });

    store.getState().close();
    expect(store.getState()).toMatchObject({ roomId: null, previewCandidate: null });
  });

  it("clears an old preview when opening planning for another room", () => {
    const store = createPlanningUiStore();
    store.getState().openForRoom("room-1");
    store.getState().setPreviewCandidate(candidate);
    store.getState().openForRoom("room-2");
    expect(store.getState().roomId).toBe("room-2");
    expect(store.getState().previewCandidate).toBeNull();
  });
});
