export type RealAnaloguePoint = Readonly<{ x: number; y: number }>;

export type RealAnalogueWall = Readonly<{
  id: string;
  startMm: RealAnaloguePoint;
  endMm: RealAnaloguePoint;
  thicknessMm: number;
  kind: "external" | "partition" | "balcony-boundary" | "unknown-structural";
}>;

export type RealAnalogueOpening = Readonly<{
  id: string;
  kind: "door" | "window";
  hostWallId: string;
  centerMm: RealAnaloguePoint;
  widthMm: number;
  orientationDeg: number;
  swing: string | null;
}>;

export type RealAnalogueFailureExpectation = Readonly<{
  mustDetect: readonly Readonly<{ kind: string; id: string }>[];
  mustNotDetectRegions: readonly Readonly<{
    id: string;
    kind: string;
    polygonNormalized: readonly RealAnaloguePoint[];
    reason: string;
  }>[];
  knownAmbiguities: readonly unknown[];
}>;

export type RealAnalogueDefinition = Readonly<{
  schemaVersion: "recognition-real-analogue-source-v1";
  id: string;
  privateSourceId: string;
  privateSourceSha256: string;
  description: string;
  provenance: Readonly<{
    kind: "redrawn-anonymized";
    note: string;
    license: null;
  }>;
  tags: readonly string[];
  sourceWidthPx: number;
  sourceHeightPx: number;
  millimetersPerPixel: number;
  walls: readonly RealAnalogueWall[];
  openings: readonly RealAnalogueOpening[];
  decorations: readonly Readonly<Record<string, unknown>>[];
  rooms: readonly Readonly<Record<string, unknown>>[];
  metricApplicability: Readonly<{
    wallGeometry: boolean;
    wallTopology: boolean;
    openings: boolean;
    rooms: boolean;
    roomLabels: boolean;
    roomAreas: boolean;
    totalArea: boolean;
    confidence: boolean;
  }>;
  failureExpectations: RealAnalogueFailureExpectation;
}>;

export const realAnalogueDefinitions: readonly RealAnalogueDefinition[];
