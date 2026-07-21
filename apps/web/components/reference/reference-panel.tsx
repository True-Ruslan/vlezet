"use client";

import type { Point2 } from "@vlezet/geometry";
import type { ReferenceAlignment, ReferencePlan } from "@vlezet/projects";
import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { parseCalibrationLength } from "./calibration-input";
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
  onInstall: (draft: ReferenceInstallDraft) => Promise<void>;
  onUpdate: (referencePlan: ReferencePlan) => void;
  onRemove: () => Promise<void>;
  onStartTracing: () => void;
  onFitReference: () => void;
  onClose: () => void;
}>;

function stateError(error: unknown): ReferenceImportState {
  if (error instanceof ReferenceImportError) return { kind: "failed", code: error.code, message: error.message };
  console.error(error);
  return { kind: "failed", code: "decode-failed", message: "Не удалось обработать выбранный план." };
}

function imagePoint(event: ReactPointerEvent<HTMLElement>, container: HTMLElement, image: HTMLImageElement): Point2 {
  const rect = container.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(image.naturalWidth, (event.clientX - rect.left) / rect.width * image.naturalWidth)),
    y: Math.max(0, Math.min(image.naturalHeight, (event.clientY - rect.top) / rect.height * image.naturalHeight)),
  };
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
  const stageRef = useRef<HTMLDivElement>(null);
  const { image, error } = useReferenceImage(raster.blob);
  const [dragging, setDragging] = useState<"a" | "b" | null>(null);
  const [hover, setHover] = useState<Point2 | null>(null);

  if (error) return <div className="reference-error" role="alert">{error}</div>;
  if (!image) return <div className="reference-progress">Подготавливаем предпросмотр…</div>;

  const setPoint = (kind: "a" | "b", point: Point2) => onChange(kind === "a" ? { pointA: point } : { pointB: point });
  const nearestHandle = (point: Point2): "a" | "b" | null => {
    const candidates = (["a", "b"] as const).flatMap((kind) => {
      const existing = kind === "a" ? draft.pointA : draft.pointB;
      return existing ? [{ kind, distance: Math.hypot(point.x - existing.x, point.y - existing.y) }] : [];
    });
    const nearest = candidates.sort((first, second) => first.distance - second.distance)[0];
    const tolerance = Math.max(image.naturalWidth, image.naturalHeight) * 0.035;
    return nearest && nearest.distance <= tolerance ? nearest.kind : null;
  };
  const assignNewPoint = (point: Point2) => {
    if (!draft.pointA) setPoint("a", point);
    else if (!draft.pointB) setPoint("b", point);
    else setPoint(nearestHandle(point) ?? "b", point);
  };
  const pointForEvent = (event: ReactPointerEvent<HTMLElement>) => {
    const stage = stageRef.current;
    return stage ? imagePoint(event, stage, image) : null;
  };

  const marker = (kind: "a" | "b", point: Point2 | null) => point ? (
    <span
      className={`calibration-handle is-${kind}`}
      aria-hidden="true"
      style={{ left: `${point.x / image.naturalWidth * 100}%`, top: `${point.y / image.naturalHeight * 100}%` }}
    >{kind.toUpperCase()}</span>
  ) : null;

  const magnifierPoint = dragging === "a" ? draft.pointA : dragging === "b" ? draft.pointB : hover;

  return (
    <div className="calibration-stage-wrap">
      <div
        ref={stageRef}
        className="calibration-stage"
        onPointerDown={(event) => {
          const point = pointForEvent(event);
          if (!point) return;
          const handle = nearestHandle(point);
          if (handle) { setDragging(handle); setPoint(handle, point); }
          else assignNewPoint(point);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const point = pointForEvent(event);
          if (!point) return;
          setHover(point);
          if (dragging) setPoint(dragging, point);
        }}
        onPointerUp={(event) => { setDragging(null); event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => setDragging(null)}
        onPointerLeave={() => { if (!dragging) setHover(null); }}
      >
        <Image src={image.src} alt="Загруженный план для калибровки" width={image.naturalWidth} height={image.naturalHeight} unoptimized draggable={false} />
        {draft.pointA && draft.pointB ? <svg className="calibration-line" viewBox={`0 0 ${image.naturalWidth} ${image.naturalHeight}`} preserveAspectRatio="none" aria-hidden="true"><line x1={draft.pointA.x} y1={draft.pointA.y} x2={draft.pointB.x} y2={draft.pointB.y} /></svg> : null}
        {marker("a", draft.pointA)}
        {marker("b", draft.pointB)}
      </div>
      {magnifierPoint ? (
        <div
          className="calibration-magnifier"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${image.src})`,
            backgroundSize: `${image.naturalWidth * 2}px ${image.naturalHeight * 2}px`,
            backgroundPosition: `${-magnifierPoint.x * 2 + 55}px ${-magnifierPoint.y * 2 + 55}px`,
          }}
        />
      ) : null}
    </div>
  );
}

export function ReferencePanel({
  referencePlan,
  assetBlob,
  missingAsset,
  onInstall,
  onUpdate,
  onRemove,
  onStartTracing,
  onFitReference,
  onClose,
}: ReferencePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<LoadedPdfReference | null>(null);
  const [state, setState] = useState<ReferenceImportState>({ kind: "idle" });
  const [removePending, setRemovePending] = useState(false);

  useEffect(() => () => { const pdf = pdfRef.current; if (pdf) void pdf.destroy(); }, []);

  const dispatch = (event: Parameters<typeof reduceReferenceImport>[1]) => setState((current) => reduceReferenceImport(current, event));

  const beginFile = async (file: File) => {
    dispatch({ type: "choose-file", fileName: file.name });
    try {
      const inspected = await inspectReferenceFile(file);
      if (inspected.type === "pdf") {
        const pdf = await loadPdfReference(inspected.bytes);
        await pdfRef.current?.destroy();
        pdfRef.current = pdf;
        if (pdf.pageCount > 1) dispatch({ type: "pdf-loaded", fileName: file.name, pageCount: pdf.pageCount });
        else {
          dispatch({ type: "normalizing", fileName: file.name, progressLabel: "Готовим страницу PDF…" });
          const raster = await pdf.renderPage(1);
          dispatch({ type: "raster-ready", fileName: file.name, raster, source: "pdf", pageNumber: 1, pageCount: 1 });
        }
        return;
      }
      dispatch({ type: "normalizing", fileName: file.name, progressLabel: "Готовим изображение…" });
      const raster = await normalizeImageFile(file);
      dispatch({ type: "raster-ready", fileName: file.name, raster, source: inspected.type });
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

  return (
    <aside className="reference-panel" aria-label="Подложка плана">
      <div className="reference-panel-heading"><div><strong>Подложка</strong><span>План обрабатывается только в браузере</span></div><button type="button" onClick={onClose} aria-label="Закрыть панель">×</button></div>
      <input ref={inputRef} className="visually-hidden" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" aria-label="Загрузить план квартиры" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void beginFile(file); }} />
      {missingAsset ? <div className="reference-warning" role="alert">Файл подложки не найден. Квартира сохранена; загрузите план заново или удалите ссылку.</div> : null}

      {state.kind === "idle" || state.kind === "ready" || state.kind === "failed" ? <>
        {state.kind === "failed" ? <div className="reference-error" role="alert">{state.message}</div> : null}
        {!referencePlan || missingAsset ? <button className="primary-action" type="button" onClick={() => inputRef.current?.click()}>Загрузить JPG, PNG или PDF</button> : <>
          <div className="reference-actions"><button className="primary-action" type="button" onClick={onStartTracing}>Начать обводку</button><button className="secondary-action" type="button" onClick={onFitReference}>Показать подложку</button></div>
          <label className="reference-toggle"><input type="checkbox" checked={referencePlan.display.visible} onChange={(event) => updateDisplay({ visible: event.target.checked })} /><span>Показывать подложку</span></label>
          <label className="reference-toggle"><input type="checkbox" checked={referencePlan.display.locked} onChange={(event) => updateDisplay({ locked: event.target.checked })} /><span>Заблокировать положение</span></label>
          <label className="field-label">Прозрачность: {Math.round(referencePlan.display.opacity * 100)}%</label>
          <input className="reference-range" type="range" min="5" max="100" value={Math.round(referencePlan.display.opacity * 100)} onChange={(event) => updateDisplay({ opacity: Number(event.target.value) / 100 })} />
          <div className="field-pair"><label className="field-label">X, мм<input type="number" value={Math.round(referencePlan.transform.originWorld.x)} onChange={(event) => updateTransform({ originWorld: { ...referencePlan.transform.originWorld, x: Number(event.target.value) } })} /></label><label className="field-label">Y, мм<input type="number" value={Math.round(referencePlan.transform.originWorld.y)} onChange={(event) => updateTransform({ originWorld: { ...referencePlan.transform.originWorld, y: Number(event.target.value) } })} /></label></div>
          <label className="field-label">Поворот, °<input type="number" step="0.1" value={referencePlan.transform.rotationDeg} onChange={(event) => updateTransform({ rotationDeg: Number(event.target.value) })} /></label>
          <button className="secondary-action" type="button" onClick={() => inputRef.current?.click()}>Заменить план</button>
          {!removePending ? <button className="danger-action" type="button" onClick={() => setRemovePending(true)}>Удалить подложку</button> : <div className="reference-remove-confirm"><p>Стены и мебель останутся. Удалить только исходный план?</p><button className="secondary-action" type="button" onClick={() => setRemovePending(false)}>Отмена</button><button className="danger-action" type="button" onClick={() => void onRemove().then(() => setRemovePending(false))}>Удалить</button></div>}
        </>}
      </> : null}

      {state.kind === "reading-file" || state.kind === "normalizing" || state.kind === "saving" ? <div className="reference-progress" role="status">{state.kind === "reading-file" ? "Читаем файл…" : state.kind === "saving" ? "Сохраняем подложку…" : state.progressLabel}</div> : null}
      {state.kind === "selecting-pdf-page" ? <div className="pdf-page-step"><h2>Выберите страницу PDF</h2><p>В документе {state.pageCount} страниц.</p><input type="number" min="1" max={state.pageCount} value={state.selectedPage} onChange={(event) => dispatch({ type: "select-pdf-page", pageNumber: Number(event.target.value) })} /><button className="primary-action" type="button" onClick={() => void renderSelectedPdfPage()}>Открыть страницу</button><button className="secondary-action" type="button" onClick={() => dispatch({ type: "cancel" })}>Отмена</button></div> : null}
      {state.kind === "calibrating" ? <div className="calibration-step"><h2>Калибровка масштаба</h2><p>Укажите две точки известного размера — например, концы размерной линии или ширину двери.</p><CalibrationStage raster={state.raster} draft={state.draft} onChange={(patch) => dispatch({ type: "update-calibration", patch })} /><label className="field-label">Реальная длина<input value={state.draft.lengthInput} placeholder="Например, 3200 или 3,2 м" onChange={(event) => dispatch({ type: "update-calibration", patch: { lengthInput: event.target.value } })} /></label><label className="field-label">Выравнивание<select value={state.draft.alignment} onChange={(event) => dispatch({ type: "update-calibration", patch: { alignment: event.target.value as ReferenceAlignment } })}><option value="none">Не выравнивать</option><option value="horizontal">Эта линия горизонтальная</option><option value="vertical">Эта линия вертикальная</option></select></label><div className="calibration-point-fields"><span>A: {state.draft.pointA ? `${Math.round(state.draft.pointA.x)}, ${Math.round(state.draft.pointA.y)} px` : "не выбрана"}</span><span>B: {state.draft.pointB ? `${Math.round(state.draft.pointB.x)}, ${Math.round(state.draft.pointB.y)} px` : "не выбрана"}</span></div><button className="primary-action" type="button" disabled={!state.draft.pointA || !state.draft.pointB || !state.draft.lengthInput.trim()} onClick={() => void saveCalibration()}>Сохранить и открыть план</button><button className="secondary-action" type="button" onClick={() => { dispatch({ type: "cancel" }); void pdfRef.current?.destroy(); pdfRef.current = null; }}>Отмена</button></div> : null}
      {assetBlob && referencePlan ? <p className="reference-local-note">Подложка сохранена локально: {(assetBlob.size / 1024 / 1024).toFixed(1)} МБ.</p> : null}
    </aside>
  );
}
