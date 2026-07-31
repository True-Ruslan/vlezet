import { beforeEach, describe, expect, it } from "vitest";
import { measurementToolStore } from "./measurement-tool-store";

describe("M7.4 measurement tool phase", () => {
  beforeEach(() => {
    measurementToolStore.getState().setActive(false);
  });

  it("starts inactive and idle", () => {
    expect(measurementToolStore.getState()).toMatchObject({ active: false, phase: "idle" });
  });

  it("resets phase when measurement is deactivated", () => {
    const store = measurementToolStore.getState();
    store.setActive(true);
    measurementToolStore.getState().setPhase("measuring");
    measurementToolStore.getState().setActive(false);

    expect(measurementToolStore.getState()).toMatchObject({ active: false, phase: "idle" });
  });

  it("resets the current measurement without leaving the tool", () => {
    const store = measurementToolStore.getState();
    store.setActive(true);
    measurementToolStore.getState().setPhase("complete");
    measurementToolStore.getState().resetMeasurement();

    expect(measurementToolStore.getState()).toMatchObject({ active: true, phase: "idle" });
  });

  it("does not expose a non-idle phase while inactive", () => {
    measurementToolStore.getState().setPhase("measuring");
    expect(measurementToolStore.getState()).toMatchObject({ active: false, phase: "idle" });
  });
});
