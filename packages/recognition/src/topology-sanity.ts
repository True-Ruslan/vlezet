import type {
  RecognitionDiagnostic,
  RecognitionWallCandidate,
} from "./model";

export type RecognitionTopologyStructuralMask = Readonly<{
  widthPx: number;
  heightPx: number;
  isStructural: (x: number, y: number) => boolean;
}>;

export type RecognitionTopologySanityInput = Readonly<{
  widthPx: number;
  heightPx: number;
  millimetersPerPixel: number | null;
  structuralMask?: RecognitionTopologyStructuralMask | null;
  wallCandidates: readonly RecognitionWallCandidate[];
}>;

export type RecognitionTopologySanityResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  diagnostics: readonly RecognitionDiagnostic[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type AxisOrientation = "horizontal" | "vertical" | "diagonal";
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  orientation: AxisOrientation;
  axis: number | null;
  minimum: number;
  maximum: number;
  lengthPx: number;
  thicknessPx: number;
}>;

type CleanRun = Readonly<{ start: number; end: number }>;

const MAX_WALL_CANDIDATES = 128;
const AXIS_TOLERANCE_DEG = 8;
const INTERSECTION_COVERAGE_TOLERANCE_PX = 8;
const MAX_ENDPOINT_TRIM_PX = 64;
const MIN_ENDPOINT_TRIM_PX = 48;
const MIN_SANITIZED_WALL_LENGTH_PX = 12;
const MAX_DOUBLE_TRIM_CONTINUITY_LENGTH_PX = 96;
const MIN_DOUBLE_TRIM_CONTINUITY_RATIO = 0.72;
const MAX_CONTINUITY_SAMPLES = 64;
const MAX_MASK_OPENING_SPLITS = 16;
const MAX_MASK_GAP_SCAN_SAMPLES = 2048;
const MAX_CLEAN_CROSS_SECTION_SUPPORT_RATIO = 0.2;
const MIN_MASK_GAP_THICKNESS_RATIO = 1.5;
const MIN_MASK_GAP_WIDTH_PX = 12;
const MIN_MASK_RETAINED_SIDE_PX = 24;
const DUPLICATE_MIN_OVERLAP_RATIO = 0.75;
const DUPLICATE_BAND_OVERLAP_RATIO = 0.9;
const MAX_DUPLICATE_AXIS_DISTANCE_PX = 32;
const SMALL_ENCLOSURE_MAX_AREA_M2 = 0.5;
const SMALL_ENCLOSURE_CORNER_TOLERANCE_PX = 8;
const MIN_ENCLOSURE_SIDE_PX = 12;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function length(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function axisOrientation(start: Point, end: Point): AxisOrientation {
  const angle = ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
  const horizontalDelta = Math.min(angle, 180 - angle);
  const verticalDelta = Math.abs(angle - 90);
  if (horizontalDelta <= AXIS_TOLERANCE_DEG) return "horizontal";
  if (verticalDelta <= AXIS_TOLERANCE_DEG) return "vertical";
  return "diagonal";
}

function toPixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall {
  const sourceStart = { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx };
  const sourceEnd = { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx };
  const orientation = axisOrientation(sourceStart, sourceEnd);
  const thicknessPx = Math.max(1, candidate.estimatedThicknessPx ?? 20);

  if (orientation === "horizontal") {
    const axis = (sourceStart.y + sourceEnd.y) / 2;
    const start = { x: sourceStart.x, y: axis };
    const end = { x: sourceEnd.x, y: axis };
    return {
      candidate,
      start,
      end,
      orientation,
      axis,
      minimum: Math.min(start.x, end.x),
      maximum: Math.max(start.x, end.x),
      lengthPx: Math.abs(end.x - start.x),
      thicknessPx,
    };
  }

  if (orientation === "vertical") {
    const axis = (sourceStart.x + sourceEnd.x) / 2;
    const start = { x: axis, y: sourceStart.y };
    const end = { x: axis, y: sourceEnd.y };
    return {
      candidate,
      start,
      end,
      orientation,
      axis,
      minimum: Math.min(start.y, end.y),
      maximum: Math.max(start.y, end.y),
      lengthPx: Math.abs(end.y - start.y),
      thicknessPx,
    };
  }

  return {
    candidate,
    start: sourceStart,
    end: sourceEnd,
    orientation,
    axis: null,
    minimum: 0,
    maximum: 0,
    lengthPx: length(sourceStart, sourceEnd),
    thicknessPx,
  };
}

function pointWithin(value: number, minimum: number, maximum: number, tolerance: number): boolean {
  return value >= minimum - tolerance && value <= maximum + tolerance;
}

function addReason(candidate: RecognitionWallCandidate, reason: string): RecognitionWallCandidate {
  return {
    ...candidate,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([...candidate.evidence.reasons, reason])].sort(),
    },
  };
}

