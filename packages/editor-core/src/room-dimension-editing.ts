import { getWallEndpoints, type VlezetDocument, type Wall } from "@vlezet/domain";
import {
  GEOMETRY_EPSILON_MM,
  deriveRectangularRoomDimensions,
  deriveRooms,
  extractPlanarFaces,
} from "@vlezet/geometry";
import { setTopologicalWallLength, topologicalWallLength, type WallLengthAnchor } from "./topology-editing";

export type ClearRoomDimensionAxis = "width" | "height";
export type ClearRoomDimensionAnchor = "min" | "center" | "max";

type ResizePlan = Readonly<{
  wallId: string;
  lengthMm: number;
  anchor: WallLengthAnchor;
}>;

function approximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= GEOMETRY_EPSILON_MM;
}

function semanticWallForSimpleFaceEdge(
  document: VlezetDocument,
  edge: Readonly<{ wallId: string; startVertexId: string; endVertexId: string }>,
): Wall {
  const wall = document.walls.find((candidate) => candidate.id === edge.wallId);
  if (!wall) throw new Error("Граница комнаты ссылается на отсутствующую стену");
  if (wall.junctionVertexIds.length > 0) {
    throw new Error("Чистый размер пока можно менять только у простой прямоугольной комнаты без T-соединений");
  }
  const sameEndpoints =
    (wall.startVertexId === edge.startVertexId && wall.endVertexId === edge.endVertexId) ||
    (wall.startVertexId === edge.endVertexId && wall.endVertexId === edge.startVertexId);
  if (!sameEndpoints) {
    throw new Error("Чистый размер пока можно менять только когда каждая сторона комнаты соответствует одной целой стене");
  }
  return wall;
}

function fixedWallAnchor(
  document: VlezetDocument,
  wall: Wall,
  axis: ClearRoomDimensionAxis,
  anchor: ClearRoomDimensionAnchor,
): WallLengthAnchor {
  if (anchor === "center") return "center";
  const { start, end } = getWallEndpoints(document, wall);
  const startCoordinate = axis === "width" ? start.position.x : start.position.y;
  const endCoordinate = axis === "width" ? end.position.x : end.position.y;
  const startIsMin = startCoordinate < endCoordinate;
  if (anchor === "min") return startIsMin ? "start" : "end";
  return startIsMin ? "end" : "start";
}

export function setRectangularRoomClearDimension(
  document: VlezetDocument,
  roomId: string,
  axis: ClearRoomDimensionAxis,
  lengthMm: number,
  anchor: ClearRoomDimensionAnchor = "min",
): VlezetDocument {
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) {
    throw new RangeError("Чистый размер комнаты должен быть положительным конечным числом");
  }

  const room = deriveRooms(document).rooms.find((candidate) => candidate.id === roomId);
  if (!room) throw new Error("Комната больше не существует в текущей геометрии");
  const dimensions = deriveRectangularRoomDimensions(room);
  if (!dimensions) {
    throw new Error("Чистый размер пока можно менять только у прямоугольной комнаты с горизонтальными и вертикальными стенами");
  }

  const currentDimension = axis === "width" ? dimensions.widthMm : dimensions.heightMm;
  const delta = lengthMm - currentDimension;
  if (Math.abs(delta) <= GEOMETRY_EPSILON_MM) return document;

  const face = extractPlanarFaces(document).find((candidate) => candidate.id === room.faceId);
  if (!face || face.edges.length !== 4 || new Set(face.edges.map((edge) => edge.wallId)).size !== 4) {
    throw new Error("Чистый размер пока можно менять только у простой прямоугольной комнаты из четырёх стен");
  }

  const connectingEdges = face.edges.filter((edge) => {
    const dx = edge.end.x - edge.start.x;
    const dy = edge.end.y - edge.start.y;
    return axis === "width"
      ? Math.abs(dy) <= GEOMETRY_EPSILON_MM && Math.abs(dx) > GEOMETRY_EPSILON_MM
      : Math.abs(dx) <= GEOMETRY_EPSILON_MM && Math.abs(dy) > GEOMETRY_EPSILON_MM;
  });
  if (connectingEdges.length !== 2) {
    throw new Error("Не удалось однозначно определить противоположные границы прямоугольной комнаты");
  }

  const plans: ResizePlan[] = connectingEdges.map((edge) => {
    const wall = semanticWallForSimpleFaceEdge(document, edge);
    const nextLength = topologicalWallLength(document, wall.id) + delta;
    if (nextLength <= GEOMETRY_EPSILON_MM) {
      throw new Error("Новый чистый размер делает стену нулевой или отрицательной длины");
    }
    return {
      wallId: wall.id,
      lengthMm: nextLength,
      anchor: fixedWallAnchor(document, wall, axis, anchor),
    };
  });

  let nextDocument = document;
  for (const plan of plans) {
    nextDocument = setTopologicalWallLength(nextDocument, plan.wallId, plan.lengthMm, plan.anchor);
  }

  const nextRoom = deriveRooms(nextDocument).rooms.find((candidate) => candidate.id === roomId);
  const nextDimensions = nextRoom ? deriveRectangularRoomDimensions(nextRoom) : null;
  const actualLength = nextDimensions ? (axis === "width" ? nextDimensions.widthMm : nextDimensions.heightMm) : null;
  if (actualLength === null || !approximatelyEqual(actualLength, lengthMm)) {
    throw new Error("Не удалось детерминированно получить запрошенный чистый размер комнаты");
  }

  return nextDocument;
}
