export type ValidationResult = Readonly<{
  valid: boolean;
  errors: string[];
}>;

export type PrivateSourceManifest = Readonly<{
  schemaVersion: string;
  batchId: string;
  sources: readonly Readonly<{
    sourceId: string;
    sha256: string;
    widthPx: number;
    heightPx: number;
    mediaType: string;
    tags: readonly string[];
    annotationStatus: string;
    redistribution: string;
  }>[];
}>;

export type FailureGeometryIndex = Readonly<{
  wallIds: ReadonlySet<string>;
  openingIds: ReadonlySet<string>;
}>;

export function validatePrivateSourceManifest(value: unknown): ValidationResult;

export function validateAnalogueManifest(
  value: unknown,
  privateManifest: PrivateSourceManifest,
): ValidationResult;

export function validateFailureExpectations(
  value: unknown,
  geometry: FailureGeometryIndex,
): ValidationResult;
