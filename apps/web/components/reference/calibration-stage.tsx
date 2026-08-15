"use client";

import type { Point2 } from "@vlezet/geometry";
import Image from "next/image";
import { useState } from "react";
import {
  createCalibrationStageHandlers,
  INITIAL_CALIBRATION_STAGE_STATE,
  type CalibrationStageElementLike,
  type CalibrationStageSnapshot,
} from "./calibration-stage-controller";
import {
  readCalibrationFeaturesFromImage,
  type CalibrationCanvasFactory,
} from "./calibration-image-features";
import { imagePointToViewportPoint, type CalibrationViewportTransform } from "./calibration-viewport";

const DEFAULT_VIEWPORT: CalibrationViewportTransform = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 });
const FEATURE_RADIUS_PX = 20;
const FEATURE_CONTRAST_THRESHOLD = 60;
const FEATURE_DARKNESS_THRESHOLD = 120;
const FEATURE_MAXIMUM_LINE_WIDTH_PX = 6;

type CalibrationStageDraft = Readonly<{
  pointA: Point2 | null;
  pointB: Point2 | null;
}>;

export type PrecisionCalibrationStageProps = Readonly<{
  image: HTMLImageElement | null;
  error: string | null;
  draft: CalibrationStageDraft;
  onChange: (patch: Partial<CalibrationStageDraft>) => void;
  initialState?: CalibrationStageSnapshot;
}>;

export function currentCalibrationStage(
  element: HTMLDivElement | null,
): CalibrationStageElementLike | null {
  return element;
}

export function calibrationStageFeatureReader(
  image: HTMLImageElement,
  point: Point2,
  createCanvas?: CalibrationCanvasFactory,
) {
  return readCalibrationFeaturesFromImage({
    image,
    point,
    radiusPx: FEATURE_RADIUS_PX,
    contrastThreshold: FEATURE_CONTRAST_THRESHOLD,
    darknessThreshold: FEATURE_DARKNESS_THRESHOLD,
    maximumLineWidthPx: FEATURE_MAXIMUM_LINE_WIDTH_PX,
    createCanvas,
  });
}

function markerPosition(point: Point2, viewport: CalibrationViewportTransform) {
  const position = imagePointToViewportPoint({ imagePoint: point, transform: viewport });
  return { left: position.x, top: position.y };
}

function pointText(point: Point2) {
  return `${point.x.toFixed(2)}, ${point.y.toFixed(2)}`;
}

function activePoint(
  handle: CalibrationStageSnapshot["activeHandle"],
  draft: CalibrationStageDraft,
): Point2 | null {
  if (handle === null) return null;
  return handle === "a" ? draft.pointA : draft.pointB;
}

function magnifierStyle(image: HTMLImageElement, point: Point2) {
  const zoom = 2;
  const radius = 52;
  return {
    backgroundImage: `url("${image.src}")`,
    backgroundSize: `${image.naturalWidth * zoom}px ${image.naturalHeight * zoom}px`,
    backgroundPosition: `${radius - point.x * zoom}px ${radius - point.y * zoom}px`,
  };
}

export function PrecisionCalibrationStage({
  image,
  error,
  draft,
  onChange,
  initialState,
}: PrecisionCalibrationStageProps) {
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null);
  const [stageState, setStageState] = useState<CalibrationStageSnapshot>(
    initialState ?? { ...INITIAL_CALIBRATION_STAGE_STATE, viewport: DEFAULT_VIEWPORT },
  );

  if (error) return <p className="field-error">{error}</p>;
  if (!image) return <p className="reference-preview-loading">Подготавливаем предпросмотр…</p>;

  const viewport = stageState.viewport ?? DEFAULT_VIEWPORT;
  const pointAViewport = draft.pointA === null ? null : markerPosition(draft.pointA, viewport);
  const pointBViewport = draft.pointB === null ? null : markerPosition(draft.pointB, viewport);
  const magnifiedPoint = activePoint(stageState.activeHandle, draft) ?? stageState.hoverPoint;
  const handlers = createCalibrationStageHandlers({
    state: stageState,
    setState: setStageState,
    draft,
    onChange,
    stage: currentCalibrationStage.bind(null, stageElement),
    sourceImage: image,
    readFeatures: calibrationStageFeatureReader.bind(null, image),
  });

  return (
    <div className="calibration-stage-wrap">
      <div className="calibration-stage-controls">
        <button type="button" className="secondary-action calibration-fit-action" onClick={handlers.onFit}>
          Вписать план
        </button>
        <label className="calibration-snap-toggle">
          <input
            type="checkbox"
            aria-label="Привязка к линиям плана"
            checked={stageState.snapEnabled}
            onChange={handlers.onSnapChange}
          />
          <span>Привязка к линиям плана</span>
        </label>
        <span className="calibration-snap-status" data-snap-enabled={String(stageState.snapEnabled)}>
          {stageState.activeCandidateId}
        </span>
      </div>

      <div
        ref={setStageElement}
        className="calibration-stage"
        tabIndex={0}
        style={{ height: 300, touchAction: "none" }}
        onWheel={handlers.onWheel}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
        onPointerLeave={handlers.onPointerLeave}
        onKeyDown={handlers.onKeyDown}
        onKeyUp={handlers.onKeyUp}
      >
        <Image
          src={image.src}
          alt="Подложка для калибровки"
          width={image.naturalWidth}
          height={image.naturalHeight}
          unoptimized
          draggable={false}
          onLoad={handlers.onImageLoad}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: image.naturalWidth,
            height: image.naturalHeight,
            maxHeight: "none",
            objectFit: "fill",
            transformOrigin: "0 0",
            transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
          }}
        />

        {pointAViewport && pointBViewport ? (
          <svg className="calibration-line" aria-hidden="true">
            <line x1={pointAViewport.left} y1={pointAViewport.top} x2={pointBViewport.left} y2={pointBViewport.top} />
          </svg>
        ) : null}

        {draft.pointA && pointAViewport ? (
          <span
            className="calibration-handle"
            data-calibration-point="a"
            style={pointAViewport}
            aria-label={`Точка A: ${pointText(draft.pointA)}`}
          >
            A
            <span className="calibration-coordinate-readout">{pointText(draft.pointA)}</span>
          </span>
        ) : null}

        {draft.pointB && pointBViewport ? (
          <span
            className="calibration-handle is-b"
            data-calibration-point="b"
            style={pointBViewport}
            aria-label={`Точка B: ${pointText(draft.pointB)}`}
          >
            B
            <span className="calibration-coordinate-readout">{pointText(draft.pointB)}</span>
          </span>
        ) : null}

        {magnifiedPoint ? (
          <div className="calibration-magnifier" style={magnifierStyle(image, magnifiedPoint)} aria-hidden="true">
            <span
              className="calibration-magnifier-crosshair"
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 28,
                height: 28,
                transform: "translate(-50%, -50%)",
                border: "1px solid rgba(23, 105, 255, .9)",
                borderRadius: "50%",
                background: "linear-gradient(90deg, transparent 48%, #1769ff 49%, #1769ff 51%, transparent 52%), linear-gradient(0deg, transparent 48%, #1769ff 49%, #1769ff 51%, transparent 52%)",
              }}
            />
            <span className="calibration-magnifier-coordinate">{pointText(magnifiedPoint)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
