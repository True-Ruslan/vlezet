const PRIVATE_SOURCE_SCHEMA_VERSION = "recognition-private-source-manifest-v1";
const PRIVATE_SOURCE_BATCH_ID = "product-owner-real-plans-2026-08-04";
const ANALOGUE_MANIFEST_SCHEMA_VERSION = "recognition-real-analogue-manifest-v1";
const ANALOGUE_CORPUS_VERSION = "recognition-real-analogue-corpus-v1";
const FAILURE_EXPECTATIONS_SCHEMA_VERSION = "recognition-failure-expectations-v1";
const SOURCE_ID_PATTERN = /^real-plan-\d{3}$/;
const FIXTURE_ID_PATTERN = /^real-plan-\d{3}-anonymized$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png"]);
const DETECT_KINDS = new Set(["wall", "door", "window", "opening"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSource(source, index, errors, sourceIds, digests) {
  const prefix = `sources[${index}]`;
  if (!isRecord(source)) {
    errors.push(`${prefix} must be an object`);
    return;
  }

  if (typeof source.sourceId !== "string" || !SOURCE_ID_PATTERN.test(source.sourceId)) {
    errors.push(`${prefix}.sourceId must match real-plan-NNN`);
  } else if (sourceIds.has(source.sourceId)) {
    errors.push(`duplicate sourceId: ${source.sourceId}`);
  } else {
    sourceIds.add(source.sourceId);
  }

  if (typeof source.sha256 !== "string" || !SHA256_PATTERN.test(source.sha256)) {
    errors.push(`${prefix}.sha256 must be a lowercase 64-character SHA-256 digest`);
  } else if (digests.has(source.sha256)) {
    errors.push(`duplicate sha256: ${source.sha256}`);
  } else {
    digests.add(source.sha256);
  }

  if (!Number.isInteger(source.widthPx) || source.widthPx <= 0) {
    errors.push(`${prefix}.widthPx must be a positive integer`);
  }
  if (!Number.isInteger(source.heightPx) || source.heightPx <= 0) {
    errors.push(`${prefix}.heightPx must be a positive integer`);
  }
  if (typeof source.mediaType !== "string" || !MEDIA_TYPES.has(source.mediaType)) {
    errors.push(`${prefix}.mediaType must be image/jpeg or image/png`);
  }

  if (!Array.isArray(source.tags) || source.tags.length === 0) {
    errors.push(`${prefix}.tags must be a non-empty array`);
  } else {
    const tags = new Set();
    for (const [tagIndex, tag] of source.tags.entries()) {
      if (typeof tag !== "string" || tag.trim().length === 0) {
        errors.push(`${prefix}.tags[${tagIndex}] must be a non-empty string`);
      } else if (tags.has(tag)) {
        errors.push(`${prefix}.tags contains duplicate tag: ${tag}`);
      } else {
        tags.add(tag);
      }
    }
  }

  if (source.annotationStatus !== "registered") {
    errors.push(`${prefix}.annotationStatus must be registered`);
  }
  if (source.redistribution !== "not-committed") {
    errors.push(`${prefix}.redistribution must be not-committed`);
  }
}

export function validatePrivateSourceManifest(value) {
  const errors = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["manifest must be an object"] };
  }

  if (value.schemaVersion !== PRIVATE_SOURCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PRIVATE_SOURCE_SCHEMA_VERSION}`);
  }
  if (value.batchId !== PRIVATE_SOURCE_BATCH_ID) {
    errors.push(`batchId must be ${PRIVATE_SOURCE_BATCH_ID}`);
  }
  if (!Array.isArray(value.sources)) {
    errors.push("sources must be an array");
    return { valid: false, errors };
  }

  const sourceIds = new Set();
  const digests = new Set();
  for (const [index, source] of value.sources.entries()) {
    validateSource(source, index, errors, sourceIds, digests);
  }

  return { valid: errors.length === 0, errors };
}

export function validateAnalogueManifest(value, privateManifest) {
  const errors = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["analogue manifest must be an object"] };
  }

  const privateValidation = validatePrivateSourceManifest(privateManifest);
  if (!privateValidation.valid) {
    return {
      valid: false,
      errors: privateValidation.errors.map((error) => `private manifest: ${error}`),
    };
  }

  if (value.schemaVersion !== ANALOGUE_MANIFEST_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${ANALOGUE_MANIFEST_SCHEMA_VERSION}`);
  }
  if (value.corpusVersion !== ANALOGUE_CORPUS_VERSION) {
    errors.push(`corpusVersion must be ${ANALOGUE_CORPUS_VERSION}`);
  }
  if (!Array.isArray(value.fixtures)) {
    errors.push("fixtures must be an array");
    return { valid: false, errors };
  }

  const privateById = new Map(privateManifest.sources.map((source) => [source.sourceId, source]));
  const fixtureIds = new Set();
  const mappedSourceIds = new Set();

  for (const [index, fixture] of value.fixtures.entries()) {
    const prefix = `fixtures[${index}]`;
    if (!isRecord(fixture)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    if (typeof fixture.fixtureId !== "string" || !FIXTURE_ID_PATTERN.test(fixture.fixtureId)) {
      errors.push(`${prefix}.fixtureId must match real-plan-NNN-anonymized`);
    } else if (fixtureIds.has(fixture.fixtureId)) {
      errors.push(`duplicate fixtureId: ${fixture.fixtureId}`);
    } else {
      fixtureIds.add(fixture.fixtureId);
    }

    if (typeof fixture.privateSourceId !== "string" || !SOURCE_ID_PATTERN.test(fixture.privateSourceId)) {
      errors.push(`${prefix}.privateSourceId must match real-plan-NNN`);
      continue;
    }
    if (mappedSourceIds.has(fixture.privateSourceId)) {
      errors.push(`duplicate privateSourceId: ${fixture.privateSourceId}`);
    } else {
      mappedSourceIds.add(fixture.privateSourceId);
    }

    const source = privateById.get(fixture.privateSourceId);
    if (!source) {
      errors.push(`unknown privateSourceId: ${fixture.privateSourceId}`);
      continue;
    }

    const expectedFixtureId = `${fixture.privateSourceId}-anonymized`;
    if (fixture.fixtureId !== expectedFixtureId) {
      errors.push(`${prefix}.fixtureId must be ${expectedFixtureId}`);
    }
    if (fixture.privateSourceSha256 !== source.sha256) {
      errors.push(`${prefix}.privateSourceSha256 must match the registered private source digest`);
    }
  }

  for (const source of privateManifest.sources) {
    if (!mappedSourceIds.has(source.sourceId)) {
      errors.push(`missing analogue for ${source.sourceId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function isNormalizedPoint(value) {
  return isRecord(value)
    && typeof value.x === "number"
    && Number.isFinite(value.x)
    && value.x >= 0
    && value.x <= 1
    && typeof value.y === "number"
    && Number.isFinite(value.y)
    && value.y >= 0
    && value.y <= 1;
}

export function validateFailureExpectations(value, geometry) {
  const errors = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["failure expectations must be an object"] };
  }

  if (value.schemaVersion !== FAILURE_EXPECTATIONS_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${FAILURE_EXPECTATIONS_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(value.mustDetect)) errors.push("mustDetect must be an array");
  if (!Array.isArray(value.mustNotDetectRegions)) errors.push("mustNotDetectRegions must be an array");
  if (!Array.isArray(value.knownAmbiguities)) errors.push("knownAmbiguities must be an array");
  if (errors.length > 0) return { valid: false, errors };

  if (value.mustDetect.length + value.mustNotDetectRegions.length === 0) {
    errors.push("at least one mustDetect or mustNotDetectRegions expectation is required");
  }

  const expectationIds = new Set();
  for (const [index, expectation] of value.mustDetect.entries()) {
    const prefix = `mustDetect[${index}]`;
    if (!isRecord(expectation)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof expectation.id !== "string" || expectation.id.trim().length === 0) {
      errors.push(`${prefix}.id must be a non-empty string`);
      continue;
    }
    if (expectationIds.has(expectation.id)) {
      errors.push(`duplicate expectation ID: ${expectation.id}`);
    } else {
      expectationIds.add(expectation.id);
    }
    if (typeof expectation.kind !== "string" || !DETECT_KINDS.has(expectation.kind)) {
      errors.push(`${prefix}.kind must be wall, door, window or opening`);
      continue;
    }

    const known = expectation.kind === "wall"
      ? geometry.wallIds.has(expectation.id)
      : geometry.openingIds.has(expectation.id);
    if (!known) errors.push(`unknown ${expectation.kind} must-detect ID: ${expectation.id}`);
  }

  const regionIds = new Set();
  for (const [index, region] of value.mustNotDetectRegions.entries()) {
    const prefix = `mustNotDetectRegions[${index}]`;
    if (!isRecord(region)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof region.id !== "string" || region.id.trim().length === 0) {
      errors.push(`${prefix}.id must be a non-empty string`);
    } else if (regionIds.has(region.id)) {
      errors.push(`duplicate forbidden region ID: ${region.id}`);
    } else {
      regionIds.add(region.id);
    }
    if (region.kind !== "wall") errors.push(`${prefix}.kind must be wall`);
    if (typeof region.reason !== "string" || region.reason.trim().length === 0) {
      errors.push(`${prefix}.reason must be a non-empty string`);
    }
    if (!Array.isArray(region.polygonNormalized) || region.polygonNormalized.length < 4) {
      errors.push(`${prefix}.polygonNormalized must contain at least four points`);
    } else {
      for (const [pointIndex, point] of region.polygonNormalized.entries()) {
        if (!isNormalizedPoint(point)) {
          errors.push(`${prefix}.polygonNormalized[${pointIndex}] must use coordinates in 0..1`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
