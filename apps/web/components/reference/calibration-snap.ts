import type { Point2 } from "@vlezet/geometry";

export type CalibrationSourceFeatureKind = "edge" | "line-center" | "intersection";

export type CalibrationSourceFeature = Readonly<{
  id: string;
  kind: CalibrationSourceFeatureKind;
  point: Point2;
  strength: number;
}>;

export type CalibrationSnapReason = "snapped" | "ambiguous" | "none" | "disabled" | "suppressed";

export type CalibrationSnapResult = Readonly<{
  snapped: boolean;
  candidateId: string | null;
  kind: CalibrationSourceFeatureKind | "none";
  point: Point2;
  reason: CalibrationSnapReason;
}>;

export type ResolveCalibrationSnapInput = Readonly<{
  rawPoint: Point2;
  features: readonly CalibrationSourceFeature[];
  viewportScale: number;
  acquisitionRadiusPx: number;
  releaseRadiusPx: number;
  distanceEquivalencePx: number;
  minimumStrength: number;
  activeCandidateId: string | null;
  snappingEnabled: boolean;
  suppressed: boolean;
}>;

type Candidate = Readonly<{
  feature: CalibrationSourceFeature;
  screenDistance: number;
}>;

const FEATURE_PRIORITY: Readonly<Record<CalibrationSourceFeatureKind, number>> = {
  edge: 0,
  "line-center": 1,
  intersection: 2,
};

function distance(first: Point2, second: Point2): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function noSnap(point: Point2, reason: Exclude<CalibrationSnapReason, "snapped">): CalibrationSnapResult {
  return { snapped: false, candidateId: null, kind: "none", point, reason };
}

function snap(feature: CalibrationSourceFeature): CalibrationSnapResult {
  return {
    snapped: true,
    candidateId: feature.id,
    kind: feature.kind,
    point: feature.point,
    reason: "snapped",
  };
}

function candidateFor(
  feature: CalibrationSourceFeature,
  rawPoint: Point2,
  viewportScale: number,
): Candidate {
  return {
    feature,
    screenDistance: distance(rawPoint, feature.point) * viewportScale,
  };
}

export function resolveCalibrationSnap(input: ResolveCalibrationSnapInput): CalibrationSnapResult {
  if (!input.snappingEnabled) return noSnap(input.rawPoint, "disabled");
  if (input.suppressed) return noSnap(input.rawPoint, "suppressed");

  const eligibleFeatures = input.features.filter((feature) => feature.strength >= input.minimumStrength);
  const active = input.activeCandidateId === null
    ? null
    : eligibleFeatures.find((feature) => feature.id === input.activeCandidateId) ?? null;
  if (active) {
    const activeDistance = distance(input.rawPoint, active.point) * input.viewportScale;
    if (activeDistance <= input.releaseRadiusPx) return snap(active);
  }

  const candidates = eligibleFeatures
    .map((feature) => candidateFor(feature, input.rawPoint, input.viewportScale))
    .filter((candidate) => candidate.screenDistance <= input.acquisitionRadiusPx)
    .sort((first, second) => first.screenDistance - second.screenDistance || first.feature.id.localeCompare(second.feature.id));
  const nearest = candidates[0];
  if (!nearest) return noSnap(input.rawPoint, "none");

  const equivalent = candidates.filter(
    (candidate) => candidate.screenDistance - nearest.screenDistance <= input.distanceEquivalencePx,
  );
  if (equivalent.length === 1) return snap(nearest.feature);

  const highestPriority = Math.max(...equivalent.map((candidate) => FEATURE_PRIORITY[candidate.feature.kind]));
  const preferred = equivalent.filter((candidate) => FEATURE_PRIORITY[candidate.feature.kind] === highestPriority);
  if (preferred.length !== 1) return noSnap(input.rawPoint, "ambiguous");
  return snap(preferred[0]!.feature);
}
