import type { PlacedObject, VlezetDocument } from "@vlezet/domain";
import {
  deriveRectangularRoomDimensions,
  deriveRooms,
  evaluateObjectFits,
  type DerivedRoom,
} from "@vlezet/geometry";
import {
  MAX_PLANNING_CONSTRAINTS,
  validatePlanningConstraintSet,
  type PlanningConstraint,
} from "./constraints";

export { MAX_PLANNING_CONSTRAINTS } from "./constraints";
export type { PlanningConstraint } from "./constraints";

export const MAX_SELECTED_PLANNING_OBJECTS = 3;
export const MAX_PLANNING_EVALUATIONS = 6000;
export const MAX_DISPLAYED_PLANNING_CANDIDATES = 3;

export type PlanningRequest = Readonly<{
  roomId: string;
  objectIds: readonly string[];
  constraints?: readonly PlanningConstraint[];
}>;

export type PlanningPlacement = Readonly<{
  objectId: string;
  position: Readonly<{ x: number; y: number }>;
  rotationDeg: number;
}>;

export type PlanningCandidate = Readonly<{
  id: string;
  roomId: string;
  placements: readonly PlanningPlacement[];
  constraints?: readonly PlanningConstraint[];
}>;

export type PlanningErrorCode =
  | "invalid-plan"
  | "room-missing"
  | "room-unsupported"
  | "invalid-object-selection"
  | "invalid-constraints"
  | "object-missing"
  | "object-outside-target-room"
  | "candidate-invalid";

export class PlanningError extends Error {
  readonly code: PlanningErrorCode;

  constructor(code: PlanningErrorCode, message: string) {
    super(message);
    this.name = "PlanningError";
    this.code = code;
  }
}

export type ValidatedPlanningContext = Readonly<{
  room: DerivedRoom;
  selectedObjects: readonly PlacedObject[];
  constraints: readonly PlanningConstraint[];
}>;

function invalidSelection(message: string): never {
  throw new PlanningError("invalid-object-selection", message);
}

function validateConstraints(
  constraints: readonly PlanningConstraint[] | undefined,
  selectedObjectIds: ReadonlySet<string>,
): readonly PlanningConstraint[] {
  try {
    return validatePlanningConstraintSet(constraints, selectedObjectIds);
  } catch (error) {
    throw new PlanningError(
      "invalid-constraints",
      error instanceof Error ? error.message : `At most ${MAX_PLANNING_CONSTRAINTS} valid planning constraints are supported.`,
    );
  }
}

export function validatePlanningRequest(
  document: VlezetDocument,
  request: PlanningRequest,
): ValidatedPlanningContext {
  const roomsResult = deriveRooms(document);
  if (roomsResult.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new PlanningError("invalid-plan", "Plan geometry is invalid and cannot be planned safely.");
  }

  const room = roomsResult.rooms.find((candidate) => candidate.id === request.roomId);
  if (!room) {
    throw new PlanningError("room-missing", `Planning room does not exist: ${request.roomId}`);
  }
  if (!deriveRectangularRoomDimensions(room)) {
    throw new PlanningError("room-unsupported", "M6 supports deterministic axis-aligned rectangular rooms only.");
  }

  if (request.objectIds.length < 1 || request.objectIds.length > MAX_SELECTED_PLANNING_OBJECTS) {
    invalidSelection(`Select 1-${MAX_SELECTED_PLANNING_OBJECTS} objects for planning.`);
  }
  if (new Set(request.objectIds).size !== request.objectIds.length) {
    invalidSelection("Planning object selection contains duplicate ids.");
  }

  const selectedObjects = request.objectIds.map((objectId) => {
    const object = document.placedObjects.find((candidate) => candidate.id === objectId);
    if (!object) throw new PlanningError("object-missing", `Planning object does not exist: ${objectId}`);
    return object;
  });

  const fit = evaluateObjectFits(document);
  if (!fit.planValid) {
    throw new PlanningError("invalid-plan", "Plan geometry is invalid and cannot be planned safely.");
  }
  for (const object of selectedObjects) {
    if (fit.byObjectId.get(object.id)?.roomId !== room.id) {
      throw new PlanningError(
        "object-outside-target-room",
        `Planning object is not inside the requested room: ${object.id}`,
      );
    }
  }

  const constraints = validateConstraints(request.constraints, new Set(request.objectIds));
  return { room, selectedObjects, constraints };
}
