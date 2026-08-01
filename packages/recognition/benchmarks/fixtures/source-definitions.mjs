const DEFAULT_MM_PER_PX = 10;
const MARGIN_PX = 30;

function junctionId(x, y) {
  return `j-${x}-${y}`;
}

function horizontalWall(y, startX, endX, height, thicknessMm = 150) {
  return {
    id: `h-${y}-${startX}-${endX}`,
    startMm: { x: startX, y },
    endMm: { x: endX, y },
    thicknessMm,
    kind: y === 0 || y === height ? "external" : "partition",
    startJunctionId: junctionId(startX, y),
    endJunctionId: junctionId(endX, y),
  };
}

function verticalWall(x, startY, endY, width, thicknessMm = 150) {
  return {
    id: `v-${x}-${startY}-${endY}`,
    startMm: { x, y: startY },
    endMm: { x, y: endY },
    thicknessMm,
    kind: x === 0 || x === width ? "external" : "partition",
    startJunctionId: junctionId(x, startY),
    endJunctionId: junctionId(x, endY),
  };
}

function gridWalls(widthMm, heightMm, xCuts = [], yCuts = []) {
  const xs = [0, ...xCuts, widthMm].sort((a, b) => a - b);
  const ys = [0, ...yCuts, heightMm].sort((a, b) => a - b);
  const walls = [];
  for (const y of ys) {
    for (let index = 0; index < xs.length - 1; index += 1) {
      walls.push(horizontalWall(y, xs[index], xs[index + 1], heightMm));
    }
  }
  for (const x of xs) {
    for (let index = 0; index < ys.length - 1; index += 1) {
      walls.push(verticalWall(x, ys[index], ys[index + 1], widthMm));
    }
  }
  return { walls, xs, ys };
}

function gridRooms(xs, ys, names = [], classifications = []) {
  const rooms = [];
  let roomIndex = 0;
  for (let row = 0; row < ys.length - 1; row += 1) {
    for (let column = 0; column < xs.length - 1; column += 1) {
      const minimumX = xs[column];
      const maximumX = xs[column + 1];
      const minimumY = ys[row];
      const maximumY = ys[row + 1];
      const computedAreaM2 = (maximumX - minimumX) * (maximumY - minimumY) / 1_000_000;
      rooms.push({
        id: `r-${row + 1}-${column + 1}`,
        polygonMm: [
          { x: minimumX, y: minimumY },
          { x: maximumX, y: minimumY },
          { x: maximumX, y: maximumY },
          { x: minimumX, y: maximumY },
        ],
        name: names[roomIndex] ?? `Зона ${roomIndex + 1}`,
        classification: classifications[roomIndex] ?? "other",
        statedAreaM2: Number(computedAreaM2.toFixed(2)),
        computedAreaM2,
      });
      roomIndex += 1;
    }
  }
  return rooms;
}

