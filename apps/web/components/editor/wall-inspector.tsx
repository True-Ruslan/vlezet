"use client";

import type { Opening, VlezetDocument, Wall } from "@vlezet/domain";
import {
  MAX_WALL_THICKNESS_MM,
  MIN_WALL_THICKNESS_MM,
  topologicalWallLength,
  type ClearRoomDimensionAnchor,
  type WallThicknessAlignment,
} from "@vlezet/editor-core";
import {
  deriveRectangularRoomDimensions,
  deriveRooms,
  deriveSingleAdjacentRoomSide,
  type DerivedRoom,
  type Point2,
} from "@vlezet/geometry";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { PlanningPanel } from "../planning/planning-panel";
import { planningUiStore } from "../planning/planning-ui-store";
import { UiButton } from "../ui/ui-button";
import { UiCard } from "../ui/ui-card";
import { UiField, UiFieldMessage } from "../ui/ui-field";
import { formatSquareMeters } from "../ui/presentation-format";
import {
  describeEmptyContext,
  describeOpeningContext,
  describeRoomContext,
  describeWallContext,
} from "./context-panel-contract";
import {
  ContextDangerZone,
  ContextPanelFrame,
  ContextSection,
  type ContextPanelNavigation,
} from "./context-panel-frame";
import { DoorSwingSelector } from "./door-swing-selector";
import { GeometrySpanCue } from "./geometry-span-cue";
import { geometryInspectorPreviewStore } from "./geometry-inspector-preview-store";
import {
  canonicalOpeningOffsetMm,
  deriveDoorSwingChoices,
  deriveOpeningCueDraft,
  deriveWallVisualModel,
  displayedOpeningOffsetMm,
  physicalFaceChoices,
  wallLengthAnchorForVisualRole,
  type DoorSwingValue,
  type OpeningOffsetReference,
  type VisualEndpointRole,
  type WallVisualModel,
} from "./geometry-inspector-presentation";
import { ObjectInspector } from "./object-inspector";
import { OpeningPositionCue } from "./opening-position-cue";
import { editorStore } from "./use-editor-store";
import { WallAxisCue } from "./wall-axis-cue";
import { resolveWallThicknessAlignment, type WallThicknessGrowthIntent } from "./wall-thickness-intent";
import { WallThicknessCue } from "./wall-thickness-cue";

const DEFAULT_PLANNING_NAVIGATION: ContextPanelNavigation = {
  label: "К комнате",
  onActivate: () => planningUiStore.getState().close(),
};

function wallVersionKey(document: VlezetDocument, wall: Wall): string {
  const start = document.vertices.find((vertex) => vertex.id === wall.startVertexId)?.position;
  const end = document.vertices.find((vertex) => vertex.id === wall.endVertexId)?.position;
  return [wall.id, start?.x, start?.y, end?.x, end?.y, wall.thickness, ...wall.junctionVertexIds].join(":");
}

function connectionCount(document: VlezetDocument, wall: Wall): number {
  const connected = new Set(wall.junctionVertexIds);
  for (const vertexId of [wall.startVertexId, wall.endVertexId]) {
    const shared = document.walls.some((candidate) => candidate.id !== wall.id && (
      candidate.startVertexId === vertexId ||
      candidate.endVertexId === vertexId ||
      candidate.junctionVertexIds.includes(vertexId)
    ));
    if (shared) connected.add(vertexId);
  }
  return connected.size;
}

function wallEndpoints(document: VlezetDocument, wall: Wall): Readonly<{ start: Point2; end: Point2 }> {
  const start = document.vertices.find((vertex) => vertex.id === wall.startVertexId)?.position;
  const end = document.vertices.find((vertex) => vertex.id === wall.endVertexId)?.position;
  if (!start || !end) throw new Error("Не удалось определить концы стены.");
  return { start, end };
}

function parseDecimal(raw: string): number {
  return Number(raw.replace(",", "."));
}

