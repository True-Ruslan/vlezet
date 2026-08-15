"use client";

import type { Point2 } from "@vlezet/geometry";
import type { ReferenceAlignment, ReferencePlan } from "@vlezet/projects";
import { useEffect, useRef, useState } from "react";
import {
  describeReferenceContext,
} from "../editor/context-panel-contract";
import {
  ContextDangerZone,
  ContextPanelFrame,
  ContextSection,
  type ContextPanelNavigation,
} from "../editor/context-panel-frame";
import { parseCalibrationLength } from "./calibration-input";
import { PrecisionCalibrationStage } from "./calibration-stage";
import { inspectReferenceFile, ReferenceImportError } from "./reference-file";
import {
  reduceReferenceImport,
  type CalibrationDraft,
  type ReferenceImportState,
} from "./reference-import-machine";
import { loadPdfReference, type LoadedPdfReference } from "./pdf-reference";
import { normalizeImageFile, type NormalizedReferenceRaster } from "./raster-normalizer";
import { useReferenceImage } from "./use-reference-image";

export type ReferenceInstallDraft = Readonly<{
  raster: NormalizedReferenceRaster;
  source:
    | Readonly<{ kind: "image"; originalMimeType: "image/png" | "image/jpeg" }>
    | Readonly<{ kind: "pdf"; pageNumber: number; pageCount: number }>;
  pointA: Point2;
  pointB: Point2;
  knownLengthMm: number;
  alignment: ReferenceAlignment;
}>;

export type ReferencePanelProps = Readonly<{
  referencePlan: ReferencePlan | null;
  assetBlob: Blob | null;
  missingAsset: boolean;
  navigation: ContextPanelNavigation;
  onInstall: (draft: ReferenceInstallDraft) => Promise<void>;
  onUpdate: (referencePlan: ReferencePlan) => void;
  onRemove: () => Promise<void>;
  onStartTracing: () => void;
  onFitReference: () => void;
}>;

function stateError(error: unknown): ReferenceImportState {
  if (error instanceof ReferenceImportError) return { kind: "failed", code: error.code, message: error.message };
  console.error(error);
  return { kind: "failed", code: "decode-failed", message: "Не удалось обработать выбранный план." };
}

function CalibrationStage({
  raster,
  draft,
  onChange,
}: Readonly<{
  raster: NormalizedReferenceRaster;
  draft: CalibrationDraft;
  onChange: (patch: Partial<CalibrationDraft>) => void;
}>) {
  const { image, error } = useReferenceImage(raster.blob);
  return <PrecisionCalibrationStage image={image} error={error} draft={draft} onChange={onChange} />;
}

export function referenceWorkflowPhase(
  state: ReferenceImportState,
  referencePlan: ReferencePlan | null,
  missingAsset: boolean,
): string {
  if (missingAsset) return "Требуется восстановить файл";
  switch (state.kind) {
    case "reading-file": return "Чтение файла";
    case "normalizing": return "Подготовка изображения";
    case "selecting-pdf-page": return "Выбор страницы PDF";
    case "calibrating": return "Калибровка масштаба";
    case "saving": return "Сохранение подложки";
    case "failed": return "Ошибка обработки";
    case "ready": return "Подложка настроена";
    case "idle": return referencePlan ? "Подложка настроена" : "Загрузка исходного плана";
  }
}

