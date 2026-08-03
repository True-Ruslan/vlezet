const PRIVATE_SOURCE_SCHEMA_VERSION = "recognition-private-source-manifest-v1";
const PRIVATE_SOURCE_BATCH_ID = "product-owner-real-plans-2026-08-04";
const SOURCE_ID_PATTERN = /^real-plan-\d{3}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png"]);

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
