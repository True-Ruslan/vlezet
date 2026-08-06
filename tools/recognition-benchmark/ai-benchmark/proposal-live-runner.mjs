import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createAiBenchmarkCostBudget } from "./cost-budget.mjs";
import { buildAiBenchmarkReport, canonicalAiBenchmarkJson } from "./report.mjs";
import { redactAiBenchmarkText } from "./openrouter-client.mjs";

const MODE = "proposal-discovery-stage1";
const MIN_REPETITIONS = 3;
const MAX_PREPARED_FIXTURES = 12;
const MATCH_CENTER_TOLERANCE_PX = 28;

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function text(value, label, maximum = 240) {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const result = value.trim();
  if (!result || result.length > maximum) throw new Error(`${label} must be a non-empty bounded string.`);
  return result;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function finiteNonNegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
  return value;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function canonicalStrings(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  const result = value.map((item) => item.trim()).sort();
  if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`);
  return result;
}

function normalizedPoint(value, label) {
  const input = record(value, label);
  const x = finiteNonNegative(input.x, `${label}.x`);
  const y = finiteNonNegative(input.y, `${label}.y`);
  if (x > 1 || y > 1) throw new Error(`${label} must be normalized.`);
  return { x: round(x), y: round(y) };
}

function normalizedGeometry(value, label) {
  if (value === null) return null;
  const input = record(value, label);
  if (input.kind !== "opening") throw new Error(`${label}.kind must be opening.`);
  const widthNormalized = finiteNonNegative(input.widthNormalized, `${label}.widthNormalized`);
  const orientationDeg = finiteNonNegative(input.orientationDeg, `${label}.orientationDeg`);
  if (widthNormalized <= 0 || widthNormalized > 1 || orientationDeg >= 180) {
    throw new Error(`${label} contains out-of-range geometry.`);
  }
  return {
    kind: "opening",
    center: normalizedPoint(input.center, `${label}.center`),
    widthNormalized: round(widthNormalized),
    orientationDeg: round(orientationDeg),
  };
}

function normalizeSanitizedProposal(value, index) {
  const input = record(value, `sanitized[${index}]`);
  const kind = text(input.kind, `sanitized[${index}].kind`);
  const state = text(input.state, `sanitized[${index}].state`);
  const deterministicConfidence = text(
    input.deterministicConfidence,
    `sanitized[${index}].deterministicConfidence`,
  );
  if (!new Set(["door", "window", "local-wall-review"]).has(kind)) {
    throw new Error(`sanitized[${index}].kind is unsupported.`);
  }
  if (!new Set(["eligible", "blocked", "duplicate"]).has(state)) {
    throw new Error(`sanitized[${index}].state is unsupported.`);
  }
  if (!new Set(["medium", "low"]).has(deterministicConfidence)) {
    throw new Error(`sanitized[${index}] cannot have deterministic high confidence.`);
  }
  const evidence = input.evidence && typeof input.evidence === "object" && !Array.isArray(input.evidence)
    ? input.evidence
    : input;
  return {
    rawProposalId: text(input.rawProposalId, `sanitized[${index}].rawProposalId`, 160),
    kind,
    state,
    targetLocalCandidateId: input.targetLocalCandidateId === null
      ? null
      : text(input.targetLocalCandidateId, `sanitized[${index}].targetLocalCandidateId`, 160),
    hostWallCandidateId: input.hostWallCandidateId === null
      ? null
      : text(input.hostWallCandidateId, `sanitized[${index}].hostWallCandidateId`, 160),
    geometry: normalizedGeometry(input.geometry, `sanitized[${index}].geometry`),
    deterministicConfidence,
    providerReasons: canonicalStrings(evidence.providerReasons ?? [], `sanitized[${index}].providerReasons`),
    validatorReasons: canonicalStrings(evidence.validatorReasons ?? [], `sanitized[${index}].validatorReasons`),
    providerRequestId: text(input.provider?.requestId, `sanitized[${index}].provider.requestId`, 160),
    localDraftFingerprint: text(
      input.localDraftFingerprint,
      `sanitized[${index}].localDraftFingerprint`,
      96,
    ),
  };
}

function proposalSignature(proposal) {
  const { rawProposalId: _raw, providerRequestId: _request, localDraftFingerprint: _fingerprint, ...stable } = proposal;
  return JSON.stringify(stable);
}

function normalizedProposalSet(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  return values.map(normalizeSanitizedProposal).sort((a, b) => proposalSignature(a).localeCompare(proposalSignature(b)));
}

function pointInsideBox(point, value) {
  const box = record(value, "forbidden region");
  const x = finiteNonNegative(box.x, "forbidden region.x");
  const y = finiteNonNegative(box.y, "forbidden region.y");
  const width = finiteNonNegative(box.width, "forbidden region.width");
  const height = finiteNonNegative(box.height, "forbidden region.height");
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

function proposalPoint(proposal, draft) {
  if (proposal.geometry) return proposal.geometry.center;
  if (!proposal.targetLocalCandidateId) return null;
  const wall = draft.walls.find((candidate) => candidate.id === proposal.targetLocalCandidateId);
  return wall ? { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 } : null;
}

function openingOutsideHost(proposal, draft, widthPx, heightPx) {
  if (!proposal.geometry || !proposal.hostWallCandidateId) return true;
  const host = draft.walls.find((candidate) => candidate.id === proposal.hostWallCandidateId);
  if (!host) return true;
  const dx = host.end.x - host.start.x;
  const dy = host.end.y - host.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return true;
  const center = proposal.geometry.center;
  const projection = ((center.x - host.start.x) * dx + (center.y - host.start.y) * dy) / lengthSquared;
  if (projection < 0 || projection > 1) return true;
  const closest = { x: host.start.x + dx * projection, y: host.start.y + dy * projection };
  const distancePx = Math.hypot(
    (center.x - closest.x) * widthPx,
    (center.y - closest.y) * heightPx,
  );
  return distancePx > Math.max(10, (host.estimatedThicknessPx ?? 20) / 2 + 2);
}

function angleDelta(first, second) {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function matchesRejectedOpening(proposal, rejection, draft, widthPx, heightPx) {
  const expected = rejection?.candidate;
  if (!expected || !proposal.geometry || proposal.kind !== expected.kind) return false;
  if (proposal.hostWallCandidateId !== expected.hostWallCandidateId) return false;
  const centerDistancePx = Math.hypot(
    (proposal.geometry.center.x - expected.center.x) * widthPx,
    (proposal.geometry.center.y - expected.center.y) * heightPx,
  );
  if (centerDistancePx > MATCH_CENTER_TOLERANCE_PX) return false;
  if (typeof expected.orientationDeg === "number"
    && angleDelta(proposal.geometry.orientationDeg, expected.orientationDeg) > 15) return false;
  const host = draft.walls.find((candidate) => candidate.id === expected.hostWallCandidateId);
  if (!host || typeof expected.widthPx !== "number" || expected.widthPx <= 0) return true;
  const normalizedLength = Math.hypot(host.end.x - host.start.x, host.end.y - host.start.y);
  const pixelLength = Math.hypot(
    (host.end.x - host.start.x) * widthPx,
    (host.end.y - host.start.y) * heightPx,
  );
  if (normalizedLength <= Number.EPSILON || pixelLength <= Number.EPSILON) return true;
  const expectedNormalizedWidth = expected.widthPx / (pixelLength / normalizedLength);
  const delta = Math.abs(proposal.geometry.widthNormalized - expectedNormalizedWidth);
  return delta <= Math.max(0.02, expectedNormalizedWidth * 0.35);
}

function openingMatchCounts(kind, eligible, rejected, draft, widthPx, heightPx) {
  const expected = rejected.filter((item) => item?.candidate?.kind === kind);
  const proposals = eligible.filter((proposal) => proposal.kind === kind);
  const remaining = new Set(expected.map((_, index) => index));
  let truePositive = 0;
  for (const proposal of proposals) {
    const match = [...remaining].find((index) => matchesRejectedOpening(
      proposal,
      expected[index],
      draft,
      widthPx,
      heightPx,
    ));
    if (match === undefined) continue;
    remaining.delete(match);
    truePositive += 1;
  }
  return {
    truePositive,
    falsePositive: proposals.length - truePositive,
    falseNegative: remaining.size,
  };
}

function expectedWashbasinWalls(context) {
  const explicit = context.groundTruth?.washbasinWallCandidateIds;
  if (Array.isArray(explicit)) return new Set(explicit.map((value) => text(value, "washbasin wall id", 160)));
  return new Set((context.localEvidence?.clutterEvidence ?? [])
    .filter((item) => Array.isArray(item.reasonCodes)
      && item.reasonCodes.some((reason) => /sanitary|clutter/i.test(String(reason))))
    .map((item) => text(item.wallCandidateId, "clutter wall id", 160)));
}

function sanitizeDiagnostics(values) {
  if (!Array.isArray(values)) return ["malformed-sanitizer-diagnostics"];
  return values
    .filter((item) => item && typeof item === "object" && item.severity === "error")
    .map((item) => redactAiBenchmarkText(item.code ?? item.message ?? "sanitizer-error"));
}

function evaluateSanitizedRun({ fixture, request, envelope, sanitizedResult }) {
  const context = record(fixture.context, `${fixture.fixtureId} context`);
  const draft = record(context.localDraft, `${fixture.fixtureId} localDraft`);
  if (!Array.isArray(draft.walls)) throw new Error(`${fixture.fixtureId} localDraft.walls must be an array.`);
  const widthPx = positiveInteger(context.localEvidence?.widthPx, `${fixture.fixtureId} widthPx`);
  const heightPx = positiveInteger(context.localEvidence?.heightPx, `${fixture.fixtureId} heightPx`);
  const first = normalizedProposalSet(sanitizedResult.first, "first sanitizer replay");
  const second = normalizedProposalSet(sanitizedResult.second, "second sanitizer replay");
  const eligible = first.filter((proposal) => proposal.state === "eligible");
  const rejected = Array.isArray(context.rejectedOpenings) ? context.rejectedOpenings : [];
  const door = openingMatchCounts("door", eligible, rejected, draft, widthPx, heightPx);
  const window = openingMatchCounts("window", eligible, rejected, draft, widthPx, heightPx);
  const washbasinWalls = expectedWashbasinWalls(context);
  const advisories = eligible.filter((proposal) => proposal.kind === "local-wall-review");
  const trueAdvisories = advisories.filter((proposal) =>
    proposal.targetLocalCandidateId !== null && washbasinWalls.has(proposal.targetLocalCandidateId)).length;
  const knownWalls = new Set(draft.walls.map((wall) => wall.id));
  const protectedWalls = new Set(context.groundTruth?.protectedStrongWallIds ?? []);
  const forbiddenRegions = context.groundTruth?.forbiddenRegions ?? [];
  const eligibleOpenings = eligible.filter((proposal) => proposal.kind === "door" || proposal.kind === "window");
  const firstSignature = JSON.stringify(first.map(proposalSignature));
  const secondSignature = JSON.stringify(second.map(proposalSignature));
  const diagnostics = [
    ...sanitizeDiagnostics(sanitizedResult.firstDiagnostics),
    ...sanitizeDiagnostics(sanitizedResult.secondDiagnostics),
  ];
  const providerRoute = record(envelope.providerRoute, "providerRoute");
  const route = {
    providerId: text(providerRoute.providerId, "providerRoute.providerId", 160),
    requestedModelId: text(providerRoute.requestedModelId, "providerRoute.requestedModelId", 240),
    resolvedModelId: text(providerRoute.resolvedModelId, "providerRoute.resolvedModelId", 240),
    fallbacksAllowed: providerRoute.fallbacksAllowed,
    reasoningDisabled: providerRoute.reasoningDisabled,
  };

  return {
    recoveredDoorTruePositiveCount: door.truePositive,
    recoveredDoorFalsePositiveCount: door.falsePositive,
    recoveredDoorFalseNegativeCount: door.falseNegative,
    recoveredWindowTruePositiveCount: window.truePositive,
    recoveredWindowFalsePositiveCount: window.falsePositive,
    recoveredWindowFalseNegativeCount: window.falseNegative,
    eligibleWashbasinAdvisoryCount: trueAdvisories,
    sanitizerAcceptedCount: eligible.length,
    sanitizerTruePositiveCount: door.truePositive + window.truePositive + trueAdvisories,
    eligibleUnknownHostOpeningCount: eligibleOpenings.filter((proposal) =>
      !proposal.hostWallCandidateId || !knownWalls.has(proposal.hostWallCandidateId)).length,
    eligibleOutsideHostOpeningCount: eligibleOpenings.filter((proposal) =>
      openingOutsideHost(proposal, draft, widthPx, heightPx)).length,
    directLocalMutationCount: sanitizedResult.draftUnchanged === true ? 0 : 1,
    staleDecisionCount: eligible.filter((proposal) =>
      proposal.providerRequestId !== request.requestId
      || proposal.localDraftFingerprint !== request.localDraftFingerprint).length,
    protectedStrongWallAdvisoryCount: advisories.filter((proposal) =>
      proposal.targetLocalCandidateId && protectedWalls.has(proposal.targetLocalCandidateId)).length,
    forbiddenRegionEligibleProposalCount: eligible.filter((proposal) => {
      const point = proposalPoint(proposal, draft);
      return point && forbiddenRegions.some((region) => pointInsideBox(point, region));
    }).length,
    replayCount: 2,
    replayMismatchCount: firstSignature === secondSignature ? 0 : 1,
    sanitizedProposals: first.map(({ rawProposalId: _raw, providerRequestId: _request, localDraftFingerprint: _fp, ...item }) => item),
    providerRoute: route,
    sanitizerDiagnostics: diagnostics,
  };
}

function normalizedUsage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const promptTokens = value.promptTokens;
  const completionTokens = value.completionTokens;
  const totalTokens = value.totalTokens;
  const costUsd = value.costUsd;
  if (!Number.isInteger(promptTokens) || promptTokens < 0
    || !Number.isInteger(completionTokens) || completionTokens < 0
    || !Number.isInteger(totalTokens) || totalTokens < promptTokens + completionTokens
    || typeof costUsd !== "number" || !Number.isFinite(costUsd) || costUsd < 0) return null;
  return { promptTokens, completionTokens, totalTokens, costUsd: round(costUsd) };
}

function requestId(modelId, fixtureId, repetition) {
  const safe = `${modelId}-${fixtureId}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96);
  return `live-proposal-${safe}-${repetition}`;
}

