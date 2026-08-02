import type {
  RecognitionConfidence,
  RecognitionWallCandidate,
} from "./model";

export type LocalWallPoint = Readonly<{ x: number; y: number }>;

export type LocalWallCenterline = Readonly<{
  startPx: LocalWallPoint;
  endPx: LocalWallPoint;
  thicknessPx: number | null;
  evidenceCount: number;
  confidence: RecognitionConfidence;
  reasons: readonly string[];
}>;

export type LocalWallJunction = Readonly<{
  id: string;
  positionPx: LocalWallPoint;
  degree: number;
}>;

export type LocalWallTopologyEdge = Readonly<{
  id: string;
  startJunctionId: string;
  endJunctionId: string;
  startPx: LocalWallPoint;
  endPx: LocalWallPoint;
  thicknessPx: number | null;
  evidenceCount: number;
  confidence: RecognitionConfidence;
  reasons: readonly string[];
}>;

export type LocalWallTopologyDiagnostic = Readonly<{
  code: "disconnected-components" | "isolated-edge" | "unresolved-near-junction";
  edgeId: string | null;
  message: string;
}>;

export type LocalWallTopology = Readonly<{
  junctions: readonly LocalWallJunction[];
  edges: readonly LocalWallTopologyEdge[];
  diagnostics: readonly LocalWallTopologyDiagnostic[];
}>;

export type BuildLocalWallTopologyInput = Readonly<{
  centerlines: readonly LocalWallCenterline[];
  endpointSnapTolerancePx: number;
  endpointExtensionTolerancePx: number;
  intersectionTolerancePx: number;
  minimumEdgeLengthPx: number;
}>;

type MutableLine = {
  startPx: LocalWallPoint;
  endPx: LocalWallPoint;
  thicknessPx: number | null;
  evidenceCount: number;
  confidence: RecognitionConfidence;
  reasons: Set<string>;
};

type PointReference = Readonly<{ lineIndex: number; point: LocalWallPoint }>;

type Cluster = Readonly<{ id: string; center: LocalWallPoint; memberIndexes: readonly number[] }>;

const EPSILON = 1e-7;

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} должен быть неотрицательным конечным числом.`);
  }
  return value;
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} должен быть положительным конечным числом.`);
  }
  return value;
}

function finitePoint(point: LocalWallPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function distance(first: LocalWallPoint, second: LocalWallPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function lexicographicPoint(first: LocalWallPoint, second: LocalWallPoint): number {
  if (Math.abs(first.x - second.x) > EPSILON) return first.x - second.x;
  return first.y - second.y;
}

function canonicalLine(line: LocalWallCenterline, minimumLengthPx: number): MutableLine | null {
  if (!finitePoint(line.startPx) || !finitePoint(line.endPx)) return null;
  if (!Number.isFinite(line.evidenceCount) || line.evidenceCount <= 0) return null;
  if (line.thicknessPx !== null && (!Number.isFinite(line.thicknessPx) || line.thicknessPx <= 0)) return null;
  if (distance(line.startPx, line.endPx) < minimumLengthPx) return null;
  const [startPx, endPx] = lexicographicPoint(line.startPx, line.endPx) <= 0
    ? [line.startPx, line.endPx]
    : [line.endPx, line.startPx];
  return {
    startPx,
    endPx,
    thicknessPx: line.thicknessPx,
    evidenceCount: line.evidenceCount,
    confidence: line.confidence,
    reasons: new Set(line.reasons),
  };
}

function vector(line: Pick<MutableLine, "startPx" | "endPx">): LocalWallPoint {
  return { x: line.endPx.x - line.startPx.x, y: line.endPx.y - line.startPx.y };
}

function dot(first: LocalWallPoint, second: LocalWallPoint): number {
  return first.x * second.x + first.y * second.y;
}

function cross(first: LocalWallPoint, second: LocalWallPoint): number {
  return first.x * second.y - first.y * second.x;
}

function normalizedDirection(line: Pick<MutableLine, "startPx" | "endPx">): LocalWallPoint {
  const delta = vector(line);
  const length = Math.hypot(delta.x, delta.y);
  return { x: delta.x / length, y: delta.y / length };
}

function angleDifferenceDeg(first: MutableLine, second: MutableLine): number {
  const a = normalizedDirection(first);
  const b = normalizedDirection(second);
  const cosine = Math.max(-1, Math.min(1, Math.abs(dot(a, b))));
  return Math.acos(cosine) * 180 / Math.PI;
}

function pointToInfiniteLineDistance(point: LocalWallPoint, line: MutableLine): number {
  const delta = vector(line);
  return Math.abs(cross({ x: point.x - line.startPx.x, y: point.y - line.startPx.y }, delta))
    / Math.hypot(delta.x, delta.y);
}

function projection(point: LocalWallPoint, origin: LocalWallPoint, direction: LocalWallPoint): number {
  return dot({ x: point.x - origin.x, y: point.y - origin.y }, direction);
}

function weightedThickness(first: MutableLine, second: MutableLine): number | null {
  if (first.thicknessPx === null) return second.thicknessPx;
  if (second.thicknessPx === null) return first.thicknessPx;
  return (
    first.thicknessPx * first.evidenceCount + second.thicknessPx * second.evidenceCount
  ) / (first.evidenceCount + second.evidenceCount);
}

const CONFIDENCE_ORDER: Readonly<Record<RecognitionConfidence, number>> = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
});

