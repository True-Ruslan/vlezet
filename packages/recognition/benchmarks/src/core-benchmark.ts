import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildOpeningHypotheses } from "../../src/openings";
import { buildWallCandidates, LOCAL_RECOGNITION_ENGINE_VERSION, type DetectedLineSegment } from "../../src/local-lines";
import type { RecognitionDraft } from "../../src/model";
import { validateRecognitionBenchmarkResultV1, type RecognitionBenchmarkResultV1 } from "../schema/result-v1";
import { aggregateRecognitionResults } from "./aggregate-report";
import { canonicalBenchmarkJson } from "./canonical-json";
import { loadRecognitionBenchmarkCorpus } from "./load-corpus";
import { scoreRecognitionFixture } from "./score-fixture";
import { renderRecognitionBenchmarkMarkdown } from "./write-report";

export type CoreBenchmarkOptions = Readonly<{
  corpusRoot: string;
  outputDirectory: string;
  commitSha?: string;
  generatedAt?: string;
}>;

type SegmentsSnapshotV1 = Readonly<{
  schemaVersion: "recognition-segments-v1";
  widthPx: number;
  heightPx: number;
  segments: readonly DetectedLineSegment[];
}>;

function commitSha(explicit: string | undefined): string {
  const value = explicit
    ?? process.env.GITHUB_SHA
    ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[a-f0-9]{40}$/i.test(value)) throw new Error(`Invalid benchmark commit SHA: ${value}`);
  return value.toLowerCase();
}

function validateSegments(value: unknown, fixtureId: string): SegmentsSnapshotV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${fixtureId}: segments snapshot must be an object.`);
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== "recognition-segments-v1") throw new Error(`${fixtureId}: unsupported segments schema.`);
  if (typeof input.widthPx !== "number" || !Number.isFinite(input.widthPx) || input.widthPx <= 0) throw new Error(`${fixtureId}: invalid segment width.`);
  if (typeof input.heightPx !== "number" || !Number.isFinite(input.heightPx) || input.heightPx <= 0) throw new Error(`${fixtureId}: invalid segment height.`);
  if (!Array.isArray(input.segments)) throw new Error(`${fixtureId}: segments must be a list.`);
  const segments = input.segments.map((entry, index): DetectedLineSegment => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${fixtureId}: segment ${index} is invalid.`);
    const segment = entry as Record<string, unknown>;
    const coordinates = [segment.x1, segment.y1, segment.x2, segment.y2];
    if (coordinates.some((coordinate) => typeof coordinate !== "number" || !Number.isFinite(coordinate))) {
      throw new Error(`${fixtureId}: segment ${index} contains non-finite coordinates.`);
    }
    return { x1: segment.x1 as number, y1: segment.y1 as number, x2: segment.x2 as number, y2: segment.y2 as number };
  });
  return { schemaVersion: "recognition-segments-v1", widthPx: input.widthPx, heightPx: input.heightPx, segments };
}

function localDraft(fixtureId: string, walls: ReturnType<typeof buildWallCandidates>, openings: ReturnType<typeof buildOpeningHypotheses>): RecognitionDraft {
  const now = "2026-08-01T00:00:00.000Z";
  return {
    id: `benchmark-${fixtureId}`,
    projectId: `benchmark-${fixtureId}`,
    referenceAssetId: `benchmark-asset-${fixtureId}`,
    referenceRevision: "benchmark-v1",
    engineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
    status: "local-complete",
    walls,
    openings,
    roomLabels: [],
    diagnostics: [],
    decisions: Object.fromEntries([...walls, ...openings].map((candidate) => [candidate.id, "pending" as const])),
    source: { local: true, cloud: false },
    createdAt: now,
    updatedAt: now,
  };
}

export async function runCoreRecognitionBenchmark(options: CoreBenchmarkOptions): Promise<RecognitionBenchmarkResultV1> {
  const loaded = await loadRecognitionBenchmarkCorpus(options.corpusRoot);
  const fixtureResults = [];
  for (const entry of loaded) {
    try {
      const segments = validateSegments(JSON.parse(await readFile(entry.segmentsPath, "utf8")) as unknown, entry.fixture.id);
      if (segments.widthPx !== entry.fixture.calibration.sourceWidthPx || segments.heightPx !== entry.fixture.calibration.sourceHeightPx) {
        throw new Error(`${entry.fixture.id}: segments dimensions do not match fixture calibration.`);
      }
      const wallPredictions = buildWallCandidates({
        widthPx: segments.widthPx,
        heightPx: segments.heightPx,
        segments: segments.segments,
      });
      const openingPredictions = buildOpeningHypotheses({
        widthPx: segments.widthPx,
        heightPx: segments.heightPx,
        wallCandidates: wallPredictions,
        segments: segments.segments,
      });
      fixtureResults.push(scoreRecognitionFixture({
        fixture: entry.fixture,
        wallPredictions,
        openingPredictions,
        roomPredictions: [],
        reconciliationSnapshot: localDraft(entry.fixture.id, wallPredictions, openingPredictions),
        failure: null,
      }));
    } catch (cause) {
      fixtureResults.push(scoreRecognitionFixture({
        fixture: entry.fixture,
        wallPredictions: [],
        openingPredictions: [],
        roomPredictions: [],
        reconciliationSnapshot: null,
        failure: cause instanceof Error ? cause : new Error(String(cause)),
      }));
    }
  }

  const result = validateRecognitionBenchmarkResultV1({
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: "recognition-corpus-v1",
    recognitionEngineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
    commitSha: commitSha(options.commitSha),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    fixtures: fixtureResults,
    aggregate: aggregateRecognitionResults(fixtureResults),
    baselineComparison: null,
  });
  await mkdir(options.outputDirectory, { recursive: true });
  await writeFile(join(options.outputDirectory, "recognition-core-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(join(options.outputDirectory, "recognition-core-canonical.json"), canonicalBenchmarkJson(result), "utf8");
  await writeFile(join(options.outputDirectory, "recognition-core-report.md"), renderRecognitionBenchmarkMarkdown(result), "utf8");
  return result;
}
