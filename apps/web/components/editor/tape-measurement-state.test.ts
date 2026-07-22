import { describe, expect, it } from "vitest";
import { advanceTapeMeasurement, previewTapeMeasurement } from "./tape-measurement-state";

describe("tape measurement interaction state", () => {
  it("starts, previews, commits, and restarts a measurement", () => {
    const started = advanceTapeMeasurement(null, { x: 100, y: 200 });
    expect(started).toEqual({ start: { x: 100, y: 200 }, end: { x: 100, y: 200 }, complete: false });

    const previewed = previewTapeMeasurement(started, { x: 500, y: 700 });
    expect(previewed?.end).toEqual({ x: 500, y: 700 });
    expect(previewed?.complete).toBe(false);

    const committed = advanceTapeMeasurement(previewed, { x: 800, y: 900 });
    expect(committed).toEqual({ start: { x: 100, y: 200 }, end: { x: 800, y: 900 }, complete: true });

    const restarted = advanceTapeMeasurement(committed, { x: 50, y: 60 });
    expect(restarted).toEqual({ start: { x: 50, y: 60 }, end: { x: 50, y: 60 }, complete: false });
  });

  it("does not change a completed measurement on pointer preview", () => {
    const complete = { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, complete: true } as const;
    expect(previewTapeMeasurement(complete, { x: 2000, y: 0 })).toBe(complete);
  });
});
