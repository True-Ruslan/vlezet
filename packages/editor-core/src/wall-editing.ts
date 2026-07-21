import type { Wall } from "@vlezet/domain";

export function wallLength(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

export function setWallLength(wall: Wall, lengthMm: number): Wall {
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) {
    throw new RangeError("Wall length must be a positive finite number");
  }

  const currentLength = wallLength(wall);
  if (!Number.isFinite(currentLength) || currentLength <= 0) {
    throw new RangeError("Cannot resize a zero-length wall");
  }

  const scale = lengthMm / currentLength;
  return {
    ...wall,
    end: {
      x: wall.start.x + (wall.end.x - wall.start.x) * scale,
      y: wall.start.y + (wall.end.y - wall.start.y) * scale,
    },
  };
}
