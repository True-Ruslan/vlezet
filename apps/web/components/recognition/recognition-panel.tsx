"use client";

import {
  isRecognitionCandidateBulkAcceptable,
  type RecognitionDecision,
  type RecognitionOpeningCandidate,
  type RecognitionSessionRecord,
} from "@vlezet/recognition";
import { describeRecognitionContext } from "../editor/context-panel-contract";
import {
  ContextDangerZone,
  ContextPanelFrame,
  ContextSection,
  type ContextPanelNavigation,
} from "../editor/context-panel-frame";
import { UiButton } from "../ui/ui-button";
import { UiCard } from "../ui/ui-card";
import { UiField } from "../ui/ui-field";
import { UiBadge, UiEmptyState, UiNotice } from "../ui/ui-feedback";
import type { RecognitionControllerState } from "./recognition-controller";

export type RecognitionPanelProps = Readonly<{
  state: RecognitionControllerState;
  selectedCandidateId: string | null;
  hasReferencePlan: boolean;
  missingReferenceAsset: boolean;
  navigation: ContextPanelNavigation;
  onStartLocal: () => void;
  onSelect: (candidateId: string | null) => void;
  onDecision: (candidateId: string, decision: RecognitionDecision) => void;
  onReclassifyOpening: (candidateId: string, kind: RecognitionOpeningCandidate["kind"]) => void;
  onAcceptHighConfidence: () => void;
  onRunCloud: () => void;
  onApply: () => void;
  onDiscard: () => void;
}>;

function sessionFromState(state: RecognitionControllerState): RecognitionSessionRecord | null {
  return state.session;
}

function progressText(state: RecognitionControllerState): string {
  if (state.kind !== "running-local") return "";
  const labels = {
    prepare: "Подготавливаем изображение",
    edges: "Выделяем контуры",
    lines: "Ищем архитектурные линии",
    walls: "Собираем стены",
    openings: "Ищем проёмы",
    complete: "Завершаем черновик",
  } as const;
  return `${labels[state.progress.phase]} · ${Math.round(state.progress.progress * 100)}%`;
}

export function recognitionWorkflowPhase(state: RecognitionControllerState): string {
  switch (state.kind) {
    case "idle": return "Готово к локальному анализу";
    case "running-local": return "Локальный анализ";
    case "running-cloud": return "AI-проверка черновика";
    case "review": return state.session?.draft.status === "applied" ? "Черновик применён" : "Проверка черновика";
    case "stale": return "Черновик устарел";
    case "error": return state.session ? "Ошибка проверки черновика" : "Ошибка распознавания";
  }
}

function conflictOf(candidate: { readonly id: string }): string | null {
  return "conflict" in candidate && typeof candidate.conflict === "string" ? candidate.conflict : null;
}

function confidenceLabel(confidence: "high" | "medium" | "low", conflict: string | null): string {
  if (conflict) return "Есть конфликт";
  if (confidence === "high") return "Высокая уверенность";
  if (confidence === "medium") return "Средняя уверенность";
  return "Низкая уверенность";
}

function confidenceTone(confidence: "high" | "medium" | "low", conflict: string | null) {
  if (conflict) return "danger" as const;
  if (confidence === "high") return "success" as const;
  if (confidence === "medium") return "warning" as const;
  return "confidence" as const;
}

function originLabel(origin: "local" | "cloud" | "merged"): string {
  if (origin === "merged") return "Local + AI";
  if (origin === "cloud") return "AI";
  return "Local";
}

function decisionLabel(decision: RecognitionDecision | undefined): string {
  if (decision === "accepted") return "Принято";
  if (decision === "edited") return "Изменено";
  if (decision === "rejected") return "Отклонено";
  return "Ожидает проверки";
}

function openingEvidenceLabel(reason: string): string | null {
  switch (reason) {
    case "wall-gap": return "Обнаружен разрыв в стене";
    case "door-arc-like-line": return "Есть признак дверной дуги";
    case "paired-cross-lines": return "Есть признаки оконных линий";
    case "host-wall-validated": return "Привязка к стене проверена";
    case "opening-span-validated": return "Проём находится внутри пролёта стены";
    case "local-cloud-opening-agreement": return "Локальный анализ и AI согласны";
    default: return null;
  }
}

