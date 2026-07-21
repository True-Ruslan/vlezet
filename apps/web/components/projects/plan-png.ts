import type { ObjectCategory, Point2, VlezetDocument } from "@vlezet/domain";
import {
  deriveDocumentBounds,
  deriveRooms,
  deriveVisibleWallIntervals,
  openingSegment,
  orientedRectangleCorners,
  pointAtWallOffset,
} from "@vlezet/geometry";

export type RenderPlanPngOptions = Readonly<{
  pixelRatio?: number;
  paddingPx?: number;
  maxDimension?: number;
}>;

function categoryFill(category: ObjectCategory): string {
  return {
    sleep: "#eef2ff",
    seating: "#f5f3ff",
    storage: "#f8fafc",
    table: "#fefce8",
    chair: "#fff7ed",
    kitchen: "#ecfeff",
    appliance: "#f0fdfa",
    custom: "#f9fafb",
  }[category];
}

function polygon(context: CanvasRenderingContext2D, points: readonly Point2[], map: (point: Point2) => Point2): void {
  if (points.length === 0) return;
  const first = map(points[0]!);
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    const screen = map(point);
    context.lineTo(screen.x, screen.y);
  }
  context.closePath();
}

function drawCenteredText(context: CanvasRenderingContext2D, text: string, position: Point2, width = 180): void {
  context.save();
  context.fillStyle = "#334155";
  context.font = "600 13px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width > width && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  const lineHeight = 16;
  lines.slice(0, 3).forEach((line, index) => context.fillText(line, position.x, position.y + (index - (lines.length - 1) / 2) * lineHeight));
  context.restore();
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed")), "image/png");
  });
}

export async function renderPlanPngBlob(
  document: VlezetDocument,
  options: RenderPlanPngOptions = {},
): Promise<Blob> {
  const pixelRatio = Math.max(1, Math.min(4, options.pixelRatio ?? 2));
  const padding = Math.max(24, options.paddingPx ?? 80);
  const maxDimension = Math.max(512, options.maxDimension ?? 8192);
  const bounds = deriveDocumentBounds(document) ?? { minX: 0, minY: 0, maxX: 5000, maxY: 3500 };
  const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
  const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
  let scale = Math.min(0.5, Math.max(0.12, 2200 / Math.max(worldWidth, worldHeight)));
  let cssWidth = worldWidth * scale + padding * 2;
  let cssHeight = worldHeight * scale + padding * 2;
  const physicalMax = Math.max(cssWidth, cssHeight) * pixelRatio;
  if (physicalMax > maxDimension) {
    const ratio = maxDimension / physicalMax;
    scale *= ratio;
    cssWidth = worldWidth * scale + padding * 2;
    cssHeight = worldHeight * scale + padding * 2;
  }

  const canvas = documentObject().createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(cssWidth * pixelRatio));
  canvas.height = Math.max(1, Math.ceil(cssHeight * pixelRatio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, cssWidth, cssHeight);
  context.lineJoin = "miter";
  context.lineCap = "square";

  const map = (point: Point2): Point2 => ({
    x: padding + (point.x - bounds.minX) * scale,
    y: padding + (point.y - bounds.minY) * scale,
  });

  const rooms = deriveRooms(document).rooms;
  for (const room of rooms) {
    polygon(context, room.polygon, map);
    context.fillStyle = "#f5f7fb";
    context.fill();
  }

  for (const wall of document.walls) {
    context.strokeStyle = "#232830";
    context.lineWidth = Math.max(2, wall.thickness * scale);
    for (const interval of deriveVisibleWallIntervals(document, wall.id)) {
      const start = map(pointAtWallOffset(document, wall.id, interval.startOffset));
      const end = map(pointAtWallOffset(document, wall.id, interval.endOffset));
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
  }

  for (const opening of document.openings) {
    const segment = openingSegment(document, opening);
    const wall = document.walls.find((candidate) => candidate.id === opening.wallId);
    if (!wall) continue;
    context.strokeStyle = "#475569";
    if (opening.kind === "window") {
      context.lineWidth = 1.5;
      const normalDistance = wall.thickness * 0.22;
      for (const sign of [-1, 1]) {
        const normal = { x: segment.leftNormal.x * normalDistance * sign, y: segment.leftNormal.y * normalDistance * sign };
        const start = map({ x: segment.start.x + normal.x, y: segment.start.y + normal.y });
        const end = map({ x: segment.end.x + normal.x, y: segment.end.y + normal.y });
        context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
      }
    } else {
      const hingeAtStart = opening.doorSwing?.hinge !== "end";
      const hinge = hingeAtStart ? segment.start : segment.end;
      const closed = hingeAtStart ? segment.tangent : { x: -segment.tangent.x, y: -segment.tangent.y };
      const side = opening.doorSwing?.side === "right" ? -1 : 1;
      const open = { x: segment.leftNormal.x * side, y: segment.leftNormal.y * side };
      const openEnd = map({ x: hinge.x + open.x * opening.width, y: hinge.y + open.y * opening.width });
      const hingeScreen = map(hinge);
      context.lineWidth = 2;
      context.beginPath(); context.moveTo(hingeScreen.x, hingeScreen.y); context.lineTo(openEnd.x, openEnd.y); context.stroke();
      const startAngle = Math.atan2(closed.y, closed.x);
      const endAngle = Math.atan2(open.y, open.x);
      let delta = endAngle - startAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      context.save();
      context.setLineDash([5, 4]);
      context.lineWidth = 1;
      context.beginPath();
      context.arc(hingeScreen.x, hingeScreen.y, opening.width * scale, startAngle, startAngle + delta, delta < 0);
      context.stroke();
      context.restore();
    }
  }

  for (const object of document.placedObjects) {
    const corners = orientedRectangleCorners({ center: object.position, width: object.width, depth: object.depth, rotationDeg: object.rotationDeg });
    polygon(context, corners, map);
    context.fillStyle = categoryFill(object.category);
    context.fill();
    context.strokeStyle = "#64748b";
    context.lineWidth = 1.5;
    context.stroke();
    drawCenteredText(context, object.name, map(object.position), Math.max(70, object.width * scale - 12));
  }

  for (const room of rooms) {
    const label = map(room.labelPoint);
    context.save();
    context.fillStyle = "#475569";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "600 13px Inter, system-ui, sans-serif";
    context.fillText(room.name, label.x, label.y - 8);
    context.font = "12px Inter, system-ui, sans-serif";
    context.fillText(`${room.areaM2.toFixed(2)} м²`, label.x, label.y + 9);
    context.restore();
  }

  return canvasBlob(canvas);
}

function documentObject(): Document {
  if (typeof window === "undefined" || !window.document) throw new Error("PNG export is available only in a browser");
  return window.document;
}
