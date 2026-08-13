import type { Opening, VlezetDocument } from "@vlezet/domain";
import {
  GEOMETRY_EPSILON_MM,
  projectPointToWallOffset,
  proposeOpeningPlacement,
  type Point2,
} from "@vlezet/geometry";
import { validateOpening } from "./opening-editing";

export type HostedOpeningMoveResult =
  | Readonly<{
      ok: true;
      document: VlezetDocument;
      opening: Opening;
      changed: boolean;
    }>
  | Readonly<{
      ok: false;
      candidate: VlezetDocument | null;
      reason: string;
    }>;

function rejectionReason(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

export function evaluateHostedOpeningMove(
  document: VlezetDocument,
  openingId: string,
  pointerWorld: Point2,
): HostedOpeningMoveResult {
  const current = document.openings.find((opening) => opening.id === openingId);
  if (!current) {
    return { ok: false, candidate: null, reason: `Проём ${openingId} не найден` };
  }
  if (!Number.isFinite(pointerWorld.x) || !Number.isFinite(pointerWorld.y)) {
    return { ok: false, candidate: null, reason: "Позиция проёма должна быть конечной" };
  }

  let next: Opening;
  try {
    const pointerOffset = projectPointToWallOffset(document, current.wallId, pointerWorld);
    const placement = proposeOpeningPlacement(document, current.wallId, pointerOffset, current.width);
    next = { ...current, offset: placement.offset };
  } catch (error) {
    return { ok: false, candidate: null, reason: rejectionReason(error, "Не удалось спроецировать проём на стену") };
  }

  const candidate: VlezetDocument = {
    ...document,
    openings: document.openings.map((opening) => opening.id === openingId ? next : opening),
  };
  try {
    validateOpening(candidate, next, openingId);
  } catch (error) {
    return { ok: false, candidate, reason: rejectionReason(error, "Положение проёма недопустимо") };
  }

  return {
    ok: true,
    document: candidate,
    opening: next,
    changed: Math.abs(next.offset - current.offset) > GEOMETRY_EPSILON_MM,
  };
}
