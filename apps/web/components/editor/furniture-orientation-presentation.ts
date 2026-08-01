export type FurnitureLocalSide = "front" | "right" | "back" | "left";
export type ScreenSide = "top" | "right" | "bottom" | "left";
export type ScreenDirection =
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left"
  | "top-left"
  | "top"
  | "top-right";
export type UnitScreenVector = Readonly<{ x: number; y: number }>;

const LOCAL_SCREEN_VECTORS: Readonly<Record<FurnitureLocalSide, UnitScreenVector>> = {
  front: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
  back: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
};

const SCREEN_DIRECTION_LABELS: Readonly<Record<ScreenDirection, string>> = {
  right: "справа на плане",
  "bottom-right": "снизу справа на плане",
  bottom: "снизу на плане",
  "bottom-left": "снизу слева на плане",
  left: "слева на плане",
  "top-left": "сверху слева на плане",
  top: "сверху на плане",
  "top-right": "сверху справа на плане",
};

const SCREEN_DIRECTIONS: readonly ScreenDirection[] = [
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
  "top-left",
  "top",
  "top-right",
];

export type ClearanceSidePresentation = Readonly<{
  recommendedMm: number;
  actualMm: number | null;
  invalid: boolean;
}>;

function assertFiniteVector(vector: UnitScreenVector): void {
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) {
    throw new RangeError("Screen vector must be finite");
  }
  if (Math.hypot(vector.x, vector.y) <= 1e-12) {
    throw new RangeError("Screen vector must have a direction");
  }
}

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
  assertFiniteVector(vector);
  if (Math.abs(vector.x) > Math.abs(vector.y)) return vector.x >= 0 ? "right" : "left";
  return vector.y >= 0 ? "bottom" : "top";
}

export function describeFurnitureScreenDirection(vector: UnitScreenVector): string {
  assertFiniteVector(vector);
  const angle = (Math.atan2(vector.y, vector.x) * 180 / Math.PI + 360) % 360;
  const direction = SCREEN_DIRECTIONS[Math.round(angle / 45) % SCREEN_DIRECTIONS.length]!;
  return SCREEN_DIRECTION_LABELS[direction];
}
