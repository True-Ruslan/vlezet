import type {
  NormalizedPoint,
  RecognitionDecision,
  RecognitionDiagnostic,
  RecognitionDraft,
  RecognitionOpeningCandidate,
  RecognitionProviderResult,
  RecognitionWallCandidate,
} from "./index";

export type ExistingRecognitionWall = Readonly<{ start: NormalizedPoint; end: NormalizedPoint }>;

export type ReconcileRecognitionInput = Readonly<{
  localDraft: RecognitionDraft;
  cloudResult: RecognitionProviderResult;
  existingWalls: readonly ExistingRecognitionWall[];
  now: string;
}>;

const WALL_MATCH_TOLERANCE = 0.02;

function distance(a: NormalizedPoint, b: NormalizedPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function wallDistance(a: ExistingRecognitionWall, b: ExistingRecognitionWall): number {
  const direct = (distance(a.start, b.start) + distance(a.end, b.end)) / 2;
  const reversed = (distance(a.start, b.end) + distance(a.end, b.start)) / 2;
  return Math.min(direct, reversed);
}

function midpoint(a: NormalizedPoint, b: NormalizedPoint): NormalizedPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function mergeWall(local: RecognitionWallCandidate, cloud: RecognitionWallCandidate): RecognitionWallCandidate {
  const direct = distance(local.start, cloud.start) + distance(local.end, cloud.end);
  const reversed = distance(local.start, cloud.end) + distance(local.end, cloud.start);
  const cloudStart = direct <= reversed ? cloud.start : cloud.end;
  const cloudEnd = direct <= reversed ? cloud.end : cloud.start;
  return {
    ...local,
    start: midpoint(local.start, cloudStart),
    end: midpoint(local.end, cloudEnd),
    estimatedThicknessPx: local.estimatedThicknessPx ?? cloud.estimatedThicknessPx,
    confidence: "high",
    origin: "merged",
    evidence: {
      localScore: local.evidence.localScore,
      cloudScore: cloud.evidence.cloudScore,
      reasons: [...new Set([...local.evidence.reasons, ...cloud.evidence.reasons, "local-cloud-agreement"])],
    },
  };
}

function downgradeCloudWall(wall: RecognitionWallCandidate): RecognitionWallCandidate {
  return {
    ...wall,
    confidence: wall.confidence === "low" ? "low" : "medium",
    evidence: { ...wall.evidence, reasons: [...new Set([...wall.evidence.reasons, "cloud-only-review"])] },
  };
}

function reconcileOpenings(
  local: readonly RecognitionOpeningCandidate[],
  cloud: readonly RecognitionOpeningCandidate[],
): RecognitionOpeningCandidate[] {
  const result = [...local];
  for (const candidate of cloud) {
    const matchIndex = result.findIndex((existing) => distance(existing.center, candidate.center) <= WALL_MATCH_TOLERANCE);
    if (matchIndex < 0) {
      result.push({ ...candidate, confidence: candidate.confidence === "high" ? "medium" : candidate.confidence });
      continue;
    }
    const existing = result[matchIndex]!;
    result[matchIndex] = existing.kind === candidate.kind
      ? {
          ...existing,
          origin: "merged",
          confidence: "high",
          widthPx: existing.widthPx ?? candidate.widthPx,
          evidence: {
            localScore: existing.evidence.localScore,
            cloudScore: candidate.evidence.cloudScore,
            reasons: [...new Set([...existing.evidence.reasons, ...candidate.evidence.reasons, "local-cloud-agreement"])],
          },
        }
      : { ...existing, conflict: "classification-conflict", confidence: "low" };
  }
  return result;
}

export function reconcileRecognition(input: ReconcileRecognitionInput): RecognitionDraft {
  const diagnostics: RecognitionDiagnostic[] = [...input.localDraft.diagnostics, ...(input.cloudResult.diagnostics ?? [])];
  const consumedCloud = new Set<string>();
  const walls = input.localDraft.walls.map((local) => {
    const cloud = input.cloudResult.walls.find((candidate) => wallDistance(local, candidate) <= WALL_MATCH_TOLERANCE);
    let result = cloud ? mergeWall(local, cloud) : local;
    if (cloud) consumedCloud.add(cloud.id);
    if (input.existingWalls.some((existing) => wallDistance(result, existing) <= WALL_MATCH_TOLERANCE)) {
      result = { ...result, conflict: "duplicate-existing", confidence: "low" };
      diagnostics.push({
        code: "duplicate-existing-wall",
        severity: "info",
        message: "Кандидат совпадает с уже существующей стеной и не будет применён повторно.",
        candidateId: result.id,
      });
    }
    return result;
  });

  for (const cloud of input.cloudResult.walls) {
    if (!consumedCloud.has(cloud.id)) walls.push(downgradeCloudWall(cloud));
  }

  const decisions: Record<string, RecognitionDecision> = { ...input.localDraft.decisions };
  for (const wall of walls) {
    if (wall.conflict === "duplicate-existing") decisions[wall.id] = "rejected";
    else if (!(wall.id in decisions)) decisions[wall.id] = "pending";
  }

  const openings = reconcileOpenings(input.localDraft.openings, input.cloudResult.openings);
  for (const opening of openings) if (!(opening.id in decisions)) decisions[opening.id] = "pending";
  for (const label of input.cloudResult.roomLabels) if (!(label.id in decisions)) decisions[label.id] = "pending";

  return {
    ...input.localDraft,
    status: "reconciled",
    walls,
    openings,
    roomLabels: input.cloudResult.roomLabels,
    diagnostics,
    decisions,
    source: { local: true, cloud: true },
    updatedAt: input.now,
  };
}
