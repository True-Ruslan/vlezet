import { worldPointToImage, type Point2, type StructuralSnapResult } from "@vlezet/geometry";
import type { ReferencePlan } from "@vlezet/projects";
import type { CalibrationSourceFeature } from "../reference/calibration-snap";
import {
  resolveReferenceSourceAssist,
  type ReferenceSourceAssistResult,
} from "../reference/reference-source-assist";
import { readWallSourceFeatures } from "../reference/wall-source-feature-reader";
import {
  isTopologyStructuralSnapKind,
  resolveWallPointerAssist,
  type WallPointerAssistDecision,
} from "./wall-pointer-assist";

const SOURCE_ACQUISITION_RADIUS_PX = 12;
const SOURCE_RELEASE_RADIUS_PX = 18;
const SOURCE_DISTANCE_EQUIVALENCE_PX = 1;
const SOURCE_MINIMUM_STRENGTH = 0.35;

export type WallSourceAssistActiveCandidate = Readonly<{
  id: string;
  referenceRevision: string;
}>;

export type WallSourceFeatureReader = (input: Readonly<{
  image: Readonly<{ naturalWidth: number; naturalHeight: number }>;
  point: Point2;
  viewportScale: number;
}>) => readonly CalibrationSourceFeature[];

export type WallSourceAssistControllerResult = Readonly<{
  decision: WallPointerAssistDecision;
  sourceAssist: ReferenceSourceAssistResult | null;
  activeCandidate: WallSourceAssistActiveCandidate | null;
}>;

export type ResolveWallSourceAssistControllerInput = Readonly<{
  rawWorldPoint: Point2;
  structuralSnap: StructuralSnapResult;
  referencePlan: ReferencePlan | null;
  referenceImage: Readonly<{ naturalWidth: number; naturalHeight: number }> | null;
  pixelsPerMillimeter: number;
  enabled: boolean;
  suppressed: boolean;
  activeCandidate: WallSourceAssistActiveCandidate | null;
  readFeatures?: WallSourceFeatureReader;
}>;

function ordinary(structuralSnap: StructuralSnapResult): WallSourceAssistControllerResult {
  return {
    decision: resolveWallPointerAssist({ structuralSnap, sourceAssist: null }),
    sourceAssist: null,
    activeCandidate: null,
  };
}

export function resolveWallSourceAssistController(
  input: ResolveWallSourceAssistControllerInput,
): WallSourceAssistControllerResult {
  const reference = input.referencePlan;
  const image = input.referenceImage;

  if (
    !input.enabled ||
    input.suppressed ||
    !reference ||
    !reference.display.visible ||
    !image ||
    isTopologyStructuralSnapKind(input.structuralSnap.kind)
  ) {
    return ordinary(input.structuralSnap);
  }

  const sourcePoint = worldPointToImage(input.rawWorldPoint, reference.transform);
  if (
    sourcePoint.x < 0 ||
    sourcePoint.x > reference.widthPx ||
    sourcePoint.y < 0 ||
    sourcePoint.y > reference.heightPx
  ) {
    return ordinary(input.structuralSnap);
  }

  try {
    const readFeatures = input.readFeatures ?? readWallSourceFeatures;
    const viewportScale = input.pixelsPerMillimeter * reference.transform.millimetersPerPixel;
    const features = readFeatures({ image, point: sourcePoint, viewportScale });
    const activeCandidateId = input.activeCandidate?.referenceRevision === reference.referenceRevision
      ? input.activeCandidate.id
      : null;
    const sourceAssist = resolveReferenceSourceAssist({
      rawWorldPoint: input.rawWorldPoint,
      reference: {
        widthPx: reference.widthPx,
        heightPx: reference.heightPx,
        transform: reference.transform,
      },
      features,
      pixelsPerMillimeter: input.pixelsPerMillimeter,
      acquisitionRadiusPx: SOURCE_ACQUISITION_RADIUS_PX,
      releaseRadiusPx: SOURCE_RELEASE_RADIUS_PX,
      distanceEquivalencePx: SOURCE_DISTANCE_EQUIVALENCE_PX,
      minimumStrength: SOURCE_MINIMUM_STRENGTH,
      activeCandidateId,
      enabled: true,
      suppressed: false,
    });
    const decision = resolveWallPointerAssist({ structuralSnap: input.structuralSnap, sourceAssist });
    return {
      decision,
      sourceAssist,
      activeCandidate: decision.authority === "source" && sourceAssist.candidateId
        ? { id: sourceAssist.candidateId, referenceRevision: reference.referenceRevision }
        : null,
    };
  } catch {
    return ordinary(input.structuralSnap);
  }
}