function blockCandidate(candidate: RecognitionWallCandidate, reason: string): RecognitionWallCandidate {
  return addReason({
    ...candidate,
    confidence: "low",
    conflict: "unsupported",
  }, reason);
}

function trimEndpoint(
  endpoint: Point,
  opposite: Point,
  wall: PixelWall,
  walls: readonly PixelWall[],
): Readonly<{ point: Point; trimmed: boolean }> {
  if (wall.orientation === "diagonal" || wall.axis === null) return { point: endpoint, trimmed: false };
  const endpointCoordinate = wall.orientation === "horizontal" ? endpoint.x : endpoint.y;
  const oppositeCoordinate = wall.orientation === "horizontal" ? opposite.x : opposite.y;
  const direction = Math.sign(endpointCoordinate - oppositeCoordinate);
  if (direction === 0) return { point: endpoint, trimmed: false };

  let best: Readonly<{ coordinate: number; distance: number }> | null = null;
  for (const perpendicular of walls) {
    if (perpendicular.orientation === "diagonal" || perpendicular.axis === null) continue;
    if (perpendicular.orientation === wall.orientation) continue;
    if (perpendicular.candidate.id === wall.candidate.id) continue;

    if (!pointWithin(
      wall.axis,
      perpendicular.minimum,
      perpendicular.maximum,
      INTERSECTION_COVERAGE_TOLERANCE_PX,
    )) continue;

    const intersectionCoordinate = perpendicular.axis;
    const between = direction > 0
      ? intersectionCoordinate >= oppositeCoordinate && intersectionCoordinate <= endpointCoordinate
      : intersectionCoordinate <= oppositeCoordinate && intersectionCoordinate >= endpointCoordinate;
    if (!between) continue;

    const distancePx = Math.abs(endpointCoordinate - intersectionCoordinate);
    const maximumTrim = Math.min(
      MAX_ENDPOINT_TRIM_PX,
      Math.max(
        MIN_ENDPOINT_TRIM_PX,
        wall.thicknessPx * 2,
        perpendicular.thicknessPx * 2,
      ),
    );
    if (distancePx <= 0.5 || distancePx > maximumTrim) continue;
    if (!best || distancePx < best.distance) best = { coordinate: intersectionCoordinate, distance: distancePx };
  }

  if (!best) return { point: endpoint, trimmed: false };
  return {
    point: wall.orientation === "horizontal"
      ? { x: best.coordinate, y: wall.axis }
      : { x: wall.axis, y: best.coordinate },
    trimmed: true,
  };
}

function withPixelEndpoints(
  wall: PixelWall,
  start: Point,
  end: Point,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  return {
    ...wall.candidate,
    start: { x: clamp01(start.x / widthPx), y: clamp01(start.y / heightPx) },
    end: { x: clamp01(end.x / widthPx), y: clamp01(end.y / heightPx) },
  };
}

function centralStructuralContinuity(
  start: Point,
  end: Point,
  thicknessPx: number,
  structuralMask: RecognitionTopologyStructuralMask,
): number {
  const segmentLength = length(start, end);
  if (segmentLength <= 0) return 0;
  const endpointExclusionPx = Math.min(segmentLength * 0.25, Math.max(2, thicknessPx / 2));
  const interiorLengthPx = segmentLength - endpointExclusionPx * 2;
  if (interiorLengthPx <= 2) return 1;

  const startRatio = endpointExclusionPx / segmentLength;
  const endRatio = 1 - startRatio;
  const sampleCount = Math.max(8, Math.min(MAX_CONTINUITY_SAMPLES, Math.ceil(interiorLengthPx)));
  let supported = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = startRatio + (endRatio - startRatio) * ((index + 0.5) / sampleCount);
    const x = start.x + (end.x - start.x) * ratio;
    const y = start.y + (end.y - start.y) * ratio;
    if (structuralMask.isStructural(Math.round(x), Math.round(y))) supported += 1;
  }
  return supported / sampleCount;
}

