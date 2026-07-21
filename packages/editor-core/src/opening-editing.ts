import { getVertex, getWallEndpoints, type Opening, type VlezetDocument } from "@vlezet/domain";
import { GEOMETRY_EPSILON_MM } from "@vlezet/geometry";
import { topologicalWallLength } from "./topology-editing";

export type OpeningPatch = Readonly<{
  wallId?: string;
  kind?: "door" | "window";
  offset?: number;
  width?: number;
  doorSwing?: Opening["doorSwing"];
}>;

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd) - GEOMETRY_EPSILON_MM;
}

export function validateOpening(
  document: VlezetDocument,
  opening: Opening,
  excludeOpeningId?: string,
): void {
  if (!opening.id) throw new Error("Идентификатор проёма не может быть пустым");
  const wall = document.walls.find((candidate) => candidate.id === opening.wallId);
  if (!wall) throw new Error("Не найдена стена для проёма");
  if (!Number.isFinite(opening.offset) || opening.offset < 0) throw new RangeError("Смещение проёма должно быть неотрицательным");
  if (!Number.isFinite(opening.width) || opening.width <= 0) throw new RangeError("Ширина проёма должна быть положительной");

  const wallLength = topologicalWallLength(document, wall.id);
  const openingEnd = opening.offset + opening.width;
  if (openingEnd > wallLength + GEOMETRY_EPSILON_MM) {
    throw new Error("Проём не помещается в длину стены");
  }

  for (const other of document.openings) {
    if (other.id === excludeOpeningId || other.wallId !== opening.wallId) continue;
    if (intervalsOverlap(opening.offset, openingEnd, other.offset, other.offset + other.width)) {
      throw new Error("Проёмы на одной стене не должны пересекаться");
    }
  }

  const { start, end } = getWallEndpoints(document, wall);
  const dx = end.position.x - start.position.x;
  const dy = end.position.y - start.position.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  for (const junctionId of wall.junctionVertexIds) {
    const junction = getVertex(document, junctionId);
    const junctionOffset = (junction.position.x - start.position.x) * ux + (junction.position.y - start.position.y) * uy;
    if (junctionOffset > opening.offset + GEOMETRY_EPSILON_MM && junctionOffset < openingEnd - GEOMETRY_EPSILON_MM) {
      throw new Error("Проём не может пересекать соединение стен");
    }
  }
}

export function addOpening(document: VlezetDocument, opening: Opening): VlezetDocument {
  if (document.openings.some((candidate) => candidate.id === opening.id)) {
    throw new Error(`Opening already exists: ${opening.id}`);
  }
  validateOpening(document, opening);
  return { ...document, openings: [...document.openings, opening] };
}

export function updateOpening(document: VlezetDocument, openingId: string, patch: OpeningPatch): VlezetDocument {
  const current = document.openings.find((opening) => opening.id === openingId);
  if (!current) throw new Error(`Opening does not exist: ${openingId}`);

  const next: Opening = {
    ...current,
    ...patch,
    ...(patch.kind === "window" ? { doorSwing: undefined } : {}),
  };
  validateOpening(document, next, openingId);
  return {
    ...document,
    openings: document.openings.map((opening) => opening.id === openingId ? next : opening),
  };
}

export function deleteOpening(document: VlezetDocument, openingId: string): VlezetDocument {
  if (!document.openings.some((opening) => opening.id === openingId)) throw new Error(`Opening does not exist: ${openingId}`);
  return { ...document, openings: document.openings.filter((opening) => opening.id !== openingId) };
}
