import { afterEach, describe, expect, it, vi } from "vitest";

const reactHarness = vi.hoisted(() => ({
  stageElement: null as HTMLDivElement | null,
  cleanups: [] as Array<(() => void) | undefined>,
  callbacks: [] as Array<(element: HTMLDivElement | null) => void>,
  stateSetters: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState(initial: unknown) {
      const setter = vi.fn();
      reactHarness.stateSetters.push(setter);
      if (initial === null) return [reactHarness.stageElement, setter];
      return [typeof initial === "function" ? (initial as () => unknown)() : initial, setter];
    },
    useCallback<T>(callback: T) {
      reactHarness.callbacks.push(callback as unknown as (element: HTMLDivElement | null) => void);
      return callback;
    },
    useEffect(effect: () => void | (() => void)) {
      reactHarness.cleanups.push(effect() ?? undefined);
    },
  };
});

import { PrecisionCalibrationStage } from "./calibration-stage";
import { INITIAL_CALIBRATION_STAGE_STATE } from "./calibration-stage-controller";

afterEach(() => {
  for (const cleanup of reactHarness.cleanups.splice(0)) cleanup?.();
  reactHarness.stageElement = null;
  reactHarness.callbacks.length = 0;
  reactHarness.stateSetters.length = 0;
});

describe("PrecisionCalibrationStage lifecycle wiring", () => {
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

  it("binds the rendered stage ref and performs the initial image fit", () => {
    const stageElement = {
      clientWidth: 800,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      focus: vi.fn(),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => false),
    } as unknown as HTMLDivElement;
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

    expect(reactHarness.callbacks).toHaveLength(1);
    reactHarness.callbacks[0]!(stageElement);

    const stageElementSetter = reactHarness.stateSetters[0]!;
    const stageStateSetter = reactHarness.stateSetters[1]!;
    expect(stageElementSetter).toHaveBeenCalledWith(stageElement);
    expect(stageStateSetter).toHaveBeenCalledTimes(1);
    const update = stageStateSetter.mock.calls[0]![0] as (
      state: typeof INITIAL_CALIBRATION_STAGE_STATE,
    ) => typeof INITIAL_CALIBRATION_STAGE_STATE;
    const nextState = update(INITIAL_CALIBRATION_STAGE_STATE);
    expect(nextState.viewport).not.toBeNull();
    expect(nextState.viewport?.scale).toBeGreaterThan(0);
  });
});
