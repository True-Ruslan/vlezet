import { getWallEndpoints, type VlezetDocument } from "@vlezet/domain";
import { worldPointToImage } from "@vlezet/geometry";
import type { ReferencePlan } from "@vlezet/projects";
import type { ExistingRecognitionWall, NormalizedPoint } from "@vlezet/recognition";

function normalized(point: Readonly<{ x: number; y: number }>, referencePlan: ReferencePlan): NormalizedPoint {
  const image = worldPointToImage(point, referencePlan.transform);
  return {
    x: Math.max(0, Math.min(1, image.x / referencePlan.widthPx)),
    y: Math.max(0, Math.min(1, image.y / referencePlan.heightPx)),
  };
}

export function existingWallsInReferenceSpace(
  document: VlezetDocument,
  referencePlan: ReferencePlan,
): readonly ExistingRecognitionWall[] {
  return document.walls.map((wall) => {
    const endpoints = getWallEndpoints(document, wall);
    return {
      start: normalized(endpoints.start.position, referencePlan),
      end: normalized(endpoints.end.position, referencePlan),
    };
  });
}