function fromEndpointLabel(model: WallVisualModel, reference: OpeningOffsetReference): string {
  const short = reference === "visual-start" ? model.visualStartShort : model.visualEndShort;
  if (short === "слева") return "От левого конца";
  if (short === "справа") return "От правого конца";
  if (short === "сверху") return "От верхнего конца";
  if (short === "снизу") return "От нижнего конца";
  if (short === "сверху слева") return "От верхнего левого конца";
  if (short === "сверху справа") return "От верхнего правого конца";
  if (short === "снизу слева") return "От нижнего левого конца";
  return "От нижнего правого конца";
}

function openingDistanceLabel(model: WallVisualModel, reference: OpeningOffsetReference): string {
  const short = reference === "visual-start" ? model.visualStartShort : model.visualEndShort;
  return `До проёма ${short}`;
}

function formatDraftMillimeters(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function SelectedWallInspector({ document, wall }: Readonly<{ document: VlezetDocument; wall: Wall }>) {
  const currentLength = topologicalWallLength(document, wall.id);
  const interiorSide = deriveSingleAdjacentRoomSide(document, wall.id);
  const { start, end } = wallEndpoints(document, wall);
  const visualModel = deriveWallVisualModel(start, end);
  const physicalChoices = physicalFaceChoices(visualModel);
  const interiorChoices = [
    { id: "inside", label: "Внутренняя поверхность" },
    { id: "center", label: "Ось стены" },
    { id: "outside", label: "Наружная поверхность" },
  ] as const;

  const [lengthInput, setLengthInput] = useState(() => String(Math.round(currentLength)));
  const [fixedRole, setFixedRole] = useState<VisualEndpointRole>("visual-start");
  const [thicknessInput, setThicknessInput] = useState(() => String(Math.round(wall.thickness)));
  const [thicknessGrowthIntent, setThicknessGrowthIntent] = useState<WallThicknessGrowthIntent>("center");
  const [explicitThicknessAlignment, setExplicitThicknessAlignment] = useState<WallThicknessAlignment>("center");
  const [lengthError, setLengthError] = useState<string | null>(null);
  const [thicknessError, setThicknessError] = useState<string | null>(null);

  const applyLength = () => {
    const value = parseDecimal(lengthInput);
    if (!Number.isFinite(value) || value <= 0) {
      setLengthError("Введите положительную длину в миллиметрах.");
      return;
    }
    try {
      editorStore.getState().setSelectedWallLength(value, wallLengthAnchorForVisualRole(visualModel, fixedRole));
      setLengthError(null);
    } catch (cause) {
      setLengthError(cause instanceof Error ? cause.message : "Не удалось изменить осевую длину.");
    }
  };

  const applyThickness = () => {
    const value = parseDecimal(thicknessInput);
    if (!Number.isFinite(value)) {
      setThicknessError("Введите толщину стены в миллиметрах.");
      return;
    }
    const alignment = interiorSide
      ? resolveWallThicknessAlignment(interiorSide, thicknessGrowthIntent)
      : explicitThicknessAlignment;
    try {
      editorStore.getState().setSelectedWallThickness(value, alignment);
      setThicknessError(null);
    } catch (cause) {
      setThicknessError(cause instanceof Error ? cause.message : "Не удалось изменить толщину.");
    }
  };

  return (
    <ContextPanelFrame descriptor={describeWallContext({ lengthMm: currentLength, thicknessMm: wall.thickness })}>
      <ContextSection title="Длина по оси" description="Расстояние между узлами стены. Это не всегда равно чистому внутреннему размеру комнаты.">
        <UiCard className="geometry-inspector-card">
          <WallAxisCue model={visualModel} fixedRole={fixedRole} />
          <UiField
            id="wall-length"
            label="Длина по оси стены"
            unit="мм"
            invalid={Boolean(lengthError)}
            message={lengthError ? <UiFieldMessage tone="error" live>{lengthError}</UiFieldMessage> : undefined}
          >
            <input
              inputMode="decimal"
              value={lengthInput}
              onChange={(event) => setLengthInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applyLength(); }}
            />
          </UiField>
          <UiField id="wall-length-anchor" label="Что оставить на месте">
            <select value={fixedRole} onChange={(event) => setFixedRole(event.target.value as VisualEndpointRole)}>
              <option value="visual-start">{visualModel.visualStartLabel}</option>
              <option value="center">Центр</option>
              <option value="visual-end">{visualModel.visualEndLabel}</option>
            </select>
          </UiField>
          <UiButton variant="primary" onClick={applyLength}>Применить осевую длину</UiButton>
        </UiCard>
      </ContextSection>

      <ContextSection title="Толщина стены">
        <UiCard className="geometry-inspector-card">
          <WallThicknessCue
            choices={interiorSide ? interiorChoices : physicalChoices}
            selectedId={interiorSide ? thicknessGrowthIntent : physicalChoices.find((choice) => choice.alignment === explicitThicknessAlignment)?.id ?? "axis"}
            interiorChoice={Boolean(interiorSide)}
          />
          <UiField
            id="wall-thickness"
            label="Толщина стены"
            unit="мм"
            invalid={Boolean(thicknessError)}
            message={thicknessError ? <UiFieldMessage tone="error" live>{thicknessError}</UiFieldMessage> : undefined}
          >
            <input
              inputMode="decimal"
              min={MIN_WALL_THICKNESS_MM}
              max={MAX_WALL_THICKNESS_MM}
              value={thicknessInput}
              onChange={(event) => setThicknessInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applyThickness(); }}
            />
          </UiField>
          {interiorSide ? (
            <UiField id="wall-thickness-growth" label="Что оставить на месте">
              <select value={thicknessGrowthIntent} onChange={(event) => setThicknessGrowthIntent(event.target.value as WallThicknessGrowthIntent)}>
                <option value="inside">Внутренняя поверхность</option>
                <option value="center">Ось стены</option>
                <option value="outside">Наружная поверхность</option>
              </select>
            </UiField>
          ) : (
            <UiField id="wall-thickness-face" label="Что оставить на месте">
              <select value={explicitThicknessAlignment} onChange={(event) => setExplicitThicknessAlignment(event.target.value as WallThicknessAlignment)}>
                {physicalChoices.map((choice) => <option key={choice.id} value={choice.alignment}>{choice.label}</option>)}
              </select>
            </UiField>
          )}
          <p className="inspector-hint">
            {interiorSide
              ? "Внутренняя сторона определена по единственному соседнему помещению. Выбранная поверхность останется на месте."
              : "У стены нет одной однозначной стороны помещения. Vlezet показывает реальные поверхности и не угадывает «внутрь» или «наружу»."}
          </p>
          <UiButton variant="secondary" onClick={applyThickness}>Применить толщину</UiButton>
        </UiCard>
      </ContextSection>

      <ContextSection title="Сведения">
        <dl className="wall-facts">
          <div><dt>По оси</dt><dd>{(currentLength / 1000).toFixed(3)} м</dd></div>
          <div><dt>Толщина</dt><dd>{wall.thickness} мм</dd></div>
          <div><dt>Соединений</dt><dd>{connectionCount(document, wall)}</dd></div>
        </dl>
        <p className="inspector-hint">Стены соединены настоящими узлами. Изменение общей вершины не разрывает соседние стены.</p>
      </ContextSection>
    </ContextPanelFrame>
  );
}

