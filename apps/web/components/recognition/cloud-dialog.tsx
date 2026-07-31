"use client";

import { useMemo, useRef, useState } from "react";
import { UiButton } from "../ui/ui-button";
import { UiDialog } from "../ui/ui-dialog";
import { UiField } from "../ui/ui-field";
import { UiNotice } from "../ui/ui-feedback";
import { resolveCloudRecognitionRequest } from "./cloud-dialog-flow";
import { listCompatibleOpenRouterModels, type OpenRouterModelOption } from "./openrouter-provider";

export type CloudRecognitionRequest = Readonly<{ apiKey: string; modelId: string }>;

export type CloudDialogProps = Readonly<{
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onRun: (request: CloudRecognitionRequest) => Promise<void>;
}>;

function CloudDialogContent(props: Omit<CloudDialogProps, "open">) {
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<readonly OpenRouterModelOption[]>([]);
  const [modelId, setModelId] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedModel = useMemo(() => models.find((model) => model.id === modelId) ?? null, [modelId, models]);

  const close = () => {
    setApiKey("");
    props.onClose();
  };

  const fetchCompatibleModels = async (): Promise<readonly OpenRouterModelOption[]> => {
    if (!apiKey.trim()) throw new Error("Введите OpenRouter API key.");
    setLoadingModels(true);
    try {
      const compatible = await listCompatibleOpenRouterModels(apiKey, new AbortController().signal);
      setModels(compatible);
      setModelId((current) => current && compatible.some((model) => model.id === current) ? current : compatible[0]?.id ?? "");
      return compatible;
    } finally {
      setLoadingModels(false);
    }
  };

  const loadModels = async () => {
    setError(null);
    try {
      const compatible = await fetchCompatibleModels();
      if (compatible.length === 0) setError("Для этого аккаунта не найдено совместимых vision-моделей со structured output.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось получить список моделей OpenRouter.");
    }
  };

  const run = async () => {
    setError(null);
    try {
      const resolved = await resolveCloudRecognitionRequest({
        apiKey,
        selectedModelId: modelId,
        knownModels: models,
        loadModels: fetchCompatibleModels,
      });
      setModels(resolved.models);
      setModelId(resolved.modelId);
      await props.onRun({ apiKey: resolved.apiKey, modelId: resolved.modelId });
      setApiKey("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выполнить AI-проверку.");
    }
  };

  return (
    <UiDialog
      open
      title="Проверить план с AI"
      description="Опциональная проверка через OpenRouter. Изображение плана будет отправлено выбранной модели только после запуска."
      onClose={close}
      closeLabel={props.busy ? "Отменить AI-анализ" : "Закрыть"}
      initialFocusRef={apiKeyRef}
      className="recognition-modal"
      footer={
        <>
          <UiButton variant="secondary" onClick={close}>{props.busy ? "Отменить запрос" : "Отмена"}</UiButton>
          <UiButton
            variant="primary"
            busy={props.busy || loadingModels}
            busyLabel={props.busy ? "AI анализирует…" : "Подбираем модель…"}
            disabled={!apiKey.trim()}
            onClick={() => void run()}
          >
            Анализировать
          </UiButton>
        </>
      }
    >
      <div className="recognition-dialog-content" aria-busy={props.busy || undefined}>
        <UiField id="openrouter-api-key" label="OpenRouter API key">
          <input
            ref={apiKeyRef}
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-or-v1-…"
            disabled={props.busy}
          />
        </UiField>

        <div className="recognition-inline-actions">
          <UiButton
            variant="secondary"
            busy={loadingModels}
            busyLabel="Проверяем модели…"
            disabled={props.busy || !apiKey.trim()}
            onClick={() => void loadModels()}
          >
            Выбрать модель вручную
          </UiButton>
        </div>

        {models.length > 0 ? (
          <UiField
            id="openrouter-model"
            label="Vision-модель"
            message={selectedModel?.contextLength ? `Контекст: до ${selectedModel.contextLength.toLocaleString("ru-RU")} токенов` : undefined}
          >
            <select value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={props.busy || loadingModels}>
              {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </UiField>
        ) : (
          <UiNotice tone="info" title="Автоматический выбор модели">
            Можно сразу нажать «Анализировать» — Vlezet сам подберёт первую совместимую vision-модель. Для ручного выбора откройте список выше.
          </UiNotice>
        )}

        <UiNotice tone="local" title="Ключ не сохраняется">
          Он живёт только в памяти этой формы, не попадает в проект, IndexedDB или резервную копию.
        </UiNotice>

        {error ? <UiNotice tone="error" title="Не удалось выполнить AI-проверку">{error}</UiNotice> : null}
      </div>
    </UiDialog>
  );
}

export function CloudDialog(props: CloudDialogProps) {
  if (!props.open) return null;
  return <CloudDialogContent busy={props.busy} onClose={props.onClose} onRun={props.onRun} />;
}
