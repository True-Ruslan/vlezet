import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CalibrationStage,
  ReferencePanel,
  calibrationGuidance,
  validateCalibrationSubmission,
} from "./reference-panel";
import type { NormalizedReferenceRaster } from "./raster-normalizer";

const raster: NormalizedReferenceRaster = {
  blob: new Blob(["reference"], { type: "image/png" }),
  mimeType: "image/png",
  widthPx: 800,
  heightPx: 200,
};

describe("M8.3 reference panel calibration integration", () => {
  it("routes a normalized raster through the precision stage while its local image is loading", () => {
    const html = renderToStaticMarkup(
      <CalibrationStage
        raster={raster}
        draft={{ pointA: null, pointB: null, lengthInput: "", alignment: "horizontal" }}
        onChange={() => {}}
      />,
    );

    expect(html).toContain("Подготавливаем предпросмотр");
  });

  it("describes the next calibration step without requiring the user to infer endpoint semantics", () => {
    expect(calibrationGuidance({
      pointA: null,
      pointB: null,
      lengthInput: "",
      alignment: "horizontal",
    })).toBe("Поставьте точку A на одном конце известного размера.");

    expect(calibrationGuidance({
      pointA: { x: 100, y: 50 },
      pointB: null,
      lengthInput: "",
      alignment: "horizontal",
    })).toBe("Теперь поставьте точку B на другом конце известного размера.");

    expect(calibrationGuidance({
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      lengthInput: "",
      alignment: "horizontal",
    })).toBe("Укажите реальную длину между точками A и B.");

    expect(calibrationGuidance({
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      lengthInput: "3200",
      alignment: "horizontal",
    })).toBe("Калибровка заполнена. Проверьте точки и сохраните план.");
  });

  it("validates calibration submission without discarding the active workflow", () => {
    expect(validateCalibrationSubmission({
      pointA: null,
      pointB: null,
      lengthInput: "",
      alignment: "horizontal",
    })).toEqual({ ok: false, message: "Поставьте точку A на одном конце известного размера." });

    expect(validateCalibrationSubmission({
      pointA: { x: 100, y: 50 },
      pointB: null,
      lengthInput: "",
      alignment: "horizontal",
    })).toEqual({ ok: false, message: "Теперь поставьте точку B на другом конце известного размера." });

    expect(validateCalibrationSubmission({
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      lengthInput: "",
      alignment: "horizontal",
    })).toEqual({ ok: false, message: "Укажите реальную длину между точками A и B." });

    expect(validateCalibrationSubmission({
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      lengthInput: "nope",
      alignment: "horizontal",
    })).toEqual({
      ok: false,
      message: "Укажите длину в миллиметрах или метрах, например 3200 или 3,2 м.",
    });

    expect(validateCalibrationSubmission({
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      lengthInput: "3,2 м",
      alignment: "vertical",
    })).toEqual({
      ok: true,
      pointA: { x: 100, y: 50 },
      pointB: { x: 700, y: 50 },
      knownLengthMm: 3200,
      alignment: "vertical",
    });
  });

  it("renders the normal reference workflow without creating a second calibration authority", () => {
    const html = renderToStaticMarkup(
      <ReferencePanel
        referencePlan={null}
        assetBlob={null}
        missingAsset={false}
        navigation={{ label: "Назад", onActivate: vi.fn() }}
        onInstall={vi.fn(async () => {})}
        onUpdate={vi.fn()}
        onRemove={vi.fn(async () => {})}
        onStartTracing={vi.fn()}
        onFitReference={vi.fn()}
      />,
    );

    expect(html).toContain("Загрузить JPG, PNG или PDF");
    expect(html).toContain("Загрузка исходного плана");
  });
});
