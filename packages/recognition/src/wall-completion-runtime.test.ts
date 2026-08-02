import { describe, expect, it } from "vitest";
import {
  completeWallCenterlines as runtimeCompleteWallCenterlines,
  DEFAULT_WALL_COMPLETION_OPTIONS,
} from "./index";
import {
  completeWallCenterlines as experimentalCompleteWallCenterlines,
  type StructuralMaskView,
} from "./wall-completion";
import type { LocalWallCenterline } from "./wall-topology";

function line(x1: number, x2: number): LocalWallCenterline {
  return {
    startPx: { x: x1, y: 40 },
    endPx: { x: x2, y: 40 },
    thicknessPx: 10,
    evidenceCount: 2,
    confidence: "medium",
    reasons: ["filled-wall-region-evidence"],
  };
}

const structuralMask: StructuralMaskView = {
  widthPx: 200,
  heightPx: 120,
  isStructural: (x, y) => x >= 20 && x <= 150 && y >= 35 && y <= 45,
};

describe("wall completion production gate", () => {
  it("keeps the algorithm testable but disables it for the production package export", () => {
    const input = {
      centerlines: [line(20, 80), line(88, 150)],
      mask: structuralMask,
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    } as const;

    const experimental = experimentalCompleteWallCenterlines(input);
    const runtime = runtimeCompleteWallCenterlines(input);

    expect(experimental.acceptedCompletionCount).toBe(1);
    expect(experimental.centerlines).toHaveLength(1);
    expect(runtime.acceptedCompletionCount).toBe(0);
    expect(runtime.centerlines).toEqual(input.centerlines);
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({
      code: "completion-disabled-product-neutral",
    }));
  });
});