function strongestConfidence(first: RecognitionConfidence, second: RecognitionConfidence): RecognitionConfidence {
  return CONFIDENCE_ORDER[first] >= CONFIDENCE_ORDER[second] ? first : second;
}

function mergeCollinear(lines: readonly MutableLine[], tolerancePx: number, gapTolerancePx: number): MutableLine[] {
  const pending = [...lines].sort((first, second) =>
    lexicographicPoint(first.startPx, second.startPx)
    || lexicographicPoint(first.endPx, second.endPx));
  const merged: MutableLine[] = [];

  for (const candidate of pending) {
    let targetIndex = -1;
    for (let index = 0; index < merged.length; index += 1) {
      const existing = merged[index]!;
      if (angleDifferenceDeg(existing, candidate) > 3) continue;
      if (pointToInfiniteLineDistance(candidate.startPx, existing) > tolerancePx) continue;
      if (pointToInfiniteLineDistance(candidate.endPx, existing) > tolerancePx) continue;
      const direction = normalizedDirection(existing);
      const existingStart = 0;
      const existingEnd = distance(existing.startPx, existing.endPx);
      const candidateStart = projection(candidate.startPx, existing.startPx, direction);
      const candidateEnd = projection(candidate.endPx, existing.startPx, direction);
      const candidateMin = Math.min(candidateStart, candidateEnd);
      const candidateMax = Math.max(candidateStart, candidateEnd);
      const gap = Math.max(0, Math.max(existingStart, candidateMin) - Math.min(existingEnd, candidateMax));
      if (gap > gapTolerancePx) continue;

      const minimum = Math.min(existingStart, candidateMin);
      const maximum = Math.max(existingEnd, candidateMax);
      const normal = { x: -direction.y, y: direction.x };
      const existingOffset = dot(existing.startPx, normal);
      const candidateOffset = dot(candidate.startPx, normal);
      const offset = (
        existingOffset * existing.evidenceCount + candidateOffset * candidate.evidenceCount
      ) / (existing.evidenceCount + candidate.evidenceCount);
      const origin = { x: 0, y: 0 };
      const pointAt = (along: number): LocalWallPoint => ({
        x: origin.x + direction.x * along + normal.x * offset,
        y: origin.y + direction.y * along + normal.y * offset,
      });
      const absoluteExistingStart = dot(existing.startPx, direction);
      const absoluteMinimum = absoluteExistingStart + minimum;
      const absoluteMaximum = absoluteExistingStart + maximum;
      const nextStart = pointAt(absoluteMinimum);
      const nextEnd = pointAt(absoluteMaximum);
      const nextReasons = new Set([...existing.reasons, ...candidate.reasons, "collinear-merge"]);
      merged[index] = {
        startPx: lexicographicPoint(nextStart, nextEnd) <= 0 ? nextStart : nextEnd,
        endPx: lexicographicPoint(nextStart, nextEnd) <= 0 ? nextEnd : nextStart,
        thicknessPx: weightedThickness(existing, candidate),
        evidenceCount: existing.evidenceCount + candidate.evidenceCount,
        confidence: strongestConfidence(existing.confidence, candidate.confidence),
        reasons: nextReasons,
      };
      targetIndex = index;
      break;
    }
    if (targetIndex < 0) merged.push(candidate);
  }

  return merged.sort((first, second) =>
    lexicographicPoint(first.startPx, second.startPx)
    || lexicographicPoint(first.endPx, second.endPx));
}

