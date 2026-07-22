"use client";

import type {
  RecognitionDecision,
  RecognitionOpeningCandidate,
  RecognitionSessionRecord,
} from "@vlezet/recognition";
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

function conflictOf(candidate: { readonly id: string }): string | null {
  return "conflict" in candidate && typeof candidate.conflict === "string" ? candidate.conflict : null;
}

const styles = `
.recognition-panel{display:flex;flex-direction:column;gap:12px}.recognition-tool{gap:6px}.recognition-intro,.recognition-progress-card,.recognition-detail,.recognition-apply-footer,.recognition-privacy-note{display:grid;gap:7px;padding:11px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}.recognition-intro p,.recognition-progress-card span,.recognition-detail span,.recognition-apply-footer span,.recognition-privacy-note span{margin:0;color:#64748b;font-size:10px;line-height:1.45}.recognition-progress-card{text-align:center;place-items:center;padding:24px 12px}.recognition-spinner{width:22px;height:22px;border:3px solid #dbeafe;border-top-color:#1769ff;border-radius:50%;animation:recognition-spin .8s linear infinite}@keyframes recognition-spin{to{transform:rotate(360deg)}}.recognition-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.recognition-summary-grid>div{display:grid;gap:3px;padding:9px;border:1px solid #e2e8f0;border-radius:9px;background:#fff}.recognition-summary-grid span{color:#64748b;font-size:9px}.recognition-summary-grid strong{font-size:17px}.recognition-bulk-actions,.recognition-inline-actions{display:flex;gap:7px;flex-wrap:wrap}.recognition-bulk-actions button,.recognition-inline-actions button{width:auto;margin:0;flex:1}.recognition-candidate-list{display:grid;gap:5px;max-height:260px;overflow:auto}.recognition-candidate{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;text-align:left;cursor:pointer}.recognition-candidate.is-selected{border-color:#93c5fd;box-shadow:0 0 0 2px #dbeafe}.recognition-candidate>span:nth-child(2){display:grid;gap:2px}.recognition-candidate strong{font-size:11px}.recognition-candidate small{color:#64748b;font-size:9px}.recognition-candidate em{color:#64748b;font-size:9px;font-style:normal}.recognition-confidence{width:8px;height:8px;border-radius:50%;background:#64748b}.recognition-confidence.is-high{background:#16a34a}.recognition-confidence.is-medium{background:#d97706}.recognition-confidence.is-low{background:#64748b}.recognition-confidence.is-conflict{background:#dc2626}.recognition-conflict-label{color:#b91c1c!important}.recognition-field{display:grid;gap:5px}.recognition-field>span{font-size:10px;font-weight:700}.recognition-field input,.recognition-field select{width:100%;height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.recognition-field small{color:#64748b;font-size:9px}.recognition-apply-footer{margin-top:auto}.recognition-modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.42);backdrop-filter:blur(3px)}.recognition-modal{width:min(520px,100%);display:grid;gap:14px;padding:18px;border-radius:14px;background:#fff;box-shadow:0 24px 80px rgba(15,23,42,.28)}.recognition-modal header,.recognition-modal footer{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.recognition-modal header h2{margin:0;font-size:17px}.recognition-modal header p{margin:5px 0 0;color:#64748b;font-size:11px;line-height:1.5}.recognition-modal header>button{width:30px;height:30px;border:0;border-radius:8px;background:#f1f5f9;cursor:pointer}.recognition-modal footer{justify-content:flex-end}.recognition-modal footer button{width:auto;min-width:110px;margin:0}.recognition-privacy-note{border-color:#bfdbfe;background:#eff6ff}.recognition-banner{position:fixed;z-index:39;left:50%;bottom:18px;display:flex;align-items:center;gap:9px;padding:9px 13px;border:1px solid #bbf7d0;border-radius:11px;background:rgba(240,253,244,.96);color:#166534;box-shadow:0 10px 28px rgba(22,101,52,.12);transform:translateX(-50%);backdrop-filter:blur(8px)}.recognition-banner strong{font-size:11px}.recognition-banner span{font-size:10px}@media(max-width:980px){.recognition-panel{display:none}.recognition-banner span{display:none}}
`;