export function SelectedRoomInspector({ room }: Readonly<{ room: DerivedRoom }>) {
  const dimensions = deriveRectangularRoomDimensions(room);
  const [name, setName] = useState(room.name);
  const [widthInput, setWidthInput] = useState(() => dimensions ? String(Math.round(dimensions.widthMm)) : "");
  const [heightInput, setHeightInput] = useState(() => dimensions ? String(Math.round(dimensions.heightMm)) : "");
  const [widthAnchor, setWidthAnchor] = useState<ClearRoomDimensionAnchor>("min");
  const [heightAnchor, setHeightAnchor] = useState<ClearRoomDimensionAnchor>("min");
  const [nameError, setNameError] = useState<string | null>(null);
  const [widthError, setWidthError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);

  useEffect(() => () => {
    const current = geometryInspectorPreviewStore.getState().roomSpan;
    if (current?.roomId === room.id) geometryInspectorPreviewStore.getState().setRoomSpan(null);
  }, [room.id]);

  const applyName = () => {
    try {
      editorStore.getState().setSelectedRoomName(name);
      setNameError(null);
    } catch (cause) {
      setNameError(cause instanceof Error ? cause.message : "Не удалось переименовать комнату.");
    }
  };

  const applyDimension = (
    axis: "width" | "height",
    raw: string,
    anchor: ClearRoomDimensionAnchor,
    setError: (message: string | null) => void,
  ) => {
    const value = parseDecimal(raw);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Введите положительный внутренний размер в миллиметрах.");
      return;
    }
    try {
      editorStore.getState().setSelectedRoomClearDimension(axis, value, anchor);
      setError(null);
      geometryInspectorPreviewStore.getState().setRoomSpan(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить внутренний размер комнаты.");
    }
  };

  const areaLabel = formatSquareMeters(room.areaMm2 / 1_000_000);
  const clearSizeLabel = dimensions ? `${Math.round(dimensions.widthMm)} × ${Math.round(dimensions.heightMm)} мм внутри` : undefined;
  const preview = (axis: "horizontal" | "vertical") => geometryInspectorPreviewStore.getState().setRoomSpan({ roomId: room.id, axis });
  const clearPreview = () => geometryInspectorPreviewStore.getState().setRoomSpan(null);

  return (
    <ContextPanelFrame descriptor={describeRoomContext({ name: room.name, areaLabel, clearSizeLabel })}>
      <ContextSection title="Название">
        <UiField
          id="room-name"
          label="Название комнаты"
          invalid={Boolean(nameError)}
          message={nameError ? <UiFieldMessage tone="error" live>{nameError}</UiFieldMessage> : undefined}
        >
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyName(); }} />
        </UiField>
        <UiButton variant="primary" className="room-inspector-action" onClick={applyName}>Сохранить название</UiButton>
      </ContextSection>

      <ContextSection title="Внутренние размеры">
        {dimensions ? (
          <div className="room-clear-dimensions room-design-fields">
            <UiCard className="geometry-inspector-card room-dimension-card">
              <h4>По горизонтали</h4>
              <p className="inspector-hint">Между внутренними поверхностями стен.</p>
              <div onFocusCapture={() => preview("horizontal")} onMouseEnter={() => preview("horizontal")} onMouseLeave={clearPreview}>
                <GeometrySpanCue axis="horizontal" activeAnchor={widthAnchor} />
                <UiField
                  id="room-clear-width"
                  label="Горизонтальный внутренний размер"
                  unit="мм"
                  invalid={Boolean(widthError)}
                  message={widthError ? <UiFieldMessage tone="error" live>{widthError}</UiFieldMessage> : undefined}
                >
                  <input inputMode="decimal" value={widthInput} onChange={(event) => setWidthInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyDimension("width", widthInput, widthAnchor, setWidthError); }} />
                </UiField>
                <UiField id="room-clear-width-anchor" label="Что оставить на месте">
                  <select value={widthAnchor} onChange={(event) => setWidthAnchor(event.target.value as ClearRoomDimensionAnchor)}>
                    <option value="min">Левая сторона</option>
                    <option value="center">Центр</option>
                    <option value="max">Правая сторона</option>
                  </select>
                </UiField>
                <UiButton variant="secondary" className="room-inspector-action" onClick={() => applyDimension("width", widthInput, widthAnchor, setWidthError)}>Применить горизонтальный размер</UiButton>
              </div>
            </UiCard>

            <UiCard className="geometry-inspector-card room-dimension-card">
              <h4>По вертикали</h4>
              <p className="inspector-hint">Между внутренними поверхностями стен.</p>
              <div onFocusCapture={() => preview("vertical")} onMouseEnter={() => preview("vertical")} onMouseLeave={clearPreview}>
                <GeometrySpanCue axis="vertical" activeAnchor={heightAnchor} />
                <UiField
                  id="room-clear-height"
                  label="Вертикальный внутренний размер"
                  unit="мм"
                  invalid={Boolean(heightError)}
                  message={heightError ? <UiFieldMessage tone="error" live>{heightError}</UiFieldMessage> : undefined}
                >
                  <input inputMode="decimal" value={heightInput} onChange={(event) => setHeightInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyDimension("height", heightInput, heightAnchor, setHeightError); }} />
                </UiField>
                <UiField id="room-clear-height-anchor" label="Что оставить на месте">
                  <select value={heightAnchor} onChange={(event) => setHeightAnchor(event.target.value as ClearRoomDimensionAnchor)}>
                    <option value="min">Верхняя сторона</option>
                    <option value="center">Центр</option>
                    <option value="max">Нижняя сторона</option>
                  </select>
                </UiField>
                <UiButton variant="secondary" className="room-inspector-action" onClick={() => applyDimension("height", heightInput, heightAnchor, setHeightError)}>Применить вертикальный размер</UiButton>
              </div>
            </UiCard>
          </div>
        ) : (
          <p className="inspector-hint">Точные внутренние размеры можно редактировать только для простой прямоугольной комнаты. Vlezet не угадывает неоднозначные пролёты сложного контура.</p>
        )}
      </ContextSection>

      <ContextSection title="Расстановка мебели" description="Предпросмотр не меняет проект.">
        <UiButton variant="secondary" className="room-inspector-action" onClick={() => planningUiStore.getState().openForRoom(room.id)}>Варианты расстановки</UiButton>
        <p className="inspector-hint">Планировщик предложит до трёх проверенных вариантов для 1–3 существующих предметов.</p>
      </ContextSection>

      <ContextSection title="Сведения">
        <dl className="wall-facts"><div><dt>Полезная площадь</dt><dd>{areaLabel}</dd></div></dl>
        <p className="inspector-hint">Площадь считается автоматически по внутренним поверхностям стен и обновляется при изменении планировки.</p>
      </ContextSection>
    </ContextPanelFrame>
  );
}