function assertConfig(config) {
  const input = record(config, "AI benchmark config");
  if (input.mode !== MODE) throw new Error(`Live proposal runner requires mode '${MODE}'.`);
  const modelIds = canonicalStrings(input.modelIds, "config.modelIds");
  const fixtureIds = canonicalStrings(input.fixtureIds, "config.fixtureIds");
  const repetitions = positiveInteger(input.repetitions, "config.repetitions");
  if (repetitions < MIN_REPETITIONS) {
    throw new Error(`Live proposal runner requires at least ${MIN_REPETITIONS} repetitions before any paid request.`);
  }
  if (fixtureIds.length > MAX_PREPARED_FIXTURES) throw new Error("Too many live proposal fixtures.");
  return { ...input, modelIds, fixtureIds, repetitions };
}

function fixtureMap(fixtures) {
  if (!Array.isArray(fixtures)) throw new Error("fixtures must be an array.");
  const map = new Map();
  for (const raw of fixtures) {
    const fixture = record(raw, "fixture");
    const fixtureId = text(fixture.fixtureId, "fixture.fixtureId", 160);
    if (map.has(fixtureId)) throw new Error(`Duplicate live proposal fixture '${fixtureId}'.`);
    map.set(fixtureId, { ...fixture, fixtureId });
  }
  return map;
}

