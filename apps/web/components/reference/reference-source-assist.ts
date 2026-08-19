import {
  imagePointToWorld,
  worldPointToImage,
  type Point2,
  type ReferenceTransform,
} from "@vlezet/geometry";
import {
  resolveCalibrationSnap,
  type CalibrationSnapResult,
  type CalibrationSourceFeature,
  type CalibrationSourceFeatureKind,
} from "./calibration-snap";

export type ReferenceSourceAssistReason =
  | "acquired"
  | "ambiguous"
  | "none"
  | "disabled"
  | "suppressed"
  | "outside-reference";

export type ReferenceSourceAssistResult = Readonly<{
  acquired: boolean;
  candidateId: string | null;
  kind: CalibrationSourceFeatureKind | "none";
  sourcePoint: Point2;
  worldPoint: Point2;
  reason: ReferenceSourceAssistReason;
}>;

export type ResolveReferenceSourceAssistInput = Readonly<{
  rawWorldPoint: Point2;
  reference: Readonly<{
    widthPx: number;
    heightPx: number;
    transform: ReferenceTransform;
  }>;
  features: readonly CalibrationSourceFeature[];
  pixelsPerMillimeter: number;
  acquisitionRadiusPx: number;
  releaseRadiusPx: number;
  distanceEquivalencePx: number;
  minimumStrength: number;
  activeCandidateId: string | null;
  enabled: boolean;
  suppressed: boolean;
}>;

const SOURCE_FEATURE_PRIORITY: Readonly<Record<CalibrationSourceFeatureKind, number>> = {
  edge: 0,
  "line-center": 1,
  intersection: 2,
};

function noAssist(
  sourcePoint: Point2,
  worldPoint: Point2,
  reason: Exclude<ReferenceSourceAssistReason, "acquired">,
): ReferenceSourceAssistResult {
  return {
    acquired: false,
    candidateId: null,
    kind: "none",
    sourcePoint,
    worldPoint,
    reason,
  };
}

function insideReference(point: Point2, widthPx: number, heightPx: number): boolean {
  return point.x >= 0 && point.x <= widthPx && point.y >= 0 && point.y <= heightPx;
}

function sourceFeaturePriority(kind: CalibrationSnapResult["kind"]): number {
  return kind === "none" ? -1 : SOURCE_FEATURE_PRIORITY[kind];
}

function preferHigherPriorityFreshSnap(
  sticky: CalibrationSnapResult,
  fresh: CalibrationSnapResult,
): CalibrationSnapResult {
  if (!sticky.snapped) return fresh;
  if (!fresh.snapped) return sticky;
  return sourceFeaturePriority(fresh.kind) > sourceFeaturePriority(sticky.kind) ? fresh : sticky;
}

export function resolveReferenceSourceAssist(
  input: ResolveReferenceSourceAssistInput,
): ReferenceSourceAssistResult {
  const sourcePoint = worldPointToImage(input.rawWorldPoint, input.reference.transform);

  if (!input.enabled) return noAssist(sourcePoint, input.rawWorldPoint, "disabled");
  if (input.suppressed) return noAssist(sourcePoint, input.rawWorldPoint, "suppressed");
  if (!insideReference(sourcePoint, input.reference.widthPx, input.reference.heightPx)) {
    return noAssist(sourcePoint, input.rawWorldPoint, "outside-reference");
  }

  const snapInput = {
    rawPoint: sourcePoint,
    features: input.features,
    viewportScale: input.pixelsPerMillimeter * input.reference.transform.millimetersPerPixel,
    acquisitionRadiusPx: input.acquisitionRadiusPx,
    releaseRadiusPx: input.releaseRadiusPx,
    distanceEquivalencePx: input.distanceEquivalencePx,
    minimumStrength: input.minimumStrength,
    snappingEnabled: true,
    suppressed: false,
  } as const;
  const stickySnap = resolveCalibrationSnap({
    ...snapInput,
    activeCandidateId: input.activeCandidateId,
  });
  const snap = input.activeCandidateId === null
    ? stickySnap
    : preferHigherPriorityFreshSnap(
        stickySnap,
        resolveCalibrationSnap({ ...snapInput, activeCandidateId: null }),
      );

  if (!snap.snapped) {
    return noAssist(
      sourcePoint,
      input.rawWorldPoint,
      snap.reason === "ambiguous" ? "ambiguous" : "none",
    );
  }

  return {
    acquired: true,
    candidateId: snap.candidateId,
    kind: snap.kind,
    sourcePoint: snap.point,
    worldPoint: imagePointToWorld(snap.point, input.reference.transform),
    reason: "acquired",
  };
}
