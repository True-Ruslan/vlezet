import {
  pointFromCanvasPolar,
  vectorToCanvasAngleDeg,
  type Point2,
} from "@vlezet/geometry";

export type WallDynamicConstraints = Readonly<{
  lengthMm: number | null;
  angleDeg: number | null;
}>;

export type WallDynamicDraft = Readonly<{
  point: Point2;
  lengthMm: number;
  angleDeg: number;
}>;

export type WallDynamicInputKeyAction = "native" | "commit" | "cancel-numeric" | "none";

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseWallLengthInput(value: string): number | null {
  const parsed = parseDecimal(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function parseWallAngleInput(value: string): number | null {
  const parsed = parseDecimal(value);
  if (parsed === null) return null;
  const normalized = parsed % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function resolveWallDynamicDraft(
  start: Point2,
  pointerPoint: Point2,
  constraints: WallDynamicConstraints,
): WallDynamicDraft {
  if (![start.x, start.y, pointerPoint.x, pointerPoint.y].every(Number.isFinite)) {
    throw new RangeError("Wall draft points must contain finite coordinates");
  }
  if (constraints.lengthMm !== null && (!Number.isFinite(constraints.lengthMm) || constraints.lengthMm <= 0)) {
    throw new RangeError("Wall length must be a finite positive value");
  }
  if (constraints.angleDeg !== null && !Number.isFinite(constraints.angleDeg)) {
    throw new RangeError("Wall angle must be finite");
  }

  const pointerLength = Math.hypot(pointerPoint.x - start.x, pointerPoint.y - start.y);
  const lengthMm = constraints.lengthMm ?? pointerLength;

  let angleDeg: number;
  if (constraints.angleDeg !== null) {
    const normalized = constraints.angleDeg % 360;
    angleDeg = normalized < 0 ? normalized + 360 : normalized;
  } else if (pointerLength > 0) {
    angleDeg = vectorToCanvasAngleDeg(start, pointerPoint);
  } else if (constraints.lengthMm !== null) {
    throw new RangeError("Pointer direction is required when only exact length is constrained");
  } else {
    angleDeg = 0;
  }

  if (constraints.lengthMm === null && constraints.angleDeg === null) {
    return { point: { ...pointerPoint }, lengthMm, angleDeg };
  }
  if (lengthMm === 0) {
    return { point: { ...start }, lengthMm: 0, angleDeg };
  }

  return {
    point: pointFromCanvasPolar(start, lengthMm, angleDeg),
    lengthMm,
    angleDeg,
  };
}

export function clampFloatingInputPosition(
  anchor: Readonly<{ x: number; y: number }>,
  panel: Readonly<{ width: number; height: number }>,
  viewport: Readonly<{ width: number; height: number }>,
  margin = 8,
): Readonly<{ x: number; y: number }> {
  if (![anchor.x, anchor.y, panel.width, panel.height, viewport.width, viewport.height, margin].every(Number.isFinite)) {
    throw new RangeError("Floating input geometry must be finite");
  }
  if (panel.width < 0 || panel.height < 0 || viewport.width < 0 || viewport.height < 0 || margin < 0) {
    throw new RangeError("Floating input geometry must be non-negative");
  }
  const maxX = Math.max(margin, viewport.width - panel.width - margin);
  const maxY = Math.max(margin, viewport.height - panel.height - margin);
  return {
    x: Math.min(Math.max(anchor.x, margin), maxX),
    y: Math.min(Math.max(anchor.y, margin), maxY),
  };
}

export function deriveWallDynamicInputKeyAction(input: Readonly<{
  key: string;
  valid: boolean;
}>): WallDynamicInputKeyAction {
  if (input.key === "Tab") return "native";
  if (input.key === "Escape") return "cancel-numeric";
  if (input.key === "Enter") return input.valid ? "commit" : "none";
  return "none";
}
