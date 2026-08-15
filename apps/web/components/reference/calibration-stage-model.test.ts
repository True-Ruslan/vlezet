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

  it("nudges only the active handle in natural source pixels and supports Shift x10", () => {
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
  });
});
