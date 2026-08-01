export type PlanningApplyObservation = Readonly<{
  projectId: string;
  planningOpen: boolean;
  pastLength: number;
  lastLabel: string | null;
}>;

export type PlanningApplyTransition = Readonly<{
  next: PlanningApplyObservation;
  applied: boolean;
}>;

export function observePlanningApplyTransition(
  previous: PlanningApplyObservation | null,
  current: PlanningApplyObservation,
): PlanningApplyTransition {
  const applied = Boolean(
    previous &&
    previous.projectId === current.projectId &&
    current.pastLength > previous.pastLength &&
    current.lastLabel === "planning/apply-candidate",
  );
  return { next: current, applied };
}