function junctionsFromWalls(walls) {
  const byId = new Map();
  for (const wall of walls) {
    byId.set(wall.startJunctionId, { id: wall.startJunctionId, positionMm: wall.startMm });
    byId.set(wall.endJunctionId, { id: wall.endJunctionId, positionMm: wall.endMm });
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function labelsFromRooms(rooms) {
  return rooms.map((room, index) => {
    const xs = room.polygonMm.map((point) => point.x);
    const ys = room.polygonMm.map((point) => point.y);
    return {
      id: `label-${index + 1}`,
      text: `${room.name} ${room.statedAreaM2.toFixed(1)}`,
      anchorMm: {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      },
      roomId: room.id,
    };
  });
}

function defaultApplicability({ openings, rooms, labels }) {
  return {
    wallGeometry: true,
    wallTopology: true,
    openings: openings.length > 0,
    rooms: rooms.length > 0,
    roomLabels: labels.length > 0,
    roomAreas: rooms.length > 0,
    totalArea: rooms.length > 0,
    confidence: true,
  };
}

function definition(input) {
  const millimetersPerPixel = input.millimetersPerPixel ?? DEFAULT_MM_PER_PX;
  const sourceWidthPx = Math.ceil(input.widthMm / millimetersPerPixel) + MARGIN_PX * 2;
  const sourceHeightPx = Math.ceil(input.heightMm / millimetersPerPixel) + MARGIN_PX * 2;
  const rooms = input.rooms;
  const labels = input.labels ?? [];
  const statedTotalAreaM2 = Number(rooms.reduce((sum, room) => sum + (room.statedAreaM2 ?? room.computedAreaM2), 0).toFixed(2));
  return {
    schemaVersion: "recognition-benchmark-source-definition-v1",
    ...input,
    sourceWidthPx,
    sourceHeightPx,
    calibration: {
      sourceWidthPx,
      sourceHeightPx,
      millimetersPerPixel,
      originPx: { x: MARGIN_PX, y: MARGIN_PX },
    },
    expectedJunctions: junctionsFromWalls(input.walls),
    expectedLabels: labels,
    statedTotalAreaM2,
    metricApplicability: defaultApplicability({ openings: input.openings, rooms, labels }),
  };
}

function opening(id, kind, hostWallId, x, y, widthMm, orientationDeg = 0) {
  return { id, kind, hostWallId, centerMm: { x, y }, widthMm, orientationDeg, swing: null };
}

const studioGrid = gridWalls(6000, 4500);
const studioRooms = gridRooms(studioGrid.xs, studioGrid.ys, ["Студия"], ["living"]);

const multiGrid = gridWalls(9000, 6500, [4500], [3200]);
const multiRooms = gridRooms(
  multiGrid.xs,
  multiGrid.ys,
  ["Гостиная", "Кухня", "Спальня", "Санузел"],
  ["living", "kitchen", "bedroom", "bathroom"],
);

const openingGrid = gridWalls(8000, 6000, [4000], [3000]);
const openingRooms = gridRooms(
  openingGrid.xs,
  openingGrid.ys,
  ["Комната 1", "Комната 2", "Кухня", "Коридор"],
  ["living", "bedroom", "kitchen", "corridor"],
);

const labelWalls = [
  horizontalWall(0, 0, 3000, 6500),
  horizontalWall(0, 3000, 6000, 6500),
  horizontalWall(0, 6000, 8500, 6500),
  horizontalWall(2500, 0, 3000, 6500),
  horizontalWall(2500, 3000, 6000, 6500),
  horizontalWall(2500, 6000, 8500, 6500),
  horizontalWall(6500, 0, 3000, 6500),
  horizontalWall(6500, 3000, 6000, 6500),
  horizontalWall(6500, 6000, 8500, 6500),
  verticalWall(0, 0, 2500, 8500),
  verticalWall(0, 2500, 6500, 8500),
  verticalWall(3000, 0, 2500, 8500),
  verticalWall(3000, 2500, 6500, 8500),
  verticalWall(6000, 2500, 6500, 8500),
  verticalWall(8500, 0, 2500, 8500),
  verticalWall(8500, 2500, 6500, 8500),
];
const labelRooms = [
  { id: "r-1", polygonMm: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2500 }, { x: 0, y: 2500 }], name: "Кухня", classification: "kitchen", statedAreaM2: 7.5, computedAreaM2: 7.5 },
  { id: "r-2", polygonMm: [{ x: 3000, y: 0 }, { x: 8500, y: 0 }, { x: 8500, y: 2500 }, { x: 3000, y: 2500 }], name: "Гостиная", classification: "living", statedAreaM2: 13.75, computedAreaM2: 13.75 },
  { id: "r-3", polygonMm: [{ x: 0, y: 2500 }, { x: 3000, y: 2500 }, { x: 3000, y: 6500 }, { x: 0, y: 6500 }], name: "Спальня", classification: "bedroom", statedAreaM2: 12, computedAreaM2: 12 },
  { id: "r-4", polygonMm: [{ x: 3000, y: 2500 }, { x: 6000, y: 2500 }, { x: 6000, y: 6500 }, { x: 3000, y: 6500 }], name: "Коридор", classification: "corridor", statedAreaM2: 12, computedAreaM2: 12 },
  { id: "r-5", polygonMm: [{ x: 6000, y: 2500 }, { x: 8500, y: 2500 }, { x: 8500, y: 6500 }, { x: 6000, y: 6500 }], name: "Санузел", classification: "bathroom", statedAreaM2: 10, computedAreaM2: 10 },
];

const furnitureGrid = gridWalls(7600, 5200, [3800]);
const furnitureRooms = gridRooms(furnitureGrid.xs, furnitureGrid.ys, ["Жилая", "Кухня"], ["living", "kitchen"]);

const lowResolutionGrid = gridWalls(7000, 5000, [3400]);
const lowResolutionRooms = gridRooms(lowResolutionGrid.xs, lowResolutionGrid.ys, ["Комната", "Кухня"], ["living", "kitchen"]);

