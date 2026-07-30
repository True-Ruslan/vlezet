import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("editor canvas layer budget", () => {
  it("keeps the Konva Stage at or below the recommended five physical layers", () => {
    const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");
    const physicalLayers = source.match(/<Layer(?:\s|>)/g)?.length ?? 0;

    expect(physicalLayers).toBeLessThanOrEqual(5);
  });

  it("renders exact gaps from ephemeral active-pair state inside the existing object layer", () => {
    const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");
    expect(source).toContain("ExactGapOverlay");
    expect(source).toContain("activeExactPairKey");
    expect(source).toContain("deriveExactGapAnnotation");
  });
});