function crossSectionSupport(
  wall: PixelWall,
  along: number,
  structuralMask: RecognitionTopologyStructuralMask,
): number | null {
  if (wall.orientation === "diagonal" || wall.axis === null) return null;
  const acrossSamples = Math.max(3, Math.min(9, Math.round(wall.thicknessPx)));
  const halfThickness = wall.thicknessPx / 2;
  let supported = 0;
  try {
    for (let index = 0; index < acrossSamples; index += 1) {
      const across = wall.axis - halfThickness
        + ((index + 0.5) / acrossSamples) * wall.thicknessPx;
      const x = wall.orientation === "horizontal" ? along : across;
      const y = wall.orientation === "horizontal" ? across : along;
      const sampleX = Math.round(clamp(x, 0, structuralMask.widthPx - 1));
      const sampleY = Math.round(clamp(y, 0, structuralMask.heightPx - 1));
      if (structuralMask.isStructural(sampleX, sampleY)) supported += 1;
    }
  } catch {
    return null;
  }
  return supported / acrossSamples;
}

function longestCleanRun(
  wall: PixelWall,
  structuralMask: RecognitionTopologyStructuralMask,
): CleanRun | null {
  if (wall.orientation === "diagonal" || wall.axis === null) return null;
  const minimumSidePx = Math.max(MIN_MASK_RETAINED_SIDE_PX, wall.thicknessPx * MIN_MASK_GAP_THICKNESS_RATIO);
  const scanStart = Math.ceil(wall.minimum + minimumSidePx);
  const scanEnd = Math.floor(wall.maximum - minimumSidePx);
  if (scanEnd <= scanStart) return null;

  const span = scanEnd - scanStart;
  const sampleCount = Math.min(MAX_MASK_GAP_SCAN_SAMPLES, span + 1);
  const step = sampleCount <= 1 ? 1 : span / (sampleCount - 1);
  let currentStart: number | null = null;
  let currentEnd: number | null = null;
  let best: CleanRun | null = null;

  for (let index = 0; index < sampleCount; index += 1) {
    const along = index === sampleCount - 1 ? scanEnd : scanStart + index * step;
    const support = crossSectionSupport(wall, along, structuralMask);
    if (support === null) return null;
    if (support <= MAX_CLEAN_CROSS_SECTION_SUPPORT_RATIO) {
      if (currentStart === null) currentStart = along;
      currentEnd = along;
      continue;
    }
    if (currentStart !== null && currentEnd !== null) {
      const candidate = { start: currentStart, end: currentEnd };
      if (!best || candidate.end - candidate.start > best.end - best.start) best = candidate;
    }
    currentStart = null;
    currentEnd = null;
  }
  if (currentStart !== null && currentEnd !== null) {
    const candidate = { start: currentStart, end: currentEnd };
    if (!best || candidate.end - candidate.start > best.end - best.start) best = candidate;
  }
  return best;
}

function splitCandidateAtCleanRun(
  wall: PixelWall,
  cleanRun: CleanRun,
  widthPx: number,
  heightPx: number,
): readonly [RecognitionWallCandidate, RecognitionWallCandidate] | null {
  const minimumGapPx = Math.max(MIN_MASK_GAP_WIDTH_PX, wall.thicknessPx * MIN_MASK_GAP_THICKNESS_RATIO);
  if (cleanRun.end - cleanRun.start < minimumGapPx) return null;
  const minimumSidePx = Math.max(MIN_MASK_RETAINED_SIDE_PX, wall.thicknessPx * MIN_MASK_GAP_THICKNESS_RATIO);
  if (cleanRun.start - wall.minimum < minimumSidePx || wall.maximum - cleanRun.end < minimumSidePx) return null;
  if (wall.orientation === "diagonal" || wall.axis === null) return null;

  const point = (along: number): Point => wall.orientation === "horizontal"
    ? { x: along, y: wall.axis! }
    : { x: wall.axis!, y: along };
  const before = addReason({
    ...withPixelEndpoints(wall, point(wall.minimum), point(cleanRun.start), widthPx, heightPx),
    id: `${wall.candidate.id}-opening-before`,
  }, "topology-mask-opening-gap-split");
  const after = addReason({
    ...withPixelEndpoints(wall, point(cleanRun.end), point(wall.maximum), widthPx, heightPx),
    id: `${wall.candidate.id}-opening-after`,
  }, "topology-mask-opening-gap-split");
  return [before, after];
}

