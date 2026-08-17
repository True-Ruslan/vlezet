import { expect, it, vi } from "vitest";
import {
  createCalibrationStageHandlers,
  INITIAL_CALIBRATION_STAGE_STATE,
  type CalibrationStageElementLike,
  type CalibrationStageSnapshot,
} from "./calibration-stage-controller";

it("measures pointer coordinates from the stage content origin, excluding its border", () => {
  const element: CalibrationStageElementLike = {
    clientWidth: 800,
    clientHeight: 200,
    clientLeft: 1,
    clientTop: 1,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 802, height: 202 }),
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
  };
  let state: CalibrationStageSnapshot = {
    ...INITIAL_CALIBRATION_STAGE_STATE,
    viewport: { scale: 1, offsetX: 0, offsetY: 0 },
    snapEnabled: false,
  };
  const onChange = vi.fn();
  const handlers = createCalibrationStageHandlers({
    state,
    setState(update) {
      state = typeof update === "function" ? update(state) : update;
    },
    draft: { pointA: null, pointB: null },
    onChange,
    stage: () => element,
    sourceImage: { naturalWidth: 800, naturalHeight: 200 },
    readFeatures: () => [],
  });

  handlers.onPointerDown({
    clientX: 201,
    clientY: 151,
    pointerId: 1,
    button: 0,
    altKey: false,
    currentTarget: element,
    preventDefault: vi.fn(),
  });

  expect(onChange).toHaveBeenCalledWith({ pointA: { x: 100, y: 100 } });
});