export function ReferencePanel({
  referencePlan,
  assetBlob,
  missingAsset,
  navigation,
  onInstall,
  onUpdate,
  onRemove,
  onStartTracing,
  onFitReference,
}: ReferencePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<LoadedPdfReference | null>(null);
  const [state, setState] = useState<ReferenceImportState>({ kind: "idle" });
  const [removePending, setRemovePending] = useState(false);

  useEffect(() => () => { const pdf = pdfRef.current; if (pdf) void pdf.destroy(); }, []);

  const dispatch = (event: Parameters<typeof reduceReferenceImport>[1]) => setState((current) => reduceReferenceImport(current, event));

  const beginFile = async (file: File) => {
    const fileName = file.name;
    dispatch({ type: "choose-file", fileName });
    try {
      const inspected = await inspectReferenceFile(file);
      if (inspected.type === "pdf") {
        const pdf = await loadPdfReference(inspected.bytes);
        await pdfRef.current?.destroy();
        pdfRef.current = pdf;
        if (pdf.pageCount > 1) dispatch({ type: "pdf-loaded", fileName, pageCount: pdf.pageCount });
        else {
          dispatch({ type: "normalizing", fileName, progressLabel: "Готовим страницу PDF…" });
          const raster = await pdf.renderPage(1);
          dispatch({ type: "raster-ready", fileName, raster, source: "pdf", pageNumber: 1, pageCount: 1 });
        }
        return;
      }
      dispatch({ type: "normalizing", fileName, progressLabel: "Готовим изображение…" });
      const raster = await normalizeImageFile(file);
      dispatch({ type: "raster-ready", fileName, raster, source: inspected.type });
    } catch (cause) { setState(stateError(cause)); }
  };

  const renderSelectedPdfPage = async () => {
    if (state.kind !== "selecting-pdf-page" || !pdfRef.current) return;
    try {
      const { fileName, selectedPage, pageCount } = state;
      dispatch({ type: "normalizing", fileName, progressLabel: `Готовим страницу ${selectedPage}…` });
      const raster = await pdfRef.current.renderPage(selectedPage);
      dispatch({ type: "raster-ready", fileName, raster, source: "pdf", pageNumber: selectedPage, pageCount });
    } catch (cause) { setState(stateError(cause)); }
  };

  const saveCalibration = async () => {
    if (state.kind !== "calibrating" || !state.draft.pointA || !state.draft.pointB) return;
    try {
      const knownLengthMm = parseCalibrationLength(state.draft.lengthInput);
      dispatch({ type: "saving" });
      await onInstall({
        raster: state.raster,
        source: state.source === "pdf"
          ? { kind: "pdf", pageNumber: state.pageNumber ?? 1, pageCount: state.pageCount ?? 1 }
          : { kind: "image", originalMimeType: state.source === "png" ? "image/png" : "image/jpeg" },
        pointA: state.draft.pointA,
        pointB: state.draft.pointB,
        knownLengthMm,
        alignment: state.draft.alignment,
      });
      dispatch({ type: "saved" });
      await pdfRef.current?.destroy();
      pdfRef.current = null;
    } catch (cause) { setState(stateError(cause)); }
  };

  const updateDisplay = (patch: Partial<ReferencePlan["display"]>) => {
    if (referencePlan) onUpdate({ ...referencePlan, display: { ...referencePlan.display, ...patch } });
  };
  const updateTransform = (patch: Partial<ReferencePlan["transform"]>) => {
    if (referencePlan) onUpdate({ ...referencePlan, transform: { ...referencePlan.transform, ...patch } });
  };

  const descriptor = describeReferenceContext({
    phase: referenceWorkflowPhase(state, referencePlan, missingAsset),
    returnLabel: navigation.label,
  });

  return (
    <ContextPanelFrame descriptor={descriptor} navigation={navigation} className="reference-panel">
      <input ref={inputRef} className="visually-hidden" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" aria-label="Загрузить план квартиры" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void beginFile(file); }} />
      {missingAsset ? <div className="reference-warning" role="alert">Файл подложки не найден. Квартира сохранена; загрузите план заново или удалите ссылку.</div> : null}

      {state.kind === "idle" || state.kind === "ready" || state.kind === "failed" ? <>
        {state.kind === "failed" ? <div className="reference-error" role="alert">{state.message}</div> : null}
        {!referencePlan || missingAsset ? <ContextSection title="Исходный план" description="JPG, PNG и PDF обрабатываются только в браузере.">
          <button className="primary-action" type="button" onClick={() => inputRef.current?.click()}>Загрузить JPG, PNG или PDF</button>
        </ContextSection> : <>
          <ContextSection title="Работа с подложкой">
            <div className="reference-actions"><button className="primary-action" type="button" onClick={onStartTracing}>Начать обводку</button><button className="secondary-action" type="button" onClick={onFitReference}>Показать подложку</button></div>
            <label className="reference-toggle"><input type="checkbox" checked={referencePlan.display.visible} onChange={(event) => updateDisplay({ visible: event.target.checked })} /><span>Показывать подложку</span></label>
            <label className="reference-toggle"><input type="checkbox" checked={referencePlan.display.locked} onChange={(event) => updateDisplay({ locked: event.target.checked })} /><span>Заблокировать положение</span></label>
          </ContextSection>

          <ContextSection title="Отображение" description="Эти изменения применяются сразу и сохраняются локально вместе с проектом.">
            <label className="field-label">Прозрачность: {Math.round(referencePlan.display.opacity * 100)}%</label>
            <input className="reference-range" type="range" min="5" max="100" value={Math.round(referencePlan.display.opacity * 100)} onChange={(event) => updateDisplay({ opacity: Number(event.target.value) / 100 })} />
            <div className="field-pair"><label className="field-label">X, мм<input type="number" value={Math.round(referencePlan.transform.originWorld.x)} onChange={(event) => updateTransform({ originWorld: { ...referencePlan.transform.originWorld, x: Number(event.target.value) } })} /></label><label className="field-label">Y, мм<input type="number" value={Math.round(referencePlan.transform.originWorld.y)} onChange={(event) => updateTransform({ originWorld: { ...referencePlan.transform.originWorld, y: Number(event.target.value) } })} /></label></div>
            <label className="field-label">Поворот, °<input type="number" step="0.1" value={referencePlan.transform.rotationDeg} onChange={(event) => updateTransform({ rotationDeg: Number(event.target.value) })} /></label>
            <button className="secondary-action" type="button" onClick={() => inputRef.current?.click()}>Заменить план</button>
          </ContextSection>

          <ContextDangerZone title="Удаление подложки" description="Стены, проёмы и мебель останутся. Удалится только исходный план.">
            {!removePending ? <button className="danger-action" type="button" onClick={() => setRemovePending(true)}>Удалить подложку</button> : <div className="reference-remove-confirm"><p>Стены, проёмы и мебель останутся. Удалить только исходный план?</p><button className="secondary-action" type="button" onClick={() => setRemovePending(false)}>Отмена</button><button className="danger-action" type="button" onClick={() => void onRemove().then(() => setRemovePending(false))}>Удалить</button></div>}
          </ContextDangerZone>
        </>}
      </> : null}

      {state.kind === "reading-file" || state.kind === "normalizing" || state.kind === "saving" ? <div className="reference-progress" role="status">{state.kind === "reading-file" ? "Читаем файл…" : state.kind === "saving" ? "Сохраняем подложку…" : state.progressLabel}</div> : null}
      {state.kind === "selecting-pdf-page" ? <ContextSection title="Выберите страницу PDF" description={`В документе ${state.pageCount} страниц.`}><input type="number" min="1" max={state.pageCount} value={state.selectedPage} onChange={(event) => dispatch({ type: "select-pdf-page", pageNumber: Number(event.target.value) })} /><button className="primary-action" type="button" onClick={() => void renderSelectedPdfPage()}>Открыть страницу</button><button className="secondary-action" type="button" onClick={() => dispatch({ type: "cancel" })}>Отмена</button></ContextSection> : null}
      {state.kind === "calibrating" ? <ContextSection title="Калибровка масштаба" description="Укажите две точки известного размера — например, концы размерной линии или ширину двери."><CalibrationStage raster={state.raster} draft={state.draft} onChange={(patch) => dispatch({ type: "update-calibration", patch })} /><label className="field-label">Реальная длина<input value={state.draft.lengthInput} placeholder="Например, 3200 или 3,2 м" onChange={(event) => dispatch({ type: "update-calibration", patch: { lengthInput: event.target.value } })} /></label><label className="field-label">Выравнивание<select value={state.draft.alignment} onChange={(event) => dispatch({ type: "update-calibration", patch: { alignment: event.target.value as ReferenceAlignment } })}><option value="none">Не выравнивать</option><option value="horizontal">Эта линия горизонтальная</option><option value="vertical">Эта линия вертикальная</option></select></label><div className="calibration-point-fields"><span>A: {state.draft.pointA ? `${Math.round(state.draft.pointA.x)}, ${Math.round(state.draft.pointA.y)} px` : "не выбрана"}</span><span>B: {state.draft.pointB ? `${Math.round(state.draft.pointB.x)}, ${Math.round(state.draft.pointB.y)} px` : "не выбрана"}</span></div><button className="primary-action" type="button" disabled={!state.draft.pointA || !state.draft.pointB || !state.draft.lengthInput.trim()} onClick={() => void saveCalibration()}>Сохранить и открыть план</button><button className="secondary-action" type="button" onClick={() => { dispatch({ type: "cancel" }); void pdfRef.current?.destroy(); pdfRef.current = null; }}>Отмена</button></ContextSection> : null}
      {assetBlob && referencePlan ? <p className="reference-local-note">Подложка сохранена локально: {(assetBlob.size / 1024 / 1024).toFixed(1)} МБ.</p> : null}
    </ContextPanelFrame>
  );
}