import { afterEach, describe, expect, it, vi } from "vitest";

const reactHarness = vi.hoisted(() => ({
  stageElement: null as HTMLDivElement | null,
  cleanups: [] as Array<(() => void) | undefined>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState(initial: unknown) {
      if (initial === null) return [reactHarness.stageElement, vi.fn()];
      return [typeof initial === "function" ? (initial as () => unknown)() : initial, vi.fn()];
    },
    useCallback<T>(callback: T) {
      return callback;
    },
    useEffect(effect: () => void | (() => void)) {
      reactHarness.cleanups.push(effect() ?? undefined);
    },
  };
});

import { PrecisionCalibrationStage } from "./calibration-stage";

afterEach(() => {
  for (const cleanup of reactHarness.cleanups.splice(0)) cleanup?.();
  reactHarness.stageElement = null;
});

describe("PrecisionCalibrationStage wheel lifecycle wiring", () => {
  it("runs the effect that installs a non-passive wheel listener and returns its cleanup", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const stageElement = {
      clientWidth: 800,
      clientHeight: 600,
      addEventListener,
      removeEventListener,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      focus: vi.fn(),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => false),
    } as unknown as HTMLDivElement;
    reactHarness.stageElement = stageElement;

    const image = {
      src: "data:image/png;base64,AA==",
      naturalWidth: 1000,
      naturalHeight: 500,
    } as HTMLImageElement;

    PrecisionCalibrationStage({
      image,
      error: null,
      draft: { pointA: null, pointB: null },
      onChange: vi.fn(),
    });

    expect(addEventListener).toHaveBeenCalledTimes(1);
    const [type, listener, options] = addEventListener.mock.calls[0]!;
    expect(type).toBe("wheel");
    expect(listener).toBeTypeOf("function");
    expect(options).toEqual({ passive: false });
    expect(reactHarness.cleanups).toHaveLength(1);

    reactHarness.cleanups[0]?.();
    reactHarness.cleanups.length = 0;
    expect(removeEventListener).toHaveBeenCalledWith("wheel", listener);
  });
});
