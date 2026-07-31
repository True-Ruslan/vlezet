export type CanvasFeedbackMode =
  | "select"
  | "wall-start"
  | "wall-finish"
  | "door"
  | "window"
  | "measure-start"
  | "measure-finish"
  | "measure-complete"
  | "place-object"
  | "tracing"
  | "recognition-review"
  | "spatial";

export type CanvasCursorRole =
  | "default"
  | "pointer"
  | "crosshair"
  | "copy"
  | "not-allowed"
  | "grab"
  | "grabbing";

export type CanvasPreviewState = "none" | "valid" | "invalid";

export type CanvasFeedbackInput = Readonly<{
  viewMode: "2d" | "3d";
  recognitionReviewActive: boolean;
  tracingMode: boolean;
  placementPresetId: string | null;
  placementPreviewValid: boolean | null;
  measurementActive: boolean;
  measurementPhase: "idle" | "measuring" | "complete";
  tool: "select" | "wall" | "door" | "window";
  hasWallDraft: boolean;
  openingPreviewValid: boolean | null;
  hoveredSelectable: boolean;
  panState: "idle" | "ready" | "active";
}>;

export type CanvasFeedback = Readonly<{
  mode: CanvasFeedbackMode;
  label: string;
  instruction: string;
  escapeInstruction: string | null;
  cursor: CanvasCursorRole;
  previewState: CanvasPreviewState;
}>;

function previewState(valid: boolean | null): CanvasPreviewState {
  if (valid === null) return "none";
  return valid ? "valid" : "invalid";
}

function withPanCursor(input: CanvasFeedbackInput, feedback: CanvasFeedback): CanvasFeedback {
  if (input.panState === "active") return { ...feedback, cursor: "grabbing" };
  if (input.panState === "ready") return { ...feedback, cursor: "grab" };
  return feedback;
}

export function deriveCanvasFeedback(input: CanvasFeedbackInput): CanvasFeedback {
  let feedback: CanvasFeedback;

  if (input.viewMode === "3d") {
    feedback = {
      mode: "spatial",
      label: "3D · только просмотр",
      instruction: "Осматривайте ту же модель. Редактирование доступно в 2D.",
      escapeInstruction: "Esc — вернуться в 2D.",
      cursor: "default",
      previewState: "none",
    };
  } else if (input.recognitionReviewActive) {
    feedback = {
      mode: "recognition-review",
      label: "Проверка распознавания",
      instruction: "Выберите предложение и проверьте его перед применением.",
      escapeInstruction: "Esc — вернуться к предыдущему контексту.",
      cursor: "pointer",
      previewState: "none",
    };
  } else if (input.tracingMode) {
    feedback = {
      mode: "tracing",
      label: "Обводка",
      instruction: "Создавайте стены поверх откалиброванного исходного плана.",
      escapeInstruction: "Esc — завершить обводку.",
      cursor: "crosshair",
      previewState: "none",
    };
  } else if (input.placementPresetId) {
    const state = previewState(input.placementPreviewValid);
    feedback = {
      mode: "place-object",
      label: "Размещение мебели",
      instruction: state === "invalid"
        ? "Это место недопустимо. Переместите предмет."
        : "Выберите место для предмета.",
      escapeInstruction: "Esc — отменить размещение.",
      cursor: state === "invalid" ? "not-allowed" : "copy",
      previewState: state,
    };
  } else if (input.measurementActive) {
    if (input.measurementPhase === "complete") {
      feedback = {
        mode: "measure-complete",
        label: "Измерение готово",
        instruction: "Кликните, чтобы начать новый замер.",
        escapeInstruction: "Esc — очистить результат.",
        cursor: "crosshair",
        previewState: "none",
      };
    } else if (input.measurementPhase === "measuring") {
      feedback = {
        mode: "measure-finish",
        label: "Измерить · вторая точка",
        instruction: "Укажите вторую точку.",
        escapeInstruction: "Esc — сбросить текущий замер.",
        cursor: "crosshair",
        previewState: "none",
      };
    } else {
      feedback = {
        mode: "measure-start",
        label: "Измерить",
        instruction: "Укажите первую точку.",
        escapeInstruction: "Esc — выйти из измерения.",
        cursor: "crosshair",
        previewState: "none",
      };
    }
  } else if (input.tool === "wall") {
    feedback = input.hasWallDraft ? {
      mode: "wall-finish",
      label: "Стена · вторая точка",
      instruction: "Укажите вторую точку стены.",
      escapeInstruction: "Esc — отменить текущий отрезок.",
      cursor: "crosshair",
      previewState: "none",
    } : {
      mode: "wall-start",
      label: "Стена",
      instruction: "Укажите первую точку стены.",
      escapeInstruction: "Esc — вернуться к выбору.",
      cursor: "crosshair",
      previewState: "none",
    };
  } else if (input.tool === "door" || input.tool === "window") {
    const state = previewState(input.openingPreviewValid);
    const noun = input.tool === "door" ? "дверь" : "окно";
    feedback = {
      mode: input.tool,
      label: input.tool === "door" ? "Дверь" : "Окно",
      instruction: state === "invalid"
        ? "Здесь проём разместить нельзя."
        : state === "valid"
          ? `Кликните, чтобы добавить ${noun}.`
          : "Наведите на стену.",
      escapeInstruction: "Esc — вернуться к выбору.",
      cursor: "crosshair",
      previewState: state,
    };
  } else {
    feedback = {
      mode: "select",
      label: "Выбор",
      instruction: input.hoveredSelectable
        ? "Кликните, чтобы выбрать объект."
        : "Выберите объект на плане.",
      escapeInstruction: null,
      cursor: input.hoveredSelectable ? "pointer" : "default",
      previewState: "none",
    };
  }

  return withPanCursor(input, feedback);
}
