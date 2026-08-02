import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Segment = Readonly<{ x1: number; y1: number; x2: number; y2: number }>;
type OpeningAwareSnapshot = Readonly<{
  schemaVersion: string;
  segments: readonly Segment[];
  wallSegments?: readonly Segment[];
  symbolSegments?: readonly Segment[];
}>;

const snapshot = JSON.parse(readFileSync(
  new URL("../fixtures/openings-heavy/segments.json", import.meta.url),
  "utf8",
)) as OpeningAwareSnapshot;

describe("opening-aware benchmark segment snapshot", () => {
  it("separates wall continuity from opening symbols", () => {
    expect(snapshot.schemaVersion).toBe("recognition-segments-v1");
    expect(snapshot.wallSegments).toBeInstanceOf(Array);
    expect(snapshot.symbolSegments).toBeInstanceOf(Array);
    expect(snapshot.wallSegments?.length).toBeGreaterThan(12);
    expect(snapshot.symbolSegments?.length).toBeGreaterThanOrEqual(9);
  });

  it("keeps a legacy union for backward-compatible tooling", () => {
    const wallSegments = snapshot.wallSegments ?? [];
    const symbolSegments = snapshot.symbolSegments ?? [];
    expect(snapshot.segments.length).toBeGreaterThanOrEqual(wallSegments.length + symbolSegments.length);
  });
});
