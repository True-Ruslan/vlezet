import { describe, expect, it, vi } from "vitest";
import type { CalibrationSourceFeature } from "./calibration-snap";
import {
  INITIAL_CALIBRATION_STAGE_STATE,
  createCalibrationStageHandlers,
  type CalibrationStageElementLike,
  type CalibrationStageSnapshot,
} from "./calibration-stage-controller";

type ControllerInput = Parameters<typeof createCalibrationStageHandlers>[0];
type ControllerDraft = ControllerInput["draft"];
type ControllerChange = ControllerInput["onChange"];
type FeatureReader = ControllerInput["readFeatures"];

function stage(captured = true): CalibrationStageElementLike {
  return {
    clientWidth: 800,
    clientHeight: 300,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 300 }),
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => captured),
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

function makeHandlers(
  state: ReturnType<typeof stateHarness>,
  element: CalibrationStageElementLike | null,
  overrides: Partial<Readonly<{
    draft: ControllerDraft;
    onChange: ControllerChange;
    readFeatures: FeatureReader;
  }>> = {},
) {
  return createCalibrationStageHandlers({
    state: state.current,
    setState: state.setState,
    draft: overrides.draft ?? { pointA: null, pointB: null },
    onChange: overrides.onChange ?? (() => {}),
    stage: () => element,
    sourceImage: image(),
    readFeatures: overrides.readFeatures ?? (() => []),
  });
}

const snapFeature: CalibrationSourceFeature = {
  id: "line-center:v:100.000",
  kind: "line-center",
  point: { x: 100, y: 100 },
  strength: 1,
};

const fitted = { scale: 0.96, offsetX: 16, offsetY: 54 } as const;
const identityViewport = { scale: 1, offsetX: 0, offsetY: 0 } as const;

