import {
  deriveRectangularRoomDimensions,
  type DerivedRoom,
  type Point2,
} from "@vlezet/geometry";
import {
  formatMillimeters,
  formatNumberRu,
  formatSquareMeters,
} from "../ui/presentation-format";

export type LinearDimensionAnnotation = Readonly<{
  kind: "clear-room" | "centreline-wall";
  axis: "horizontal" | "vertical" | "free";
  start: Point2;
  end: Point2;
  valueMm: number;
  outward: Point2;
}>;

const NBSP = "\u00a0";

function bounds(points: readonly Point2[]): Readonly<{ minX: number; maxX: number; minY: number; maxY: number }> {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

export function formatAreaM2FromSquareMillimeters(areaMm2: number): string {
  return formatNumberRu(areaMm2 / 1_000_000, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function deriveRectangularRoomDimensionAnnotations(room: DerivedRoom): readonly LinearDimensionAnnotation[] {
  const dimensions = deriveRectangularRoomDimensions(room);
  if (!dimensions) return [];

  const { minX, maxX, minY, maxY } = bounds(room.polygon);
  return [
    {
      kind: "clear-room",
      axis: "horizontal",
      start: { x: minX, y: minY },
      end: { x: maxX, y: minY },
      valueMm: dimensions.widthMm,
      outward: { x: 0, y: -1 },
    },
    {
      kind: "clear-room",
      axis: "vertical",
      start: { x: minX, y: minY },
      end: { x: minX, y: maxY },
      valueMm: dimensions.heightMm,
      outward: { x: -1, y: 0 },
    },
  ];
}

export function deriveWallCentrelineDimensionAnnotation(start: Point2, end: Point2): LinearDimensionAnnotation | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const valueMm = Math.hypot(dx, dy);
  if (!Number.isFinite(valueMm) || valueMm <= 1e-6) return null;

  const axis = Math.abs(dy) <= 1e-6
    ? "horizontal"
    : Math.abs(dx) <= 1e-6
      ? "vertical"
      : "free";

  return {
    kind: "centreline-wall",
    axis,
    start,
    end,
    valueMm,
    outward: { x: -dy / valueMm, y: dx / valueMm },
  };
}

export function formatDimensionValue(annotation: LinearDimensionAnnotation): string {
  const suffix = annotation.kind === "clear-room" ? "внутри" : "по оси";
  return `${formatMillimeters(Math.round(annotation.valueMm))} ${suffix}`;
}

export function formatRoomCanvasLabel(room: DerivedRoom): string {
  const dimensions = deriveRectangularRoomDimensions(room);
  const base = `${room.name}\n${formatSquareMeters(room.areaMm2 / 1_000_000)}`;
  if (!dimensions) return base;
  const width = formatNumberRu(Math.round(dimensions.widthMm), { useGrouping: false, maximumFractionDigits: 0 });
  const height = formatNumberRu(Math.round(dimensions.heightMm), { useGrouping: false, maximumFractionDigits: 0 });
  return `${base}\n${width} × ${height}${NBSP}мм внутри`;
}
