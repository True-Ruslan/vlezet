import { describe, expect, it } from "vitest";
import { deriveCanvasFeedback, type CanvasFeedbackInput } from "./editor-canvas-feedback";

const base: CanvasFeedbackInput = {
  viewMode: "2d",
  recognitionReviewActive: false,
  tracingMode: false,
  placementPresetId: null,
  placementPreviewValid: null,
  measurementActive: false,
  measurementPhase: "idle",
  tool: "select",
  hasWallDraft: false,
  openingPreviewValid: null,
  hoveredSelectable: false,
  panState: "idle",
};

function feedback(patch: Partial<CanvasFeedbackInput>) {
  return deriveCanvasFeedback({ ...base, ...patch });
}

describe("M7.4 Canvas mode feedback", () => {
  it("prioritises spatial and bounded review modes over ordinary tools", () => {
    expect(feedback({ viewMode: "3d", recognitionReviewActive: true, tool: "wall" })).toMatchObject({
      mode: "spatial",
      label: "3D · только просмотр",
      cursor: "default",
    });
    expect(feedback({ recognitionReviewActive: true, tracingMode: true, placementPresetId: "chair" })).toMatchObject({
      mode: "recognition-review",
      label: "Проверка распознавания",
      cursor: "pointer",
    });
    expect(feedback({ tracingMode: true, placementPresetId: "chair" })).toMatchObject({
      mode: "tracing",
      label: "Обводка",
      cursor: "crosshair",
    });
  });

  it("describes furniture placement validity without relying on colour", () => {
    expect(feedback({ placementPresetId: "chair", placementPreviewValid: true })).toEqual({
      mode: "place-object",
      label: "Размещение мебели",
      instruction: "Выберите место для предмета.",
      escapeInstruction: "Esc — отменить размещение.",
      cursor: "copy",
      previewState: "valid",
    });
    expect(feedback({ placementPresetId: "chair", placementPreviewValid: false })).toMatchObject({
      mode: "place-object",
      instruction: "Это место недопустимо. Переместите предмет.",
      cursor: "not-allowed",
      previewState: "invalid",
    });
  });

  it("distinguishes all measurement phases", () => {
    expect(feedback({ measurementActive: true, measurementPhase: "idle" })).toMatchObject({
      mode: "measure-start",
      label: "Измерить",
      instruction: "Укажите первую точку.",
    });
    expect(feedback({ measurementActive: true, measurementPhase: "measuring" })).toMatchObject({
      mode: "measure-finish",
      label: "Измерить · вторая точка",
      instruction: "Укажите вторую точку.",
      escapeInstruction: "Esc — сбросить текущий замер.",
    });
    expect(feedback({ measurementActive: true, measurementPhase: "complete" })).toMatchObject({
      mode: "measure-complete",
      label: "Измерение готово",
      instruction: "Кликните, чтобы начать новый замер.",
      escapeInstruction: "Esc — очистить результат.",
    });
  });

  it("distinguishes first and second wall points", () => {
    expect(feedback({ tool: "wall" })).toMatchObject({
      mode: "wall-start",
      label: "Стена",
      instruction: "Укажите первую точку стены.",
      cursor: "crosshair",
    });
    expect(feedback({ tool: "wall", hasWallDraft: true })).toMatchObject({
      mode: "wall-finish",
      label: "Стена · вторая точка",
      instruction: "Укажите вторую точку стены.",
      escapeInstruction: "Esc — отменить текущий отрезок.",
    });
  });

  it("reports opening preview validity", () => {
    expect(feedback({ tool: "door", openingPreviewValid: null })).toMatchObject({
      mode: "door",
      instruction: "Наведите на стену.",
      cursor: "crosshair",
      previewState: "none",
    });
    expect(feedback({ tool: "window", openingPreviewValid: true })).toMatchObject({
      mode: "window",
      instruction: "Кликните, чтобы добавить окно.",
      previewState: "valid",
    });
    expect(feedback({ tool: "door", openingPreviewValid: false })).toMatchObject({
      mode: "door",
      instruction: "Здесь проём разместить нельзя.",
      previewState: "invalid",
    });
  });

  it("uses pointer only for selectable hover and preserves pan priority", () => {
    expect(feedback({ hoveredSelectable: true })).toMatchObject({ mode: "select", cursor: "pointer" });
    expect(feedback({ panState: "ready", hoveredSelectable: true })).toMatchObject({ cursor: "grab" });
    expect(feedback({ panState: "active", tool: "wall" })).toMatchObject({ cursor: "grabbing" });
  });
});
