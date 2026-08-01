import { createHash } from "node:crypto";

export const DEFAULT_TOLERANCES = Object.freeze({
  wallEndpointMm: 120,
  wallOrientationDeg: 5,
  wallMinimumOverlapRatio: 0.7,
  wallLengthRelativeError: 0.2,
  junctionMm: 120,
  openingCenterMm: 150,
  openingWidthMm: 150,
  roomMinimumIoU: 0.75,
  labelAnchorMm: 500,
});

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sourcePoint(definition, pointMm) {
  return {
    x: definition.calibration.originPx.x + pointMm.x / definition.calibration.millimetersPerPixel,
    y: definition.calibration.originPx.y + pointMm.y / definition.calibration.millimetersPerPixel,
  };
}

function parseMatrix(transform) {
  if (!transform) return [1, 0, 0, 1, 0, 0];
  const match = /^matrix\(([-+0-9.eE]+) ([-+0-9.eE]+) ([-+0-9.eE]+) ([-+0-9.eE]+) ([-+0-9.eE]+) ([-+0-9.eE]+)\)$/.exec(transform);
  if (!match) throw new Error(`Unsupported SVG transform: ${transform}`);
  return match.slice(1).map(Number);
}

function transformPoint(point, matrix) {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

function renderWall(definition, wall) {
  const start = sourcePoint(definition, wall.startMm);
  const end = sourcePoint(definition, wall.endMm);
  const thicknessPx = Math.max(2, wall.thicknessMm / definition.calibration.millimetersPerPixel);
  return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#151515" stroke-width="${thicknessPx}" stroke-linecap="square" />`;
}

function wallById(definition, wallId) {
  const wall = definition.walls.find((candidate) => candidate.id === wallId);
  if (!wall) throw new Error(`${definition.id}: opening host wall ${wallId} not found`);
  return wall;
}

function openingDirection(wall) {
  const dx = wall.endMm.x - wall.startMm.x;
  const dy = wall.endMm.y - wall.startMm.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) throw new Error(`Wall ${wall.id} has zero length`);
  return { x: dx / length, y: dy / length };
}

function renderOpening(definition, opening) {
  const wall = wallById(definition, opening.hostWallId);
  const center = sourcePoint(definition, opening.centerMm);
  const tangent = openingDirection(wall);
  const normal = { x: -tangent.y, y: tangent.x };
  const widthPx = opening.widthMm / definition.calibration.millimetersPerPixel;
  const half = widthPx / 2;
  const thicknessPx = Math.max(2, (wall.thicknessMm ?? 150) / definition.calibration.millimetersPerPixel);
  const start = { x: center.x - tangent.x * half, y: center.y - tangent.y * half };
  const end = { x: center.x + tangent.x * half, y: center.y + tangent.y * half };
  const erase = `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="white" stroke-width="${thicknessPx + 5}" stroke-linecap="butt" />`;
  if (opening.kind === "window") {
    const offset = Math.max(2, thicknessPx * 0.22);
    const firstStart = { x: start.x + normal.x * offset, y: start.y + normal.y * offset };
    const firstEnd = { x: end.x + normal.x * offset, y: end.y + normal.y * offset };
    const secondStart = { x: start.x - normal.x * offset, y: start.y - normal.y * offset };
    const secondEnd = { x: end.x - normal.x * offset, y: end.y - normal.y * offset };
    return `${erase}<g stroke="#151515" stroke-width="2" fill="none"><line x1="${firstStart.x}" y1="${firstStart.y}" x2="${firstEnd.x}" y2="${firstEnd.y}" /><line x1="${secondStart.x}" y1="${secondStart.y}" x2="${secondEnd.x}" y2="${secondEnd.y}" /><line x1="${start.x}" y1="${start.y}" x2="${firstStart.x}" y2="${firstStart.y}" /><line x1="${end.x}" y1="${end.y}" x2="${firstEnd.x}" y2="${firstEnd.y}" /></g>`;
  }
  const leafEnd = { x: start.x + normal.x * widthPx, y: start.y + normal.y * widthPx };
  const sweep = normal.y * tangent.x - normal.x * tangent.y >= 0 ? 1 : 0;
  return `${erase}<g stroke="#151515" stroke-width="2" fill="none"><line x1="${start.x}" y1="${start.y}" x2="${leafEnd.x}" y2="${leafEnd.y}" /><path d="M ${end.x} ${end.y} A ${widthPx} ${widthPx} 0 0 ${sweep} ${leafEnd.x} ${leafEnd.y}" /></g>`;
}

function rectangle(definition, decoration, extra = "") {
  const point = sourcePoint(definition, { x: decoration.x, y: decoration.y });
  const width = decoration.width / definition.calibration.millimetersPerPixel;
  const height = decoration.height / definition.calibration.millimetersPerPixel;
  return `<rect x="${point.x}" y="${point.y}" width="${width}" height="${height}" fill="none" stroke="#666" stroke-width="2" ${extra}/>`;
}

