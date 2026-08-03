import { createHash } from "node:crypto";

const ORIGIN_PX = Object.freeze({ x: 30, y: 30 });
const ALLOWED_TAGS = new Set([
  "clean", "calibrated", "multi-room", "openings-heavy", "labels-and-areas",
  "furniture-heavy", "low-resolution", "perspective", "regression", "cloud-snapshot",
]);

export const REAL_FIXTURE_TOLERANCES = Object.freeze({
  wallEndpointMm: 140,
  wallOrientationDeg: 6,
  wallMinimumOverlapRatio: 0.68,
  wallLengthRelativeError: 0.22,
  junctionMm: 140,
  openingCenterMm: 170,
  openingWidthMm: 180,
  roomMinimumIoU: 0.72,
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
    x: ORIGIN_PX.x + pointMm.x / definition.millimetersPerPixel,
    y: ORIGIN_PX.y + pointMm.y / definition.millimetersPerPixel,
  };
}

function wallById(definition, wallId) {
  const wall = definition.walls.find((candidate) => candidate.id === wallId);
  if (!wall) throw new Error(`${definition.id}: opening host wall ${wallId} not found`);
  return wall;
}

function wallDirection(wall) {
  const dx = wall.endMm.x - wall.startMm.x;
  const dy = wall.endMm.y - wall.startMm.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) throw new Error(`${wall.id}: zero-length wall`);
  return { tangent: { x: dx / length, y: dy / length }, length };
}

function renderWall(definition, wall) {
  const start = sourcePoint(definition, wall.startMm);
  const end = sourcePoint(definition, wall.endMm);
  const thicknessPx = Math.max(2, wall.thicknessMm / definition.millimetersPerPixel);
  return `<line data-wall-id="${escapeXml(wall.id)}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#111111" stroke-width="${thicknessPx}" stroke-linecap="square" />`;
}

function renderOpening(definition, opening) {
  const wall = wallById(definition, opening.hostWallId);
  const center = sourcePoint(definition, opening.centerMm);
  const { tangent } = wallDirection(wall);
  const normal = { x: -tangent.y, y: tangent.x };
  const widthPx = opening.widthMm / definition.millimetersPerPixel;
  const half = widthPx / 2;
  const wallThicknessPx = Math.max(2, wall.thicknessMm / definition.millimetersPerPixel);
  const start = { x: center.x - tangent.x * half, y: center.y - tangent.y * half };
  const end = { x: center.x + tangent.x * half, y: center.y + tangent.y * half };
  const erase = `<line data-opening-id="${escapeXml(opening.id)}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#f3f5f8" stroke-width="${wallThicknessPx + 6}" stroke-linecap="butt" />`;

  if (opening.kind === "window") {
    const offset = Math.max(2, wallThicknessPx * 0.24);
    const rails = [-offset, 0, offset].map((distance) => {
      const x1 = start.x + normal.x * distance;
      const y1 = start.y + normal.y * distance;
      const x2 = end.x + normal.x * distance;
      const y2 = end.y + normal.y * distance;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#555555" stroke-width="1.5" />`;
    }).join("");
    return `<g data-opening-id="${escapeXml(opening.id)}">${erase}${rails}</g>`;
  }

  const hinge = start;
  const leafEnd = {
    x: hinge.x + normal.x * widthPx,
    y: hinge.y + normal.y * widthPx,
  };
  const sweep = opening.swing === "left" ? 0 : 1;
  const leaf = `<line x1="${hinge.x}" y1="${hinge.y}" x2="${leafEnd.x}" y2="${leafEnd.y}" stroke="#555555" stroke-width="1.5" />`;
  const arc = `<path d="M ${end.x} ${end.y} A ${widthPx} ${widthPx} 0 0 ${sweep} ${leafEnd.x} ${leafEnd.y}" fill="none" stroke="#777777" stroke-width="1.25" />`;
  return `<g data-opening-id="${escapeXml(opening.id)}">${erase}${leaf}${arc}</g>`;
}