export function SelectedOpeningInspector({
  document,
  wall,
  opening,
}: Readonly<{ document: VlezetDocument; wall: Wall; opening: Opening }>) {
  const wallLength = topologicalWallLength(document, wall.id);
  const { start, end } = wallEndpoints(document, wall);
  const visualModel = deriveWallVisualModel(start, end);
  const [widthInput, setWidthInput] = useState(String(Math.round(opening.width)));
  const [reference, setReference] = useState<OpeningOffsetReference>("visual-start");
  const [offsetInput, setOffsetInput] = useState(() => formatDraftMillimeters(displayedOpeningOffsetMm({
    model: visualModel,
    wallLengthMm: wallLength,
    openingWidthMm: opening.width,
    canonicalOffsetMm: opening.offset,
    reference: "visual-start",
  })));
  const [doorSwing, setDoorSwing] = useState<DoorSwingValue>(opening.doorSwing ?? { hinge: "start", side: "left" });
  const [widthError, setWidthError] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const doorChoices = deriveDoorSwingChoices(visualModel);

  useEffect(() => () => {
    const current = geometryInspectorPreviewStore.getState().doorSwing;
    if (current?.openingId === opening.id) geometryInspectorPreviewStore.getState().setDoorSwing(null);
  }, [opening.id]);

  const switchReference = (nextReference: OpeningOffsetReference) => {
    try {
      const width = parseDecimal(widthInput);
      const displayed = parseDecimal(offsetInput);
      const canonical = canonicalOpeningOffsetMm({
        model: visualModel,
        wallLengthMm: wallLength,
        openingWidthMm: width,
        displayedOffsetMm: displayed,
        reference,
      });
      const nextDisplayed = displayedOpeningOffsetMm({
        model: visualModel,
        wallLengthMm: wallLength,
        openingWidthMm: width,
        canonicalOffsetMm: canonical,
        reference: nextReference,
      });
      setReference(nextReference);
      setOffsetInput(formatDraftMillimeters(nextDisplayed));
      setPositionError(null);
    } catch (cause) {
      setPositionError(cause instanceof Error ? cause.message : "Не удалось изменить сторону отсчёта.");
    }
  };

  const setDoorPreview = (value: DoorSwingValue) => {
    setDoorSwing(value);
    geometryInspectorPreviewStore.getState().setDoorSwing({ openingId: opening.id, value });
  };

  const apply = () => {
    const width = parseDecimal(widthInput);
    if (!Number.isFinite(width) || width <= 0) {
      setWidthError("Введите положительную ширину проёма в миллиметрах.");
      return;
    }
    setWidthError(null);
    let canonicalOffset: number;
    try {
      canonicalOffset = canonicalOpeningOffsetMm({
        model: visualModel,
        wallLengthMm: wallLength,
        openingWidthMm: width,
        displayedOffsetMm: parseDecimal(offsetInput),
        reference,
      });
      setPositionError(null);
    } catch (cause) {
      setPositionError(cause instanceof Error ? cause.message : "Проверьте положение проёма.");
      return;
    }
    try {
      editorStore.getState().updateSelectedOpening({
        width,
        offset: canonicalOffset,
        ...(opening.kind === "door" ? { doorSwing } : {}),
      });
      setApplyError(null);
      geometryInspectorPreviewStore.getState().setDoorSwing(null);
    } catch (cause) {
      setApplyError(cause instanceof Error ? cause.message : "Не удалось изменить проём.");
    }
  };

  const draftWidth = parseDecimal(widthInput);
  const cueDraft = deriveOpeningCueDraft({
    model: visualModel,
    wallLengthMm: wallLength,
    authoritativeWidthMm: opening.width,
    authoritativeOffsetMm: opening.offset,
    draftWidthMm: draftWidth,
    displayedOffsetMm: parseDecimal(offsetInput),
    reference,
  });
  const label = opening.kind === "door" ? "дверь" : "окно";

  return (
    <ContextPanelFrame descriptor={describeOpeningContext({ kind: opening.kind, widthMm: opening.width })}>
      <ContextSection title="Размер проёма">
        <UiCard className="geometry-inspector-card">
          <UiField
            id="opening-width"
            label="Ширина проёма"
            unit="мм"
            invalid={Boolean(widthError)}
            message={widthError ? <UiFieldMessage tone="error" live>{widthError}</UiFieldMessage> : undefined}
          >
            <input inputMode="decimal" value={widthInput} onChange={(event) => setWidthInput(event.target.value)} />
          </UiField>
        </UiCard>
      </ContextSection>

      <ContextSection title="Положение на стене">
        <UiCard className="geometry-inspector-card">
          <OpeningPositionCue
            model={visualModel}
            reference={reference}
            offsetRatio={wallLength > 0 ? cueDraft.visualOffsetMm / wallLength : 0}
            widthRatio={wallLength > 0 ? cueDraft.widthMm / wallLength : 0}
          />
          <UiField id="opening-offset-reference" label="От какого конца измерять">
            <select value={reference} onChange={(event) => switchReference(event.target.value as OpeningOffsetReference)}>
              <option value="visual-start">{fromEndpointLabel(visualModel, "visual-start")}</option>
              <option value="visual-end">{fromEndpointLabel(visualModel, "visual-end")}</option>
            </select>
          </UiField>
          <UiField
            id="opening-offset"
            label={openingDistanceLabel(visualModel, reference)}
            unit="мм"
            invalid={Boolean(positionError)}
            message={positionError ? <UiFieldMessage tone="error" live>{positionError}</UiFieldMessage> : undefined}
          >
            <input inputMode="decimal" value={offsetInput} onChange={(event) => setOffsetInput(event.target.value)} />
          </UiField>
        </UiCard>
      </ContextSection>

      {opening.kind === "door" ? (
        <ContextSection title="Направление двери" description="Выберите положение петель и сторону, куда откроется полотно.">
          <DoorSwingSelector choices={doorChoices} value={doorSwing} onChange={setDoorPreview} />
        </ContextSection>
      ) : null}

      <ContextSection>
        <UiButton variant="primary" onClick={apply}>Применить параметры проёма</UiButton>
        {applyError ? <UiFieldMessage tone="error" live>{applyError}</UiFieldMessage> : null}
        <p className="inspector-hint">Проём остаётся привязанным к выбранной стене. Изменение выполняется только после применения.</p>
      </ContextSection>

      <ContextDangerZone description={`Удалится только ${label}. Можно отменить через «Отменить».`}>
        <button className="danger-action" type="button" onClick={() => editorStore.getState().deleteSelectedOpening()}>Удалить {label}</button>
      </ContextDangerZone>
    </ContextPanelFrame>
  );
}

