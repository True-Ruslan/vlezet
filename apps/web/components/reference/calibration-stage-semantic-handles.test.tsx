import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PrecisionCalibrationStage } from "./calibration-stage";
import {
  INITIAL_CALIBRATION_STAGE_STATE,
  createCalibrationStageHandlers,
  type CalibrationStageElementLike,
  type CalibrationStageSnapshot,
} from "./calibration-stage-controller";

const image = {
  src: "blob:semantic-reference",
  naturalWidth: 800,
  naturalHeight: 200,
} as HTMLImageElement;

function stateHarness(initial: CalibrationStageSnapshot) {
  let current = initial;
  return {
    get current() { return current; },
    setState(update: CalibrationStageSnapshot | ((value: CalibrationStageSnapshot) => CalibrationStageSnapshot)) {
      current = typeof update === "function" ? update(current) : update;
    },
  };
}

function stage(): CalibrationStageElementLike {
  return {
    clientWidth: 800,
    clientHeight: 300,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 300 }),
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false),
  };
}

describe("semantic calibration endpoint controls", () => {
  it("renders A and B as focusable buttons rather than visual-only spans", () => {
    const html = renderToStaticMarkup(
      <PrecisionCalibrationStage
        image={image}
        error={null}
        draft={{ pointA: { x: 100, y: 100 }, pointB: { x: 700, y: 100 } }}
        onChange={() => {}}
        initialState={{
          ...INITIAL_CALIBRATION_STAGE_STATE,
          viewport: { scale: 1, offsetX: 0, offsetY: 0 },
        }}
      />,
    );

    expect(html).toMatch(/<button[^>]*data-calibration-point="a"[^>]*type="button"/);
    expect(html).toMatch(/<button[^>]*data-calibration-point="b"[^>]*type="button"/);
  });

  it("focuses an endpoint without mutating points and routes keyboard nudge to that endpoint", () => {
    const element = stage();
    const state = stateHarness({
      ...INITIAL_CALIBRATION_STAGE_STATE,
      viewport: { scale: 1, offsetX: 0, offsetY: 0 },
    });
    const onChange = vi.fn();
    const draft = { pointA: { x: 100, y: 100 }, pointB: { x: 700, y: 100 } };
    const makeHandlers = () => createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft,
      onChange,
      stage: () => element,
      sourceImage: { naturalWidth: 800, naturalHeight: 200 },
      readFeatures: () => [],
    });

    makeHandlers().onHandleFocus("b");
    expect(state.current).toMatchObject({
      activeHandle: "b",
      activeCandidateId: null,
      hoverPoint: { x: 700, y: 100 },
    });
    expect(onChange).not.toHaveBeenCalled();

    const left = { key: "ArrowLeft", shiftKey: false, repeat: false, preventDefault: vi.fn() };
    makeHandlers().onKeyDown(left);
    expect(onChange).toHaveBeenCalledWith({ pointB: { x: 699, y: 100 } });
  });
});
