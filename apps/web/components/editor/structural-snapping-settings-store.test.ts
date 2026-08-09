import { describe, expect, it } from "vitest";
import { createStructuralSnappingSettingsStore } from "./structural-snapping-settings-store";

describe("M8.2 structural snapping settings", () => {
  it("defaults enabled and supports explicit set plus toggle without persistence", () => {
    const store = createStructuralSnappingSettingsStore();

    expect(store.getState().enabled).toBe(true);
    store.getState().setEnabled(false);
    expect(store.getState().enabled).toBe(false);
    store.getState().toggle();
    expect(store.getState().enabled).toBe(true);
    store.getState().setEnabled(true);
    expect(store.getState().enabled).toBe(true);
  });

  it("creates isolated runtime-only instances", () => {
    const first = createStructuralSnappingSettingsStore();
    const second = createStructuralSnappingSettingsStore();

    first.getState().setEnabled(false);

    expect(first.getState().enabled).toBe(false);
    expect(second.getState().enabled).toBe(true);
  });
});
