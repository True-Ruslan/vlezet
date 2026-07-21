"use client";

import type { PlacedObject, VlezetDocument } from "@vlezet/domain";
import { evaluateObjectFits, measureObjectClearances, type FitStatus } from "@vlezet/geometry";
import { useMemo, useState } from "react";
import { editorStore } from "./use-editor-store";

const STATUS_COPY: Readonly<Record<FitStatus, string>> = {
  fits: "Влезает",
  tight: "Влезает вплотную",
  blocked: "Не влезает",
};

type NumericField = "x" | "y" | "width" | "depth" | "height" | "rotation" | "front" | "right" | "back" | "left";

function parseRequired(value: string, label: string): number {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new RangeError(`${label}: введите число`);
  return parsed;
}

export function ObjectInspector({ document, object }: Readonly<{ document: VlezetDocument; object: PlacedObject }>) {
  const fit = useMemo(() => evaluateObjectFits(document).byObjectId.get(object.id), [document, object.id]);
  const measurements = useMemo(() => {
    try { return measureObjectClearances(document, object.id); } catch { return null; }
  }, [document, object.id]);
  const [name, setName] = useState(object.name);
  const [fields, setFields] = useState<Record<NumericField, string>>({
    x: String(Math.round(object.position.x)),
    y: String(Math.round(object.position.y)),
    width: String(Math.round(object.width)),
    depth: String(Math.round(object.depth)),
    height: object.height === undefined ? "" : String(Math.round(object.height)),
    rotation: String(object.rotationDeg),
    front: String(Math.round(object.clearance.front)),
    right: String(Math.round(object.clearance.right)),
    back: String(Math.round(object.clearance.back)),
    left: String(Math.round(object.clearance.left)),
  });
  const [error, setError] = useState<string | null>(null);

  const setField = (field: NumericField, value: string) => setFields((current) => ({ ...current, [field]: value }));

  const apply = () => {
    try {
      const height = fields.height.trim() ? parseRequired(fields.height, "Высота") : object.height;
      editorStore.getState().updateSelectedObject({
        name,
        position: {
          x: parseRequired(fields.x, "X"),
          y: parseRequired(fields.y, "Y"),
        },
        width: parseRequired(fields.width, "Ширина"),
        depth: parseRequired(fields.depth, "Глубина"),
        ...(height === undefined ? {} : { height }),
        rotationDeg: parseRequired(fields.rotation, "Угол"),
        clearance: {
          front: parseRequired(fields.front, "Зазор спереди"),
          right: parseRequired(fields.right, "Зазор справа"),
          back: parseRequired(fields.back, "Зазор сзади"),
          left: parseRequired(fields.left, "Зазор слева"),
        },
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить предмет.");
    }
  };

  const numericInput = (id: string, label: string, field: NumericField, suffix: string) => <>
    <label className="field-label" htmlFor={id}>{label}</label>
    <div className="length-field-row">
      <input id={id} inputMode="decimal" value={fields[field]} onChange={(event) => setField(field, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") apply(); }} />
      <span>{suffix}</span>
    </div>
  </>;

  const status = fit?.status ?? "blocked";

  return (
    <aside className="inspector-panel object-inspector">
      <div className="inspector-heading"><span>Предмет</span><code>{object.id.slice(0, 8)}</code></div>
      <div className={`fit-badge fit-${status}`}><span className="fit-dot" />{STATUS_COPY[status]}</div>
      {fit?.diagnostics.length ? (
        <ul className="fit-reasons">
          {fit.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}-${diagnostic.relatedObjectId ?? diagnostic.relatedOpeningId ?? index}`}>{diagnostic.message}</li>)}
        </ul>
      ) : <p className="fit-success-copy">Предмет и рекомендуемые зоны использования помещаются без конфликтов.</p>}

      <label className="field-label" htmlFor="object-name">Название</label>
      <div className="room-name-field"><input id="object-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") apply(); }} /></div>

      <div className="field-pair">
        <div>{numericInput("object-x", "Центр X", "x", "мм")}</div>
        <div>{numericInput("object-y", "Центр Y", "y", "мм")}</div>
      </div>
      <div className="field-pair">
        <div>{numericInput("object-width", "Ширина", "width", "мм")}</div>
        <div>{numericInput("object-depth", "Глубина", "depth", "мм")}</div>
      </div>
      <div className="field-pair">
        <div>{numericInput("object-height", "Высота", "height", "мм")}</div>
        <div>{numericInput("object-rotation", "Поворот", "rotation", "°")}</div>
      </div>

      <div className="inspector-section-heading"><strong>Рекомендуемые зазоры</strong><span>Не норматив, а удобство использования</span></div>
      <div className="field-pair">
        <div>{numericInput("clearance-front", "Спереди", "front", "мм")}</div>
        <div>{numericInput("clearance-right", "Справа", "right", "мм")}</div>
      </div>
      <div className="field-pair">
        <div>{numericInput("clearance-back", "Сзади", "back", "мм")}</div>
        <div>{numericInput("clearance-left", "Слева", "left", "мм")}</div>
      </div>

      <button className="primary-action" type="button" onClick={apply}>Применить параметры</button>
      {error ? <p className="field-error">{error}</p> : null}

      <dl className="wall-facts clearance-facts">
        <div><dt>До препятствия спереди</dt><dd>{measurements?.front === null || measurements?.front === undefined ? "—" : `${Math.round(measurements.front)} мм`}</dd></div>
        <div><dt>Справа</dt><dd>{measurements?.right === null || measurements?.right === undefined ? "—" : `${Math.round(measurements.right)} мм`}</dd></div>
        <div><dt>Сзади</dt><dd>{measurements?.back === null || measurements?.back === undefined ? "—" : `${Math.round(measurements.back)} мм`}</dd></div>
        <div><dt>Слева</dt><dd>{measurements?.left === null || measurements?.left === undefined ? "—" : `${Math.round(measurements.left)} мм`}</dd></div>
      </dl>

      <div className="object-actions-row">
        <button className="secondary-action" type="button" onClick={() => editorStore.getState().rotateSelectedObject90()}>Повернуть 90°</button>
        <button className="secondary-action" type="button" onClick={() => editorStore.getState().duplicateSelectedObject()}>Дублировать</button>
      </div>
      <button className="danger-action" type="button" onClick={() => editorStore.getState().deleteSelectedObject()}>Удалить предмет</button>
    </aside>
  );
}
