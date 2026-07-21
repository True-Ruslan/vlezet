export type Millimeters = number;

export type Point2 = Readonly<{
  x: Millimeters;
  y: Millimeters;
}>;

export type Wall = Readonly<{
  id: string;
  start: Point2;
  end: Point2;
  thickness: Millimeters;
}>;

export type CreateWallInput = Wall;

export function createWall(input: CreateWallInput): Wall {
  return {
    id: input.id,
    start: { ...input.start },
    end: { ...input.end },
    thickness: input.thickness,
  };
}
