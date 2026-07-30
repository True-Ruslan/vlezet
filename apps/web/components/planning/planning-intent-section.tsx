"use client";

import type { PlanningObjectReferenceTarget } from "@vlezet/planning";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  interpretPlanningIntentWithOpenRouter,
  listCompatibleOpenRouterTextModels,
  OpenRouterPlanningIntentError,
  type OpenRouterTextModelOption,
} from "./openrouter-intent-provider";
import {
  buildPlanningIntentReviewDraft,
  planningControlStateFromIntentReview,
  removePlanningIntentReviewClause,
  resolvePlanningIntentReviewReference,
  toggleUnsupportedIntentAcknowledgement,
  type PlanningIntentControlState,
  type PlanningIntentReviewClause,
  type PlanningIntentReviewDraft,
  type PlanningIntentReviewReference,
} from "./planning-intent-review";

export type PlanningIntentSectionViewProps = Readonly<{
  requestText: string;
  apiKey: string;
  models: readonly OpenRouterTextModelOption[];
  modelId: string;
  loading: boolean;
  draft: PlanningIntentReviewDraft | null;
  roomObjects: readonly PlanningObjectReferenceTarget[];
  canTransfer: boolean;
  errorMessage: string | null;
  onRequestTextChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onAnalyze: () => void;
  onResolveReference: (referenceKey: string, objectId: string) => void;
  onToggleUnsupported: (index: number) => void;
  onRemoveClause: (clauseId: string) => void;
  onTransfer: () => void;
}>;

function objectName(
  objectId: string | null,
  roomObjects: readonly PlanningObjectReferenceTarget[],
): string | null {
  if (!objectId) return null;
  return roomObjects.find((object) => object.id === objectId)?.name ?? objectId;
}

function referenceLabel(
  reference: PlanningIntentReviewReference,
  roomObjects: readonly PlanningObjectReferenceTarget[],
): string {
  return objectName(reference.selectedObjectId, roomObjects) ?? reference.objectRef;
}

function clauseDescription(
  reviewClause: PlanningIntentReviewClause,
  roomObjects: readonly PlanningObjectReferenceTarget[],
): string {
  const clause = reviewClause.clause;
  const first = referenceLabel(reviewClause.references[0]!, roomObjects);
  if (clause.kind === "lock-object") return `${first} — не двигать`;
  if (clause.kind === "prefer-room-boundary") {
    return `${first} — ближе к ${clause.target === "wall" ? "стене" : "углу"}`;
  }
  const second = referenceLabel(reviewClause.references[1]!, roomObjects);
  if (clause.kind === "pair-distance") {
    return `${first} ↔ ${second} — ${clause.preference === "near" ? "ближе" : "дальше"} друг от друга`;
  }
  return `${first} ↔ ${second} — минимальный зазор ${Number(clause.minimumMm.toFixed(6))} мм`;
}

function referenceOptions(
  reference: PlanningIntentReviewReference,
  roomObjects: readonly PlanningObjectReferenceTarget[],
): readonly PlanningObjectReferenceTarget[] {
  if (reference.resolution.status !== "ambiguous") return roomObjects;
  const allowed = new Set(reference.resolution.candidateObjectIds);
  return roomObjects.filter((object) => allowed.has(object.id));
}

function ReferenceReview({
  reference,
  roomObjects,
  onResolve,
}: Readonly<{
  reference: PlanningIntentReviewReference;
  roomObjects: readonly PlanningObjectReferenceTarget[];
  onResolve: (referenceKey: string, objectId: string) => void;
}>) {
  if (reference.resolution.status === "resolved") {
    return (
      <div className="planning-intent-reference is-resolved">
        <span>{reference.objectRef}</span>
        <strong>{objectName(reference.selectedObjectId, roomObjects)}</strong>
      </div>
    );
  }
  return (
    <label className="planning-field planning-intent-reference">
      <span>{reference.objectRef}</span>
      <select
        className="inspector-select"
        value={reference.selectedObjectId ?? ""}
        onChange={(event) => onResolve(reference.key, event.target.value)}
      >
        <option value="" disabled>Нужно выбрать предмет</option>
        {referenceOptions(reference, roomObjects).map((object) => (
          <option key={object.id} value={object.id}>{object.name}</option>
        ))}
      </select>
      <small>
        {reference.resolution.status === "ambiguous"
          ? "Название подходит нескольким предметам — выберите явно."
          : "Название не найдено точно — выберите предмет вручную."}
      </small>
    </label>
  );
}