function lineIntersection(first: MutableLine, second: MutableLine): Readonly<{
  point: LocalWallPoint;
  firstT: number;
  secondT: number;
}> | null {
  const firstDelta = vector(first);
  const secondDelta = vector(second);
  const denominator = cross(firstDelta, secondDelta);
  if (Math.abs(denominator) < EPSILON) return null;
  const betweenStarts = {
    x: second.startPx.x - first.startPx.x,
    y: second.startPx.y - first.startPx.y,
  };
  const firstT = cross(betweenStarts, secondDelta) / denominator;
  const secondT = cross(betweenStarts, firstDelta) / denominator;
  return {
    point: {
      x: first.startPx.x + firstDelta.x * firstT,
      y: first.startPx.y + firstDelta.y * firstT,
    },
    firstT,
    secondT,
  };
}

function acceptsIntersection(line: MutableLine, parameter: number, extensionTolerancePx: number): boolean {
  if (parameter >= -EPSILON && parameter <= 1 + EPSILON) return true;
  const length = distance(line.startPx, line.endPx);
  const outsideDistance = parameter < 0 ? -parameter * length : (parameter - 1) * length;
  return outsideDistance <= extensionTolerancePx + EPSILON;
}

class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    const parent = this.parent[index]!;
    if (parent === index) return index;
    const root = this.find(parent);
    this.parent[index] = root;
    return root;
  }

  union(first: number, second: number): void {
    const firstRoot = this.find(first);
    const secondRoot = this.find(second);
    if (firstRoot === secondRoot) return;
    const minimum = Math.min(firstRoot, secondRoot);
    const maximum = Math.max(firstRoot, secondRoot);
    this.parent[maximum] = minimum;
  }
}

function coordinateToken(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded.toFixed(3).replace(/-0\.000/, "0.000").replace(/-/g, "m").replace(/\./g, "p");
}

function junctionId(point: LocalWallPoint): string {
  return `junction-${coordinateToken(point.x)}-${coordinateToken(point.y)}`;
}

function clusterPoints(points: readonly PointReference[], tolerancePx: number): Readonly<{
  clusters: readonly Cluster[];
  pointClusterIds: readonly string[];
}> {
  const unionFind = new UnionFind(points.length);
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      if (distance(points[first]!.point, points[second]!.point) <= tolerancePx + EPSILON) {
        unionFind.union(first, second);
      }
    }
  }

  const grouped = new Map<number, number[]>();
  for (let index = 0; index < points.length; index += 1) {
    const root = unionFind.find(index);
    const members = grouped.get(root) ?? [];
    members.push(index);
    grouped.set(root, members);
  }

  const clusters = [...grouped.values()]
    .map((memberIndexes): Cluster => {
      const sorted = [...memberIndexes].sort((first, second) =>
        lexicographicPoint(points[first]!.point, points[second]!.point));
      const center = sorted.reduce(
        (sum, index) => ({ x: sum.x + points[index]!.point.x, y: sum.y + points[index]!.point.y }),
        { x: 0, y: 0 },
      );
      const averaged = { x: center.x / sorted.length, y: center.y / sorted.length };
      return { id: junctionId(averaged), center: averaged, memberIndexes: sorted };
    })
    .sort((first, second) => lexicographicPoint(first.center, second.center));

  const pointClusterIds = Array<string>(points.length);
  for (const cluster of clusters) {
    for (const memberIndex of cluster.memberIndexes) pointClusterIds[memberIndex] = cluster.id;
  }
  return { clusters, pointClusterIds };
}

