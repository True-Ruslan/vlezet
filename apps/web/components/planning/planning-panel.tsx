"use client";

import { deriveRooms, evaluateObjectFits } from "@vlezet/geometry";
import {
  MAX_SELECTED_PLANNING_OBJECTS,
  planLayoutAlternatives,
  PlanningError,
  type PlanningConstraint,
  type PlanningResult,
  type RankedPlanningCandidate,
} from "@vlezet/planning";
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { editorStore } from "../editor/use-editor-store";
import { planningUiStore } from "./planning-ui-store";

export type PlanningBoundaryPreference = "none" | "wall" | "corner";
export type PlanningPairPreference = "none" | "near" | "far";

const MINIMUM_GAP_INPUT_ERROR = "Введите минимальный проход как неотрицательное число в миллиметрах.";

export type PlanningObjectChoice = Readonly<{
  id: string;
  name: string;
  selected: boolean;
  locked: boolean;
  boundaryPreference: PlanningBoundaryPreference;
}>;

export type PlanningPairChoice = Readonly<{
  key: string;
  firstName: string;
  secondName: string;
  preference: PlanningPairPreference;
  minimumGapInput: string;
  minimumGapError: string | null;
}>;

export type PlanningPanelViewProps = Readonly<{
  roomName: string;
  objects: readonly PlanningObjectChoice[];
  pairs: readonly PlanningPairChoice[];
  canGenerate: boolean;
  result: PlanningResult | null;
  previewCandidateId: string | null;
  errorMessage: string | null;
  onToggleObject: (objectId: string) => void;
  onToggleLock: (objectId: string) => void;
  onBoundaryPreferenceChange: (objectId: string, preference: PlanningBoundaryPreference) => void;
  onPairPreferenceChange: (pairKey: string, preference: PlanningPairPreference) => void;
  onPairMinimumGapChange: (pairKey: string, rawValue: string) => void;
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

export function planningPairKey(firstObjectId: string, secondObjectId: string): string {
  return firstObjectId.localeCompare(secondObjectId) <= 0
    ? `${firstObjectId}|${secondObjectId}`
    : `${secondObjectId}|${firstObjectId}`;
}

function pairIdsFromKey(key: string): readonly [string, string] | null {
  const parts = key.split("|");
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
}

export function parsePairMinimumGapInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) throw new RangeError(MINIMUM_GAP_INPUT_ERROR);
  return value;
}

function exactGapInputError(raw: string): string | null {
  try {
    parsePairMinimumGapInput(raw);
    return null;
  } catch {
    return MINIMUM_GAP_INPUT_ERROR;
  }
}

export function buildPlanningConstraints(
  selectedObjectIds: readonly string[],
  lockedObjectIds: readonly string[],
  boundaryPreferences: Readonly<Record<string, PlanningBoundaryPreference | undefined>>,
  pairPreferences: Readonly<Record<string, PlanningPairPreference | undefined>>,
  pairMinimumGapInputs: Readonly<Record<string, string | undefined>> = {},
): PlanningConstraint[] {
  const selected = new Set(selectedObjectIds);
  const locked = new Set(lockedObjectIds);
  const constraints: PlanningConstraint[] = [];

  for (const objectId of selectedObjectIds) {
    if (locked.has(objectId)) constraints.push({ kind: "lock-object", objectId });
  }
  for (const objectId of selectedObjectIds) {
    const preference = boundaryPreferences[objectId] ?? "none";
    if (preference === "wall" || preference === "corner") {
      constraints.push({ kind: "prefer-room-boundary", objectId, target: preference });
    }
  }

  for (let firstIndex = 0; firstIndex < selectedObjectIds.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < selectedObjectIds.length; secondIndex += 1) {
      const first = selectedObjectIds[firstIndex]!;
      const second = selectedObjectIds[secondIndex]!;
      const key = planningPairKey(first, second);
      const ids = pairIdsFromKey(key);
      if (!ids || !selected.has(ids[0]) || !selected.has(ids[1])) continue;

      const preference = pairPreferences[key] ?? "none";
      if (preference === "near" || preference === "far") {
        constraints.push({ kind: "pair-distance", objectIds: ids, preference });
      }

      const minimumMm = parsePairMinimumGapInput(pairMinimumGapInputs[key] ?? "");
      if (minimumMm !== null) {
        constraints.push({ kind: "pair-min-gap", objectIds: ids, minimumMm });
      }
    }
  }
  return constraints;
}

