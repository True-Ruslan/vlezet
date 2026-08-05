import type { RecognitionAiRejectedOpeningEvidence } from "./ai-rejected-opening-evidence";
import { peekAiRejectedOpeningEvidenceForDraft } from "./ai-rejected-opening-evidence";
import type { SanitizedRecognitionProposal } from "./ai-proposals";
import type {
  SanitizeAiOpeningProposalInput,
  SanitizedAiOpeningProposal,
} from "./ai-opening-sanitizer";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type {
  NormalizedPoint,
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { validateRecognitionDraft } from "./model";
import { validateOpeningHypotheses } from "./opening-analysis-with-ai-evidence";

const MATCH_ORIENTATION_TOLERANCE_DEG = 18;
const MINIMUM_OPENING_SEPARATION_PX = 8;
const STRUCTURAL_OCCUPANCY_BLOCK_THRESHOLD = 0.45;

const WINDOW_EVIDENCE_TOKENS = [
  "paired-window-rails",
  "paired-cross-lines",
  "parallel-window-rails",
  "window-frame",
] as const;

const DOOR_EVIDENCE_TOKENS = [
  "door-leaf",
  "door-arc",
  "door-leaf-anchored",
  "door-arc-like-line",
] as const;

const WINDOW_HOST_CONTEXT_TOKENS = [
  "window-symbol-host-bridge",
  "exterior-boundary-host-bridge",
  "exterior-boundary-gap",
  "structural-network-boundary-gap",
  "exterior-boundary",
  "structural-network-boundary",
  "balcony",
  "loggia",
] as const;

const FORBIDDEN_WINDOW_EVIDENCE_TOKENS = [
  "sanitary",
  "furniture",
  "dimension",
  "text",
  "label",
  "fixture",
  "source-frame",
  "image-frame",
  "crop-border",
] as const;

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

type LocalWindowMatch = Readonly<{
  reasons: readonly string[];
  reason: string | null;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function canonicalReasons(reasons: readonly string[]): readonly string[] {
  return reasons.map((reason) => reason.toLowerCase());
}

function hasToken(reasons: readonly string[], tokens: readonly string[]): boolean {
  const canonical = canonicalReasons(reasons);
  return canonical.some((reason) => tokens.some((token) => reason.includes(token)));
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
  const normalizedLength = Math.hypot(
    wall.end.x - wall.start.x,
    wall.end.y - wall.start.y,
  );
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

function proposalId(input: SanitizeAiOpeningProposalInput): string {
  return `ai-proposal:${input.provider.requestId}:${input.proposal.id}`;
}

function baseProposal(
  input: SanitizeAiOpeningProposalInput,
  validatorReasons: readonly string[],
  hostWallCandidateId: string | null,
): SanitizedAiOpeningProposal {
  return {
    id: proposalId(input),
    rawProposalId: input.proposal.id,
    kind: "window",
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

function duplicateProposal(
  input: SanitizeAiOpeningProposalInput,
  hostWallCandidateId: string,
): SanitizedAiOpeningProposal {
  return {
    ...baseProposal(input, ["opening-duplicate-existing"], hostWallCandidateId),
    state: "duplicate",
  };
}

function selectExactHost(
  input: SanitizeAiOpeningProposalInput,
  walls: readonly RecognitionWallCandidate[],
): Readonly<{ host: HostGeometry | null; reason: string | null }> {
  if (input.proposal.hostWallHintIds.length === 0) {
    return { host: null, reason: "missing-host-wall" };
  }
  if (input.proposal.hostWallHintIds.length !== 1) {
    return { host: null, reason: "ambiguous-host-wall" };
  }
  const hostId = input.proposal.hostWallHintIds[0]!;
  const wall = walls.find(({ id, conflict }) => id === hostId && conflict === null);
  if (!wall) return { host: null, reason: "unknown-host-wall-hint" };
  const geometry = hostGeometry(wall, input.localEvidence.widthPx, input.localEvidence.heightPx);
  return geometry
    ? { host: geometry, reason: null }
    : { host: null, reason: "invalid-host-wall" };
}

function providerEvidenceValid(input: SanitizeAiOpeningProposalInput): boolean {
  const reasons = input.proposal.reasonCodes;
  return reasons.includes("visible-gap")
    && (reasons.includes("parallel-window-rails") || reasons.includes("window-frame"))
    && (reasons.includes("exterior-boundary-context") || reasons.includes("balcony-boundary-context"));
}

function matchingDistance(
  item: RecognitionAiRejectedOpeningEvidence,
  proposalCenter: PixelPoint,
  proposedWidthPx: number,
  widthPx: number,
  heightPx: number,
): boolean {
  const itemCenter = pixelPoint(item.center, widthPx, heightPx);
  const itemWidth = item.widthPx;
  const centerTolerance = itemWidth === null
    ? 28
    : Math.max(14, Math.min(itemWidth, proposedWidthPx) * 0.25);
  if (Math.hypot(itemCenter.x - proposalCenter.x, itemCenter.y - proposalCenter.y) > centerTolerance) {
    return false;
  }
  if (itemWidth !== null) {
    const widthRatio = Math.min(itemWidth, proposedWidthPx) / Math.max(itemWidth, proposedWidthPx);
    if (widthRatio < 0.65) return false;
  }
  return true;
}

function localWindowEvidenceMatch(
  input: SanitizeAiOpeningProposalInput,
  host: HostGeometry,
  proposedWidthPx: number,
): LocalWindowMatch {
  const evidence = peekAiRejectedOpeningEvidenceForDraft(input.localDraft);
  if (
    !evidence
    || evidence.widthPx !== input.localEvidence.widthPx
    || evidence.heightPx !== input.localEvidence.heightPx
  ) {
    return { reasons: [], reason: "missing-local-window-rail-evidence" };
  }
  const proposalCenter = pixelPoint(
    input.proposal.center,
    input.localEvidence.widthPx,
    input.localEvidence.heightPx,
  );
  const nearby = evidence.items.filter((item) => {
    if (item.hostWallCandidateId !== host.wall.id) return false;
    if (!matchingDistance(
      item,
      proposalCenter,
      proposedWidthPx,
      input.localEvidence.widthPx,
      input.localEvidence.heightPx,
    )) return false;
    if (
      item.orientationDeg !== null
      && angleDelta(item.orientationDeg, host.angleDeg) > MATCH_ORIENTATION_TOLERANCE_DEG
    ) return false;
    return true;
  });

  if (nearby.some((item) => item.kind === "door" || hasToken(item.reasonCodes, DOOR_EVIDENCE_TOKENS))) {
    return { reasons: [], reason: "window-evidence-is-door-classified" };
  }

  const windowLike = nearby.filter((item) =>
    (item.kind === "window" || item.kind === "unknown-opening")
    && hasToken(item.reasonCodes, WINDOW_EVIDENCE_TOKENS));
  if (windowLike.length === 0) {
    return { reasons: [], reason: "missing-local-window-rail-evidence" };
  }
  if (windowLike.length > 1) {
    return { reasons: [], reason: "ambiguous-local-window-evidence" };
  }
  const matched = windowLike[0]!;
  if (hasToken(matched.reasonCodes, FORBIDDEN_WINDOW_EVIDENCE_TOKENS)) {
    return { reasons: matched.reasonCodes, reason: "forbidden-local-window-evidence" };
  }
  return { reasons: matched.reasonCodes, reason: null };
}

function windowHostContextValid(
  host: RecognitionWallCandidate,
  localReasons: readonly string[],
): boolean {
  return hasToken(host.evidence.reasons, WINDOW_HOST_CONTEXT_TOKENS)
    || hasToken(localReasons, WINDOW_HOST_CONTEXT_TOKENS);
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

function geometricDuplicate(
  openings: readonly RecognitionOpeningCandidate[],
  host: HostGeometry,
  center: NormalizedPoint,
  widthPx: number,
  imageWidthPx: number,
  imageHeightPx: number,
): boolean {
  const proposedCenter = pixelPoint(center, imageWidthPx, imageHeightPx);
  return openings.some((opening) => {
    if (
      opening.kind !== "window"
      || opening.conflict !== null
      || opening.hostWallCandidateId !== host.wall.id
      || opening.widthPx === null
    ) return false;
    const existingCenter = pixelPoint(opening.center, imageWidthPx, imageHeightPx);
    const centerTolerance = Math.max(14, Math.min(opening.widthPx, widthPx) * 0.25);
    if (Math.hypot(existingCenter.x - proposedCenter.x, existingCenter.y - proposedCenter.y) > centerTolerance) {
      return false;
    }
    const widthRatio = Math.min(opening.widthPx, widthPx) / Math.max(opening.widthPx, widthPx);
    return widthRatio >= 0.65;
  });
}

function overlapsExisting(
  openings: readonly RecognitionOpeningCandidate[],
  host: HostGeometry,
  center: NormalizedPoint,
  widthPx: number,
  imageWidthPx: number,
  imageHeightPx: number,
): boolean {
  const proposed = intervalForOpening(center, widthPx, host, imageWidthPx, imageHeightPx);
  return openings.some((opening) => {
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

function structuralOccupancy(
  input: SanitizeAiOpeningProposalInput,
  host: HostGeometry,
  center: NormalizedPoint,
  widthPx: number,
): number {
  const projected = projectCenter(
    center,
    host,
    input.localEvidence.widthPx,
    input.localEvidence.heightPx,
  );
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
      if (input.localEvidence.structuralMask.isStructural(x, y)) structural += 1;
    }
  }
  return samples === 0 ? 1 : structural / samples;
}

function candidate(
  input: SanitizeAiOpeningProposalInput,
  host: HostGeometry,
  center: NormalizedPoint,
  widthPx: number,
  localReasons: readonly string[],
): RecognitionOpeningCandidate {
  return {
    id: `ai-opening:${input.proposal.id}`,
    kind: "window",
    hostWallCandidateId: host.wall.id,
    center,
    widthPx,
    orientationDeg: host.angleDeg,
    confidence: "low",
    evidence: {
      localScore: 0.55,
      cloudScore: input.proposal.modelConfidence,
      reasons: [...new Set([
        ...localReasons,
        ...input.proposal.reasonCodes,
        "ai-proposal",
        "local-rejected-window-evidence-matched",
      ])].sort(),
    },
    origin: "merged",
    conflict: null,
  };
}

export function sanitizeAiWindowOpeningProposal(
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
  if (input.proposal.openingKind !== "window") {
    return baseProposal(input, ["unsupported-opening-kind-for-window-sanitizer"], null);
  }
  if (!providerEvidenceValid(input)) {
    return baseProposal(input, ["provider-window-evidence-incomplete"], null);
  }

  const selected = selectExactHost(input, draft.walls);
  if (!selected.host) return baseProposal(input, [selected.reason!], null);
  const host = selected.host;
  const proposedWidthPx = input.proposal.widthNormalized * host.pixelScalePerNormalizedUnit;
  if (!Number.isFinite(proposedWidthPx) || proposedWidthPx <= 0) {
    return baseProposal(input, ["invalid-opening-width"], host.wall.id);
  }
  const projected = projectCenter(
    input.proposal.center,
    host,
    input.localEvidence.widthPx,
    input.localEvidence.heightPx,
  );
  const opening = candidate(input, host, projected.snapped, proposedWidthPx, []);
  const authority = validateOpeningHypotheses({
    widthPx: input.localEvidence.widthPx,
    heightPx: input.localEvidence.heightPx,
    wallCandidates: draft.walls,
    hypotheses: [opening],
  });
  if (authority.candidates.length !== 1) {
    return baseProposal(input, authority.rejections.map(({ code }) => code), host.wall.id);
  }

  if (geometricDuplicate(
    draft.openings,
    host,
    projected.snapped,
    proposedWidthPx,
    input.localEvidence.widthPx,
    input.localEvidence.heightPx,
  )) {
    return duplicateProposal(input, host.wall.id);
  }

  const localMatch = localWindowEvidenceMatch(input, host, proposedWidthPx);
  if (localMatch.reason) {
    return baseProposal(input, [localMatch.reason], host.wall.id);
  }
  if (!windowHostContextValid(host.wall, localMatch.reasons)) {
    return baseProposal(
      input,
      ["window-host-not-exterior-or-balcony-compatible"],
      host.wall.id,
    );
  }

  if (structuralOccupancy(input, host, projected.snapped, proposedWidthPx)
    >= STRUCTURAL_OCCUPANCY_BLOCK_THRESHOLD) {
    return baseProposal(input, ["structural-mask-blocked"], host.wall.id);
  }
  if (overlapsExisting(
    draft.openings,
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
  const acceptedWithEvidence = candidate(
    input,
    host,
    accepted.center,
    accepted.widthPx!,
    localMatch.reasons,
  );
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
        "local-rejected-window-evidence-matched",
        "window-host-context-validated",
        "structural-gap-validated",
        ...acceptedWithEvidence.evidence.reasons,
        ...accepted.evidence.reasons,
      ])].sort(),
    },
  };
}