export function WallInspector({
  planningNavigation = DEFAULT_PLANNING_NAVIGATION,
}: Readonly<{ planningNavigation?: ContextPanelNavigation }> = {}) {
  const selectedWallId = useStore(editorStore, (state) => state.selectedWallId);
  const selectedRoomId = useStore(editorStore, (state) => state.selectedRoomId);
  const selectedOpeningId = useStore(editorStore, (state) => state.selectedOpeningId);
  const selectedObjectId = useStore(editorStore, (state) => state.selectedObjectId);
  const planningRoomId = useStore(planningUiStore, (state) => state.roomId);
  const document = useStore(editorStore, (state) => state.history.document);
  const wall = useMemo(() => document.walls.find((candidate) => candidate.id === selectedWallId) ?? null, [selectedWallId, document.walls]);
  const room = useMemo(() => deriveRooms(document).rooms.find((candidate) => candidate.id === selectedRoomId) ?? null, [document, selectedRoomId]);
  const opening = useMemo(() => document.openings.find((candidate) => candidate.id === selectedOpeningId) ?? null, [document.openings, selectedOpeningId]);
  const openingWall = useMemo(() => opening ? document.walls.find((candidate) => candidate.id === opening.wallId) ?? null : null, [document.walls, opening]);
  const object = useMemo(() => document.placedObjects.find((candidate) => candidate.id === selectedObjectId) ?? null, [document.placedObjects, selectedObjectId]);

  useEffect(() => {
    geometryInspectorPreviewStore.getState().clearForSelection({
      roomId: room?.id ?? null,
      openingId: opening?.id ?? null,
    });
  }, [opening?.id, room?.id]);

  if (planningRoomId) return <PlanningPanel roomId={planningRoomId} navigation={planningNavigation} />;
  if (object) return <ObjectInspector key={`${object.id}:${object.position.x}:${object.position.y}:${object.width}:${object.depth}:${object.rotationDeg}`} document={document} object={object} />;
  if (opening && openingWall) return <SelectedOpeningInspector key={`${opening.id}:${opening.offset}:${opening.width}:${opening.doorSwing?.hinge}:${opening.doorSwing?.side}`} document={document} wall={openingWall} opening={opening} />;
  if (room) return <SelectedRoomInspector key={`${room.id}:${room.name}:${room.areaMm2}`} room={room} />;
  if (wall) return <SelectedWallInspector key={wallVersionKey(document, wall)} document={document} wall={wall} />;
  return <ContextPanelFrame descriptor={describeEmptyContext()}><ContextSection><div className="inspector-empty"><span>Выберите предмет, стену, комнату, дверь или окно.</span></div></ContextSection></ContextPanelFrame>;
}
