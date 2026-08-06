import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type RecordedFixture = Readonly<{
  id: string;
  responsePath: string;
  contextPath?: string;
}>;

type RecordedManifest = Readonly<{
  fixtures: readonly RecordedFixture[];
}>;

const corpusRoot = new URL("../benchmarks/real-analogues/recorded-ai-proposals/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", corpusRoot), "utf8")) as RecordedManifest;

describe("deterministic AI proposal benchmark contract", () => {
  it("provides a reproducible local context for every recorded provider response", () => {
    expect(manifest.fixtures.length).toBeGreaterThan(0);
    for (const fixture of manifest.fixtures) {
      expect(fixture.contextPath, `${fixture.id} must declare contextPath`).toMatch(/^contexts\/[a-z0-9-]+\.json$/);
      expect(existsSync(new URL(fixture.contextPath!, corpusRoot)), `${fixture.id} context must exist`).toBe(true);
    }
  });

  it("keeps the recorded corpus source-byte free", () => {
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toMatch(/data:image|base64|private-raster|private-source|authorization/i);
  });
});
