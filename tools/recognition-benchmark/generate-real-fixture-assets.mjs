import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { realAnalogueDefinitions } from "../../packages/recognition/benchmarks/real-analogues/source-definitions.mjs";
import {
  buildRealFixtureJson,
  buildRealSegmentsSnapshot,
  renderRealFixtureSvg,
  sha256,
} from "./real-fixture-renderer.mjs";
import { verifyRealFixtureDirectory } from "./verify-real-fixtures.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const defaultFixturesRoot = join(
  repositoryRoot,
  "packages/recognition/benchmarks/real-analogues/fixtures",
);

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function clearFixtureDirectories(root, definitions) {
  await mkdir(root, { recursive: true });
  const allowedIds = new Set(definitions.map(({ id }) => id));
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && allowedIds.has(entry.name)) {
      await rm(join(root, entry.name), { recursive: true, force: true });
    }
  }
}

async function renderPng(page, definition, path) {
  const svg = renderRealFixtureSvg(definition);
  await page.setViewportSize({
    width: definition.sourceWidthPx + 20,
    height: definition.sourceHeightPx + 20,
  });
  await page.setContent(
    `<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f3f5f8}svg{display:block}</style></head><body>${svg}</body></html>`,
    { waitUntil: "load" },
  );
  await page.locator("svg").screenshot({
    path,
    animations: "disabled",
    caret: "hide",
    omitBackground: false,
  });
}

export async function generateRealFixtureAssets(input = {}) {
  const root = resolve(input.root ?? defaultFixturesRoot);
  const definitions = input.definitions ?? realAnalogueDefinitions;
  if (definitions.length !== 12 || new Set(definitions.map(({ id }) => id)).size !== 12) {
    throw new Error("M7.9 real analogue corpus must contain exactly twelve unique fixtures.");
  }

  await clearFixtureDirectories(root, definitions);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1, colorScheme: "light" });
    for (const definition of definitions) {
      const fixtureDirectory = join(root, definition.id);
      await mkdir(fixtureDirectory, { recursive: true });
      const sourcePath = join(fixtureDirectory, "source.png");
      await renderPng(page, definition, sourcePath);
      const sourceBuffer = await readFile(sourcePath);
      const sourceHash = sha256(sourceBuffer);
      if (sourceHash === definition.privateSourceSha256) {
        throw new Error(`${definition.id}: generated public raster unexpectedly matches private source digest.`);
      }
      await writeFile(join(fixtureDirectory, "source.sha256"), `${sourceHash}  source.png\n`);
      await writeFile(
        join(fixtureDirectory, "fixture.json"),
        stableJson(buildRealFixtureJson(definition, sourceHash)),
      );
      await writeFile(
        join(fixtureDirectory, "segments.json"),
        stableJson(buildRealSegmentsSnapshot(definition)),
      );
      await writeFile(
        join(fixtureDirectory, "failure-expectations.json"),
        stableJson({
          schemaVersion: "recognition-failure-expectations-v1",
          ...definition.failureExpectations,
        }),
      );
    }
  } finally {
    await browser.close();
  }

  const report = await verifyRealFixtureDirectory({ root, definitions });
  return { root, report };
}

async function runCli() {
  const { root, report } = await generateRealFixtureAssets({
    root: process.argv[2] ?? defaultFixturesRoot,
  });
  console.log(`Generated and verified ${report.fixtureCount} real-plan analogue fixtures at ${root}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((cause) => {
    console.error(cause instanceof Error ? cause.message : "Real fixture generation failed.");
    process.exitCode = 1;
  });
}
