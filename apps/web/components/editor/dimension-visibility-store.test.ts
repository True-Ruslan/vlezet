import { describe, expect, it } from "vitest";
import { createDimensionVisibilityStore } from "./dimension-visibility-store";

describe("dimension visibility store", () => {
  it("shows dimension lines by default and toggles them explicitly", () => {
    const store = createDimensionVisibilityStore();
    expect(store.getState().visible).toBe(true);
    store.getState().toggle();
    expect(store.getState().visible).toBe(false);
    store.getState().toggle();
    expect(store.getState().visible).toBe(true);
  });
});
