import type { RecognitionDraft } from "../../src/model";
import type { BenchmarkPointMm, RecognitionBenchmarkFixtureV1 } from "../schema/fixture-v1";
import { matchOpenings } from "./match-openings";
import { matchWalls } from "./match-walls";

export type RecognitionSourceOverlayInput = Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  draft: RecognitionDraft;
  sourceBase64: string;
}>;

type PixelPoint = Readonly<{ x: number; y: number }>;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function number(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function referenceMmToPixel(point: BenchmarkPointMm, fixture: RecognitionBenchmarkFixtureV1): PixelPoint {
  return {
    x: fixture.calibration.originPx.x + point.x / fixture.calibration.millimetersPerPixel,
    y: fixture.calibration.originPx.y + point.y / fixture.calibration.millimetersPerPixel,
  };
}

function normalizedToPixel(point: Readonly<{ x: number; y: number }>, fixture: RecognitionBenchmarkFixtureV1): PixelPoint {
  return {
    x: point.x * fixture.calibration.sourceWidthPx,
    y: point.y * fixture.calibration.sourceHeightPx,
  };
}

function midpoint(first: PixelPoint, second: PixelPoint): PixelPoint {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function line(input: Readonly<{
  first: PixelPoint;
  second: PixelPoint;
  layer: string;
  status: "true-positive" | "false-positive" | "false-negative";
  stroke: string;
  width: number;
  dash?: string;
}>): string {
  const dash = input.dash ? ` stroke-dasharray="${input.dash}"` : "";
  return `<line data-layer="${input.layer}" data-status="${input.status}" x1="${number(input.first.x)}" y1="${number(input.first.y)}" x2="${number(input.second.x)}" y2="${number(input.second.y)}" stroke="${input.stroke}" stroke-width="${input.width}" stroke-linecap="round"${dash}/>`;
}

function label(point: PixelPoint, text: "FN" | "FP", status: "false-negative" | "false-positive"): string {
  return `<g data-status="${status}"><rect x="${number(point.x - 13)}" y="${number(point.y - 13)}" width="26" height="20" rx="4" fill="#ffffff" stroke="#111111" stroke-width="1.5"/><text x="${number(point.x)}" y="${number(point.y + 2)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#111111">${text}</text></g>`;
}

function expectedOpeningMarker(
  point: PixelPoint,
  status: "true-positive" | "false-negative",
  kind: "door" | "window",
): string {
  const suffix = status === "false-negative" ? label({ x: point.x, y: point.y - 16 }, "FN", status) : "";
  return `<g data-layer="expected-openings" data-status="${status}"><rect x="${number(point.x - 7)}" y="${number(point.y - 7)}" width="14" height="14" fill="#ffffff" stroke="#111111" stroke-width="3"/><title>Expected ${kind}</title>${suffix}</g>`;
}

function predictedOpeningMarker(
  point: PixelPoint,
  status: "true-positive" | "false-positive",
  kind: string,
): string {
  const suffix = status === "false-positive" ? label({ x: point.x, y: point.y + 23 }, "FP", status) : "";
  return `<g data-layer="predicted-openings" data-status="${status}"><circle cx="${number(point.x)}" cy="${number(point.y)}" r="6" fill="#ffffff" stroke="#005fcc" stroke-width="3" stroke-dasharray="2 3"/><title>Predicted ${escapeXml(kind)}</title>${suffix}</g>`;
}

export function renderRecognitionSourceOverlaySvg(input: RecognitionSourceOverlayInput): string {
  const { fixture, draft } = input;
  const width = fixture.calibration.sourceWidthPx;
  const sourceHeight = fixture.calibration.sourceHeightPx;
  const legendHeight = 154;
  const height = sourceHeight + legendHeight;
  const wallMatches = matchWalls({ fixture, predictions: draft.walls });
  const openingMatches = matchOpenings({
    fixture,
    predictions: draft.openings,
    wallPredictions: draft.walls,
    wallMatches,
  });

  const matchedExpectedWalls = new Set(wallMatches.matches.map((match) => match.expectedWallId));
  const matchedPredictedWalls = new Set(wallMatches.matches.map((match) => match.predictedIndex));
  const matchedExpectedOpenings = new Set(openingMatches.matches.map((match) => match.expectedOpeningId));
  const matchedPredictedOpenings = new Set(openingMatches.matches.map((match) => match.predictedIndex));

  const rooms = fixture.expectedRooms.map((room) => {
    const points = room.polygonMm
      .map((point) => referenceMmToPixel(point, fixture))
      .map((point) => `${number(point.x)},${number(point.y)}`)
      .join(" ");
    return `<polygon data-layer="expected-rooms" points="${points}" fill="none" stroke="#555555" stroke-width="2" stroke-dasharray="2 7"><title>Expected room ${escapeXml(room.id)}</title></polygon>`;
  });

  const expectedWalls = fixture.expectedWalls.flatMap((wall) => {
    const first = referenceMmToPixel(wall.startMm, fixture);
    const second = referenceMmToPixel(wall.endMm, fixture);
    const matched = matchedExpectedWalls.has(wall.id);
    const status = matched ? "true-positive" as const : "false-negative" as const;
    return [
      line({
        first,
        second,
        layer: "expected-walls",
        status,
        stroke: "#111111",
        width: 5,
        dash: matched ? undefined : "12 8",
      }),
      ...(matched ? [] : [label(midpoint(first, second), "FN", "false-negative")]),
    ];
  });

  const predictedWalls = draft.walls.flatMap((wall, index) => {
    const first = normalizedToPixel(wall.start, fixture);
    const second = normalizedToPixel(wall.end, fixture);
    const matched = matchedPredictedWalls.has(index);
    const status = matched ? "true-positive" as const : "false-positive" as const;
    return [
      line({
        first,
        second,
        layer: "predicted-walls",
        status,
        stroke: "#005fcc",
        width: 3,
        dash: matched ? "2 6" : "16 4 2 4",
      }),
      ...(matched ? [] : [label(midpoint(first, second), "FP", "false-positive")]),
    ];
  });

  const expectedOpenings = fixture.expectedOpenings.map((opening) => expectedOpeningMarker(
    referenceMmToPixel(opening.centerMm, fixture),
    matchedExpectedOpenings.has(opening.id) ? "true-positive" : "false-negative",
    opening.kind,
  ));
  const predictedOpenings = draft.openings.map((opening, index) => predictedOpeningMarker(
    normalizedToPixel(opening.center, fixture),
    matchedPredictedOpenings.has(index) ? "true-positive" : "false-positive",
    opening.kind,
  ));

  const summaryY = sourceHeight + 30;
  const counts = `Walls TP ${wallMatches.metrics.truePositive} / FP ${wallMatches.metrics.falsePositive} / FN ${wallMatches.metrics.falseNegative}; openings TP ${openingMatches.combined.truePositive} / FP ${openingMatches.combined.falsePositive} / FN ${openingMatches.combined.falseNegative}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="overlay-title overlay-description">`,
    `<title id="overlay-title">Recognition overlay for ${escapeXml(fixture.id)}</title>`,
    `<desc id="overlay-description">Expected and predicted geometry with TP, FP and FN annotations that remain distinguishable without colour.</desc>`,
    `<rect width="${width}" height="${height}" fill="#f4f4f4"/>`,
    `<image href="data:image/png;base64,${input.sourceBase64}" x="0" y="0" width="${width}" height="${sourceHeight}" preserveAspectRatio="none"/>`,
    `<rect x="0" y="0" width="${width}" height="${sourceHeight}" fill="none" stroke="#111111" stroke-width="1"/>`,
    ...rooms,
    ...expectedWalls,
    ...predictedWalls,
    ...expectedOpenings,
    ...predictedOpenings,
    `<g data-layer="legend" font-family="system-ui, sans-serif" fill="#111111">`,
    `<text x="20" y="${summaryY}" font-size="18" font-weight="700">${escapeXml(fixture.id)}</text>`,
    `<text x="20" y="${summaryY + 26}" font-size="13">Expected: solid/square · Predicted: dotted/circle</text>`,
    `<text x="20" y="${summaryY + 48}" font-size="13">FN: dashed expected geometry · FP: dash-dot predicted geometry</text>`,
    `<text x="20" y="${summaryY + 72}" font-size="13">${escapeXml(counts)}</text>`,
    `<text x="20" y="${summaryY + 96}" font-size="12">Engine ${escapeXml(draft.engineVersion)} · corpus recognition-corpus-v1 · no live provider call</text>`,
    `</g>`,
    `</svg>`,
    "",
  ].join("\n");
}