function splitMaskConfirmedOpeningGaps(
  candidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
  structuralMask: RecognitionTopologyStructuralMask | null,
): Readonly<{ walls: RecognitionWallCandidate[]; diagnostics: RecognitionDiagnostic[] }> {
  if (!structuralMask) return { walls: [...candidates], diagnostics: [] };
  const walls: RecognitionWallCandidate[] = [];
  const diagnostics: RecognitionDiagnostic[] = [];
  let splitCount = 0;

  for (const candidate of candidates) {
    if (
      splitCount >= MAX_MASK_OPENING_SPLITS
      || candidate.conflict !== null
      || !candidate.evidence.reasons.includes("bounded-opening-gap-bridge")
    ) {
      walls.push(candidate);
      continue;
    }
    const pixelWall = toPixelWall(candidate, widthPx, heightPx);
    const cleanRun = longestCleanRun(pixelWall, structuralMask);
    const split = cleanRun
      ? splitCandidateAtCleanRun(pixelWall, cleanRun, widthPx, heightPx)
      : null;
    if (!split) {
      walls.push(candidate);
      continue;
    }
    walls.push(...split);
    splitCount += 1;
    diagnostics.push({
      code: "topology-mask-opening-gap-split",
      severity: "info",
      message: "Слепое объединение стены разделено по подтверждённому чистому структурному разрыву.",
      candidateId: candidate.id,
    });
  }
  return { walls, diagnostics };
}

function trimOvershoots(
  candidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
  structuralMask: RecognitionTopologyStructuralMask | null,
): Readonly<{ walls: RecognitionWallCandidate[]; diagnostics: RecognitionDiagnostic[] }> {
  const pixelWalls = candidates.map((candidate) => toPixelWall(candidate, widthPx, heightPx));
  const diagnostics: RecognitionDiagnostic[] = [];
  const walls = pixelWalls.map((wall) => {
    const trimmedStart = trimEndpoint(wall.start, wall.end, wall, pixelWalls);
    const trimmedEnd = trimEndpoint(wall.end, wall.start, wall, pixelWalls);
    if (!trimmedStart.trimmed && !trimmedEnd.trimmed) return wall.candidate;

    const sanitizedLengthPx = length(trimmedStart.point, trimmedEnd.point);
    if (sanitizedLengthPx < MIN_SANITIZED_WALL_LENGTH_PX) {
      diagnostics.push({
        code: "topology-degenerate-after-trim",
        severity: "warning",
        message: "Обрезка схлопнула короткий фрагмент стены; исходный кандидат сохранён для проверки и отклонён.",
        candidateId: wall.candidate.id,
      });
      return blockCandidate(wall.candidate, "topology-degenerate-after-trim");
    }

    const trimmedCandidate = withPixelEndpoints(
      wall,
      trimmedStart.point,
      trimmedEnd.point,
      widthPx,
      heightPx,
    );
    const doubleTrimContinuityLimitPx = Math.min(
      MAX_DOUBLE_TRIM_CONTINUITY_LENGTH_PX,
      Math.max(MIN_ENDPOINT_TRIM_PX, wall.thicknessPx * 3),
    );
    if (
      structuralMask
      && trimmedStart.trimmed
      && trimmedEnd.trimmed
      && sanitizedLengthPx <= doubleTrimContinuityLimitPx
      && centralStructuralContinuity(
        trimmedStart.point,
        trimmedEnd.point,
        wall.thicknessPx,
        structuralMask,
      ) < MIN_DOUBLE_TRIM_CONTINUITY_RATIO
    ) {
      diagnostics.push({
        code: "topology-double-trim-low-continuity",
        severity: "warning",
        message: "Короткий фрагмент между двумя обрезанными пересечениями не подтверждён непрерывным структурным растром.",
        candidateId: wall.candidate.id,
      });
      return blockCandidate(trimmedCandidate, "topology-double-trim-low-continuity");
    }

    diagnostics.push({
      code: "topology-endpoint-overshoot-trimmed",
      severity: "info",
      message: "Выступающий конец стены обрезан по существующему перпендикулярному пересечению.",
      candidateId: wall.candidate.id,
    });
    return addReason(trimmedCandidate, "topology-endpoint-overshoot-trimmed");
  });
  return { walls, diagnostics };
}

