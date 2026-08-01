"use client";

import { useRef, type KeyboardEvent } from "react";
import type { DoorSwingChoice, DoorSwingValue } from "./geometry-inspector-presentation";

export type DoorSwingSelectorProps = Readonly<{
  choices: readonly DoorSwingChoice[];
  value: DoorSwingValue;
  onChange: (value: DoorSwingValue) => void;
}>;

function doorSwingEquals(first: DoorSwingValue, second: DoorSwingValue): boolean {
  return first.hinge === second.hinge && first.side === second.side;
}

export function DoorSwingSelector({ choices, value, onChange }: DoorSwingSelectorProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, choices.findIndex((choice) => doorSwingEquals(choice.value, value)));

  const selectIndex = (index: number) => {
    const choice = choices[index];
    if (!choice) return;
    onChange(choice.value);
    requestAnimationFrame(() => buttonRefs.current[index]?.focus());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (choices.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % choices.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + choices.length) % choices.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = choices.length - 1;
    if (event.key === " " || event.key === "Enter") nextIndex = index;
    if (nextIndex === null) return;
    event.preventDefault();
    selectIndex(nextIndex);
  };

  return (
    <div className="door-swing-grid" role="radiogroup" aria-label="Направление двери">
      {choices.map((choice, index) => {
        const selected = doorSwingEquals(choice.value, value);
        const end = {
          x: 50 + choice.openDirection.x * 24,
          y: 32 + choice.openDirection.y * 24,
        };
        return (
          <button
            key={choice.id}
            ref={(element) => { buttonRefs.current[index] = element; }}
            type="button"
            className={selected ? "door-swing-choice is-selected" : "door-swing-choice"}
            role="radio"
            aria-checked={selected}
            aria-label={choice.accessibleLabel}
            tabIndex={selected || index === selectedIndex ? 0 : -1}
            onClick={() => selectIndex(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <svg viewBox="0 0 100 64" aria-hidden="true">
              <line className="door-swing-wall" x1="14" y1="32" x2="86" y2="32" />
              <circle className="door-swing-hinge" cx="50" cy="32" r="4" />
              <line className="door-swing-leaf" x1="50" y1="32" x2={end.x} y2={end.y} />
              <path className="door-swing-arc" d={`M 74 32 Q 62 ${end.y} ${end.x} ${end.y}`} />
            </svg>
            <span className="door-swing-choice-label">{choice.accessibleLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
