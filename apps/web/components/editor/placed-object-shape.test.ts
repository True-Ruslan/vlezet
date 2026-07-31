import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./placed-object-shape.tsx", import.meta.url), "utf8");

describe("M7.4 placed-object presentation", () => {
  it("supports a distinct hover state without replacing selection", () => {
    expect(source).toContain("hovered?: boolean");
    expect(source).toContain("onHoverChange?: (hovered: boolean) => void");
    expect(source).toContain("onMouseEnter={() => onHoverChange?.(true)}");
    expect(source).toContain("onMouseLeave={() => onHoverChange?.(false)}");
    expect(source).toContain('dash={preview ? [7, 5] : hovered && !selected ? [4, 3] : undefined}');
  });

  it("labels fit-blocked furniture as a placeable preview, not an invalid target", () => {
    expect(source).toContain('previewLabel = fitStatus === "blocked" ? "Предпросмотр · не влезает" : "Предпросмотр"');
    expect(source).toContain("{preview ? (");
    expect(source).toContain("text={previewLabel}");
    expect(source).not.toContain('fitStatus === "blocked" ? "Недопустимо"');
  });
});
