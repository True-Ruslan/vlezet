import type { RecognitionWallCandidate } from "../../src/model";
import type {
  BenchmarkCalibrationV1,
  BenchmarkPointMm,
  RecognitionBenchmarkFixtureV1,
} from "../schema/fixture-v1";
import type { BenchmarkCountMetric } from "../schema/result-v1";
import { normalizedPointToReferenceMm, stablePointKey } from "./coordinates";
import { solveOptimalAssignment, type AssignmentEdge } from "./optimal-assignment";

export type PredictedTopologyJunction = Readonly<{
  id: string;
  pointMm: BenchmarkPointMm;
  memberKeys: readonly string[];
}>;

export type PredictedTopologyEdge = Readonly<{
  wallIndex: number;
  startJunctionId: string;
  endJunctionId: string;
}>;

export type PredictedTopology = Readonly<{
  junctions: readonly PredictedTopologyJunction[];
  edges: readonly PredictedTopologyEdge[];
  selfLoopWallIndices: readonly number[];
  duplicateEdgeWallIndices: readonly number[];
}>;

export type WallTopologyScore = Readonly<{
  predicted: PredictedTopology;
  junctions: BenchmarkCountMetric;
  edges: BenchmarkCountMetric;
  connectedComponentCountError: number;
  missingEdgeCount: number;
  extraEdgeCount: number;
  selfLoopCount: number;
  duplicateEdgeCount: number;
  topologyF1: number;
}>;

type EndpointRecord = Readonly<{
  wallIndex: number;
  side: "start" | "end";
  pointMm: BenchmarkPointMm;
  memberKey: string;
}>;

type ExpectedJunction = Readonly<{
  id: string;
  pointMm: BenchmarkPointMm;
}>;

class UnionFind {
  readonly #parents: number[];
  readonly #ranks: number[];

  constructor(size: number) {
    this.#parents = Array.from({ length: size }, (_value, index) => index);
    this.#ranks = Array<number>(size).fill(0);
  }

  find(index: number): number {
    const parent = this.#parents[index]!;
    if (parent !== index) this.#parents[index] = this.find(parent);
    return this.#parents[index]!;
  }

  union(first: number, second: number): void {
    let firstRoot = this.find(first);
    let secondRoot = this.find(second);
    if (firstRoot === secondRoot) return;
    const firstRank = this.#ranks[firstRoot]!;
    const secondRank = this.#ranks[secondRoot]!;
    if (firstRank < secondRank) [firstRoot, secondRoot] = [secondRoot, firstRoot];
    this.#parents[secondRoot] = firstRoot;
    if (firstRank === secondRank) this.#ranks[firstRoot] = firstRank + 1;
  }
}

function positiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} должен быть положительным конечным числом.`);
  return value;
}

function distance(first: BenchmarkPointMm, second: BenchmarkPointMm): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function canonicalEdgeKey(first: string, second: string): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function countMetric(truePositive: number, falsePositive: number, falseNegative: number): BenchmarkCountMetric {
  const precisionDenominator = truePositive + falsePositive;
  const recallDenominator = truePositive + falseNegative;
  const precision = precisionDenominator === 0 ? (falseNegative === 0 ? 1 : 0) : truePositive / precisionDenominator;
  const recall = recallDenominator === 0 ? 1 : truePositive / recallDenominator;
  const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return { truePositive, falsePositive, falseNegative, precision, recall, f1 };
}

function mean(points: readonly BenchmarkPointMm[]): BenchmarkPointMm {
  if (points.length === 0) throw new Error("Нельзя вычислить среднее пустого набора точек.");
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function derivePredictedTopology(input: Readonly<{
  predictions: readonly RecognitionWallCandidate[];
  calibration: BenchmarkCalibrationV1;
  junctionToleranceMm: number;
}>): PredictedTopology {
  const tolerance = positiveFinite(input.junctionToleranceMm, "junctionToleranceMm");
  const endpoints: EndpointRecord[] = input.predictions.flatMap((prediction, wallIndex) => {
    const start = normalizedPointToReferenceMm(prediction.start, input.calibration);
    const end = normalizedPointToReferenceMm(prediction.end, input.calibration);
    return [
      { wallIndex, side: "start" as const, pointMm: start, memberKey: stablePointKey(start) },
      { wallIndex, side: "end" as const, pointMm: end, memberKey: stablePointKey(end) },
    ];
  }).sort((first, second) =>
    first.memberKey.localeCompare(second.memberKey)
    || first.pointMm.x - second.pointMm.x
    || first.pointMm.y - second.pointMm.y
    || first.wallIndex - second.wallIndex
    || first.side.localeCompare(second.side),
  );

  const unionFind = new UnionFind(endpoints.length);
  for (let first = 0; first < endpoints.length; first += 1) {
    for (let second = first + 1; second < endpoints.length; second += 1) {
      if (distance(endpoints[first]!.pointMm, endpoints[second]!.pointMm) <= tolerance) {
        unionFind.union(first, second);
      }
    }
  }

  const componentMembers = new Map<number, number[]>();
  for (let index = 0; index < endpoints.length; index += 1) {
    const root = unionFind.find(index);
    const members = componentMembers.get(root) ?? [];
    members.push(index);
    componentMembers.set(root, members);
  }

  const endpointToJunction = new Map<string, string>();
  const junctions = [...componentMembers.values()].map((memberIndices): PredictedTopologyJunction => {
    const members = memberIndices.map((index) => endpoints[index]!);
    const memberKeys = members.map((member) => member.memberKey).sort((first, second) => first.localeCompare(second));
    const id = `junction:${memberKeys.join("|")}`;
    for (const member of members) endpointToJunction.set(`${member.wallIndex}:${member.side}`, id);
    return { id, pointMm: mean(members.map((member) => member.pointMm)), memberKeys };
  }).sort((first, second) => first.id.localeCompare(second.id));

  const edges: PredictedTopologyEdge[] = [];
  const selfLoopWallIndices: number[] = [];
  const duplicateEdgeWallIndices: number[] = [];
  const seenEdgeKeys = new Set<string>();
  for (let wallIndex = 0; wallIndex < input.predictions.length; wallIndex += 1) {
    const startJunctionId = endpointToJunction.get(`${wallIndex}:start`);
    const endJunctionId = endpointToJunction.get(`${wallIndex}:end`);
    if (!startJunctionId || !endJunctionId) throw new Error(`Не удалось сопоставить endpoints стены ${wallIndex}.`);
    if (startJunctionId === endJunctionId) {
      selfLoopWallIndices.push(wallIndex);
      continue;
    }
    const edgeKey = canonicalEdgeKey(startJunctionId, endJunctionId);
    if (seenEdgeKeys.has(edgeKey)) duplicateEdgeWallIndices.push(wallIndex);
    else seenEdgeKeys.add(edgeKey);
    edges.push({ wallIndex, startJunctionId, endJunctionId });
  }

  return { junctions, edges, selfLoopWallIndices, duplicateEdgeWallIndices };
}

function expectedJunctions(fixture: RecognitionBenchmarkFixtureV1): ExpectedJunction[] {
  const points = new Map<string, BenchmarkPointMm[]>();
  for (const wall of fixture.expectedWalls) {
    points.set(wall.startJunctionId, [...(points.get(wall.startJunctionId) ?? []), wall.startMm]);
    points.set(wall.endJunctionId, [...(points.get(wall.endJunctionId) ?? []), wall.endMm]);
  }
  return fixture.expectedJunctions.map((junction) => ({
    id: junction.id,
    pointMm: points.has(junction.id) ? mean(points.get(junction.id)!) : junction.positionMm,
  })).sort((first, second) => first.id.localeCompare(second.id));
}

function graphComponentCount(junctionIds: readonly string[], edges: readonly Readonly<{ start: string; end: string }>[]): number {
  if (junctionIds.length === 0) return 0;
  const indexById = new Map(junctionIds.map((id, index) => [id, index]));
  const unionFind = new UnionFind(junctionIds.length);
  for (const edge of edges) {
    const start = indexById.get(edge.start);
    const end = indexById.get(edge.end);
    if (start !== undefined && end !== undefined) unionFind.union(start, end);
  }
  return new Set(junctionIds.map((_id, index) => unionFind.find(index))).size;
}

export function scoreWallTopology(input: Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  predictions: readonly RecognitionWallCandidate[];
}>): WallTopologyScore {
  const predicted = derivePredictedTopology({
    predictions: input.predictions,
    calibration: input.fixture.calibration,
    junctionToleranceMm: input.fixture.tolerances.junctionMm,
  });
  const expected = expectedJunctions(input.fixture);
  const junctionEdges: AssignmentEdge[] = [];
  for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex += 1) {
    for (let predictedIndex = 0; predictedIndex < predicted.junctions.length; predictedIndex += 1) {
      const separation = distance(expected[expectedIndex]!.pointMm, predicted.junctions[predictedIndex]!.pointMm);
      if (separation <= input.fixture.tolerances.junctionMm) {
        junctionEdges.push({
          leftIndex: expectedIndex,
          rightIndex: predictedIndex,
          costKey: [separation],
          tieKey: `${expected[expectedIndex]!.id}|${predicted.junctions[predictedIndex]!.id}`,
        });
      }
    }
  }
  const junctionAssignments = solveOptimalAssignment({
    leftCount: expected.length,
    rightCount: predicted.junctions.length,
    edges: junctionEdges,
  });
  const predictedToExpected = new Map(junctionAssignments.map((assignment) => [
    predicted.junctions[assignment.rightIndex]!.id,
    expected[assignment.leftIndex]!.id,
  ]));
  const junctionMetrics = countMetric(
    junctionAssignments.length,
    predicted.junctions.length - junctionAssignments.length,
    expected.length - junctionAssignments.length,
  );

  const edgeAssignmentEdges: AssignmentEdge[] = [];
  for (let expectedIndex = 0; expectedIndex < input.fixture.expectedWalls.length; expectedIndex += 1) {
    const expectedWall = input.fixture.expectedWalls[expectedIndex]!;
    const expectedKey = canonicalEdgeKey(expectedWall.startJunctionId, expectedWall.endJunctionId);
    for (let predictedIndex = 0; predictedIndex < predicted.edges.length; predictedIndex += 1) {
      const predictedEdge = predicted.edges[predictedIndex]!;
      const mappedStart = predictedToExpected.get(predictedEdge.startJunctionId);
      const mappedEnd = predictedToExpected.get(predictedEdge.endJunctionId);
      if (!mappedStart || !mappedEnd || canonicalEdgeKey(mappedStart, mappedEnd) !== expectedKey) continue;
      edgeAssignmentEdges.push({
        leftIndex: expectedIndex,
        rightIndex: predictedIndex,
        costKey: [0],
        tieKey: `${expectedWall.id}|${canonicalEdgeKey(predictedEdge.startJunctionId, predictedEdge.endJunctionId)}|${predictedEdge.wallIndex}`,
      });
    }
  }
  const edgeAssignments = solveOptimalAssignment({
    leftCount: input.fixture.expectedWalls.length,
    rightCount: predicted.edges.length,
    edges: edgeAssignmentEdges,
  });
  const edgeMetrics = countMetric(
    edgeAssignments.length,
    input.predictions.length - edgeAssignments.length,
    input.fixture.expectedWalls.length - edgeAssignments.length,
  );

  const expectedComponentCount = graphComponentCount(
    expected.map((junction) => junction.id),
    input.fixture.expectedWalls.map((wall) => ({ start: wall.startJunctionId, end: wall.endJunctionId })),
  );
  const predictedComponentCount = graphComponentCount(
    predicted.junctions.map((junction) => junction.id),
    predicted.edges.map((edge) => ({ start: edge.startJunctionId, end: edge.endJunctionId })),
  );

  return {
    predicted,
    junctions: junctionMetrics,
    edges: edgeMetrics,
    connectedComponentCountError: Math.abs(predictedComponentCount - expectedComponentCount),
    missingEdgeCount: edgeMetrics.falseNegative,
    extraEdgeCount: edgeMetrics.falsePositive,
    selfLoopCount: predicted.selfLoopWallIndices.length,
    duplicateEdgeCount: predicted.duplicateEdgeWallIndices.length,
    topologyF1: edgeMetrics.f1,
  };
}
