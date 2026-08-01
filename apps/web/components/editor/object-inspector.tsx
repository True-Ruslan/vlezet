"use client";

import type { PlacedObject, VlezetDocument } from "@vlezet/domain";
import { evaluateObjectFits, measureObjectClearances } from "@vlezet/geometry";
import { useEffect, useMemo, useRef, useState } from "react";
import { describeObjectContext } from "./context-panel-contract";
import {
  ContextActionArea,
  ContextDangerZone,
  ContextPanelFrame,
  ContextSection,
} from "./context-panel-frame";
import { FitStatusBadge, fitStatusPresentation } from "./fit-status-badge";
import { FurnitureOrientationCue } from "./furniture-orientation-cue";
import {
  createObjectEditorDraft,
  groupFitDiagnostics,
  objectAuthorityFingerprint,
  parseObjectEditorDraft,
  type ObjectDraftErrors,
  type ObjectDraftField,
  type ObjectEditorDraft,
} from "./object-editor-presentation";
import { editorStore } from "./use-editor-store";

const FIELD_ORDER: readonly ObjectDraftField[] = [
  "name",
  "width",
  "depth",
  "height",
  "rotation",
  "front",
  "right",
  "back",
  "left",
  "x",
  "y",
];

function draftNumber(value: string, fallback: number): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ObjectInspector({ document, object }: Readonly<{ document: VlezetDocument; object: PlacedObject }>) {
  const fit = useMemo(() => evaluateObjectFits(document).byObjectId.get(object.id), [document, object.id]);
  const measurements = useMemo(() => {
    try { return measureObjectClearances(document, object.id); } catch { return null; }
  }, [document, object.id]);
  const authorityFingerprint = objectAuthorityFingerprint(object);
  const [draft, setDraft] = useState<ObjectEditorDraft>(() => createObjectEditorDraft(object));
  const [errors, setErrors] = useState<ObjectDraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [clearanceOpen, setClearanceOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const inputRefs = useRef<Partial<Record<ObjectDraftField, HTMLInputElement | null>>>({});

  useEffect(() => {
    setDraft(createObjectEditorDraft(object));
    setErrors({});
    setFormError(null);
    setClearanceOpen(false);
    setPositionOpen(false);
  }, [authorityFingerprint, object]);

  const setField = (field: ObjectDraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const apply = () => {
    const result = parseObjectEditorDraft(draft, object);
    if (!result.ok) {
      setErrors(result.errors);
      setFormError(null);
      if (["front", "right", "back", "left"].some((field) => result.errors[field as ObjectDraftField])) {
        setClearanceOpen(true);
      }
      if (result.errors.x || result.errors.y) setPositionOpen(true);
      const firstInvalidField = FIELD_ORDER.find((field) => Boolean(result.errors[field]));
      if (firstInvalidField) {
        requestAnimationFrame(() => inputRefs.current[firstInvalidField]?.focus());
      }
      return;
    }

    try {
      editorStore.getState().updateSelectedObject(result.patch);
      setErrors({});
      setFormError(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Не удалось изменить предмет.");
    }
  };

  const field = (
    id: string,
    label: string,
    draftField: ObjectDraftField,
    suffix?: string,
    options: Readonly<{ inputMode?: "text" | "decimal"; maxLength?: number }> = {},
  ) => {
    const error = errors[draftField];
    return (
      <div className="object-field">
        <label className="field-label" htmlFor={id}>{label}</label>
        <div className={suffix ? "length-field-row" : "room-name-field"}>
          <input
            ref={(node) => { inputRefs.current[draftField] = node; }}
            id={id}
            inputMode={options.inputMode ?? (suffix ? "decimal" : "text")}
            value={draft[draftField]}
            maxLength={options.maxLength}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => setField(draftField, event.target.value)}
          />
          {suffix ? <span>{suffix}</span> : null}
        </div>
        {error ? <p id={`${id}-error`} className="field-error">{error}</p> : null}
      </div>
    );
  };

  const status = fit?.status ?? "blocked";
  const descriptor = describeObjectContext({ name: object.name, statusLabel: fitStatusPresentation(status).label });
  const diagnosticGroups = groupFitDiagnostics(fit?.diagnostics ?? []);
  const cueRotation = draftNumber(draft.rotation, object.rotationDeg);
  const cueWidth = draftNumber(draft.width, object.width);
  const cueDepth = draftNumber(draft.depth, object.depth);
  const cueSides = {
    front: {
      recommendedMm: draftNumber(draft.front, object.clearance.front),
      actualMm: measurements?.front ?? null,
      invalid: Boolean(errors.front),
    },
    right: {
      recommendedMm: draftNumber(draft.right, object.clearance.right),
      actualMm: measurements?.right ?? null,
      invalid: Boolean(errors.right),
    },
    back: {
      recommendedMm: draftNumber(draft.back, object.clearance.back),
      actualMm: measurements?.back ?? null,
      invalid: Boolean(errors.back),
    },
    left: {
      recommendedMm: draftNumber(draft.left, object.clearance.left),
      actualMm: measurements?.left ?? null,
      invalid: Boolean(errors.left),
    },
  } as const;

  return (
    <ContextPanelFrame descriptor={descriptor} className="object-inspector">
      <form className="object-editor-form" onSubmit={(event) => { event.preventDefault(); apply(); }}>
        <ContextSection title="Проверка размещения">
          <FitStatusBadge status={status} />
          {diagnosticGroups.length ? (
            <div className="fit-diagnostic-groups">
              {diagnosticGroups.map((group) => (
                <section key={group.id} className={`fit-diagnostic-group fit-diagnostic-${group.id}`}>
                  <strong>{group.title}</strong>
                  <ul className="fit-reasons">
                    {group.diagnostics.map((diagnostic, index) => (
                      <li key={`${diagnostic.code}-${diagnostic.relatedObjectId ?? diagnostic.relatedOpeningId ?? index}`}>
                        {diagnostic.message}
                      </li>
                    ))}
                  </ul>
                  <p>{group.nextAction}</p>
                </section>
              ))}
            </div>
          ) : <p className="fit-success-copy">Предмет и рекомендуемые зоны использования помещаются без конфликтов.</p>}
        </ContextSection>

        <ContextSection
          title="Основные параметры"
          description="Ширина и глубина относятся к самому предмету и поворачиваются вместе с ним."
        >
          {field("object-name", "Название", "name", undefined, { inputMode: "text", maxLength: 120 })}
          <div className="object-main-grid">
            {field("object-width", "Ширина", "width", "мм")}
            {field("object-depth", "Глубина", "depth", "мм")}
            {object.height === undefined ? null : field("object-height", "Высота", "height", "мм")}
            <div className="object-rotation-field">
              {field("object-rotation", "Точный поворот", "rotation", "°")}
              <button
                className="secondary-action object-rotate-action"
                type="button"
                onClick={() => editorStore.getState().rotateSelectedObject90()}
              >
                Повернуть 90°
              </button>
            </div>
          </div>
        </ContextSection>

        <ContextSection
          title="Зоны использования"
          description="Рекомендации показывают удобное пространство вокруг повёрнутого предмета, а не его размеры."
        >
          <FurnitureOrientationCue
            widthMm={cueWidth}
            depthMm={cueDepth}
            rotationDeg={cueRotation}
            sides={cueSides}
          />
          <button
            className="object-disclosure-toggle"
            type="button"
            aria-expanded={clearanceOpen}
            onClick={() => setClearanceOpen((current) => !current)}
          >
            {clearanceOpen ? "Скрыть настройку зазоров" : "Настроить рекомендуемые зазоры"}
          </button>
          {clearanceOpen ? (
            <div className="object-clearance-fields">
              {field("clearance-front", "Спереди", "front", "мм")}
              {field("clearance-right", "Справа", "right", "мм")}
              {field("clearance-back", "Сзади", "back", "мм")}
              {field("clearance-left", "Слева", "left", "мм")}
            </div>
          ) : null}
        </ContextSection>

        <ContextSection
          title="Точное положение"
          description="Координаты центра нужны для точной настройки и обычно не требуются при перетаскивании."
        >
          <button
            className="object-disclosure-toggle"
            type="button"
            aria-expanded={positionOpen}
            onClick={() => setPositionOpen((current) => !current)}
          >
            {positionOpen ? "Скрыть координаты" : "Показать координаты центра"}
          </button>
          {positionOpen ? (
            <div className="object-position-fields">
              {field("object-x", "Центр X", "x", "мм")}
              {field("object-y", "Центр Y", "y", "мм")}
            </div>
          ) : null}
        </ContextSection>

        <ContextActionArea>
          <button className="primary-action" type="submit">Применить изменения</button>
          {formError ? <p className="field-error object-form-error">{formError}</p> : null}
          <button className="secondary-action" type="button" onClick={() => editorStore.getState().duplicateSelectedObject()}>
            Дублировать предмет
          </button>
        </ContextActionArea>

        <ContextDangerZone description="Предмет удалится из плана. Можно отменить через «Отменить».">
          <button className="danger-action" type="button" onClick={() => editorStore.getState().deleteSelectedObject()}>
            Удалить предмет
          </button>
        </ContextDangerZone>
      </form>
    </ContextPanelFrame>
  );
}
