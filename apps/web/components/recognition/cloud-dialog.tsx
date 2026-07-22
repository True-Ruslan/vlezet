"use client";

import { useMemo, useState } from "react";
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

  return <div className="recognition-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="recognition-modal" role="dialog" aria-modal="true" aria-labelledby="cloud-recognition-title">
      <header>
        <div>
          <h2 id="cloud-recognition-title">Проверить план с AI</h2>
          <p>Опциональная проверка через OpenRouter. Изображение плана будет отправлено выбранной модели только после запуска.</p>
        </div>
        <button type="button" aria-label={props.busy ? "Отменить AI-анализ" : "Закрыть"} onClick={close}>×</button>
      </header>
      <label className="recognition-field">
        <span>OpenRouter API key</span>
        <input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-or-v1-…" disabled={props.busy} />
      </label>
      <div className="recognition-inline-actions">
        <button className="secondary-action" type="button" onClick={() => void loadModels()} disabled={loadingModels || props.busy || !apiKey.trim()}>{loadingModels ? "Проверяем модели…" : "Выбрать модель вручную"}</button>
      </div>
      {models.length > 0 ? <label className="recognition-field">
        <span>Vision-модель</span>
        <select value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={props.busy || loadingModels}>
          {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
        </select>
        {selectedModel?.contextLength ? <small>Контекст: до {selectedModel.contextLength.toLocaleString("ru-RU")} токенов</small> : null}
      </label> : <p className="recognition-model-hint">Можно сразу нажать «Анализировать» — Vlezet сам подберёт первую совместимую vision-модель. Для ручного выбора откройте список выше.</p>}
      <div className="recognition-privacy-note">
        <strong>Ключ не сохраняется.</strong>
        <span>Он живёт только в памяти этой формы, не попадает в проект, IndexedDB или резервную копию.</span>
      </div>
      {error ? <p className="reference-error" role="alert">{error}</p> : null}
      <footer>
        <button className="secondary-action" type="button" onClick={close}>{props.busy ? "Отменить запрос" : "Отмена"}</button>
        <button className="primary-action" type="button" onClick={() => void run()} disabled={props.busy || loadingModels || !apiKey.trim()}>{props.busy ? "AI анализирует…" : loadingModels ? "Подбираем модель…" : "Анализировать"}</button>
      </footer>
    </section>
  </div>;
}

export function CloudDialog(props: CloudDialogProps) {
  if (!props.open) return null;
  return <CloudDialogContent busy={props.busy} onClose={props.onClose} onRun={props.onRun} />;
}
