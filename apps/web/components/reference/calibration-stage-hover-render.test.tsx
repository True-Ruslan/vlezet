import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrecisionCalibrationStage } from "./calibration-stage";
import { INITIAL_CALIBRATION_STAGE_STATE } from "./calibration-stage-controller";

const image = {
  src: "blob:hover-reference",
  naturalWidth: 800,
  naturalHeight: 200,
} as HTMLImageElement;

describe("calibration hover magnifier rendering", () => {
  it("shows source coordinates and the accepted M7 background position before any endpoint is selected", () => {
    const html = renderToStaticMarkup(
      <PrecisionCalibrationStage
        image={image}
        error={null}
        draft={{ pointA: null, pointB: null }}
        onChange={() => {}}
        initialState={{
          ...INITIAL_CALIBRATION_STAGE_STATE,
          viewport: { scale: 0.5, offsetX: 20, offsetY: 30 },
          hoverPoint: { x: 400, y: 100 },
        }}
      />,
    );

    expect(html).toContain("calibration-magnifier");
    expect(html).toContain("calibration-magnifier-crosshair");
    expect(html).toContain("calibration-magnifier-coordinate");
    expect(html).toContain("400.00, 100.00");
    expect(html).toContain("-748px -148px");
  });
});
