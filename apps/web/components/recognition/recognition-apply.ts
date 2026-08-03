import {
  getWallEndpoints,
  type Opening,
  type Point2,
  type VlezetDocument,
} from "@vlezet/domain";
import {
  addOpening,
  addTopologicalWall,
  type WallEndpointIntent,
} from "@vlezet/editor-core";
import {
  imagePointToWorld,
  projectPointToSegment,
  projectPointToWallOffset,
} from "@vlezet/geometry";
import type { ReferencePlan } from "@vlezet/projects";
import {
  sanitizeRecognitionWallTopology,
  type NormalizedPoint,
  type RecognitionDraft,
  type RecognitionOpeningCandidate,
  type RecognitionWallCandidate,
} from "@vlezet/recognition";

export type RecognitionApplyDiagnostic = Readonly<{
  candidateId: string;
  severity: "info" | "warning" | "error";
  message: string;
}>;

export type RecognitionApplyPlan = Readonly<{
  document: VlezetDocument;
  appliedCandidateIds: readonly string[];
  diagnostics: readonly RecognitionApplyDiagnostic[];
}>;

export type RecognitionApplyIdFactory = (kind: "wall" | "vertex" | "opening") => string;

const ENDPOINT_SNAP_TOLERANCE_MM = 60;
const DUPLICATE_WALL_TOLERANCE_MM = 70;
const MIN_RECOGNIZED_WALL_LENGTH_MM = 120;
const ORTHOGONAL_SNAP_TOLERANCE_DEG = 8;
const AXIS_CLUSTER_TOLERANCE_PX = 10;
const AXIS_CLUSTER_LINK_GAP_PX = 16;
const INTERSECTION_SNAP_TOLERANCE_PX = 16;

const DEFAULT_RECOGNIZED_WALL_THICKNESS_MM = 150;
const MIN_RECOGNIZED_WALL_THICKNESS_MM = 80;
const MAX_RECOGNIZED_WALL_THICKNESS_MM = 400;
const THICKNESS_NORMALIZATION_THRESHOLD_MM = 300;
const THICKNESS_TARGET_MEDIAN_MM = 150;
const THICKNESS_QUANTUM_MM = 10;

type AxisOrientation = "horizontal" | "vertical" | "diagonal";

type PreparedImageWall = {
  candidateId: string;
  orientation: AxisOrientation;
  start: Point2;
  end: Point2;
  axis: number | null;
  minimum: number;
  maximum: number;
  length: number;
};

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizedToImage(point: NormalizedPoint, reference: ReferencePlan): Point2 {
  return { x: point.x * reference.widthPx, y: point.y * reference.heightPx };
}

function normalizedToWorld(point: NormalizedPoint, reference: ReferencePlan): Point2 {
  return imagePointToWorld(normalizedToImage(point, reference), reference.transform);
}

function preparedImageWall(
  candidate: RecognitionWallCandidate,
  reference: ReferencePlan,
): PreparedImageWall {
  const sourceStart = normalizedToImage(candidate.start, reference);
  const sourceEnd = normalizedToImage(candidate.end, reference);
  const dx = sourceEnd.x - sourceStart.x;
  const dy = sourceEnd.y - sourceStart.y;
  const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 180) % 180;
  const horizontalDelta = Math.min(angle, 180 - angle);
  const verticalDelta = Math.abs(angle - 90);

  if (horizontalDelta <= ORTHOGONAL_SNAP_TOLERANCE_DEG) {
    const axis = (sourceStart.y + sourceEnd.y) / 2;
    const start = { x: sourceStart.x, y: axis };
    const end = { x: sourceEnd.x, y: axis };
    return {
      candidateId: candidate.id,
      orientation: "horizontal",
      start,
      end,
      axis,
      minimum: Math.min(start.x, end.x),
      maximum: Math.max(start.x, end.x),
      length: Math.abs(end.x - start.x),
    };
  }

  if (verticalDelta <= ORTHOGONAL_SNAP_TOLERANCE_DEG) {
    const axis = (sourceStart.x + sourceEnd.x) / 2;
    const start = { x: axis, y: sourceStart.y };
    const end = { x: axis, y: sourceEnd.y };
    return {
      candidateId: candidate.id,
      orientation: "vertical",
      start,
      end,
      axis,
      minimum: Math.min(start.y, end.y),
      maximum: Math.max(start.y, end.y),
      length: Math.abs(end.y - start.y),
    };
  }

  return {
    candidateId: candidate.id,
    orientation: "diagonal",
    start: sourceStart,
    end: sourceEnd,
    axis: null,
    minimum: 0,
    maximum: 0,
    length: distance(sourceStart, sourceEnd),
  };
}

