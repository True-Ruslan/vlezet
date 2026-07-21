import type { Point2 } from "./wall";

export const MIN_PLACED_OBJECT_DIMENSION_MM = 50;
export const MAX_PLACED_OBJECT_DIMENSION_MM = 20_000;
export const MAX_PLACED_OBJECT_NAME_LENGTH = 120;

export type ObjectCategory =
  | "sleep"
  | "seating"
  | "storage"
  | "table"
  | "chair"
  | "kitchen"
  | "appliance"
  | "custom";

export type ClearanceMargins = Readonly<{
  front: number;
  right: number;
  back: number;
  left: number;
}>;

export type PlacedObject = Readonly<{
  id: string;
  presetId: string | null;
  name: string;
  category: ObjectCategory;
  position: Point2;
  width: number;
  depth: number;
  height?: number;
  rotationDeg: number;
  clearance: ClearanceMargins;
}>;

export type CreatePlacedObjectInput = PlacedObject;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
}

function assertDimension(value: number, label: string): void {
  assertFinite(value, label);
  if (value < MIN_PLACED_OBJECT_DIMENSION_MM || value > MAX_PLACED_OBJECT_DIMENSION_MM) {
    throw new RangeError(
      `${label} must be between ${MIN_PLACED_OBJECT_DIMENSION_MM} and ${MAX_PLACED_OBJECT_DIMENSION_MM} millimetres`,
    );
  }
}

function assertClearance(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0 || value > MAX_PLACED_OBJECT_DIMENSION_MM) {
    throw new RangeError(`${label} must be between 0 and ${MAX_PLACED_OBJECT_DIMENSION_MM} millimetres`);
  }
}

export function normalizeRotationDeg(value: number): number {
  assertFinite(value, "Rotation");
  const normalized = ((value % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function createPlacedObject(input: CreatePlacedObjectInput): PlacedObject {
  const id = input.id.trim();
  if (!id) throw new RangeError("Placed object id cannot be blank");

  const name = input.name.trim();
  if (!name) throw new RangeError("Placed object name cannot be blank");
  if (name.length > MAX_PLACED_OBJECT_NAME_LENGTH) {
    throw new RangeError(`Placed object name cannot exceed ${MAX_PLACED_OBJECT_NAME_LENGTH} characters`);
  }

  assertFinite(input.position.x, "Object X position");
  assertFinite(input.position.y, "Object Y position");
  assertDimension(input.width, "Object width");
  assertDimension(input.depth, "Object depth");
  if (input.height !== undefined) assertDimension(input.height, "Object height");

  assertClearance(input.clearance.front, "Front clearance");
  assertClearance(input.clearance.right, "Right clearance");
  assertClearance(input.clearance.back, "Back clearance");
  assertClearance(input.clearance.left, "Left clearance");

  const presetId = input.presetId?.trim() || null;

  return {
    id,
    presetId,
    name,
    category: input.category,
    position: { ...input.position },
    width: input.width,
    depth: input.depth,
    ...(input.height === undefined ? {} : { height: input.height }),
    rotationDeg: normalizeRotationDeg(input.rotationDeg),
    clearance: { ...input.clearance },
  };
}
