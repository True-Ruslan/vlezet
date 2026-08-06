import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPORT_SCHEMA = 'recognition-ai-benchmark-report-v1';
const OUTPUT_SCHEMA = 'recognition-ai-proposal-qualification-v1';
const MODE = 'proposal-discovery-stage1';
const MIN_REPETITIONS = 3;
const SAFETY = [
  ['eligibleUnknownHostOpeningCount', 'eligible unknown-host openings'],
  ['eligibleOutsideHostOpeningCount', 'eligible outside-host openings'],
  ['directLocalMutationCount', 'direct local mutations'],
  ['staleDecisionCount', 'stale proposal decisions'],
  ['protectedStrongWallAdvisoryCount', 'protected strong-wall advisories'],
  ['forbiddenRegionEligibleProposalCount', 'forbidden-region eligible proposals'],
  ['replayMismatchCount', 'replay mismatches'],
];

function obj(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function count(value, label) {
  const result = value ?? 0;
  if (!Number.isInteger(result) || result < 0) throw new Error(`${label} must be a non-negative integer.`);
  return result;
}
function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
  return value;
}
function round(value) { return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000; }
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? round(sorted[middle]) : round((sorted[middle - 1] + sorted[middle]) / 2);
}
function strings(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be a string array.`);
  }
  const result = value.map((entry) => entry.trim()).filter(Boolean);
  if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`);
  return result.sort();
}
function nullableId(value, label) { return value === null ? null : text(value, label); }
function geometry(value, label) {
  if (value === null) return null;
  const input = obj(value, label);
  const center = obj(input.center, `${label}.center`);
  const x = finite(center.x, `${label}.center.x`);
  const y = finite(center.y, `${label}.center.y`);
  const width = finite(input.widthNormalized, `${label}.widthNormalized`);
  const angle = finite(input.orientationDeg, `${label}.orientationDeg`);
  if (input.kind !== 'opening' || x > 1 || y > 1 || width <= 0 || width > 1 || angle >= 180) {
    throw new Error(`${label} contains out-of-range normalized geometry.`);
  }
  return { kind: 'opening', center: { x: round(x), y: round(y) }, widthNormalized: round(width), orientationDeg: round(angle) };
}
function proposal(value, index) {
  const input = obj(value, `sanitizedProposals[${index}]`);
  const kind = text(input.kind, `sanitizedProposals[${index}].kind`);
  const state = text(input.state, `sanitizedProposals[${index}].state`);
  const confidence = text(input.deterministicConfidence, `sanitizedProposals[${index}].deterministicConfidence`);
  if (!['door', 'window', 'local-wall-review'].includes(kind)) throw new Error(`sanitizedProposals[${index}].kind is unsupported.`);
  if (!['eligible', 'blocked', 'duplicate'].includes(state)) throw new Error(`sanitizedProposals[${index}].state is unsupported.`);
  if (!['medium', 'low'].includes(confidence)) throw new Error(`sanitizedProposals[${index}] cannot have deterministic high confidence.`);
  return {
    kind,
    state,
    targetLocalCandidateId: nullableId(input.targetLocalCandidateId, `sanitizedProposals[${index}].targetLocalCandidateId`),
    hostWallCandidateId: nullableId(input.hostWallCandidateId, `sanitizedProposals[${index}].hostWallCandidateId`),
    geometry: geometry(input.geometry, `sanitizedProposals[${index}].geometry`),
    deterministicConfidence: confidence,
    providerReasons: strings(input.providerReasons, `sanitizedProposals[${index}].providerReasons`),
    validatorReasons: strings(input.validatorReasons, `sanitizedProposals[${index}].validatorReasons`),
  };
}
function proposals(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map(proposal).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function usage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { promptTokens, completionTokens, totalTokens, costUsd } = value;
  if (!Number.isInteger(promptTokens) || promptTokens < 0
    || !Number.isInteger(completionTokens) || completionTokens < 0
    || !Number.isInteger(totalTokens) || totalTokens < promptTokens + completionTokens
    || typeof costUsd !== 'number' || !Number.isFinite(costUsd) || costUsd < 0) return null;
  return { promptTokens, completionTokens, totalTokens, costUsd: round(costUsd) };
}
function route(value, modelId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const result = {
      providerId: text(value.providerId, 'providerRoute.providerId'),
      requestedModelId: text(value.requestedModelId, 'providerRoute.requestedModelId'),
      resolvedModelId: text(value.resolvedModelId, 'providerRoute.resolvedModelId'),
      fallbacksAllowed: value.fallbacksAllowed,
      reasoningDisabled: value.reasoningDisabled,
    };
    return result.requestedModelId === modelId && result.fallbacksAllowed === false && result.reasoningDisabled === true
      ? result : null;
  } catch { return null; }
}
function evaluation(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {
    doorTp: count(value.recoveredDoorTruePositiveCount, `${label}.recoveredDoorTruePositiveCount`),
    doorFp: count(value.recoveredDoorFalsePositiveCount, `${label}.recoveredDoorFalsePositiveCount`),
    doorFn: count(value.recoveredDoorFalseNegativeCount, `${label}.recoveredDoorFalseNegativeCount`),
    windowTp: count(value.recoveredWindowTruePositiveCount, `${label}.recoveredWindowTruePositiveCount`),
    windowFp: count(value.recoveredWindowFalsePositiveCount, `${label}.recoveredWindowFalsePositiveCount`),
    windowFn: count(value.recoveredWindowFalseNegativeCount, `${label}.recoveredWindowFalseNegativeCount`),
    washbasin: count(value.eligibleWashbasinAdvisoryCount, `${label}.eligibleWashbasinAdvisoryCount`),
    accepted: count(value.sanitizerAcceptedCount, `${label}.sanitizerAcceptedCount`),
    truePositive: count(value.sanitizerTruePositiveCount, `${label}.sanitizerTruePositiveCount`),
    replayCount: count(value.replayCount, `${label}.replayCount`),
    safety: {},
    proposals: proposals(value.sanitizedProposals, `${label}.sanitizedProposals`),
  };
  for (const [field] of SAFETY) result.safety[field] = count(value[field], `${label}.${field}`);
  return result;
}
function key(modelId, fixtureId) { return `${modelId}\u0000${fixtureId}`; }
function block(list, message) { if (!list.includes(message)) list.push(message); }