function intervalsLinked(first: PreparedImageWall, second: PreparedImageWall): boolean {
  return Math.max(first.minimum, second.minimum)
    <= Math.min(first.maximum, second.maximum) + AXIS_CLUSTER_LINK_GAP_PX;
}

function canonicalizeAxisClusters(walls: PreparedImageWall[]): void {
  const parents = walls.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root]!;
    while (parents[index] !== index) {
      const parent = parents[index]!;
      parents[index] = root;
      index = parent;
    }
    return root;
  };
  const union = (first: number, second: number) => {
    const firstRoot = find(first);
    const secondRoot = find(second);
    if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot;
  };

  for (let first = 0; first < walls.length; first += 1) {
    const firstWall = walls[first]!;
    if (firstWall.orientation === "diagonal" || firstWall.axis === null) continue;
    for (let second = first + 1; second < walls.length; second += 1) {
      const secondWall = walls[second]!;
      if (secondWall.orientation !== firstWall.orientation || secondWall.axis === null) continue;
      if (Math.abs(firstWall.axis - secondWall.axis) > AXIS_CLUSTER_TOLERANCE_PX) continue;
      if (!intervalsLinked(firstWall, secondWall)) continue;
      union(first, second);
    }
  }

  const clusters = new Map<number, number[]>();
  for (let index = 0; index < walls.length; index += 1) {
    const wall = walls[index]!;
    if (wall.orientation === "diagonal") continue;
    const root = find(index);
    const cluster = clusters.get(root) ?? [];
    cluster.push(index);
    clusters.set(root, cluster);
  }

  for (const indexes of clusters.values()) {
    const totalLength = indexes.reduce((sum, index) => sum + Math.max(1, walls[index]!.length), 0);
    const axis = indexes.reduce(
      (sum, index) => sum + (walls[index]!.axis ?? 0) * Math.max(1, walls[index]!.length),
      0,
    ) / totalLength;
    for (const index of indexes) {
      const wall = walls[index]!;
      wall.axis = axis;
      if (wall.orientation === "horizontal") {
        wall.start = { x: wall.start.x, y: axis };
        wall.end = { x: wall.end.x, y: axis };
      } else {
        wall.start = { x: axis, y: wall.start.y };
        wall.end = { x: axis, y: wall.end.y };
      }
    }
  }
}

function pointWithinInterval(value: number, wall: PreparedImageWall): boolean {
  return value >= wall.minimum - INTERSECTION_SNAP_TOLERANCE_PX
    && value <= wall.maximum + INTERSECTION_SNAP_TOLERANCE_PX;
}

function snapEndpointToPerpendicularIntersection(
  endpoint: Point2,
  wall: PreparedImageWall,
  walls: readonly PreparedImageWall[],
): Point2 {
  if (wall.orientation === "diagonal" || wall.axis === null) return endpoint;
  let best: Readonly<{ point: Point2; distance: number }> | null = null;

  for (const perpendicular of walls) {
    if (perpendicular.axis === null || perpendicular.orientation === "diagonal") continue;
    if (perpendicular.orientation === wall.orientation) continue;
    const intersection = wall.orientation === "horizontal"
      ? { x: perpendicular.axis, y: wall.axis }
      : { x: wall.axis, y: perpendicular.axis };
    const longitudinalCoordinate = wall.orientation === "horizontal" ? intersection.x : intersection.y;
    const perpendicularCoordinate = wall.orientation === "horizontal" ? intersection.y : intersection.x;
    if (!pointWithinInterval(longitudinalCoordinate, wall)) continue;
    if (!pointWithinInterval(perpendicularCoordinate, perpendicular)) continue;
    const endpointDistance = distance(endpoint, intersection);
    if (endpointDistance > INTERSECTION_SNAP_TOLERANCE_PX) continue;
    if (!best || endpointDistance < best.distance) best = { point: intersection, distance: endpointDistance };
  }

  return best?.point ?? endpoint;
}

