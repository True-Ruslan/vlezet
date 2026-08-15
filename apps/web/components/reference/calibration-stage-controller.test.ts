import { describe, expect, it, vi } from "vitest";
import type { CalibrationSourceFeature } from "./calibration-snap";
import {
  INITIAL_CALIBRATION_STAGE_STATE,
  createCalibrationStageHandlers,
  type CalibrationStageSnapshot,
  type CalibrationStageElementLike,
} from "./calibration-stage-controller";

function stage(): CalibrationStageElementLike {
  return {
    clientWidth: 800,
    clientHeight: 300,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 300 }),
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
  };
}

function image() {
  return { naturalWidth: 800, naturalHeight: 200 } as HTMLImageElement;
}

function stateHarness(initial: CalibrationStageSnapshot = INITIAL_CALIBRATION_STAGE_STATE) {
  let current = initial;
  return {
    get current() { return current; },
    setState(update: CalibrationStageSnapshot | ((value: CalibrationStageSnapshot) => CalibrationStageSnapshot)) {
      current = typeof update === "function" ? update(current) : update;
    },
  };
}

function pointer(currentTarget: CalibrationStageElementLike, patch: Partial<{
  clientX: number;
  clientY: number;
  pointerId: number;
  button: number;
  altKey: boolean;
}> = {}) {
  return {
    clientX: 204,
    clientY: 150,
    pointerId: 7,
    button: 0,
    altKey: false,
    currentTarget,
    preventDefault: vi.fn(),
    ...patch,
  };
}

const snapFeature: CalibrationSourceFeature = {
  id: "line-center:v:100.000",
  kind: "line-center",
  point: { x: 100, y: 100 },
  strength: 1,
};

