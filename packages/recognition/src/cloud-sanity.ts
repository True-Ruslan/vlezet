import type {
  NormalizedPoint,
  RecognitionDiagnostic,
  RecognitionOpeningCandidate,
  RecognitionProviderResult,
  RecognitionWallCandidate,
} from "./index";

export type CloudRecognitionSanityInput = Readonly<{
  result: RecognitionProviderResult;
  localSummary: Readonly<{
    walls: readonly RecognitionWallCandidate[];
    openings: readonly RecognitionOpeningCandidate[];
  }> | null;
}>;

type Bounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;

const MAX_REVIEWABLE_CLOUD_WALLS = 80;
const MAX_REVIEWABLE_CLOUD_OPENINGS = 80;
const MAX_UNSUPPORTED_CLOUD_WALL_LENGTH = 0.85;
const LOCAL_OPENING_CENTER_TOLERANCE = 0.00015;
const LOCAL_OPENING_WIDTH_TOLERANCE_PX = 0.5;
const LOCAL_OPENING_ORIENTATION_TOLERANCE_DEG = 0.1;

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

function hasLocalSupport(
  wall: RecognitionWallCandidate,
  localWalls: readonly RecognitionWallCandidate[],
): boolean {
  return localWalls.some((local) => segmentNear(local, wall));
}

function isFrameLikeUnsupportedWall(
  wall: RecognitionWallCandidate,
  localWalls: readonly RecognitionWallCandidate[],
  localBounds: Bounds,
): boolean {
  if (wallLength(wall) < 0.25) return false;
  if (hasLocalSupport(wall, localWalls)) return false;
  return outsideSameSide(wall, localBounds);
}

function isUnboundedUnsupportedWall(
  wall: RecognitionWallCandidate,
  localWalls: readonly RecognitionWallCandidate[],
): boolean {
  return wallLength(wall) >= MAX_UNSUPPORTED_CLOUD_WALL_LENGTH
    && !hasLocalSupport(wall, localWalls);
}

function close(first: number, second: number, tolerance: number): boolean {
  return Math.abs(first - second) <= tolerance;
}

function normalizedAngleDelta(first: number, second: number): number {
  return Math.abs((((first - second) % 360) + 540) % 360 - 180);
}

function openingGeometryMatches(
  cloud: RecognitionOpeningCandidate,
  local: RecognitionOpeningCandidate,
): boolean {
  const widthMatches = cloud.widthPx === null && local.widthPx === null
    ? true
    : cloud.widthPx !== null
      && local.widthPx !== null
      && close(cloud.widthPx, local.widthPx, LOCAL_OPENING_WIDTH_TOLERANCE_PX);
  const orientationMatches = cloud.orientationDeg === null && local.orientationDeg === null
    ? true
    : cloud.orientationDeg !== null
      && local.orientationDeg !== null
      && normalizedAngleDelta(cloud.orientationDeg, local.orientationDeg) <= LOCAL_OPENING_ORIENTATION_TOLERANCE_DEG;
  return (
    close(cloud.center.x, local.center.x, LOCAL_OPENING_CENTER_TOLERANCE)
    && close(cloud.center.y, local.center.y, LOCAL_OPENING_CENTER_TOLERANCE)
    && widthMatches
    && orientationMatches
  );
}

function localAuthoritativeOpening(
  cloud: RecognitionOpeningCandidate,
  local: RecognitionOpeningCandidate,
): RecognitionOpeningCandidate {
  return {
    ...cloud,
    id: local.id,
    hostWallCandidateId: local.hostWallCandidateId,
    center: local.center,
    widthPx: local.widthPx,
    orientationDeg: local.orientationDeg,
  };
}

