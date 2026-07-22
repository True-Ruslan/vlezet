import type {
  NormalizedPoint,
  RecognitionDiagnostic,
  RecognitionProviderResult,
  RecognitionWallCandidate,
} from "./index";

export type CloudRecognitionSanityInput = Readonly<{
  result: RecognitionProviderResult;
  localSummary: Readonly<{
    walls: readonly RecognitionWallCandidate[];
    openings: readonly unknown[];
  }> | null;
}>;

type Bounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;

function wallLength(wall: RecognitionWallCandidate): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

function boundsOfWalls(walls: readonly RecognitionWallCandidate[]): Bounds | null {
  if (walls.length === 0) return null;
  const points = walls.flatMap((wall) => [wall.start, wall.end]);
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function segmentNear(a: RecognitionWallCandidate, b: RecognitionWallCandidate): boolean {
  const pointDistance = (p: NormalizedPoint, q: NormalizedPoint) => Math.hypot(p.x - q.x, p.y - q.y);
  const direct = (pointDistance(a.start, b.start) + pointDistance(a.end, b.end)) / 2;
  const reverse = (pointDistance(a.start, b.end) + pointDistance(a.end, b.start)) / 2;
  return Math.min(direct, reverse) <= 0.04;
}

function outsideSameSide(wall: RecognitionWallCandidate, bounds: Bounds): boolean {
  const width = Math.max(0.01, bounds.maxX - bounds.minX);
  const height = Math.max(0.01, bounds.maxY - bounds.minY);
  const marginX = Math.max(0.025, width * 0.08);
  const marginY = Math.max(0.025, height * 0.08);

  return (
    (wall.start.x < bounds.minX - marginX && wall.end.x < bounds.minX - marginX) ||
    (wall.start.x > bounds.maxX + marginX && wall.end.x > bounds.maxX + marginX) ||
    (wall.start.y < bounds.minY - marginY && wall.end.y < bounds.minY - marginY) ||
    (wall.start.y > bounds.maxY + marginY && wall.end.y > bounds.maxY + marginY)
  );
}

function isFrameLikeUnsupportedWall(
  wall: RecognitionWallCandidate,
  localWalls: readonly RecognitionWallCandidate[],
  localBounds: Bounds,
): boolean {
  if (wallLength(wall) < 0.25) return false;
  if (localWalls.some((local) => segmentNear(local, wall))) return false;
  return outsideSameSide(wall, localBounds);
}

export function sanitizeCloudRecognitionResult(input: CloudRecognitionSanityInput): RecognitionProviderResult {
  const diagnostics: RecognitionDiagnostic[] = [...(input.result.diagnostics ?? [])];
  const localWalls = input.localSummary?.walls ?? [];
  const localBounds = localWalls.length >= 4 ? boundsOfWalls(localWalls) : null;
  const droppedWallIds = new Set<string>();

  const walls = input.result.walls.filter((wall) => {
    if (wallLength(wall) < 0.005) {
      droppedWallIds.add(wall.id);
      diagnostics.push({
        code: "cloud-degenerate-wall",
        severity: "warning",
        message: "AI предложил вырожденную стену; она отброшена до review.",
        candidateId: wall.id,
      });
      return false;
    }
    if (localBounds && isFrameLikeUnsupportedWall(wall, localWalls, localBounds)) {
      droppedWallIds.add(wall.id);
      diagnostics.push({
        code: "cloud-frame-artifact",
        severity: "warning",
        message: "AI предложил длинную линию вне подтверждённой области плана; вероятная рамка/граница изображения отброшена.",
        candidateId: wall.id,
      });
      return false;
    }
    return true;
  });

  const survivingWallIds = new Set(walls.map((wall) => wall.id));
  const openings = input.result.openings.filter((opening) => {
    if (opening.hostWallCandidateId && (droppedWallIds.has(opening.hostWallCandidateId) || !survivingWallIds.has(opening.hostWallCandidateId))) {
      diagnostics.push({
        code: "cloud-invalid-opening-host",
        severity: "warning",
        message: "AI-проём ссылается на отброшенную или неизвестную стену и не будет показан.",
        candidateId: opening.id,
      });
      return false;
    }
    return true;
  });

  return {
    walls,
    openings,
    roomLabels: input.result.roomLabels,
    diagnostics,
  };
}
