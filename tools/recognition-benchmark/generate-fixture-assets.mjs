import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { fixtureSourceDefinitions, fixtureSourceIds } from "../../packages/recognition/benchmarks/fixtures/source-definitions.mjs";
import {
  buildCloudSnapshot,
  buildFixtureJson,
  buildSegmentsSnapshot,
  renderFixtureSvg,
  sha256,
} from "./fixture-renderer.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const fixturesRoot = join(repositoryRoot, "packages/recognition/benchmarks/fixtures");
const generatedIds = new Set(fixtureSourceIds);

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function clearGeneratedDirectories() {
  const entries = await readdir(fixturesRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && generatedIds.has(entry.name)) {
      await rm(join(fixturesRoot, entry.name), { recursive: true, force: true });
    }
  }
}

async function renderPng(page, definition, path) {
  const svg = renderFixtureSvg(definition);
  await page.setViewportSize({ width: definition.sourceWidthPx + 20, height: definition.sourceHeightPx + 20 });
  await page.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:white}svg{display:block}</style></head><body>${svg}</body></html>`);
  const locator = page.locator("svg");
  await locator.screenshot({ path, animations: "disabled", caret: "hide" });
}

async function main() {
  if (fixtureSourceDefinitions.length !== 8 || new Set(fixtureSourceIds).size !== 8) {
    throw new Error("Corpus v1 must contain exactly eight unique source definitions.");
  }
  await clearGeneratedDirectories();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1, colorScheme: "light" });
    for (const definition of fixtureSourceDefinitions) {
      const fixtureDirectory = join(fixturesRoot, definition.id);
      await mkdir(fixtureDirectory, { recursive: true });
      const sourcePath = join(fixtureDirectory, "source.png");
      await renderPng(page, definition, sourcePath);
      const sourceBuffer = await import("node:fs/promises").then(({ readFile }) => readFile(sourcePath));
      const sourceHash = sha256(sourceBuffer);
      await writeFile(join(fixtureDirectory, "source.sha256"), `${sourceHash}  source.png\n`);
      await writeFile(join(fixtureDirectory, "fixture.json"), stableJson(buildFixtureJson(definition, sourceHash)));
      await writeFile(join(fixtureDirectory, "segments.json"), stableJson(buildSegmentsSnapshot(definition)));
      if (definition.includeCloudSnapshot) {
        await writeFile(join(fixtureDirectory, "cloud-response.json"), stableJson(buildCloudSnapshot(definition)));
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(join(fixturesRoot, "manifest.json"), stableJson({
    schemaVersion: "recognition-corpus-manifest-v1",
    corpusVersion: "recognition-corpus-v1",
    fixtureIds: fixtureSourceIds,
  }));
}

await main();
