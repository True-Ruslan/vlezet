const DEFAULT_THRESHOLDS = Object.freeze({
  minimumWallGeometryF1: 0.85,
  minimumOpeningF1: 0.85,
  maximumUnknownHostOpenings: 0,
  maximumIncorrectHighConfidenceRate: 0,
  maximumStaleDecisions: 0,
});

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

function calibrationOf(fixture) {
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

function expectedPixelPoint(mmPoint, calibration) {
  return {
    x: calibration.originPx.x + mmPoint.x / calibration.millimetersPerPixel,
    y: calibration.originPx.y + mmPoint.y / calibration.millimetersPerPixel,
  };
}

function predictedPixelPoint(normalizedPoint, calibration) {
  return {
    x: normalizedPoint.x * calibration.sourceWidthPx,
    y: normalizedPoint.y * calibration.sourceHeightPx,
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

function distance(first, second) {
  return length(subtract(first, second));
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

function active(candidate) {
  return candidate && candidate.conflict == null;
}

function wallPixels(candidate, calibration) {
  return {
    id: candidate.id,
    start: predictedPixelPoint(point(candidate.start, `${candidate.id}.start`), calibration),
    end: predictedPixelPoint(point(candidate.end, `${candidate.id}.end`), calibration),
    thicknessPx: Math.max(1, typeof candidate.estimatedThicknessPx === "number" ? candidate.estimatedThicknessPx : 1),
  };
}

function expectedWallPixels(expected, calibration) {
  return {
    id: expected.id,
    start: expectedPixelPoint(point(expected.startMm, `${expected.id}.startMm`), calibration),
    end: expectedPixelPoint(point(expected.endMm, `${expected.id}.endMm`), calibration),
    thicknessPx: Math.max(1, finite(expected.thicknessMm, `${expected.id}.thicknessMm`) / calibration.millimetersPerPixel),
  };
}

function wallTolerancePx(fixture, calibration) {
  const configured = fixture?.tolerances?.wallEndpointMm;
  return Math.max(12, (typeof configured === "number" ? configured : 260) / calibration.millimetersPerPixel);
}

function wallAngleTolerance(fixture) {
  const configured = fixture?.tolerances?.wallAngleDeg;
  return typeof configured === "number" ? configured : 10;
}

function wallMatch(expected, predicted, fixture, calibration, toleranceMultiplier = 1) {
  const expectedPixels = expectedWallPixels(expected, calibration);
  const predictedPixels = wallPixels(predicted, calibration);
  const expectedVector = subtract(expectedPixels.end, expectedPixels.start);
  const predictedVector = subtract(predictedPixels.end, predictedPixels.start);
  const expectedLength = length(expectedVector);
  const predictedLength = length(predictedVector);
  if (expectedLength <= 0 || predictedLength <= 0) return null;
  if (angleDelta(angleDeg(expectedPixels.start, expectedPixels.end), angleDeg(predictedPixels.start, predictedPixels.end))
    > wallAngleTolerance(fixture)) return null;

  const tangent = scale(expectedVector, 1 / expectedLength);
  const normal = { x: -tangent.y, y: tangent.x };
  const firstAlong = dot(subtract(predictedPixels.start, expectedPixels.start), tangent);
  const secondAlong = dot(subtract(predictedPixels.end, expectedPixels.start), tangent);
  const predictedMinimum = Math.min(firstAlong, secondAlong);
  const predictedMaximum = Math.max(firstAlong, secondAlong);
  const overlap = Math.max(0, Math.min(expectedLength, predictedMaximum) - Math.max(0, predictedMinimum));
  const overlapRatio = overlap / expectedLength;
  const midpointOffset = Math.abs(dot(
    subtract(midpoint(predictedPixels.start, predictedPixels.end), midpoint(expectedPixels.start, expectedPixels.end)),
    normal,
  ));
  const tolerancePx = wallTolerancePx(fixture, calibration) * toleranceMultiplier;
  if (overlapRatio < 0.62 || midpointOffset > tolerancePx) return null;
  if (predictedLength / expectedLength < 0.5 || predictedLength / expectedLength > 1.65) return null;
  return {
    expected: expectedPixels,
    predicted: predictedPixels,
    overlapRatio,
    midpointOffset,
  };
}

function expectedWallById(fixture, wallId) {
  return (fixture.expectedWalls ?? []).find((wall) => wall.id === wallId) ?? null;
}

function openingMatch(expected, predicted, wallsById, fixture, calibration) {
  if (!active(predicted)) return false;
  if (expected.kind !== "opening" && predicted.kind !== expected.kind) return false;
  const expectedCenter = expectedPixelPoint(point(expected.centerMm, `${expected.id}.centerMm`), calibration);
  const predictedCenter = predictedPixelPoint(point(predicted.center, `${predicted.id}.center`), calibration);
  const centerToleranceMm = fixture?.tolerances?.openingCenterMm;
  const centerTolerancePx = Math.max(
    16,
    (typeof centerToleranceMm === "number" ? centerToleranceMm : 260) / calibration.millimetersPerPixel,
  );
  if (distance(expectedCenter, predictedCenter) > centerTolerancePx) return false;

  const expectedWidthPx = finite(expected.widthMm, `${expected.id}.widthMm`) / calibration.millimetersPerPixel;
  const predictedWidthPx = typeof predicted.widthPx === "number" ? predicted.widthPx : 0;
  const widthToleranceMm = fixture?.tolerances?.openingWidthMm;
  const widthTolerancePx = Math.max(
    16,
    (typeof widthToleranceMm === "number" ? widthToleranceMm : 260) / calibration.millimetersPerPixel,
  );
  if (Math.abs(expectedWidthPx - predictedWidthPx) > widthTolerancePx) return false;

  const hostPrediction = wallsById.get(predicted.hostWallCandidateId);
  const expectedHost = expectedWallById(fixture, expected.hostWallId);
  return Boolean(hostPrediction && expectedHost && wallMatch(expectedHost, hostPrediction, fixture, calibration, 1.25));
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + 1e-9
    && b.x + 1e-9 >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) + 1e-9
    && b.y + 1e-9 >= Math.min(a.y, c.y);
}

function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  const o1 = orientation(firstStart, firstEnd, secondStart);
  const o2 = orientation(firstStart, firstEnd, secondEnd);
  const o3 = orientation(secondStart, secondEnd, firstStart);
  const o4 = orientation(secondStart, secondEnd, firstEnd);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(firstStart, secondStart, firstEnd))
    || (o2 === 0 && onSegment(firstStart, secondEnd, firstEnd))
    || (o3 === 0 && onSegment(secondStart, firstStart, secondEnd))
    || (o4 === 0 && onSegment(secondStart, firstEnd, secondEnd));
}

function pointInPolygon(target, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses = ((currentPoint.y > target.y) !== (previousPoint.y > target.y))
      && target.x < (previousPoint.x - currentPoint.x)
        * (target.y - currentPoint.y) / ((previousPoint.y - currentPoint.y) || Number.EPSILON)
        + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function segmentHitsPolygon(start, end, polygon) {
  if (pointInPolygon(start, polygon) || pointInPolygon(end, polygon) || pointInPolygon(midpoint(start, end), polygon)) {
    return true;
  }
  for (let index = 0; index < polygon.length; index += 1) {
    const next = (index + 1) % polygon.length;
    if (segmentsIntersect(start, end, polygon[index], polygon[next])) return true;
  }
  return false;
}

function duplicateAxesForExpectedWall(expected, predictedWalls, fixture, calibration) {
  const matches = predictedWalls
    .filter(active)
    .map((candidate) => ({ candidate, match: wallMatch(expected, candidate, fixture, calibration, 1.6) }))
    .filter((entry) => entry.match !== null);
  if (matches.length < 2) return null;
  const expectedThicknessPx = finite(expected.thicknessMm, `${expected.id}.thicknessMm`) / calibration.millimetersPerPixel;
  if (expectedThicknessPx < 24) return null;

  for (let firstIndex = 0; firstIndex < matches.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < matches.length; secondIndex += 1) {
      const first = matches[firstIndex].match.predicted;
      const second = matches[secondIndex].match.predicted;
      if (angleDelta(angleDeg(first.start, first.end), angleDeg(second.start, second.end)) > 8) continue;
      const firstVector = subtract(first.end, first.start);
      const firstLength = length(firstVector);
      if (firstLength <= 0) continue;
      const tangent = scale(firstVector, 1 / firstLength);
      const normal = { x: -tangent.y, y: tangent.x };
      const firstRange = [dot(first.start, tangent), dot(first.end, tangent)].sort((a, b) => a - b);
      const secondRange = [dot(second.start, tangent), dot(second.end, tangent)].sort((a, b) => a - b);
      const overlap = Math.max(0, Math.min(firstRange[1], secondRange[1]) - Math.max(firstRange[0], secondRange[0]));
      const overlapRatio = overlap / Math.max(1, Math.min(firstLength, length(subtract(second.end, second.start))));
      const axisDistance = Math.abs(dot(subtract(midpoint(second.start, second.end), midpoint(first.start, first.end)), normal));
      const maximumDistance = Math.max(expectedThicknessPx * 1.25, (first.thicknessPx + second.thicknessPx) / 2 + 8);
      if (overlapRatio >= 0.7 && axisDistance >= 2 && axisDistance <= maximumDistance) {
        return [matches[firstIndex].candidate.id, matches[secondIndex].candidate.id];
      }
    }
  }
  return null;
}

function uniqueFailures(failures) {
  const seen = new Set();
  return failures.filter((failure) => {
    const key = JSON.stringify([failure.code, failure.expectationId ?? null, failure.candidateId ?? null, failure.candidateIds ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scoreFailureExpectations({ fixture, recognitionResult }) {
  if (!fixture || typeof fixture !== "object") throw new Error("fixture is required.");
  if (!recognitionResult || typeof recognitionResult !== "object") throw new Error("recognitionResult is required.");
  const calibration = calibrationOf(fixture);
  const predictedWalls = Array.isArray(recognitionResult.walls) ? recognitionResult.walls : [];
  const predictedOpenings = Array.isArray(recognitionResult.openings) ? recognitionResult.openings : [];
  const wallsById = new Map(predictedWalls.filter(active).map((wall) => [wall.id, wall]));
  const expectedWallsById = new Map((fixture.expectedWalls ?? []).map((wall) => [wall.id, wall]));
  const expectedOpeningsById = new Map((fixture.expectedOpenings ?? []).map((opening) => [opening.id, opening]));
  const expectations = fixture.failureExpectations ?? {
    mustDetect: [],
    mustNotDetectRegions: [],
    knownAmbiguities: [],
  };
  const failures = [];
  let mustDetectPassed = 0;

  for (const expectation of expectations.mustDetect ?? []) {
    if (expectation.kind === "wall") {
      const expected = expectedWallsById.get(expectation.id);
      const matched = expected && predictedWalls.some((candidate) => active(candidate)
        && wallMatch(expected, candidate, fixture, calibration));
      if (matched) mustDetectPassed += 1;
      else failures.push({
        code: "must-detect-wall-missed",
        fixtureId: fixture.id,
        expectationId: expectation.id,
        message: `${fixture.id}: required wall ${expectation.id} was not detected.`,
      });
      continue;
    }

    const expected = expectedOpeningsById.get(expectation.id);
    const matched = expected && predictedOpenings.some((candidate) => openingMatch(
      expectation.kind === "opening" ? { ...expected, kind: "opening" } : expected,
      candidate,
      wallsById,
      fixture,
      calibration,
    ));
    if (matched) mustDetectPassed += 1;
    else failures.push({
      code: "must-detect-opening-missed",
      fixtureId: fixture.id,
      expectationId: expectation.id,
      message: `${fixture.id}: required ${expectation.kind} ${expectation.id} was not detected with a valid host wall.`,
    });
  }

  for (const region of expectations.mustNotDetectRegions ?? []) {
    const polygon = region.polygonNormalized.map((entry, index) => point(entry, `${region.id}.polygon[${index}]`));
    for (const candidate of predictedWalls.filter(active)) {
      const start = point(candidate.start, `${candidate.id}.start`);
      const end = point(candidate.end, `${candidate.id}.end`);
      if (segmentHitsPolygon(start, end, polygon)) {
        failures.push({
          code: "forbidden-wall-region-hit",
          fixtureId: fixture.id,
          expectationId: region.id,
          candidateId: candidate.id,
          message: `${fixture.id}: wall ${candidate.id} intersects forbidden region ${region.id}.`,
        });
      }
    }
  }

  for (const expected of fixture.expectedWalls ?? []) {
    const duplicateAxes = duplicateAxesForExpectedWall(expected, predictedWalls, fixture, calibration);
    if (duplicateAxes) {
      failures.push({
        code: "duplicate-thick-wall-axis",
        fixtureId: fixture.id,
        expectationId: expected.id,
        candidateIds: duplicateAxes,
        message: `${fixture.id}: thick wall ${expected.id} is represented by parallel duplicate axes.`,
      });
    }
  }

  for (const candidate of predictedOpenings.filter(active)) {
    if (!candidate.hostWallCandidateId || !wallsById.has(candidate.hostWallCandidateId)) {
      failures.push({
        code: "unknown-opening-host",
        fixtureId: fixture.id,
        candidateId: candidate.id,
        message: `${fixture.id}: opening ${candidate.id} references an unknown host wall.`,
      });
    }
  }

  if ((fixture.tags ?? []).includes("rotation-invariance")
    && failures.some((failure) => failure.code === "must-detect-wall-missed")) {
    failures.push({
      code: "orientation-invariance-failed",
      fixtureId: fixture.id,
      message: `${fixture.id}: normalized source orientation was not preserved.`,
    });
  }

  const normalizedFailures = uniqueFailures(failures);
  return {
    fixtureId: fixture.id,
    passed: normalizedFailures.length === 0,
    mustDetectPassed,
    mustDetectTotal: (expectations.mustDetect ?? []).length,
    forbiddenRegionCount: (expectations.mustNotDetectRegions ?? []).length,
    failures: normalizedFailures,
  };
}

function measuredMetric(metrics, name) {
  const metric = metrics?.[name];
  if (!metric || metric.status !== "measured" || typeof metric.value !== "number" || !Number.isFinite(metric.value)) {
    throw new Error(`Real fixture gate requires measured aggregate metric ${name}.`);
  }
  return metric.value;
}

export function enforceRealFixtureGate({
  benchmarkResult,
  scenarioScores,
  thresholds = {},
}) {
  const resolved = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const aggregate = benchmarkResult?.aggregate;
  if (!aggregate || typeof aggregate !== "object") throw new Error("benchmarkResult.aggregate is required.");
  if (!Array.isArray(scenarioScores) || scenarioScores.length === 0) {
    throw new Error("At least one real fixture scenario score is required.");
  }
  const failures = [];
  if ((aggregate.failedFixtureCount ?? 0) > 0) {
    failures.push(`failedFixtureCount=${aggregate.failedFixtureCount}`);
  }
  const metrics = aggregate.metrics;
  const wallGeometryF1 = measuredMetric(metrics, "wallGeometryF1");
  const openingF1 = measuredMetric(metrics, "openingF1");
  const unknownHostOpenings = measuredMetric(metrics, "unknownHostOpenings");
  const incorrectHighConfidenceRate = measuredMetric(metrics, "incorrectHighConfidenceRate");
  const staleDecisions = measuredMetric(metrics, "staleDecisions");
  if (wallGeometryF1 < resolved.minimumWallGeometryF1) {
    failures.push(`wallGeometryF1=${wallGeometryF1.toFixed(6)} < ${resolved.minimumWallGeometryF1.toFixed(6)}`);
  }
  if (openingF1 < resolved.minimumOpeningF1) {
    failures.push(`openingF1=${openingF1.toFixed(6)} < ${resolved.minimumOpeningF1.toFixed(6)}`);
  }
  if (unknownHostOpenings > resolved.maximumUnknownHostOpenings) {
    failures.push(`unknownHostOpenings=${unknownHostOpenings} > ${resolved.maximumUnknownHostOpenings}`);
  }
  if (incorrectHighConfidenceRate > resolved.maximumIncorrectHighConfidenceRate) {
    failures.push(`incorrectHighConfidenceRate=${incorrectHighConfidenceRate} > ${resolved.maximumIncorrectHighConfidenceRate}`);
  }
  if (staleDecisions > resolved.maximumStaleDecisions) {
    failures.push(`staleDecisions=${staleDecisions} > ${resolved.maximumStaleDecisions}`);
  }
  for (const score of scenarioScores) {
    for (const failure of score.failures ?? []) failures.push(failure.message ?? `${score.fixtureId}: ${failure.code}`);
  }
  if (failures.length > 0) {
    throw new Error(`M7.9 real fixture gate failed:\n- ${failures.join("\n- ")}`);
  }
  return {
    passed: true,
    scenarioCount: scenarioScores.length,
    thresholds: resolved,
    aggregate: {
      wallGeometryF1,
      openingF1,
      unknownHostOpenings,
      incorrectHighConfidenceRate,
      staleDecisions,
    },
  };
}

export { DEFAULT_THRESHOLDS };
