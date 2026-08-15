import { describe, expect, it } from "vitest";
import {
  clientPointToImagePoint,
  fitCalibrationViewport,
  imagePointToContainerPoint,
  imagePointToViewportPoint,
  nudgeCalibrationImagePoint,
  panCalibrationViewport,
  viewportPointToImagePoint,
  zoomCalibrationViewportAt,
} from "./calibration-viewport";

const naturalSize = { width: 1472, height: 1024 };
const imageRect = { left: 180, top: 240, width: 552, height: 384 };
const containerRect = { left: 100, top: 100, width: 712, height: 664 };

describe("calibration viewport coordinates", () => {
  it("maps the cursor through the rendered image rectangle instead of the letterboxed stage", () => {
    expect(clientPointToImagePoint({
      clientPoint: { x: 456, y: 432 },
      imageRect,
      naturalSize,
    })).toEqual({ x: 736, y: 512 });
  });

  it("rejects pointer positions in the stage letterbox", () => {
    expect(clientPointToImagePoint({
      clientPoint: { x: 456, y: 180 },
      imageRect,
      naturalSize,
    })).toBeNull();
  });

  it("places handles and the calibration line over the rendered image", () => {
    expect(imagePointToContainerPoint({
      imagePoint: { x: 736, y: 512 },
      imageRect,
      containerRect,
      naturalSize,
    })).toEqual({ x: 356, y: 332 });
  });

  it("clamps tiny floating-point excursions at image edges", () => {
    expect(clientPointToImagePoint({
      clientPoint: { x: imageRect.left + imageRect.width + 0.0000001, y: imageRect.top },
      imageRect,
      naturalSize,
      edgeTolerancePx: 0.001,
    })).toEqual({ x: 1472, y: 0 });
  });
});

describe("calibration pan and zoom transform", () => {
  it("fits the natural image inside the viewport with deterministic centering", () => {
    expect(fitCalibrationViewport({
      naturalSize: { width: 1000, height: 500 },
      containerSize: { width: 800, height: 600 },
      paddingPx: 20,
    })).toEqual({
      scale: 0.76,
      offsetX: 20,
      offsetY: 110,
    });
  });

  it("round-trips fractional image coordinates through an explicit pan and zoom transform", () => {
    const transform = { scale: 0.5, offsetX: 40, offsetY: 50 };
    const imagePoint = { x: 100.25, y: 200.5 };
    const viewportPoint = imagePointToViewportPoint({ imagePoint, transform });

    expect(viewportPoint).toEqual({ x: 90.125, y: 150.25 });
    expect(viewportPointToImagePoint({ viewportPoint, transform })).toEqual(imagePoint);
  });

  it("zooms around the pointer anchor without moving the source point under that pointer", () => {
    const transform = { scale: 0.5, offsetX: 40, offsetY: 50 };
    const imagePoint = { x: 100, y: 200 };
    const anchor = imagePointToViewportPoint({ imagePoint, transform });
    const zoomed = zoomCalibrationViewportAt({
      transform,
      viewportPoint: anchor,
      factor: 2,
      limits: { minScale: 0.1, maxScale: 4 },
    });

    expect(zoomed).toEqual({ scale: 1, offsetX: -10, offsetY: -50 });
    expect(viewportPointToImagePoint({ viewportPoint: anchor, transform: zoomed })).toEqual(imagePoint);
  });

  it("clamps zoom before solving the pointer anchor", () => {
    const transform = { scale: 2, offsetX: 10, offsetY: 20 };
    const viewportPoint = { x: 210, y: 220 };
    const zoomed = zoomCalibrationViewportAt({
      transform,
      viewportPoint,
      factor: 10,
      limits: { minScale: 0.25, maxScale: 4 },
    });

    expect(zoomed.scale).toBe(4);
    expect(viewportPointToImagePoint({ viewportPoint, transform: zoomed })).toEqual(
      viewportPointToImagePoint({ viewportPoint, transform }),
    );
  });

  it("pans only the viewport offset", () => {
    expect(panCalibrationViewport(
      { scale: 0.5, offsetX: 40, offsetY: 50 },
      { x: 12, y: -8 },
    )).toEqual({ scale: 0.5, offsetX: 52, offsetY: 42 });
  });

  it("nudges in natural source pixels and clamps at raster bounds", () => {
    expect(nudgeCalibrationImagePoint({
      point: { x: 999.5, y: 1.25 },
      delta: { x: 10, y: -10 },
      naturalSize: { width: 1000, height: 500 },
    })).toEqual({ x: 1000, y: 0 });
  });
});
