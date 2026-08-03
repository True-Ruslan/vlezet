import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// @ts-expect-error M7.9 RED: public analogue definitions are implemented after this contract fails.
import { realAnalogueDefinitions } from "../benchmarks/real-analogues/source-definitions.mjs";

const privateManifest = JSON.parse(readFileSync(new URL(
  "../benchmarks/real-analogues/private-source-manifest.json",
  import.meta.url,
), "utf8")) as {
  sources: Array<{ sourceId: string; sha256: string }>;
};

const analogueManifest = JSON.parse(readFileSync(new URL(
  "../benchmarks/real-analogues/analogue-manifest.json",
  import.meta.url,
), "utf8")) as {
  schemaVersion: string;
  corpusVersion: string;
  fixtures: Array<{
    fixtureId: string;
    privateSourceId: string;
    privateSourceSha256: string;
  }>;
};

type AnalogueDefinition = Readonly<{
  id: string;
  privateSourceId: string;
  privateSourceSha256: string;
  description: string;
  provenance: Readonly<{ kind: string; note: string; license: string | null }>;
  tags: readonly string[];
  sourceWidthPx: number;
  sourceHeightPx: number;
  millimetersPerPixel: number;
  walls: readonly Readonly<{
    id: string;
    startMm: Readonly<{ x: number; y: number }>;
    endMm: Readonly<{ x: number; y: number }>;
    thicknessMm: number;
    kind: string;
  }>[];
  openings: readonly Readonly<{
    id: string;
    kind: "door" | "window";
    hostWallId: string;
    centerMm: Readonly<{ x: number; y: number }>;
    widthMm: number;
    orientationDeg: number;
  }>[];
  failureExpectations: Readonly<{
    mustDetect: readonly Readonly<{ kind: string; id: string }>[];
    mustNotDetectRegions: readonly Readonly<{ id: string; kind: string; polygonNormalized: readonly Readonly<{ x: number; y: number }>[] }>[];
    knownAmbiguities: readonly unknown[];
  }>;
}>;

const definitions = realAnalogueDefinitions as readonly AnalogueDefinition[];
const canonicalPrivateIds = Array.from(
  { length: 12 },
  (_, index) => `real-plan-${String(index + 1).padStart(3, "0")}`,
);
const expectedFixtureIds = canonicalPrivateIds.map((sourceId) => `${sourceId}-anonymized`);

function definition(sourceId: string): AnalogueDefinition {
  const result = definitions.find((candidate) => candidate.privateSourceId === sourceId);
  if (!result) throw new Error(`Missing definition for ${sourceId}`);
  return result;
}