function renderDecoration(definition, decoration) {
  switch (decoration.kind) {
    case "bed": {
      const frame = rectangle(definition, decoration);
      const point = sourcePoint(definition, { x: decoration.x, y: decoration.y });
      const width = decoration.width / definition.calibration.millimetersPerPixel;
      const height = decoration.height / definition.calibration.millimetersPerPixel;
      return `${frame}<rect x="${point.x + width * 0.08}" y="${point.y + height * 0.06}" width="${width * 0.38}" height="${height * 0.22}" fill="none" stroke="#777" stroke-width="2"/><line x1="${point.x + width * 0.5}" y1="${point.y}" x2="${point.x + width * 0.5}" y2="${point.y + height}" stroke="#999" />`;
    }
    case "sofa": {
      const frame = rectangle(definition, decoration, 'rx="8"');
      const point = sourcePoint(definition, { x: decoration.x, y: decoration.y });
      const width = decoration.width / definition.calibration.millimetersPerPixel;
      const height = decoration.height / definition.calibration.millimetersPerPixel;
      return `${frame}<line x1="${point.x + width * 0.15}" y1="${point.y}" x2="${point.x + width * 0.15}" y2="${point.y + height}" stroke="#888"/><line x1="${point.x + width * 0.85}" y1="${point.y}" x2="${point.x + width * 0.85}" y2="${point.y + height}" stroke="#888"/>`;
    }
    case "table": {
      const point = sourcePoint(definition, { x: decoration.x, y: decoration.y });
      const width = decoration.width / definition.calibration.millimetersPerPixel;
      const height = decoration.height / definition.calibration.millimetersPerPixel;
      return `<ellipse cx="${point.x + width / 2}" cy="${point.y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="none" stroke="#666" stroke-width="2"/>`;
    }
    case "sanitary": {
      const frame = rectangle(definition, decoration, 'rx="15"');
      const point = sourcePoint(definition, { x: decoration.x, y: decoration.y });
      const width = decoration.width / definition.calibration.millimetersPerPixel;
      const height = decoration.height / definition.calibration.millimetersPerPixel;
      return `${frame}<ellipse cx="${point.x + width / 2}" cy="${point.y + height * 0.35}" rx="${width * 0.28}" ry="${height * 0.18}" fill="none" stroke="#777"/>`;
    }
    case "hatch": {
      const point = sourcePoint(definition, { x: decoration.x, y: decoration.y });
      const width = decoration.width / definition.calibration.millimetersPerPixel;
      const height = decoration.height / definition.calibration.millimetersPerPixel;
      const lines = [];
      for (let offset = -height; offset < width; offset += 12) {
        lines.push(`<line x1="${point.x + Math.max(0, offset)}" y1="${point.y + Math.max(0, -offset)}" x2="${point.x + Math.min(width, offset + height)}" y2="${point.y + Math.min(height, height + offset)}" stroke="#aaa" stroke-width="1"/>`);
      }
      return `<g>${rectangle(definition, decoration)}${lines.join("")}</g>`;
    }
    case "dimension": {
      const start = sourcePoint(definition, { x: decoration.x1, y: decoration.y1 });
      const end = sourcePoint(definition, { x: decoration.x2, y: decoration.y2 });
      return `<g stroke="#777" fill="#555" stroke-width="1"><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"/><line x1="${start.x}" y1="${start.y - 6}" x2="${start.x}" y2="${start.y + 6}"/><line x1="${end.x}" y1="${end.y - 6}" x2="${end.x}" y2="${end.y + 6}"/><text x="${(start.x + end.x) / 2}" y="${(start.y + end.y) / 2 - 4}" font-size="13" text-anchor="middle" stroke="none">${escapeXml(decoration.text)}</text></g>`;
    }
    case "frame":
      return `<rect x="5" y="5" width="${definition.sourceWidthPx - 10}" height="${definition.sourceHeightPx - 10}" fill="none" stroke="#888" stroke-width="3"/>`;
    default:
      throw new Error(`${definition.id}: unsupported decoration ${decoration.kind}`);
  }
}

function renderLabel(definition, label) {
  const point = sourcePoint(definition, label.anchorMm);
  return `<text x="${point.x}" y="${point.y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#252525">${escapeXml(label.text)}</text>`;
}

export function renderFixtureSvg(definition) {
  const walls = definition.walls.map((wall) => renderWall(definition, wall)).join("");
  const openings = definition.openings.map((opening) => renderOpening(definition, opening)).join("");
  const decorations = definition.decorations.map((entry) => renderDecoration(definition, entry)).join("");
  const labels = definition.expectedLabels.map((entry) => renderLabel(definition, entry)).join("");
  const transform = definition.svgTransform ? ` transform="${definition.svgTransform}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${definition.sourceWidthPx}" height="${definition.sourceHeightPx}" viewBox="0 0 ${definition.sourceWidthPx} ${definition.sourceHeightPx}"><rect width="100%" height="100%" fill="white"/><g${transform}>${walls}${openings}${decorations}${labels}</g></svg>`;
}

