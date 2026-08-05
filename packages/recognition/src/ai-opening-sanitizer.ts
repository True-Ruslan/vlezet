import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import type { AiOpeningAdditionProposal, SanitizedRecognitionProposal } from "./ai-proposals";
import { peekAiRejectedOpeningEvidenceForDraft } from "./ai-rejected-opening-evidence";
import type { RecognitionAiProviderIdentity } from "./ai-proposal-sanity";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type {
  NormalizedPoint,
  RecognitionDraft,
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { validateRecognitionDraft } from "./model";
import { validateOpeningHypotheses } from "./opening-analysis-with-ai-evidence";

const HOST_ANGLE_TOLERANCE_DEG = 15;
const LOCAL_EVIDENCE_ANGLE_TOLERANCE_DEG = 18;
const LOCAL_EVIDENCE_CENTER_TOLERANCE_PX = 28;
const LOCAL_EVIDENCE_WIDTH_RELATIVE_TOLERANCE = 0.5;
const MINIMUM_OPENING_SEPARATION_PX = 8;
const STRUCTURAL_OCCUPANCY_BLOCK_THRESHOLD = 0.45;

const FORBIDDEN_LOCAL_EVIDENCE = [
  "sanitary",
  "furniture",
  "dimension",
  "text",
  "label",
  "fixture",
] as const;

export type SanitizedAiOpeningProposal = SanitizedRecognitionProposal & Readonly<{
  rawGeometry: Readonly<{
    center: NormalizedPoint;
    widthNormalized: number;
    orientationDeg: number;
  }>;
}>;

export type SanitizeAiOpeningProposalInput = Readonly<{
  proposal: AiOpeningAdditionProposal;
  localDraft: RecognitionDraft;
  localEvidence: RecognitionAiLocalEvidenceSnapshot;
  provider: RecognitionAiProviderIdentity;
  acceptedSiblingProposals: readonly SanitizedRecognitionProposal[];
}>;

type PixelPoint = Readonly<{ x: number; y: number }>;
type HostGeometry = Readonly<{
  wall: RecognitionWallCandidate;
  start: PixelPoint;
  end: PixelPoint;
  tangent: PixelPoint;
  normal: PixelPoint;
  lengthPx: number;
  angleDeg: number;
  pixelScalePerNormalizedUnit: number;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function pixelPoint(point: NormalizedPoint, widthPx: number, heightPx: number): PixelPoint {
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function hostGeometry(
  wall: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): HostGeometry | null {
  const start = pixelPoint(wall.start, widthPx, heightPx);
  const end = pixelPoint(wall.end, widthPx, heightPx);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthPx = Math.hypot(dx, dy);
  const normalizedDx = wall.end.x - wall.start.x;
  const normalizedDy = wall.end.y - wall.start.y;
  const normalizedLength = Math.hypot(normalizedDx, normalizedDy);
  if (!Number.isFinite(lengthPx) || lengthPx <= 0 || normalizedLength <= 0) return null;
  const tangent = { x: dx / lengthPx, y: dy / lengthPx };
  return {
    wall,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    angleDeg: ((Math.atan2(dy, dx) * 180 / Math.PI) + 180) % 180,
    pixelScalePerNormalizedUnit: lengthPx / normalizedLength,
  };
}

function projectCenter(
  center: NormalizedPoint,
  host: HostGeometry,
  widthPx: number,
  heightPx: number,
): Readonly<{ alongPx: number; acrossPx: number; snapped: NormalizedPoint }> {
  const point = pixelPoint(center, widthPx, heightPx);
  const relative = { x: point.x - host.start.x, y: point.y - host.start.y };
  const alongPx = relative.x * host.tangent.x + relative.y * host.tangent.y;
  const acrossPx = relative.x * host.normal.x + relative.y * host.normal.y;
  const snappedPixel = {
    x: host.start.x + host.tangent.x * alongPx,
    y: host.start.y + host.tangent.y * alongPx,
  };
  return {
    alongPx,
    acrossPx,
    snapped: {
      x: clamp(snappedPixel.x / widthPx, 0, 1),
      y: clamp(snappedPixel.y / heightPx, 0, 1),
    },
  };
}

function proposalId(provider: RecognitionAiProviderIdentity, rawId: string): string {
  return `ai-proposal:${provider.requestId}:${rawId}`;
}

function baseProposal(
  input: SanitizeAiOpeningProposalInput,
  validatorReasons: readonly string[],
  hostWallCandidateId: string | null,
): SanitizedAiOpeningProposal {
  return {
    id: proposalId(input.provider, input.proposal.id),
    rawProposalId: input.proposal.id,
    kind: input.proposal.openingKind,
    state: "blocked",
    geometry: null,
    rawGeometry: {
      center: { ...input.proposal.center },
      widthNormalized: input.proposal.widthNormalized,
      orientationDeg: input.proposal.orientationDeg,
    },
    targetLocalCandidateId: null,
    hostWallCandidateId,
    provider: {
      providerId: input.provider.providerId,
      modelId: input.provider.modelId,
      requestId: input.provider.requestId,
    },
    modelConfidence: input.proposal.modelConfidence,
    deterministicConfidence: "low",
    sourceRegion: input.proposal.sourceRegion,
    evidence: {
      providerReasons: [...input.proposal.reasonCodes],
      validatorReasons: [...new Set(validatorReasons)],
    },
    localDraftFingerprint: createLocalDraftFingerprint(input.localDraft),
  };
}

function selectHost(
  proposal: AiOpeningAdditionProposal,
  walls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): Readonly<{ host: HostGeometry | null; reason: string | null }> {
  const activeHosts = walls
    .filter(({ conflict }) => conflict === null)
    .map((wall) => hostGeometry(wall, widthPx, heightPx))
    .filter((value): value is HostGeometry => value !== null);
  const byId = new Map(activeHosts.map((host) => [host.wall.id, host]));

  if (proposal.hostWallHintIds.length > 0) {
    const hinted = proposal.hostWallHintIds.map((id) => byId.get(id)).filter(
      (value): value is HostGeometry => value !== undefined,
    );
    if (hinted.length !== proposal.hostWallHintIds.length) {
      return { host: null, reason: "unknown-host-wall-hint" };
    }
    if (hinted.length !== 1) return { host: null, reason: "ambiguous-host-wall" };
    return { host: hinted[0]!, reason: null };
  }

  const candidates = activeHosts.filter((host) => {
    if (angleDelta(proposal.orientationDeg, host.angleDeg) > HOST_ANGLE_TOLERANCE_DEG) return false;
    const projected = projectCenter(proposal.center, host, widthPx, heightPx);
    return Math.abs(projected.acrossPx) <= Math.max(24, (host.wall.estimatedThicknessPx ?? 0) / 2 + 4)
      && projected.alongPx >= 0
      && projected.alongPx <= host.lengthPx;
  });
  if (candidates.length !== 1) {
    return { host: null, reason: candidates.length === 0 ? "missing-host-wall" : "ambiguous-host-wall" };
  }
  return { host: candidates[0]!, reason: null };
}

function hasForbiddenLocalEvidence(reasonCodes: readonly string[]): boolean {
  return reasonCodes.some((reason) => {
    const canonical = reason.toLowerCase();
    return FORBIDDEN_LOCAL_EVIDENCE.some((token) => canonical.includes(token));
  });
}

function hasDoorEvidence(reasonCodes: readonly string[]): boolean {
  return reasonCodes.some((reason) => /door-(?:leaf|arc)|door-leaf-anchored|wall-gap|visible-gap/i.test(reason));
}

function localEvidenceMatch(
  input: SanitizeAiOpeningProposalInput,
  host: HostGeometry,
  widthPx: number,
  heightPx: number,
  proposedWidthPx: number,
): Readonly<{ reasons: readonly string[]; reason: string | null }> {
  const rejected = peekAiRejectedOpeningEvidenceForDraft(input.localDraft);
  if (!rejected || rejected.widthPx !== widthPx || rejected.heightPx !== heightPx) {
    return { reasons: [], reason: "missing-local-door-evidence" };
  }
  const proposedCenter = pixelPoint(input.proposal.center, widthPx, heightPx);
  const matches = rejected.items.filter((item) => {
    if (item.kind !== "door" && item.kind !== "unknown-opening") return false;
    if (item.hostWallCandidateId !== host.wall.id) return false;
    if (!hasDoorEvidence(item.reasonCodes)) return false;
    const localCenter = pixelPoint(item.center, widthPx, heightPx);
    if (Math.hypot(localCenter.x - proposedCenter.x, localCenter.y - proposedCenter.y)
      > Math.max(LOCAL_EVIDENCE_CENTER_TOLERANCE_PX, proposedWidthPx * 0.35)) return false;
    if (
      item.widthPx !== null
      && Math.abs(item.widthPx - proposedWidthPx) / Math.max(item.widthPx, proposedWidthPx)
        > LOCAL_EVIDENCE_WIDTH_RELATIVE_TOLERANCE
    ) return false;
    if (
      item.orientationDeg !== null
      && angleDelta(item.orientationDeg, host.angleDeg) > LOCAL_EVIDENCE_ANGLE_TOLERANCE_DEG
    ) return false;
    return true;
  });
  if (matches.length === 0) return { reasons: [], reason: "missing-local-door-evidence" };
  if (matches.length > 1) return { reasons: [], reason: "ambiguous-local-door-evidence" };
  const matched = matches[0]!;
  if (hasForbiddenLocalEvidence(matched.reasonCodes)) {
    return { reasons: matched.reasonCodes, reason: "forbidden-local-clutter-evidence" };
  }
  return { reasons: matched.reasonCodes, reason: null };
}

function providerEvidenceValid(proposal: AiOpeningAdditionProposal): boolean {
  return proposal.reasonCodes.includes("visible-gap")
    && (proposal.reasonCodes.includes("door-leaf") || proposal.reasonCodes.includes("door-arc"));
}

function structuralOccupancy(
  evidence: RecognitionAiLocalEvidenceSnapshot,
  host: HostGeometry,
  center: NormalizedPoint,
  widthPx: number,
): number {
  const projected = projectCenter(center, host, evidence.widthPx, evidence.heightPx);
  const halfWidth = widthPx / 2;
  const halfThickness = Math.max(3, (host.wall.estimatedThicknessPx ?? 12) / 2);
  let structural = 0;
  let samples = 0;
  for (let alongStep = 0; alongStep < 17; alongStep += 1) {
    const along = projected.alongPx - halfWidth + widthPx * alongStep / 16;
    for (let acrossStep = 0; acrossStep < 5; acrossStep += 1) {
      const across = -halfThickness + 2 * halfThickness * acrossStep / 4;
      const x = host.start.x + host.tangent.x * along + host.normal.x * across;
      const y = host.start.y + host.tangent.y * along + host.normal.y * across;
      samples += 1;
      if (evidence.structuralMask.isStructural(x, y)) structural += 1;
    }
  }
  return samples === 0 ? 1 : structural / samples;
}

function intervalForOpening(
  center: NormalizedPoint,
  widthPx: number,
  host: HostGeometry,
  imageWidthPx: number,
  imageHeightPx: number,
): Readonly<{ start: number; end: number }> {
  const along = projectCenter(center, host, imageWidthPx, imageHeightPx).alongPx;
  return { start: along - widthPx / 2, end: along + widthPx / 2 };
}

function intervalsOverlap(
  first: Readonly<{ start: number; end: number }>,
  second: Readonly<{ start: number; end: number }>,
): boolean {
  return first.start < second.end + MINIMUM_OPENING_SEPARATION_PX
    && second.start < first.end + MINIMUM_OPENING_SEPARATION_PX;
}

function overlapsExisting(
  draft: ReturnType<typeof validateRecognitionDraft>,
  host: HostGeometry,
  center: NormalizedPoint,
  widthPx: number,
  imageWidthPx: number,
  imageHeightPx: number,
): boolean {
  const proposed = intervalForOpening(center, widthPx, host, imageWidthPx, imageHeightPx);
  return draft.openings.some((opening) => {
    if (
      opening.conflict !== null
      || opening.hostWallCandidateId !== host.wall.id
      || opening.widthPx === null
    ) return false;
    return intervalsOverlap(
      proposed,
      intervalForOpening(opening.center, opening.widthPx, host, imageWidthPx, imageHeightPx),
    );
  });
}

function overlapsSibling(
  siblings: readonly SanitizedRecognitionProposal[],
  host: HostGeometry,
  center: NormalizedPoint,
  widthPx: number,
  imageWidthPx: number,
  imageHeightPx: number,
): boolean {
  const proposed = intervalForOpening(center, widthPx, host, imageWidthPx, imageHeightPx);
  return siblings.some((sibling) => {
    if (
      sibling.state !== "eligible"
      || sibling.hostWallCandidateId !== host.wall.id
      || sibling.geometry?.kind !== "opening"
    ) return false;
    const siblingWidthPx = sibling.geometry.widthNormalized * host.pixelScalePerNormalizedUnit;
    return intervalsOverlap(
      proposed,
      intervalForOpening(
        sibling.geometry.center,
        siblingWidthPx,
        host,
        imageWidthPx,
        imageHeightPx,
      ),
    );
  });
}

function validatedOpeningCandidate(
  proposal: AiOpeningAdditionProposal,
  host: HostGeometry,
  center: NormalizedPoint,
  widthPx: number,
  localReasons: readonly string[],
): RecognitionOpeningCandidate {
  return {
    id: `ai-opening:${proposal.id}`,
    kind: proposal.openingKind,
    hostWallCandidateId: host.wall.id,
    center,
    widthPx,
    orientationDeg: host.angleDeg,
    confidence: "low",
    evidence: {
      localScore: 0.55,
      cloudScore: proposal.modelConfidence,
      reasons: [...new Set([
        ...localReasons,
        ...proposal.reasonCodes,
        "ai-proposal",
        "local-rejected-door-evidence-matched",
      ])].sort(),
    },
    origin: "merged",
    conflict: null,
  };
}

export function sanitizeAiOpeningProposal(
  input: SanitizeAiOpeningProposalInput,
): SanitizedAiOpeningProposal {
  const draft = validateRecognitionDraft(input.localDraft);
  const fingerprint = createLocalDraftFingerprint(draft);
  if (
    input.localEvidence.localDraftFingerprint !== fingerprint
    || input.localEvidence.widthPx <= 0
    || input.localEvidence.heightPx <= 0
    || input.localEvidence.structuralMask.widthPx !== input.localEvidence.widthPx
    || input.localEvidence.structuralMask.heightPx !== input.localEvidence.heightPx
  ) {
    return baseProposal(input, ["invalid-local-evidence"], null);
  }
  if (input.proposal.openingKind !== "door") {
    return baseProposal(input, ["unsupported-opening-kind-for-door-sanitizer"], null);
  }
  if (!providerEvidenceValid(input.proposal)) {
    return baseProposal(input, ["provider-door-evidence-incomplete"], null);
  }

  const selected = selectHost(
    input.proposal,
    draft.walls,
    input.localEvidence.widthPx,
    input.localEvidence.heightPx,
  );
  if (!selected.host) return baseProposal(input, [selected.reason!], null);
  const host = selected.host;
  if (angleDelta(input.proposal.orientationDeg, host.angleDeg) > HOST_ANGLE_TOLERANCE_DEG) {
    return baseProposal(input, ["opening-orientation-mismatch"], host.wall.id);
  }

  const proposedWidthPx = input.proposal.widthNormalized * host.pixelScalePerNormalizedUnit;
  if (!Number.isFinite(proposedWidthPx) || proposedWidthPx <= 0) {
    return baseProposal(input, ["invalid-opening-width"], host.wall.id);
  }
  const localMatch = localEvidenceMatch(
    input,
    host,
    input.localEvidence.widthPx,
    input.localEvidence.heightPx,
    proposedWidthPx,
  );
  if (localMatch.reason) {
    return baseProposal(input, [localMatch.reason], host.wall.id);
  }

  const projected = projectCenter(
    input.proposal.center,
    host,
    input.localEvidence.widthPx,
    input.localEvidence.heightPx,
  );
  const candidate = validatedOpeningCandidate(
    input.proposal,
    host,
    projected.snapped,
    proposedWidthPx,
    localMatch.reasons,
  );
  const authority = validateOpeningHypotheses({
    widthPx: input.localEvidence.widthPx,
    heightPx: input.localEvidence.heightPx,
    wallCandidates: draft.walls,
    hypotheses: [candidate],
  });
  if (authority.candidates.length !== 1) {
    return baseProposal(
      input,
      authority.rejections.map(({ code }) => code),
      host.wall.id,
    );
  }
  if (structuralOccupancy(input.localEvidence, host, projected.snapped, proposedWidthPx)
    >= STRUCTURAL_OCCUPANCY_BLOCK_THRESHOLD) {
    return baseProposal(input, ["structural-mask-blocked"], host.wall.id);
  }
  if (overlapsExisting(
    draft,
    host,
    projected.snapped,
    proposedWidthPx,
    input.localEvidence.widthPx,
    input.localEvidence.heightPx,
  )) {
    return baseProposal(input, ["opening-overlap-existing"], host.wall.id);
  }
  if (overlapsSibling(
    input.acceptedSiblingProposals,
    host,
    projected.snapped,
    proposedWidthPx,
    input.localEvidence.widthPx,
    input.localEvidence.heightPx,
  )) {
    return baseProposal(input, ["opening-overlap-sibling"], host.wall.id);
  }

  const accepted = authority.candidates[0]!;
  return {
    ...baseProposal(input, [], host.wall.id),
    state: "eligible",
    geometry: {
      kind: "opening",
      center: accepted.center,
      widthNormalized: accepted.widthPx! / host.pixelScalePerNormalizedUnit,
      orientationDeg: accepted.orientationDeg ?? host.angleDeg,
    },
    deterministicConfidence: "medium",
    evidence: {
      providerReasons: [...input.proposal.reasonCodes],
      validatorReasons: [...new Set([
        "local-rejected-door-evidence-matched",
        "structural-gap-validated",
        ...accepted.evidence.reasons,
      ])].sort(),
    },
  };
}
