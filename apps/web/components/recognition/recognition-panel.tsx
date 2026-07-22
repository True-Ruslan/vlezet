"use client";

import type { RecognitionDecision, RecognitionOpeningCandidate, RecognitionSessionRecord } from "@vlezet/recognition";
import type { RecognitionControllerState } from "./recognition-controller";

export type RecognitionPanelProps = Readonly<{
  state: RecognitionControllerState;
  selectedCandidateId: string | null;
  hasReferencePlan: boolean;
  missingReferenceAsset: boolean;
  onStartLocal: () => void;
  onSelect: (candidateId: string | null) => void;
  onDecision: (candidateId: string, decision: RecognitionDecision) => void;
  onReclassifyOpening: (candidateId: string, kind: RecognitionOpeningCandidate["kind"]) => void;
  onAcceptHighConfidence: () => void;
  onRunCloud: () => void;
  onApply: () => void;
  onDiscard: () => void;
  onClose: () => void;
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

export function RecognitionPanel(props: RecognitionPanelProps) {
  const session = sessionFromState(props.state);
  const draft = session?.draft ?? null;
  const candidates = draft ? [...draft.walls, ...draft.openings, ...draft.roomLabels] : [];
  const selected = candidates.find((candidate) => candidate.id === props.selectedCandidateId) ?? null;
  const selectedOpening = selected && "kind" in selected ? selected as RecognitionOpeningCandidate : null;
  const counts = draft ? {
    walls: draft.walls.length,
    openings: draft.openings.length,
    high: candidates.filter((candidate) => candidate.confidence === "high" && !candidate.conflict).length,
    review: candidates.filter((candidate) => candidate.confidence !== "high" || Boolean(candidate.conflict)).length,
    accepted: Object.values(draft.decisions).filter((decision) => decision === "accepted" || decision === "edited").length,
  } : null;

  return <aside className="reference-panel recognition-panel" aria-label="Распознавание плана">
    <div className="reference-panel-heading">
      <div><strong>Умное распознавание</strong><span>Локальный CV + опциональная AI-проверка</span></div>
      <button type="button" onClick={props.onClose} aria-label="Закрыть распознавание">×</button>
    </div>

    {!props.hasReferencePlan ? <div className="reference-warning">Сначала загрузите и откалибруйте JPG, PNG или PDF-план.</div> : null}
    {props.missingReferenceAsset ? <div className="reference-error">Файл подложки не найден в локальном хранилище. Распознавание недоступно.</div> : null}

    {props.state.kind === "idle" ? <>
      <div className="recognition-intro">
        <strong>Начать с локального анализа</strong>
        <p>План обрабатывается прямо в браузере. Ничего не отправляется наружу.</p>
      </div>
      <button className="primary-action" type="button" disabled={!props.hasReferencePlan || props.missingReferenceAsset} onClick={props.onStartLocal}>Распознать план</button>
    </> : null}

    {props.state.kind === "running-local" ? <div className="recognition-progress-card" role="status">
      <div className="recognition-spinner" />
      <strong>{progressText(props.state)}</strong>
      <span>Редактор остаётся доступным. Черновик появится только после проверки результата.</span>
    </div> : null}

    {props.state.kind === "stale" ? <div className="reference-warning">
      <strong>Черновик устарел.</strong><br />Исходный растр или метрическая калибровка изменились. Старые координаты нельзя применять к новой версии подложки.
      <div className="recognition-inline-actions"><button className="secondary-action" type="button" onClick={props.onDiscard}>Удалить старый черновик</button><button className="primary-action" type="button" disabled={!props.hasReferencePlan || props.missingReferenceAsset} onClick={props.onStartLocal}>Распознать заново</button></div>
    </div> : null}

    {props.state.kind === "error" ? <div className="reference-error" role="alert">
      {props.state.message}
      <div className="recognition-inline-actions"><button className="secondary-action" type="button" onClick={props.onStartLocal} disabled={!props.hasReferencePlan || props.missingReferenceAsset}>Повторить локально</button>{session ? <button className="secondary-action" type="button" onClick={props.onRunCloud}>Попробовать AI</button> : null}</div>
    </div> : null}

    {draft && props.state.kind !== "running-local" ? <>
      <div className="recognition-summary-grid">
        <div><span>Стены</span><strong>{counts?.walls}</strong></div>
        <div><span>Проёмы</span><strong>{counts?.openings}</strong></div>
        <div><span>Уверенно</span><strong>{counts?.high}</strong></div>
        <div><span>Проверить</span><strong>{counts?.review}</strong></div>
      </div>
      <div className="recognition-bulk-actions">
        <button className="secondary-action" type="button" onClick={props.onAcceptHighConfidence}>Принять уверенные</button>
        <button className="secondary-action" type="button" onClick={props.onRunCloud} disabled={props.state.kind === "running-cloud"}>{props.state.kind === "running-cloud" ? "AI анализирует…" : "Проверить с AI"}</button>
      </div>
      <div className="recognition-candidate-list" role="list">
        {draft.walls.map((candidate) => <button key={candidate.id} type="button" role="listitem" className={props.selectedCandidateId === candidate.id ? "recognition-candidate is-selected" : "recognition-candidate"} onClick={() => props.onSelect(candidate.id)}>
          <span className={`recognition-confidence is-${candidate.conflict ? "conflict" : candidate.confidence}`} />
          <span><strong>Стена</strong><small>{candidate.origin === "merged" ? "Local + AI" : candidate.origin === "cloud" ? "AI" : "Local"}</small></span>
          <em>{draft.decisions[candidate.id] ?? "pending"}</em>
        </button>)}
        {draft.openings.map((candidate) => <button key={candidate.id} type="button" role="listitem" className={props.selectedCandidateId === candidate.id ? "recognition-candidate is-selected" : "recognition-candidate"} onClick={() => props.onSelect(candidate.id)}>
          <span className={`recognition-confidence is-${candidate.conflict ? "conflict" : candidate.confidence}`} />
          <span><strong>{candidate.kind === "door" ? "Дверь" : candidate.kind === "window" ? "Окно" : "Неизвестный проём"}</strong><small>{candidate.origin === "merged" ? "Local + AI" : candidate.origin === "cloud" ? "AI" : "Local"}</small></span>
          <em>{draft.decisions[candidate.id] ?? "pending"}</em>
        </button>)}
      </div>
      {selected ? <div className="recognition-detail">
        <div><strong>Выбранный кандидат</strong><span>Уверенность: {selected.confidence}</span>{selected.conflict ? <span className="recognition-conflict-label">Конфликт: {selected.conflict}</span> : null}</div>
        {selectedOpening ? <label className="recognition-field"><span>Тип проёма</span><select value={selectedOpening.kind} onChange={(event) => props.onReclassifyOpening(selectedOpening.id, event.target.value as RecognitionOpeningCandidate["kind"])}><option value="unknown-opening">Неизвестный</option><option value="door">Дверь</option><option value="window">Окно</option></select></label> : null}
        <div className="recognition-inline-actions"><button className="primary-action" type="button" onClick={() => props.onDecision(selected.id, "accepted")}>Принять</button><button className="secondary-action" type="button" onClick={() => props.onDecision(selected.id, "rejected")}>Отклонить</button></div>
      </div> : null}
      <div className="recognition-apply-footer">
        <span>Выбрано к применению: <strong>{counts?.accepted ?? 0}</strong></span>
        <button className="primary-action" type="button" disabled={!counts?.accepted || draft.status === "applied"} onClick={props.onApply}>{draft.status === "applied" ? "Уже применено" : "Применить выбранное"}</button>
        <button className="danger-action" type="button" onClick={props.onDiscard}>Удалить черновик</button>
      </div>
    </> : null}

    <p className="reference-local-note">Распознавание создаёт только редактируемые предложения. Геометрия квартиры меняется лишь после команды «Применить выбранное» и может быть отменена одним Undo.</p>
  </aside>;
}
