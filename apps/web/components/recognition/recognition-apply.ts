import {
  getWallEndpoints,
  type Opening,
  type Point2,
  type VlezetDocument,
} from "@vlezet/domain";
import {
  addOpening,
  addTopologicalWall,
  MAX_WALL_THICKNESS_MM,
  MIN_WALL_THICKNESS_MM,
  type WallEndpointIntent,
} from "@vlezet/editor-core";
import {
  imagePointToWorld,
  projectPointToSegment,
  projectPointToWallOffset,
} from "@vlezet/geometry";
import type { ReferencePlan } from "@vlezet/projects";
import type {
  NormalizedPoint,
  RecognitionDraft,
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
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

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizedToWorld(point: NormalizedPoint, reference: ReferencePlan): Point2 {
  return imagePointToWorld({
    x: point.x * reference.widthPx,
    y: point.y * reference.heightPx,
  }, reference.transform);
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

function isDuplicateWall(document: VlezetDocument, start: Point2, end: Point2): boolean {
  return document.walls.some((wall) => {
    const endpoints = getWallEndpoints(document, wall);
    return wallEndpointDistance(start, end, endpoints.start.position, endpoints.end.position) <= DUPLICATE_WALL_TOLERANCE_MM;
  });
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

function thicknessMm(candidate: RecognitionWallCandidate, reference: ReferencePlan): number {
  const estimated = candidate.estimatedThicknessPx == null
    ? 150
    : candidate.estimatedThicknessPx * reference.transform.millimetersPerPixel;
  return Math.min(MAX_WALL_THICKNESS_MM, Math.max(MIN_WALL_THICKNESS_MM, estimated));
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

  for (const candidate of draft.walls) {
    if (!accepted(draft, candidate.id)) continue;
    if (candidate.conflict) {
      diagnostics.push({ candidateId: candidate.id, severity: "warning", message: "Кандидат стены содержит конфликт и не был применён." });
      continue;
    }
    const start = normalizedToWorld(candidate.start, reference);
    const end = normalizedToWorld(candidate.end, reference);
    if (distance(start, end) < MIN_RECOGNIZED_WALL_LENGTH_MM) {
      diagnostics.push({ candidateId: candidate.id, severity: "warning", message: "Слишком короткая стена пропущена." });
      continue;
    }
    if (isDuplicateWall(document, start, end)) {
      diagnostics.push({ candidateId: candidate.id, severity: "info", message: "Совпадающая существующая стена не добавлена повторно." });
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
        thickness: thicknessMm(candidate, reference),
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
      diagnostics.push({ candidateId: candidate.id, severity: "warning", message: "Стена для проёма не была применена, поэтому проём пропущен." });
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
  const walls = applyWalls(input.draft, input.referencePlan, input.document, input.idFactory);
  const openings = applyOpenings(input.draft, input.referencePlan, walls.document, walls.candidateToWallId, input.idFactory);
  return {
    document: openings.document,
    appliedCandidateIds: [...walls.appliedCandidateIds, ...openings.appliedCandidateIds],
    diagnostics: [...walls.diagnostics, ...openings.diagnostics],
  };
}
