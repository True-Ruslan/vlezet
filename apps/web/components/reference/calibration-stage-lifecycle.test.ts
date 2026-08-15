import { describe, expect, it, vi } from "vitest";
import {
  INITIAL_CALIBRATION_STAGE_STATE,
  type CalibrationStageHandlers,
  type CalibrationStageSnapshot,
} from "./calibration-stage-controller";
import {
  bindCalibrationStageElement,
  installCalibrationStageWheelListener,
} from "./calibration-stage-lifecycle";

function createStateHarness(initial: CalibrationStageSnapshot = INITIAL_CALIBRATION_STAGE_STATE) {
  let state = initial;
  return {
    get state() {
      return state;
    },
    setState(update: CalibrationStageSnapshot | ((value: CalibrationStageSnapshot) => CalibrationStageSnapshot)) {
      state = typeof update === "function" ? update(state) : update;
    },
  };
}

describe("calibration stage lifecycle", () => {
  it("binds the rendered stage and fits the source exactly once", () => {
    const state = createStateHarness();
    let boundElement: HTMLDivElement | null = null;
    const element = {
      clientWidth: 800,
      clientHeight: 600,
    } as HTMLDivElement;

    bindCalibrationStageElement({ naturalWidth: 1000, naturalHeight: 500 }, (value) => {
      boundElement = value;
    }, state.setState, element);

    expect(boundElement).toBe(element);
    expect(state.state.viewport).toEqual({
      scale: 0.768,
      offsetX: 16,
      offsetY: 108,
    });

    const preservedViewport = { scale: 2, offsetX: -50, offsetY: 25 };
    state.setState((current) => ({ ...current, viewport: preservedViewport }));
    bindCalibrationStageElement({ naturalWidth: 1000, naturalHeight: 500 }, () => undefined, state.setState, element);
    expect(state.state.viewport).toEqual(preservedViewport);
  });

  it("records null or image-less stage bindings without inventing a viewport", () => {
    const state = createStateHarness();
    const bindings: Array<HTMLDivElement | null> = [];

    bindCalibrationStageElement(null, (value) => bindings.push(value), state.setState, null);
    expect(bindings).toEqual([null]);
    expect(state.state.viewport).toBeNull();

    const element = { clientWidth: 800, clientHeight: 600 } as HTMLDivElement;
    bindCalibrationStageElement(null, (value) => bindings.push(value), state.setState, element);
    expect(bindings).toEqual([null, element]);
    expect(state.state.viewport).toBeNull();
  });

  it("installs one non-passive native wheel listener and removes the identical listener", () => {
    const wheel = vi.fn();
    const handlers = { onWheel: wheel } as unknown as CalibrationStageHandlers;
    const listenerState: {
      installed?: (event: WheelEvent) => void;
      removed?: (event: WheelEvent) => void;
    } = {};
    let options: AddEventListenerOptions | boolean | undefined;
    const element = {
      addEventListener(type: string, listener: EventListenerOrEventListenerObject, value?: AddEventListenerOptions | boolean) {
        expect(type).toBe("wheel");
        listenerState.installed = listener as (event: WheelEvent) => void;
        options = value;
      },
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        expect(type).toBe("wheel");
        listenerState.removed = listener as (event: WheelEvent) => void;
      },
    } as unknown as HTMLDivElement;

    const cleanup = installCalibrationStageWheelListener(element, handlers);
    expect(options).toEqual({ passive: false });
    expect(listenerState.installed).toBe(handlers.onWheel);

    const installed = listenerState.installed;
    if (!installed) throw new Error("Expected the calibration wheel listener to be installed.");
    const event = { deltaY: 12 } as WheelEvent;
    installed(event);
    expect(wheel).toHaveBeenCalledWith(event);

    cleanup?.();
    expect(listenerState.removed).toBe(installed);
  });

  it("does nothing when the stage or handlers are unavailable", () => {
    const handlers = { onWheel: vi.fn() } as unknown as CalibrationStageHandlers;
    expect(installCalibrationStageWheelListener(null, handlers)).toBeUndefined();
    expect(installCalibrationStageWheelListener({} as HTMLDivElement, null)).toBeUndefined();
  });
});
