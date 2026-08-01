import { polygonSelfIntersects, signedPolygonArea } from "@vlezet/geometry";

export type BenchmarkPointMm = Readonly<{ x: number; y: number }>;
export type BenchmarkTagV1 =
  | "clean"
  | "calibrated"
  | "multi-room"
  | "openings-heavy"
  | "labels-and-areas"
  | "furniture-heavy"
  | "low-resolution"
  | "perspective"
  | "regression"
  | "cloud-snapshot";

export type BenchmarkProvenanceV1 = Readonly<{
  kind: "synthetic" | "redrawn-anonymized" | "licensed";
  note: string;
  license: string | null;
}>;

export type BenchmarkSourceAssetV1 = Readonly<{
  fileName: string;
  sha256: string;
  cloudResponseFileName: string | null;
}>;

export type BenchmarkCalibrationV1 = Readonly<{
  sourceWidthPx: number;
  sourceHeightPx: number;
  millimetersPerPixel: number;
  originPx: BenchmarkPointMm;
}>;

export type BenchmarkTolerancesV1 = Readonly<{
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

export type BenchmarkJunctionV1 = Readonly<{
  id: string;
  positionMm: BenchmarkPointMm;
}>;

export type BenchmarkWallV1 = Readonly<{
  id: string;
  startMm: BenchmarkPointMm;
  endMm: BenchmarkPointMm;
  thicknessMm: number | null;
  kind: "external" | "partition" | "unknown";
  startJunctionId: string;
  endJunctionId: string;
}>;

export type BenchmarkDoorSwingV1 = Readonly<{
  hinge: "start" | "end";
  side: "left" | "right";
}>;

export type BenchmarkOpeningV1 = Readonly<{
  id: string;
  kind: "door" | "window";
  hostWallId: string;
  centerMm: BenchmarkPointMm;
  widthMm: number;
  orientationDeg: number | null;
  swing: BenchmarkDoorSwingV1 | null;
}>;

export type BenchmarkRoomClassificationV1 =
  | "living"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "corridor"
  | "balcony"
  | "storage"
  | "other"
  | "unknown";

export type BenchmarkRoomV1 = Readonly<{
  id: string;
  polygonMm: readonly BenchmarkPointMm[];
  name: string | null;
  classification: BenchmarkRoomClassificationV1;
  statedAreaM2: number | null;
  computedAreaM2: number;
}>;

export type BenchmarkRoomLabelV1 = Readonly<{
  id: string;
  text: string;
  anchorMm: BenchmarkPointMm;
  roomId: string;
}>;

export type BenchmarkMetricApplicabilityV1 = Readonly<{
  wallGeometry: boolean;
  wallTopology: boolean;
  openings: boolean;
  rooms: boolean;
  roomLabels: boolean;
  roomAreas: boolean;
  totalArea: boolean;
  confidence: boolean;
}>;

export type RecognitionBenchmarkFixtureV1 = Readonly<{
  schemaVersion: "recognition-benchmark-fixture-v1";
  id: string;
  description: string;
  provenance: BenchmarkProvenanceV1;
  tags: readonly BenchmarkTagV1[];
  source: BenchmarkSourceAssetV1;
  calibration: BenchmarkCalibrationV1;
  tolerances: BenchmarkTolerancesV1;
  expectedJunctions: readonly BenchmarkJunctionV1[];
  expectedWalls: readonly BenchmarkWallV1[];
  expectedOpenings: readonly BenchmarkOpeningV1[];
  expectedRooms: readonly BenchmarkRoomV1[];
  expectedLabels: readonly BenchmarkRoomLabelV1[];
  statedTotalAreaM2: number | null;
  metricApplicability: BenchmarkMetricApplicabilityV1;
}>;

export class RecognitionBenchmarkFixtureValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecognitionBenchmarkFixtureValidationError";
  }
}

