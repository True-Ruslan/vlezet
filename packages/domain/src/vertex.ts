import type { Point2 } from "./wall";

export type Vertex = Readonly<{
  id: string;
  position: Point2;
}>;

export function createVertex(id: string, position: Point2): Vertex {
  if (!id) throw new Error("Vertex id must not be empty");
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new RangeError("Vertex position must contain finite coordinates");
  }

  return {
    id,
    position: { ...position },
  };
}
