import type { ClearRoomDimensionAnchor } from "@vlezet/editor-core";

export type GeometrySpanCueProps = Readonly<{
  axis: "horizontal" | "vertical";
  activeAnchor: ClearRoomDimensionAnchor;
}>;

export function GeometrySpanCue({ axis, activeAnchor }: GeometrySpanCueProps) {
  const horizontal = axis === "horizontal";
  const line = horizontal
    ? { x1: 24, y1: 40, x2: 136, y2: 40 }
    : { x1: 80, y1: 16, x2: 80, y2: 64 };
  const anchorPoint = activeAnchor === "center"
    ? { x: 80, y: 40 }
    : activeAnchor === "min"
      ? { x: line.x1, y: line.y1 }
      : { x: line.x2, y: line.y2 };

  return (
    <svg
      className="geometry-cue geometry-span-cue"
      data-axis={axis}
      data-anchor={activeAnchor}
      viewBox="0 0 160 80"
      aria-hidden="true"
    >
      <rect className="geometry-cue-room" x="20" y="12" width="120" height="56" rx="5" />
      <line className="geometry-cue-measure" {...line} />
      <line className="geometry-cue-tick" x1={line.x1} y1={line.y1 - 6} x2={line.x1} y2={line.y1 + 6} />
      <line className="geometry-cue-tick" x1={line.x2} y1={line.y2 - 6} x2={line.x2} y2={line.y2 + 6} />
      <circle className="geometry-cue-anchor" cx={anchorPoint.x} cy={anchorPoint.y} r="5" />
    </svg>
  );
}
