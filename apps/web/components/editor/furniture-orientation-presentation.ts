export type FurnitureLocalSide = "front" | "right" | "back" | "left";
export type ScreenSide = "top" | "right" | "bottom" | "left";
export type UnitScreenVector = Readonly<{ x: number; y: number }>;

const LOCAL_SCREEN_VECTORS: Readonly<Record<FurnitureLocalSide, UnitScreenVector>> = {
  front: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
  back: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
};

export type ClearanceSidePresentation = Readonly<{
  recommendedMm: number;
  actualMm: number | null;
  invalid: boolean;
}>;

export function furnitureLocalSideScreenVector(
  side: FurnitureLocalSide,
  rotationDeg: number,
): UnitScreenVector {
  if (!Number.isFinite(rotationDeg)) throw new RangeError("Furniture rotation must be finite");
  const radians = rotationDeg * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const source = LOCAL_SCREEN_VECTORS[side];
  const x = source.x * cosine - source.y * sine;
  const y = source.x * sine + source.y * cosine;
  return {
    x: Math.abs(x) < 1e-12 ? 0 : x,
    y: Math.abs(y) < 1e-12 ? 0 : y,
  };
}

export function classifyCardinalScreenSide(vector: UnitScreenVector): ScreenSide {
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) {
    throw new RangeError("Screen vector must be finite");
  }
  if (Math.abs(vector.x) > Math.abs(vector.y)) return vector.x >= 0 ? "right" : "left";
  return vector.y >= 0 ? "bottom" : "top";
}