function canonicalImageEndpoints(
  draft: RecognitionDraft,
  reference: ReferencePlan,
): ReadonlyMap<string, Readonly<{ start: Point2; end: Point2 }>> {
  const walls = draft.walls
    .filter((candidate) => accepted(draft, candidate.id))
    .filter((candidate) => !candidate.conflict || candidate.conflict === "duplicate-existing")
    .map((candidate) => preparedImageWall(candidate, reference));

  canonicalizeAxisClusters(walls);
  const result = new Map<string, Readonly<{ start: Point2; end: Point2 }>>();
  for (const wall of walls) {
    const start = snapEndpointToPerpendicularIntersection(wall.start, wall, walls);
    const end = snapEndpointToPerpendicularIntersection(wall.end, wall, walls);
    result.set(wall.candidateId, { start, end });
  }
  return result;
}

function candidateWorldEndpoints(
  candidate: RecognitionWallCandidate,
  reference: ReferencePlan,
  canonicalEndpoints: ReadonlyMap<string, Readonly<{ start: Point2; end: Point2 }>>,
): Readonly<{ start: Point2; end: Point2 }> {
  const image = canonicalEndpoints.get(candidate.id) ?? preparedImageWall(candidate, reference);
  return {
    start: imagePointToWorld(image.start, reference.transform),
    end: imagePointToWorld(image.end, reference.transform),
  };
}

function wallEndpointDistance(
  firstStart: Point2,
  firstEnd: Point2,
  secondStart: Point2,
  secondEnd: Point2,
): number {
  const direct = (distance(firstStart, secondStart) + distance(firstEnd, secondEnd)) / 2;
  const reverse = (distance(firstStart, secondEnd) + distance(firstEnd, secondStart)) / 2;
  return Math.min(direct, reverse);
}

function findDuplicateWallId(document: VlezetDocument, start: Point2, end: Point2): string | null {
  for (const wall of document.walls) {
    const endpoints = getWallEndpoints(document, wall);
    if (wallEndpointDistance(start, end, endpoints.start.position, endpoints.end.position) <= DUPLICATE_WALL_TOLERANCE_MM) {
      return wall.id;
    }
  }
  return null;
}

function nearestVertex(document: VlezetDocument, point: Point2): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const vertex of document.vertices) {
    const value = distance(point, vertex.position);
    if (value <= ENDPOINT_SNAP_TOLERANCE_MM && (!best || value < best.distance)) best = { id: vertex.id, distance: value };
  }
  return best?.id ?? null;
}

function nearestWallInterior(document: VlezetDocument, point: Point2): Readonly<{ wallId: string; point: Point2; distance: number }> | null {
  let best: Readonly<{ wallId: string; point: Point2; distance: number }> | null = null;
  for (const wall of document.walls) {
    const endpoints = getWallEndpoints(document, wall);
    const projection = projectPointToSegment(point, endpoints.start.position, endpoints.end.position);
    if (projection.t <= 0.001 || projection.t >= 0.999 || projection.distance > ENDPOINT_SNAP_TOLERANCE_MM) continue;
    if (!best || projection.distance < best.distance) best = { wallId: wall.id, point: projection.point, distance: projection.distance };
  }
  return best;
}