export function sanitizeCloudRecognitionResult(input: CloudRecognitionSanityInput): RecognitionProviderResult {
  const diagnostics: RecognitionDiagnostic[] = [...(input.result.diagnostics ?? [])];
  const localWalls = input.localSummary?.walls ?? [];
  const localWallById = new Map(localWalls.map((wall) => [wall.id, wall]));
  const localBounds = localWalls.length >= 4 ? boundsOfWalls(localWalls) : null;
  const droppedWallIds = new Set<string>();

  let walls = input.result.walls.filter((wall) => {
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
    if (isUnboundedUnsupportedWall(wall, localWalls)) {
      droppedWallIds.add(wall.id);
      diagnostics.push({
        code: "cloud-unbounded-wall",
        severity: "warning",
        message: "AI предложил почти сквозную линию без локального подтверждения; она отброшена до review.",
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
    if (localWalls.length > 0) {
      const localWall = localWallById.get(wall.id);
      if (!localWall) {
        droppedWallIds.add(wall.id);
        diagnostics.push({
          code: "cloud-unknown-local-wall",
          severity: "warning",
          message: "AI вернул стену с неизвестным локальному Draft идентификатором; новая геометрия отброшена.",
          candidateId: wall.id,
        });
        return false;
      }
      if (!segmentNear(localWall, wall)) {
        droppedWallIds.add(wall.id);
        diagnostics.push({
          code: "cloud-local-wall-mismatch",
          severity: "warning",
          message: "AI изменил геометрию локальной стены за пределами допустимого совпадения; результат проверки отброшен.",
          candidateId: wall.id,
        });
        return false;
      }
    }
    return true;
  });

  if (walls.length > MAX_REVIEWABLE_CLOUD_WALLS) {
    const originalWallCount = walls.length;
    for (const wall of walls) droppedWallIds.add(wall.id);
    walls = [];
    diagnostics.push({
      code: "cloud-wall-candidate-overload",
      severity: "warning",
      message: `AI создал ${originalWallCount} кандидатов стен. Результат отклонён целиком как непроверяемый.`,
      candidateId: null,
    });
  }

  const survivingWallIds = new Set(walls.map((wall) => wall.id));
  const localOpenings = input.localSummary?.openings ?? [];
  const localOpeningById = new Map(localOpenings.map((opening) => [opening.id, opening]));
  const openings: RecognitionOpeningCandidate[] = [];

  if (input.result.openings.length > MAX_REVIEWABLE_CLOUD_OPENINGS) {
    diagnostics.push({
      code: "cloud-opening-candidate-overload",
      severity: "warning",
      message: `AI создал ${input.result.openings.length} кандидатов проёмов. Результат по проёмам отклонён целиком как непроверяемый.`,
      candidateId: null,
    });
  } else {
    for (const opening of input.result.openings) {
      const localOpening = localOpeningById.get(opening.id);
      if (!localOpening) {
        diagnostics.push({
          code: "cloud-unknown-local-opening",
          severity: "warning",
          message: "AI вернул проём с неизвестным локальному Draft идентификатором; новая геометрия отброшена.",
          candidateId: opening.id,
        });
        continue;
      }
      if (opening.hostWallCandidateId !== localOpening.hostWallCandidateId) {
        diagnostics.push({
          code: "cloud-local-opening-host-mismatch",
          severity: "warning",
          message: "AI попытался привязать локальный проём к другой стене; результат проверки отброшен.",
          candidateId: opening.id,
        });
        continue;
      }
      if (!openingGeometryMatches(opening, localOpening)) {
        diagnostics.push({
          code: "cloud-local-opening-geometry-mismatch",
          severity: "warning",
          message: "AI изменил положение, ширину или направление локального проёма; результат проверки отброшен.",
          candidateId: opening.id,
        });
        continue;
      }
      if (
        !localOpening.hostWallCandidateId
        || droppedWallIds.has(localOpening.hostWallCandidateId)
        || !survivingWallIds.has(localOpening.hostWallCandidateId)
      ) {
        diagnostics.push({
          code: "cloud-invalid-opening-host",
          severity: "warning",
          message: "AI-проём ссылается на отброшенную или неизвестную стену и не будет показан.",
          candidateId: opening.id,
        });
        continue;
      }
      openings.push(localAuthoritativeOpening(opening, localOpening));
    }
  }

  return {
    walls,
    openings,
    roomLabels: input.result.roomLabels,
    diagnostics,
  };
}
