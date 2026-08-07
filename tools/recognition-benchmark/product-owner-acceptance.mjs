import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePrivateSourceManifest } from "../../packages/recognition/benchmarks/real-analogues/schema.mjs";

const REVIEW_SCHEMA = "recognition-product-owner-review-v1";
const VERDICT_SCHEMA = "recognition-product-owner-acceptance-v1";
const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REVIEW_STATUSES = new Set(["pass", "fail", "not-reviewed"]);
const SUBMISSION_STATUSES = new Set(["pass", "fail"]);
const DECISIONS = new Set(["accept", "reject", "pending"]);
const SUBMISSION_DECISIONS = new Set(["accept", "reject"]);
const REVIEW_KEYS = new Set([
  "schemaVersion",
  "commitSha",
  "batchId",
  "sourceId",
  "sourceSha256",
  "reviewedAt",
  "cases",
  "decision",
]);
const CASE_KEYS = new Set(["id", "status"]);

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../..");
const DEFAULT_MANIFEST_PATH = resolve(
  repositoryRoot,
  "packages/recognition/benchmarks/real-analogues/private-source-manifest.json",
);

export const PRODUCT_OWNER_ACCEPTANCE_CASES = Object.freeze([
  Object.freeze({
    id: "missed-true-door-recovered",
    label: "Previously missed true entrance door is recovered",
  }),
  Object.freeze({
    id: "missed-true-window-recovered",
    label: "Previously missed true loggia window is recovered",
  }),
  Object.freeze({
    id: "thin-balcony-wall-recovered",
    label: "Thin balcony/loggia wall is recovered as structural geometry",
  }),
  Object.freeze({
    id: "fixture-symbol-not-wall",
    label: "Kitchen/washbasin fixture symbol does not become a wall",
  }),
  Object.freeze({
    id: "thick-load-bearing-wall-single-axis",
    label: "Thick load-bearing wall is represented by one structural axis",
  }),
  Object.freeze({
    id: "plan-orientation-preserved",
    label: "Plan orientation is preserved without unintended rotation",
  }),
]);

