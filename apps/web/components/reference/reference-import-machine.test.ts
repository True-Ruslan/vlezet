import { describe, expect, it } from "vitest";
import { EMPTY_CALIBRATION_DRAFT, reduceReferenceImport } from "./reference-import-machine";

const raster = {
  blob: new Blob([new Uint8Array([1])], { type: "image/png" }),
  mimeType: "image/png" as const,
  widthPx: 1000,
  heightPx: 800,
};

describe("reference import state machine", () => {
  it("moves through file, PDF page and calibration states explicitly", () => {
    let state = reduceReferenceImport({ kind: "idle" }, { type: "choose-file", fileName: "plan.pdf" });
    expect(state).toEqual({ kind: "reading-file", fileName: "plan.pdf" });
    state = reduceReferenceImport(state, { type: "pdf-loaded", fileName: "plan.pdf", pageCount: 4 });
    expect(state).toMatchObject({ kind: "selecting-pdf-page", selectedPage: 1, pageCount: 4 });
    state = reduceReferenceImport(state, { type: "select-pdf-page", pageNumber: 3 });
    expect(state).toMatchObject({ selectedPage: 3 });
    state = reduceReferenceImport(state, { type: "raster-ready", fileName: "plan.pdf", raster, source: "pdf", pageNumber: 3, pageCount: 4 });
    expect(state).toMatchObject({ kind: "calibrating", draft: EMPTY_CALIBRATION_DRAFT, pageNumber: 3 });
  });

  it("keeps invalid page selections unchanged and cancel returns to idle", () => {
    const selecting = { kind: "selecting-pdf-page" as const, fileName: "p.pdf", pageCount: 2, selectedPage: 1 };
    expect(reduceReferenceImport(selecting, { type: "select-pdf-page", pageNumber: 9 })).toEqual(selecting);
    expect(reduceReferenceImport(selecting, { type: "cancel" })).toEqual({ kind: "idle" });
  });

  it("updates calibration immutably and reports product-safe failures", () => {
    const calibrating = reduceReferenceImport({ kind: "idle" }, { type: "raster-ready", fileName: "p.png", raster, source: "png" });
    const updated = reduceReferenceImport(calibrating, { type: "update-calibration", patch: { pointA: { x: 10, y: 20 }, lengthInput: "3200" } });
    expect(updated).toMatchObject({ kind: "calibrating", draft: { pointA: { x: 10, y: 20 }, lengthInput: "3200" } });
    expect(calibrating).toMatchObject({ kind: "calibrating", draft: { pointA: null, lengthInput: "" } });
    expect(reduceReferenceImport(updated, { type: "failed", code: "storage-failed", message: "Не сохранено" })).toEqual({ kind: "failed", code: "storage-failed", message: "Не сохранено" });
  });
});
