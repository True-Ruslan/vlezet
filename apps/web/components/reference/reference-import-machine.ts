import type { Point2 } from "@vlezet/geometry";
import type { ReferenceAlignment } from "@vlezet/projects";
import type { NormalizedReferenceRaster } from "./raster-normalizer";
import type { ReferenceImportErrorCode, ReferenceFileType } from "./reference-file";

export type CalibrationDraft = Readonly<{
  pointA: Point2 | null;
  pointB: Point2 | null;
  lengthInput: string;
  alignment: ReferenceAlignment;
}>;

export type ReferenceImportState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "reading-file"; fileName: string }>
  | Readonly<{ kind: "selecting-pdf-page"; fileName: string; pageCount: number; selectedPage: number }>
  | Readonly<{ kind: "normalizing"; fileName: string; progressLabel: string }>
  | Readonly<{ kind: "calibrating"; fileName: string; raster: NormalizedReferenceRaster; source: ReferenceFileType; pageNumber?: number; pageCount?: number; draft: CalibrationDraft }>
  | Readonly<{ kind: "saving"; fileName: string }>
  | Readonly<{ kind: "ready" }>
  | Readonly<{ kind: "failed"; code: ReferenceImportErrorCode; message: string }>;

export type ReferenceImportEvent =
  | Readonly<{ type: "choose-file"; fileName: string }>
  | Readonly<{ type: "pdf-loaded"; fileName: string; pageCount: number }>
  | Readonly<{ type: "select-pdf-page"; pageNumber: number }>
  | Readonly<{ type: "normalizing"; fileName: string; progressLabel: string }>
  | Readonly<{ type: "raster-ready"; fileName: string; raster: NormalizedReferenceRaster; source: ReferenceFileType; pageNumber?: number; pageCount?: number }>
  | Readonly<{ type: "update-calibration"; patch: Partial<CalibrationDraft> }>
  | Readonly<{ type: "saving" }>
  | Readonly<{ type: "saved" }>
  | Readonly<{ type: "failed"; code: ReferenceImportErrorCode; message: string }>
  | Readonly<{ type: "cancel" }>
  | Readonly<{ type: "reset" }>;

export const EMPTY_CALIBRATION_DRAFT: CalibrationDraft = Object.freeze({
  pointA: null,
  pointB: null,
  lengthInput: "",
  alignment: "horizontal",
});

export function reduceReferenceImport(state: ReferenceImportState, event: ReferenceImportEvent): ReferenceImportState {
  switch (event.type) {
    case "choose-file": return { kind: "reading-file", fileName: event.fileName };
    case "pdf-loaded": return { kind: "selecting-pdf-page", fileName: event.fileName, pageCount: event.pageCount, selectedPage: 1 };
    case "select-pdf-page":
      if (state.kind !== "selecting-pdf-page" || event.pageNumber < 1 || event.pageNumber > state.pageCount) return state;
      return { ...state, selectedPage: event.pageNumber };
    case "normalizing": return { kind: "normalizing", fileName: event.fileName, progressLabel: event.progressLabel };
    case "raster-ready": return {
      kind: "calibrating",
      fileName: event.fileName,
      raster: event.raster,
      source: event.source,
      ...(event.pageNumber === undefined ? {} : { pageNumber: event.pageNumber }),
      ...(event.pageCount === undefined ? {} : { pageCount: event.pageCount }),
      draft: EMPTY_CALIBRATION_DRAFT,
    };
    case "update-calibration":
      return state.kind === "calibrating" ? { ...state, draft: { ...state.draft, ...event.patch } } : state;
    case "saving": return state.kind === "calibrating" ? { kind: "saving", fileName: state.fileName } : state;
    case "saved": return { kind: "ready" };
    case "failed": return { kind: "failed", code: event.code, message: event.message };
    case "cancel":
    case "reset": return { kind: "idle" };
  }
}
