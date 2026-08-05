import {
  AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS,
  validateRecognitionDraft,
  type RecognitionDraft,
  type RecognitionOpeningCandidate,
  type RecognitionWallCandidate,
} from "@vlezet/recognition";

const MAX_OVERLAY_DATA_URL_CHARACTERS = 6 * 1024 * 1024;
const MAX_LABEL_ID_LENGTH = 96;

export interface RecognitionAiOverlayContext {
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
  clearRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  save(): void;
  restore(): void;
}

export interface RecognitionAiOverlayCanvas {
  width: number;
  height: number;
  getContext(type: "2d"): RecognitionAiOverlayContext | null;
  toDataURL(type?: string): string;
}

export type RecognitionAiOverlayCanvasFactory = () => RecognitionAiOverlayCanvas;

export type RenderRecognitionAiOverlayInput = Readonly<{
  sourceImage: CanvasImageSource;
  widthPx: number;
  heightPx: number;
  localDraft: RecognitionDraft;
  canvasFactory?: RecognitionAiOverlayCanvasFactory;
}>;

function positiveDimension(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} должен быть положительным целым числом.`);
  }
  return value;
}

function defaultCanvasFactory(): RecognitionAiOverlayCanvas {
  if (typeof document === "undefined") {
    throw new Error("Canvas недоступен в текущем окружении.");
  }
  return document.createElement("canvas");
}

function compareIds(left: Readonly<{ id: string }>, right: Readonly<{ id: string }>): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function pointX(normalized: number, widthPx: number): number {
  return normalized * widthPx;
}

function pointY(normalized: number, heightPx: number): number {
  return normalized * heightPx;
}

function safeLabelId(id: string): string {
  return id.length <= MAX_LABEL_ID_LENGTH
    ? id
    : `${id.slice(0, MAX_LABEL_ID_LENGTH - 1)}…`;
}

function drawWall(
  context: RecognitionAiOverlayContext,
  wall: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): void {
  const startX = pointX(wall.start.x, widthPx);
  const startY = pointY(wall.start.y, heightPx);
  const endX = pointX(wall.end.x, widthPx);
  const endY = pointY(wall.end.y, heightPx);
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.fillText(`W ${safeLabelId(wall.id)}`, (startX + endX) / 2, (startY + endY) / 2 - 8);
}

function openingPrefix(opening: RecognitionOpeningCandidate): "D" | "O" {
  return opening.kind === "door" ? "D" : "O";
}

function drawOpening(
  context: RecognitionAiOverlayContext,
  opening: RecognitionOpeningCandidate,
  widthPx: number,
  heightPx: number,
): void {
  const centerX = pointX(opening.center.x, widthPx);
  const centerY = pointY(opening.center.y, heightPx);
  const radius = Math.max(4, Math.min(12, (opening.widthPx ?? 16) / 8));
  const orientationRadians = ((opening.orientationDeg ?? 0) * Math.PI) / 180;
  const axisX = Math.cos(orientationRadians) * radius * 1.8;
  const axisY = Math.sin(orientationRadians) * radius * 1.8;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(centerX - axisX, centerY - axisY);
  context.lineTo(centerX + axisX, centerY + axisY);
  context.stroke();
  context.fillText(`${openingPrefix(opening)} ${safeLabelId(opening.id)}`, centerX, centerY - radius - 8);
}

function validateOverlayDataUrl(value: string): string {
  if (
    typeof value !== "string"
    || value.length > MAX_OVERLAY_DATA_URL_CHARACTERS
    || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)
  ) {
    throw new Error("Overlay изображения сформирован некорректно.");
  }
  return value;
}

export function renderRecognitionAiOverlay(input: RenderRecognitionAiOverlayInput): string {
  if (!input.sourceImage) throw new Error("Исходное изображение недоступно.");
  const widthPx = positiveDimension(input.widthPx, "Ширина overlay");
  const heightPx = positiveDimension(input.heightPx, "Высота overlay");
  if (widthPx * heightPx > AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS) {
    throw new Error("Overlay превышает безопасный pixel budget.");
  }
  const localDraft = validateRecognitionDraft(input.localDraft);
  const canvas = (input.canvasFactory ?? defaultCanvasFactory)();
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Не удалось создать 2D-контекст overlay.");

  context.clearRect(0, 0, widthPx, heightPx);
  context.save();
  context.globalAlpha = 0.96;
  context.lineWidth = Math.max(2, Math.min(5, Math.sqrt(widthPx * heightPx) / 350));
  context.strokeStyle = "#0f6fff";
  context.fillStyle = "#111827";
  context.font = `${Math.max(12, Math.min(22, Math.round(Math.min(widthPx, heightPx) / 55)))}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const wall of [...localDraft.walls].sort(compareIds)) {
    drawWall(context, wall, widthPx, heightPx);
  }
  for (const opening of [...localDraft.openings].sort(compareIds)) {
    drawOpening(context, opening, widthPx, heightPx);
  }
  context.restore();
  return validateOverlayDataUrl(canvas.toDataURL("image/png"));
}