function OpeningEvidence({ opening }: Readonly<{ opening: RecognitionOpeningCandidate }>) {
  const reasons = opening.evidence.reasons
    .map(openingEvidenceLabel)
    .filter((reason): reason is string => reason !== null);
  return (
    <div className="recognition-opening-evidence">
      <UiNotice
        tone={opening.hostWallCandidateId ? "success" : "warning"}
        title={opening.hostWallCandidateId ? "Привязка к стене подтверждена" : "Стена-хозяин не определена"}
      >
        {opening.hostWallCandidateId
          ? "Проём проверен относительно существующей локальной стены и не выходит за её допустимый пролёт."
          : "Такой проём нельзя принять или применить до определения существующей стены-хозяина."}
      </UiNotice>
      <UiCard variant="evidence" className="recognition-opening-metrics">
        <span>Ширина гипотезы в исходнике</span>
        <strong>{opening.widthPx === null ? "Не определена" : `${Math.round(opening.widthPx)} px`}</strong>
      </UiCard>
      {reasons.length > 0 ? (
        <ul className="recognition-evidence-list" aria-label="Основания классификации проёма">
          {reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

export function RecognitionPanel(props: RecognitionPanelProps) {
  const session = sessionFromState(props.state);
  const draft = session?.draft ?? null;
  const candidates = draft ? [...draft.walls, ...draft.openings, ...draft.roomLabels] : [];
  const selected = candidates.find((candidate) => candidate.id === props.selectedCandidateId) ?? null;
  const selectedOpening = selected && "kind" in selected ? selected as RecognitionOpeningCandidate : null;
  const counts = draft ? {
    walls: draft.walls.length,
    openings: draft.openings.length,
    high: candidates.filter(isRecognitionCandidateBulkAcceptable).length,
    review: candidates.filter((candidate) => !isRecognitionCandidateBulkAcceptable(candidate)).length,
    accepted: Object.values(draft.decisions).filter((decision) => decision === "accepted" || decision === "edited").length,
  } : null;
  const emptyDraft = Boolean(draft && candidates.length === 0);
  const aiVerificationWarning = draft?.diagnostics.find((diagnostic) =>
    diagnostic.code === "weak-ai-verification-profile") ?? null;
  const descriptor = describeRecognitionContext({
    phase: recognitionWorkflowPhase(props.state),
    returnLabel: props.navigation.label,
  });

  return (
    <ContextPanelFrame descriptor={descriptor} navigation={props.navigation} className="recognition-panel">
      {!props.hasReferencePlan ? (
        <UiNotice tone="warning" title="Сначала нужна подложка">
          Загрузите и откалибруйте JPG, PNG или PDF-план.
        </UiNotice>
      ) : null}
      {props.missingReferenceAsset ? (
        <UiNotice tone="error" title="Файл подложки не найден">
          Распознавание недоступно, пока исходный файл не будет загружен заново.
        </UiNotice>
      ) : null}

      {props.state.kind === "idle" ? (
        <ContextSection title="Локальный анализ" description="План обрабатывается прямо в браузере. Ничего не отправляется наружу.">
          <UiButton
            variant="primary"
            className="recognition-full-action"
            disabled={!props.hasReferencePlan || props.missingReferenceAsset}
            onClick={props.onStartLocal}
          >
            Распознать план
          </UiButton>
        </ContextSection>
      ) : null}

      {props.state.kind === "running-local" ? (
        <UiNotice tone="info" title={progressText(props.state)} live className="recognition-progress-card">
          <span className="recognition-progress-copy"><span className="recognition-spinner" aria-hidden="true" />Редактор остаётся доступным. Черновик появится только после проверки результата.</span>
        </UiNotice>
      ) : null}

      {props.state.kind === "stale" ? (
        <UiNotice tone="warning" title="Черновик устарел">
          Исходный растр или метрическая калибровка изменились. Старые координаты нельзя применять к новой версии подложки.
          <div className="recognition-inline-actions">
            <UiButton variant="secondary" onClick={props.onDiscard}>Удалить старый черновик</UiButton>
            <UiButton variant="primary" disabled={!props.hasReferencePlan || props.missingReferenceAsset} onClick={props.onStartLocal}>Распознать заново</UiButton>
          </div>
        </UiNotice>
      ) : null}

      {props.state.kind === "error" ? (
        <UiNotice tone="error" title="Не удалось распознать план">
          {props.state.message}
          <div className="recognition-inline-actions">
            <UiButton variant="secondary" onClick={props.onStartLocal} disabled={!props.hasReferencePlan || props.missingReferenceAsset}>Повторить локально</UiButton>
            {session ? <UiButton variant="secondary" onClick={props.onRunCloud}>Попробовать AI</UiButton> : null}
          </div>
        </UiNotice>
      ) : null}

      {draft && props.state.kind !== "running-local" ? <>
        <ContextSection title="Сводка черновика">
          <div className="recognition-summary-grid">
            <UiCard variant="result"><span>Стены</span><strong>{counts?.walls}</strong></UiCard>
            <UiCard variant="result"><span>Проёмы</span><strong>{counts?.openings}</strong></UiCard>
            <UiCard variant="result"><span>Уверенно</span><strong>{counts?.high}</strong></UiCard>
            <UiCard variant="result"><span>Проверить</span><strong>{counts?.review}</strong></UiCard>
          </div>
          {aiVerificationWarning ? (
            <UiNotice tone="warning" title="AI-проверка требует сравнения">
              {aiVerificationWarning.message}
            </UiNotice>
          ) : null}
          {emptyDraft ? (
            <UiEmptyState
              className="recognition-empty-state"
              title="Локальный CV ничего не выделил"
              primaryAction={<UiButton variant="primary" onClick={props.onRunCloud}>Проверить с AI</UiButton>}
              secondaryAction={<UiButton variant="secondary" onClick={props.onStartLocal}>Повторить локально</UiButton>}
            >
              Это не считается успешным распознаванием. Исходный план и геометрия не изменятся.
            </UiEmptyState>
          ) : null}
          <div className="recognition-bulk-actions">
            <UiButton variant="secondary" onClick={props.onStartLocal} disabled={!props.hasReferencePlan || props.missingReferenceAsset}>Повторить локально</UiButton>
            <UiButton variant="secondary" onClick={props.onAcceptHighConfidence} disabled={!counts?.high}>Принять уверенные</UiButton>
            <UiButton variant="secondary" busy={props.state.kind === "running-cloud"} busyLabel="AI анализирует…" onClick={props.onRunCloud}>Проверить с AI</UiButton>
          </div>
        </ContextSection>

        <ContextSection title="Кандидаты">
          <div className="recognition-candidate-list" role="list">
            {draft.walls.map((candidate) => {
              const conflict = conflictOf(candidate);
              const selectedCandidate = props.selectedCandidateId === candidate.id;
              return (
                <UiCard key={candidate.id} variant="selectable" selected={selectedCandidate} className="recognition-candidate-card">
                  <button type="button" role="listitem" className="recognition-candidate" aria-pressed={selectedCandidate} onClick={() => props.onSelect(candidate.id)}>
                    <span className="recognition-candidate-copy"><strong>Стена</strong><small>{originLabel(candidate.origin)}</small></span>
                    <UiBadge tone={confidenceTone(candidate.confidence, conflict)}>{confidenceLabel(candidate.confidence, conflict)}</UiBadge>
                    <em>{decisionLabel(draft.decisions[candidate.id])}</em>
                  </button>
                </UiCard>
              );
            })}
            {draft.openings.map((candidate) => {
              const conflict = conflictOf(candidate);
              const selectedCandidate = props.selectedCandidateId === candidate.id;
              return (
                <UiCard key={candidate.id} variant="selectable" selected={selectedCandidate} className="recognition-candidate-card">
                  <button type="button" role="listitem" className="recognition-candidate" aria-pressed={selectedCandidate} onClick={() => props.onSelect(candidate.id)}>
                    <span className="recognition-candidate-copy"><strong>{candidate.kind === "door" ? "Дверь" : candidate.kind === "window" ? "Окно" : "Неизвестный проём"}</strong><small>{originLabel(candidate.origin)}</small></span>
                    <UiBadge tone={confidenceTone(candidate.confidence, conflict)}>{confidenceLabel(candidate.confidence, conflict)}</UiBadge>
                    <em>{decisionLabel(draft.decisions[candidate.id])}</em>
                  </button>
                </UiCard>
              );
            })}
          </div>

          {selected ? (
            <UiCard variant="evidence" className="recognition-detail">
              <div className="recognition-detail-heading">
                <strong>Выбранный кандидат</strong>
                <span>Уверенность: {confidenceLabel(selected.confidence, conflictOf(selected))}</span>
                {conflictOf(selected) ? <span className="recognition-conflict-label">Конфликт: {conflictOf(selected)}</span> : null}
              </div>
              {selectedOpening ? <>
                <UiField id={`recognition-opening-${selectedOpening.id}`} label="Тип проёма">
                  <select value={selectedOpening.kind} onChange={(event) => props.onReclassifyOpening(selectedOpening.id, event.target.value as RecognitionOpeningCandidate["kind"])}>
                    <option value="unknown-opening">Неизвестный</option>
                    <option value="door">Дверь</option>
                    <option value="window">Окно</option>
                  </select>
                </UiField>
                <OpeningEvidence opening={selectedOpening} />
              </> : null}
              <div className="recognition-inline-actions">
                <UiButton variant="primary" onClick={() => props.onDecision(selected.id, "accepted")}>Принять</UiButton>
                <UiButton variant="secondary" onClick={() => props.onDecision(selected.id, "rejected")}>Отклонить</UiButton>
              </div>
            </UiCard>
          ) : null}
        </ContextSection>

        <ContextSection title="Применение" description="Геометрия изменится только после явного применения и может быть отменена одним Undo.">
          <UiCard className="recognition-apply-footer">
            <span>Выбрано к применению: <strong>{counts?.accepted ?? 0}</strong></span>
            <UiButton variant="primary" disabled={!counts?.accepted || draft.status === "applied"} onClick={props.onApply}>
              {draft.status === "applied" ? "Уже применено" : "Применить выбранное"}
            </UiButton>
          </UiCard>
        </ContextSection>

        <ContextDangerZone title="Черновик распознавания" description="Удалится только проверяемый черновик. План квартиры не изменится.">
          <UiButton variant="danger" className="recognition-full-action" onClick={props.onDiscard}>Удалить черновик</UiButton>
        </ContextDangerZone>
      </> : null}

      <UiNotice tone="local" title="Распознавание создаёт только предложения">
        Геометрия квартиры меняется лишь после команды «Применить выбранное».
      </UiNotice>
    </ContextPanelFrame>
  );
}
