export type WallThicknessCueChoice = Readonly<{
  id: string;
  label: string;
}>;

export type WallThicknessCueProps = Readonly<{
  choices: readonly WallThicknessCueChoice[];
  selectedId: string;
  interiorChoice: boolean;
}>;

export function WallThicknessCue({ choices, selectedId, interiorChoice }: WallThicknessCueProps) {
  return (
    <figure
      className="geometry-cue wall-thickness-cue"
      data-selected-face={selectedId}
      data-interior-choice={interiorChoice || undefined}
    >
      <svg viewBox="0 0 180 72" aria-hidden="true">
        <line className={selectedId === choices[0]?.id ? "geometry-cue-face is-active" : "geometry-cue-face"} x1="22" y1="18" x2="158" y2="18" />
        <line className={selectedId === choices[1]?.id ? "geometry-cue-axis is-active" : "geometry-cue-axis"} x1="22" y1="36" x2="158" y2="36" />
        <line className={selectedId === choices[2]?.id ? "geometry-cue-face is-active" : "geometry-cue-face"} x1="22" y1="54" x2="158" y2="54" />
      </svg>
      <figcaption>
        <ul className="geometry-cue-labels">
          {choices.map((choice) => (
            <li key={choice.id} data-active={choice.id === selectedId || undefined}>{choice.label}</li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
