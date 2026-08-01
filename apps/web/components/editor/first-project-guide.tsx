import { UiButton } from "../ui/ui-button";
import { UiCard } from "../ui/ui-card";
import type { FirstProjectProgress, FirstProjectStepId } from "./first-project-progress";

const STEPS: readonly Readonly<{ id: FirstProjectStepId; label: string }>[] = [
  { id: "project-created", label: "Проект создан" },
  { id: "first-wall", label: "Нарисована первая стена" },
  { id: "closed-room", label: "Стены замкнуты в комнату" },
  { id: "review-room", label: "Проверены размеры и площадь" },
];

export type FirstProjectGuideProps = Readonly<{
  progress: FirstProjectProgress;
  onPrimaryAction: () => void;
  onDismiss: () => void;
}>;

function primaryLabel(progress: FirstProjectProgress): string | null {
  if (progress.primaryAction === "activate-wall-tool") {
    return progress.phase === "empty" ? "Начать со стены" : "Продолжить рисование";
  }
  if (progress.primaryAction === "select-first-room") return "Открыть комнату";
  return null;
}

export function FirstProjectGuide({ progress, onPrimaryAction, onDismiss }: FirstProjectGuideProps) {
  const completed = new Set(progress.completedSteps);
  const actionLabel = primaryLabel(progress);

  return (
    <UiCard variant="evidence" className="first-project-guide">
      <section
        data-first-project-phase={progress.phase}
        data-current-step={progress.currentStep}
        aria-labelledby="first-project-guide-title"
      >
        <div className="first-project-guide-heading">
          <div>
            <span className="first-project-guide-kicker">Первый проект</span>
            <h2 id="first-project-guide-title">{progress.title}</h2>
          </div>
          <UiButton
            variant="icon"
            className="first-project-guide-dismiss"
            aria-label="Скрыть подсказку первого проекта"
            onClick={onDismiss}
          >
            ×
          </UiButton>
        </div>

        <p className="first-project-guide-copy">{progress.description}</p>

        <ol className="first-project-guide-steps" aria-label="Шаги первого плана">
          {STEPS.map((step) => {
            const state = completed.has(step.id) ? "complete" : step.id === progress.currentStep ? "current" : "pending";
            return (
              <li key={step.id} data-step-state={state}>
                <span className="first-project-guide-step-marker" aria-hidden="true">
                  {state === "complete" ? "✓" : state === "current" ? "→" : "·"}
                </span>
                <span>{step.label}</span>
              </li>
            );
          })}
        </ol>

        <div className="first-project-guide-actions">
          {actionLabel ? <UiButton variant="primary" onClick={onPrimaryAction}>{actionLabel}</UiButton> : null}
          <UiButton variant="quiet" onClick={onDismiss}>
            {progress.phase === "room-created" ? "Завершить" : "Скрыть"}
          </UiButton>
        </div>
      </section>
    </UiCard>
  );
}
