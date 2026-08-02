import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return resolve(value);
}

function readResult(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  if (value.schemaVersion !== "recognition-benchmark-result-v1") throw new Error(`${label} has an unsupported schema.`);
  if (value.corpusVersion !== "recognition-corpus-v1") throw new Error(`${label} has an unsupported corpus.`);
  if (typeof value.recognitionEngineVersion !== "string" || !value.recognitionEngineVersion) throw new Error(`${label} has no engine version.`);
  if (typeof value.commitSha !== "string" || !/^[a-f0-9]{40}$/i.test(value.commitSha)) throw new Error(`${label} has an invalid commit SHA.`);
  if (!Array.isArray(value.fixtures) || value.fixtures.length !== 8) throw new Error(`${label} must contain exactly eight fixtures.`);
  if (!value.aggregate || value.aggregate.fixtureCount !== 8) throw new Error(`${label} aggregate fixture count is invalid.`);
  if (value.aggregate.failedFixtureCount !== 0 || value.fixtures.some((fixture) => fixture.failed === true)) {
    throw new Error(`${label} contains failed fixtures.`);
  }
  return value;
}

function metricText(metric) {
  if (!metric || metric.status === "not-applicable") return "n/a";
  if (metric.status !== "measured" || !Number.isFinite(metric.value)) throw new Error("Evidence metric is invalid.");
  return Number(metric.value.toFixed(6)).toString();
}

function renderSummary(evidence) {
  const metrics = [
    ["Wall geometry F1", "wallGeometryF1"],
    ["Wall topology F1", "wallTopologyF1"],
    ["Opening F1", "openingF1"],
    ["Exact zone-count rate", "exactZoneCountRate"],
    ["Total-area median APE", "totalAreaMedianAbsolutePercentageError"],
    ["Room-area median APE", "roomAreaMedianAbsolutePercentageError"],
    ["Incorrect high-confidence rate", "incorrectHighConfidenceRate"],
    ["Unknown-host openings", "unknownHostOpenings"],
    ["Stale decisions", "staleDecisions"],
  ];
  const rows = metrics.map(([label, key]) => `| ${label} | ${metricText(evidence.core.aggregate.metrics[key])} | ${metricText(evidence.source.aggregate.metrics[key])} |`);
  return [
    "# Recognition Benchmark Evidence",
    "",
    `- Commit: \`${evidence.commitSha}\``,
    `- Corpus: \`${evidence.corpusVersion}\``,
    `- Engine: \`${evidence.recognitionEngineVersion}\``,
    `- Fixtures: ${evidence.fixtureCount}`,
    `- Source overlays: ${evidence.overlayFiles.length} deterministic SVG files`,
    `- Core baseline comparison: ${evidence.core.baselineComparison.metrics.length} comparable metrics, no regressions`,
    "- Live provider calls: forbidden and unused",
    "",
    "| Metric | Core | Source |",
    "| --- | ---: | ---: |",
    ...rows,
    "",
    "M7.8A records the current quality gap; it does not claim the final M7.8 thresholds are met.",
    "",
  ].join("\n");
}

async function digest(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

const corePath = requiredEnvironment("RECOGNITION_CORE_RESULT_PATH");
const sourcePath = requiredEnvironment("RECOGNITION_SOURCE_RESULT_PATH");
const sourceOverlaysDirectory = requiredEnvironment("RECOGNITION_SOURCE_OVERLAYS_DIR");
const outputDirectory = requiredEnvironment("RECOGNITION_EVIDENCE_OUTPUT_DIR");
const core = readResult(JSON.parse(await readFile(corePath, "utf8")), "Core result");
const source = readResult(JSON.parse(await readFile(sourcePath, "utf8")), "Source result");

if (core.commitSha.toLowerCase() !== source.commitSha.toLowerCase()) throw new Error("Core and Source results use different commit SHAs.");
if (core.corpusVersion !== source.corpusVersion) throw new Error("Core and Source results use different corpus versions.");
if (core.recognitionEngineVersion !== source.recognitionEngineVersion) throw new Error("Core and Source results use different engine versions.");
if (!core.baselineComparison || !Array.isArray(core.baselineComparison.metrics)) {
  throw new Error("Core result must contain a completed baseline comparison.");
}
if (core.baselineComparison.metrics.some((metric) => metric.status === "regression")) {
  throw new Error("Core baseline comparison contains regressions.");
}

const expectedOverlayNames = source.fixtures
  .map((fixture) => `${fixture.fixtureId}.svg`)
  .sort((first, second) => first.localeCompare(second));
const actualOverlayNames = (await readdir(sourceOverlaysDirectory))
  .filter((name) => name.endsWith(".svg"))
  .sort((first, second) => first.localeCompare(second));
if (actualOverlayNames.join("\n") !== expectedOverlayNames.join("\n")) {
  throw new Error(`Source overlay set mismatch. Expected ${expectedOverlayNames.join(", ")}; received ${actualOverlayNames.join(", ")}.`);
}

const overlayFiles = expectedOverlayNames.map((name) => `overlays/${name}`);
const evidence = {
  schemaVersion: "recognition-benchmark-evidence-v1",
  commitSha: core.commitSha.toLowerCase(),
  corpusVersion: core.corpusVersion,
  recognitionEngineVersion: core.recognitionEngineVersion,
  fixtureCount: core.aggregate.fixtureCount,
  overlayFiles,
  core: {
    aggregate: core.aggregate,
    baselineComparison: core.baselineComparison,
  },
  source: {
    aggregate: source.aggregate,
  },
};

await mkdir(outputDirectory, { recursive: true });
const overlaysOutputDirectory = join(outputDirectory, "overlays");
await mkdir(overlaysOutputDirectory, { recursive: true });
const copiedCorePath = join(outputDirectory, "recognition-core-result.json");
const copiedSourcePath = join(outputDirectory, "recognition-source-result.json");
const evidencePath = join(outputDirectory, "recognition-benchmark-evidence.json");
const summaryPath = join(outputDirectory, "recognition-benchmark-summary.md");
await copyFile(corePath, copiedCorePath);
await copyFile(sourcePath, copiedSourcePath);
for (const name of expectedOverlayNames) {
  await copyFile(join(sourceOverlaysDirectory, name), join(overlaysOutputDirectory, name));
}
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(summaryPath, renderSummary(evidence), "utf8");

const checksumTargets = [
  { path: copiedCorePath, relativePath: basename(copiedCorePath) },
  { path: copiedSourcePath, relativePath: basename(copiedSourcePath) },
  { path: evidencePath, relativePath: basename(evidencePath) },
  { path: summaryPath, relativePath: basename(summaryPath) },
  ...expectedOverlayNames.map((name) => ({
    path: join(overlaysOutputDirectory, name),
    relativePath: `overlays/${name}`,
  })),
];
const checksumLines = [];
for (const target of checksumTargets) checksumLines.push(`${await digest(target.path)}  ${target.relativePath}`);
await writeFile(join(outputDirectory, "SHA256SUMS"), `${checksumLines.sort().join("\n")}\n`, "utf8");