export function RecognitionPanel(props: RecognitionPanelProps) {
  const session = sessionFromState(props.state);
  const draft = session?.draft ?? null;
  const candidates = draft ? [...draft.walls, ...draft.openings, ...draft.roomLabels] : [];
  const selected = candidates.find((candidate) => candidate.id === props.selectedCandidateId) ?? null;
  const selectedOpening = selected && "kind" in selected ? selected as RecognitionOpeningCandidate : null;
  const counts = draft ? {
    walls: draft.walls.length,
    openings: draft.openings.length,
    high: candidates.filter((candidate) => candidate.confidence === "high" && !conflictOf(candidate)).length,
    review: candidates.filter((candidate) => candidate.confidence !== "high" || Boolean(conflictOf(candidate))).length,
    accepted: Object.values(draft.decisions).filter((decision) => decision === "accepted" || decision === "edited").length,
  } : null;

  return <>
    <style>{styles}</style>
    <aside className="reference-panel recognition-panel" aria-label="Распознавание плана">
      <div className="reference-panel-heading">
        <div><strong>Умное распознавание</strong><span>Локальный CV + опциональная AI-проверка</span></div>
        <button type="button" onClick={props.onClose} aria-label="Закрыть распознавание">×</button>
      </div>

      {!props.hasReferencePlan ? <div className="reference-warning">Сначала загрузите и откалибруйте JPG, PNG или PDF-план.</div> : null}
      {props.missingReferenceAsset ? <div className="reference-error">Файл подложки не найден в локальном хранилище. Распознавание недоступно.</div> : null}

      {props.state.kind === "idle" ? <>
        <div className="recognition-intro"><strong>Начать с локального анализа</strong><p>План обрабатывается прямо в браузере. Ничего не отправляется наружу.</p></div>
        <button className="primary-action" type="button" disabled={!props.hasReferencePlan || props.missingReferenceAsset} onClick={props.onStartLocal}>Распознать план</button>
      </> : null}

      {props.state.kind === "running-local" ? <div className="recognition-progress-card" role="status"><div className="recognition-spinner" /><strong>{progressText(props.state)}</strong><span>Редактор остаётся доступным. Черновик появится только после проверки результата.</span></div> : null}

      {props.state.kind === "stale" ? <div className="reference-warning"><strong>Черновик устарел.</strong><br />Исходный растр или метрическая калибровка изменились. Старые координаты нельзя применять к новой версии подложки.<div className="recognition-inline-actions"><button className="secondary-action" type="button" onClick={props.onDiscard}>Удалить старый черновик</button><button className="primary-action" type="button" disabled={!props.hasReferencePlan || props.missingReferenceAsset} onClick={props.onStartLocal}>Распознать заново</button></div></div> : null}

      {props.state.kind === "error" ? <div className="reference-error" role="alert">{props.state.message}<div className="recognition-inline-actions"><button className="secondary-action" type="button" onClick={props.onStartLocal} disabled={!props.hasReferencePlan || props.missingReferenceAsset}>Повторить локально</button>{session ? <button className="secondary-action" type="button" onClick={props.onRunCloud}>Попробовать AI</button> : null}</div></div> : null}

      {draft && props.state.kind !== "running-local" ? <>
        <div className="recognition-summary-grid"><div><span>Стены</span><strong>{counts?.walls}</strong></div><div><span>Проёмы</span><strong>{counts?.openings}</strong></div><div><span>Уверенно</span><strong>{counts?.high}</strong></div><div><span>Проверить</span><strong>{counts?.review}</strong></div></div>
        <div className="recognition-bulk-actions"><button className="secondary-action" type="button" onClick={props.onAcceptHighConfidence}>Принять уверенные</button><button className="secondary-action" type="button" onClick={props.onRunCloud} disabled={props.state.kind === "running-cloud"}>{props.state.kind === "running-cloud" ? "AI анализирует…" : "Проверить с AI"}</button></div>
        <div className="recognition-candidate-list" role="list">
          {draft.walls.map((candidate) => <button key={candidate.id} type="button" role="listitem" className={props.selectedCandidateId === candidate.id ? "recognition-candidate is-selected" : "recognition-candidate"} onClick={() => props.onSelect(candidate.id)}><span className={`recognition-confidence is-${candidate.conflict ? "conflict" : candidate.confidence}`} /><span><strong>Стена</strong><small>{candidate.origin === "merged" ? "Local + AI" : candidate.origin === "cloud" ? "AI" : "Local"}</small></span><em>{draft.decisions[candidate.id] ?? "pending"}</em></button>)}
          {draft.openings.map((candidate) => <button key={candidate.id} type="button" role="listitem" className={props.selectedCandidateId === candidate.id ? "recognition-candidate is-selected" : "recognition-candidate"} onClick={() => props.onSelect(candidate.id)}><span className={`recognition-confidence is-${candidate.conflict ? "conflict" : candidate.confidence}`} /><span><strong>{candidate.kind === "door" ? "Дверь" : candidate.kind === "window" ? "Окно" : "Неизвестный проём"}</strong><small>{candidate.origin === "merged" ? "Local + AI" : candidate.origin === "cloud" ? "AI" : "Local"}</small></span><em>{draft.decisions[candidate.id] ?? "pending"}</em></button>)}
        </div>
        {selected ? <div className="recognition-detail"><div><strong>Выбранный кандидат</strong><span>Уверенность: {selected.confidence}</span>{conflictOf(selected) ? <span className="recognition-conflict-label">Конфликт: {conflictOf(selected)}</span> : null}</div>{selectedOpening ? <label className="recognition-field"><span>Тип проёма</span><select value={selectedOpening.kind} onChange={(event) => props.onReclassifyOpening(selectedOpening.id, event.target.value as RecognitionOpeningCandidate["kind"])}><option value="unknown-opening">Неизвестный</option><option value="door">Дверь</option><option value="window">Окно</option></select></label> : null}<div className="recognition-inline-actions"><button className="primary-action" type="button" onClick={() => props.onDecision(selected.id, "accepted")}>Принять</button><button className="secondary-action" type="button" onClick={() => props.onDecision(selected.id, "rejected")}>Отклонить</button></div></div> : null}
        <div className="recognition-apply-footer"><span>Выбрано к применению: <strong>{counts?.accepted ?? 0}</strong></span><button className="primary-action" type="button" disabled={!counts?.accepted || draft.status === "applied"} onClick={props.onApply}>{draft.status === "applied" ? "Уже применено" : "Применить выбранное"}</button><button className="danger-action" type="button" onClick={props.onDiscard}>Удалить черновик</button></div>
      </> : null}

      <p className="reference-local-note">Распознавание создаёт только редактируемые предложения. Геометрия квартиры меняется лишь после команды «Применить выбранное» и может быть отменена одним Undo.</p>
    </aside>
  </>;
}
