import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateRecognitionBenchmarkFixtureV1 } from "../benchmarks/schema/fixture-v1";
import { realAnalogueDefinitions } from "../benchmarks/real-analogues/source-definitions.mjs";
import {
  buildRealFixtureJson,
  buildRealSegmentsSnapshot,
  renderRealFixtureSvg,
} from "../../../tools/recognition-benchmark/real-fixture-renderer.mjs";
import { verifyRealFixtureDirectory } from "../../../tools/recognition-benchmark/verify-real-fixtures.mjs";

const temporaryRoots: string[] = [];
const firstDefinition = realAnalogueDefinitions[0];
if (!firstDefinition) throw new Error("The real analogue corpus must contain at least one fixture.");

async function temporaryDirectory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vlezet-real-fixture-"));
  temporaryRoots.push(root);
  return root;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function writeFixture(root: string, definition = firstDefinition) {
  const fixtureDirectory = join(root, definition.id);
  await mkdir(fixtureDirectory, { recursive: true });
  const sourceBuffer = Buffer.from("deterministic-public-redrawn-png");
  const sourceHash = sha256(sourceBuffer);
  const fixture = buildRealFixtureJson(definition, sourceHash);
  const segments = buildRealSegmentsSnapshot(definition);
  const expectations = {
    schemaVersion: "recognition-failure-expectations-v1",
    ...definition.failureExpectations,
  };
  await writeFile(join(fixtureDirectory, "source.png"), sourceBuffer);
  await writeFile(join(fixtureDirectory, "source.sha256"), `${sourceHash}  source.png\n`);
  await writeFile(join(fixtureDirectory, "fixture.json"), `${JSON.stringify(fixture, null, 2)}\n`);
  await writeFile(join(fixtureDirectory, "segments.json"), `${JSON.stringify(segments, null, 2)}\n`);
  await writeFile(join(fixtureDirectory, "failure-expectations.json"), `${JSON.stringify(expectations, null, 2)}\n`);
  return { fixtureDirectory, sourceHash };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("M7.9 immutable public real-fixture assets", () => {
  it("renders repository-owned geometry and recognition clutter without embedding private hashes", () => {
    const definition = firstDefinition;
    const svg = renderRealFixtureSvg(definition);

    expect(svg).toContain(`<svg`);
    expect(svg).toContain(`width="${definition.sourceWidthPx}"`);
    expect(svg).toContain(`height="${definition.sourceHeightPx}"`);
    expect(svg).toContain(`data-wall-id="external-top"`);
    expect(svg).toContain(`data-opening-id="living-window"`);
    expect(svg).toContain(`data-opening-id="bathroom-door"`);
    expect(svg).toContain(`data-decoration-id="p1-kitchen-sink"`);
    expect(svg).not.toContain(definition.privateSourceSha256);
    expect(svg).not.toMatch(/photo_|image\(\d+\)/i);
  });

  it("builds the canonical benchmark fixture schema with host-valid openings", () => {
    const definition = firstDefinition;
    const fixture = validateRecognitionBenchmarkFixtureV1(
      buildRealFixtureJson(definition, "a".repeat(64)),
    );

    expect(fixture.id).toBe("real-plan-001-anonymized");
    expect(fixture.provenance.kind).toBe("redrawn-anonymized");
    expect(fixture.tags).toEqual(expect.arrayContaining(["calibrated", "regression", "openings-heavy"]));
    expect(fixture.expectedWalls).toHaveLength(definition.walls.length);
    expect(fixture.expectedOpenings).toHaveLength(definition.openings.length);
    expect(fixture.expectedJunctions.length).toBeGreaterThan(0);
    const wallIds = new Set(fixture.expectedWalls.map(({ id }) => id));
    for (const opening of fixture.expectedOpenings) expect(wallIds.has(opening.hostWallId)).toBe(true);
  });

  it("builds deterministic structural and clutter line evidence", () => {
    const definition = firstDefinition;
    const first = buildRealSegmentsSnapshot(definition);
    const second = buildRealSegmentsSnapshot(definition);

    expect(second).toEqual(first);
    expect(first.schemaVersion).toBe("recognition-segments-v1");
    expect(first.widthPx).toBe(definition.sourceWidthPx);
    expect(first.heightPx).toBe(definition.sourceHeightPx);
    expect(first.segments.length).toBeGreaterThan(definition.walls.length * 2);
  });

  it("verifies a complete generated fixture directory", async () => {
    const root = await temporaryDirectory();
    await writeFixture(root);

    await expect(verifyRealFixtureDirectory({
      root,
      definitions: [firstDefinition],
    })).resolves.toEqual({
      fixtureCount: 1,
      hashMismatches: [],
      provenanceViolations: [],
      privateDigestLeaks: [],
      failureExpectationErrors: [],
    });
  });

  it("rejects a changed source raster", async () => {
    const root = await temporaryDirectory();
    const { fixtureDirectory } = await writeFixture(root);
    await writeFile(join(fixtureDirectory, "source.png"), Buffer.from("changed-public-raster"));

    await expect(verifyRealFixtureDirectory({
      root,
      definitions: [firstDefinition],
    })).rejects.toThrow(/hash mismatch/i);
  });

  it("rejects a fixture that claims the private source digest", async () => {
    const root = await temporaryDirectory();
    const { fixtureDirectory } = await writeFixture(root);
    const privateDigest = firstDefinition.privateSourceSha256;
    await writeFile(join(fixtureDirectory, "source.sha256"), `${privateDigest}  source.png\n`);

    await expect(verifyRealFixtureDirectory({
      root,
      definitions: [firstDefinition],
    })).rejects.toThrow(/private.*digest/i);
  });

  it("rejects missing or invalid failure expectations", async () => {
    const root = await temporaryDirectory();
    const { fixtureDirectory } = await writeFixture(root);
    await writeFile(join(fixtureDirectory, "failure-expectations.json"), JSON.stringify({
      schemaVersion: "recognition-failure-expectations-v1",
      mustDetect: [],
      mustNotDetectRegions: [],
      knownAmbiguities: [],
    }));

    await expect(verifyRealFixtureDirectory({
      root,
      definitions: [firstDefinition],
    })).rejects.toThrow(/failure expectations/i);
  });
});
