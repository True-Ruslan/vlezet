import type { PlacedObject, VlezetDocument } from "@vlezet/domain";
import {
  deriveRooms,
  distanceBetween,
  objectRectangle,
  orientedRectangleCorners,
} from "@vlezet/geometry";
import type { PlanningCandidate } from "./contracts";

export const MAX_PLANNING_CONSTRAINTS = 9;

export type LockObjectPlanningConstraint = Readonly<{
  kind: "lock-object";
  objectId: string;
}>;

export type PreferRoomBoundaryPlanningConstraint = Readonly<{
  kind: "prefer-room-boundary";
  objectId: string;
  target: "wall" | "corner";
}>;

export type PairDistancePlanningConstraint = Readonly<{
  kind: "pair-distance";
  objectIds: readonly [string, string];
  preference: "near" | "far";
}>;

export type PlanningConstraint =
  | LockObjectPlanningConstraint
  | PreferRoomBoundaryPlanningConstraint
  | PairDistancePlanningConstraint;

export type PlanningConstraintEvaluation = Readonly<{
  hardValid: boolean;
  preferencePenalty: number;
  evidence: readonly string[];
}>;

function stableConstraintIdentity(constraint: PlanningConstraint): string {
  switch (constraint.kind) {
    case "lock-object":
      return `lock:${constraint.objectId}`;
    case "prefer-room-boundary":
      return `boundary:${constraint.objectId}`;
    case "pair-distance":
      return `pair:${constraint.objectIds[0]}:${constraint.objectIds[1]}`;
  }
}

function stableConstraintValue(constraint: PlanningConstraint): string {
  switch (constraint.kind) {
    case "lock-object":
      return stableConstraintIdentity(constraint);
    case "prefer-room-boundary":
      return `${stableConstraintIdentity(constraint)}:${constraint.target}`;
    case "pair-distance":
      return `${stableConstraintIdentity(constraint)}:${constraint.preference}`;
  }
}

export function normalizePlanningConstraints(
  constraints: readonly PlanningConstraint[] = [],
): readonly PlanningConstraint[] {
  const normalized = constraints.map((constraint): PlanningConstraint => {
    if (!constraint || typeof constraint !== "object" || !("kind" in constraint)) {
      throw new Error("Unsupported planning constraint.");
    }
    switch (constraint.kind) {
      case "lock-object":
        if (typeof constraint.objectId !== "string" || constraint.objectId.length === 0) throw new Error("Invalid lock-object constraint.");
        return { kind: "lock-object", objectId: constraint.objectId };
      case "prefer-room-boundary":
        if (typeof constraint.objectId !== "string" || constraint.objectId.length === 0 || (constraint.target !== "wall" && constraint.target !== "corner")) {
          throw new Error("Invalid prefer-room-boundary constraint.");
        }
        return { kind: "prefer-room-boundary", objectId: constraint.objectId, target: constraint.target };
      case "pair-distance": {
        const ids = constraint.objectIds;
        if (!Array.isArray(ids) || ids.length !== 2 || typeof ids[0] !== "string" || typeof ids[1] !== "string" ||
          ids[0].length === 0 || ids[1].length === 0 ||
          (constraint.preference !== "near" && constraint.preference !== "far")) {
          throw new Error("Invalid pair-distance constraint.");
        }
        const ordered = ids[0].localeCompare(ids[1]) <= 0 ? [ids[0], ids[1]] : [ids[1], ids[0]];
        return { kind: "pair-distance", objectIds: [ordered[0]!, ordered[1]!], preference: constraint.preference };
      }
      default:
        throw new Error("Unsupported planning constraint.");
    }
  });
  return normalized.sort((first, second) => stableConstraintValue(first).localeCompare(stableConstraintValue(second)));
}

export function planningConstraintIdentityKey(constraint: PlanningConstraint): string {
  return stableConstraintIdentity(normalizePlanningConstraints([constraint])[0]!);
}

export function planningConstraintSetKey(constraints: readonly PlanningConstraint[] = []): string {
  return normalizePlanningConstraints(constraints).map(stableConstraintValue).join("|");
}

export function validatePlanningConstraintSet(
  constraints: readonly PlanningConstraint[] | undefined,
  selectedObjectIds: ReadonlySet<string>,
): readonly PlanningConstraint[] {
  const source = constraints ?? [];
  if (source.length > MAX_PLANNING_CONSTRAINTS) {
    throw new Error(`At most ${MAX_PLANNING_CONSTRAINTS} planning constraints are supported.`);
  }

  const normalized = normalizePlanningConstraints(source);
  const seen = new Set<string>();
  const locked = new Set<string>();

  for (const constraint of normalized) {
    const identity = stableConstraintIdentity(constraint);
    if (seen.has(identity)) throw new Error(`Duplicate or conflicting planning constraint: ${identity}`);
    seen.add(identity);

    if (constraint.kind === "pair-distance") {
      const [first, second] = constraint.objectIds;
      if (first === second) throw new Error("Pair-distance constraint requires two distinct objects.");
      if (!selectedObjectIds.has(first) || !selectedObjectIds.has(second)) {
        throw new Error("Pair-distance constraint references an object outside the planning selection.");
      }
      continue;
    }

    if (!selectedObjectIds.has(constraint.objectId)) {
      throw new Error("Planning constraint references an object outside the planning selection.");
    }
    if (constraint.kind === "lock-object") locked.add(constraint.objectId);
  }

  if (selectedObjectIds.size > 0 && locked.size === selectedObjectIds.size) {
    throw new Error("At least one selected object must remain movable.");
  }

  return normalized;
}

