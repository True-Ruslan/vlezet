import {
  matchRealWallCoverage,
  realFixtureCalibration,
} from "./score-real-geometry.mjs";

function point(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a point.`);
  }
  if (![value.x, value.y].every((entry) => typeof entry === "number" && Number.isFinite(entry))) {
    throw new Error(`${label} must contain finite coordinates.`);
  }
  return { x: value.x, y: value.y };
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function angleDelta(first, second) {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function active(candidate) {
  return candidate && candidate.conflict == null;
}

function expectedPixelPoint(expected, calibration) {
  return {
    x: calibration.originPx.x + expected.x / calibration.millimetersPerPixel,
    y: calibration.originPx.y + expected.y / calibration.millimetersPerPixel,
  };
}

function predictedPixelPoint(predicted, calibration) {
  return {
    x: predicted.x * calibration.sourceWidthPx,
    y: predicted.y * calibration.sourceHeightPx,
  };
}

function countMetric(truePositive, falsePositive, falseNegative) {
  const precision = truePositive + falsePositive === 0
    ? (falseNegative === 0 ? 1 : 0)
    : truePositive / (truePositive + falsePositive);
  const recall = truePositive + falseNegative === 0 ? 1 : truePositive / (truePositive + falseNegative);
  const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return { truePositive, falsePositive, falseNegative, precision, recall, f1 };
}

function hostMatchesExpected({ fixture, hostPrediction, expectedHost }) {
  if (!hostPrediction || !expectedHost || !active(hostPrediction)) return false;
  const coverage = matchRealWallCoverage({
    fixture,
    expectedWall: expectedHost,
    predictions: [hostPrediction],
  });
  return coverage.predictedIds.includes(hostPrediction.id);
}

function pairMeasurement({ fixture, expected, predicted, wallsById, expectedWallsById, calibration }) {
  if (predicted.kind !== expected.kind) return null;
  const expectedCenter = expectedPixelPoint(point(expected.centerMm, `${expected.id}.centerMm`), calibration);
  const predictedCenter = predictedPixelPoint(point(predicted.center, `${predicted.id}.center`), calibration);
  const centerDistancePx = distance(expectedCenter, predictedCenter);
  const centerTolerancePx = Math.max(
    16,
    (fixture.tolerances?.openingCenterMm ?? 260) / calibration.millimetersPerPixel,
  );
  if (centerDistancePx > centerTolerancePx) return null;

  const expectedWidthPx = expected.widthMm / calibration.millimetersPerPixel;
  const predictedWidthPx = typeof predicted.widthPx === "number" ? predicted.widthPx : 0;
  const widthDeltaPx = Math.abs(expectedWidthPx - predictedWidthPx);
  const widthTolerancePx = Math.max(
    16,
    (fixture.tolerances?.openingWidthMm ?? 260) / calibration.millimetersPerPixel,
  );
  if (widthDeltaPx > widthTolerancePx) return null;
  const orientationDeltaDeg = typeof predicted.orientationDeg === "number"
    ? angleDelta(expected.orientationDeg, predicted.orientationDeg)
    : 0;
  if (orientationDeltaDeg > 18) return null;

  const hostPrediction = wallsById.get(predicted.hostWallCandidateId);
  const expectedHost = expectedWallsById.get(expected.hostWallId);
  if (!hostMatchesExpected({ fixture, hostPrediction, expectedHost })) return null;
  return {
    centerDistancePx,
    widthDeltaPx,
    orientationDeltaDeg,
    cost: centerDistancePx + widthDeltaPx * 0.5 + orientationDeltaDeg * 2,
  };
}

function maximumMatching(expected, predicted, edgesByExpected) {
  const predictionToExpected = new Map();
  const matchedEdge = new Map();

  function augment(expectedIndex, visited) {
    for (const edge of edgesByExpected.get(expectedIndex) ?? []) {
      if (visited.has(edge.predictedIndex)) continue;
      visited.add(edge.predictedIndex);
      const previousExpected = predictionToExpected.get(edge.predictedIndex);
      if (previousExpected === undefined || augment(previousExpected, visited)) {
        predictionToExpected.set(edge.predictedIndex, expectedIndex);
        matchedEdge.set(expectedIndex, edge);
        if (previousExpected !== undefined) matchedEdge.delete(previousExpected);
        return true;
      }
    }
    return false;
  }

  for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex += 1) {
    augment(expectedIndex, new Set());
  }
  return [...matchedEdge.entries()]
    .map(([expectedIndex, edge]) => ({ expectedIndex, predictedIndex: edge.predictedIndex, measurement: edge.measurement }))
    .sort((first, second) =>
      expected[first.expectedIndex].id.localeCompare(expected[second.expectedIndex].id)
      || predicted[first.predictedIndex].id.localeCompare(predicted[second.predictedIndex].id));
}

export function scoreRealOpenings({ fixture, wallPredictions, openingPredictions }) {
  const calibration = realFixtureCalibration(fixture);
  const activeWalls = wallPredictions.filter(active).sort((first, second) => first.id.localeCompare(second.id));
  const activeOpenings = openingPredictions.filter(active).sort((first, second) => first.id.localeCompare(second.id));
  const expected = [...(fixture.expectedOpenings ?? [])].sort((first, second) => first.id.localeCompare(second.id));
  const wallsById = new Map(activeWalls.map((candidate) => [candidate.id, candidate]));
  const expectedWallsById = new Map((fixture.expectedWalls ?? []).map((candidate) => [candidate.id, candidate]));
  const edgesByExpected = new Map();

  for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex += 1) {
    const edges = [];
    for (let predictedIndex = 0; predictedIndex < activeOpenings.length; predictedIndex += 1) {
      const measurement = pairMeasurement({
        fixture,
        expected: expected[expectedIndex],
        predicted: activeOpenings[predictedIndex],
        wallsById,
        expectedWallsById,
        calibration,
      });
      if (measurement) edges.push({ predictedIndex, measurement });
    }
    edges.sort((first, second) =>
      first.measurement.cost - second.measurement.cost
      || activeOpenings[first.predictedIndex].id.localeCompare(activeOpenings[second.predictedIndex].id));
    edgesByExpected.set(expectedIndex, edges);
  }

  const matches = maximumMatching(expected, activeOpenings, edgesByExpected);
  const matchedExpected = new Set(matches.map((match) => match.expectedIndex));
  const matchedPredicted = new Set(matches.map((match) => match.predictedIndex));
  const matchedPredictionIds = matches.map((match) => activeOpenings[match.predictedIndex].id).sort();
  const unmatchedPredictionIds = activeOpenings
    .filter((_candidate, index) => !matchedPredicted.has(index))
    .map((candidate) => candidate.id)
    .sort();
  const unmatchedExpectedOpeningIds = expected
    .filter((_candidate, index) => !matchedExpected.has(index))
    .map((candidate) => candidate.id)
    .sort();
  const unknownHostOpenings = activeOpenings.filter((candidate) =>
    !candidate.hostWallCandidateId || !wallsById.has(candidate.hostWallCandidateId));

  return {
    matches: matches.map((match) => ({
      expectedOpeningId: expected[match.expectedIndex].id,
      predictedOpeningId: activeOpenings[match.predictedIndex].id,
      ...match.measurement,
    })),
    matchedPredictionIds,
    unmatchedPredictionIds,
    unmatchedExpectedOpeningIds,
    unknownHostOpenings: unknownHostOpenings.map((candidate) => ({
      openingId: candidate.id,
      hostWallCandidateId: candidate.hostWallCandidateId,
    })),
    unknownHostOpeningCount: unknownHostOpenings.length,
    metrics: countMetric(
      matches.length,
      unmatchedPredictionIds.length,
      unmatchedExpectedOpeningIds.length,
    ),
  };
}
