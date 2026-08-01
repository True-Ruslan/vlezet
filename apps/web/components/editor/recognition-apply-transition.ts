export type RecognitionApplyObservation = Readonly<{
  projectId: string;
  pastLength: number;
  lastLabel: string | null;
}>;

export type RecognitionApplyTransition = Readonly<{
  next: RecognitionApplyObservation;
  applied: boolean;
}>;

export function observeRecognitionApplyTransition(
  previous: RecognitionApplyObservation | null,
  current: RecognitionApplyObservation,
): RecognitionApplyTransition {
  const applied = Boolean(
    previous &&
    previous.projectId === current.projectId &&
    current.pastLength > previous.pastLength &&
    current.lastLabel === "recognition/apply",
  );
  return { next: current, applied };
}
