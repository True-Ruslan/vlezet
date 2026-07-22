import { normalizeRotationDeg, type PlacedObject } from "@vlezet/domain";
import { orientedRectangleCorners, type DerivedRoom } from "@vlezet/geometry";

export type PlanningPlacementOption = Readonly<{
  position: Readonly<{ x: number; y: number }>;
  rotationDeg: number;
}>;

function stableNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

export function orientationsFor(rotationDeg: number): readonly number[] {
  const current = normalizeRotationDeg(rotationDeg);
  const quarterTurn = normalizeRotationDeg(current + 90);
  return current === quarterTurn ? [current] : [current, quarterTurn];
}

function footprintHalfExtents(object: PlacedObject, rotationDeg: number): Readonly<{ x: number; y: number }> {
  const corners = orientedRectangleCorners({
    center: { x: 0, y: 0 },
    width: object.width,
    depth: object.depth,
    rotationDeg,
  });
  return {
    x: Math.max(...corners.map((point) => Math.abs(point.x))),
    y: Math.max(...corners.map((point) => Math.abs(point.y))),
  };
}

export function placementOptionsForObject(
  room: DerivedRoom,
  object: PlacedObject,
): readonly PlanningPlacementOption[] {
  const xs = room.polygon.map((point) => point.x);
  const ys = room.polygon.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const options: PlanningPlacementOption[] = [];
  const seen = new Set<string>();

  const add = (position: Readonly<{ x: number; y: number }>, rotationDeg: number) => {
    const key = `${stableNumber(position.x)}:${stableNumber(position.y)}:${stableNumber(rotationDeg)}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ position: { ...position }, rotationDeg });
  };

  for (const rotationDeg of orientationsFor(object.rotationDeg)) {
    const half = footprintHalfExtents(object, rotationDeg);
    const left = minX + half.x;
    const right = maxX - half.x;
    const top = minY + half.y;
    const bottom = maxY - half.y;
    if (left > right || top > bottom) continue;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    for (const position of [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
      { x: midX, y: top },
      { x: right, y: midY },
      { x: midX, y: bottom },
      { x: left, y: midY },
      { x: midX, y: midY },
      object.position,
    ]) add(position, rotationDeg);
  }

  return options;
}
