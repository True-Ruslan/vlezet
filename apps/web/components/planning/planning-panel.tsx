"use client";

import { evaluateObjectFits, deriveRooms } from "@vlezet/geometry";
import {
  MAX_SELECTED_PLANNING_OBJECTS,
  planLayoutAlternatives,
  PlanningError,
  type PlanningResult,
  type RankedPlanningCandidate,
} from "@vlezet/planning";
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { editorStore } from "../editor/use-editor-store";
import { planningUiStore } from "./planning-ui-store";

export type PlanningObjectChoice = Readonly<{
  id: string;
  name: string;
  selected: boolean;
}>;

export type PlanningPanelViewProps = Readonly<{
  roomName: string;
  objects: readonly PlanningObjectChoice[];
  canGenerate: boolean;
  result: PlanningResult | null;
  previewCandidateId: string | null;
  errorMessage: string | null;
  onToggleObject: (objectId: string) => void;
  onGenerate: () => void;
  onPreview: (candidate: RankedPlanningCandidate) => void;
  onApply: (candidate: RankedPlanningCandidate) => void;
  onClose: () => void;
}>;

export function togglePlanningSelection(current: readonly string[], objectId: string): string[] {
  if (current.includes(objectId)) return current.filter((id) => id !== objectId);
  if (current.length >= MAX_SELECTED_PLANNING_OBJECTS) return [...current];
  return [...current, objectId];
}

function candidateSummary(candidate: RankedPlanningCandidate): string {
  if (candidate.evaluation.tightObjectCount > 0) {
    return `${candidate.evaluation.tightObjectCount} предмет(а) требуют внимания к зонам использования`;
  }
  return "Без обязательных коллизий и ограничений";
}

