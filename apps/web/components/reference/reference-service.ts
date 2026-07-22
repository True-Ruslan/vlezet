import { calibrateReferencePlan, type Point2 } from "@vlezet/geometry";
import {
  createProjectAsset,
  replaceProjectReferencePlan,
  replaceReferenceAssetTransaction,
  type ProjectAssetRepository,
  type ProjectRepository,
  type ReferenceAlignment,
  type ReferencePlanSource,
  type VlezetProjectRecord,
} from "@vlezet/projects";
import type { NormalizedReferenceRaster } from "./raster-normalizer";
import { ReferenceImportError } from "./reference-file";

export type ReferenceRepository = ProjectRepository & ProjectAssetRepository;

export type InstallReferencePlanInput = Readonly<{
  project: VlezetProjectRecord;
  repository: ReferenceRepository;
  raster: NormalizedReferenceRaster;
  source: ReferencePlanSource;
  pointA: Point2;
  pointB: Point2;
  knownLengthMm: number;
  alignment: ReferenceAlignment;
  originWorld: Point2;
  assetId: string;
  referenceRevision: string;
  now: string;
}>;

export async function installReferencePlan(input: InstallReferencePlanInput): Promise<VlezetProjectRecord> {
  const calibrated = calibrateReferencePlan({
    widthPx: input.raster.widthPx,
    heightPx: input.raster.heightPx,
    pointA: input.pointA,
    pointB: input.pointB,
    knownLengthMm: input.knownLengthMm,
    originWorld: input.originWorld,
    alignment: input.alignment,
  });
  const asset = createProjectAsset({
    id: input.assetId,
    projectId: input.project.id,
    mimeType: input.raster.mimeType,
    createdAt: input.now,
    blob: input.raster.blob,
  });
  const next = replaceProjectReferencePlan(input.project, {
    assetId: asset.id,
    referenceRevision: input.referenceRevision,
    source: input.source,
    widthPx: calibrated.widthPx,
    heightPx: calibrated.heightPx,
    transform: calibrated.transform,
    calibration: calibrated.calibration,
    display: { visible: true, opacity: 0.45, locked: true },
  }, input.now);
  try {
    await replaceReferenceAssetTransaction({
      repository: input.repository,
      oldAssetId: input.project.referencePlan?.assetId ?? null,
      newAsset: asset,
      persistMetadata: () => input.repository.put(next),
    });
    return next;
  } catch (cause) {
    throw new ReferenceImportError("storage-failed", "Не удалось сохранить подложку в этом браузере.", { cause });
  }
}

export async function removeReferencePlan(
  project: VlezetProjectRecord,
  repository: ReferenceRepository,
  now: string,
): Promise<VlezetProjectRecord> {
  if (!project.referencePlan) return project;
  const assetId = project.referencePlan.assetId;
  const next = replaceProjectReferencePlan(project, null, now);
  try {
    await repository.put(next);
    await repository.deleteAsset(assetId);
    return next;
  } catch (cause) {
    throw new ReferenceImportError("storage-failed", "Не удалось удалить подложку из локального проекта.", { cause });
  }
}