const perspectiveGrid = gridWalls(6800, 4800, [3300]);
const perspectiveRooms = gridRooms(perspectiveGrid.xs, perspectiveGrid.ys, ["Комната", "Кухня"], ["living", "kitchen"]);

const regressionGrid = gridWalls(7800, 5800, [3000], [2900]);
const regressionRooms = gridRooms(
  regressionGrid.xs,
  regressionGrid.ys,
  ["Комната А", "Комната Б", "Кухня", "Санузел"],
  ["living", "bedroom", "kitchen", "bathroom"],
);

export const fixtureSourceDefinitions = [
  definition({
    id: "clean-studio",
    description: "Clean developer-style studio with one door and two windows.",
    provenance: { kind: "synthetic", note: "Generated from repository-owned vector primitives.", license: null },
    tags: ["clean", "calibrated"],
    widthMm: 6000,
    heightMm: 4500,
    walls: studioGrid.walls,
    openings: [
      opening("door-1", "door", "h-4500-0-6000", 1200, 4500, 900),
      opening("window-1", "window", "h-0-0-6000", 2500, 0, 1400),
      opening("window-2", "window", "v-6000-0-4500", 6000, 2600, 1200, 90),
    ],
    rooms: studioRooms,
    labels: [],
    decorations: [],
  }),
  definition({
    id: "clean-multi-room",
    description: "Clean four-zone plan with crossing partitions.",
    provenance: { kind: "synthetic", note: "Generated from repository-owned vector primitives.", license: null },
    tags: ["clean", "calibrated", "multi-room"],
    widthMm: 9000,
    heightMm: 6500,
    walls: multiGrid.walls,
    openings: [
      opening("door-1", "door", "v-4500-0-3200", 4500, 1600, 900, 90),
      opening("door-2", "door", "h-3200-4500-9000", 6500, 3200, 800),
      opening("window-1", "window", "h-0-0-4500", 2200, 0, 1400),
      opening("window-2", "window", "h-0-4500-9000", 6800, 0, 1400),
    ],
    rooms: multiRooms,
    labels: [],
    decorations: [],
  }),
  definition({
    id: "openings-heavy",
    description: "Four-zone plan with six host-wall openings.",
    provenance: { kind: "synthetic", note: "Generated from repository-owned vector primitives.", license: null },
    tags: ["openings-heavy", "calibrated", "multi-room"],
    widthMm: 8000,
    heightMm: 6000,
    walls: openingGrid.walls,
    openings: [
      opening("door-1", "door", "v-4000-0-3000", 4000, 1400, 900, 90),
      opening("door-2", "door", "v-4000-3000-6000", 4000, 4400, 900, 90),
      opening("door-3", "door", "h-3000-0-4000", 2100, 3000, 800),
      opening("window-1", "window", "h-0-0-4000", 2000, 0, 1300),
      opening("window-2", "window", "h-0-4000-8000", 6000, 0, 1300),
      opening("window-3", "window", "v-8000-3000-6000", 8000, 4500, 1200, 90),
    ],
    rooms: openingRooms,
    labels: [],
    decorations: [],
  }),
  definition({
    id: "labels-and-areas",
    description: "Five spatial zones with names, per-room areas and stated total.",
    provenance: { kind: "synthetic", note: "Generated from repository-owned vector primitives.", license: null },
    tags: ["labels-and-areas", "calibrated", "multi-room", "cloud-snapshot"],
    widthMm: 8500,
    heightMm: 6500,
    walls: labelWalls,
    openings: [
      opening("door-1", "door", "v-3000-0-2500", 3000, 1200, 900, 90),
      opening("door-2", "door", "v-3000-2500-6500", 3000, 3900, 900, 90),
      opening("door-3", "door", "v-6000-2500-6500", 6000, 4300, 800, 90),
      opening("window-1", "window", "h-0-3000-6000", 4500, 0, 1400),
    ],
    rooms: labelRooms,
    labels: labelsFromRooms(labelRooms),
    decorations: [{ kind: "dimension", x1: 0, y1: -250, x2: 8500, y2: -250, text: "8500" }],
    includeCloudSnapshot: true,
  }),
  definition({
    id: "furniture-heavy",
    description: "Two-zone plan with strong furniture, sanitary, hatch and dimension noise.",
    provenance: { kind: "synthetic", note: "Generated from repository-owned vector primitives.", license: null },
    tags: ["furniture-heavy", "calibrated", "multi-room"],
    widthMm: 7600,
    heightMm: 5200,
    walls: furnitureGrid.walls,
    openings: [
      opening("door-1", "door", "v-3800-0-5200", 3800, 2600, 900, 90),
      opening("window-1", "window", "h-0-0-3800", 1900, 0, 1400),
    ],
    rooms: furnitureRooms,
    labels: [],
    decorations: [
      { kind: "bed", x: 500, y: 700, width: 1800, height: 2100 },
      { kind: "sofa", x: 700, y: 3500, width: 2300, height: 900 },
      { kind: "table", x: 4700, y: 1000, width: 1600, height: 900 },
      { kind: "sanitary", x: 5900, y: 3300, width: 900, height: 1400 },
      { kind: "hatch", x: 4200, y: 3000, width: 1200, height: 1200 },
      { kind: "dimension", x1: 400, y1: 4850, x2: 3300, y2: 4850, text: "2900" },
    ],
  }),
  definition({
    id: "low-resolution",
    description: "Two-zone screenshot rendered to a 480 px long side.",
    provenance: { kind: "synthetic", note: "Generated from repository-owned vector primitives at intentionally low resolution.", license: null },
    tags: ["low-resolution", "calibrated", "multi-room"],
    widthMm: 7000,
    heightMm: 5000,
    millimetersPerPixel: 16,
    walls: lowResolutionGrid.walls,
    openings: [
      opening("door-1", "door", "v-3400-0-5000", 3400, 2500, 900, 90),
      opening("window-1", "window", "h-0-3400-7000", 5200, 0, 1300),
    ],
    rooms: lowResolutionRooms,
    labels: [],
    decorations: [{ kind: "table", x: 4700, y: 2700, width: 1200, height: 800 }],
  }),
  definition({
    id: "perspective-photo",
    description: "Synthetic photographed plan with perspective-like skew and frame edges.",
    provenance: { kind: "synthetic", note: "Generated from repository-owned vector primitives with deterministic affine distortion.", license: null },
    tags: ["perspective", "calibrated", "multi-room"],
    widthMm: 6800,
    heightMm: 4800,
    walls: perspectiveGrid.walls,
    openings: [
      opening("door-1", "door", "v-3300-0-4800", 3300, 2500, 900, 90),
      opening("window-1", "window", "h-0-3300-6800", 5000, 0, 1300),
    ],
    rooms: perspectiveRooms,
    labels: [],
    decorations: [{ kind: "frame" }],
    svgTransform: "matrix(0.96 0.06 -0.08 1 38 12)",
  }),
  definition({
    id: "m7-3-regression-anonymized",
    description: "Redrawn dense analogue preserving the M7.3 failure characteristics without private source data.",
    provenance: { kind: "redrawn-anonymized", note: "Geometry, labels, areas and proportions were independently changed; no original raster or identifiers are included.", license: null },
    tags: ["regression", "furniture-heavy", "labels-and-areas", "calibrated", "multi-room", "cloud-snapshot"],
    widthMm: 7800,
    heightMm: 5800,
    walls: regressionGrid.walls,
    openings: [
      opening("door-1", "door", "v-3000-0-2900", 3000, 1450, 900, 90),
      opening("door-2", "door", "v-3000-2900-5800", 3000, 4300, 800, 90),
      opening("door-3", "door", "h-2900-3000-7800", 5200, 2900, 900),
      opening("window-1", "window", "h-0-0-3000", 1500, 0, 1200),
      opening("window-2", "window", "h-0-3000-7800", 5900, 0, 1500),
      opening("window-3", "window", "v-7800-2900-5800", 7800, 4300, 1100, 90),
    ],
    rooms: regressionRooms,
    labels: labelsFromRooms(regressionRooms),
    decorations: [
      { kind: "bed", x: 350, y: 450, width: 1700, height: 2000 },
      { kind: "sofa", x: 3700, y: 500, width: 2200, height: 900 },
      { kind: "table", x: 4700, y: 3800, width: 1500, height: 900 },
      { kind: "sanitary", x: 500, y: 3800, width: 900, height: 1200 },
      { kind: "hatch", x: 6300, y: 3300, width: 900, height: 1300 },
      { kind: "dimension", x1: 300, y1: 5500, x2: 2700, y2: 5500, text: "2400" },
    ],
    includeCloudSnapshot: true,
  }),
];

export const fixtureSourceIds = fixtureSourceDefinitions.map((entry) => entry.id);
