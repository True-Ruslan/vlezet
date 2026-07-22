import { describe, expect, it } from "vitest";
import { createSpatialViewModeStore } from "./view-mode-store";

describe("spatial view mode store", () => {
  it("starts in 2D and switches explicitly without semantic payload", () => {
    const store = createSpatialViewModeStore();

    expect(store.getState().mode).toBe("2d");
    store.getState().setMode("3d");
    expect(store.getState().mode).toBe("3d");
    store.getState().setMode("2d");
    expect(store.getState().mode).toBe("2d");
  });

  it("can be initialized independently for isolated tests", () => {
    expect(createSpatialViewModeStore("3d").getState().mode).toBe("3d");
  });
});
