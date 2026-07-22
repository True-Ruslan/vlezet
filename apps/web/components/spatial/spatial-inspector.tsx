import { formatAreaM2FromSquareMillimeters } from "../editor/dimension-annotations";
import type { SpatialInspectionDetails } from "./spatial-inspection";
import styles from "./spatial-viewer.module.css";

export type SpatialInspectorProps = Readonly<{
  details: SpatialInspectionDetails;
  selected: boolean;
  onClear: () => void;
}>;

const FIT_LABELS = {
  fits: "Влезает",
  tight: "Влезает вплотную",
  blocked: "Не влезает",
} as const;

function segmentLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} видимый сегмент`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} видимых сегмента`;
  return `${count} видимых сегментов`;
}

function Header({ title, selected, onClear }: Readonly<{ title: string; selected: boolean; onClear: () => void }>) {
  return (
    <div className={styles.inspectorHeader}>
      <div>
        <div className={styles.inspectorEyebrow}>{selected ? "Выбрано" : "Под курсором"}</div>
        <strong className={styles.inspectorTitle}>{title}</strong>
      </div>
      {selected ? (
        <button type="button" className={styles.inspectorClear} onClick={onClear} aria-label="Снять выбор">
          Снять выбор
        </button>
      ) : null}
    </div>
  );
}

export function SpatialInspector({ details, selected, onClear }: SpatialInspectorProps) {
  if (details.kind === "room") {
    return (
      <aside className={styles.inspector} aria-label="Инспектор 3D">
        <Header title={details.name} selected={selected} onClear={onClear} />
        <dl className={styles.inspectorList}>
          <div><dt>Полезная площадь</dt><dd>{formatAreaM2FromSquareMillimeters(details.areaMm2)} м²</dd></div>
          {details.clearWidthMm !== undefined && details.clearLengthMm !== undefined ? (
            <div>
              <dt>Чистые внутренние размеры</dt>
              <dd>{Math.round(details.clearWidthMm)} × {Math.round(details.clearLengthMm)} мм</dd>
            </div>
          ) : null}
        </dl>
      </aside>
    );
  }

  if (details.kind === "wall") {
    return (
      <aside className={styles.inspector} aria-label="Инспектор 3D">
        <Header title="Стена" selected={selected} onClear={onClear} />
        <dl className={styles.inspectorList}>
          <div><dt>Длина по оси стены</dt><dd>{Math.round(details.lengthMm)} мм</dd></div>
          <div><dt>Толщина</dt><dd>{Math.round(details.thicknessMm)} мм</dd></div>
          <div><dt>В 3D</dt><dd>{segmentLabel(details.visibleSegmentCount)}</dd></div>
        </dl>
      </aside>
    );
  }

  return (
    <aside className={styles.inspector} aria-label="Инспектор 3D">
      <Header title={details.name} selected={selected} onClear={onClear} />
      <dl className={styles.inspectorList}>
        <div>
          <dt>Размеры</dt>
          <dd>{Math.round(details.widthMm)} × {Math.round(details.depthMm)} × {Math.round(details.heightMm)} мм</dd>
        </div>
        <div><dt>Поворот</dt><dd>Поворот: {Math.round(details.rotationDeg)}°</dd></div>
        <div>
          <dt>Проверка размещения</dt>
          <dd className={styles[`fit_${details.fitStatus}`]}>{FIT_LABELS[details.fitStatus]}</dd>
        </div>
      </dl>
      {details.heightWasDefaulted ? (
        <p className={styles.inspectorNote}>Высота {Math.round(details.heightMm)} мм показана только для 3D и не записана в проект.</p>
      ) : null}
      {details.diagnostics.length > 0 ? (
        <ul className={styles.inspectorDiagnostics}>
          {details.diagnostics.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : null}
    </aside>
  );
}
