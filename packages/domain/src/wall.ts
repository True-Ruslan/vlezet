export type Millimeters = number;

export type Point2 = Readonly<{
  x: Millimeters;
  y: Millimeters;
}>;

export type V1Wall = Readonly<{
  id: string;
  start: Point2;
  end: Point2;
  thickness: Millimeters;
}>;

export type Wall = Readonly<{
  id: string;
  startVertexId: string;
  endVertexId: string;
  junctionVertexIds: readonly string[];
  thickness: Millimeters;
}>;

export type CreateWallInput = Wall;

export function createWall(input: CreateWallInput): Wall {
  if (!input.id) throw new Error("Wall id must not be empty");
  if (!input.startVertexId || !input.endVertexId) {
    throw new Error("Wall endpoints must reference vertices");
  }
  if (input.startVertexId === input.endVertexId) {
    throw new Error("Wall endpoints must reference different vertices");
  }
  if (!Number.isFinite(input.thickness) || input.thickness <= 0) {
    throw new RangeError("Wall thickness must be a positive finite number");
  }

  return {
    id: input.id,
    startVertexId: input.startVertexId,
    endVertexId: input.endVertexId,
    junctionVertexIds: [...input.junctionVertexIds],
    thickness: input.thickness,
  };
}