function sameRotation(first: number, second: number): boolean {
  return ((first - second) % 360 + 360) % 360 === 0;
}

function roomBounds(room: Readonly<{ polygon: readonly Readonly<{ x: number; y: number }>[] }>) {
  const xs = room.polygon.map((point) => point.x);
  const ys = room.polygon.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, diagonal: Math.hypot(maxX - minX, maxY - minY) };
}

function appliedObjects(document: VlezetDocument, candidate: PlanningCandidate): Map<string, PlacedObject> | null {
  const placements = new Map(candidate.placements.map((placement) => [placement.objectId, placement]));
  if (placements.size !== candidate.placements.length) return null;
  const result = new Map<string, PlacedObject>();
  for (const object of document.placedObjects) {
    const placement = placements.get(object.id);
    result.set(object.id, placement ? {
      ...object,
      position: { ...placement.position },
      rotationDeg: placement.rotationDeg,
    } : object);
  }
  return result;
}

function objectName(document: VlezetDocument, objectId: string): string {
  return document.placedObjects.find((object) => object.id === objectId)?.name ?? objectId;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function evaluatePlanningConstraints(
  document: VlezetDocument,
  candidate: PlanningCandidate,
): PlanningConstraintEvaluation {
  const placementIds = new Set(candidate.placements.map((placement) => placement.objectId));
  let constraints: readonly PlanningConstraint[];
  try {
    constraints = validatePlanningConstraintSet(candidate.constraints, placementIds);
  } catch {
    return {
      hardValid: false,
      preferencePenalty: Number.POSITIVE_INFINITY,
      evidence: ["Вариант содержит конфликтующие, устаревшие или неподдерживаемые ограничения."],
    };
  }
  if (constraints.length === 0) return { hardValid: true, preferencePenalty: 0, evidence: [] };

  const room = deriveRooms(document).rooms.find((item) => item.id === candidate.roomId);
  const objects = appliedObjects(document, candidate);
  if (!room || !objects) return { hardValid: false, preferencePenalty: Number.POSITIVE_INFINITY, evidence: ["Не удалось проверить ограничения варианта."] };
  const bounds = roomBounds(room);
  if (!Number.isFinite(bounds.diagonal) || bounds.diagonal <= 0) {
    return { hardValid: false, preferencePenalty: Number.POSITIVE_INFINITY, evidence: ["Не удалось определить масштаб комнаты для ограничений."] };
  }

  const evidence: string[] = [];
  let preferencePenalty = 0;
  let hardValid = true;

  for (const constraint of constraints) {
    if (constraint.kind === "lock-object") {
      const source = document.placedObjects.find((object) => object.id === constraint.objectId);
      const placement = candidate.placements.find((item) => item.objectId === constraint.objectId);
      if (!source || !placement ||
        source.position.x !== placement.position.x || source.position.y !== placement.position.y ||
        !sameRotation(source.rotationDeg, placement.rotationDeg)) {
        hardValid = false;
        evidence.push(`${objectName(document, constraint.objectId)} больше не соответствует зафиксированному положению.`);
      } else {
        evidence.push(`${source.name} зафиксирован и не перемещается.`);
      }
      continue;
    }

    if (constraint.kind === "prefer-room-boundary") {
      const object = objects.get(constraint.objectId);
      if (!object) {
        hardValid = false;
        evidence.push("Не найден предмет для проверки предпочтения.");
        continue;
      }
      const corners = orientedRectangleCorners(objectRectangle(object));
      if (constraint.target === "wall") {
        const gap = Math.max(0, Math.min(...corners.flatMap((point) => [
          point.x - bounds.minX,
          bounds.maxX - point.x,
          point.y - bounds.minY,
          bounds.maxY - point.y,
        ])));
        preferencePenalty += clampUnit(gap / bounds.diagonal);
        evidence.push(`${object.name}: до ближайшей стены ${Math.round(gap)} мм.`);
      } else {
        const roomCorners = [
          { x: bounds.minX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.maxY },
          { x: bounds.minX, y: bounds.maxY },
        ];
        const distance = Math.min(...corners.flatMap((corner) => roomCorners.map((roomCorner) => distanceBetween(corner, roomCorner))));
        preferencePenalty += clampUnit(distance / bounds.diagonal);
        evidence.push(`${object.name}: до ближайшего угла ${Math.round(distance)} мм.`);
      }
      continue;
    }

    const [firstId, secondId] = constraint.objectIds;
    const first = objects.get(firstId);
    const second = objects.get(secondId);
    if (!first || !second) {
      hardValid = false;
      evidence.push("Не найдены предметы для проверки парного предпочтения.");
      continue;
    }
    const distance = distanceBetween(first.position, second.position);
    const normalized = clampUnit(distance / bounds.diagonal);
    preferencePenalty += constraint.preference === "near" ? normalized : 1 - normalized;
    const label = constraint.preference === "near" ? "ближе" : "дальше";
    evidence.push(`${first.name} ↔ ${second.name}: ${Math.round(distance)} мм между центрами; предпочтение «${label}».`);
  }

  return { hardValid, preferencePenalty, evidence };
}
