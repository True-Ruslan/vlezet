function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function point(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a point.`);
  }
  return { x: finite(value.x, `${label}.x`), y: finite(value.y, `${label}.y`) };
}

export function realFixtureCalibration(fixture) {
  const calibration = fixture?.calibration;
  if (!calibration || typeof calibration !== "object") throw new Error("fixture.calibration is required.");
  const sourceWidthPx = finite(calibration.sourceWidthPx, "calibration.sourceWidthPx");
  const sourceHeightPx = finite(calibration.sourceHeightPx, "calibration.sourceHeightPx");
  const millimetersPerPixel = finite(calibration.millimetersPerPixel, "calibration.millimetersPerPixel");
  if (sourceWidthPx <= 0 || sourceHeightPx <= 0 || millimetersPerPixel <= 0) {
    throw new Error("Fixture calibration values must be positive.");
  }
  return {
    sourceWidthPx,
    sourceHeightPx,
    millimetersPerPixel,
    originPx: point(calibration.originPx ?? { x: 0, y: 0 }, "calibration.originPx"),
  };
}

function subtract(first, second) {
  return { x: first.x - second.x, y: first.y - second.y };
}

function add(first, second) {
  return { x: first.x + second.x, y: first.y + second.y };
}

function scale(value, amount) {
  return { x: value.x * amount, y: value.y * amount };
}

function dot(first, second) {
  return first.x * second.x + first.y * second.y;
}

function length(value) {
  return Math.hypot(value.x, value.y);
}

function midpoint(first, second) {
  return scale(add(first, second), 0.5);
}

function angleDeg(start, end) {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first, second) {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function expectedPointMm(value, label) {
  return point(value, label);
}

function predictedPointMm(value, calibration, label) {
  const normalized = point(value, label);
  return {
    x: (normalized.x * calibration.sourceWidthPx - calibration.originPx.x) * calibration.millimetersPerPixel,
    y: (normalized.y * calibration.sourceHeightPx - calibration.originPx.y) * calibration.millimetersPerPixel,
  };
}

function segment(start, end, label) {
  const vector = subtract(end, start);
  const segmentLength = length(vector);
  if (segmentLength <= 0) throw new Error(`${label} must have positive length.`);
  return {
    start,
    end,
    length: segmentLength,
    tangent: scale(vector, 1 / segmentLength),
    orientationDeg: angleDeg(start, end),
  };
}

function expectedSegment(expectedWall) {
  return segment(
    expectedPointMm(expectedWall.startMm, `${expectedWall.id}.startMm`),
    expectedPointMm(expectedWall.endMm, `${expectedWall.id}.endMm`),
    `expected wall ${expectedWall.id}`,
  );
}

function predictedSegment(prediction, calibration) {
  return segment(
    predictedPointMm(prediction.start, calibration, `${prediction.id}.start`),
    predictedPointMm(prediction.end, calibration, `${prediction.id}.end`),
    `predicted wall ${prediction.id}`,
  );
}

function wallOrientationTolerance(fixture) {
  const value = fixture?.tolerances?.wallOrientationDeg ?? fixture?.tolerances?.wallAngleDeg;
  return typeof value === "number" && Number.isFinite(value) ? value : 10;
}

function wallCoverageThreshold(fixture) {
  const value = fixture?.tolerances?.wallMinimumOverlapRatio;
  return typeof value === "number" && Number.isFinite(value) ? value : 0.68;
}

function wallEndpointTolerance(fixture) {
  const value = fixture?.tolerances?.wallEndpointMm;
  return typeof value === "number" && Number.isFinite(value) ? value : 220;
}

function offsetToleranceMm(fixture, expectedWall, prediction, calibration) {
  const expectedHalf = typeof expectedWall.thicknessMm === "number" ? expectedWall.thicknessMm / 2 : 110;
  const predictedHalf = typeof prediction.estimatedThicknessPx === "number"
    ? prediction.estimatedThicknessPx * calibration.millimetersPerPixel / 2
    : 100;
  return Math.max(
    wallEndpointTolerance(fixture),
    expectedHalf + predictedHalf + 80,
  );
}

function measurePredictionAgainstExpected({ fixture, expectedWall, prediction, calibration }) {
  const expected = expectedSegment(expectedWall);
  const predicted = predictedSegment(prediction, calibration);
  if (angleDelta(expected.orientationDeg, predicted.orientationDeg) > wallOrientationTolerance(fixture)) return null;
  const normal = { x: -expected.tangent.y, y: expected.tangent.x };
  const predictedMidpoint = midpoint(predicted.start, predicted.end);
  const expectedMidpoint = midpoint(expected.start, expected.end);
  const offsetMm = Math.abs(dot(subtract(predictedMidpoint, expectedMidpoint), normal));
  if (offsetMm > offsetToleranceMm(fixture, expectedWall, prediction, calibration)) return null;

  const projectedStart = dot(subtract(predicted.start, expected.start), expected.tangent);
  const projectedEnd = dot(subtract(predicted.end, expected.start), expected.tangent);
  const clippedStart = Math.max(0, Math.min(projectedStart, projectedEnd));
  const clippedEnd = Math.min(expected.length, Math.max(projectedStart, projectedEnd));
  const overlapMm = Math.max(0, clippedEnd - clippedStart);
  if (overlapMm <= 0) return null;
  return {
    expected,
    predicted,
    interval: [clippedStart, clippedEnd],
    overlapMm,
    expectedCoverageRatio: overlapMm / expected.length,
    predictionCoverageRatio: overlapMm / predicted.length,
    offsetMm,
  };
}

function measureExpectedOnPrediction({ fixture, expectedWall, prediction, calibration, predicted }) {
  const expected = expectedSegment(expectedWall);
  if (angleDelta(expected.orientationDeg, predicted.orientationDeg) > wallOrientationTolerance(fixture)) return null;
  const normal = { x: -predicted.tangent.y, y: predicted.tangent.x };
  const predictedMidpoint = midpoint(predicted.start, predicted.end);
  const expectedMidpoint = midpoint(expected.start, expected.end);
  const signedOffsetMm = dot(subtract(expectedMidpoint, predictedMidpoint), normal);
  if (Math.abs(signedOffsetMm) > offsetToleranceMm(fixture, expectedWall, prediction, calibration)) return null;

  const projectedStart = dot(subtract(expected.start, predicted.start), predicted.tangent);
  const projectedEnd = dot(subtract(expected.end, predicted.start), predicted.tangent);
  const clippedStart = Math.max(0, Math.min(projectedStart, projectedEnd));
  const clippedEnd = Math.min(predicted.length, Math.max(projectedStart, projectedEnd));
  const overlapMm = Math.max(0, clippedEnd - clippedStart);
  if (overlapMm <= 0) return null;
  return {
    expectedWallId: expectedWall.id,
    interval: [clippedStart, clippedEnd],
    signedOffsetMm,
  };
}

function unionLength(intervals) {
  if (intervals.length === 0) return 0;
  const ordered = intervals
    .map(([start, end]) => [Math.min(start, end), Math.max(start, end)])
    .sort((first, second) => first[0] - second[0] || first[1] - second[1]);
  let currentStart = ordered[0][0];
  let currentEnd = ordered[0][1];
  let total = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const [start, end] = ordered[index];
    if (start <= currentEnd) currentEnd = Math.max(currentEnd, end);
    else {
      total += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  return total + currentEnd - currentStart;
}

function contiguousExpectedGroups(entries, gapToleranceMm) {
  const ordered = [...entries].sort((first, second) =>
    first.interval[0] - second.interval[0]
    || first.interval[1] - second.interval[1]
    || first.expectedWallId.localeCompare(second.expectedWallId));
  const groups = [];
  let current = [];
  let currentEnd = Number.NEGATIVE_INFINITY;
  let currentOffsetMm = 0;

  for (const entry of ordered) {
    const gapMm = entry.interval[0] - currentEnd;
    const sameAxis = current.length === 0
      || Math.abs(entry.signedOffsetMm - currentOffsetMm) <= gapToleranceMm;
    if (current.length === 0 || (gapMm <= gapToleranceMm && sameAxis)) {
      current.push(entry);
      currentEnd = Math.max(currentEnd, entry.interval[1]);
      currentOffsetMm = current.reduce((total, item) => total + item.signedOffsetMm, 0) / current.length;
      continue;
    }
    groups.push(current);
    current = [entry];
    currentEnd = entry.interval[1];
    currentOffsetMm = entry.signedOffsetMm;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

export function matchRealWallCoverage({ fixture, expectedWall, predictions }) {
  const calibration = realFixtureCalibration(fixture);
  const activePredictions = predictions
    .filter((prediction) => prediction?.conflict == null)
    .sort((first, second) => first.id.localeCompare(second.id));
  const measurements = activePredictions
    .map((prediction) => ({
      prediction,
      measurement: measurePredictionAgainstExpected({ fixture, expectedWall, prediction, calibration }),
    }))
    .filter((entry) => entry.measurement !== null);
  const expectedLength = expectedSegment(expectedWall).length;
  const coverageMm = unionLength(measurements.map((entry) => entry.measurement.interval));
  const coverageRatio = coverageMm / expectedLength;
  const matched = coverageRatio >= wallCoverageThreshold(fixture);
  return {
    expectedWallId: expectedWall.id,
    matched,
    coverageMm,
    coverageRatio,
    predictedIds: measurements
      .filter((entry) => entry.measurement.predictionCoverageRatio >= 0.5
        || entry.measurement.expectedCoverageRatio >= 0.12)
      .map((entry) => entry.prediction.id)
      .sort(),
    measurements,
  };
}

export function predictionMatchesRealExpectedWall({ fixture, prediction, expectedWall }) {
  if (prediction?.conflict != null) return false;
  const measurement = measurePredictionAgainstExpected({
    fixture,
    expectedWall,
    prediction,
    calibration: realFixtureCalibration(fixture),
  });
  return Boolean(measurement && measurement.predictionCoverageRatio >= 0.6);
}

export function predictionMatchesRealExpectedWallNetwork({ fixture, prediction }) {
  if (prediction?.conflict != null) return false;
  if ((fixture.expectedWalls ?? []).some((expectedWall) =>
    predictionMatchesRealExpectedWall({ fixture, prediction, expectedWall }))) return true;

  const calibration = realFixtureCalibration(fixture);
  const predicted = predictedSegment(prediction, calibration);
  const entries = (fixture.expectedWalls ?? [])
    .map((expectedWall) => measureExpectedOnPrediction({
      fixture,
      expectedWall,
      prediction,
      calibration,
      predicted,
    }))
    .filter((entry) => entry !== null);
  const gapToleranceMm = wallEndpointTolerance(fixture);
  return contiguousExpectedGroups(entries, gapToleranceMm).some((group) =>
    group.length >= 2
    && unionLength(group.map((entry) => entry.interval)) / predicted.length >= 0.6);
}

function countMetric(truePositive, falsePositive, falseNegative) {
  const precision = truePositive + falsePositive === 0
    ? (falseNegative === 0 ? 1 : 0)
    : truePositive / (truePositive + falsePositive);
  const recall = truePositive + falseNegative === 0 ? 1 : truePositive / (truePositive + falseNegative);
  const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return { truePositive, falsePositive, falseNegative, precision, recall, f1 };
}

export function scoreRealWallGeometry({ fixture, predictions }) {
  const activePredictions = predictions
    .filter((prediction) => prediction?.conflict == null)
    .sort((first, second) => first.id.localeCompare(second.id));
  const matches = (fixture.expectedWalls ?? []).map((expectedWall) =>
    matchRealWallCoverage({ fixture, expectedWall, predictions: activePredictions }));
  const matchedExpectedWallIds = matches.filter((match) => match.matched).map((match) => match.expectedWallId).sort();
  const unmatchedExpectedWallIds = matches.filter((match) => !match.matched).map((match) => match.expectedWallId).sort();
  const matchedPredictionIds = activePredictions
    .filter((prediction) => predictionMatchesRealExpectedWallNetwork({ fixture, prediction }))
    .map((prediction) => prediction.id)
    .sort();
  const matchedPredictionSet = new Set(matchedPredictionIds);
  const unmatchedPredictionIds = activePredictions
    .filter((prediction) => !matchedPredictionSet.has(prediction.id))
    .map((prediction) => prediction.id)
    .sort();
  return {
    matches,
    matchedExpectedWallIds,
    unmatchedExpectedWallIds,
    matchedPredictionIds,
    unmatchedPredictionIds,
    metrics: countMetric(
      matchedExpectedWallIds.length,
      unmatchedPredictionIds.length,
      unmatchedExpectedWallIds.length,
    ),
  };
}
