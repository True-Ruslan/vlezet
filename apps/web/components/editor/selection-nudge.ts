import type { Point2 } from "@vlezet/domain";

export const NUDGE_STEP_MM = 10;
export const NUDGE_STEP_COARSE_MM = 100;

export function resolveSelectionNudge(input: Readonly<{ key: string; shiftKey: boolean }>): Point2 | null {
  const step = input.shiftKey ? NUDGE_STEP_COARSE_MM : NUDGE_STEP_MM;
  switch (input.key) {
    case "ArrowLeft": return { x: -step, y: 0 };
    case "ArrowRight": return { x: step, y: 0 };
    case "ArrowUp": return { x: 0, y: -step };
    case "ArrowDown": return { x: 0, y: step };
    default: return null;
  }
}
