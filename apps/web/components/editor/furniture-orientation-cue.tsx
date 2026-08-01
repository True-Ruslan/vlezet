import type { CSSProperties, ReactElement } from "react";
import {
  classifyCardinalScreenSide,
  furnitureLocalSideScreenVector,
  type ClearanceSidePresentation,
  type FurnitureLocalSide,
} from "./furniture-orientation-presentation";

export type FurnitureOrientationCueProps = Readonly<{
  widthMm: number;
  depthMm: number;
  rotationDeg: number;
  sides: Readonly<Record<FurnitureLocalSide, ClearanceSidePresentation>>;
}>;

const SIDE_LABELS: Readonly<Record<FurnitureLocalSide, string>> = {
  front: "Спереди",
  right: "Справа",
  back: "Сзади",
  left: "Слева",
};

const SCREEN_LABELS = {
  top: "сверху на плане",
  right: "справа на плане",
  bottom: "снизу на плане",
  left: "слева на плане",
} as const;

function compact(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function FurnitureOrientationCue({
  widthMm,
  depthMm,
  rotationDeg,
  sides,
}: FurnitureOrientationCueProps): ReactElement {
  const safeWidth = Math.max(1, Math.abs(widthMm));
  const safeDepth = Math.max(1, Math.abs(depthMm));
  const ratio = Math.max(0.45, Math.min(2.2, safeWidth / safeDepth));
  const objectStyle: CSSProperties = {
    aspectRatio: String(ratio),
    transform: `rotate(${rotationDeg}deg)`,
  };

  return (
    <section className="furniture-orientation-cue" aria-label="Ориентация предмета и зоны использования">
      <div className="furniture-orientation-visual">
        <div className="furniture-orientation-stage" aria-hidden="true">
          <div className="furniture-orientation-object" style={objectStyle}>
            <span className="furniture-front-marker">Перед предмета</span>
          </div>
        </div>
        <p>Поворот {compact(rotationDeg)}° · размер {compact(widthMm)} × {compact(depthMm)} мм</p>
      </div>

      <dl className="furniture-clearance-summary">
        {(["front", "right", "back", "left"] as const).map((side) => {
          const presentation = sides[side];
          const screenSide = classifyCardinalScreenSide(furnitureLocalSideScreenVector(side, rotationDeg));
          return (
            <div key={side} aria-invalid={presentation.invalid ? "true" : undefined}>
              <dt>{SIDE_LABELS[side]} · {SCREEN_LABELS[screenSide]}</dt>
              <dd>
                <span>Рекомендуется {compact(presentation.recommendedMm)} мм</span>
                <span>{presentation.actualMm === null
                  ? "Нет ближайшего препятствия"
                  : `Свободно сейчас ${compact(presentation.actualMm)} мм`}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
