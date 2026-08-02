import { describe, expect, it } from "vitest";
import {
  clientPointToImagePoint,
  imagePointToContainerPoint,
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