function edgeSegmentsForWall(definition, wall) {
  const start = sourcePoint(definition, wall.startMm);
  const end = sourcePoint(definition, wall.endMm);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const normal = { x: -dy / length, y: dx / length };
  const halfThickness = (wall.thicknessMm / definition.calibration.millimetersPerPixel) / 2;
  return [-halfThickness, halfThickness].map((offset) => ({
    x1: start.x + normal.x * offset,
    y1: start.y + normal.y * offset,
    x2: end.x + normal.x * offset,
    y2: end.y + normal.y * offset,
  }));
}

function decorationSegments(definition, decoration) {
  if (decoration.kind === "dimension") {
    const start = sourcePoint(definition, { x: decoration.x1, y: decoration.y1 });
    const end = sourcePoint(definition, { x: decoration.x2, y: decoration.y2 });
    return [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
  }
  if (!("x" in decoration) || !("width" in decoration)) return [];
  const topLeft = sourcePoint(definition, { x: decoration.x, y: decoration.y });
  const width = decoration.width / definition.calibration.millimetersPerPixel;
  const height = decoration.height / definition.calibration.millimetersPerPixel;
  return [
    { x1: topLeft.x, y1: topLeft.y, x2: topLeft.x + width, y2: topLeft.y },
    { x1: topLeft.x + width, y1: topLeft.y, x2: topLeft.x + width, y2: topLeft.y + height },
    { x1: topLeft.x + width, y1: topLeft.y + height, x2: topLeft.x, y2: topLeft.y + height },
    { x1: topLeft.x, y1: topLeft.y + height, x2: topLeft.x, y2: topLeft.y },
  ];
}

export function buildSegmentsSnapshot(definition) {
  const matrix = parseMatrix(definition.svgTransform);
  const transformSegment = (segment) => {
    const start = transformPoint({ x: segment.x1, y: segment.y1 }, matrix);
    const end = transformPoint({ x: segment.x2, y: segment.y2 }, matrix);
    return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  };
  const segments = [
    ...definition.walls.flatMap((wall) => edgeSegmentsForWall(definition, wall)),
    ...definition.decorations.flatMap((entry) => decorationSegments(definition, entry)),
  ].map(transformSegment).sort((first, second) =>
    first.y1 - second.y1 || first.x1 - second.x1 || first.y2 - second.y2 || first.x2 - second.x2,
  );
  return {
    schemaVersion: "recognition-segments-v1",
    widthPx: definition.sourceWidthPx,
    heightPx: definition.sourceHeightPx,
    segments,
  };
}

function normalized(definition, pointMm) {
  const point = sourcePoint(definition, pointMm);
  const transformed = transformPoint(point, parseMatrix(definition.svgTransform));
  return {
    x: Math.max(0, Math.min(1, transformed.x / definition.sourceWidthPx)),
    y: Math.max(0, Math.min(1, transformed.y / definition.sourceHeightPx)),
  };
}

export function buildCloudSnapshot(definition) {
  return {
    walls: definition.walls.map((wall, index) => ({
      id: `cloud-wall-${index + 1}`,
      start: normalized(definition, wall.startMm),
      end: normalized(definition, wall.endMm),
      estimatedThicknessPx: wall.thicknessMm / definition.calibration.millimetersPerPixel,
      confidence: index % 5 === 0 ? "medium" : "high",
      score: index % 5 === 0 ? 0.72 : 0.9,
    })),
    openings: definition.openings.map((opening, index) => ({
      id: `cloud-opening-${index + 1}`,
      kind: opening.kind,
      hostWallCandidateId: `cloud-wall-${definition.walls.findIndex((wall) => wall.id === opening.hostWallId) + 1}`,
      center: normalized(definition, opening.centerMm),
      widthPx: opening.widthMm / definition.calibration.millimetersPerPixel,
      orientationDeg: opening.orientationDeg,
      confidence: "medium",
      score: 0.76,
    })),
    roomLabels: definition.expectedLabels.map((label, index) => ({
      id: `cloud-label-${index + 1}`,
      text: label.text,
      anchor: normalized(definition, label.anchorMm),
      confidence: "medium",
    })),
    diagnostics: [],
  };
}

export function buildFixtureJson(definition, sourceHash) {
  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: definition.id,
    description: definition.description,
    provenance: definition.provenance,
    tags: definition.tags,
    source: {
      fileName: "source.png",
      sha256: sourceHash,
      cloudResponseFileName: definition.includeCloudSnapshot ? "cloud-response.json" : null,
    },
    calibration: definition.calibration,
    tolerances: DEFAULT_TOLERANCES,
    expectedJunctions: definition.expectedJunctions,
    expectedWalls: definition.walls,
    expectedOpenings: definition.openings,
    expectedRooms: definition.rooms,
    expectedLabels: definition.expectedLabels,
    statedTotalAreaM2: definition.statedTotalAreaM2,
    metricApplicability: definition.metricApplicability,
  };
}