function renderFixtureSymbol(definition, decoration) {
  const topLeft = sourcePoint(definition, { x: decoration.boundsMm.x, y: decoration.boundsMm.y });
  const width = decoration.boundsMm.width / definition.millimetersPerPixel;
  const height = decoration.boundsMm.height / definition.millimetersPerPixel;
  const centerX = topLeft.x + width / 2;
  const centerY = topLeft.y + height / 2;
  const transform = decoration.orientationDeg
    ? ` transform="rotate(${decoration.orientationDeg} ${centerX} ${centerY})"`
    : "";
  const outline = `<rect x="${topLeft.x}" y="${topLeft.y}" width="${width}" height="${height}" rx="${Math.min(width, height) * 0.12}" fill="none" stroke="#777777" stroke-width="1.4" />`;
  const inner = decoration.symbol === "cooktop" || decoration.symbol === "washer"
    ? `<circle cx="${centerX}" cy="${centerY}" r="${Math.min(width, height) * 0.28}" fill="none" stroke="#777777" stroke-width="1.4" />`
    : decoration.symbol === "toilet"
      ? `<ellipse cx="${centerX}" cy="${centerY}" rx="${width * 0.28}" ry="${height * 0.38}" fill="none" stroke="#777777" stroke-width="1.4" />`
      : `<rect x="${topLeft.x + width * 0.18}" y="${topLeft.y + height * 0.18}" width="${width * 0.64}" height="${height * 0.64}" rx="${Math.min(width, height) * 0.14}" fill="none" stroke="#888888" stroke-width="1" />`;
  return `<g data-decoration-id="${escapeXml(decoration.id)}"${transform}>${outline}${inner}</g>`;
}

function renderDecoration(definition, decoration) {
  if (decoration.kind === "fixture-symbol") return renderFixtureSymbol(definition, decoration);
  if (decoration.kind === "label") {
    const anchor = sourcePoint(definition, decoration.anchorMm);
    return `<text data-decoration-id="${escapeXml(decoration.id)}" x="${anchor.x}" y="${anchor.y}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="${decoration.size}" fill="#333333">${escapeXml(decoration.text)}</text>`;
  }
  if (decoration.kind === "dashed-guide") {
    const start = sourcePoint(definition, decoration.startMm);
    const end = sourcePoint(definition, decoration.endMm);
    return `<line data-decoration-id="${escapeXml(decoration.id)}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#c8c8c8" stroke-width="2" stroke-dasharray="8 8" />`;
  }
  throw new Error(`${definition.id}: unsupported decoration ${decoration.kind}`);
}

