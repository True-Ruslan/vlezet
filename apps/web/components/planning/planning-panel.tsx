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
import { type ReactNode, useMemo, useState } from "react";
import { useStore } from "zustand";
import { describePlanningContext } from "../editor/context-panel-contract";
import {
  ContextPanelFrame,
  ContextSection,
  type ContextPanelNavigation,
} from "../editor/context-panel-frame";
import { editorStore } from "../editor/use-editor-store";
import { PlanningIntentSection } from "./planning-intent-section";
import type { PlanningIntentControlState } from "./planning-intent-review";
import { planningPairIds, planningPairKey } from "./planning-pair-key";
import { planningUiStore } from "./planning-ui-store";

export { planningPairKey } from "./planning-pair-key";

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
  activeExactPairKey: string | null;
  errorMessage: string | null;
  intentSection?: ReactNode;
  navigation?: ContextPanelNavigation;
  onToggleObject: (objectId: string) => void;
  onToggleLock: (objectId: string) => void;
  onBoundaryPreferenceChange: (objectId: string, preference: PlanningBoundaryPreference) => void;
  onPairPreferenceChange: (pairKey: string, preference: PlanningPairPreference) => void;
  onPairMinimumGapChange: (pairKey: string, rawValue: string) => void;
  onGenerate: () => void;
  onPreview: (candidate: RankedPlanningCandidate) => void;
  onShowExactPair: (candidate: RankedPlanningCandidate, pairKey: string) => void;
  onApply: (candidate: RankedPlanningCandidate) => void;
  onClose: () => void;
}>;

export function togglePlanningSelection(current: readonly string[], objectId: string): string[] {
  if (current.includes(objectId)) return current.filter((id) => id !== objectId);
  if (current.length >= MAX_SELECTED_PLANNING_OBJECTS) return [...current];
  return [...current, objectId];
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
      const ids = planningPairIds(key);
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
  const hasHardConstraint = candidate.candidate.constraints?.some(
    (constraint) => constraint.kind === "lock-object" || constraint.kind === "pair-min-gap",
  ) ?? false;
  if (hasHardConstraint && candidate.evaluation.preferencePenalty > 0) {
    return "Обязательные ограничения соблюдены; вариант ранжирован с учётом ваших предпочтений";
  }
  if (hasHardConstraint) return "Обязательные ограничения соблюдены; геометрия безопасна";
  if (candidate.evaluation.preferencePenalty > 0) {
    return "Геометрия безопасна; вариант ранжирован с учётом ваших предпочтений";
  }
  return "Без обязательных коллизий и ограничений";
}

