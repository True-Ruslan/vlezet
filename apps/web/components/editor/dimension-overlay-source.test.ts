import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./dimension-overlay.tsx", import.meta.url), "utf8");

describe("M7.6 dimension overlay emphasis", () => {
  it("uses the existing annotation emphasis flag only for presentation", () => {
    expect(source).toContain("annotation.emphasized");
    expect(source).toContain("const dimensionStrokeWidth = annotation.emphasized ?");
    expect(source).toContain("const labelFontSize = annotation.emphasized ?");
    expect(source).not.toContain("deriveRectangularRoomDimensions");
    expect(source).not.toContain("valueMm:");
  });
});
