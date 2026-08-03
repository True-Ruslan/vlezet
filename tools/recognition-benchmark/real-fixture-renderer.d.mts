import type { RealAnalogueDefinition } from "../../packages/recognition/benchmarks/real-analogues/source-definitions.mjs";

export type RealSegment = Readonly<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}>;

export type RealSegmentsSnapshot = Readonly<{
  schemaVersion: "recognition-segments-v1";
  widthPx: number;
  heightPx: number;
  segments: readonly RealSegment[];
}>;

export const REAL_FIXTURE_TOLERANCES: Readonly<{
  wallEndpointMm: number;
  wallOrientationDeg: number;
  wallMinimumOverlapRatio: number;
  wallLengthRelativeError: number;
  junctionMm: number;
  openingCenterMm: number;
  openingWidthMm: number;
  roomMinimumIoU: number;
  labelAnchorMm: number;
}>;

export function sha256(buffer: Uint8Array): string;
export function renderRealFixtureSvg(definition: RealAnalogueDefinition): string;
export function buildRealFixtureJson(definition: RealAnalogueDefinition, sourceHash: string): unknown;
export function buildRealSegmentsSnapshot(definition: RealAnalogueDefinition): RealSegmentsSnapshot;