export function evaluateLiveProposalQualification(input) {
  const report = obj(input, 'AI benchmark report');
  if (report.schemaVersion !== REPORT_SCHEMA) throw new Error(`AI benchmark report must use ${REPORT_SCHEMA}.`);
  const config = obj(report.config, 'AI benchmark report config');
  if (config.mode !== MODE) throw new Error(`AI benchmark report mode must be ${MODE}.`);
  const modelIds = strings(config.modelIds, 'config.modelIds');
  const fixtureIds = strings(config.fixtureIds, 'config.fixtureIds');
  if (!modelIds.length || !fixtureIds.length) throw new Error('AI benchmark report must contain models and fixtures.');
  const repetitions = count(config.repetitions, 'config.repetitions');
  if (!repetitions) throw new Error('config.repetitions must be positive.');
  const maximumCostUsd = finite(config.maximumCostUsd, 'config.maximumCostUsd');
  if (!Array.isArray(report.runs)) throw new Error('AI benchmark report runs must be an array.');

  const groups = new Map();
  const knownModels = new Set(modelIds);
  const knownFixtures = new Set(fixtureIds);
  let reportCost = 0;
  let completeReportCost = true;
  report.runs.forEach((raw, index) => {
    const run = obj(raw, `runs[${index}]`);
    const modelId = text(run.modelId, `runs[${index}].modelId`);
    const fixtureId = text(run.fixtureId, `runs[${index}].fixtureId`);
    if (!knownModels.has(modelId)) throw new Error(`runs[${index}] references unexpected model '${modelId}'.`);
    if (!knownFixtures.has(fixtureId)) throw new Error(`runs[${index}] references unexpected fixture '${fixtureId}'.`);
    const repetition = count(run.repetition, `runs[${index}].repetition`);
    if (repetition < 1 || repetition > repetitions) throw new Error(`runs[${index}].repetition is outside 1..${repetitions}.`);
    const group = groups.get(key(modelId, fixtureId)) ?? new Map();
    if (group.has(repetition)) throw new Error(`Duplicate repetition ${repetition} for model '${modelId}' and fixture '${fixtureId}'.`);
    const normalizedUsage = usage(run.usage);
    if (normalizedUsage) reportCost += normalizedUsage.costUsd; else completeReportCost = false;
    group.set(repetition, {
      repetition,
      latencyMs: typeof run.latencyMs === 'number' && Number.isFinite(run.latencyMs) && run.latencyMs >= 0 ? run.latencyMs : null,
      usage: normalizedUsage,
      schemaFailure: run.schemaFailure === true,
      safetyViolations: Array.isArray(run.safetyViolations) ? run.safetyViolations.filter((item) => typeof item === 'string' && item.trim()) : ['malformed-safety-violations'],
      error: run.error == null ? null : String(run.error),
      route: route(run.proposalEvaluation?.providerRoute, modelId),
      evaluation: evaluation(run.proposalEvaluation, `runs[${index}].proposalEvaluation`),
    });
    groups.set(key(modelId, fixtureId), group);
  });

  const totalCostUsd = completeReportCost ? round(reportCost) : null;
  const budgetWithinLimit = totalCostUsd !== null && totalCostUsd <= maximumCostUsd + Number.EPSILON;
  const models = modelIds.map((modelId) => {
    const blockers = [];
    const routes = new Map();
    const safety = Object.fromEntries(SAFETY.map(([field]) => [field, 0]));
    const totals = { doorTp: 0, doorFp: 0, doorFn: 0, windowTp: 0, windowFp: 0, windowFn: 0, washbasin: 0, accepted: 0, truePositive: 0 };
    const latencies = [];
    let completeFixtures = 0;
    let stableFixtures = 0;
    let runCount = 0;
    let modelCost = 0;
    let costComplete = true;
    let promptTokens = 0;
    let completionTokens = 0;
    let tokenCount = 0;
    if (repetitions < MIN_REPETITIONS) block(blockers, `Live proposal qualification requires at least ${MIN_REPETITIONS} repetitions per model and fixture.`);

    fixtureIds.forEach((fixtureId) => {
      const group = groups.get(key(modelId, fixtureId)) ?? new Map();
      const missing = Array.from({ length: repetitions }, (_, i) => i + 1).filter((item) => !group.has(item));
      if (missing.length) { block(blockers, `Fixture '${fixtureId}' is missing repetitions: ${missing.join(', ')}.`); return; }
      completeFixtures += 1;
      const signatures = [];
      [...group.values()].sort((a, b) => a.repetition - b.repetition).forEach((run) => {
        runCount += 1;
        if (run.schemaFailure || run.error !== null) block(blockers, `Fixture '${fixtureId}' contains a schema or provider failure.`);
        if (run.safetyViolations.length) block(blockers, `Fixture '${fixtureId}' contains a provider safety violation.`);
        if (!run.route) block(blockers, `Fixture '${fixtureId}' is missing an explicit safe provider route.`);
        else routes.set(JSON.stringify(run.route), run.route);
        if (!run.usage) { costComplete = false; block(blockers, `Fixture '${fixtureId}' must report complete cost and token usage.`); }
        else {
          modelCost += run.usage.costUsd;
          promptTokens += run.usage.promptTokens;
          completionTokens += run.usage.completionTokens;
          tokenCount += run.usage.totalTokens;
        }
        if (run.latencyMs === null) block(blockers, `Fixture '${fixtureId}' must report finite latency.`); else latencies.push(run.latencyMs);
        if (!run.evaluation) { block(blockers, `Fixture '${fixtureId}' is missing deterministic proposal evaluation.`); return; }
        signatures.push(JSON.stringify(run.evaluation.proposals));
        Object.keys(totals).forEach((field) => { totals[field] += run.evaluation[field]; });
        SAFETY.forEach(([field]) => { safety[field] += run.evaluation.safety[field]; });
        if (run.evaluation.replayCount < 2) block(blockers, `Fixture '${fixtureId}' requires at least two deterministic sanitizer replays per repetition.`);
      });
      if (signatures.length === repetitions && signatures.every((item) => item === signatures[0])) stableFixtures += 1;
      else block(blockers, `Fixture '${fixtureId}' has an unstable sanitized proposal set across repetitions.`);
    });

    SAFETY.forEach(([field, label]) => { if (safety[field]) block(blockers, `${label}: expected 0, got ${safety[field]}.`); });
    if (routes.size !== 1 && runCount) block(blockers, 'Every repetition must use one explicit and stable provider/model route.');
    if (!costComplete) block(blockers, 'Every repetition must report complete cost and token usage.');
    if (!budgetWithinLimit) block(blockers, 'The report exceeds or cannot prove the hard cost budget.');
    if (!totals.doorTp) block(blockers, 'No recovered door true positive was measured.');
    if (!totals.windowTp) block(blockers, 'No recovered window true positive was measured.');
    if (!totals.washbasin) block(blockers, 'No eligible washbasin advisory was measured.');
    const falseCount = totals.doorFp + totals.windowFp;
    const recoveredCount = totals.doorTp + totals.windowTp + falseCount;
    if (falseCount) block(blockers, `Recovered proposal false positives: expected 0, got ${falseCount}.`);
    if (!totals.accepted || totals.truePositive !== totals.accepted) block(blockers, 'Sanitizer acceptance precision must be exactly 1.');

    return {
      modelId,
      eligibleForManualReview: blockers.length === 0,
      blockers: blockers.sort(),
      fixtureCount: fixtureIds.length,
      completeFixtureCount: completeFixtures,
      requiredRepetitions: repetitions,
      runCount,
      stableProposalSetRate: round(stableFixtures / fixtureIds.length),
      falseProposalRate: recoveredCount ? round(falseCount / recoveredCount) : 0,
      recoveredDoorTruePositiveCount: totals.doorTp,
      recoveredDoorFalsePositiveCount: totals.doorFp,
      recoveredDoorFalseNegativeCount: totals.doorFn,
      recoveredWindowTruePositiveCount: totals.windowTp,
      recoveredWindowFalsePositiveCount: totals.windowFp,
      recoveredWindowFalseNegativeCount: totals.windowFn,
      eligibleWashbasinAdvisoryCount: totals.washbasin,
      sanitizerAcceptancePrecision: totals.accepted ? round(totals.truePositive / totals.accepted) : 0,
      safetyCounters: safety,
      medianLatencyMs: median(latencies),
      totalPromptTokens: promptTokens,
      totalCompletionTokens: completionTokens,
      totalTokens: tokenCount,
      totalCostUsd: costComplete ? round(modelCost) : null,
      providerRoute: routes.size === 1 ? [...routes.values()][0] : null,
    };
  });

  return {
    schemaVersion: OUTPUT_SCHEMA,
    sourceReportSchemaVersion: REPORT_SCHEMA,
    commitSha: typeof report.commitSha === 'string' ? report.commitSha : null,
    mode: MODE,
    qualified: false,
    selectedModelId: null,
    manualReviewRequired: true,
    automaticModelSelectionAllowed: false,
    maximumCostUsd: round(maximumCostUsd),
    totalCostUsd,
    budgetWithinLimit,
    models: models.sort((a, b) => a.modelId.localeCompare(b.modelId)),
  };
}

export function canonicalProposalQualificationJson(report) { return `${JSON.stringify(report, null, 2)}\n`; }

const directory = dirname(fileURLToPath(import.meta.url));
async function runCli() {
  const inputPath = resolve(process.argv[2] ?? join(directory, '../artifacts/ai/recognition-ai-benchmark.json'));
  const outputPath = resolve(process.argv[3] ?? join(directory, '../artifacts/ai/recognition-ai-proposal-qualification.json'));
  let report;
  try { report = JSON.parse(await readFile(inputPath, 'utf8')); }
  catch (cause) { throw new Error(`Unable to read AI benchmark report at ${inputPath}.`, { cause }); }
  const result = evaluateLiveProposalQualification(report);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, canonicalProposalQualificationJson(result), 'utf8');
  const eligible = result.models.filter((model) => model.eligibleForManualReview).length;
  process.stdout.write(`Live proposal qualification prepared: ${eligible}/${result.models.length} model(s) eligible for manual review; automatic selection disabled.\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((cause) => { process.stderr.write(`${cause instanceof Error ? cause.message : 'Live proposal qualification failed.'}\n`); process.exitCode = 1; });
}
