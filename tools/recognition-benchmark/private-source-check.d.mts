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

export type PrivateSourceCheckReport = Readonly<{
  verified: number;
  sourceIds: string[];
  filesScanned: number;
}>;

export type PrivateSourceLeakReport = Readonly<{
  filesScanned: number;
  leaks: Array<Readonly<{ sourceId: string; path: string }>>;
}>;

export function verifyPrivateSourceDirectory(input: Readonly<{
  root: string;
  manifest: PrivateSourceManifest;
}>): Promise<PrivateSourceCheckReport>;

export function assertNoPrivateSourceBytes(input: Readonly<{
  repositoryRoot: string;
  manifest: PrivateSourceManifest;
}>): Promise<PrivateSourceLeakReport>;
