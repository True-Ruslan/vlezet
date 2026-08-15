import { describe, expect, it, vi } from "vitest";
import {
  createCalibrationStageHandlers,
  INITIAL_CALIBRATION_STAGE_STATE,
  type CalibrationStageElementLike,
  type CalibrationStageSnapshot,
} from "./calibration-stage-controller";

function stage(): CalibrationStageElementLike {
  return {
    clientWidth: 800,
    clientHeight: 300,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 300 }),
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
  };
}

function pointer(currentTarget: CalibrationStageElementLike, clientX: number, pointerId: number) {
  return {
    clientX,
    clientY: 100,
    pointerId,
    button: 0,
    altKey: false,
    currentTarget,
    preventDefault: vi.fn(),
  };
}

describe("calibration stage live event state", () => {
  it("places B on the second click even when both clicks use one handler instance", () => {
    const element = stage();
    let state: CalibrationStageSnapshot = {
      ...INITIAL_CALIBRATION_STAGE_STATE,
      viewport: { scale: 1, offsetX: 0, offsetY: 0 },
      snapEnabled: false,
    };
    let draft = { pointA: null as { x: number; y: number } | null, pointB: null as { x: number; y: number } | null };

    const handlers = createCalibrationStageHandlers({
      state,
      setState(update) {
        state = typeof update === "function" ? update(state) : update;
      },
      draft,
      onChange(patch) {
        draft = { ...draft, ...patch };
      },
      stage: () => element,
      sourceImage: { naturalWidth: 800, naturalHeight: 200 },
      readFeatures: () => [],
    });

    handlers.onPointerDown(pointer(element, 100, 1));
    handlers.onPointerUp(pointer(element, 100, 1));
    handlers.onPointerDown(pointer(element, 700, 2));

    expect(draft).toEqual({
      pointA: { x: 100, y: 100 },
      pointB: { x: 700, y: 100 },
    });
  });

  it("accumulates consecutive wheel pans through one handler instance", () => {
    const element = stage();
    let state: CalibrationStageSnapshot = {
      ...INITIAL_CALIBRATION_STAGE_STATE,
      viewport: { scale: 1, offsetX: 0, offsetY: 0 },
    };
    const handlers = createCalibrationStageHandlers({
      state,
      setState(update) {
        state = typeof update === "function" ? update(state) : update;
      },
      draft: { pointA: null, pointB: null },
      onChange: () => {},
      stage: () => element,
      sourceImage: { naturalWidth: 800, naturalHeight: 200 },
      readFeatures: () => [],
    });

    handlers.onWheel({ clientX: 200, clientY: 100, deltaX: 10, deltaY: 20, ctrlKey: false, metaKey: false, preventDefault: vi.fn() });
    handlers.onWheel({ clientX: 200, clientY: 100, deltaX: 5, deltaY: 7, ctrlKey: false, metaKey: false, preventDefault: vi.fn() });

    expect(state.viewport).toEqual({ scale: 1, offsetX: -15, offsetY: -27 });
  });
});
