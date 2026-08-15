import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PrecisionCalibrationStage,
  calibrationStageFeatureReader,
  currentCalibrationStage,
} from "./calibration-stage";
import { INITIAL_CALIBRATION_STAGE_STATE } from "./calibration-stage-controller";
import type { CalibrationCanvasLike } from "./calibration-image-features";

const image = {
  src: "blob:precision-reference",
  naturalWidth: 800,
  naturalHeight: 200,
} as HTMLImageElement;

const draft = {
  pointA: { x: 100, y: 100 },
  pointB: { x: 700, y: 100 },
};

function fixtureCanvas(data: Uint8ClampedArray): CalibrationCanvasLike {
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data })),
  };
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  };
}

describe("precision calibration stage", () => {
  it("renders explicit navigation, snap state, source coordinates and magnifier crosshair", () => {
    const html = renderToStaticMarkup(
      <PrecisionCalibrationStage
        image={image}
        error={null}
        draft={draft}
        onChange={() => {}}
        initialState={{
          ...INITIAL_CALIBRATION_STAGE_STATE,
          viewport: { scale: 0.5, offsetX: 20, offsetY: 30 },
          activeHandle: "a",
          activeCandidateId: "line-center:v:100.000",
        }}
      />,
    );

    expect(html).toContain("Вписать план");
    expect(html).toContain("Привязка к линиям плана");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-calibration-point="a"');
    expect(html).toContain('data-calibration-point="b"');
    expect(html).toContain("100.00, 100.00");
    expect(html).toContain("700.00, 100.00");
    expect(html).toContain("calibration-magnifier-crosshair");
    expect(html).toContain("line-center:v:100.000");
    expect(html).toContain("translate(20px, 30px) scale(0.5)");
  });

  it("renders truthful loading and image-error states", () => {
    expect(renderToStaticMarkup(
      <PrecisionCalibrationStage image={null} error={null} draft={{ pointA: null, pointB: null }} onChange={() => {}} />,
    )).toContain("Подготавливаем предпросмотр");

    expect(renderToStaticMarkup(
      <PrecisionCalibrationStage image={null} error="Не удалось показать сохранённую подложку." draft={{ pointA: null, pointB: null }} onChange={() => {}} />,
    )).toContain("Не удалось показать сохранённую подложку.");
  });

  it("reads bounded local raster evidence through the stage feature adapter", () => {
    const width = 11;
    const height = 11;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = x < 6 ? 255 : 0;
        const offset = (y * width + x) * 4;
        rgba[offset] = value;
        rgba[offset + 1] = value;
        rgba[offset + 2] = value;
        rgba[offset + 3] = 255;
      }
    }
    const canvas = fixtureCanvas(rgba);
    const features = calibrationStageFeatureReader(
      image,
      { x: 505, y: 100 },
      () => canvas,
    );
    expect(features).toContainEqual({
      id: "edge:v:505.500",
      kind: "edge",
      point: { x: 505.5, y: 100 },
      strength: 1,
    });
  });

  it("reads the live calibration stage ref without creating a second authority", () => {
    const element = { id: "stage" } as unknown as HTMLDivElement;
    expect(currentCalibrationStage({ current: element })).toBe(element);
    expect(currentCalibrationStage({ current: null })).toBeNull();
  });
});
