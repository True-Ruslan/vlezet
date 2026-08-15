import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalibrationStage, ReferencePanel } from "./reference-panel";
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
