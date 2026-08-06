import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scoreAiBenchmarkRuns } from "./ai-benchmark/score.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(directory, "../..");

function benchmarkRun(fixture, repetition) {
  return {
    modelId: "recorded/provider-model",
    fixtureId: fixture.fixtureId,
    repetition,
    latencyMs: 0,
    usage: null,
    response: { walls: [], openings: [] },
    localSummary: { walls: [], openings: [] },
    expectedOpeningKinds: {},
    schemaFailure: false,
    safetyViolations: [],
    proposalEvaluation: fixture.proposalEvaluation,
  };
}

export function buildAiProposalGateReport(corpus) {
  if (corpus?.schemaVersion !== "recognition-ai-proposal-corpus-result-v1") {
    throw new Error("AI proposal corpus result uses an unsupported schema.");
  }
  if (!Array.isArray(corpus.fixtures) || corpus.fixtures.length === 0) {
    throw new Error("AI proposal corpus must contain at least one recorded fixture.");
  }
  const runs = corpus.fixtures.map((fixture) => benchmarkRun(fixture, 1));
  return {
    schemaVersion: "recognition-ai-proposal-gate-report-v1",
    fixtureCount: corpus.fixtures.length,
    score: scoreAiBenchmarkRuns(runs),
  };
}

function requireZero(errors, score, field, label) {
  if (score[field] !== 0) errors.push(`${label}: expected 0, got ${score[field]}`);
}

export function enforceAiProposalGate(report) {
  if (report?.schemaVersion !== "recognition-ai-proposal-gate-report-v1") {
    throw new Error("AI proposal gate report uses an unsupported schema.");
  }
  if (!Number.isInteger(report.fixtureCount) || report.fixtureCount <= 0 || !report.score) {
    throw new Error("AI proposal gate report is incomplete.");
  }

  const score = report.score;
  const errors = [];
  if (score.recoveredDoorTruePositiveCount < 1) errors.push("No eligible recovered door true positive.");
  requireZero(errors, score, "recoveredDoorFalsePositiveCount", "Recovered door false positives");
  requireZero(errors, score, "recoveredDoorFalseNegativeCount", "Recovered door false negatives");
  if (score.recoveredWindowTruePositiveCount < 1) errors.push("No eligible recovered window true positive.");
  requireZero(errors, score, "recoveredWindowFalsePositiveCount", "Recovered window false positives");
  requireZero(errors, score, "recoveredWindowFalseNegativeCount", "Recovered window false negatives");
  if (score.eligibleWashbasinAdvisoryCount < 1) errors.push("No eligible washbasin clutter advisory.");
  if (score.sanitizerAcceptedCount < 3) errors.push("Sanitizer accepted fewer than three required proposals.");
  if (score.sanitizerAcceptancePrecision !== 1) {
    errors.push(`Sanitizer acceptance precision must be 1, got ${score.sanitizerAcceptancePrecision}`);
  }

  requireZero(errors, score, "eligibleUnknownHostOpeningCount", "Eligible unknown-host openings");
  requireZero(errors, score, "eligibleOutsideHostOpeningCount", "Eligible outside-host openings");
  requireZero(errors, score, "directLocalMutationCount", "Direct local mutations");
  requireZero(errors, score, "staleDecisionCount", "Stale proposal decisions");
  requireZero(errors, score, "protectedStrongWallAdvisoryCount", "Protected strong-wall advisories");
  requireZero(errors, score, "forbiddenRegionEligibleProposalCount", "Forbidden-region eligible proposals");
  requireZero(errors, score, "replayMismatchCount", "Recorded replay mismatches");
  if (score.replayCount < report.fixtureCount * 2) {
    errors.push(`Each recorded fixture requires two replays; got ${score.replayCount}.`);
  }
  if (score.replayDeterminismRate !== 1) {
    errors.push(`Replay determinism rate must be 1, got ${score.replayDeterminismRate}`);
  }

  if (errors.length > 0) {
    throw new Error(`AI proposal gate failed:\n- ${errors.join("\n- ")}`);
  }
  return report;
}

function runRecordedCorpus(outputPath) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, [
    "--filter",
    "@vlezet/recognition",
    "test",
    "--",
    "ai-proposal-benchmark-contract.test.ts",
    "ai-proposal-recorded-fixtures.test.ts",
  ], {
    cwd: repositoryRoot,
    env: { ...process.env, AI_PROPOSAL_GATE_OUTPUT: outputPath },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Recorded AI proposal corpus tests failed with status ${result.status}.`);
  }
}

function runCli() {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "vlezet-ai-proposal-gate-"));
  const outputPath = join(temporaryDirectory, "corpus-result.json");
  try {
    runRecordedCorpus(outputPath);
    const corpus = JSON.parse(readFileSync(outputPath, "utf8"));
    const report = enforceAiProposalGate(buildAiProposalGateReport(corpus));
    console.log(JSON.stringify(report, null, 2));
    console.log("Deterministic AI proposal recovery gate passed.");
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : "AI proposal gate failed.");
    process.exitCode = 1;
  }
}