function candidateSummary(candidate: RankedPlanningCandidate): string {
  if (candidate.evaluation.tightObjectCount > 0) {
    return `${candidate.evaluation.tightObjectCount} предмет(а) требуют внимания к зонам использования`;
  }
  if (candidate.evaluation.preferencePenalty > 0) {
    return "Геометрия безопасна; вариант ранжирован с учётом ваших предпочтений";
  }
  return "Без обязательных коллизий и ограничений";
}

export function PlanningPanelView({
  roomName,
  objects,
  pairs,
  canGenerate,
  result,
  previewCandidateId,
  errorMessage,
  onToggleObject,
  onToggleLock,
  onBoundaryPreferenceChange,
  onPairPreferenceChange,
  onPairMinimumGapChange,
  onGenerate,
  onPreview,
  onApply,
  onClose,
}: PlanningPanelViewProps) {
  const hasSelectedObjects = objects.some((object) => object.selected);
  const hasMovableSelectedObject = objects.some((object) => object.selected && !object.locked);

  return (
    <aside className="inspector-panel planning-panel" aria-label="Варианты расстановки">
      <div className="inspector-heading-row">
        <div>
          <span className="inspector-kicker">M6.3 · Точные пространственные ограничения</span>
          <h3>Варианты расстановки</h3>
          <p className="inspector-help">{roomName}. Выберите от 1 до 3 предметов и задайте только те ограничения, которые действительно важны.</p>
        </div>
        <button type="button" className="secondary-action" onClick={onClose}>Закрыть</button>
      </div>

      <div className="inspector-section">
        <strong>Что переставить</strong>
        {objects.length === 0 ? (
          <p className="inspector-help">В этой комнате пока нет предметов для перестановки.</p>
        ) : (
          <div className="planning-object-list">
            {objects.map((object) => (
              <div key={object.id} className={`planning-object-choice${object.selected ? " is-selected" : ""}`}>
                <label className="planning-object-select-row">
                  <input
                    type="checkbox"
                    checked={object.selected}
                    onChange={() => onToggleObject(object.id)}
                  />
                  <span>{object.name}</span>
                </label>
                {object.selected ? (
                  <div className="planning-constraint-controls">
                    <label className="planning-inline-check">
                      <input type="checkbox" checked={object.locked} onChange={() => onToggleLock(object.id)} />
                      <span>Не двигать</span>
                    </label>
                    <label className="planning-field">
                      <span>Предпочтение</span>
                      <select
                        className="inspector-select"
                        value={object.boundaryPreference}
                        onChange={(event) => onBoundaryPreferenceChange(object.id, event.target.value as PlanningBoundaryPreference)}
                      >
                        <option value="none">Без предпочтения</option>
                        <option value="wall">Ближе к стене</option>
                        <option value="corner">Ближе к углу</option>
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {pairs.length > 0 ? (
        <div className="inspector-section">
          <strong>Отношения между предметами</strong>
          <p className="inspector-help">«Ближе/дальше» ранжируется по центрам предметов. Минимальный проход — жёсткое требование по ближайшим краям мебели с учётом поворота.</p>
          <div className="planning-pair-list">
            {pairs.map((pair) => (
              <div key={pair.key} className="planning-pair-row">
                <strong>{pair.firstName} ↔ {pair.secondName}</strong>
                <label className="planning-field">
                  <span>Предпочтение</span>
                  <select
                    className="inspector-select"
                    value={pair.preference}
                    onChange={(event) => onPairPreferenceChange(pair.key, event.target.value as PlanningPairPreference)}
                  >
                    <option value="none">Не важно</option>
                    <option value="near">Ближе друг к другу</option>
                    <option value="far">Дальше друг от друга</option>
                  </select>
                </label>
                <label className="planning-field">
                  <span>Минимальный проход между предметами</span>
                  <div className="length-field-row">
                    <input
                      inputMode="decimal"
                      value={pair.minimumGapInput}
                      aria-invalid={pair.minimumGapError ? true : undefined}
                      onChange={(event) => onPairMinimumGapChange(pair.key, event.target.value)}
                      placeholder="не задан"
                    />
                    <span>мм</span>
                  </div>
                  {pair.minimumGapError ? <span className="field-error">{pair.minimumGapError}</span> : null}
                </label>
                <p className="inspector-help">Точный минимум измеряется по ближайшим краям мебели, а не между центрами.</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="inspector-section">
        <button type="button" className="primary-action" disabled={!canGenerate} onClick={onGenerate}>
          Найти варианты
        </button>
        {!canGenerate && hasSelectedObjects && !hasMovableSelectedObject ? (
          <p className="inspector-help">Хотя бы один выбранный предмет должен оставаться подвижным.</p>
        ) : null}
      </div>

      {errorMessage ? <div className="field-error" role="status">{errorMessage}</div> : null}

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
                  {candidate.evaluation.reasons.slice(0, 8).map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <div className="planning-result-actions">
                  <button type="button" className="secondary-action" onClick={() => onPreview(candidate)}>
                    {previewing ? "Предпросмотр включён" : "Предпросмотр"}
                  </button>
                  <button type="button" className="primary-action" onClick={() => onApply(candidate)}>Применить</button>
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
      case "invalid-constraints": return "Проверьте ограничения: они конфликтуют, устарели или не оставляют ни одного подвижного предмета.";
      case "candidate-invalid": return "Вариант устарел после изменения плана или ограничений. Найдите варианты заново.";
      default: return "Не удалось безопасно построить варианты для текущего состояния плана.";
    }
  }
  if (error instanceof RangeError && error.message === MINIMUM_GAP_INPUT_ERROR) return error.message;
  return "Не удалось построить варианты расстановки.";
}

function cleanRecord<T>(record: Readonly<Record<string, T>>, allowedIds: ReadonlySet<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => allowedIds.has(key)));
}

function cleanPairRecord<T>(record: Readonly<Record<string, T>>, allowedIds: ReadonlySet<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => {
    const ids = pairIdsFromKey(key);
    return ids ? allowedIds.has(ids[0]) && allowedIds.has(ids[1]) : false;
  }));
}

export function PlanningPanel({ roomId }: Readonly<{ roomId: string }>) {
  const document = useStore(editorStore, (state) => state.history.document);
  const previewCandidate = useStore(planningUiStore, (state) => state.previewCandidate);
  const [selectedObjectIds, setSelectedObjectIds] = useState<readonly string[]>([]);
  const [lockedObjectIds, setLockedObjectIds] = useState<readonly string[]>([]);
  const [boundaryPreferences, setBoundaryPreferences] = useState<Record<string, PlanningBoundaryPreference>>({});
  const [pairPreferences, setPairPreferences] = useState<Record<string, PlanningPairPreference>>({});
  const [pairMinimumGapInputs, setPairMinimumGapInputs] = useState<Record<string, string>>({});
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
  const roomObjectNames = useMemo(() => new Map(roomObjects.map((object) => [object.id, object.name])), [roomObjects]);

  const clearGeneratedState = () => {
    setResult(null);
    setErrorMessage(null);
    planningUiStore.getState().setPreviewCandidate(null);
  };

  const toggleObject = (objectId: string) => {
    const next = togglePlanningSelection(selectedObjectIds, objectId);
    const allowed = new Set(next);
    setSelectedObjectIds(next);
    setLockedObjectIds((current) => current.filter((id) => allowed.has(id)));
    setBoundaryPreferences((current) => cleanRecord(current, allowed));
    setPairPreferences((current) => cleanPairRecord(current, allowed));
    setPairMinimumGapInputs((current) => cleanPairRecord(current, allowed));
    clearGeneratedState();
  };

  const toggleLock = (objectId: string) => {
    setLockedObjectIds((current) => current.includes(objectId)
      ? current.filter((id) => id !== objectId)
      : [...current, objectId]);
    clearGeneratedState();
  };

  const setBoundaryPreference = (objectId: string, preference: PlanningBoundaryPreference) => {
    setBoundaryPreferences((current) => ({ ...current, [objectId]: preference }));
    clearGeneratedState();
  };

  const setPairPreference = (pairKey: string, preference: PlanningPairPreference) => {
    setPairPreferences((current) => ({ ...current, [pairKey]: preference }));
    clearGeneratedState();
  };

  const setPairMinimumGap = (pairKey: string, rawValue: string) => {
    setPairMinimumGapInputs((current) => ({ ...current, [pairKey]: rawValue }));
    clearGeneratedState();
  };

  const pairs = useMemo<PlanningPairChoice[]>(() => {
    const nextPairs: PlanningPairChoice[] = [];
    for (let firstIndex = 0; firstIndex < selectedObjectIds.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < selectedObjectIds.length; secondIndex += 1) {
        const firstId = selectedObjectIds[firstIndex]!;
        const secondId = selectedObjectIds[secondIndex]!;
        const key = planningPairKey(firstId, secondId);
        const minimumGapInput = pairMinimumGapInputs[key] ?? "";
        nextPairs.push({
          key,
          firstName: roomObjectNames.get(firstId) ?? firstId,
          secondName: roomObjectNames.get(secondId) ?? secondId,
          preference: pairPreferences[key] ?? "none",
          minimumGapInput,
          minimumGapError: exactGapInputError(minimumGapInput),
        });
      }
    }
    return nextPairs;
  }, [pairMinimumGapInputs, pairPreferences, roomObjectNames, selectedObjectIds]);

  const generate = () => {
    try {
      const constraints = buildPlanningConstraints(
        selectedObjectIds,
        lockedObjectIds,
        boundaryPreferences,
        pairPreferences,
        pairMinimumGapInputs,
      );
      const next = planLayoutAlternatives(document, { roomId, objectIds: selectedObjectIds, constraints });
      setResult(next);
      planningUiStore.getState().setPreviewCandidate(null);
      setErrorMessage(next.candidates.length === 0 ? "Нет допустимых вариантов расстановки с текущими ограничениями." : null);
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
        pairs={[]}
        canGenerate={false}
        result={null}
        previewCandidateId={null}
        errorMessage="Комната изменилась или была удалена. Закройте панель и выберите комнату заново."
        onToggleObject={() => {}}
        onToggleLock={() => {}}
        onBoundaryPreferenceChange={() => {}}
        onPairPreferenceChange={() => {}}
        onPairMinimumGapChange={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => planningUiStore.getState().close()}
      />
    );
  }

  const selectedSet = new Set(selectedObjectIds);
  const lockedSet = new Set(lockedObjectIds);
  const canGenerate = selectedObjectIds.length >= 1 &&
    selectedObjectIds.length <= MAX_SELECTED_PLANNING_OBJECTS &&
    selectedObjectIds.some((objectId) => !lockedSet.has(objectId)) &&
    pairs.every((pair) => pair.minimumGapError === null);

  return (
    <PlanningPanelView
      roomName={room.name}
      objects={roomObjects.map((object) => ({
        id: object.id,
        name: object.name,
        selected: selectedSet.has(object.id),
        locked: lockedSet.has(object.id),
        boundaryPreference: boundaryPreferences[object.id] ?? "none",
      }))}
      pairs={pairs}
      canGenerate={canGenerate}
      result={result}
      previewCandidateId={previewCandidate?.id ?? null}
      errorMessage={errorMessage}
      onToggleObject={toggleObject}
      onToggleLock={toggleLock}
      onBoundaryPreferenceChange={setBoundaryPreference}
      onPairPreferenceChange={setPairPreference}
      onPairMinimumGapChange={setPairMinimumGap}
      onGenerate={generate}
      onPreview={preview}
      onApply={apply}
      onClose={() => planningUiStore.getState().close()}
    />
  );
}
