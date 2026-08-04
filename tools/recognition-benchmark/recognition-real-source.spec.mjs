import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolDirectory, "../..");
const corpusRoot = join(repositoryRoot, "packages/recognition/benchmarks/real-analogues");
const fixturesRoot = join(corpusRoot, "fixtures");
const artifactsRoot = join(toolDirectory, "artifacts/real-source");
const manifest = JSON.parse(await readFile(join(corpusRoot, "analogue-manifest.json"), "utf8"));
const fixtureIds = manifest.fixtures.map((entry) => entry.fixtureId).sort();

async function runHarness(page, fixtureId) {
  const fixtureDirectory = join(fixturesRoot, fixtureId);
  const fixture = JSON.parse(await readFile(join(fixtureDirectory, "fixture.json"), "utf8"));
  const sourceBase64 = (await readFile(join(fixtureDirectory, "source.png"))).toString("base64");
  return page.evaluate(async ({ fixtureId: currentFixtureId, fixture: currentFixture, sourceBase64: encoded }) => {
    const response = await fetch(`data:image/png;base64,${encoded}`);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const harness = window.__vlezetRecognitionBenchmark;
    if (!harness) throw new Error("Recognition benchmark harness is unavailable.");
    return harness.runEngineDebug({
      imageData,
      sourceWidthPx: currentFixture.calibration.sourceWidthPx,
      sourceHeightPx: currentFixture.calibration.sourceHeightPx,
      sourceMillimetersPerPixel: currentFixture.calibration.millimetersPerPixel,
      projectId: `real-benchmark-${currentFixtureId}`,
      referenceAssetId: `real-asset-${currentFixtureId}`,
      referenceRevision: "recognition-real-analogue-corpus-v1",
      now: "2026-08-04T00:00:00.000Z",
    });
  }, { fixtureId, fixture, sourceBase64 });
}

test.beforeAll(async () => {
  await mkdir(join(artifactsRoot, "predictions"), { recursive: true });
  await mkdir(join(artifactsRoot, "debug"), { recursive: true });
});

test("shared engine processes all twelve public real-plan analogues", async ({ page }) => {
  await page.goto("/__recognition-benchmark");
  await expect(page.getByRole("heading", { name: "Recognition Benchmark Harness" })).toBeVisible();
  expect(fixtureIds).toHaveLength(12);

  for (const fixtureId of fixtureIds) {
    const { draft, debug } = await runHarness(page, fixtureId);
    expect(draft.engineVersion).toBe("5");
    expect(draft.status).toBe("local-complete");
    expect(Array.isArray(draft.walls)).toBe(true);
    expect(Array.isArray(draft.openings)).toBe(true);
    await writeFile(
      join(artifactsRoot, "predictions", `${fixtureId}.json`),
      `${JSON.stringify(draft, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(artifactsRoot, "debug", `${fixtureId}.json`),
      `${JSON.stringify(debug, null, 2)}\n`,
      "utf8",
    );
  }
});
