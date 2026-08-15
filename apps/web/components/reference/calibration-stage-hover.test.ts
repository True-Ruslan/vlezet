import { describe, expect, it, vi } from "vitest";
import {
  INITIAL_CALIBRATION_STAGE_STATE,
  createCalibrationStageHandlers,
  type CalibrationStageElementLike,
  type CalibrationStageSnapshot,
} from "./calibration-stage-controller";

function stage(): CalibrationStageElementLike {
  return {
    clientWidth: 800,
    clientHeight: 300,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 300 }),
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false),
  };
}

function harness(initial: CalibrationStageSnapshot) {
  let current = initial;
  return {
    get current() { return current; },
    setState(update: CalibrationStageSnapshot | ((value: CalibrationStageSnapshot) => CalibrationStageSnapshot)) {
      current = typeof update === "function" ? update(current) : update;
    },
  };
}

function handlers(state: ReturnType<typeof harness>, element: CalibrationStageElementLike) {
  return createCalibrationStageHandlers({
    state: state.current,
    setState: state.setState,
    draft: { pointA: null, pointB: null },
    onChange: vi.fn(),
    stage: () => element,
    sourceImage: { naturalWidth: 800, naturalHeight: 200 },
    readFeatures: () => [],
  });
}

function pointer(element: CalibrationStageElementLike, clientX: number, clientY: number) {
  return {
    clientX,
    clientY,
    pointerId: 7,
    button: 0,
    altKey: false,
    currentTarget: element,
    preventDefault: vi.fn(),
  };
}

describe("calibration hover evidence", () => {
  it("tracks idle hover in natural-image coordinates without mutating calibration points", () => {
    const element = stage();
    const state = harness({
      ...INITIAL_CALIBRATION_STAGE_STATE,
      viewport: { scale: 0.5, offsetX: 20, offsetY: 30 },
    });
    const onChange = vi.fn();
    const stageHandlers = createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft: { pointA: null, pointB: null },
      onChange,
      stage: () => element,
      sourceImage: { naturalWidth: 800, naturalHeight: 200 },
      readFeatures: () => [],
    });

    stageHandlers.onPointerMove(pointer(element, 320, 130));

    expect(state.current).toMatchObject({ hoverPoint: { x: 400, y: 100 } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears idle hover on pointer leave without ending an unrelated gesture", () => {
    const element = stage();
    const state = harness({
      ...INITIAL_CALIBRATION_STAGE_STATE,
      viewport: { scale: 1, offsetX: 0, offsetY: 0 },
      hoverPoint: { x: 100, y: 80 },
    } as CalibrationStageSnapshot);

    handlers(state, element).onPointerLeave();

    expect(state.current).toMatchObject({ hoverPoint: null });
  });
});
