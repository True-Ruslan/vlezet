import type { OpeningOffsetReference, WallVisualModel } from "./geometry-inspector-presentation";

export type OpeningPositionCueProps = Readonly<{
  model: WallVisualModel;
  reference: OpeningOffsetReference;
  offsetRatio: number;
  widthRatio: number;
}>;

function referenceLabel(model: WallVisualModel, reference: OpeningOffsetReference): string {
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

function clampRatio(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function OpeningPositionCue({ model, reference, offsetRatio, widthRatio }: OpeningPositionCueProps) {
  const offset = clampRatio(offsetRatio);
  const width = Math.min(1 - offset, clampRatio(widthRatio));
  const x = 18 + offset * 144;
  const openingWidth = Math.max(4, width * 144);

  return (
    <figure className="geometry-cue opening-position-cue" data-reference={reference}>
      <svg viewBox="0 0 180 60" aria-hidden="true">
        <line className="geometry-cue-wall" x1="18" y1="30" x2="162" y2="30" />
        <rect className="geometry-cue-opening" x={x} y="22" width={openingWidth} height="16" rx="3" />
        <circle className={reference === "visual-start" ? "geometry-cue-anchor is-active" : "geometry-cue-anchor"} cx="18" cy="30" r="5" />
        <circle className={reference === "visual-end" ? "geometry-cue-anchor is-active" : "geometry-cue-anchor"} cx="162" cy="30" r="5" />
      </svg>
      <figcaption>{referenceLabel(model, reference)}</figcaption>
    </figure>
  );
}