export function PlanningIntentSectionView({
  requestText,
  apiKey,
  models,
  modelId,
  loading,
  draft,
  roomObjects,
  canTransfer,
  errorMessage,
  onRequestTextChange,
  onApiKeyChange,
  onModelChange,
  onAnalyze,
  onResolveReference,
  onToggleUnsupported,
  onRemoveClause,
  onTransfer,
}: PlanningIntentSectionViewProps) {
  return (
    <div className="inspector-section planning-intent-section">
      <div className="planning-intent-heading">
        <div>
          <strong>Опишите пожелания</strong>
          <p className="inspector-help">Текст станет только проверяемым черновиком ограничений. Расстановка не запускается автоматически.</p>
        </div>
        <span className="planning-intent-badge">M6.4</span>
      </div>

      <label className="planning-field">
        <span>Пожелания к расстановке</span>
        <textarea
          value={requestText}
          rows={4}
          onChange={(event) => onRequestTextChange(event.target.value)}
          placeholder="Например: диван не двигать, кресло ближе к углу, между креслом и столом минимум 800 мм"
        />
      </label>

      <label className="planning-field">
        <span>OpenRouter API key</span>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder="sk-or-v1-…"
        />
        <small>API key хранится только до закрытия панели и не попадает в проект или резервную копию.</small>
      </label>

      {models.length > 0 ? (
        <label className="planning-field">
          <span>Модель разбора</span>
          <select className="inspector-select" value={modelId} onChange={(event) => onModelChange(event.target.value)}>
            {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
          </select>
        </label>
      ) : null}

      <button
        type="button"
        className="secondary-action planning-intent-analyze"
        disabled={loading || requestText.trim().length === 0 || apiKey.trim().length === 0}
        onClick={onAnalyze}
      >
        {loading ? "Разбираем пожелания…" : "Разобрать пожелания"}
      </button>

      {errorMessage ? (
        <div className="planning-intent-error" role="status">
          <strong>{errorMessage}</strong>
          <span>Ручные ограничения ниже остаются доступны.</span>
        </div>
      ) : null}

      {draft ? (
        <div className="planning-intent-review">
          <div className="planning-intent-review-heading">
            <strong>Проверяемый черновик</strong>
            <span>{draft.clauses.length} правил</span>
          </div>

          {draft.clauses.length === 0 ? (
            <p className="inspector-help">Поддерживаемых правил в тексте не найдено.</p>
          ) : (
            <div className="planning-intent-clause-list">
              {draft.clauses.map((reviewClause) => (
                <article key={reviewClause.id} className="planning-intent-clause">
                  <div className="planning-intent-clause-heading">
                    <strong>{clauseDescription(reviewClause, roomObjects)}</strong>
                    <button type="button" className="planning-intent-remove" onClick={() => onRemoveClause(reviewClause.id)}>Убрать</button>
                  </div>
                  <p>{reviewClause.clause.sourceText}</p>
                  <div className="planning-intent-reference-list">
                    {reviewClause.references.map((reference) => (
                      <ReferenceReview
                        key={reference.key}
                        reference={reference}
                        roomObjects={roomObjects}
                        onResolve={onResolveReference}
                      />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          {draft.warnings.length > 0 ? (
            <div className="planning-intent-warnings">
              {draft.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}

          {draft.unsupportedFragments.length > 0 ? (
            <div className="planning-intent-unsupported">
              <strong>Не поддержано</strong>
              <p className="inspector-help">Эти части текста не будут превращены в ограничения без вашего явного подтверждения.</p>
              {draft.unsupportedFragments.map((fragment, index) => (
                <label key={`${fragment.text}:${index}`} className="planning-inline-check">
                  <input
                    type="checkbox"
                    checked={fragment.acknowledged}
                    onChange={() => onToggleUnsupported(index)}
                  />
                  <span>{fragment.text}</span>
                </label>
              ))}
            </div>
          ) : null}

          <button type="button" className="primary-action" disabled={!canTransfer} onClick={onTransfer}>
            Перенести в ограничения
          </button>
          <p className="inspector-help">После переноса проверьте обычные контролы и отдельно нажмите «Найти варианты».</p>
        </div>
      ) : null}
    </div>
  );
}

function intentErrorMessage(error: unknown): string {
  if (error instanceof OpenRouterPlanningIntentError) return error.message;
  if (error instanceof DOMException && error.name === "AbortError") return "Запрос разбора отменён.";
  return "Не удалось безопасно разобрать пожелания.";
}

export function PlanningIntentSection({
  roomObjects,
  onTransfer,
}: Readonly<{
  roomObjects: readonly PlanningObjectReferenceTarget[];
  onTransfer: (state: PlanningIntentControlState) => void;
}>) {
  const [requestText, setRequestText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<readonly OpenRouterTextModelOption[]>([]);
  const [modelId, setModelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<PlanningIntentReviewDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const canTransfer = useMemo(() => {
    if (!draft) return false;
    try {
      planningControlStateFromIntentReview(draft, roomObjects);
      return true;
    } catch {
      return false;
    }
  }, [draft, roomObjects]);

  const analyze = async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setErrorMessage(null);
    setDraft(null);
    try {
      let availableModels = models;
      let selectedModelId = modelId;
      if (!selectedModelId) {
        availableModels = await listCompatibleOpenRouterTextModels(apiKey, controller.signal);
        if (availableModels.length === 0) {
          throw new OpenRouterPlanningIntentError("unsupported-model", "Совместимая текстовая модель со structured output не найдена.");
        }
        selectedModelId = availableModels[0]!.id;
        setModels(availableModels);
        setModelId(selectedModelId);
      }
      const interpretation = await interpretPlanningIntentWithOpenRouter({
        apiKey,
        modelId: selectedModelId,
        requestText,
        roomObjects,
        signal: controller.signal,
      });
      if (activeRequest.current !== controller) return;
      setDraft(buildPlanningIntentReviewDraft(interpretation, roomObjects));
    } catch (error) {
      if (controller.signal.aborted) return;
      setErrorMessage(intentErrorMessage(error));
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  };

  const changeApiKey = (value: string) => {
    activeRequest.current?.abort();
    setApiKey(value);
    setModels([]);
    setModelId("");
    setDraft(null);
    setErrorMessage(null);
  };

  return (
    <PlanningIntentSectionView
      requestText={requestText}
      apiKey={apiKey}
      models={models}
      modelId={modelId}
      loading={loading}
      draft={draft}
      roomObjects={roomObjects}
      canTransfer={canTransfer}
      errorMessage={errorMessage}
      onRequestTextChange={(value) => {
        activeRequest.current?.abort();
        setRequestText(value);
        setDraft(null);
        setErrorMessage(null);
      }}
      onApiKeyChange={changeApiKey}
      onModelChange={(value) => {
        setModelId(value);
        setDraft(null);
        setErrorMessage(null);
      }}
      onAnalyze={() => void analyze()}
      onResolveReference={(referenceKey, objectId) => {
        setDraft((current) => current
          ? resolvePlanningIntentReviewReference(current, referenceKey, objectId, roomObjects)
          : current);
      }}
      onToggleUnsupported={(index) => {
        setDraft((current) => current ? toggleUnsupportedIntentAcknowledgement(current, index) : current);
      }}
      onRemoveClause={(clauseId) => {
        setDraft((current) => current ? removePlanningIntentReviewClause(current, clauseId) : current);
      }}
      onTransfer={() => {
        if (!draft) return;
        onTransfer(planningControlStateFromIntentReview(draft, roomObjects));
      }}
    />
  );
}