const SUBMISSION_ENVIRONMENT = Object.freeze({
  "missed-true-door-recovered": "OWNER_REVIEW_MISSED_TRUE_DOOR_RECOVERED",
  "missed-true-window-recovered": "OWNER_REVIEW_MISSED_TRUE_WINDOW_RECOVERED",
  "thin-balcony-wall-recovered": "OWNER_REVIEW_THIN_BALCONY_WALL_RECOVERED",
  "fixture-symbol-not-wall": "OWNER_REVIEW_FIXTURE_SYMBOL_NOT_WALL",
  "thick-load-bearing-wall-single-axis": "OWNER_REVIEW_THICK_LOAD_BEARING_WALL_SINGLE_AXIS",
  "plan-orientation-preserved": "OWNER_REVIEW_PLAN_ORIENTATION_PRESERVED",
});

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function assertExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported field '${key}'.`);
  }
}

function commitSha(value, label = "commitSha") {
  if (typeof value !== "string" || !SHA_PATTERN.test(value)) {
    throw new Error(`${label} must be a 40-character Git commit SHA.`);
  }
  return value.toLowerCase();
}

function sourceSha(value) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error("source SHA must be a lowercase 64-character SHA-256 digest.");
  }
  return value;
}

function registeredCurrentRegressionSource(manifestInput) {
  const validation = validatePrivateSourceManifest(manifestInput);
  if (!validation.valid) {
    throw new Error(`Private source manifest is invalid: ${validation.errors.join("; ")}`);
  }
  const manifest = record(manifestInput, "Private source manifest");
  const sources = manifest.sources;
  const current = sources.filter((source) => Array.isArray(source.tags) && source.tags.includes("current-regression"));
  if (current.length !== 1) {
    throw new Error(`Private source manifest must contain exactly one current-regression source; found ${current.length}.`);
  }
  const source = current[0];
  return {
    batchId: manifest.batchId,
    sourceId: source.sourceId,
    sourceSha256: source.sha256,
  };
}

function reviewTimestamp(value, decision) {
  if (value === null) {
    if (decision !== "pending") throw new Error("reviewedAt is required for an explicit owner decision.");
    return null;
  }
  if (typeof value !== "string") throw new Error("reviewedAt must be an ISO-8601 timestamp or null.");
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error("reviewedAt must be a canonical ISO-8601 timestamp.");
  }
  return value;
}

function normalizedCases(value) {
  if (!Array.isArray(value)) throw new Error("cases must be an array.");
  const requiredIds = PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => id);
  const requiredSet = new Set(requiredIds);
  const seen = new Set();
  const byId = new Map();

  for (const [index, rawCase] of value.entries()) {
    const item = record(rawCase, `cases[${index}]`);
    assertExactKeys(item, CASE_KEYS, `cases[${index}]`);
    if (typeof item.id !== "string" || !requiredSet.has(item.id)) {
      throw new Error(`cases[${index}].id is not a required acceptance case.`);
    }
    if (seen.has(item.id)) throw new Error(`Duplicate case '${item.id}'.`);
    seen.add(item.id);
    if (typeof item.status !== "string" || !REVIEW_STATUSES.has(item.status)) {
      throw new Error(`cases[${index}].status must be pass, fail or not-reviewed.`);
    }
    byId.set(item.id, item.status);
  }

  if (seen.size !== requiredIds.length || requiredIds.some((id) => !seen.has(id))) {
    throw new Error("Review must contain the exact required case set.");
  }

  return PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id, label }) => ({
    id,
    label,
    status: byId.get(id),
  }));
}

function decision(value) {
  if (typeof value !== "string" || !DECISIONS.has(value)) {
    throw new Error("decision must be accept, reject or pending.");
  }
  return value;
}

export function createProductOwnerAcceptanceTemplate({ commitSha: inputCommitSha, manifest }) {
  const source = registeredCurrentRegressionSource(manifest);
  return {
    schemaVersion: REVIEW_SCHEMA,
    commitSha: commitSha(inputCommitSha),
    batchId: source.batchId,
    sourceId: source.sourceId,
    sourceSha256: source.sourceSha256,
    reviewedAt: null,
    cases: PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => ({ id, status: "not-reviewed" })),
    decision: "pending",
  };
}

export function createProductOwnerReviewSubmission({
  commitSha: inputCommitSha,
  manifest,
  reviewedAt,
  decision: inputDecision,
  statuses,
}) {
  const source = registeredCurrentRegressionSource(manifest);
  const requiredIds = PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => id);
  const requiredSet = new Set(requiredIds);
  const statusRecord = record(statuses, "Product-owner submission statuses");
  const providedKeys = Object.keys(statusRecord);
  if (
    providedKeys.length !== requiredIds.length
    || providedKeys.some((key) => !requiredSet.has(key))
    || requiredIds.some((id) => !Object.hasOwn(statusRecord, id))
  ) {
    throw new Error("Product-owner submission must contain the exact required status set.");
  }
  const ownerDecision = typeof inputDecision === "string" ? inputDecision : "";
  if (!SUBMISSION_DECISIONS.has(ownerDecision)) {
    throw new Error("Product-owner submission decision must be accept or reject.");
  }
  const normalizedTimestamp = reviewTimestamp(reviewedAt, ownerDecision);
  const cases = PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => {
    const status = statusRecord[id];
    if (typeof status !== "string" || !SUBMISSION_STATUSES.has(status)) {
      throw new Error(`Product-owner submission status '${id}' must be pass or fail.`);
    }
    return { id, status };
  });
  return {
    schemaVersion: REVIEW_SCHEMA,
    commitSha: commitSha(inputCommitSha),
    batchId: source.batchId,
    sourceId: source.sourceId,
    sourceSha256: source.sourceSha256,
    reviewedAt: normalizedTimestamp,
    cases,
    decision: ownerDecision,
  };
}

export function evaluateProductOwnerAcceptance(input, { expectedCommitSha, manifest }) {
  const source = registeredCurrentRegressionSource(manifest);
  const review = record(input, "Product-owner review");
  assertExactKeys(review, REVIEW_KEYS, "Product-owner review");
  if (review.schemaVersion !== REVIEW_SCHEMA) throw new Error(`Product-owner review must use ${REVIEW_SCHEMA}.`);

  const reviewCommitSha = commitSha(review.commitSha, "review commitSha");
  const expectedHead = commitSha(expectedCommitSha, "expectedCommitSha");
  if (review.batchId !== source.batchId) throw new Error("Review batchId does not match the registered private source manifest.");
  if (review.sourceId !== source.sourceId) throw new Error("Review sourceId does not match the registered current-regression source.");
  const reviewSourceSha = sourceSha(review.sourceSha256);
  if (reviewSourceSha !== source.sourceSha256) throw new Error("Review source SHA does not match the registered private source digest.");

  const ownerDecision = decision(review.decision);
  const normalizedReviewedAt = reviewTimestamp(review.reviewedAt, ownerDecision);
  const cases = normalizedCases(review.cases);
  const blockers = [];
  const exactHead = reviewCommitSha === expectedHead;
  if (!exactHead) blockers.push("Review was not performed on the exact head required for acceptance.");

  const failed = cases.filter((item) => item.status === "fail");
  const pending = cases.filter((item) => item.status === "not-reviewed");
  if (failed.length > 0) blockers.push(`Required product-owner cases failed: ${failed.map(({ id }) => id).join(", ")}.`);
  if (pending.length > 0) blockers.push(`Required product-owner cases are not reviewed: ${pending.map(({ id }) => id).join(", ")}.`);
  if (ownerDecision !== "accept") blockers.push("Explicit owner decision must be accept before this gate can pass.");

  const allRequiredCasesPassed = cases.every((item) => item.status === "pass");
  return {
    schemaVersion: VERDICT_SCHEMA,
    reviewSchemaVersion: REVIEW_SCHEMA,
    commitSha: reviewCommitSha,
    expectedCommitSha: expectedHead,
    batchId: source.batchId,
    sourceId: source.sourceId,
    sourceSha256: source.sourceSha256,
    reviewedAt: normalizedReviewedAt,
    accepted: exactHead && allRequiredCasesPassed && ownerDecision === "accept" && blockers.length === 0,
    exactHead,
    sourceIdentityMatched: true,
    allRequiredCasesPassed,
    explicitOwnerDecision: ownerDecision,
    blockers,
    cases,
  };
}

function markdownText(value) {
  return String(value ?? "—")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/`/g, "'")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim();
}

