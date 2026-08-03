import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realAnalogueDefinitions } from "../../packages/recognition/benchmarks/real-analogues/source-definitions.mjs";
import { validateFailureExpectations } from "../../packages/recognition/benchmarks/real-analogues/schema.mjs";
import { sha256 } from "./real-fixture-renderer.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const defaultRoot = join(repositoryRoot, "packages/recognition/benchmarks/real-analogues/fixtures");
const REQUIRED_FILES = Object.freeze([
  "source.png",
  "source.sha256",
  "fixture.json",
  "segments.json",
  "failure-expectations.json",
]);

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (cause) {
    throw new Error(`${label} is not valid JSON`, { cause });
  }
}

async function requireDirectory(path, label) {
  let metadata;
  try {
    metadata = await stat(path);
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT") {
      throw new Error(`${label} does not exist: ${path}`);
    }
    throw cause;
  }
  if (!metadata.isDirectory()) throw new Error(`${label} is not a directory: ${path}`);
}

function parseHashFile(value, fixtureId) {
  const match = /^([a-f0-9]{64})  source\.png\n?$/.exec(value);
  if (!match) throw new Error(`${fixtureId}: source.sha256 has invalid format`);
  return match[1];
}

function assertFixtureShape(fixture, definition, sourceHash) {
  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
    throw new Error(`${definition.id}: fixture.json must be an object`);
  }
  if (fixture.schemaVersion !== "recognition-benchmark-fixture-v1") {
    throw new Error(`${definition.id}: fixture schema mismatch`);
  }
  if (fixture.id !== definition.id) throw new Error(`${definition.id}: fixture ID mismatch`);
  if (fixture.provenance?.kind !== "redrawn-anonymized") {
    throw new Error(`${definition.id}: provenance violation`);
  }
  if (fixture.source?.fileName !== "source.png" || fixture.source?.sha256 !== sourceHash) {
    throw new Error(`${definition.id}: fixture source hash mismatch`);
  }
  if (fixture.calibration?.sourceWidthPx !== definition.sourceWidthPx
    || fixture.calibration?.sourceHeightPx !== definition.sourceHeightPx
    || fixture.calibration?.millimetersPerPixel !== definition.millimetersPerPixel) {
    throw new Error(`${definition.id}: calibration mismatch`);
  }
  if (!Array.isArray(fixture.expectedWalls) || fixture.expectedWalls.length !== definition.walls.length) {
    throw new Error(`${definition.id}: expectedWalls mismatch`);
  }
  if (!Array.isArray(fixture.expectedOpenings) || fixture.expectedOpenings.length !== definition.openings.length) {
    throw new Error(`${definition.id}: expectedOpenings mismatch`);
  }
}

function assertSegmentsShape(segments, definition) {
  if (!segments || typeof segments !== "object" || Array.isArray(segments)) {
    throw new Error(`${definition.id}: segments.json must be an object`);
  }
  if (segments.schemaVersion !== "recognition-segments-v1") {
    throw new Error(`${definition.id}: segments schema mismatch`);
  }
  if (segments.widthPx !== definition.sourceWidthPx || segments.heightPx !== definition.sourceHeightPx) {
    throw new Error(`${definition.id}: segments dimensions mismatch`);
  }
  if (!Array.isArray(segments.segments) || segments.segments.length === 0) {
    throw new Error(`${definition.id}: segments must be non-empty`);
  }
}

async function verifyOne(root, definition) {
  const fixtureDirectory = join(root, definition.id);
  await requireDirectory(fixtureDirectory, `Fixture ${definition.id}`);
  const entries = await readdir(fixtureDirectory, { withFileTypes: true });
  const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  for (const required of REQUIRED_FILES) {
    if (!fileNames.has(required)) throw new Error(`${definition.id}: missing ${required}`);
  }

  const sourceBuffer = await readFile(join(fixtureDirectory, "source.png"));
  const actualHash = sha256(sourceBuffer);
  const hashFile = parseHashFile(await readFile(join(fixtureDirectory, "source.sha256"), "utf8"), definition.id);
  if (hashFile === definition.privateSourceSha256 || actualHash === definition.privateSourceSha256) {
    throw new Error(`${definition.id}: private source digest must never be used by a public fixture`);
  }
  if (actualHash !== hashFile) throw new Error(`${definition.id}: hash mismatch for source.png`);

  const fixture = await readJson(join(fixtureDirectory, "fixture.json"), `${definition.id}: fixture.json`);
  assertFixtureShape(fixture, definition, actualHash);

  const segments = await readJson(join(fixtureDirectory, "segments.json"), `${definition.id}: segments.json`);
  assertSegmentsShape(segments, definition);

  const expectations = await readJson(
    join(fixtureDirectory, "failure-expectations.json"),
    `${definition.id}: failure-expectations.json`,
  );
  const expectationValidation = validateFailureExpectations(expectations, {
    wallIds: new Set(definition.walls.map(({ id }) => id)),
    openingIds: new Set(definition.openings.map(({ id }) => id)),
  });
  if (!expectationValidation.valid) {
    throw new Error(`${definition.id}: failure expectations invalid: ${expectationValidation.errors.join("; ")}`);
  }
}

export async function verifyRealFixtureDirectory({ root, definitions = realAnalogueDefinitions }) {
  await requireDirectory(root, "Real fixture root");
  const expectedIds = definitions.map(({ id }) => id).sort();
  const entries = await readdir(root, { withFileTypes: true });
  const actualIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index])) {
    throw new Error(`Real fixture directory mismatch: expected ${expectedIds.join(", ")}, got ${actualIds.join(", ")}`);
  }

  for (const definition of definitions) await verifyOne(root, definition);
  return {
    fixtureCount: definitions.length,
    hashMismatches: [],
    provenanceViolations: [],
    privateDigestLeaks: [],
    failureExpectationErrors: [],
  };
}

async function runCli() {
  const root = resolve(process.argv[2] ?? defaultRoot);
  const report = await verifyRealFixtureDirectory({ root });
  console.log(`Verified ${report.fixtureCount} immutable real-plan analogue fixtures.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((cause) => {
    console.error(cause instanceof Error ? cause.message : "Real fixture verification failed.");
    process.exitCode = 1;
  });
}