function formatMm(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export function planningWorkflowPhase(result: PlanningResult | null, previewCandidateId: string | null): string {
  if (previewCandidateId) return "Предпросмотр варианта";
  if (result) return result.candidates.length > 0 ? "Найденные варианты" : "Варианты не найдены";
  return "Настройка пожеланий и ограничений";
}

export function PlanningPanelView({
  roomName,
  objects,
  pairs,
  canGenerate,
  result,
  previewCandidateId,
  activeExactPairKey,
  errorMessage,
  intentSection,
  navigation,
  onToggleObject,
  onToggleLock,
  onBoundaryPreferenceChange,
  onPairPreferenceChange,
  onPairMinimumGapChange,
  onGenerate,
  onPreview,
  onShowExactPair,
  onApply,
  onClose,
}: PlanningPanelViewProps) {
  const hasSelectedObjects = objects.some((object) => object.selected);
  const hasMovableSelectedObject = objects.some((object) => object.selected && !object.locked);
  const objectNames = new Map(objects.map((object) => [object.id, object.name]));
  const resolvedNavigation = navigation ?? { label: `К комнате «${roomName}»`, onActivate: onClose };
  const descriptor = describePlanningContext({
    roomName,
    phase: planningWorkflowPhase(result, previewCandidateId),
    returnLabel: resolvedNavigation.label,
  });

  return (
    <ContextPanelFrame descriptor={descriptor} navigation={resolvedNavigation} className="planning-panel">
      <p className="inspector-help">Опишите пожелания или задайте ограничения вручную для 1–3 предметов.</p>

      {intentSection}

      <ContextSection title="Что переставить">
        {objects.length === 0 ? (
          <p className="inspector-help">В этой комнате пока нет предметов для перестановки.</p>
        ) : (
          <div className="planning-object-list">
            {objects.map((object) => (
              <div key={object.id} className={`planning-object-choice${object.selected ? " is-selected" : ""}`}>
                <label className="planning-object-select-row">
                  <input type="checkbox" checked={object.selected} onChange={() => onToggleObject(object.id)} />
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
      </ContextSection>

      {pairs.length > 0 ? (
        <ContextSection title="Отношения между предметами" description="«Ближе/дальше» ранжируется по центрам предметов. Точный зазор — отдельное жёсткое требование по внешним контурам.">
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
                  <span>↔ Минимальный зазор по контурам</span>
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
                <p className="inspector-help">Кратчайшее расстояние между внешними контурами предметов с учётом поворота. Это не размер предмета и не расстояние между центрами.</p>
              </div>
            ))}
          </div>
        </ContextSection>
      ) : null}

      <ContextSection>
        <button type="button" className="primary-action" disabled={!canGenerate} onClick={onGenerate}>
          Найти варианты
        </button>
        {!canGenerate && hasSelectedObjects && !hasMovableSelectedObject ? (
          <p className="inspector-help">Хотя бы один выбранный предмет должен оставаться подвижным.</p>
        ) : null}
      </ContextSection>

      {errorMessage ? <div className="field-error" role="status">{errorMessage}</div> : null}

      {result ? (
        <ContextSection title="Найденные варианты" description={`${result.validCandidateCount} допустимых · проверено ${result.evaluatedCandidateCount}`} className="planning-results">
          {result.candidates.map((candidate, index) => {
            const previewing = previewCandidateId === candidate.candidate.id;
            return (
              <article key={candidate.candidate.id} className={`planning-result-card${previewing ? " is-previewing" : ""}`}>
                <div className="planning-result-title">
                  <strong>Вариант {index + 1}</strong>
                  {index === 0 ? <span className="planning-best-badge">Лучший</span> : null}
                </div>
                <p className="inspector-help">{candidateSummary(candidate)}</p>
                {candidate.evaluation.exactEvidence.length > 0 ? (
                  <div className="planning-exact-list">
                    {candidate.evaluation.exactEvidence.map((evidence) => {
                      const pairKey = planningPairKey(evidence.objectIds[0], evidence.objectIds[1]);
                      const active = previewing && activeExactPairKey === pairKey;
                      return (
                        <section key={pairKey} className={`planning-exact-card${active ? " is-active" : ""}`}>
                          <div className="planning-exact-heading">
                            <span>↔ Точное расстояние</span>
                            <strong>{objectNames.get(evidence.objectIds[0]) ?? evidence.objectIds[0]} — {objectNames.get(evidence.objectIds[1]) ?? evidence.objectIds[1]}</strong>
                          </div>
                          <dl className="planning-exact-metrics">
                            <div className="planning-exact-metric"><dt>Фактически</dt><dd>{formatMm(evidence.actualMm)} мм</dd></div>
                            <div className="planning-exact-metric"><dt>Требуется</dt><dd>≥ {formatMm(evidence.requiredMm)} мм</dd></div>
                          </dl>
                          <p className="planning-exact-note">По ближайшим точкам повёрнутых контуров</p>
                          <button
                            type="button"
                            className="secondary-action"
                            disabled={active}
                            onClick={() => onShowExactPair(candidate, pairKey)}
                          >
                            {active ? "Показывается на плане" : "Показать на плане"}
                          </button>
                        </section>
                      );
                    })}
                  </div>
                ) : null}
                <ul className="planning-reasons">
                  {candidate.evaluation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
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
        </ContextSection>
      ) : null}
    </ContextPanelFrame>
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
    const ids = planningPairIds(key);
    return ids ? allowedIds.has(ids[0]) && allowedIds.has(ids[1]) : false;
  }));
}

export function PlanningPanel({ roomId, navigation }: Readonly<{ roomId: string; navigation: ContextPanelNavigation }>) {
  const document = useStore(editorStore, (state) => state.history.document);
  const previewCandidate = useStore(planningUiStore, (state) => state.previewCandidate);
  const activeExactPairKey = useStore(planningUiStore, (state) => state.activeExactPairKey);
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
    planningUiStore.getState().setActiveExactPairKey(null);
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

  const transferIntentControls = (state: PlanningIntentControlState) => {
    setSelectedObjectIds([...state.selectedObjectIds]);
    setLockedObjectIds([...state.lockedObjectIds]);
    setBoundaryPreferences({ ...state.boundaryPreferences });
    setPairPreferences({ ...state.pairPreferences });
    setPairMinimumGapInputs({ ...state.pairMinimumGapInputs });
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
      planningUiStore.getState().setActiveExactPairKey(null);
      setErrorMessage(next.candidates.length === 0 ? "Нет допустимых вариантов расстановки с текущими ограничениями." : null);
    } catch (error) {
      setResult(null);
      planningUiStore.getState().setPreviewCandidate(null);
      planningUiStore.getState().setActiveExactPairKey(null);
      setErrorMessage(planningErrorMessage(error));
    }
  };

  const preview = (candidate: RankedPlanningCandidate) => {
    planningUiStore.getState().setPreviewCandidate(candidate.candidate);
  };

  const showExactPair = (candidate: RankedPlanningCandidate, pairKey: string) => {
    planningUiStore.getState().setPreviewCandidate(candidate.candidate);
    planningUiStore.getState().setActiveExactPairKey(pairKey);
  };

  const apply = (candidate: RankedPlanningCandidate) => {
    try {
      editorStore.getState().applyPlanningCandidate(candidate.candidate);
      planningUiStore.getState().close();
      setErrorMessage(null);
    } catch (error) {
      planningUiStore.getState().setPreviewCandidate(null);
      planningUiStore.getState().setActiveExactPairKey(null);
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
        activeExactPairKey={null}
        errorMessage="Комната изменилась или была удалена. Вернитесь к плану и выберите комнату заново."
        navigation={navigation}
        onToggleObject={() => {}}
        onToggleLock={() => {}}
        onBoundaryPreferenceChange={() => {}}
        onPairPreferenceChange={() => {}}
        onPairMinimumGapChange={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onShowExactPair={() => {}}
        onApply={() => {}}
        onClose={navigation.onActivate}
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
      activeExactPairKey={activeExactPairKey}
      errorMessage={errorMessage}
      intentSection={<PlanningIntentSection roomObjects={roomObjects} onTransfer={transferIntentControls} />}
      navigation={navigation}
      onToggleObject={toggleObject}
      onToggleLock={toggleLock}
      onBoundaryPreferenceChange={setBoundaryPreference}
      onPairPreferenceChange={setPairPreference}
      onPairMinimumGapChange={setPairMinimumGap}
      onGenerate={generate}
      onPreview={preview}
      onShowExactPair={showExactPair}
      onApply={apply}
      onClose={navigation.onActivate}
    />
  );
}