function componentData(edges: readonly LocalWallTopologyEdge[]): Readonly<{
  componentCount: number;
  edgeComponentSizes: ReadonlyMap<string, number>;
}> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const start = adjacency.get(edge.startJunctionId) ?? new Set<string>();
    start.add(edge.endJunctionId);
    adjacency.set(edge.startJunctionId, start);
    const end = adjacency.get(edge.endJunctionId) ?? new Set<string>();
    end.add(edge.startJunctionId);
    adjacency.set(edge.endJunctionId, end);
  }

  const visited = new Set<string>();
  const junctionComponent = new Map<string, number>();
  let componentCount = 0;
  for (const junctionIdValue of [...adjacency.keys()].sort()) {
    if (visited.has(junctionIdValue)) continue;
    componentCount += 1;
    const stack = [junctionIdValue];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      junctionComponent.set(current, componentCount);
      for (const neighbour of adjacency.get(current) ?? []) stack.push(neighbour);
    }
  }

  const componentEdgeCounts = new Map<number, number>();
  for (const edge of edges) {
    const component = junctionComponent.get(edge.startJunctionId) ?? 0;
    componentEdgeCounts.set(component, (componentEdgeCounts.get(component) ?? 0) + 1);
  }
  return {
    componentCount,
    edgeComponentSizes: new Map(edges.map((edge) => [
      edge.id,
      componentEdgeCounts.get(junctionComponent.get(edge.startJunctionId) ?? 0) ?? 0,
    ])),
  };
}

export function buildLocalWallTopology(input: BuildLocalWallTopologyInput): LocalWallTopology {
  const endpointSnapTolerancePx = finiteNonNegative(input.endpointSnapTolerancePx, "Допуск привязки");
  const endpointExtensionTolerancePx = finiteNonNegative(
    input.endpointExtensionTolerancePx,
    "Допуск продолжения",
  );
  const intersectionTolerancePx = finiteNonNegative(input.intersectionTolerancePx, "Допуск пересечения");
  const minimumEdgeLengthPx = finitePositive(input.minimumEdgeLengthPx, "Минимальная длина ребра");

  const canonical = input.centerlines
    .map((line) => canonicalLine(line, minimumEdgeLengthPx))
    .filter((line): line is MutableLine => line !== null);
  const lines = mergeCollinear(
    canonical,
    Math.max(intersectionTolerancePx, endpointSnapTolerancePx),
    endpointExtensionTolerancePx,
  );

  const splitPointsByLine: LocalWallPoint[][] = lines.map((line) => [line.startPx, line.endPx]);
  for (let firstIndex = 0; firstIndex < lines.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < lines.length; secondIndex += 1) {
      const first = lines[firstIndex]!;
      const second = lines[secondIndex]!;
      const intersection = lineIntersection(first, second);
      if (!intersection) continue;
      if (!acceptsIntersection(first, intersection.firstT, endpointExtensionTolerancePx)) continue;
      if (!acceptsIntersection(second, intersection.secondT, endpointExtensionTolerancePx)) continue;
      splitPointsByLine[firstIndex]!.push(intersection.point);
      splitPointsByLine[secondIndex]!.push(intersection.point);
    }
  }

  const pointReferences: PointReference[] = [];
  const pointIndexesByLine: number[][] = lines.map(() => []);
  for (let lineIndex = 0; lineIndex < splitPointsByLine.length; lineIndex += 1) {
    for (const point of splitPointsByLine[lineIndex]!) {
      pointIndexesByLine[lineIndex]!.push(pointReferences.length);
      pointReferences.push({ lineIndex, point });
    }
  }

  const { clusters, pointClusterIds } = clusterPoints(pointReferences, endpointSnapTolerancePx);
  const clusterById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const edgeMap = new Map<string, LocalWallTopologyEdge>();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    const direction = normalizedDirection(line);
    const clusterIds = [...new Set(pointIndexesByLine[lineIndex]!.map((index) => pointClusterIds[index]!))]
      .sort((firstId, secondId) => projection(
        clusterById.get(firstId)!.center,
        line.startPx,
        direction,
      ) - projection(clusterById.get(secondId)!.center, line.startPx, direction));

    for (let index = 0; index + 1 < clusterIds.length; index += 1) {
      const firstCluster = clusterById.get(clusterIds[index]!)!;
      const secondCluster = clusterById.get(clusterIds[index + 1]!)!;
      if (distance(firstCluster.center, secondCluster.center) < minimumEdgeLengthPx - EPSILON) continue;
      const [startCluster, endCluster] = lexicographicPoint(firstCluster.center, secondCluster.center) <= 0
        ? [firstCluster, secondCluster]
        : [secondCluster, firstCluster];
      const id = `edge-${startCluster.id}-${endCluster.id}`;
      const existing = edgeMap.get(id);
      if (existing) {
        const combinedEvidence = existing.evidenceCount + line.evidenceCount;
        edgeMap.set(id, {
          ...existing,
          thicknessPx: existing.thicknessPx === null
            ? line.thicknessPx
            : line.thicknessPx === null
              ? existing.thicknessPx
              : (
                  existing.thicknessPx * existing.evidenceCount + line.thicknessPx * line.evidenceCount
                ) / combinedEvidence,
          evidenceCount: combinedEvidence,
          confidence: strongestConfidence(existing.confidence, line.confidence),
          reasons: [...new Set([...existing.reasons, ...line.reasons, "duplicate-topology-edge"])].sort(),
        });
      } else {
        edgeMap.set(id, {
          id,
          startJunctionId: startCluster.id,
          endJunctionId: endCluster.id,
          startPx: startCluster.center,
          endPx: endCluster.center,
          thicknessPx: line.thicknessPx,
          evidenceCount: line.evidenceCount,
          confidence: line.confidence,
          reasons: [...new Set([...line.reasons, "topology-edge"])].sort(),
        });
      }
    }
  }

  const edges = [...edgeMap.values()].sort((first, second) => first.id.localeCompare(second.id));
  const degreeByJunction = new Map<string, number>();
  for (const edge of edges) {
    degreeByJunction.set(edge.startJunctionId, (degreeByJunction.get(edge.startJunctionId) ?? 0) + 1);
    degreeByJunction.set(edge.endJunctionId, (degreeByJunction.get(edge.endJunctionId) ?? 0) + 1);
  }
  const junctions = clusters
    .filter((cluster) => degreeByJunction.has(cluster.id))
    .map((cluster): LocalWallJunction => ({
      id: cluster.id,
      positionPx: cluster.center,
      degree: degreeByJunction.get(cluster.id) ?? 0,
    }))
    .sort((first, second) => first.id.localeCompare(second.id));

  const components = componentData(edges);
  const diagnostics: LocalWallTopologyDiagnostic[] = [];
  if (components.componentCount > 1) {
    diagnostics.push({
      code: "disconnected-components",
      edgeId: null,
      message: `Граф стен содержит ${components.componentCount} несвязанных компонентов.`,
    });
  }
  for (const edge of edges) {
    if ((components.edgeComponentSizes.get(edge.id) ?? 0) === 1) {
      diagnostics.push({
        code: "isolated-edge",
        edgeId: edge.id,
        message: "Ребро стены не связано с другими найденными стенами.",
      });
    }
  }

  return {
    junctions,
    edges,
    diagnostics: diagnostics.sort((first, second) =>
      first.code.localeCompare(second.code) || (first.edgeId ?? "").localeCompare(second.edgeId ?? "")),
  };
}

