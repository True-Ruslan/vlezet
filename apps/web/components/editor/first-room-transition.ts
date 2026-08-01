export type FirstRoomObservation = Readonly<{
  projectId: string;
  roomIds: readonly string[];
}>;

export type FirstRoomTransition = Readonly<{
  next: FirstRoomObservation;
  createdRoomId: string | null;
}>;

export function observeFirstRoomTransition(
  previous: FirstRoomObservation | null,
  current: FirstRoomObservation,
): FirstRoomTransition {
  if (!previous || previous.projectId !== current.projectId) {
    return { next: current, createdRoomId: null };
  }

  return {
    next: current,
    createdRoomId: previous.roomIds.length === 0 && current.roomIds.length > 0
      ? current.roomIds[0] ?? null
      : null,
  };
}
