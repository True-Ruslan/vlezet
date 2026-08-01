import type { VisualEndpointRole, WallVisualModel } from "./geometry-inspector-presentation";

export type WallAxisCueProps = Readonly<{
  model: WallVisualModel;
  fixedRole: VisualEndpointRole;
}>;

export function WallAxisCue({ model, fixedRole }: WallAxisCueProps) {
  return (
    <figure className="geometry-cue wall-axis-cue" data-fixed-role={fixedRole}>
      <svg viewBox="0 0 180 48" aria-hidden="true">
        <line className="geometry-cue-axis" x1="24" y1="24" x2="156" y2="24" />
        <circle className={fixedRole === "visual-start" ? "geometry-cue-anchor is-active" : "geometry-cue-anchor"} cx="24" cy="24" r="6" />
        <circle className={fixedRole === "center" ? "geometry-cue-anchor is-active" : "geometry-cue-anchor"} cx="90" cy="24" r="5" />
        <circle className={fixedRole === "visual-end" ? "geometry-cue-anchor is-active" : "geometry-cue-anchor"} cx="156" cy="24" r="6" />
      </svg>
      <figcaption className="geometry-cue-endpoints">
        <span>{model.visualStartLabel}</span>
        <span>{model.visualEndLabel}</span>
      </figcaption>
    </figure>
  );
}
