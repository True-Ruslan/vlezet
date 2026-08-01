import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolDirectory, "../..");
const fixturesRoot = join(repositoryRoot, "packages/recognition/benchmarks/fixtures");
const artifactsRoot = join(toolDirectory, "artifacts/source");
const manifest = JSON.parse(await readFile(join(fixturesRoot, "manifest.json"), "utf8"));

function semanticDraft(draft) {
  return {
    engineVersion: draft.engineVersion,
    status: draft.status,
    walls: draft.walls,
    openings: draft.openings,
    roomLabels: draft.roomLabels,
    diagnostics: draft.diagnostics,
    decisions: draft.decisions,
    source: draft.source,
  };
}

async function runHarness(page, fixtureId, mode) {
  const fixtureDirectory = join(fixturesRoot, fixtureId);
  const fixture = JSON.parse(await readFile(join(fixtureDirectory, "fixture.json"), "utf8"));
  const sourceBase64 = (await readFile(join(fixtureDirectory, "source.png"))).toString("base64");
  return page.evaluate(async ({ fixtureId: currentFixtureId, fixture: currentFixture, sourceBase64: encoded, mode: currentMode }) => {
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
    const input = {
      imageData,
      sourceWidthPx: currentFixture.calibration.sourceWidthPx,
      sourceHeightPx: currentFixture.calibration.sourceHeightPx,
      sourceMillimetersPerPixel: currentFixture.calibration.millimetersPerPixel,
      projectId: `benchmark-${currentFixtureId}`,
      referenceAssetId: `asset-${currentFixtureId}`,
      referenceRevision: "recognition-corpus-v1",
      now: "2026-08-01T00:00:00.000Z",
    };
    const harness = window.__vlezetRecognitionBenchmark;
    if (!harness) throw new Error("Recognition benchmark harness is unavailable.");
    return currentMode === "worker" ? harness.runWorker(input) : harness.runEngine(input);
  }, { fixtureId, fixture, sourceBase64, mode });
}

test.beforeAll(async () => {
  await mkdir(join(artifactsRoot, "predictions"), { recursive: true });
});

test("shared engine processes all eight source fixtures", async ({ page }) => {
  await page.goto("/__recognition-benchmark");
  await expect(page.getByRole("heading", { name: "Recognition Benchmark Harness" })).toBeVisible();
  expect(manifest.fixtureIds).toHaveLength(8);

  for (const fixtureId of manifest.fixtureIds) {
    const draft = await runHarness(page, fixtureId, "engine");
    expect(draft.engineVersion).toBe("3");
    await writeFile(
      join(artifactsRoot, "predictions", `${fixtureId}.json`),
      `${JSON.stringify(draft, null, 2)}\n`,
      "utf8",
    );
    await page.screenshot({ path: join(artifactsRoot, `${fixtureId}.png`), fullPage: true });
  }
});

test("production Worker seam matches the shared engine", async ({ page }) => {
  await page.goto("/__recognition-benchmark");
  const direct = await runHarness(page, "clean-studio", "engine");
  const worker = await runHarness(page, "clean-studio", "worker");
  expect(semanticDraft(worker)).toEqual(semanticDraft(direct));
});