function intervalOverlap(first: PixelWall, second: PixelWall): number {
  return Math.max(0, Math.min(first.maximum, second.maximum) - Math.max(first.minimum, second.minimum));
}

function candidateRank(wall: PixelWall): readonly [number, number, string] {
  return [wall.candidate.evidence.localScore ?? 0, wall.lengthPx, wall.candidate.id];
}

function weakerWall(first: PixelWall, second: PixelWall): PixelWall {
  const firstRank = candidateRank(first);
  const secondRank = candidateRank(second);
  if (firstRank[0] !== secondRank[0]) return firstRank[0] < secondRank[0] ? first : second;
  if (firstRank[1] !== secondRank[1]) return firstRank[1] < secondRank[1] ? first : second;
  return firstRank[2].localeCompare(secondRank[2]) > 0 ? first : second;
}

function detectParallelDuplicates(
  candidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): ReadonlySet<string> {
  const walls = candidates
    .filter((candidate) => candidate.conflict === null)
    .map((candidate) => toPixelWall(candidate, widthPx, heightPx));
  const blocked = new Set<string>();

  for (let firstIndex = 0; firstIndex < walls.length; firstIndex += 1) {
    const first = walls[firstIndex]!;
    if (first.orientation === "diagonal" || first.axis === null || blocked.has(first.candidate.id)) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < walls.length; secondIndex += 1) {
      const second = walls[secondIndex]!;
      if (second.orientation !== first.orientation || second.axis === null || blocked.has(second.candidate.id)) continue;
      const overlapRatio = intervalOverlap(first, second) / Math.max(1, Math.min(first.lengthPx, second.lengthPx));
      if (overlapRatio < DUPLICATE_MIN_OVERLAP_RATIO) continue;
      const bandOverlapLimit = Math.min(
        MAX_DUPLICATE_AXIS_DISTANCE_PX,
        Math.min(first.thicknessPx, second.thicknessPx) * DUPLICATE_BAND_OVERLAP_RATIO,
      );
      if (Math.abs(first.axis - second.axis) >= bandOverlapLimit) continue;
      blocked.add(weakerWall(first, second).candidate.id);
    }
  }
  return blocked;
}

function wallCovers(
  wall: PixelWall,
  orientation: "horizontal" | "vertical",
  axis: number,
  minimum: number,
  maximum: number,
): boolean {
  if (wall.orientation !== orientation || wall.axis === null) return false;
  if (Math.abs(wall.axis - axis) > SMALL_ENCLOSURE_CORNER_TOLERANCE_PX) return false;
  return wall.minimum <= minimum + SMALL_ENCLOSURE_CORNER_TOLERANCE_PX
    && wall.maximum >= maximum - SMALL_ENCLOSURE_CORNER_TOLERANCE_PX;
}