export async function runLiveProposalBenchmark(input) {
  const config = assertConfig(input.config);
  const fixturesById = fixtureMap(input.fixtures);
  const missingFixtures = config.fixtureIds.filter((fixtureId) => !fixturesById.has(fixtureId));
  if (missingFixtures.length) throw new Error(`Missing prepared live proposal fixtures: ${missingFixtures.join(", ")}.`);
  for (const name of ["describeModel", "prepareProposal", "requestProposal", "sanitizeProposal"]) {
    if (typeof input[name] !== "function") throw new Error(`${name} adapter is required.`);
  }

  const descriptors = new Map();
  for (const modelId of config.modelIds) {
    const descriptor = record(await input.describeModel({ modelId, timeoutMs: config.timeoutMs }), `descriptor ${modelId}`);
    const contextLength = positiveInteger(descriptor.contextLength, `${modelId} contextLength`);
    const maximumCompletionTokens = descriptor.maximumCompletionTokens == null
      ? null
      : positiveInteger(descriptor.maximumCompletionTokens, `${modelId} maximumCompletionTokens`);
    if (maximumCompletionTokens !== null && config.maximumTokens > maximumCompletionTokens) {
      throw new Error(`Model '${modelId}' supports at most ${maximumCompletionTokens} completion tokens.`);
    }
    descriptors.set(modelId, {
      contextLength,
      supportsReasoning: descriptor.supportsReasoning === true,
    });
  }

  const totalRequestCount = config.modelIds.length * config.fixtureIds.length * config.repetitions;
  const budget = createAiBenchmarkCostBudget({
    maximumCostUsd: config.maximumCostUsd,
    totalRequestCount,
  });
  const runs = [];

  for (const modelId of config.modelIds) {
    const descriptor = descriptors.get(modelId);
    for (const fixtureId of config.fixtureIds) {
      const fixture = fixturesById.get(fixtureId);
      for (let repetition = 1; repetition <= config.repetitions; repetition += 1) {
        const id = requestId(modelId, fixtureId, repetition);
        const allocation = budget.next({
          contextLength: descriptor.contextLength,
          maximumTokens: config.maximumTokens,
          imageCount: 2,
        });
        const startedAt = Date.now();
        try {
          const prepared = record(await input.prepareProposal({ fixture, requestId: id }), "prepared proposal");
          const request = record(prepared.request, "prepared proposal request");
          if (request.mode !== MODE || request.requestId !== id) {
            throw new Error("Prepared proposal identity does not match the live run.");
          }
          const envelope = record(await input.requestProposal({
            modelId,
            request,
            providerMaxPrice: allocation.providerMaxPrice,
            allocationUsd: allocation.allocationUsd,
            maximumTokens: config.maximumTokens,
            maximumPromptTokens: descriptor.contextLength - config.maximumTokens,
            disableReasoning: descriptor.supportsReasoning,
            timeoutMs: config.timeoutMs,
          }), "proposal provider envelope");
          const usage = normalizedUsage(envelope.usage);
          const sanitizedResult = record(await input.sanitizeProposal({
            fixture,
            request,
            envelope,
          }), "sanitized proposal result");
          const proposalEvaluation = evaluateSanitizedRun({
            fixture,
            request,
            envelope,
            sanitizedResult,
          });
          const safetyViolations = [
            ...(Array.isArray(envelope.safetyViolations) ? envelope.safetyViolations : ["malformed-provider-safety-violations"]),
            ...proposalEvaluation.sanitizerDiagnostics,
          ].map(redactAiBenchmarkText);
          runs.push({
            modelId,
            fixtureId,
            repetition,
            latencyMs: typeof envelope.latencyMs === "number" && Number.isFinite(envelope.latencyMs)
              ? envelope.latencyMs
              : Date.now() - startedAt,
            usage,
            response: { walls: [], openings: [] },
            localSummary: { walls: [], openings: [] },
            expectedOpeningKinds: {},
            schemaFailure: false,
            safetyViolations,
            proposalEvaluation,
            error: null,
          });
        } catch (cause) {
          runs.push({
            modelId,
            fixtureId,
            repetition,
            latencyMs: Date.now() - startedAt,
            usage: null,
            response: { walls: [], openings: [] },
            localSummary: { walls: [], openings: [] },
            expectedOpeningKinds: {},
            schemaFailure: true,
            safetyViolations: [],
            proposalEvaluation: null,
            error: redactAiBenchmarkText(cause instanceof Error ? cause.message : String(cause)),
          });
        }
      }
    }
  }

  const report = buildAiBenchmarkReport({
    config,
    runs,
    commitSha: input.commitSha ?? null,
  });
  if (input.outputPath) {
    const outputPath = resolve(input.outputPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalAiBenchmarkJson(report), "utf8");
  }
  return report;
}