const TAGS = [
  "clean", "calibrated", "multi-room", "openings-heavy", "labels-and-areas",
  "furniture-heavy", "low-resolution", "perspective", "regression", "cloud-snapshot",
] as const;
const ROOM_CLASSIFICATIONS = [
  "living", "bedroom", "kitchen", "bathroom", "corridor", "balcony", "storage", "other", "unknown",
] as const;
const SCHEMA_POINT_TOLERANCE_MM = 0.001;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecognitionBenchmarkFixtureValidationError(`${label} должен быть объектом.`);
  }
  return value as Record<string, unknown>;
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new RecognitionBenchmarkFixtureValidationError(`${label} должен быть списком.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RecognitionBenchmarkFixtureValidationError(`${label} должен быть непустой строкой.`);
  }
  return value.trim();
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RecognitionBenchmarkFixtureValidationError(`${label} должен быть конечным числом.`);
  }
  return value;
}

function positive(value: unknown, label: string): number {
  const result = finite(value, label);
  if (result <= 0) throw new RecognitionBenchmarkFixtureValidationError(`${label} должен быть больше нуля.`);
  return result;
}

function nonNegative(value: unknown, label: string): number {
  const result = finite(value, label);
  if (result < 0) throw new RecognitionBenchmarkFixtureValidationError(`${label} не может быть отрицательным.`);
  return result;
}

function ratio(value: unknown, label: string): number {
  const result = finite(value, label);
  if (result < 0 || result > 1) throw new RecognitionBenchmarkFixtureValidationError(`${label} должен быть от 0 до 1.`);
  return result;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new RecognitionBenchmarkFixtureValidationError(`${label} должен быть логическим значением.`);
  return value;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new RecognitionBenchmarkFixtureValidationError(`${label} содержит неподдерживаемое значение.`);
  }
  return value as T;
}

function point(value: unknown, label: string): BenchmarkPointMm {
  const input = record(value, label);
  return { x: finite(input.x, `${label}.x`), y: finite(input.y, `${label}.y`) };
}

function uniqueIds<T extends { readonly id: string }>(items: readonly T[], label: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new RecognitionBenchmarkFixtureValidationError(`${label} содержит повторяющийся id ${item.id}.`);
    ids.add(item.id);
  }
}

function samePoint(first: BenchmarkPointMm, second: BenchmarkPointMm): boolean {
  return Math.hypot(first.x - second.x, first.y - second.y) <= SCHEMA_POINT_TOLERANCE_MM;
}

function validateSource(value: unknown): BenchmarkSourceAssetV1 {
  const input = record(value, "source");
  const fileName = text(input.fileName, "source.fileName");
  if (!/^[a-z0-9][a-z0-9._-]*\.png$/i.test(fileName) || fileName.includes("..") || fileName.includes("/")) {
    throw new RecognitionBenchmarkFixtureValidationError("source.fileName должен ссылаться на локальный PNG-файл.");
  }
  const sha256 = text(input.sha256, "source.sha256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new RecognitionBenchmarkFixtureValidationError("source.sha256 должен быть SHA-256 в hex.");
  const cloudResponseFileName = nullableText(input.cloudResponseFileName, "source.cloudResponseFileName");
  if (cloudResponseFileName && cloudResponseFileName !== "cloud-response.json") {
    throw new RecognitionBenchmarkFixtureValidationError("Поддерживается только cloud-response.json.");
  }
  return { fileName, sha256, cloudResponseFileName };
}

function validateCalibration(value: unknown): BenchmarkCalibrationV1 {
  const input = record(value, "calibration");
  return {
    sourceWidthPx: positive(input.sourceWidthPx, "calibration.sourceWidthPx"),
    sourceHeightPx: positive(input.sourceHeightPx, "calibration.sourceHeightPx"),
    millimetersPerPixel: positive(input.millimetersPerPixel, "calibration.millimetersPerPixel"),
    originPx: point(input.originPx, "calibration.originPx"),
  };
}

function validateTolerances(value: unknown): BenchmarkTolerancesV1 {
  const input = record(value, "tolerances");
  return {
    wallEndpointMm: positive(input.wallEndpointMm, "tolerances.wallEndpointMm"),
    wallOrientationDeg: positive(input.wallOrientationDeg, "tolerances.wallOrientationDeg"),
    wallMinimumOverlapRatio: ratio(input.wallMinimumOverlapRatio, "tolerances.wallMinimumOverlapRatio"),
    wallLengthRelativeError: ratio(input.wallLengthRelativeError, "tolerances.wallLengthRelativeError"),
    junctionMm: positive(input.junctionMm, "tolerances.junctionMm"),
    openingCenterMm: positive(input.openingCenterMm, "tolerances.openingCenterMm"),
    openingWidthMm: positive(input.openingWidthMm, "tolerances.openingWidthMm"),
    roomMinimumIoU: ratio(input.roomMinimumIoU, "tolerances.roomMinimumIoU"),
    labelAnchorMm: positive(input.labelAnchorMm, "tolerances.labelAnchorMm"),
  };
}

function validateMetricApplicability(value: unknown): BenchmarkMetricApplicabilityV1 {
  const input = record(value, "metricApplicability");
  return {
    wallGeometry: boolean(input.wallGeometry, "metricApplicability.wallGeometry"),
    wallTopology: boolean(input.wallTopology, "metricApplicability.wallTopology"),
    openings: boolean(input.openings, "metricApplicability.openings"),
    rooms: boolean(input.rooms, "metricApplicability.rooms"),
    roomLabels: boolean(input.roomLabels, "metricApplicability.roomLabels"),
    roomAreas: boolean(input.roomAreas, "metricApplicability.roomAreas"),
    totalArea: boolean(input.totalArea, "metricApplicability.totalArea"),
    confidence: boolean(input.confidence, "metricApplicability.confidence"),
  };
}

export function validateRecognitionBenchmarkFixtureV1(value: unknown): RecognitionBenchmarkFixtureV1 {
  const input = record(value, "fixture");
  if (input.schemaVersion !== "recognition-benchmark-fixture-v1") {
    throw new RecognitionBenchmarkFixtureValidationError("Неподдерживаемая версия fixture schema.");
  }

  const provenanceInput = record(input.provenance, "provenance");
  const provenance: BenchmarkProvenanceV1 = {
    kind: oneOf(provenanceInput.kind, ["synthetic", "redrawn-anonymized", "licensed"] as const, "provenance.kind"),
    note: text(provenanceInput.note, "provenance.note"),
    license: nullableText(provenanceInput.license, "provenance.license"),
  };
  if (provenance.kind === "licensed" && !provenance.license) {
    throw new RecognitionBenchmarkFixtureValidationError("Licensed fixture требует provenance.license.");
  }

  const tags = list(input.tags, "tags").map((entry, index) => oneOf(entry, TAGS, `tags[${index}]`));
  if (new Set(tags).size !== tags.length) throw new RecognitionBenchmarkFixtureValidationError("tags содержит повторы.");

  const expectedJunctions = list(input.expectedJunctions, "expectedJunctions").map((entry, index): BenchmarkJunctionV1 => {
    const item = record(entry, `expectedJunctions[${index}]`);
    return { id: text(item.id, `expectedJunctions[${index}].id`), positionMm: point(item.positionMm, `expectedJunctions[${index}].positionMm`) };
  });
  uniqueIds(expectedJunctions, "expectedJunctions");
  const junctions = new Map(expectedJunctions.map((entry) => [entry.id, entry.positionMm]));

  const expectedWalls = list(input.expectedWalls, "expectedWalls").map((entry, index): BenchmarkWallV1 => {
    const item = record(entry, `expectedWalls[${index}]`);
    const startMm = point(item.startMm, `expectedWalls[${index}].startMm`);
    const endMm = point(item.endMm, `expectedWalls[${index}].endMm`);
    if (Math.hypot(endMm.x - startMm.x, endMm.y - startMm.y) <= SCHEMA_POINT_TOLERANCE_MM) {
      throw new RecognitionBenchmarkFixtureValidationError(`expectedWalls[${index}] имеет нулевую длину.`);
    }
    const thicknessMm = item.thicknessMm === null ? null : positive(item.thicknessMm, `expectedWalls[${index}].thicknessMm`);
    return {
      id: text(item.id, `expectedWalls[${index}].id`),
      startMm,
      endMm,
      thicknessMm,
      kind: oneOf(item.kind, ["external", "partition", "unknown"] as const, `expectedWalls[${index}].kind`),
      startJunctionId: text(item.startJunctionId, `expectedWalls[${index}].startJunctionId`),
      endJunctionId: text(item.endJunctionId, `expectedWalls[${index}].endJunctionId`),
    };
  });
  uniqueIds(expectedWalls, "expectedWalls");
  for (const wall of expectedWalls) {
    const start = junctions.get(wall.startJunctionId);
    const end = junctions.get(wall.endJunctionId);
    if (!start || !end) throw new RecognitionBenchmarkFixtureValidationError(`Стена ${wall.id} ссылается на неизвестный junction.`);
    if (!samePoint(wall.startMm, start) || !samePoint(wall.endMm, end)) {
      throw new RecognitionBenchmarkFixtureValidationError(`Координаты стены ${wall.id} не согласованы с junction.`);
    }
  }
  const wallIds = new Set(expectedWalls.map((entry) => entry.id));

  const expectedOpenings = list(input.expectedOpenings, "expectedOpenings").map((entry, index): BenchmarkOpeningV1 => {
    const item = record(entry, `expectedOpenings[${index}]`);
    const kind = oneOf(item.kind, ["door", "window"] as const, `expectedOpenings[${index}].kind`);
    const swing = item.swing === null ? null : (() => {
      const value = record(item.swing, `expectedOpenings[${index}].swing`);
      return {
        hinge: oneOf(value.hinge, ["start", "end"] as const, `expectedOpenings[${index}].swing.hinge`),
        side: oneOf(value.side, ["left", "right"] as const, `expectedOpenings[${index}].swing.side`),
      } satisfies BenchmarkDoorSwingV1;
    })();
    if (kind === "window" && swing) throw new RecognitionBenchmarkFixtureValidationError("Окно не может иметь door swing.");
    const hostWallId = text(item.hostWallId, `expectedOpenings[${index}].hostWallId`);
    if (!wallIds.has(hostWallId)) throw new RecognitionBenchmarkFixtureValidationError(`Проём ссылается на неизвестную стену ${hostWallId}.`);
    return {
      id: text(item.id, `expectedOpenings[${index}].id`),
      kind,
      hostWallId,
      centerMm: point(item.centerMm, `expectedOpenings[${index}].centerMm`),
      widthMm: positive(item.widthMm, `expectedOpenings[${index}].widthMm`),
      orientationDeg: item.orientationDeg === null ? null : finite(item.orientationDeg, `expectedOpenings[${index}].orientationDeg`),
      swing,
    };
  });
  uniqueIds(expectedOpenings, "expectedOpenings");

  const expectedRooms = list(input.expectedRooms, "expectedRooms").map((entry, index): BenchmarkRoomV1 => {
    const item = record(entry, `expectedRooms[${index}]`);
    const polygonMm = list(item.polygonMm, `expectedRooms[${index}].polygonMm`).map((entry, pointIndex) => point(entry, `expectedRooms[${index}].polygonMm[${pointIndex}]`));
    if (polygonMm.length < 3) throw new RecognitionBenchmarkFixtureValidationError("Комната должна иметь минимум три вершины.");
    if (polygonSelfIntersects(polygonMm)) throw new RecognitionBenchmarkFixtureValidationError("Полигон комнаты самопересекается.");
    const areaM2 = Math.abs(signedPolygonArea(polygonMm)) / 1_000_000;
    if (areaM2 <= 0) throw new RecognitionBenchmarkFixtureValidationError("Полигон комнаты должен иметь положительную площадь.");
    const computedAreaM2 = positive(item.computedAreaM2, `expectedRooms[${index}].computedAreaM2`);
    if (Math.abs(areaM2 - computedAreaM2) > 0.001) throw new RecognitionBenchmarkFixtureValidationError("computedAreaM2 не согласована с полигоном.");
    return {
      id: text(item.id, `expectedRooms[${index}].id`),
      polygonMm,
      name: nullableText(item.name, `expectedRooms[${index}].name`),
      classification: oneOf(item.classification, ROOM_CLASSIFICATIONS, `expectedRooms[${index}].classification`),
      statedAreaM2: item.statedAreaM2 === null ? null : positive(item.statedAreaM2, `expectedRooms[${index}].statedAreaM2`),
      computedAreaM2,
    };
  });
  uniqueIds(expectedRooms, "expectedRooms");
  const roomIds = new Set(expectedRooms.map((entry) => entry.id));

  const expectedLabels = list(input.expectedLabels, "expectedLabels").map((entry, index): BenchmarkRoomLabelV1 => {
    const item = record(entry, `expectedLabels[${index}]`);
    const roomId = text(item.roomId, `expectedLabels[${index}].roomId`);
    if (!roomIds.has(roomId)) throw new RecognitionBenchmarkFixtureValidationError(`Label ссылается на неизвестную комнату ${roomId}.`);
    return {
      id: text(item.id, `expectedLabels[${index}].id`),
      text: text(item.text, `expectedLabels[${index}].text`),
      anchorMm: point(item.anchorMm, `expectedLabels[${index}].anchorMm`),
      roomId,
    };
  });
  uniqueIds(expectedLabels, "expectedLabels");

  const metricApplicability = validateMetricApplicability(input.metricApplicability);
  const statedTotalAreaM2 = input.statedTotalAreaM2 === null ? null : positive(input.statedTotalAreaM2, "statedTotalAreaM2");
  if ((metricApplicability.wallGeometry || metricApplicability.wallTopology) && expectedWalls.length === 0) {
    throw new RecognitionBenchmarkFixtureValidationError("Включённые wall metrics требуют expectedWalls.");
  }
  if (metricApplicability.wallTopology && expectedJunctions.length === 0) {
    throw new RecognitionBenchmarkFixtureValidationError("wallTopology требует expectedJunctions.");
  }
  if (metricApplicability.openings && expectedOpenings.length === 0) {
    throw new RecognitionBenchmarkFixtureValidationError("openings metric требует expectedOpenings.");
  }
  if ((metricApplicability.rooms || metricApplicability.roomAreas) && expectedRooms.length === 0) {
    throw new RecognitionBenchmarkFixtureValidationError("Room metrics требуют expectedRooms.");
  }
  if (metricApplicability.roomLabels && expectedLabels.length === 0) {
    throw new RecognitionBenchmarkFixtureValidationError("roomLabels metric требует expectedLabels.");
  }
  if (metricApplicability.totalArea && statedTotalAreaM2 === null) {
    throw new RecognitionBenchmarkFixtureValidationError("totalArea metric требует statedTotalAreaM2.");
  }
  if (metricApplicability.confidence && expectedWalls.length + expectedOpenings.length + expectedRooms.length === 0) {
    throw new RecognitionBenchmarkFixtureValidationError("confidence metric требует ground truth entities.");
  }

  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: text(input.id, "id"),
    description: text(input.description, "description"),
    provenance,
    tags,
    source: validateSource(input.source),
    calibration: validateCalibration(input.calibration),
    tolerances: validateTolerances(input.tolerances),
    expectedJunctions,
    expectedWalls,
    expectedOpenings,
    expectedRooms,
    expectedLabels,
    statedTotalAreaM2,
    metricApplicability,
  };
}