export function PlanningPanelView({
  roomName,
  objects,
  canGenerate,
  result,
  previewCandidateId,
  errorMessage,
  onToggleObject,
  onGenerate,
  onPreview,
  onApply,
  onClose,
}: PlanningPanelViewProps) {
  return (
    <aside className="inspector-panel planning-panel" aria-label="Варианты расстановки">
      <div className="inspector-heading-row">
        <div>
          <span className="inspector-kicker">M6.1 · Детерминированный планировщик</span>
          <h3>Варианты расстановки</h3>
          <p className="inspector-help">{roomName}. Выберите от 1 до 3 существующих предметов.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>Закрыть</button>
      </div>

      <div className="inspector-section">
        <strong>Что переставить</strong>
        {objects.length === 0 ? (
          <p className="inspector-help">В этой комнате пока нет предметов для перестановки.</p>
        ) : (
          <div className="planning-object-list">
            {objects.map((object) => (
              <label key={object.id} className="planning-object-choice">
                <input
                  type="checkbox"
                  checked={object.selected}
                  onChange={() => onToggleObject(object.id)}
                />
                <span>{object.name}</span>
              </label>
            ))}
          </div>
        )}
        <button type="button" className="primary-button" disabled={!canGenerate} onClick={onGenerate}>
          Найти варианты
        </button>
      </div>

      {errorMessage ? <div className="inspector-warning" role="status">{errorMessage}</div> : null}

      {result ? (
        <div className="inspector-section planning-results">
          <div className="planning-results-heading">
            <strong>Найденные варианты</strong>
            <span>{result.validCandidateCount} допустимых · проверено {result.evaluatedCandidateCount}</span>
          </div>
          {result.candidates.map((candidate, index) => {
            const previewing = previewCandidateId === candidate.candidate.id;
            return (
              <article key={candidate.candidate.id} className={`planning-result-card${previewing ? " is-previewing" : ""}`}>
                <div className="planning-result-title">
                  <strong>Вариант {index + 1}</strong>
                  {index === 0 ? <span className="planning-best-badge">Лучший</span> : null}
                </div>
                <p className="inspector-help">{candidateSummary(candidate)}</p>
                <ul className="planning-reasons">
                  {candidate.evaluation.reasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <div className="planning-result-actions">
                  <button type="button" className="secondary-button" onClick={() => onPreview(candidate)}>
                    {previewing ? "Предпросмотр включён" : "Предпросмотр"}
                  </button>
                  <button type="button" className="primary-button" onClick={() => onApply(candidate)}>Применить</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}

function planningErrorMessage(error: unknown): string {
  if (error instanceof PlanningError) {
    switch (error.code) {
      case "room-unsupported": return "Для этой комнаты автоматические варианты пока не поддерживаются.";
      case "object-outside-target-room": return "Один из выбранных предметов больше не находится в этой комнате.";
      case "candidate-invalid": return "Вариант устарел после изменения плана. Найдите варианты заново.";
      default: return "Не удалось безопасно построить варианты для текущего состояния плана.";
    }
  }
  return "Не удалось построить варианты расстановки.";
}

export function PlanningPanel({ roomId }: Readonly<{ roomId: string }>) {
  const document = useStore(editorStore, (state) => state.history.document);
  const previewCandidate = useStore(planningUiStore, (state) => state.previewCandidate);
  const [selectedObjectIds, setSelectedObjectIds] = useState<readonly string[]>([]);
  const [result, setResult] = useState<PlanningResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const room = useMemo(
    () => deriveRooms(document).rooms.find((candidate) => candidate.id === roomId) ?? null,
    [document, roomId],
  );
  const roomObjects = useMemo(() => {
    const fit = evaluateObjectFits(document);
    return document.placedObjects.filter((object) => fit.byObjectId.get(object.id)?.roomId === roomId);
  }, [document, roomId]);

  const toggleObject = (objectId: string) => {
    setSelectedObjectIds((current) => togglePlanningSelection(current, objectId));
    setResult(null);
    setErrorMessage(null);
    planningUiStore.getState().setPreviewCandidate(null);
  };

  const generate = () => {
    try {
      const next = planLayoutAlternatives(document, { roomId, objectIds: selectedObjectIds });
      setResult(next);
      planningUiStore.getState().setPreviewCandidate(null);
      setErrorMessage(next.candidates.length === 0 ? "Нет допустимых вариантов расстановки." : null);
    } catch (error) {
      setResult(null);
      planningUiStore.getState().setPreviewCandidate(null);
      setErrorMessage(planningErrorMessage(error));
    }
  };

  const preview = (candidate: RankedPlanningCandidate) => {
    planningUiStore.getState().setPreviewCandidate(candidate.candidate);
  };

  const apply = (candidate: RankedPlanningCandidate) => {
    try {
      editorStore.getState().applyPlanningCandidate(candidate.candidate);
      planningUiStore.getState().close();
      setErrorMessage(null);
    } catch (error) {
      planningUiStore.getState().setPreviewCandidate(null);
      setResult(null);
      setErrorMessage(planningErrorMessage(error));
    }
  };

  if (!room) {
    return (
      <PlanningPanelView
        roomName="Комната недоступна"
        objects={[]}
        canGenerate={false}
        result={null}
        previewCandidateId={null}
        errorMessage="Комната изменилась или была удалена. Закройте панель и выберите комнату заново."
        onToggleObject={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => planningUiStore.getState().close()}
      />
    );
  }

  return (
    <PlanningPanelView
      roomName={room.name}
      objects={roomObjects.map((object) => ({ id: object.id, name: object.name, selected: selectedObjectIds.includes(object.id) }))}
      canGenerate={selectedObjectIds.length >= 1 && selectedObjectIds.length <= MAX_SELECTED_PLANNING_OBJECTS}
      result={result}
      previewCandidateId={previewCandidate?.id ?? null}
      errorMessage={errorMessage}
      onToggleObject={toggleObject}
      onGenerate={generate}
      onPreview={preview}
      onApply={apply}
      onClose={() => planningUiStore.getState().close()}
    />
  );
}