export function topologyWallCandidates(input: Readonly<{
  topology: LocalWallTopology;
  widthPx: number;
  heightPx: number;
}>): RecognitionWallCandidate[] {
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  const junctions = new Map(input.topology.junctions.map((junction) => [junction.id, junction]));
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return input.topology.edges.map((edge): RecognitionWallCandidate => {
    const startDegree = junctions.get(edge.startJunctionId)?.degree ?? 1;
    const endDegree = junctions.get(edge.endJunctionId)?.degree ?? 1;
    const minimumDegree = Math.min(startDegree, endDegree);
    const isolated = input.topology.diagnostics.some(
      (diagnostic) => diagnostic.code === "isolated-edge" && diagnostic.edgeId === edge.id,
    );
    const confidence: RecognitionConfidence = edge.evidenceCount >= 3 && minimumDegree >= 2
      ? "high"
      : isolated
        ? "low"
        : "medium";
    return {
      id: edge.id,
      start: { x: clamp(edge.startPx.x / widthPx), y: clamp(edge.startPx.y / heightPx) },
      end: { x: clamp(edge.endPx.x / widthPx), y: clamp(edge.endPx.y / heightPx) },
      estimatedThicknessPx: edge.thicknessPx,
      confidence,
      evidence: {
        localScore: confidence === "high" ? 0.88 : confidence === "medium" ? 0.72 : 0.55,
        cloudScore: null,
        reasons: [...new Set([
          ...edge.reasons,
          "architectural-line-filter",
          "topology-edge",
          `junction-degree:${minimumDegree}`,
        ])].sort(),
      },
      origin: "local",
      conflict: null,
    };
  });
}
