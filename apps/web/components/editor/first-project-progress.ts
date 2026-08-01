export type FirstProjectPhase = "empty" | "drawing" | "room-created";

export type FirstProjectStepId =
  | "project-created"
  | "first-wall"
  | "closed-room"
  | "review-room";

export type FirstProjectPrimaryAction = "activate-wall-tool" | "select-first-room" | null;

export type FirstProjectProgressInput = Readonly<{
  wallCount: number;
  roomCount: number;
}>;

export type FirstProjectProgress = Readonly<{
  phase: FirstProjectPhase;
  completedSteps: readonly FirstProjectStepId[];
  currentStep: FirstProjectStepId;
  title: string;
  description: string;
  primaryAction: FirstProjectPrimaryAction;
}>;

function validCount(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

const INVALID_PROGRESS: FirstProjectProgress = {
  phase: "empty",
  completedSteps: [],
  currentStep: "first-wall",
  title: "Первый план",
  description: "Не удалось определить прогресс проекта. Продолжайте работу в редакторе.",
  primaryAction: null,
};

export function deriveFirstProjectProgress(input: FirstProjectProgressInput): FirstProjectProgress {
  if (!validCount(input.wallCount) || !validCount(input.roomCount)) return INVALID_PROGRESS;

  if (input.roomCount > 0) {
    return {
      phase: "room-created",
      completedSteps: ["project-created", "first-wall", "closed-room"],
      currentStep: "review-room",
      title: "Первая комната готова",
      description: "Площадь и размеры рассчитаны по внутреннему контуру. Теперь можно проверить комнату или добавить мебель.",
      primaryAction: "select-first-room",
    };
  }

  if (input.wallCount > 0) {
    return {
      phase: "drawing",
      completedSteps: ["project-created", "first-wall"],
      currentStep: "closed-room",
      title: "Контур ещё не замкнут",
      description: "Продолжайте соединять стены. Комната появится, когда линии образуют корректный замкнутый контур.",
      primaryAction: "activate-wall-tool",
    };
  }

  return {
    phase: "empty",
    completedSteps: ["project-created"],
    currentStep: "first-wall",
    title: "Первый план",
    description: "Выберите «Стена» и нарисуйте замкнутый контур. Комната и площадь появятся после корректного соединения стен.",
    primaryAction: "activate-wall-tool",
  };
}
