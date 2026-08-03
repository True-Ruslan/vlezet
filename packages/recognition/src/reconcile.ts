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

function mergeWall(local: RecognitionWallCandidate, cloud: RecognitionWallCandidate): RecognitionWallCandidate {
  return {
    ...local,
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

function mergeOpening(
  local: RecognitionOpeningCandidate,
  cloud: RecognitionOpeningCandidate,
): RecognitionOpeningCandidate {
  const exactClassificationAgreement = local.kind === cloud.kind
    && cloud.kind !== "unknown-opening"
    && local.hostWallCandidateId !== null;
  return {
    ...local,
    kind: cloud.kind,
    confidence: cloud.kind === "unknown-opening"
      ? "low"
      : exactClassificationAgreement
        ? "high"
        : "medium",
    origin: "merged",
    conflict: null,
    evidence: {
      localScore: local.evidence.localScore,
      cloudScore: cloud.evidence.cloudScore,
      reasons: [...new Set([
        ...local.evidence.reasons,
        ...cloud.evidence.reasons,
        exactClassificationAgreement
          ? "local-cloud-opening-agreement"
          : "cloud-opening-reclassification",
      ])],
    },
  };
}

function reconcileOpenings(
  local: readonly RecognitionOpeningCandidate[],
  cloud: readonly RecognitionOpeningCandidate[],
  diagnostics: RecognitionDiagnostic[],
): RecognitionOpeningCandidate[] {
  const result = [...local];
  const localIndexById = new Map(result.map((candidate, index) => [candidate.id, index]));

  for (const candidate of cloud) {
    const matchIndex = localIndexById.get(candidate.id);
    if (matchIndex === undefined) {
      diagnostics.push({
        code: "cloud-only-opening-deferred",
        severity: "warning",
        message: "AI предложил новый проём без локального подтверждения. В этом этапе AI может только проверять существующие локальные гипотезы.",
        candidateId: candidate.id,
      });
      continue;
    }

    const existing = result[matchIndex]!;
    if (candidate.hostWallCandidateId !== existing.hostWallCandidateId) {
      diagnostics.push({
        code: "cloud-opening-host-mismatch",
        severity: "warning",
        message: "AI изменил стену-хозяина локального проёма. Результат проверки отброшен.",
        candidateId: candidate.id,
      });
      continue;
    }

    result[matchIndex] = mergeOpening(existing, candidate);
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
    if (consumedCloud.has(cloud.id)) continue;
    diagnostics.push({
      code: "cloud-only-wall-deferred",
      severity: "warning",
      message: "AI предложил новую стену без локального подтверждения. В этом этапе AI может только проверять существующие локальные кандидаты.",
      candidateId: cloud.id,
    });
  }

  const openings = reconcileOpenings(input.localDraft.openings, input.cloudResult.openings, diagnostics);
  const roomLabels = input.cloudResult.roomLabels;
  const survivingCandidateIds = new Set([...walls, ...openings, ...roomLabels].map((candidate) => candidate.id));
  const decisions: Record<string, RecognitionDecision> = Object.fromEntries(
    Object.entries(input.localDraft.decisions).filter(([candidateId]) => survivingCandidateIds.has(candidateId)),
  );

  for (const wall of walls) {
    if (wall.conflict === "duplicate-existing") decisions[wall.id] = "rejected";
    else if (!(wall.id in decisions)) decisions[wall.id] = "pending";
  }
  for (const opening of openings) if (!(opening.id in decisions)) decisions[opening.id] = "pending";
  for (const label of roomLabels) if (!(label.id in decisions)) decisions[label.id] = "pending";

  return {
    ...input.localDraft,
    status: "reconciled",
    walls,
    openings,
    roomLabels,
    diagnostics,
    decisions,
    source: { local: true, cloud: true },
    updatedAt: input.now,
  };
}