export function renderProductOwnerAcceptanceMarkdown(input) {
  const verdict = record(input, "Product-owner acceptance verdict");
  if (verdict.schemaVersion !== VERDICT_SCHEMA) {
    throw new Error(`Product-owner acceptance verdict must use ${VERDICT_SCHEMA}.`);
  }
  const cases = Array.isArray(verdict.cases) ? verdict.cases : [];
  const lines = [
    "# Vlezet product-owner recognition acceptance",
    "",
    `- Status: **${verdict.accepted === true ? "ACCEPTED" : "BLOCKED"}**`,
    `- Exact commit: \`${markdownText(verdict.commitSha)}\``,
    `- Registered source: \`${markdownText(verdict.sourceId)}\``,
    `- Source digest: \`${markdownText(verdict.sourceSha256)}\``,
    `- Reviewed at: ${markdownText(verdict.reviewedAt)}`,
    `- Explicit owner decision: **${markdownText(verdict.explicitOwnerDecision)}**`,
    "",
    "| Required check | Result |",
    "| --- | --- |",
  ];
  for (const rawCase of cases) {
    const item = record(rawCase, "Product-owner acceptance case");
    lines.push(`| ${markdownText(item.label)} | ${markdownText(item.status).toUpperCase()} |`);
  }
  if (Array.isArray(verdict.blockers) && verdict.blockers.length > 0) {
    lines.push("", "## Blockers", "");
    for (const blocker of verdict.blockers) lines.push(`- ${markdownText(blocker)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function markdownPathFor(outputPath) {
  return /\.json$/i.test(outputPath) ? outputPath.replace(/\.json$/i, ".md") : `${outputPath}.md`;
}

async function loadManifest(path) {
  return JSON.parse(await readFile(resolve(path ?? DEFAULT_MANIFEST_PATH), "utf8"));
}

function submissionStatusesFromEnvironment(environment = process.env) {
  return Object.fromEntries(PRODUCT_OWNER_ACCEPTANCE_CASES.map(({ id }) => [
    id,
    environment[SUBMISSION_ENVIRONMENT[id]],
  ]));
}

export async function runProductOwnerAcceptanceCli(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  if (command === "template") {
    const [head, outputPathValue, manifestPath] = rest;
    if (!head || !outputPathValue) {
      throw new Error("Usage: product-owner-acceptance.mjs template <commit-sha> <output.json> [manifest.json]");
    }
    const manifest = await loadManifest(manifestPath);
    const template = createProductOwnerAcceptanceTemplate({ commitSha: head, manifest });
    const outputPath = resolve(outputPathValue);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
    return;
  }

  if (command === "submit") {
    const [head, ownerDecision, outputPathValue, manifestPath] = rest;
    if (!head || !ownerDecision || !outputPathValue) {
      throw new Error("Usage: product-owner-acceptance.mjs submit <commit-sha> <accept|reject> <output.json> [manifest.json]");
    }
    const manifest = await loadManifest(manifestPath);
    const submission = createProductOwnerReviewSubmission({
      commitSha: head,
      manifest,
      reviewedAt: process.env.OWNER_REVIEWED_AT ?? new Date().toISOString(),
      decision: ownerDecision,
      statuses: submissionStatusesFromEnvironment(),
    });
    const outputPath = resolve(outputPathValue);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(submission, null, 2)}\n`, "utf8");
    return;
  }

  if (command === "evaluate") {
    const [inputPathValue, expectedHead, outputPathValue, manifestPath] = rest;
    if (!inputPathValue || !expectedHead || !outputPathValue) {
      throw new Error("Usage: product-owner-acceptance.mjs evaluate <review.json> <expected-commit-sha> <verdict.json> [manifest.json]");
    }
    const manifest = await loadManifest(manifestPath);
    const review = JSON.parse(await readFile(resolve(inputPathValue), "utf8"));
    const verdict = evaluateProductOwnerAcceptance(review, { expectedCommitSha: expectedHead, manifest });
    const outputPath = resolve(outputPathValue);
    const markdownPath = markdownPathFor(outputPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await Promise.all([
      writeFile(outputPath, `${JSON.stringify(verdict, null, 2)}\n`, "utf8"),
      writeFile(markdownPath, renderProductOwnerAcceptanceMarkdown(verdict), "utf8"),
    ]);
    return;
  }

  throw new Error("First argument must be template, submit or evaluate.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runProductOwnerAcceptanceCli().catch((cause) => {
    process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    process.exitCode = 1;
  });
}
