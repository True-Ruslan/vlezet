import type { Point2 } from "./point";
import { GEOMETRY_EPSILON_MM } from "./segment";
import { deriveAtomicWallEdges, type AtomicWallEdge, type TopologyDocumentLike } from "./topology";

export type FaceBoundaryEdge = Readonly<{
  wallId: string;
  startVertexId: string;
  endVertexId: string;
  start: Point2;
  end: Point2;
  thickness: number;
}>;

export type PlanarFace = Readonly<{
  id: string;
  vertexIds: readonly string[];
  edges: readonly FaceBoundaryEdge[];
  centerlinePolygon: readonly Point2[];
  signedAreaMm2: number;
}>;

type DirectedHalfEdge = Readonly<{
  id: string;
  atomicIndex: number;
  startVertexId: string;
  endVertexId: string;
  start: Point2;
  end: Point2;
  wallId: string;
  thickness: number;
  angle: number;
}>;

function polygonSignedArea(points: readonly Point2[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function rotate<T>(items: readonly T[], offset: number): T[] {
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function canonicalCycleKey(vertexIds: readonly string[]): string {
  if (vertexIds.length === 0) return "";
  const candidates: string[] = [];
  const forward = [...vertexIds];
  const reverse = [...vertexIds].reverse();
  for (let index = 0; index < vertexIds.length; index += 1) {
    candidates.push(rotate(forward, index).join("|"));
    candidates.push(rotate(reverse, index).join("|"));
  }
  candidates.sort();
  return candidates[0]!;
}

function makeHalfEdges(atomicEdges: readonly AtomicWallEdge[]): DirectedHalfEdge[] {
  return atomicEdges.flatMap((edge, atomicIndex) => {
    const forward: DirectedHalfEdge = {
      id: `${atomicIndex}:forward`,
      atomicIndex,
      startVertexId: edge.startVertexId,
      endVertexId: edge.endVertexId,
      start: edge.start,
      end: edge.end,
      wallId: edge.wallId,
      thickness: edge.thickness,
      angle: Math.atan2(edge.end.y - edge.start.y, edge.end.x - edge.start.x),
    };
    const reverse: DirectedHalfEdge = {
      id: `${atomicIndex}:reverse`,
      atomicIndex,
      startVertexId: edge.endVertexId,
      endVertexId: edge.startVertexId,
      start: edge.end,
      end: edge.start,
      wallId: edge.wallId,
      thickness: edge.thickness,
      angle: Math.atan2(edge.start.y - edge.end.y, edge.start.x - edge.end.x),
    };
    return [forward, reverse];
  });
}

function faceEdge(edge: DirectedHalfEdge): FaceBoundaryEdge {
  return {
    wallId: edge.wallId,
    startVertexId: edge.startVertexId,
    endVertexId: edge.endVertexId,
    start: edge.start,
    end: edge.end,
    thickness: edge.thickness,
  };
}

export function extractPlanarFaces(document: TopologyDocumentLike): PlanarFace[] {
  const atomicEdges = deriveAtomicWallEdges(document);
  if (atomicEdges.length === 0) return [];

  const halfEdges = makeHalfEdges(atomicEdges);
  const outgoing = new Map<string, DirectedHalfEdge[]>();
  for (const edge of halfEdges) {
    const list = outgoing.get(edge.startVertexId) ?? [];
    list.push(edge);
    outgoing.set(edge.startVertexId, list);
  }
  for (const list of outgoing.values()) {
    list.sort((a, b) => a.angle - b.angle || a.id.localeCompare(b.id));
  }

  const byId = new Map(halfEdges.map((edge) => [edge.id, edge]));
  const visited = new Set<string>();
  const facesById = new Map<string, PlanarFace>();
  const maxSteps = halfEdges.length + 1;

  const nextHalfEdge = (current: DirectedHalfEdge): DirectedHalfEdge | null => {
    const candidates = outgoing.get(current.endVertexId);
    if (!candidates?.length) return null;
    const reverseId = `${current.atomicIndex}:${current.id.endsWith("forward") ? "reverse" : "forward"}`;
    const reverseIndex = candidates.findIndex((candidate) => candidate.id === reverseId);
    if (reverseIndex < 0) return null;
    return candidates[(reverseIndex - 1 + candidates.length) % candidates.length] ?? null;
  };

  for (const seed of halfEdges) {
    if (visited.has(seed.id)) continue;

    const cycle: DirectedHalfEdge[] = [];
    const localIndex = new Map<string, number>();
    let current: DirectedHalfEdge | null = seed;
    let closed = false;

    for (let step = 0; step < maxSteps && current; step += 1) {
      const existingIndex = localIndex.get(current.id);
      if (existingIndex !== undefined) {
        closed = current.id === seed.id && existingIndex === 0;
        break;
      }
      localIndex.set(current.id, cycle.length);
      cycle.push(current);
      current = nextHalfEdge(current);
    }

    for (const edge of cycle) visited.add(edge.id);
    if (!closed || cycle.length < 3) continue;

    const polygon = cycle.map((edge) => edge.start);
    const signedAreaMm2 = polygonSignedArea(polygon);
    if (!Number.isFinite(signedAreaMm2) || signedAreaMm2 <= GEOMETRY_EPSILON_MM) continue;

    const vertexIds = cycle.map((edge) => edge.startVertexId);
    const id = `room-face:${canonicalCycleKey(vertexIds)}`;
    if (facesById.has(id)) continue;

    facesById.set(id, {
      id,
      vertexIds,
      edges: cycle.map(faceEdge),
      centerlinePolygon: polygon,
      signedAreaMm2,
    });
  }

  return [...facesById.values()].sort((a, b) => a.id.localeCompare(b.id));
}
