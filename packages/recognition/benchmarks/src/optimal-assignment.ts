export type AssignmentEdge = Readonly<{
  leftIndex: number;
  rightIndex: number;
  costKey: readonly number[];
  tieKey: string;
}>;

export type AssignmentPair = Readonly<{
  leftIndex: number;
  rightIndex: number;
}>;

type ResidualEdge = {
  to: number;
  reverseIndex: number;
  capacity: number;
  cost: number;
  key: string;
};

type PairEdgeReference = Readonly<{
  leftIndex: number;
  rightIndex: number;
  edge: ResidualEdge;
}>;

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} должен быть неотрицательным целым числом.`);
  return value;
}

function compareNumberTuples(first: readonly number[], second: readonly number[]): number {
  const length = Math.min(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    const delta = first[index]! - second[index]!;
    if (delta !== 0) return delta;
  }
  return first.length - second.length;
}

function compareEdges(first: AssignmentEdge, second: AssignmentEdge): number {
  return compareNumberTuples(first.costKey, second.costKey)
    || first.tieKey.localeCompare(second.tieKey)
    || first.leftIndex - second.leftIndex
    || first.rightIndex - second.rightIndex;
}

function validateEdge(edge: AssignmentEdge, leftCount: number, rightCount: number): AssignmentEdge {
  if (!Number.isInteger(edge.leftIndex) || edge.leftIndex < 0 || edge.leftIndex >= leftCount) {
    throw new Error("Assignment edge содержит недопустимый leftIndex.");
  }
  if (!Number.isInteger(edge.rightIndex) || edge.rightIndex < 0 || edge.rightIndex >= rightCount) {
    throw new Error("Assignment edge содержит недопустимый rightIndex.");
  }
  if (edge.costKey.length === 0 || edge.costKey.some((value) => !Number.isFinite(value))) {
    throw new Error("Assignment edge costKey должен содержать конечные числа.");
  }
  if (!edge.tieKey.trim()) throw new Error("Assignment edge tieKey должен быть непустой строкой.");
  return {
    leftIndex: edge.leftIndex,
    rightIndex: edge.rightIndex,
    costKey: [...edge.costKey],
    tieKey: edge.tieKey,
  };
}

function addResidualEdge(
  graph: ResidualEdge[][],
  from: number,
  to: number,
  capacity: number,
  cost: number,
  key: string,
): ResidualEdge {
  const forward: ResidualEdge = {
    to,
    reverseIndex: graph[to]!.length,
    capacity,
    cost,
    key,
  };
  const reverse: ResidualEdge = {
    to: from,
    reverseIndex: graph[from]!.length,
    capacity: 0,
    cost: -cost,
    key: `reverse:${key}`,
  };
  graph[from]!.push(forward);
  graph[to]!.push(reverse);
  return forward;
}

function shortestAugmentingPath(
  graph: ResidualEdge[][],
  source: number,
  sink: number,
): Readonly<{ previousNode: number[]; previousEdge: number[] }> | null {
  const nodeCount = graph.length;
  const distances = Array<number>(nodeCount).fill(Number.POSITIVE_INFINITY);
  const pathKeys = Array<string | null>(nodeCount).fill(null);
  const previousNode = Array<number>(nodeCount).fill(-1);
  const previousEdge = Array<number>(nodeCount).fill(-1);
  distances[source] = 0;
  pathKeys[source] = "";

  for (let pass = 0; pass < nodeCount - 1; pass += 1) {
    let changed = false;
    for (let node = 0; node < nodeCount; node += 1) {
      if (!Number.isFinite(distances[node]!)) continue;
      const sourcePathKey = pathKeys[node] ?? "";
      for (let edgeIndex = 0; edgeIndex < graph[node]!.length; edgeIndex += 1) {
        const edge = graph[node]![edgeIndex]!;
        if (edge.capacity <= 0) continue;
        const nextDistance = distances[node]! + edge.cost;
        const nextPathKey = `${sourcePathKey}|${edge.key}`;
        const currentPathKey = pathKeys[edge.to];
        if (
          nextDistance < distances[edge.to]!
          || (nextDistance === distances[edge.to]! && (currentPathKey === null || nextPathKey < currentPathKey))
        ) {
          distances[edge.to] = nextDistance;
          pathKeys[edge.to] = nextPathKey;
          previousNode[edge.to] = node;
          previousEdge[edge.to] = edgeIndex;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return previousNode[sink] < 0 ? null : { previousNode, previousEdge };
}

function augment(
  graph: ResidualEdge[][],
  source: number,
  sink: number,
  path: Readonly<{ previousNode: number[]; previousEdge: number[] }>,
): void {
  let node = sink;
  while (node !== source) {
    const from = path.previousNode[node]!;
    const edgeIndex = path.previousEdge[node]!;
    if (from < 0 || edgeIndex < 0) throw new Error("Некорректный augmenting path.");
    const edge = graph[from]![edgeIndex]!;
    const reverse = graph[edge.to]![edge.reverseIndex]!;
    edge.capacity -= 1;
    reverse.capacity += 1;
    node = from;
  }
}

export function solveOptimalAssignment(input: Readonly<{
  leftCount: number;
  rightCount: number;
  edges: readonly AssignmentEdge[];
}>): readonly AssignmentPair[] {
  const leftCount = nonNegativeInteger(input.leftCount, "leftCount");
  const rightCount = nonNegativeInteger(input.rightCount, "rightCount");
  const validated = input.edges.map((edge) => validateEdge(edge, leftCount, rightCount));

  const bestByPair = new Map<string, AssignmentEdge>();
  for (const edge of validated) {
    const pairKey = `${edge.leftIndex}:${edge.rightIndex}`;
    const current = bestByPair.get(pairKey);
    if (!current || compareEdges(edge, current) < 0) bestByPair.set(pairKey, edge);
  }
  const rankedEdges = [...bestByPair.values()].sort(compareEdges);

  const source = 0;
  const leftOffset = 1;
  const rightOffset = leftOffset + leftCount;
  const sink = rightOffset + rightCount;
  const graph = Array.from({ length: sink + 1 }, () => [] as ResidualEdge[]);

  for (let leftIndex = 0; leftIndex < leftCount; leftIndex += 1) {
    addResidualEdge(graph, source, leftOffset + leftIndex, 1, 0, `source:${leftIndex}`);
  }
  for (let rightIndex = 0; rightIndex < rightCount; rightIndex += 1) {
    addResidualEdge(graph, rightOffset + rightIndex, sink, 1, 0, `sink:${rightIndex}`);
  }

  const pairReferences: PairEdgeReference[] = rankedEdges.map((edge, rank) => ({
    leftIndex: edge.leftIndex,
    rightIndex: edge.rightIndex,
    edge: addResidualEdge(
      graph,
      leftOffset + edge.leftIndex,
      rightOffset + edge.rightIndex,
      1,
      rank,
      `pair:${edge.tieKey}:${edge.leftIndex}:${edge.rightIndex}`,
    ),
  }));

  while (true) {
    const path = shortestAugmentingPath(graph, source, sink);
    if (!path) break;
    augment(graph, source, sink, path);
  }

  return pairReferences
    .filter((reference) => reference.edge.capacity === 0)
    .map(({ leftIndex, rightIndex }) => ({ leftIndex, rightIndex }))
    .sort((first, second) => first.leftIndex - second.leftIndex || first.rightIndex - second.rightIndex);
}