describe("M7.9 public redrawn real-plan analogues", () => {
  it("maps all twelve private sources one-to-one to canonical public fixtures", () => {
    expect(analogueManifest.schemaVersion).toBe("recognition-real-analogue-manifest-v1");
    expect(analogueManifest.corpusVersion).toBe("recognition-real-analogue-corpus-v1");
    expect(analogueManifest.fixtures).toHaveLength(12);
    expect(definitions).toHaveLength(12);
    expect(analogueManifest.fixtures.map(({ fixtureId }) => fixtureId)).toEqual(expectedFixtureIds);
    expect(definitions.map(({ id }) => id)).toEqual(expectedFixtureIds);
    expect(definitions.map(({ privateSourceId }) => privateSourceId)).toEqual(canonicalPrivateIds);
    expect(new Set(definitions.map(({ privateSourceSha256 }) => privateSourceSha256)).size).toBe(12);

    const privateHashes = new Map(privateManifest.sources.map((source) => [source.sourceId, source.sha256]));
    for (const fixture of analogueManifest.fixtures) {
      expect(fixture.privateSourceSha256).toBe(privateHashes.get(fixture.privateSourceId));
    }
    for (const candidate of definitions) {
      expect(candidate.privateSourceSha256).toBe(privateHashes.get(candidate.privateSourceId));
    }
  });

  it("uses only repository-owned redrawn provenance and bounded deterministic rasters", () => {
    for (const candidate of definitions) {
      expect(candidate.provenance.kind).toBe("redrawn-anonymized");
      expect(candidate.provenance.note).toMatch(/manually reconstructed/i);
      expect(candidate.provenance.license).toBeNull();
      expect(candidate.description.length).toBeGreaterThan(20);
      expect(candidate.sourceWidthPx).toBeGreaterThan(0);
      expect(candidate.sourceWidthPx).toBeLessThanOrEqual(2400);
      expect(candidate.sourceHeightPx).toBeGreaterThan(0);
      expect(candidate.sourceHeightPx).toBeLessThanOrEqual(2400);
      expect(candidate.millimetersPerPixel).toBeGreaterThan(0);
      expect(candidate.walls.length).toBeGreaterThan(3);
      expect(candidate.openings.length).toBeGreaterThan(0);
    }
  });

  it("keeps wall and opening identities deterministic and host-valid", () => {
    for (const candidate of definitions) {
      const wallIds = candidate.walls.map(({ id }) => id);
      const openingIds = candidate.openings.map(({ id }) => id);
      expect(new Set(wallIds).size).toBe(wallIds.length);
      expect(new Set(openingIds).size).toBe(openingIds.length);
      for (const wall of candidate.walls) {
        expect(wall.startMm).not.toEqual(wall.endMm);
        expect(wall.thicknessMm).toBeGreaterThan(0);
        expect(["external", "partition", "balcony-boundary", "unknown-structural"]).toContain(wall.kind);
      }
      for (const opening of candidate.openings) {
        expect(wallIds).toContain(opening.hostWallId);
        expect(opening.widthMm).toBeGreaterThan(0);
        expect(Number.isFinite(opening.orientationDeg)).toBe(true);
      }
    }
  });

  it("requires a critical scenario assertion for every fixture", () => {
    for (const candidate of definitions) {
      const totalExpectations = candidate.failureExpectations.mustDetect.length
        + candidate.failureExpectations.mustNotDetectRegions.length;
      expect(totalExpectations).toBeGreaterThan(0);
      for (const region of candidate.failureExpectations.mustNotDetectRegions) {
        expect(region.polygonNormalized.length).toBeGreaterThanOrEqual(4);
        for (const point of region.polygonNormalized) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(1);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("captures the exact first-plan regressions reported by the product owner", () => {
    const first = definition("real-plan-001");
    const requiredDetections = new Set(first.failureExpectations.mustDetect.map(({ id }) => id));
    const forbiddenRegions = new Set(first.failureExpectations.mustNotDetectRegions.map(({ id }) => id));

    expect(first.tags).toEqual(expect.arrayContaining([
      "thin-loggia-wall",
      "windows-heavy",
      "sanitary-clutter",
      "current-regression",
    ]));
    expect(requiredDetections).toEqual(new Set([
      "balcony-thin-wall",
      "living-window",
      "loggia-window",
      "bathroom-door",
      "entrance-door",
      "living-door",
    ]));
    expect(forbiddenRegions).toEqual(new Set([
      "kitchen-sink-symbol",
      "toilet-service-symbols",
    ]));
  });

  it("covers portrait, diagonal, irregular, balcony and multi-wet-zone families", () => {
    expect(definition("real-plan-002").tags).toContain("portrait");
    expect(definition("real-plan-004").tags).toContain("portrait");
    expect(definition("real-plan-008").tags).toEqual(expect.arrayContaining(["diagonal", "rotation-invariance"]));
    expect(definition("real-plan-010").tags).toContain("irregular-footprint");
    expect(definition("real-plan-011").tags).toEqual(expect.arrayContaining(["irregular-footprint", "multiple-wet-zones"]));
    expect(definition("real-plan-012").tags).toEqual(expect.arrayContaining(["openings-heavy", "two-wet-zones"]));
    expect(definitions.filter((candidate) => candidate.tags.some((tag) => tag.includes("balcony") || tag.includes("loggia"))).length)
      .toBeGreaterThanOrEqual(8);
  });
});
