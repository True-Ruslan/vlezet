import { describe, expect, it } from "vitest";
import {
  validateAnalogueManifest,
  validateFailureExpectations,
} from "../benchmarks/real-analogues/schema.mjs";

const privateManifest = {
  schemaVersion: "recognition-private-source-manifest-v1",
  batchId: "product-owner-real-plans-2026-08-04",
  sources: [
    {
      sourceId: "real-plan-001",
      sha256: "a".repeat(64),
      widthPx: 100,
      heightPx: 100,
      mediaType: "image/png",
      tags: ["test"],
      annotationStatus: "registered",
      redistribution: "not-committed",
    },
  ],
};

function analogueManifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "recognition-real-analogue-manifest-v1",
    corpusVersion: "recognition-real-analogue-corpus-v1",
    fixtures: [
      {
        fixtureId: "real-plan-001-anonymized",
        privateSourceId: "real-plan-001",
        privateSourceSha256: "a".repeat(64),
      },
    ],
    ...overrides,
  };
}

function expectations(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "recognition-failure-expectations-v1",
    mustDetect: [{ kind: "wall", id: "wall-1" }],
    mustNotDetectRegions: [
      {
        id: "fixture-noise",
        kind: "wall",
        polygonNormalized: [
          { x: 0.1, y: 0.1 },
          { x: 0.2, y: 0.1 },
          { x: 0.2, y: 0.2 },
          { x: 0.1, y: 0.2 },
        ],
        reason: "Fixture symbol must not become a wall.",
      },
    ],
    knownAmbiguities: [],
    ...overrides,
  };
}

describe("M7.9 real analogue schemas", () => {
  it("accepts a one-to-one analogue manifest", () => {
    expect(validateAnalogueManifest(analogueManifest(), privateManifest)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each([
    ["unknown private source", { fixtures: [{ fixtureId: "real-plan-999-anonymized", privateSourceId: "real-plan-999", privateSourceSha256: "b".repeat(64) }] }, /unknown privateSourceId/i],
    ["wrong private digest", { fixtures: [{ fixtureId: "real-plan-001-anonymized", privateSourceId: "real-plan-001", privateSourceSha256: "b".repeat(64) }] }, /privateSourceSha256/i],
    ["wrong fixture identity", { fixtures: [{ fixtureId: "custom-name", privateSourceId: "real-plan-001", privateSourceSha256: "a".repeat(64) }] }, /fixtureId/i],
    ["missing mapping", { fixtures: [] }, /missing analogue/i],
  ])("rejects %s", (_name, overrides, expected) => {
    const result = validateAnalogueManifest(analogueManifest(overrides), privateManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(expected);
  });

  it("rejects duplicate fixture and private source mappings", () => {
    const duplicate = analogueManifest().fixtures[0];
    const result = validateAnalogueManifest(
      analogueManifest({ fixtures: [duplicate, { ...duplicate }] }),
      privateManifest,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/duplicate fixtureId/i);
    expect(result.errors.join("\n")).toMatch(/duplicate privateSourceId/i);
  });

  it("accepts bounded scenario-specific expectations", () => {
    expect(validateFailureExpectations(expectations(), {
      wallIds: new Set(["wall-1"]),
      openingIds: new Set<string>(),
    })).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ["unknown must-detect ID", { mustDetect: [{ kind: "wall", id: "missing" }] }, /unknown.*missing/i],
    ["empty scenario set", { mustDetect: [], mustNotDetectRegions: [] }, /at least one/i],
    ["short polygon", { mustNotDetectRegions: [{ id: "bad", kind: "wall", polygonNormalized: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], reason: "bad" }] }, /four/i],
    ["out-of-range point", { mustNotDetectRegions: [{ id: "bad", kind: "wall", polygonNormalized: [{ x: -0.1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], reason: "bad" }] }, /0\.\.1/i],
    ["missing reason", { mustNotDetectRegions: [{ id: "bad", kind: "wall", polygonNormalized: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], reason: "" }] }, /reason/i],
  ])("rejects %s", (_name, overrides, expected) => {
    const result = validateFailureExpectations(expectations(overrides), {
      wallIds: new Set(["wall-1"]),
      openingIds: new Set<string>(),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(expected);
  });
});