function endpointIntent(
  document: VlezetDocument,
  point: Point2,
  idFactory: RecognitionApplyIdFactory,
): WallEndpointIntent {
  const vertexId = nearestVertex(document, point);
  if (vertexId) return { kind: "existing-vertex", vertexId };
  const wall = nearestWallInterior(document, point);
  if (wall) return { kind: "wall-junction", vertexId: idFactory("vertex"), wallId: wall.wallId, position: wall.point };
  return { kind: "new-vertex", vertexId: idFactory("vertex"), position: point };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  if (sorted.length === 0) return DEFAULT_RECOGNIZED_WALL_THICKNESS_MM;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function rawThicknessMm(candidate: RecognitionWallCandidate, reference: ReferencePlan): number | null {
  if (candidate.estimatedThicknessPx == null || !Number.isFinite(candidate.estimatedThicknessPx) || candidate.estimatedThicknessPx <= 0) return null;
  const value = candidate.estimatedThicknessPx * reference.transform.millimetersPerPixel;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function createThicknessCalibration(
  draft: RecognitionDraft,
  reference: ReferencePlan,
): (candidate: RecognitionWallCandidate) => number {
  const rawValues = draft.walls
    .filter((candidate) => accepted(draft, candidate.id))
    .filter((candidate) => !candidate.conflict || candidate.conflict === "duplicate-existing")
    .map((candidate) => rawThicknessMm(candidate, reference))
    .filter((value): value is number => value !== null);
  const rawMedian = median(rawValues);
  const scale = rawMedian > THICKNESS_NORMALIZATION_THRESHOLD_MM
    ? THICKNESS_TARGET_MEDIAN_MM / rawMedian
    : 1;

  return (candidate) => {
    const raw = rawThicknessMm(candidate, reference) ?? DEFAULT_RECOGNIZED_WALL_THICKNESS_MM;
    const normalized = raw * scale;
    const clamped = Math.min(
      MAX_RECOGNIZED_WALL_THICKNESS_MM,
      Math.max(MIN_RECOGNIZED_WALL_THICKNESS_MM, normalized),
    );
    return Math.round(clamped / THICKNESS_QUANTUM_MM) * THICKNESS_QUANTUM_MM;
  };
}

function accepted(draft: RecognitionDraft, candidateId: string): boolean {
  const decision = draft.decisions[candidateId];
  return decision === "accepted" || decision === "edited";
}

function applyWalls(
  draft: RecognitionDraft,
  reference: ReferencePlan,
  initialDocument: VlezetDocument,
  idFactory: RecognitionApplyIdFactory,
): Readonly<{
  document: VlezetDocument;
  candidateToWallId: ReadonlyMap<string, string>;
  appliedCandidateIds: string[];
  diagnostics: RecognitionApplyDiagnostic[];
}> {
  let document = initialDocument;
  const candidateToWallId = new Map<string, string>();
  const appliedCandidateIds: string[] = [];
  const diagnostics: RecognitionApplyDiagnostic[] = [];
  const canonicalEndpoints = canonicalImageEndpoints(draft, reference);
  const calibratedThickness = createThicknessCalibration(draft, reference);

  for (const candidate of draft.walls) {
    if (!accepted(draft, candidate.id)) continue;
    if (candidate.conflict && candidate.conflict !== "duplicate-existing") {
      diagnostics.push({ candidateId: candidate.id, severity: "warning", message: "Кандидат стены содержит конфликт и не был применён." });
      continue;
    }
    const { start, end } = candidateWorldEndpoints(candidate, reference, canonicalEndpoints);
    if (distance(start, end) < MIN_RECOGNIZED_WALL_LENGTH_MM) {
      diagnostics.push({ candidateId: candidate.id, severity: "warning", message: "Слишком короткая стена пропущена." });
      continue;
    }
    const duplicateWallId = findDuplicateWallId(document, start, end);
    if (duplicateWallId) {
      candidateToWallId.set(candidate.id, duplicateWallId);
      diagnostics.push({ candidateId: candidate.id, severity: "info", message: "Совпадающая существующая стена не добавлена повторно, но может принять распознанные проёмы." });
      continue;
    }

    const wallId = idFactory("wall");
    try {
      const startIntent = endpointIntent(document, start, idFactory);
      const endIntent = endpointIntent(document, end, idFactory);
      const edit = addTopologicalWall(document, {
        wallId,
        start: startIntent,
        end: endIntent,
        thickness: calibratedThickness(candidate),
      });
      document = edit.document;
      candidateToWallId.set(candidate.id, wallId);
      appliedCandidateIds.push(candidate.id);
    } catch (cause) {
      diagnostics.push({
        candidateId: candidate.id,
        severity: "error",
        message: cause instanceof Error ? `Стена не применена: ${cause.message}` : "Стена не применена из-за ошибки геометрии.",
      });
    }
  }

  return { document, candidateToWallId, appliedCandidateIds, diagnostics };
}

function openingWidthMm(candidate: RecognitionOpeningCandidate, reference: ReferencePlan): number | null {
  if (candidate.widthPx == null || !Number.isFinite(candidate.widthPx) || candidate.widthPx <= 0) return null;
  return candidate.widthPx * reference.transform.millimetersPerPixel;
}

function applyOpenings(
  draft: RecognitionDraft,
  reference: ReferencePlan,
  initialDocument: VlezetDocument,
  candidateToWallId: ReadonlyMap<string, string>,
  idFactory: RecognitionApplyIdFactory,
): Readonly<{ document: VlezetDocument; appliedCandidateIds: string[]; diagnostics: RecognitionApplyDiagnostic[] }> {
  let document = initialDocument;
  const appliedCandidateIds: string[] = [];
  const diagnostics: RecognitionApplyDiagnostic[] = [];

  for (const candidate of draft.openings) {
    if (!accepted(draft, candidate.id)) continue;
    if (candidate.kind === "unknown-opening") {
      diagnostics.push({ candidateId: candidate.id, severity: "warning", message: "Неизвестный тип проёма нужно сначала классифицировать как дверь или окно." });
      continue;
    }
    if (!candidate.hostWallCandidateId) {
      diagnostics.push({ candidateId: candidate.id, severity: "warning", message: "Для проёма не определена стена." });
      continue;
    }
    const wallId = candidateToWallId.get(candidate.hostWallCandidateId);
    if (!wallId) {
      diagnostics.push({ candidateId: candidate.id, severity: "warning", message: "Стена для проёма не была применена или сопоставлена, поэтому проём пропущен." });
      continue;
    }
    const width = openingWidthMm(candidate, reference);
    if (!width) {
      diagnostics.push({ candidateId: candidate.id, severity: "warning", message: "Не удалось определить ширину проёма." });
      continue;
    }
    try {
      const centerWorld = normalizedToWorld(candidate.center, reference);
      const centerOffset = projectPointToWallOffset(document, wallId, centerWorld);
      const opening: Opening = {
        id: idFactory("opening"),
        wallId,
        kind: candidate.kind,
        offset: centerOffset - width / 2,
        width,
        ...(candidate.kind === "door" ? { doorSwing: { hinge: "start", side: "left" } } : {}),
      };
      document = addOpening(document, opening);
      appliedCandidateIds.push(candidate.id);
    } catch (cause) {
      diagnostics.push({
        candidateId: candidate.id,
        severity: "error",
        message: cause instanceof Error ? `Проём не применён: ${cause.message}` : "Проём не применён из-за ошибки геометрии.",
      });
    }
  }
  return { document, appliedCandidateIds, diagnostics };
}

export function planRecognitionApply(input: Readonly<{
  draft: RecognitionDraft;
  referencePlan: ReferencePlan;
  document: VlezetDocument;
  idFactory: RecognitionApplyIdFactory;
}>): RecognitionApplyPlan {
  if (input.draft.referenceAssetId !== input.referencePlan.assetId || input.draft.referenceRevision !== input.referencePlan.referenceRevision) {
    throw new Error("Черновик распознавания относится к другой версии подложки.");
  }

  const topologySanity = sanitizeRecognitionWallTopology({
    widthPx: input.referencePlan.widthPx,
    heightPx: input.referencePlan.heightPx,
    millimetersPerPixel: input.referencePlan.transform.millimetersPerPixel,
    wallCandidates: input.draft.walls,
  });
  const sanitizedById = new Map(topologySanity.walls.map((candidate) => [candidate.id, candidate]));
  const sanitizedDraft: RecognitionDraft = {
    ...input.draft,
    walls: input.draft.walls.map((candidate) => sanitizedById.get(candidate.id) ?? candidate),
  };
  const topologyDiagnostics: RecognitionApplyDiagnostic[] = topologySanity.diagnostics.map((diagnostic) => ({
    candidateId: diagnostic.candidateId ?? "topology",
    severity: diagnostic.severity,
    message: diagnostic.message,
  }));

  const walls = applyWalls(sanitizedDraft, input.referencePlan, input.document, input.idFactory);
  const openings = applyOpenings(sanitizedDraft, input.referencePlan, walls.document, walls.candidateToWallId, input.idFactory);
  return {
    document: openings.document,
    appliedCandidateIds: [...walls.appliedCandidateIds, ...openings.appliedCandidateIds],
    diagnostics: [...topologyDiagnostics, ...walls.diagnostics, ...openings.diagnostics],
  };
}
