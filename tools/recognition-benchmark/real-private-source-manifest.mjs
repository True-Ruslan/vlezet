import { readFile } from "node:fs/promises";

const DEFAULT_MANIFEST_URL = new URL(
  "../../packages/recognition/benchmarks/real-analogues/private-source-manifest.json",
  import.meta.url,
);

const EXPECTED_SCHEMA = "recognition-private-source-manifest-v1";
const EXPECTED_BATCH = "product-owner-real-plans-2026-08-04";
const EXPECTED_SOURCE_IDS = Array.from({ length: 12 }, (_, index) =>
  `real-plan-${String(index + 1).padStart(3, "0")}`);
const ALLOWED_TOP_LEVEL_FIELDS = new Set(["schemaVersion", "batchId", "sources"]);
const ALLOWED_SOURCE_FIELDS = new Set([
  "sourceId",
  "sha256",
  "widthPx",
  "heightPx",
  "mediaType",
  "tags",
  "annotationStatus",
  "redistribution",
]);
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_ANNOTATION_STATES = new Set([
  "registered",
  "analogue-in-progress",
  "analogue-reviewed",
]);
const SECRET_PATTERN = /(?:sk-or-v1-[a-z0-9_-]+|bearer\s+[a-z0-9._~-]+)/i;
const URL_PATTERN = /https?:\/\//i;
const ABSOLUTE_PATH_PATTERN = /(?:^|\s)(?:\/[A-Za-z0-9._-]+|[A-Za-z]:\\)/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inspectUnexpectedFields(value, allowed, location, errors) {
  if (!isPlainObject(value)) return;
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) errors.push(`${location}: unexpected field ${field}`);
  }
}

function inspectStringSafety(value, location, errors) {
  if (typeof value === "string") {
    if (SECRET_PATTERN.test(value)) errors.push(`${location}: secret-like value is forbidden`);
    if (URL_PATTERN.test(value)) errors.push(`${location}: URL values are forbidden`);
    if (ABSOLUTE_PATH_PATTERN.test(value)) errors.push(`${location}: absolute paths are forbidden`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectStringSafety(item, `${location}[${index}]`, errors));
    return;
  }
  if (isPlainObject(value)) {
    for (const [field, item] of Object.entries(value)) {
      inspectStringSafety(item, `${location}.${field}`, errors);
    }
  }
}

function validateSource(source, index, errors) {
  const location = `sources[${index}]`;
  if (!isPlainObject(source)) {
    errors.push(`${location}: source must be an object`);
    return;
  }
  inspectUnexpectedFields(source, ALLOWED_SOURCE_FIELDS, location, errors);
  if (!/^real-plan-(00[1-9]|01[0-2])$/.test(source.sourceId ?? "")) {
    errors.push(`${location}.sourceId: expected real-plan-001..real-plan-012`);
  }
  if (!/^[a-f0-9]{64}$/.test(source.sha256 ?? "")) {
    errors.push(`${location}.sha256: expected canonical lowercase SHA-256`);
  }
  if (!Number.isInteger(source.widthPx) || source.widthPx < 1 || source.widthPx > 4096) {
    errors.push(`${location}.widthPx: expected integer in range 1..4096`);
  }
  if (!Number.isInteger(source.heightPx) || source.heightPx < 1 || source.heightPx > 4096) {
    errors.push(`${location}.heightPx: expected integer in range 1..4096`);
  }
  if (!ALLOWED_MEDIA_TYPES.has(source.mediaType)) {
    errors.push(`${location}.mediaType: expected image/jpeg or image/png`);
  }
  if (!Array.isArray(source.tags) || source.tags.length === 0) {
    errors.push(`${location}.tags: expected a non-empty array`);
  } else {
    const tags = new Set();
    for (const tag of source.tags) {
      if (typeof tag !== "string" || !/^[a-z0-9-]+$/.test(tag)) {
        errors.push(`${location}.tags: invalid tag ${JSON.stringify(tag)}`);
      } else if (tags.has(tag)) {
        errors.push(`${location}.tags: duplicate tag ${tag}`);
      }
      tags.add(tag);
    }
  }
  if (!ALLOWED_ANNOTATION_STATES.has(source.annotationStatus)) {
    errors.push(`${location}.annotationStatus: unsupported state`);
  }
  if (source.redistribution !== "not-committed") {
    errors.push(`${location}.redistribution: must be not-committed`);
  }
  inspectStringSafety(source, location, errors);
}

export function validatePrivateSourceManifest(manifest) {
  const errors = [];
  if (!isPlainObject(manifest)) return ["manifest: expected an object"];
  inspectUnexpectedFields(manifest, ALLOWED_TOP_LEVEL_FIELDS, "manifest", errors);
  if (manifest.schemaVersion !== EXPECTED_SCHEMA) {
    errors.push(`schemaVersion: expected ${EXPECTED_SCHEMA}`);
  }
  if (manifest.batchId !== EXPECTED_BATCH) {
    errors.push(`batchId: expected ${EXPECTED_BATCH}`);
  }
  if (!Array.isArray(manifest.sources)) {
    errors.push("sources: expected an array");
    return errors;
  }
  if (manifest.sources.length !== EXPECTED_SOURCE_IDS.length) {
    errors.push(`sources: expected exactly ${EXPECTED_SOURCE_IDS.length} entries`);
  }

  manifest.sources.forEach((source, index) => validateSource(source, index, errors));

  const sourceIds = new Set();
  const digests = new Set();
  for (const source of manifest.sources) {
    if (!isPlainObject(source)) continue;
    if (sourceIds.has(source.sourceId)) errors.push(`duplicate sourceId: ${source.sourceId}`);
    if (digests.has(source.sha256)) errors.push(`duplicate sha256: ${source.sha256}`);
    sourceIds.add(source.sourceId);
    digests.add(source.sha256);
  }

  const actualIds = manifest.sources.map((source) => source?.sourceId);
  if (JSON.stringify(actualIds) !== JSON.stringify(EXPECTED_SOURCE_IDS)) {
    errors.push("sources: entries must be in canonical real-plan-001..real-plan-012 order");
  }
  inspectStringSafety(manifest, "manifest", errors);
  return [...new Set(errors)];
}

export async function loadPrivateSourceManifest(manifestUrl = DEFAULT_MANIFEST_URL) {
  const text = await readFile(manifestUrl, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (cause) {
    throw new Error(`Invalid private source manifest JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  const errors = validatePrivateSourceManifest(manifest);
  if (errors.length > 0) {
    throw new Error(`Invalid private source manifest:\n- ${errors.join("\n- ")}`);
  }
  return manifest;
}

async function main() {
  const manifest = await loadPrivateSourceManifest();
  process.stdout.write(`Verified ${manifest.sources.length} private source records (${manifest.batchId}).\n`);
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  await main();
}
