export type ReconciliationScore = Readonly<{
  staleDecisionCount: number;
  missingPendingDecisionCount: number;
  duplicateCandidateIdCount: number;
  unknownDiagnosticReferenceCount: number;
  malformedDecisionCount: number;
}>;

const VALID_DECISIONS = new Set(["pending", "accepted", "rejected", "edited"]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function candidateIdsFrom(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = record(entry);
    return item && typeof item.id === "string" && item.id.trim() ? [item.id.trim()] : [];
  });
}

export function scoreReconciliation(value: unknown): ReconciliationScore {
  const draft = record(value);
  if (!draft) {
    return {
      staleDecisionCount: 0,
      missingPendingDecisionCount: 0,
      duplicateCandidateIdCount: 0,
      unknownDiagnosticReferenceCount: 0,
      malformedDecisionCount: 1,
    };
  }

  const candidateIds = [
    ...candidateIdsFrom(draft.walls),
    ...candidateIdsFrom(draft.openings),
    ...candidateIdsFrom(draft.roomLabels),
  ];
  const seen = new Set<string>();
  let duplicateCandidateIdCount = 0;
  for (const candidateId of candidateIds) {
    if (seen.has(candidateId)) duplicateCandidateIdCount += 1;
    else seen.add(candidateId);
  }

  const decisions = record(draft.decisions);
  let malformedDecisionCount = decisions ? 0 : 1;
  let staleDecisionCount = 0;
  const decisionKeys = new Set<string>();
  if (decisions) {
    for (const [candidateId, decision] of Object.entries(decisions)) {
      decisionKeys.add(candidateId);
      if (!seen.has(candidateId)) staleDecisionCount += 1;
      if (typeof decision !== "string" || !VALID_DECISIONS.has(decision)) malformedDecisionCount += 1;
    }
  }
  const missingPendingDecisionCount = candidateIds.filter((candidateId, index) =>
    candidateIds.indexOf(candidateId) === index && !decisionKeys.has(candidateId),
  ).length;

  let unknownDiagnosticReferenceCount = 0;
  if (Array.isArray(draft.diagnostics)) {
    for (const entry of draft.diagnostics) {
      const diagnostic = record(entry);
      if (!diagnostic || diagnostic.candidateId === null || diagnostic.candidateId === undefined) continue;
      if (typeof diagnostic.candidateId !== "string" || !seen.has(diagnostic.candidateId)) {
        unknownDiagnosticReferenceCount += 1;
      }
    }
  }

  return {
    staleDecisionCount,
    missingPendingDecisionCount,
    duplicateCandidateIdCount,
    unknownDiagnosticReferenceCount,
    malformedDecisionCount,
  };
}
