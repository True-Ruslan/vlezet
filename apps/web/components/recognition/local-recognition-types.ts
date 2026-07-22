import type { RecognitionDraft } from "@vlezet/recognition";

export type LocalRecognitionPhase = "prepare" | "edges" | "lines" | "walls" | "openings" | "complete";

export type LocalRecognitionInput = Readonly<{
  imageData: ImageData;
  sourceWidthPx?: number;
  sourceHeightPx?: number;
  sourceMillimetersPerPixel?: number;
  projectId: string;
  referenceAssetId: string;
  referenceRevision: string;
  now: string;
}>;

export type MaterializedLocalRecognitionInput = Omit<LocalRecognitionInput, "sourceWidthPx" | "sourceHeightPx" | "sourceMillimetersPerPixel"> & Readonly<{
  sourceWidthPx: number;
  sourceHeightPx: number;
  sourceMillimetersPerPixel: number | null;
}>;

export type LocalRecognitionProgress = Readonly<{
  phase: LocalRecognitionPhase;
  progress: number;
}>;

export type RecognitionWorkerRequest = Readonly<{
  type: "recognize";
  requestId: string;
  input: MaterializedLocalRecognitionInput;
}>;

export type RecognitionWorkerMessage =
  | Readonly<{ type: "progress"; requestId: string; progress: LocalRecognitionProgress }>
  | Readonly<{ type: "result"; requestId: string; draft: RecognitionDraft }>
  | Readonly<{ type: "error"; requestId: string; message: string }>;