function detectSmallEnclosures(
  candidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
  millimetersPerPixel: number | null,
  alreadyBlocked: ReadonlySet<string>,
): ReadonlySet<string> {
  const blocked = new Set<string>();
  if (millimetersPerPixel === null || !Number.isFinite(millimetersPerPixel) || millimetersPerPixel <= 0) {
    return blocked;
  }

  const walls = candidates
    .filter((candidate) => candidate.conflict === null && !alreadyBlocked.has(candidate.id))
    .map((candidate) => toPixelWall(candidate, widthPx, heightPx));
  const horizontals = walls.filter((wall) => wall.orientation === "horizontal" && wall.axis !== null);
  const verticals = walls.filter((wall) => wall.orientation === "vertical" && wall.axis !== null);

  for (let topIndex = 0; topIndex < horizontals.length; topIndex += 1) {
    const top = horizontals[topIndex]!;
    for (let bottomIndex = topIndex + 1; bottomIndex < horizontals.length; bottomIndex += 1) {
      const bottom = horizontals[bottomIndex]!;
      const minimumY = Math.min(top.axis!, bottom.axis!);
      const maximumY = Math.max(top.axis!, bottom.axis!);
      const enclosureHeight = maximumY - minimumY;
      if (enclosureHeight < MIN_ENCLOSURE_SIDE_PX) continue;

      for (let leftIndex = 0; leftIndex < verticals.length; leftIndex += 1) {
        const left = verticals[leftIndex]!;
        for (let rightIndex = leftIndex + 1; rightIndex < verticals.length; rightIndex += 1) {
          const right = verticals[rightIndex]!;
          const minimumX = Math.min(left.axis!, right.axis!);
          const maximumX = Math.max(left.axis!, right.axis!);
          const enclosureWidth = maximumX - minimumX;
          if (enclosureWidth < MIN_ENCLOSURE_SIDE_PX) continue;

          const areaM2 = enclosureWidth
            * enclosureHeight
            * millimetersPerPixel
            * millimetersPerPixel
            / 1_000_000;
          if (areaM2 >= SMALL_ENCLOSURE_MAX_AREA_M2) continue;

          const topWall = horizontals.find((wall) => wallCovers(wall, "horizontal", minimumY, minimumX, maximumX));
          const bottomWall = horizontals.find((wall) => wallCovers(wall, "horizontal", maximumY, minimumX, maximumX));
          const leftWall = verticals.find((wall) => wallCovers(wall, "vertical", minimumX, minimumY, maximumY));
          const rightWall = verticals.find((wall) => wallCovers(wall, "vertical", maximumX, minimumY, maximumY));
          if (!topWall || !bottomWall || !leftWall || !rightWall) continue;

          for (const side of [topWall, bottomWall, leftWall, rightWall]) {
            const expectedLength = side.orientation === "horizontal" ? enclosureWidth : enclosureHeight;
            if (expectedLength / Math.max(1, side.lengthPx) >= 0.75) blocked.add(side.candidate.id);
          }
        }
      }
    }
  }
  return blocked;
}

export function sanitizeRecognitionWallTopology(
  input: RecognitionTopologySanityInput,
): RecognitionTopologySanityResult {
  if (!Number.isFinite(input.widthPx) || input.widthPx <= 0 || !Number.isFinite(input.heightPx) || input.heightPx <= 0) {
    throw new Error("Размер изображения должен быть положительным и конечным.");
  }
  const structuralMask = input.structuralMask ?? null;
  if (
    structuralMask
    && (
      structuralMask.widthPx !== input.widthPx
      || structuralMask.heightPx !== input.heightPx
    )
  ) {
    throw new Error("Размер structural mask должен совпадать с размером изображения.");
  }

  const canonicalCandidates = [...input.wallCandidates].sort((first, second) => first.id.localeCompare(second.id));
  if (canonicalCandidates.length > MAX_WALL_CANDIDATES) {
    return {
      walls: canonicalCandidates,
      diagnostics: [{
        code: "topology-sanity-budget-exceeded",
        severity: "warning",
        message: "Проверка топологии пропущена из-за безопасного лимита кандидатов.",
        candidateId: null,
      }],
    };
  }

  const split = splitMaskConfirmedOpeningGaps(
    canonicalCandidates,
    input.widthPx,
    input.heightPx,
    structuralMask,
  );
  const trimmed = trimOvershoots(
    split.walls,
    input.widthPx,
    input.heightPx,
    structuralMask,
  );
  const duplicateIds = detectParallelDuplicates(trimmed.walls, input.widthPx, input.heightPx);
  const smallEnclosureIds = detectSmallEnclosures(
    trimmed.walls,
    input.widthPx,
    input.heightPx,
    input.millimetersPerPixel,
    duplicateIds,
  );
  const diagnostics: RecognitionDiagnostic[] = [...split.diagnostics, ...trimmed.diagnostics];

  const walls = trimmed.walls.map((candidate) => {
    if (candidate.conflict !== null) return candidate;
    if (duplicateIds.has(candidate.id)) {
      diagnostics.push({
        code: "topology-parallel-duplicate",
        severity: "warning",
        message: "Кандидат физически перекрывает более сильную параллельную стену и оставлен отклонённым.",
        candidateId: candidate.id,
      });
      return blockCandidate(candidate, "topology-parallel-duplicate");
    }
    if (smallEnclosureIds.has(candidate.id)) {
      diagnostics.push({
        code: "topology-small-enclosure",
        severity: "warning",
        message: "Кандидат образует замкнутый контур площадью менее 0,5 м² и оставлен отклонённым.",
        candidateId: candidate.id,
      });
      return blockCandidate(candidate, "topology-small-enclosure");
    }
    return candidate;
  });

  return {
    walls,
    diagnostics: diagnostics.sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
