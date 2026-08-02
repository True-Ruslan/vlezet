import { describe, expect, it } from "vitest";
import {
  completeWallCenterlines,
  DEFAULT_WALL_COMPLETION_OPTIONS,
  type StructuralMaskView,
} from "./wall-completion";
import type { LocalWallCenterline } from "./wall-topology";

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx = 10,
): LocalWallCenterline {
  return {
    startPx: { x: x1, y: y1 },
    endPx: { x: x2, y: y2 },
    thicknessPx,
    evidenceCount: 2,
    confidence: "medium",
    reasons: ["filled-wall-region-evidence"],
  };
}

function mask(widthPx = 200, heightPx = 120): StructuralMaskView {
  return {
    widthPx,
    heightPx,
    isStructural: () => false,
  };
}

function bandMask({
  widthPx = 200,
  heightPx = 120,
  x1,
  x2,
  y,
  thicknessPx,
  emptyRanges = [],
}: Readonly<{
  widthPx?: number;
  heightPx?: number;
  x1: number;
  x2: number;
  y: number;
  thicknessPx: number;
  emptyRanges?: readonly Readonly<{ start: number; end: number }>[];
}>): StructuralMaskView {
  const half = thicknessPx / 2;
  return {
    widthPx,
    heightPx,
    isStructural: (x, sampleY) => {
      if (x < x1 || x > x2 || sampleY < y - half || sampleY > y + half) return false;
      return !emptyRanges.some((range) => x >= range.start && x <= range.end);
    },
  };
}

describe("evidence-gated wall completion contracts", () => {
  it("fails closed for invalid mask dimensions without mutating input", () => {
    const source = [line(80, 40, 20, 40)];
    const before = structuredClone(source);

    const result = completeWallCenterlines({
      centerlines: source,
      mask: mask(0, 120),
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });

    expect(source).toEqual(before);
    expect(result.centerlines).toEqual([line(20, 40, 80, 40)]);
    expect(result.acceptedCompletionCount).toBe(0);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "completion-invalid-input" }),
    ]));
  });

  it("fails closed for non-finite geometry", () => {
    const result = completeWallCenterlines({
      centerlines: [line(Number.NaN, 40, 80, 40)],
      mask: mask(),
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });

    expect(result.centerlines).toHaveLength(0);
    expect(result.acceptedCompletionCount).toBe(0);
    expect(result.diagnostics[0]?.code).toBe("completion-invalid-input");
  });

  it("fails closed for invalid options", () => {
    const result = completeWallCenterlines({
      centerlines: [line(20, 40, 80, 40)],
      mask: mask(),
      options: {
        ...DEFAULT_WALL_COMPLETION_OPTIONS,
        maximumPairComparisons: -1,
      },
    });

    expect(result.centerlines).toEqual([line(20, 40, 80, 40)]);
    expect(result.acceptedCompletionCount).toBe(0);
    expect(result.diagnostics[0]?.code).toBe("completion-invalid-input");
  });

  it("returns the original canonical set when the input budget is exceeded", () => {
    const centerlines = Array.from({ length: DEFAULT_WALL_COMPLETION_OPTIONS.maximumInputCenterlines + 1 }, (_, index) =>
      line(20, 20 + index, 80, 20 + index));

    const result = completeWallCenterlines({
      centerlines,
      mask: mask(300, 300),
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });

    expect(result.centerlines).toHaveLength(centerlines.length);
    expect(result.acceptedCompletionCount).toBe(0);
    expect(result.diagnostics[0]?.code).toBe("completion-budget-exceeded");
  });

  it("is deterministic for reversed and permuted input before completion", () => {
    const first = completeWallCenterlines({
      centerlines: [
        line(80, 40, 20, 40),
        line(150, 80, 90, 80),
      ],
      mask: mask(),
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });
    const second = completeWallCenterlines({
      centerlines: [
        line(90, 80, 150, 80),
        line(20, 40, 80, 40),
      ],
      mask: mask(),
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });

    expect(first).toEqual(second);
  });
});

describe("evidence-gated collinear wall bridges", () => {
  it("bridges a small raster-supported gap in one pass", () => {
    const result = completeWallCenterlines({
      centerlines: [
        line(20, 40, 80, 40),
        line(88, 40, 150, 40),
      ],
      mask: bandMask({ x1: 20, x2: 150, y: 40, thicknessPx: 10 }),
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });

    expect(result.acceptedCompletionCount).toBe(1);
    expect(result.centerlines).toHaveLength(1);
    expect(result.centerlines[0]).toEqual(expect.objectContaining({
      startPx: { x: 20, y: 40 },
      endPx: { x: 150, y: 40 },
      confidence: "medium",
    }));
    expect(result.centerlines[0]?.reasons).toContain("completion-raster-bridge");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "bridge-accepted" }));
  });

  it("preserves a clean opening instead of bridging it", () => {
    const result = completeWallCenterlines({
      centerlines: [
        line(20, 40, 80, 40),
        line(88, 40, 150, 40),
      ],
      mask: bandMask({
        x1: 20,
        x2: 150,
        y: 40,
        thicknessPx: 10,
        emptyRanges: [{ start: 81, end: 87 }],
      }),
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });

    expect(result.acceptedCompletionCount).toBe(0);
    expect(result.centerlines).toHaveLength(2);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "bridge-likely-opening" }));
  });

  it("produces identical bridges for reversed and permuted inputs", () => {
    const structuralMask = bandMask({ x1: 20, x2: 150, y: 40, thicknessPx: 10 });
    const first = completeWallCenterlines({
      centerlines: [line(20, 40, 80, 40), line(88, 40, 150, 40)],
      mask: structuralMask,
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });
    const second = completeWallCenterlines({
      centerlines: [line(150, 40, 88, 40), line(80, 40, 20, 40)],
      mask: structuralMask,
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });

    expect(second).toEqual(first);
  });
});