export function renderRealFixtureSvg(definition) {
  const walls = definition.walls.map((wall) => renderWall(definition, wall)).join("");
  const openings = definition.openings.map((opening) => renderOpening(definition, opening)).join("");
  const decorations = definition.decorations.map((entry) => renderDecoration(definition, entry)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${definition.sourceWidthPx}" height="${definition.sourceHeightPx}" viewBox="0 0 ${definition.sourceWidthPx} ${definition.sourceHeightPx}"><rect width="100%" height="100%" fill="#f3f5f8"/><g>${walls}${openings}${decorations}</g></svg>`;
}

function endpointJunctionId(pointMm) {
  return `j-${Number(pointMm.x.toFixed(3))}-${Number(pointMm.y.toFixed(3))}`;
}

function expectedWalls(definition) {
  return definition.walls.map((wall) => ({
    id: wall.id,
    startMm: wall.startMm,
    endMm: wall.endMm,
    thicknessMm: wall.thicknessMm,
    kind: wall.kind === "external" ? "external" : "partition",
    startJunctionId: endpointJunctionId(wall.startMm),
    endJunctionId: endpointJunctionId(wall.endMm),
  }));
}

function expectedJunctions(walls) {
  const junctions = new Map();
  for (const wall of walls) {
    junctions.set(wall.startJunctionId, { id: wall.startJunctionId, positionMm: wall.startMm });
    junctions.set(wall.endJunctionId, { id: wall.endJunctionId, positionMm: wall.endMm });
  }
  return [...junctions.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function benchmarkTags(definition) {
  const tags = new Set(["calibrated", "regression"]);
  if (definition.tags.includes("openings-heavy") || definition.openings.length >= 4) tags.add("openings-heavy");
  if (definition.tags.includes("two-room") || definition.tags.includes("one-room")) tags.add("multi-room");
  if (definition.tags.some((tag) => tag.includes("sanitary") || tag.includes("service") || tag.includes("clutter"))) tags.add("furniture-heavy");
  if (definition.tags.some((tag) => tag.includes("label"))) tags.add("labels-and-areas");
  return [...tags].filter((tag) => ALLOWED_TAGS.has(tag)).sort();
}

export function buildRealFixtureJson(definition, sourceHash) {
  const walls = expectedWalls(definition);
  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: definition.id,
    description: definition.description,
    provenance: definition.provenance,
    tags: benchmarkTags(definition),
    source: {
      fileName: "source.png",
      sha256: sourceHash,
      cloudResponseFileName: null,
    },
    calibration: {
      sourceWidthPx: definition.sourceWidthPx,
      sourceHeightPx: definition.sourceHeightPx,
      millimetersPerPixel: definition.millimetersPerPixel,
      originPx: ORIGIN_PX,
    },
    tolerances: REAL_FIXTURE_TOLERANCES,
    expectedJunctions: expectedJunctions(walls),
    expectedWalls: walls,
    expectedOpenings: definition.openings.map((opening) => ({
      id: opening.id,
      kind: opening.kind,
      hostWallId: opening.hostWallId,
      centerMm: opening.centerMm,
      widthMm: opening.widthMm,
      orientationDeg: opening.orientationDeg,
      swing: null,
    })),
    expectedRooms: [],
    expectedLabels: [],
    statedTotalAreaM2: null,
    metricApplicability: {
      wallGeometry: true,
      wallTopology: true,
      openings: true,
      rooms: false,
      roomLabels: false,
      roomAreas: false,
      totalArea: false,
      confidence: true,
    },
  };
}

function wallEdgeSegments(definition, wall) {
  const start = sourcePoint(definition, wall.startMm);
  const end = sourcePoint(definition, wall.endMm);
  const { tangent } = wallDirection(wall);
  const normal = { x: -tangent.y, y: tangent.x };
  const half = wall.thicknessMm / definition.millimetersPerPixel / 2;
  return [-half, half].map((offset) => ({
    x1: start.x + normal.x * offset,
    y1: start.y + normal.y * offset,
    x2: end.x + normal.x * offset,
    y2: end.y + normal.y * offset,
  }));
}

function openingSegments(definition, opening) {
  const wall = wallById(definition, opening.hostWallId);
  const center = sourcePoint(definition, opening.centerMm);
  const { tangent } = wallDirection(wall);
  const normal = { x: -tangent.y, y: tangent.x };
  const half = opening.widthMm / definition.millimetersPerPixel / 2;
  const start = { x: center.x - tangent.x * half, y: center.y - tangent.y * half };
  const end = { x: center.x + tangent.x * half, y: center.y + tangent.y * half };
  if (opening.kind === "window") {
    const wallHalf = wall.thicknessMm / definition.millimetersPerPixel / 2;
    return [-wallHalf * 0.45, 0, wallHalf * 0.45].map((offset) => ({
      x1: start.x + normal.x * offset,
      y1: start.y + normal.y * offset,
      x2: end.x + normal.x * offset,
      y2: end.y + normal.y * offset,
    }));
  }
  const width = opening.widthMm / definition.millimetersPerPixel;
  return [{
    x1: start.x,
    y1: start.y,
    x2: start.x + normal.x * width,
    y2: start.y + normal.y * width,
  }];
}

function decorationSegments(definition, decoration) {
  if (decoration.kind === "dashed-guide") {
    const start = sourcePoint(definition, decoration.startMm);
    const end = sourcePoint(definition, decoration.endMm);
    return [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
  }
  if (decoration.kind !== "fixture-symbol") return [];
  const topLeft = sourcePoint(definition, { x: decoration.boundsMm.x, y: decoration.boundsMm.y });
  const width = decoration.boundsMm.width / definition.millimetersPerPixel;
  const height = decoration.boundsMm.height / definition.millimetersPerPixel;
  return [
    { x1: topLeft.x, y1: topLeft.y, x2: topLeft.x + width, y2: topLeft.y },
    { x1: topLeft.x + width, y1: topLeft.y, x2: topLeft.x + width, y2: topLeft.y + height },
    { x1: topLeft.x + width, y1: topLeft.y + height, x2: topLeft.x, y2: topLeft.y + height },
    { x1: topLeft.x, y1: topLeft.y + height, x2: topLeft.x, y2: topLeft.y },
  ];
}

export function buildRealSegmentsSnapshot(definition) {
  const segments = [
    ...definition.walls.flatMap((wall) => wallEdgeSegments(definition, wall)),
    ...definition.openings.flatMap((opening) => openingSegments(definition, opening)),
    ...definition.decorations.flatMap((decoration) => decorationSegments(definition, decoration)),
  ].map((segment) => Object.fromEntries(Object.entries(segment).map(([key, value]) => [key, Number(value.toFixed(6))])))
    .sort((left, right) => left.y1 - right.y1 || left.x1 - right.x1 || left.y2 - right.y2 || left.x2 - right.x2);
  return {
    schemaVersion: "recognition-segments-v1",
    widthPx: definition.sourceWidthPx,
    heightPx: definition.sourceHeightPx,
    segments,
  };
}
