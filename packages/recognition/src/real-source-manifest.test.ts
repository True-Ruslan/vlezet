import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The benchmark schema is JavaScript because it is also consumed directly by Node tooling.
// @ts-expect-error M7.9 RED: the module does not exist until the manifest contract is implemented.
import { validatePrivateSourceManifest } from "../benchmarks/real-analogues/schema.mjs";

const manifestUrl = new URL(
  "../benchmarks/real-analogues/private-source-manifest.json",
  import.meta.url,
);

function loadManifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(manifestUrl, "utf8")) as Record<string, unknown>;
}

function validSource(overrides: Record<string, unknown> = {}) {
  return {
    sourceId: "real-plan-001",
    sha256: "a".repeat(64),
    widthPx: 100,
    heightPx: 200,
    mediaType: "image/png",
    tags: ["portrait"],
    annotationStatus: "registered",
    redistribution: "not-committed",
    ...overrides,
  };
}

describe("M7.9 private recognition source manifest", () => {
  it("registers exactly twelve immutable sources in canonical order", () => {
    const manifest = loadManifest() as {
      schemaVersion?: unknown;
      batchId?: unknown;
      sources?: Array<{ sourceId: string; sha256: string }>;
    };

    expect(manifest.schemaVersion).toBe("recognition-private-source-manifest-v1");
    expect(manifest.batchId).toBe("product-owner-real-plans-2026-08-04");
    expect(manifest.sources).toHaveLength(12);
    expect(manifest.sources?.map(({ sourceId }) => sourceId)).toEqual(
      Array.from(
        { length: 12 },
        (_, index) => `real-plan-${String(index + 1).padStart(3, "0")}`,
      ),
    );
    expect(new Set(manifest.sources?.map(({ sha256 }) => sha256)).size).toBe(12);
    expect(validatePrivateSourceManifest(manifest)).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ["malformed SHA-256", { sha256: "not-a-digest" }, "sha256"],
    ["zero width", { widthPx: 0 }, "widthPx"],
    ["zero height", { heightPx: 0 }, "heightPx"],
    ["unsupported media type", { mediaType: "image/webp" }, "mediaType"],
    ["unreviewed annotation state", { annotationStatus: "pending" }, "annotationStatus"],
    ["redistributable private source", { redistribution: "public" }, "redistribution"],
  ])("rejects %s", (_name, overrides, expectedError) => {
    const result = validatePrivateSourceManifest({
      schemaVersion: "recognition-private-source-manifest-v1",
      batchId: "product-owner-real-plans-2026-08-04",
      sources: [validSource(overrides)],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain(expectedError);
  });

  it("rejects duplicate source IDs and duplicate source digests", () => {
    const duplicate = validSource();
    const result = validatePrivateSourceManifest({
      schemaVersion: "recognition-private-source-manifest-v1",
      batchId: "product-owner-real-plans-2026-08-04",
      sources: [duplicate, { ...duplicate }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/duplicate sourceId/i);
    expect(result.errors.join("\n")).toMatch(/duplicate sha256/i);
  });
});