describe("calibration stage DOM controller", () => {
  it("fits the source image on load and when the explicit Fit control is used", () => {
    const element = stage();
    const state = stateHarness();
    const handlers = createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft: { pointA: null, pointB: null },
      onChange: vi.fn(),
      stage: () => element,
      sourceImage: image(),
      readFeatures: () => [],
    });

    handlers.onImageLoad();
    expect(state.current.viewport).toEqual({ scale: 0.96, offsetX: 16, offsetY: 54 });

    state.setState({ ...state.current, viewport: { scale: 2, offsetX: -50, offsetY: -20 } });
    createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft: { pointA: null, pointB: null },
      onChange: vi.fn(),
      stage: () => element,
      sourceImage: image(),
      readFeatures: () => [],
    }).onFit();
    expect(state.current.viewport).toEqual({ scale: 0.96, offsetX: 16, offsetY: 54 });
  });

  it("pans on ordinary wheel and performs pointer-anchored zoom on modified wheel", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: { scale: 1, offsetX: 0, offsetY: 0 } });
    const makeHandlers = () => createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft: { pointA: null, pointB: null },
      onChange: vi.fn(),
      stage: () => element,
      sourceImage: image(),
      readFeatures: () => [],
    });

    const panEvent = { clientX: 300, clientY: 150, deltaX: 18, deltaY: 28, ctrlKey: false, metaKey: false, preventDefault: vi.fn() };
    makeHandlers().onWheel(panEvent);
    expect(state.current.viewport).toEqual({ scale: 1, offsetX: -18, offsetY: -28 });
    expect(panEvent.preventDefault).toHaveBeenCalled();

    const zoomEvent = { clientX: 300, clientY: 150, deltaX: 0, deltaY: -300, ctrlKey: true, metaKey: false, preventDefault: vi.fn() };
    makeHandlers().onWheel(zoomEvent);
    expect(state.current.viewport?.scale).toBeGreaterThan(1);
    expect(zoomEvent.preventDefault).toHaveBeenCalled();
  });

  it("snaps a placed point to strong local source evidence and remembers the active handle", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: { scale: 1, offsetX: 0, offsetY: 0 } });
    const onChange = vi.fn();
    const handlers = createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft: { pointA: null, pointB: null },
      onChange,
      stage: () => element,
      sourceImage: image(),
      readFeatures: () => [snapFeature],
    });

    handlers.onPointerDown(pointer(element));
    expect(onChange).toHaveBeenCalledWith({ pointA: { x: 100, y: 100 } });
    expect(state.current).toMatchObject({ activeHandle: "a", draggingHandle: "a", activeCandidateId: "line-center:v:100.000" });
    expect(element.focus).toHaveBeenCalled();
    expect(element.setPointerCapture).toHaveBeenCalledWith(7);
  });

  it("suppresses snapping for the current Alt gesture and lets the next point remain raw", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: { scale: 1, offsetX: 0, offsetY: 0 } });
    const onChange = vi.fn();
    createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft: { pointA: { x: 100, y: 100 }, pointB: null },
      onChange,
      stage: () => element,
      sourceImage: image(),
      readFeatures: () => [{ ...snapFeature, id: "line-center:v:700.000", point: { x: 700, y: 100 } }],
    }).onPointerDown(pointer(element, { clientX: 804, altKey: true }));

    expect(onChange).toHaveBeenCalledWith({ pointB: { x: 704, y: 100 } });
    expect(state.current.activeCandidateId).toBeNull();
  });

  it("nudges the active source handle and disables snapping without changing calibration points", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: { scale: 1, offsetX: 0, offsetY: 0 }, activeHandle: "a" });
    const onChange = vi.fn();
    const makeHandlers = () => createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft: { pointA: { x: 100, y: 100 }, pointB: { x: 700, y: 100 } },
      onChange,
      stage: () => element,
      sourceImage: image(),
      readFeatures: () => [snapFeature],
    });

    const keyEvent = { key: "ArrowRight", shiftKey: false, repeat: false, preventDefault: vi.fn() };
    makeHandlers().onKeyDown(keyEvent);
    expect(onChange).toHaveBeenCalledWith({ pointA: { x: 101, y: 100 } });
    expect(keyEvent.preventDefault).toHaveBeenCalled();

    makeHandlers().onSnapChange({ currentTarget: { checked: false } });
    expect(state.current.snapEnabled).toBe(false);
    expect(state.current.activeCandidateId).toBeNull();
  });

  it("supports middle-button pan and releases pointer capture on completion", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: { scale: 1, offsetX: 0, offsetY: 0 } });
    const makeHandlers = () => createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft: { pointA: null, pointB: null },
      onChange: vi.fn(),
      stage: () => element,
      sourceImage: image(),
      readFeatures: () => [],
    });

    makeHandlers().onPointerDown(pointer(element, { button: 1, clientX: 300, clientY: 150 }));
    expect(state.current.panning).toMatchObject({ pointerId: 7, lastClient: { x: 300, y: 150 } });

    makeHandlers().onPointerMove(pointer(element, { clientX: 315, clientY: 170 }));
    expect(state.current.viewport).toEqual({ scale: 1, offsetX: 15, offsetY: 20 });

    makeHandlers().onPointerUp(pointer(element, { clientX: 315, clientY: 170 }));
    expect(state.current.panning).toBeNull();
    expect(element.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("arms Space-pan without mutating points and clears it on keyup", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: { scale: 1, offsetX: 0, offsetY: 0 } });
    const onChange = vi.fn();
    const makeHandlers = () => createCalibrationStageHandlers({
      state: state.current,
      setState: state.setState,
      draft: { pointA: null, pointB: null },
      onChange,
      stage: () => element,
      sourceImage: image(),
      readFeatures: () => [],
    });

    const down = { key: " ", shiftKey: false, repeat: false, preventDefault: vi.fn() };
    makeHandlers().onKeyDown(down);
    expect(state.current.spacePressed).toBe(true);
    expect(down.preventDefault).toHaveBeenCalled();

    makeHandlers().onPointerDown(pointer(element, { button: 0, clientX: 300, clientY: 150 }));
    expect(state.current.panning).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();

    const up = { key: " ", preventDefault: vi.fn() };
    makeHandlers().onKeyUp(up);
    expect(state.current.spacePressed).toBe(false);
  });
});
