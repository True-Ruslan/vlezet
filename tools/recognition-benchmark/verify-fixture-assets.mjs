import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureSourceDefinitions, fixtureSourceIds } from "../../packages/recognition/benchmarks/fixtures/source-definitions.mjs";
import { manualFixtureDefinitions, manualFixtureIds } from "../../packages/recognition/benchmarks/fixtures/manual-fixtures.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const fixturesRoot = join(repositoryRoot, "packages/recognition/benchmarks/fixtures");
const fixtureDefinitions = [...fixtureSourceDefinitions, ...manualFixtureDefinitions];
const fixtureIds = [...fixtureSourceIds, ...manualFixtureIds];
const REQUIRED_BASE_FILES = ["fixture.json", "segments.json", "source.png", "source.sha256"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 2400;
const DISALLOWED_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt"]);
const SENSITIVE_KEY = /address|apartment|phone|email|qr/i;
const SENSITIVE_KEY_ALLOWLIST = new Set(["fileName", "cloudResponseFileName", "name"]);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function parsePng(buffer, fixtureId) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.subarray(0, 8).compare(signature) !== 0) throw new Error(`${fixtureId}: source.png is not a PNG`);
  let offset = 8;
  let width = null;
  let height = null;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (DISALLOWED_METADATA_CHUNKS.has(type)) throw new Error(`${fixtureId}: forbidden PNG metadata chunk ${type}`);
    if (type === "IHDR") {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
    }
    offset += 12 + length;
    if (type === "IEND") break;
  }
  if (!width || !height) throw new Error(`${fixtureId}: PNG has no valid IHDR`);
  return { width, height };
}

function inspectSensitiveKeys(value, path = "root") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectSensitiveKeys(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key) && !SENSITIVE_KEY_ALLOWLIST.has(key)) {
      throw new Error(`${path}.${key}: sensitive metadata key is forbidden`);
    }
    inspectSensitiveKeys(entry, `${path}.${key}`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function verifyFixture(definition) {
  const directory = join(fixturesRoot, definition.id);
  const entries = (await readdir(directory)).sort();
  const required = [...REQUIRED_BASE_FILES, ...(definition.includeCloudSnapshot ? ["cloud-response.json"] : [])].sort();
  if (entries.join("\n") !== required.join("\n")) {
    throw new Error(`${definition.id}: expected files ${required.join(", ")}, found ${entries.join(", ")}`);
  }

  const sourcePath = join(directory, "source.png");
  const source = await readFile(sourcePath);
  const sourceStats = await stat(sourcePath);
  if (sourceStats.size >= MAX_BYTES) throw new Error(`${definition.id}: source.png exceeds 5 MiB`);
  const dimensions = parsePng(source, definition.id);
  if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    throw new Error(`${definition.id}: source dimensions exceed ${MAX_DIMENSION}px`);
  }

  const fixture = await readJson(join(directory, "fixture.json"));
  const segments = await readJson(join(directory, "segments.json"));
  inspectSensitiveKeys(fixture, `${definition.id}.fixture`);
  inspectSensitiveKeys(segments, `${definition.id}.segments`);
  if (fixture.id !== definition.id || fixture.schemaVersion !== "recognition-benchmark-fixture-v1") {
    throw new Error(`${definition.id}: invalid fixture identity/schema`);
  }
  if (fixture.source.fileName !== "source.png") throw new Error(`${definition.id}: source fileName must be source.png`);
  const actualHash = sha256(source);
  const hashFile = (await readFile(join(directory, "source.sha256"), "utf8")).trim();
  if (fixture.source.sha256 !== actualHash || hashFile !== `${actualHash}  source.png`) {
    throw new Error(`${definition.id}: source SHA-256 mismatch`);
  }
  if (fixture.calibration.sourceWidthPx !== dimensions.width || fixture.calibration.sourceHeightPx !== dimensions.height) {
    throw new Error(`${definition.id}: fixture calibration dimensions do not match PNG`);
  }
  if (segments.schemaVersion !== "recognition-segments-v1"
    || segments.widthPx !== dimensions.width
    || segments.heightPx !== dimensions.height
    || !Array.isArray(segments.segments)) {
    throw new Error(`${definition.id}: invalid segments snapshot`);
  }
  for (const segment of segments.segments) {
    if (![segment.x1, segment.y1, segment.x2, segment.y2].every(Number.isFinite)) {
      throw new Error(`${definition.id}: segments snapshot contains non-finite coordinates`);
    }
  }
  if (definition.includeCloudSnapshot) {
    const cloud = await readJson(join(directory, "cloud-response.json"));
    inspectSensitiveKeys(cloud, `${definition.id}.cloud`);
    if (!Array.isArray(cloud.walls) || !Array.isArray(cloud.openings) || !Array.isArray(cloud.roomLabels)) {
      throw new Error(`${definition.id}: invalid cloud snapshot`);
    }
  }
  if (definition.id === "m7-3-regression-anonymized" && fixture.provenance.kind !== "redrawn-anonymized") {
    throw new Error("Regression fixture must declare redrawn-anonymized provenance");
  }
}

async function main() {
  const manifest = await readJson(join(fixturesRoot, "manifest.json"));
  if (manifest.schemaVersion !== "recognition-corpus-manifest-v1" || manifest.corpusVersion !== "recognition-corpus-v1") {
    throw new Error("Invalid corpus manifest version");
  }
  if (JSON.stringify(manifest.fixtureIds) !== JSON.stringify(fixtureIds)) {
    throw new Error("Corpus manifest does not contain the canonical fixture order");
  }
  const directoryIds = (await readdir(fixturesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (JSON.stringify(directoryIds) !== JSON.stringify([...fixtureIds].sort())) {
    throw new Error("Corpus contains missing or extra fixture directories");
  }
  if (fixtureDefinitions.length !== 9 || new Set(fixtureIds).size !== 9) {
    throw new Error("Corpus v1 must contain exactly nine unique fixtures");
  }
  for (const definition of fixtureDefinitions) await verifyFixture(definition);
  process.stdout.write(`Recognition corpus verified: ${fixtureDefinitions.length} fixtures.\n`);
}

await main();
