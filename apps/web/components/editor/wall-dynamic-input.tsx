"use client";

import type { KeyboardEvent } from "react";
import styles from "./wall-dynamic-input.module.css";
import { deriveWallDynamicInputKeyAction } from "./wall-dynamic-input-model";

export type WallDynamicInputProps = Readonly<{
  position: Readonly<{ x: number; y: number }>;
  lengthValue: string;
  angleValue: string;
  lengthError: string | null;
  angleError: string | null;
  onLengthChange: (value: string) => void;
  onAngleChange: (value: string) => void;
  onCommit: () => void;
  onCancelNumericEditing: () => void;
}>;

const LENGTH_ERROR_ID = "wall-dynamic-length-error";
const ANGLE_ERROR_ID = "wall-dynamic-angle-error";

export function WallDynamicInput(props: WallDynamicInputProps) {
  const valid = props.lengthError === null && props.angleError === null;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const action = deriveWallDynamicInputKeyAction({ key: event.key, valid });
    if (action === "native" || action === "none") return;
    event.preventDefault();
    event.stopPropagation();
    if (action === "commit") {
      props.onCommit();
      return;
    }
    props.onCancelNumericEditing();
    event.currentTarget.blur();
  };

  return (
    <div
      className="wall-dynamic-input"
      role="group"
      aria-label="Точные параметры стены"
      style={{ left: props.position.x, top: props.position.y }}
    >
      <label className="wall-dynamic-input-field">
        <span>Длина</span>
        <span className="wall-dynamic-input-control">
          <input
            className={styles.control}
            type="text"
            inputMode="decimal"
            value={props.lengthValue}
            aria-label="Длина стены, мм"
            aria-invalid={props.lengthError ? true : undefined}
            aria-describedby={props.lengthError ? LENGTH_ERROR_ID : undefined}
            data-editor-native-editable="true"
            onChange={(event) => props.onLengthChange(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <span aria-hidden="true">мм</span>
        </span>
        {props.lengthError ? <span id={LENGTH_ERROR_ID} className="wall-dynamic-input-error">{props.lengthError}</span> : null}
      </label>

      <label className="wall-dynamic-input-field">
        <span>Угол</span>
        <span className="wall-dynamic-input-control">
          <input
            className={styles.control}
            type="text"
            inputMode="decimal"
            value={props.angleValue}
            aria-label="Угол стены, градусы"
            aria-invalid={props.angleError ? true : undefined}
            aria-describedby={props.angleError ? ANGLE_ERROR_ID : undefined}
            data-editor-native-editable="true"
            onChange={(event) => props.onAngleChange(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <span aria-hidden="true">°</span>
        </span>
        {props.angleError ? <span id={ANGLE_ERROR_ID} className="wall-dynamic-input-error">{props.angleError}</span> : null}
      </label>
    </div>
  );
}
