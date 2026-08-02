import { buildSegmentsSnapshot as buildLegacySegmentsSnapshot } from "./fixture-renderer.mjs";

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

function transformSegment(segment, matrix) {
  const start = transformPoint({ x: segment.x1, y: segment.y1 }, matrix);
  const end = transformPoint({ x: segment.x2, y: segment.y2 }, matrix);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

function openingDirection(wall) {
  const dx = wall.endMm.x - wall.startMm.x;
  const dy = wall.endMm.y - wall.startMm.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) throw new Error(`Wall ${wall.id} has zero length`);
  return { x: dx / length, y: dy / length };
}

function openingsForWall(definition, wall) {
  const start = sourcePoint(definition, wall.startMm);
  const end = sourcePoint(definition, wall.endMm);
  const tangent = openingDirection(wall);
  return definition.openings
    .filter((opening) => opening.hostWallId === wall.id)
    .map((opening) => {
      const center = sourcePoint(definition, opening.centerMm);
      const centerAlong = (center.x - start.x) * tangent.x + (center.y - start.y) * tangent.y;
      const widthPx = opening.widthMm / definition.calibration.millimetersPerPixel;
      return {
        opening,
        startAlong: centerAlong - widthPx / 2,
        endAlong: centerAlong + widthPx / 2,
      };
    })
    .sort((first, second) => first.startAlong - second.startAlong || first.endAlong - second.endAlong);
}

function wallEdgeSegments(definition, wall) {
  const start = sourcePoint(definition, wall.startMm);
  const end = sourcePoint(definition, wall.endMm);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const wallLength = Math.hypot(dx, dy);
  if (wallLength <= 0) throw new Error(`${definition.id}: wall ${wall.id} has zero length`);
  const tangent = { x: dx / wallLength, y: dy / wallLength };
  const normal = { x: -tangent.y, y: tangent.x };
  const halfThickness = (wall.thicknessMm / definition.calibration.millimetersPerPixel) / 2;
  const blocked = openingsForWall(definition, wall);
  const spans = [];
  let cursor = 0;
  for (const interval of blocked) {
    const safeStart = Math.max(0, Math.min(wallLength, interval.startAlong));
    const safeEnd = Math.max(safeStart, Math.min(wallLength, interval.endAlong));
    if (safeStart - cursor >= 2) spans.push({ start: cursor, end: safeStart });
    cursor = Math.max(cursor, safeEnd);
  }
  if (wallLength - cursor >= 2) spans.push({ start: cursor, end: wallLength });

  return spans.flatMap((span) => [-halfThickness, halfThickness].map((offset) => ({
    x1: start.x + tangent.x * span.start + normal.x * offset,
    y1: start.y + tangent.y * span.start + normal.y * offset,
    x2: start.x + tangent.x * span.end + normal.x * offset,
    y2: start.y + tangent.y * span.end + normal.y * offset,
  })));
}

function openingSymbolSegments(definition, opening) {
  const wall = definition.walls.find((candidate) => candidate.id === opening.hostWallId);
  if (!wall) throw new Error(`${definition.id}: opening host wall ${opening.hostWallId} not found`);
  const center = sourcePoint(definition, opening.centerMm);
  const tangent = openingDirection(wall);
  const normal = { x: -tangent.y, y: tangent.x };
  const widthPx = opening.widthMm / definition.calibration.millimetersPerPixel;
  const half = widthPx / 2;
  const thicknessPx = Math.max(2, (wall.thicknessMm ?? 150) / definition.calibration.millimetersPerPixel);
  const start = { x: center.x - tangent.x * half, y: center.y - tangent.y * half };
  const end = { x: center.x + tangent.x * half, y: center.y + tangent.y * half };

  if (opening.kind === "window") {
    const offset = Math.max(2, thicknessPx * 0.22);
    const firstStart = { x: start.x + normal.x * offset, y: start.y + normal.y * offset };
    const firstEnd = { x: end.x + normal.x * offset, y: end.y + normal.y * offset };
    const secondStart = { x: start.x - normal.x * offset, y: start.y - normal.y * offset };
    const secondEnd = { x: end.x - normal.x * offset, y: end.y - normal.y * offset };
    return [
      { x1: firstStart.x, y1: firstStart.y, x2: firstEnd.x, y2: firstEnd.y },
      { x1: secondStart.x, y1: secondStart.y, x2: secondEnd.x, y2: secondEnd.y },
      { x1: start.x, y1: start.y, x2: firstStart.x, y2: firstStart.y },
      { x1: end.x, y1: end.y, x2: firstEnd.x, y2: firstEnd.y },
    ];
  }

  const leafEnd = { x: start.x + normal.x * widthPx, y: start.y + normal.y * widthPx };
  return [
    { x1: start.x, y1: start.y, x2: leafEnd.x, y2: leafEnd.y },
    { x1: end.x, y1: end.y, x2: leafEnd.x, y2: leafEnd.y },
  ];
}

function sortSegments(segments) {
  return [...segments].sort((first, second) =>
    first.y1 - second.y1 || first.x1 - second.x1 || first.y2 - second.y2 || first.x2 - second.x2,
  );
}

export function buildOpeningAwareSegmentsSnapshot(definition) {
  if (definition.openings.length === 0) return buildLegacySegmentsSnapshot(definition);

  const matrix = parseMatrix(definition.svgTransform);
  const legacy = buildLegacySegmentsSnapshot(definition);
  const originalWallSegmentCount = definition.walls.length * 2;
  const decorationSegments = legacy.segments.slice(originalWallSegmentCount);
  const wallSegments = sortSegments(
    definition.walls.flatMap((wall) => wallEdgeSegments(definition, wall)).map((segment) => transformSegment(segment, matrix)),
  );
  const symbolSegments = sortSegments(
    definition.openings.flatMap((opening) => openingSymbolSegments(definition, opening)).map((segment) => transformSegment(segment, matrix)),
  );
  const segments = sortSegments([...wallSegments, ...symbolSegments, ...decorationSegments]);

  return {
    schemaVersion: "recognition-segments-v1",
    widthPx: definition.sourceWidthPx,
    heightPx: definition.sourceHeightPx,
    segments,
    wallSegments,
    symbolSegments,
  };
}
