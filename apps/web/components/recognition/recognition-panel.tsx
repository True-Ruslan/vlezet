"use client";

import {
  isRecognitionCandidateBulkAcceptable,
  type RecognitionDecision,
  type RecognitionOpeningCandidate,
  type RecognitionProposalDecision,
  type RecognitionSessionRecord,
  type SanitizedRecognitionProposal,
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
import {
  RECOGNITION_REVIEW_FILTERS,
  setRecognitionReviewFilter,
  useRecognitionReviewFilter,
  type RecognitionReviewFilter,
} from "./recognition-review-filter";

export type RecognitionPanelProps = Readonly<{
  state: RecognitionControllerState;
  selectedCandidateId: string | null;
  hasReferencePlan: boolean;
  missingReferenceAsset: boolean;
  navigation: ContextPanelNavigation;
  reviewFilter?: RecognitionReviewFilter;
  onReviewFilterChange?: (filter: RecognitionReviewFilter) => void;
  onStartLocal: () => void;
  onSelect: (candidateId: string | null) => void;
  onDecision: (candidateId: string, decision: RecognitionDecision) => void;
  onReclassifyOpening: (candidateId: string, kind: RecognitionOpeningCandidate["kind"]) => void;
  onAcceptHighConfidence: () => void;
  onRunCloud: () => void;
  onFindAiProposals?: () => void;
  aiProposalDiscoveryAvailable?: boolean;
  onProposalDecision?: (proposalId: string, decision: RecognitionProposalDecision) => void;
  onAgreeWithWallAdvisory?: (proposalId: string) => void;
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
    case "running-ai-proposals": return "AI-поиск пропущенных элементов";
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

function deterministicConfidenceLabel(confidence: "high" | "medium" | "low"): string {
  if (confidence === "high") return "Высокая";
  if (confidence === "medium") return "Средняя";
  return "Низкая";
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

function decisionLabel(decision: RecognitionDecision | RecognitionProposalDecision | undefined): string {
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

function providerReasonLabel(reason: string): string {
  switch (reason) {
    case "visible-gap": return "AI видит разрыв";
    case "door-arc": return "AI видит дугу открывания";
    case "door-leaf": return "AI видит полотно двери";
    case "parallel-window-rails": return "AI видит параллельные направляющие окна";
    case "sanitary-symbol-overlap": return "AI видит наложение символа сантехники или мебели";
    case "weak-structural-mask-support": return "AI отмечает слабую поддержку структурной маской";
    default: return "Основание модели";
  }
}

function validatorReasonLabel(reason: string): string {
  switch (reason) {
    case "local-rejected-door-evidence-matched": return "Локальный отклонённый признак двери подтверждён";
    case "local-rejected-window-evidence-matched": return "Локальный отклонённый признак окна подтверждён";
    case "structural-gap-validated": return "Структурный разрыв подтверждён";
    case "missing-host-wall": return "Не найдена однозначная стена-хозяин";
    case "opening-overlap-existing": return "Такая геометрия уже есть в локальном черновике";
    case "exact-local-wall-target-validated": return "Точный локальный кандидат подтверждён";
    case "structural-clutter-veto-passed": return "Локальные проверки допускают рекомендацию";
    default: return "Результат детерминированной проверки";
  }
}

function proposalKindLabel(proposal: SanitizedRecognitionProposal): string {
  if (proposal.kind === "door") return "Дверь · Предложение AI";
  if (proposal.kind === "window") return "Окно · Предложение AI";
  return "Локальная линия под вопросом";
}

function proposalStateLabel(proposal: SanitizedRecognitionProposal): string {
  if (proposal.state === "eligible") return "Допущено проверкой";
  if (proposal.state === "blocked") return "Заблокировано проверкой";
  return "Дубликат";
}

function proposalStateTone(proposal: SanitizedRecognitionProposal) {
  if (proposal.state === "eligible") return "success" as const;
  if (proposal.state === "blocked") return "danger" as const;
  return "warning" as const;
}

function providerLabel(providerId: string): string {
  return providerId === "openrouter" ? "OpenRouter" : providerId;
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

function ProposalEvidence({ proposal }: Readonly<{ proposal: SanitizedRecognitionProposal }>) {
  return (
    <div className="recognition-proposal-evidence">
      {proposal.hostWallCandidateId ? (
        <UiNotice tone="success" title="Стена-хозяин подтверждена">
          Кандидат привязан к локальной стене <code>{proposal.hostWallCandidateId}</code> и проверен относительно её пролёта.
        </UiNotice>
      ) : proposal.kind !== "local-wall-review" ? (
        <UiNotice tone="warning" title="Стена-хозяин не подтверждена">
          Предложение нельзя принять, пока детерминированная проверка не найдёт однозначную локальную стену.
        </UiNotice>
      ) : null}
      <div className="recognition-proposal-confidence">
        <span>{providerLabel(proposal.provider.providerId)} · {proposal.provider.modelId}</span>
        <span>Уверенность модели: {Math.round(proposal.modelConfidence * 100)}%</span>
        <span>Детерминированная проверка: {deterministicConfidenceLabel(proposal.deterministicConfidence)}</span>
      </div>
      <div className="recognition-proposal-reasons">
        <strong>Что увидела модель</strong>
        <ul>
          {proposal.evidence.providerReasons.map((reason) => (
            <li key={`provider-${reason}`}><span>{providerReasonLabel(reason)}</span><code>{reason}</code></li>
          ))}
        </ul>
        <strong>Что решила локальная проверка</strong>
        <ul>
          {proposal.evidence.validatorReasons.map((reason) => (
            <li key={`validator-${reason}`}><span>{validatorReasonLabel(reason)}</span><code>{reason}</code></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ProposalCard(props: Readonly<{
  proposal: SanitizedRecognitionProposal;
  decision: RecognitionProposalDecision | undefined;
  selected: boolean;
  onSelect: (proposalId: string) => void;
  onDecision?: (proposalId: string, decision: RecognitionProposalDecision) => void;
  onAgreeWithWallAdvisory?: (proposalId: string) => void;
}>) {
  const { proposal } = props;
  const eligible = proposal.state === "eligible";
  const advisory = proposal.kind === "local-wall-review";
  return (
    <article
      data-proposal-id={proposal.id}
      className={`recognition-proposal-card recognition-proposal-card--${proposal.state}`}
    >
      <div className="recognition-proposal-heading">
        <button
          type="button"
          className="recognition-proposal-select"
          aria-pressed={props.selected}
          disabled={!eligible}
          onClick={() => props.onSelect(proposal.id)}
        >
          <span><strong>{proposalKindLabel(proposal)}</strong><small>{proposal.id}</small></span>
          <UiBadge tone={proposalStateTone(proposal)}>{proposalStateLabel(proposal)}</UiBadge>
        </button>
        <em>{eligible ? decisionLabel(props.decision) : proposalStateLabel(proposal)}</em>
      </div>
      {proposal.state === "duplicate" ? (
        <UiNotice tone="warning" title="Такая геометрия уже есть в локальном черновике">
          Предложение оставлено только как диагностическое свидетельство и не отображается как применимая геометрия.
        </UiNotice>
      ) : null}
      {advisory ? (
        <UiNotice tone="warning" title="Локальный кандидат требует решения">
          AI считает эту локальную линию вероятным обозначением сантехники или мебели. Согласие отклонит только кандидат локального черновика и не удалит уже существующую стену квартиры.
        </UiNotice>
      ) : null}
      <ProposalEvidence proposal={proposal} />
      {eligible ? (
        <div className="recognition-proposal-actions">
          {advisory ? <>
            <UiButton
              variant="primary"
              disabled={!props.onAgreeWithWallAdvisory}
              onClick={() => props.onAgreeWithWallAdvisory?.(proposal.id)}
            >
              Согласиться и отклонить только локальный кандидат
            </UiButton>
            <UiButton
              variant="secondary"
              disabled={!props.onDecision}
              onClick={() => props.onDecision?.(proposal.id, "rejected")}
            >
              Оставить локальный кандидат
            </UiButton>
          </> : <>
            <UiButton
              variant="primary"
              disabled={!props.onDecision}
              onClick={() => props.onDecision?.(proposal.id, "accepted")}
            >
              Принять предложение
            </UiButton>
            <UiButton
              variant="secondary"
              disabled={!props.onDecision}
              onClick={() => props.onDecision?.(proposal.id, "rejected")}
            >
              Отклонить предложение
            </UiButton>
          </>}
        </div>
      ) : null}
    </article>
  );
}

export function RecognitionPanel(props: RecognitionPanelProps) {
  const sharedReviewFilter = useRecognitionReviewFilter();
  const session = sessionFromState(props.state);
  const draft = session?.draft ?? null;
  const candidates = draft ? [...draft.walls, ...draft.openings, ...draft.roomLabels] : [];
  const selected = candidates.find((candidate) => candidate.id === props.selectedCandidateId) ?? null;
  const selectedOpening = selected && "kind" in selected ? selected as RecognitionOpeningCandidate : null;
  const reviewFilter = props.reviewFilter ?? sharedReviewFilter;
  const questionedLocalIds = new Set(
    draft?.aiProposals
      .filter((proposal) => proposal.kind === "local-wall-review" && proposal.targetLocalCandidateId)
      .map((proposal) => proposal.targetLocalCandidateId as string) ?? [],
  );
  const showLocal = reviewFilter === "all" || reviewFilter === "local" || reviewFilter === "questioned-local";
  const visibleWalls = !draft || !showLocal
    ? []
    : reviewFilter === "questioned-local"
      ? draft.walls.filter((wall) => questionedLocalIds.has(wall.id))
      : draft.walls;
  const visibleOpenings = !draft || !showLocal || reviewFilter === "questioned-local" ? [] : draft.openings;
  const visibleProposals = !draft || reviewFilter === "local"
    ? []
    : reviewFilter === "questioned-local"
      ? draft.aiProposals.filter((proposal) => proposal.kind === "local-wall-review")
      : draft.aiProposals;
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
  const proposalDiscoveryEnabled = Boolean(
    props.aiProposalDiscoveryAvailable
    && props.onFindAiProposals
    && props.state.kind !== "running-ai-proposals",
  );

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
            {session ? <UiButton variant="secondary" onClick={props.onRunCloud}>Проверить локальный черновик с AI</UiButton> : null}
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
          {draft.aiProposalMetadata ? (
            <UiNotice tone="info" title="AI-предложения отделены от локального черновика">
              {providerLabel(draft.aiProposalMetadata.providerId)} · {draft.aiProposalMetadata.modelId}. Ни одно предложение не станет геометрией квартиры без явного решения и последующего применения.
            </UiNotice>
          ) : null}
          {aiVerificationWarning ? (
            <UiNotice tone="warning" title="AI-проверка требует сравнения">
              {aiVerificationWarning.message}
            </UiNotice>
          ) : null}
          {emptyDraft ? (
            <UiEmptyState
              className="recognition-empty-state"
              title="Локальный CV ничего не выделил"
              primaryAction={<UiButton variant="primary" onClick={props.onRunCloud}>Проверить локальный черновик с AI</UiButton>}
              secondaryAction={<UiButton variant="secondary" onClick={props.onStartLocal}>Повторить локально</UiButton>}
            >
              Это не считается успешным распознаванием. Исходный план и геометрия не изменятся.
            </UiEmptyState>
          ) : null}
          <div className="recognition-bulk-actions">
            <UiButton variant="secondary" onClick={props.onStartLocal} disabled={!props.hasReferencePlan || props.missingReferenceAsset}>Повторить локально</UiButton>
            <UiButton variant="secondary" onClick={props.onAcceptHighConfidence} disabled={!counts?.high}>Принять уверенные</UiButton>
            <UiButton variant="secondary" busy={props.state.kind === "running-cloud"} busyLabel="AI проверяет…" onClick={props.onRunCloud}>Проверить локальный черновик с AI</UiButton>
            <UiButton
              variant="secondary"
              busy={props.state.kind === "running-ai-proposals"}
              busyLabel="Ищем пропуски с AI…"
              disabled={!proposalDiscoveryEnabled && props.state.kind !== "running-ai-proposals"}
              title={proposalDiscoveryEnabled ? undefined : "Поиск станет доступен после подключения совместимого Stage 1 runner."}
              onClick={props.onFindAiProposals}
            >
              Найти пропущенные двери и окна с AI
            </UiButton>
          </div>
        </ContextSection>

        <ContextSection title="Источники проверки">
          <div className="recognition-source-filters" role="group" aria-label="Фильтр источников распознавания">
            {RECOGNITION_REVIEW_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className="recognition-source-filter"
                aria-pressed={reviewFilter === filter.value}
                onClick={() => {
                  setRecognitionReviewFilter(filter.value);
                  props.onReviewFilterChange?.(filter.value);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </ContextSection>

        <ContextSection title="Кандидаты">
          <div className="recognition-candidate-list" role="list">
            {visibleWalls.map((candidate) => {
              const conflict = conflictOf(candidate);
              const selectedCandidate = props.selectedCandidateId === candidate.id;
              return (
                <UiCard
                  key={candidate.id}
                  data-local-candidate-id={candidate.id}
                  variant="selectable"
                  selected={selectedCandidate}
                  className="recognition-candidate-card"
                >
                  <button type="button" role="listitem" className="recognition-candidate" aria-pressed={selectedCandidate} onClick={() => props.onSelect(candidate.id)}>
                    <span className="recognition-candidate-copy"><strong>Стена</strong><small>{originLabel(candidate.origin)}</small></span>
                    <UiBadge tone={confidenceTone(candidate.confidence, conflict)}>{confidenceLabel(candidate.confidence, conflict)}</UiBadge>
                    <em>{decisionLabel(draft.decisions[candidate.id])}</em>
                  </button>
                </UiCard>
              );
            })}
            {visibleOpenings.map((candidate) => {
              const conflict = conflictOf(candidate);
              const selectedCandidate = props.selectedCandidateId === candidate.id;
              return (
                <UiCard
                  key={candidate.id}
                  data-local-candidate-id={candidate.id}
                  variant="selectable"
                  selected={selectedCandidate}
                  className="recognition-candidate-card"
                >
                  <button type="button" role="listitem" className="recognition-candidate" aria-pressed={selectedCandidate} onClick={() => props.onSelect(candidate.id)}>
                    <span className="recognition-candidate-copy"><strong>{candidate.kind === "door" ? "Дверь" : candidate.kind === "window" ? "Окно" : "Неизвестный проём"}</strong><small>{originLabel(candidate.origin)}</small></span>
                    <UiBadge tone={confidenceTone(candidate.confidence, conflict)}>{confidenceLabel(candidate.confidence, conflict)}</UiBadge>
                    <em>{decisionLabel(draft.decisions[candidate.id])}</em>
                  </button>
                </UiCard>
              );
            })}
          </div>

          {visibleProposals.length > 0 ? (
            <div className="recognition-proposal-list" aria-label="Предложения AI">
              {visibleProposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  decision={draft.proposalDecisions[proposal.id]}
                  selected={props.selectedCandidateId === proposal.id}
                  onSelect={props.onSelect}
                  onDecision={props.onProposalDecision}
                  onAgreeWithWallAdvisory={props.onAgreeWithWallAdvisory}
                />
              ))}
            </div>
          ) : null}

          {selected && (reviewFilter === "all" || reviewFilter === "local") ? (
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
            <span>Локальных кандидатов выбрано: <strong>{counts?.accepted ?? 0}</strong></span>
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