describe("calibration stage DOM controller", () => {
  it("fits on image load and explicit Fit", () => {
    const element = stage();
    const state = stateHarness();
    makeHandlers(state, element).onImageLoad();
    expect(state.current.viewport).toEqual(fitted);

    state.setState({ ...state.current, viewport: { scale: 2, offsetX: -50, offsetY: -20 } });
    makeHandlers(state, element).onFit();
    expect(state.current.viewport).toEqual(fitted);
  });

  it("pans on ordinary wheel and zooms around the pointer with Control or Meta", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport });
    const pan = { clientX: 300, clientY: 150, deltaX: 18, deltaY: 28, ctrlKey: false, metaKey: false, preventDefault: vi.fn() };
    makeHandlers(state, element).onWheel(pan);
    expect(state.current.viewport).toEqual({ scale: 1, offsetX: -18, offsetY: -28 });
    expect(pan.preventDefault).toHaveBeenCalled();

    const controlZoom = { clientX: 300, clientY: 150, deltaX: 0, deltaY: -300, ctrlKey: true, metaKey: false, preventDefault: vi.fn() };
    makeHandlers(state, element).onWheel(controlZoom);
    expect(state.current.viewport?.scale).toBeGreaterThan(1);

    const metaState = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport });
    const metaZoom = { clientX: 300, clientY: 150, deltaX: 0, deltaY: -100, ctrlKey: false, metaKey: true, preventDefault: vi.fn() };
    makeHandlers(metaState, element).onWheel(metaZoom);
    expect(metaState.current.viewport?.scale).toBeGreaterThan(1);
    expect(metaZoom.preventDefault).toHaveBeenCalled();
  });

  it("snaps a placed point and owns its pointer gesture", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport });
    const onChange = vi.fn<ControllerChange>();
    makeHandlers(state, element, { onChange, readFeatures: () => [snapFeature] }).onPointerDown(pointer(element));

    expect(onChange).toHaveBeenCalledWith({ pointA: { x: 100, y: 100 } });
    expect(state.current).toMatchObject({
      activeHandle: "a",
      draggingHandle: "a",
      activeCandidateId: "line-center:v:100.000",
    });
    expect(element.focus).toHaveBeenCalled();
    expect(element.setPointerCapture).toHaveBeenCalledWith(7);
  });

  it("suppresses snapping for only the current Alt gesture", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport });
    const onChange = vi.fn<ControllerChange>();
    const readFeatures = vi.fn<FeatureReader>(() => [{ ...snapFeature, id: "line-center:v:700.000", point: { x: 700, y: 100 } }]);

    makeHandlers(state, element, {
      draft: { pointA: { x: 100, y: 100 }, pointB: null },
      onChange,
      readFeatures,
    }).onPointerDown(pointer(element, { clientX: 804, altKey: true }));

    expect(readFeatures).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({ pointB: { x: 704, y: 100 } });
    expect(state.current.activeCandidateId).toBeNull();
  });

  it("nudges the active handle and toggles source snapping", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport, activeHandle: "a" });
    const onChange = vi.fn<ControllerChange>();
    const draft = { pointA: { x: 100, y: 100 }, pointB: { x: 700, y: 100 } };
    const right = { key: "ArrowRight", shiftKey: false, repeat: false, preventDefault: vi.fn() };

    makeHandlers(state, element, { draft, onChange }).onKeyDown(right);
    expect(onChange).toHaveBeenCalledWith({ pointA: { x: 101, y: 100 } });
    expect(right.preventDefault).toHaveBeenCalled();

    makeHandlers(state, element, { draft, onChange }).onSnapChange({ currentTarget: { checked: false } });
    expect(state.current.snapEnabled).toBe(false);
    expect(state.current.activeCandidateId).toBeNull();
  });

  it("pans with the middle button and releases pointer capture", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport });
    makeHandlers(state, element).onPointerDown(pointer(element, { button: 1, clientX: 300, clientY: 150 }));
    expect(state.current.panning).toMatchObject({ pointerId: 7, lastClient: { x: 300, y: 150 } });

    makeHandlers(state, element).onPointerMove(pointer(element, { clientX: 315, clientY: 170 }));
    expect(state.current.viewport).toEqual({ scale: 1, offsetX: 15, offsetY: 20 });

    makeHandlers(state, element).onPointerUp(pointer(element, { clientX: 315, clientY: 170 }));
    expect(state.current.panning).toBeNull();
    expect(element.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("arms Space-pan without mutating points and clears it on keyup", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport });
    const onChange = vi.fn<ControllerChange>();
    const down = { key: " ", shiftKey: false, repeat: false, preventDefault: vi.fn() };
    makeHandlers(state, element, { onChange }).onKeyDown(down);
    expect(state.current.spacePressed).toBe(true);

    makeHandlers(state, element, { onChange }).onPointerDown(pointer(element, { clientX: 300, clientY: 150 }));
    expect(state.current.panning).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();

    const up = { key: " ", preventDefault: vi.fn() };
    makeHandlers(state, element, { onChange }).onKeyUp(up);
    expect(state.current.spacePressed).toBe(false);
    expect(up.preventDefault).toHaveBeenCalled();
  });

  it("fails closed for missing stage or viewport and ignores unsupported input", () => {
    const missingStageState = stateHarness();
    const missingStage = makeHandlers(missingStageState, null);
    missingStage.onImageLoad();
    expect(missingStageState.current).toEqual(INITIAL_CALIBRATION_STAGE_STATE);
    const noStageWheel = { clientX: 1, clientY: 1, deltaX: 0, deltaY: 10, ctrlKey: false, metaKey: false, preventDefault: vi.fn() };
    missingStage.onWheel(noStageWheel);
    expect(noStageWheel.preventDefault).not.toHaveBeenCalled();

    const element = stage();
    const noViewportState = stateHarness();
    const onChange = vi.fn<ControllerChange>();
    const noViewportPointer = pointer(element);
    makeHandlers(noViewportState, element, { onChange }).onPointerDown(noViewportPointer);
    makeHandlers(noViewportState, element, { onChange }).onPointerMove(noViewportPointer);
    expect(element.focus).toHaveBeenCalled();
    expect(element.setPointerCapture).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    const noViewportWheel = { clientX: 300, clientY: 150, deltaX: 1, deltaY: 2, ctrlKey: false, metaKey: false, preventDefault: vi.fn() };
    makeHandlers(noViewportState, element).onWheel(noViewportWheel);
    expect(noViewportWheel.preventDefault).not.toHaveBeenCalled();

    const unsupportedElement = stage();
    const unsupportedState = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport });
    makeHandlers(unsupportedState, unsupportedElement, { onChange }).onPointerDown(pointer(unsupportedElement, { button: 2 }));
    expect(unsupportedElement.setPointerCapture).not.toHaveBeenCalled();

    const enter = { key: "Enter", shiftKey: false, repeat: false, preventDefault: vi.fn() };
    makeHandlers(unsupportedState, unsupportedElement, { onChange }).onKeyDown(enter);
    expect(enter.preventDefault).not.toHaveBeenCalled();
    const enterUp = { key: "Enter", preventDefault: vi.fn() };
    makeHandlers(unsupportedState, unsupportedElement, { onChange }).onKeyUp(enterUp);
    expect(enterUp.preventDefault).not.toHaveBeenCalled();
  });

  it("uses raw coordinates when session snapping is disabled", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport, snapEnabled: false });
    const onChange = vi.fn<ControllerChange>();
    const readFeatures = vi.fn<FeatureReader>(() => [snapFeature]);

    makeHandlers(state, element, { onChange, readFeatures }).onPointerDown(pointer(element));
    expect(readFeatures).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({ pointA: { x: 104, y: 100 } });
    expect(state.current.activeCandidateId).toBeNull();

    makeHandlers(state, element, { onChange, readFeatures }).onPointerUp(pointer(element));
    expect(state.current.draggingHandle).toBeNull();
  });

  it("drags a handle through snapping and leaves an idle move untouched", () => {
    const element = stage();
    const onChange = vi.fn<ControllerChange>();
    const sourceFeature = { ...snapFeature, id: "line-center:v:700.000", point: { x: 700, y: 100 } };
    const state = stateHarness({
      ...INITIAL_CALIBRATION_STAGE_STATE,
      viewport: identityViewport,
      activeHandle: "b",
      draggingHandle: "b",
    });
    const move = pointer(element, { clientX: 800, clientY: 150 });
    makeHandlers(state, element, {
      draft: { pointA: { x: 100, y: 100 }, pointB: { x: 690, y: 100 } },
      onChange,
      readFeatures: () => [sourceFeature],
    }).onPointerMove(move);
    expect(move.preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({ pointB: { x: 700, y: 100 } });

    const idleState = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport });
    const idleMove = pointer(element);
    makeHandlers(idleState, element).onPointerMove(idleMove);
    expect(idleMove.preventDefault).not.toHaveBeenCalled();
  });

  it("preserves unrelated pan state and skips release when capture is absent", () => {
    const element = stage(false);
    const state = stateHarness({
      ...INITIAL_CALIBRATION_STAGE_STATE,
      viewport: identityViewport,
      draggingHandle: "a",
      panning: { pointerId: 99, lastClient: { x: 1, y: 2 } },
    });
    makeHandlers(state, element).onPointerCancel(pointer(element, { pointerId: 7 }));
    expect(state.current.panning).toEqual({ pointerId: 99, lastClient: { x: 1, y: 2 } });
    expect(state.current.draggingHandle).toBeNull();
    expect(element.releasePointerCapture).not.toHaveBeenCalled();
  });

  it("supports point-B nudge, repeat-safe Space and non-arrow no-op", () => {
    const element = stage();
    const state = stateHarness({ ...INITIAL_CALIBRATION_STAGE_STATE, viewport: identityViewport, activeHandle: "b" });
    const onChange = vi.fn<ControllerChange>();
    const draft = { pointA: { x: 100, y: 100 }, pointB: { x: 700, y: 100 } };
    const left = { key: "ArrowLeft", shiftKey: false, repeat: false, preventDefault: vi.fn() };
    makeHandlers(state, element, { draft, onChange }).onKeyDown(left);
    expect(onChange).toHaveBeenCalledWith({ pointB: { x: 699, y: 100 } });

    const enter = { key: "Enter", shiftKey: false, repeat: false, preventDefault: vi.fn() };
    makeHandlers(state, element, { draft, onChange }).onKeyDown(enter);
    expect(enter.preventDefault).not.toHaveBeenCalled();

    state.setState({ ...state.current, spacePressed: false });
    const repeatedSpace = { key: " ", shiftKey: false, repeat: true, preventDefault: vi.fn() };
    makeHandlers(state, element, { draft, onChange }).onKeyDown(repeatedSpace);
    expect(repeatedSpace.preventDefault).toHaveBeenCalled();
    expect(state.current.spacePressed).toBe(false);
  });
});
