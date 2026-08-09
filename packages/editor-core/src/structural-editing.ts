import { getWallEndpoints, type Point2, type VlezetDocument, type Wall } from "@vlezet/domain";
import { GEOMETRY_EPSILON_MM, validateTopology } from "@vlezet/geometry";
import { validateOpening } from "./opening-editing";
import {
  MAX_WALL_THICKNESS_MM,
  MIN_WALL_THICKNESS_MM,
  setWallThickness,
} from "./topology-editing";

export type StructuralTransactionCode = "invalid-input" | "topology" | "opening";

export type StructuralTransactionResult =
  | Readonly<{
      ok: true;
      document: VlezetDocument;
      affectedVertexIds: readonly string[];
      affectedWallIds: readonly string[];
    }>
  | Readonly<{
      ok: false;
      candidate: VlezetDocument | null;
      code: StructuralTransactionCode;
      reason: string;
      affectedVertexIds: readonly string[];
      affectedWallIds: readonly string[];
    }>;

export type StructuralValidationContext = Readonly<{
  affectedVertexIds: readonly string[];
  affectedWallIds: readonly string[];
  preserveDirectionsForWallIds: readonly string[];
}>;

function finitePoint(point: Point2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function rejection(
  code: StructuralTransactionCode,
  reason: string,
  candidate: VlezetDocument | null,
  affectedVertexIds: readonly string[] = [],
  affectedWallIds: readonly string[] = [],
): StructuralTransactionResult {
  return {
    ok: false,
    candidate,
    code,
    reason,
    affectedVertexIds,
    affectedWallIds,
  };
}

function accepted(
  document: VlezetDocument,
  affectedVertexIds: readonly string[],
  affectedWallIds: readonly string[],
): StructuralTransactionResult {
  return { ok: true, document, affectedVertexIds, affectedWallIds };
}

function uniqueDocumentOrder(ids: ReadonlySet<string>, source: readonly Readonly<{ id: string }>[]): string[] {
  return source.flatMap((item) => ids.has(item.id) ? [item.id] : []);
}

function wallsReferencingVertices(
  document: VlezetDocument,
  vertexIds: ReadonlySet<string>,
): string[] {
  return document.walls.flatMap((wall) =>
    vertexIds.has(wall.startVertexId) ||
    vertexIds.has(wall.endVertexId) ||
    wall.junctionVertexIds.some((id) => vertexIds.has(id))
      ? [wall.id]
      : [],
  );
}

function wallById(document: VlezetDocument, wallId: string): Wall | null {
  return document.walls.find((wall) => wall.id === wallId) ?? null;
}

function assertPreservedWallDirections(
  before: VlezetDocument,
  candidate: VlezetDocument,
  wallIds: readonly string[],
): string | null {
  for (const wallId of wallIds) {
    const beforeWall = wallById(before, wallId);
    const afterWall = wallById(candidate, wallId);
    if (!beforeWall || !afterWall) return `Стена ${wallId} отсутствует после структурного изменения`;

    const beforeEndpoints = getWallEndpoints(before, beforeWall);
    const afterEndpoints = getWallEndpoints(candidate, afterWall);
    const beforeVector = {
      x: beforeEndpoints.end.position.x - beforeEndpoints.start.position.x,
      y: beforeEndpoints.end.position.y - beforeEndpoints.start.position.y,
    };
    const afterVector = {
      x: afterEndpoints.end.position.x - afterEndpoints.start.position.x,
      y: afterEndpoints.end.position.y - afterEndpoints.start.position.y,
    };
    const beforeLength = Math.hypot(beforeVector.x, beforeVector.y);
    const afterLength = Math.hypot(afterVector.x, afterVector.y);
    if (beforeLength <= GEOMETRY_EPSILON_MM || afterLength <= GEOMETRY_EPSILON_MM) {
      return "Структурное изменение схлопнет стену до нулевой длины";
    }
    const directionDot = beforeVector.x * afterVector.x + beforeVector.y * afterVector.y;
    if (directionDot <= 0) {
      return "Структурное изменение развернёт направление связанной стены";
    }
  }
  return null;
}

export function validateStructuralCandidate(
  before: VlezetDocument,
  candidate: VlezetDocument,
  context: StructuralValidationContext,
): StructuralTransactionResult {
  for (const vertex of candidate.vertices) {
    if (!finitePoint(vertex.position)) {
      return rejection(
        "topology",
        "Структурное изменение создаст некорректные координаты",
        candidate,
        context.affectedVertexIds,
        context.affectedWallIds,
      );
    }
  }

  const directionFailure = assertPreservedWallDirections(
    before,
    candidate,
    context.preserveDirectionsForWallIds,
  );
  if (directionFailure) {
    return rejection(
      "topology",
      directionFailure,
      candidate,
      context.affectedVertexIds,
      context.affectedWallIds,
    );
  }

  const topologyError = validateTopology(candidate).find((diagnostic) => diagnostic.severity === "error");
  if (topologyError) {
    return rejection(
      "topology",
      topologyError.message,
      candidate,
      context.affectedVertexIds,
      context.affectedWallIds,
    );
  }

  try {
    for (const opening of candidate.openings) {
      validateOpening(candidate, opening, opening.id);
    }
  } catch (error) {
    return rejection(
      "opening",
      error instanceof Error ? error.message : "Проём станет недопустимым после структурного изменения",
      candidate,
      context.affectedVertexIds,
      context.affectedWallIds,
    );
  }

  return accepted(candidate, context.affectedVertexIds, context.affectedWallIds);
}

export function evaluateStructuralVertexMove(
  document: VlezetDocument,
  vertexId: string,
  position: Point2,
): StructuralTransactionResult {
  if (!vertexId || !finitePoint(position)) {
    return rejection("invalid-input", "Координаты вершины должны быть конечными числами", null);
  }
  if (!document.vertices.some((vertex) => vertex.id === vertexId)) {
    return rejection("invalid-input", `Vertex does not exist: ${vertexId}`, null);
  }

  const movedVertexIds = new Set([vertexId]);
  const affectedVertexIds = uniqueDocumentOrder(movedVertexIds, document.vertices);
  const affectedWallIds = wallsReferencingVertices(document, movedVertexIds);
  const endpointWallIds = document.walls.flatMap((wall) =>
    wall.startVertexId === vertexId || wall.endVertexId === vertexId ? [wall.id] : [],
  );

  const candidate: VlezetDocument = {
    ...document,
    vertices: document.vertices.map((vertex) =>
      vertex.id === vertexId ? { ...vertex, position: { ...position } } : vertex,
    ),
  };

  return validateStructuralCandidate(document, candidate, {
    affectedVertexIds,
    affectedWallIds,
    preserveDirectionsForWallIds: endpointWallIds,
  });
}

export function evaluateStructuralWallTranslation(
  document: VlezetDocument,
  wallId: string,
  delta: Point2,
): StructuralTransactionResult {
  if (!wallId || !finitePoint(delta)) {
    return rejection("invalid-input", "Смещение стены должно состоять из конечных чисел", null);
  }
  const wall = wallById(document, wallId);
  if (!wall) return rejection("invalid-input", `Wall does not exist: ${wallId}`, null);

  const movedVertexSet = new Set([
    wall.startVertexId,
    wall.endVertexId,
    ...wall.junctionVertexIds,
  ]);
  const affectedVertexIds = uniqueDocumentOrder(movedVertexSet, document.vertices);
  const affectedWallIds = wallsReferencingVertices(document, movedVertexSet);
  const endpointAffectedWallIds = document.walls.flatMap((candidateWall) =>
    movedVertexSet.has(candidateWall.startVertexId) || movedVertexSet.has(candidateWall.endVertexId)
      ? [candidateWall.id]
      : [],
  );

  const candidate: VlezetDocument = {
    ...document,
    vertices: document.vertices.map((vertex) =>
      movedVertexSet.has(vertex.id)
        ? {
            ...vertex,
            position: {
              x: vertex.position.x + delta.x,
              y: vertex.position.y + delta.y,
            },
          }
        : vertex,
    ),
  };

  return validateStructuralCandidate(document, candidate, {
    affectedVertexIds,
    affectedWallIds,
    preserveDirectionsForWallIds: endpointAffectedWallIds,
  });
}

export function evaluateWallThicknessBatch(
  document: VlezetDocument,
  wallIds: readonly string[],
  thicknessMm: number,
): StructuralTransactionResult {
  if (!Number.isFinite(thicknessMm) ||
      thicknessMm < MIN_WALL_THICKNESS_MM ||
      thicknessMm > MAX_WALL_THICKNESS_MM) {
    return rejection(
      "invalid-input",
      `Толщина стены должна быть от ${MIN_WALL_THICKNESS_MM} до ${MAX_WALL_THICKNESS_MM} мм`,
      null,
    );
  }
  if (wallIds.length === 0) {
    return rejection("invalid-input", "Для пакетного изменения выберите хотя бы одну стену", null);
  }

  const requested = new Set<string>();
  for (const wallId of wallIds) {
    if (!wallId || requested.has(wallId)) {
      return rejection("invalid-input", "Список стен для пакетного изменения должен быть уникальным", null);
    }
    if (!wallById(document, wallId)) {
      return rejection("invalid-input", `Wall does not exist: ${wallId}`, null);
    }
    requested.add(wallId);
  }

  const affectedWallIds = uniqueDocumentOrder(requested, document.walls);
  let candidate = document;
  try {
    for (const wallId of affectedWallIds) {
      candidate = setWallThickness(candidate, wallId, thicknessMm, "center");
    }
  } catch (error) {
    return rejection(
      "topology",
      error instanceof Error ? error.message : "Не удалось изменить толщину выбранных стен",
      null,
      [],
      affectedWallIds,
    );
  }

  return validateStructuralCandidate(document, candidate, {
    affectedVertexIds: [],
    affectedWallIds,
    preserveDirectionsForWallIds: affectedWallIds,
  });
}
