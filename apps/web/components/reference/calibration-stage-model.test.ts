import { describe, expect, it } from "vitest";
import {
  chooseCalibrationHandle,
  resolveCalibrationNudge,
  resolveCalibrationPlacement,
  resolveCalibrationWheelGesture,
} from "./calibration-stage-model";

const naturalSize = { width: 800, height: 200 };

describe("calibration stage interaction model", () => {
  it("acquires existing handles in screen space at the current zoom", () => {
    expect(chooseCalibrationHandle({
      point: { x: 110, y: 100 },
      pointA: { x: 100, y: 100 },
      pointB: { x: 700, y: 100 },
      viewportScale: 1,
      tolerancePx: 14,
    })).toBe("a");

    expect(chooseCalibrationHandle({
      point: { x: 110, y: 100 },
      pointA: { x: 100, y: 100 },
      pointB: { x: 700, y: 100 },
      viewportScale: 2,
      tolerancePx: 14,
    })).toBeNull();
  });

  it("ignores missing handles and breaks equal-distance ties deterministically", () => {
    expect(chooseCalibrationHandle({
      point: { x: 700, y: 100 },
      pointA: null,
      pointB: { x: 700, y: 100 },
      viewportScale: 1,
      tolerancePx: 14,
    })).toBe("b");

    expect(chooseCalibrationHandle({
      point: { x: 100, y: 100 },
      pointA: { x: 90, y: 100 },
      pointB: { x: 110, y: 100 },
      viewportScale: 1,
      tolerancePx: 14,
    })).toBe("a");
  });

  it("fills A then B before replacing the nearest existing handle", () => {
    expect(resolveCalibrationPlacement({
      point: { x: 100, y: 50 },
      pointA: null,
      pointB: null,
      viewportScale: 1,
      handleTolerancePx: 14,
    })).toMatchObject({ handle: "a", point: { x: 100, y: 50 } });

    expect(resolveCalibrationPlacement({
      point: { x: 700, y: 50 },
      pointA: { x: 100, y: 50 },
      pointB: null,
      viewportScale: 1,
      handleTolerancePx: 14,
    })).toMatchObject({ handle: "b", point: { x: 700, y: 50 } });

    expect(resolveCalibrationPlacement({
      point: { x: 690, y: 50 },
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      viewportScale: 1,
      handleTolerancePx: 14,
    })).toMatchObject({ handle: "b", point: { x: 690, y: 50 } });
  });

  it("falls back to the nearest handle when the pointer is outside handle acquisition tolerance", () => {
    expect(resolveCalibrationPlacement({
      point: { x: 250, y: 50 },
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      viewportScale: 1,
      handleTolerancePx: 14,
    })).toMatchObject({ handle: "a", point: { x: 250, y: 50 } });

    expect(resolveCalibrationPlacement({
      point: { x: 400, y: 50 },
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      viewportScale: 1,
      handleTolerancePx: 14,
    })).toMatchObject({ handle: "b", point: { x: 400, y: 50 } });
  });

  it("pans on ordinary wheel and zooms around the local pointer on modified wheel", () => {
    const transform = { scale: 0.5, offsetX: 20, offsetY: 30 };

    expect(resolveCalibrationWheelGesture({
      transform,
      localPoint: { x: 200, y: 100 },
      deltaX: 18,
      deltaY: 28,
      zoomModifier: false,
      zoomFactor: 1,
      limits: { minScale: 0.1, maxScale: 4 },
    })).toEqual({ scale: 0.5, offsetX: 2, offsetY: 2 });

    const zoomed = resolveCalibrationWheelGesture({
      transform,
      localPoint: { x: 200, y: 100 },
      deltaX: 0,
      deltaY: -300,
      zoomModifier: true,
      zoomFactor: 2,
      limits: { minScale: 0.1, maxScale: 4 },
    });
    expect(zoomed.scale).toBe(1);
    expect(zoomed).toEqual({ scale: 1, offsetX: -160, offsetY: -40 });
  });

  it("nudges the active handle in every arrow direction using natural source pixels", () => {
    expect(resolveCalibrationNudge({
      key: "ArrowRight",
      shiftKey: false,
      activeHandle: "a",
      pointA: { x: 100, y: 100 },
      pointB: { x: 700, y: 100 },
      naturalSize,
    })).toMatchObject({ handle: "a", point: { x: 101, y: 100 } });

    expect(resolveCalibrationNudge({
      key: "ArrowDown",
      shiftKey: true,
      activeHandle: "a",
      pointA: { x: 101, y: 100 },
      pointB: { x: 700, y: 100 },
      naturalSize,
    })).toMatchObject({ handle: "a", point: { x: 101, y: 110 } });

    expect(resolveCalibrationNudge({
      key: "ArrowUp",
      shiftKey: false,
      activeHandle: "a",
      pointA: { x: 101, y: 100 },
      pointB: { x: 700, y: 100 },
      naturalSize,
    })).toMatchObject({ handle: "a", point: { x: 101, y: 99 } });

    expect(resolveCalibrationNudge({
      key: "ArrowLeft",
      shiftKey: false,
      activeHandle: "b",
      pointA: { x: 101, y: 100 },
      pointB: { x: 700, y: 100 },
      naturalSize,
    })).toMatchObject({ handle: "b", point: { x: 699, y: 100 } });
  });

  it("ignores nudge requests without a usable active source point or supported arrow key", () => {
    expect(resolveCalibrationNudge({
      key: "Enter",
      shiftKey: false,
      activeHandle: "a",
      pointA: { x: 100, y: 100 },
      pointB: { x: 700, y: 100 },
      naturalSize,
    })).toBeNull();

    expect(resolveCalibrationNudge({
      key: "ArrowLeft",
      shiftKey: false,
      activeHandle: null,
      pointA: { x: 100, y: 100 },
      pointB: { x: 700, y: 100 },
      naturalSize,
    })).toBeNull();

    expect(resolveCalibrationNudge({
      key: "ArrowLeft",
      shiftKey: false,
      activeHandle: "b",
      pointA: { x: 100, y: 100 },
      pointB: null,
      naturalSize,
    })).toBeNull();
  });
});
