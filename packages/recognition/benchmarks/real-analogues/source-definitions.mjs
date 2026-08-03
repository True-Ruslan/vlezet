const privateSources = Object.freeze({
  "real-plan-001": { sha256: "c9ed200640c13770821947a5d3628e357e7400679dd6bb174e2a52a6c0f2f9ef", widthPx: 1177, heightPx: 884 },
  "real-plan-002": { sha256: "bd89ecb927d9c7d8bea0273c3124cbd30a7a62a156b8ff4903aca10aad753527", widthPx: 818, heightPx: 1270 },
  "real-plan-003": { sha256: "39e5b58fbf0e980e85f1e45f80376bdfa548c05c0a45e0d40a92721fb4f2d950", widthPx: 936, heightPx: 646 },
  "real-plan-004": { sha256: "ddead2d9bcde29d4ad5b858327f0578ab5257fa2485aa031062ec60721d0d83f", widthPx: 1026, heightPx: 1174 },
  "real-plan-005": { sha256: "7d73b9995b1fed6080e83b125c19c641bbb2da31b5fb3754ce773126509c202a", widthPx: 1108, heightPx: 888 },
  "real-plan-006": { sha256: "6f275e4c9ac2264287988d7528fb43960ed676ba7e0f1a979f246a06436314b2", widthPx: 1148, heightPx: 848 },
  "real-plan-007": { sha256: "b84719058cbd82b02ac7b223789158b8ba956d9b530bba8d2a85e26037f61ec5", widthPx: 940, heightPx: 710 },
  "real-plan-008": { sha256: "5cf1f7e6368c5ec5ccd6fe1955d8c6e1e5f00166158e4e6e4a03f29233f4499e", widthPx: 1502, heightPx: 1488 },
  "real-plan-009": { sha256: "15f9a6e6c9e27f17b3928fb27d3bbda9e424ce2a4640668f6d5f4521680b3d17", widthPx: 1002, heightPx: 838 },
  "real-plan-010": { sha256: "d4b53a310d8d2be1822d1ba3e0320e3b915cb504caa93cd88f9fdcf4acb91b19", widthPx: 1084, heightPx: 1316 },
  "real-plan-011": { sha256: "66f9f51a331384574ac5cabf77d98c3a9a0e302c006c4f31961f9cc610b9d968", widthPx: 1578, heightPx: 1340 },
  "real-plan-012": { sha256: "54ef43f094dd54eb1947e21a4623b11ff104812f87653c160c34849df9733203", widthPx: 1424, heightPx: 990 },
});

function point(x, y) {
  return { x, y };
}

function wall(id, x1, y1, x2, y2, thicknessMm = 220, kind = "partition") {
  return {
    id,
    startMm: point(x1, y1),
    endMm: point(x2, y2),
    thicknessMm,
    kind,
  };
}

function opening(id, kind, hostWallId, x, y, widthMm, orientationDeg, swing = null) {
  return {
    id,
    kind,
    hostWallId,
    centerMm: point(x, y),
    widthMm,
    orientationDeg,
    swing,
  };
}

function door(id, hostWallId, x, y, widthMm = 900, orientationDeg = 0, swing = null) {
  return opening(id, "door", hostWallId, x, y, widthMm, orientationDeg, swing);
}

function windowOpening(id, hostWallId, x, y, widthMm = 1300, orientationDeg = 0) {
  return opening(id, "window", hostWallId, x, y, widthMm, orientationDeg, null);
}

function label(id, text, x, y, size = 36) {
  return { id, kind: "label", text, anchorMm: point(x, y), size };
}

function fixtureSymbol(id, symbol, x, y, widthMm, heightMm, orientationDeg = 0) {
  return {
    id,
    kind: "fixture-symbol",
    symbol,
    boundsMm: { x, y, width: widthMm, height: heightMm },
    orientationDeg,
  };
}

function dashedGuide(id, x1, y1, x2, y2) {
  return { id, kind: "dashed-guide", startMm: point(x1, y1), endMm: point(x2, y2) };
}

function forbiddenRegion(id, x1, y1, x2, y2, reason) {
  return {
    id,
    kind: "wall",
    polygonNormalized: [
      point(x1, y1),
      point(x2, y1),
      point(x2, y2),
      point(x1, y2),
    ],
    reason,
  };
}

function mustDetect(kind, id) {
  return { kind, id };
}

function analogue(input) {
  const source = privateSources[input.privateSourceId];
  if (!source) throw new Error(`Unknown private source: ${input.privateSourceId}`);
  return Object.freeze({
    schemaVersion: "recognition-real-analogue-source-v1",
    id: `${input.privateSourceId}-anonymized`,
    privateSourceId: input.privateSourceId,
    privateSourceSha256: source.sha256,
    description: input.description,
    provenance: {
      kind: "redrawn-anonymized",
      note: "Geometry and observed recognition failure characteristics were manually reconstructed with repository-owned vector primitives; no original raster pixels or labels are included.",
      license: null,
    },
    tags: Object.freeze([...input.tags]),
    sourceWidthPx: source.widthPx,
    sourceHeightPx: source.heightPx,
    millimetersPerPixel: input.millimetersPerPixel ?? 10,
    walls: Object.freeze(input.walls),
    openings: Object.freeze(input.openings),
    decorations: Object.freeze(input.decorations ?? []),
    rooms: Object.freeze(input.rooms ?? []),
    metricApplicability: Object.freeze({
      wallGeometry: true,
      wallTopology: true,
      openings: true,
      rooms: false,
      roomLabels: false,
      roomAreas: false,
      totalArea: false,
      confidence: true,
    }),
    failureExpectations: Object.freeze({
      mustDetect: Object.freeze(input.mustDetect),
      mustNotDetectRegions: Object.freeze(input.mustNotDetectRegions ?? []),
      knownAmbiguities: Object.freeze(input.knownAmbiguities ?? []),
    }),
  });
}

const plan001Walls = [
  wall("external-top", 500, 500, 7600, 500, 320, "external"),
  wall("external-left", 500, 500, 500, 6100, 320, "external"),
  wall("external-bottom", 500, 6100, 7100, 6100, 320, "external"),
  wall("external-right-upper", 7600, 500, 7600, 3500, 320, "external"),
  wall("external-loggia-right", 8300, 3500, 8300, 6100, 150, "external"),
  wall("external-loggia-bottom", 7100, 6100, 8300, 6100, 150, "external"),
  wall("bathroom-left", 5200, 500, 5200, 2750, 220, "partition"),
  wall("bathroom-bottom", 5200, 2750, 7600, 2750, 220, "partition"),
  wall("living-divider", 500, 3450, 5200, 3450, 300, "partition"),
  wall("entry-right", 7100, 3500, 7100, 4450, 250, "partition"),
  wall("service-top", 6450, 4450, 7100, 4450, 180, "partition"),
  wall("service-left", 6450, 4450, 6450, 5250, 180, "partition"),
  wall("service-bottom", 6450, 5250, 7100, 5250, 180, "partition"),
  wall("balcony-thin-wall", 7100, 4450, 7100, 6100, 110, "balcony-boundary"),
];

const plan001Openings = [
  windowOpening("living-window", "external-left", 500, 2100, 1350, 90),
  windowOpening("loggia-window", "balcony-thin-wall", 7100, 5350, 1100, 90),
  door("bathroom-door", "bathroom-bottom", 6150, 2750, 800, 0, "right"),
  door("entrance-door", "external-right-upper", 7600, 3450, 950, 90, "left"),
  door("living-door", "living-divider", 4300, 3450, 900, 0, "left"),
];

const plan002Walls = [
  wall("p2-top-left", 900, 650, 3050, 650, 300, "external"),
  wall("p2-top-right", 3900, 650, 5200, 650, 300, "external"),
  wall("p2-left", 900, 650, 900, 9300, 300, "external"),
  wall("p2-right", 5200, 650, 5200, 9300, 300, "external"),
  wall("p2-bottom-left", 900, 9300, 2500, 9300, 300, "external"),
  wall("p2-bottom-right", 3450, 9300, 5200, 9300, 300, "external"),
  wall("p2-balcony-left", 1050, 9300, 1050, 11000, 150, "external"),
  wall("p2-balcony-right", 5050, 9300, 5050, 11000, 150, "external"),
  wall("p2-balcony-bottom", 1050, 11000, 5050, 11000, 150, "external"),
  wall("p2-bath-right", 3050, 650, 3050, 3600, 220, "partition"),
  wall("p2-bath-bottom", 900, 3600, 3050, 3600, 220, "partition"),
  wall("p2-hall-divider", 3050, 3600, 5200, 3600, 220, "partition"),
];

const plan002Openings = [
  door("p2-entrance-door", "p2-top-left", 3450, 650, 900, 0, "right"),
  door("p2-bath-door", "p2-bath-right", 3050, 2850, 800, 90, "left"),
  door("p2-balcony-door", "p2-bottom-right", 3900, 9300, 850, 0, "right"),
  windowOpening("p2-balcony-window", "p2-bottom-left", 1900, 9300, 1350, 0),
];

const plan003Walls = [
  wall("p3-top", 500, 500, 8200, 500, 320, "external"),
  wall("p3-left", 500, 500, 500, 5000, 320, "external"),
  wall("p3-bottom", 500, 5000, 8200, 5000, 320, "external"),
  wall("p3-right-upper", 8200, 500, 8200, 1700, 320, "external"),
  wall("p3-right-lower", 8200, 2600, 8200, 5000, 320, "external"),
  wall("p3-wet-left", 5100, 500, 5100, 3900, 240, "partition"),
  wall("p3-wet-top-divider", 5100, 2350, 8200, 2350, 220, "partition"),
  wall("p3-kitchen-divider", 4300, 2350, 4300, 5000, 160, "partition"),
  wall("p3-service-left", 5600, 2350, 5600, 5000, 180, "partition"),
];

const plan003Openings = [
  door("p3-entrance-door", "p3-right-upper", 8200, 2150, 900, 90, "left"),
  door("p3-bath-door", "p3-wet-left", 5100, 1900, 800, 90, "right"),
  windowOpening("p3-living-window", "p3-left", 500, 2500, 1500, 90),
];

const plan004Walls = [
  wall("p4-top-left", 650, 600, 3100, 600, 300, "external"),
  wall("p4-top-right", 4000, 600, 7200, 600, 300, "external"),
  wall("p4-left", 650, 600, 650, 8200, 300, "external"),
  wall("p4-right", 7200, 600, 7200, 8200, 300, "external"),
  wall("p4-bottom-left", 650, 8200, 3000, 8200, 300, "external"),
  wall("p4-bottom-right", 3900, 8200, 7200, 8200, 300, "external"),
  wall("p4-balcony-left", 800, 8200, 800, 10400, 150, "external"),
  wall("p4-balcony-right", 4200, 8200, 4200, 10400, 150, "external"),
  wall("p4-balcony-bottom", 800, 10400, 4200, 10400, 150, "external"),
  wall("p4-room-divider", 3300, 2500, 3300, 8200, 220, "partition"),
  wall("p4-storage-bottom", 650, 2500, 2450, 2500, 200, "partition"),
  wall("p4-bath-left", 5000, 600, 5000, 3100, 220, "partition"),
  wall("p4-bath-bottom", 5000, 3100, 7200, 3100, 220, "partition"),
];

const plan004Openings = [
  door("p4-entrance-door", "p4-top-left", 3550, 600, 900, 0, "right"),
  door("p4-storage-door", "p4-storage-bottom", 2550, 2500, 800, 0, "left"),
  door("p4-room-door", "p4-room-divider", 3300, 3100, 900, 90, "right"),
  door("p4-bath-door", "p4-bath-left", 5000, 2300, 800, 90, "left"),
  door("p4-balcony-door", "p4-bottom-right", 3450, 8200, 850, 0, "right"),
  windowOpening("p4-balcony-window", "p4-bottom-left", 1900, 8200, 1250, 0),
];

const plan005Walls = [
  wall("p5-top-left", 650, 650, 3300, 650, 320, "external"),
  wall("p5-top-main", 3300, 250, 8200, 250, 320, "external"),
  wall("p5-left-upper", 650, 650, 650, 3750, 320, "external"),
  wall("p5-left-lower", 650, 4700, 650, 6900, 320, "external"),
  wall("p5-bottom", 650, 6900, 8200, 6900, 320, "external"),
  wall("p5-right", 8200, 250, 8200, 6900, 320, "external"),
  wall("p5-loggia-top", 8200, 250, 9800, 250, 150, "external"),
  wall("p5-loggia-right", 9800, 250, 9800, 6900, 150, "external"),
  wall("p5-loggia-bottom", 8200, 6900, 9800, 6900, 150, "external"),
  wall("p5-bath-right", 3300, 650, 3300, 3600, 240, "partition"),
  wall("p5-bath-bottom", 650, 3600, 3300, 3600, 240, "partition"),
  wall("p5-bedroom-bottom", 3300, 3600, 8200, 3600, 300, "partition"),
  wall("p5-loggia-boundary", 8200, 250, 8200, 6900, 180, "balcony-boundary"),
];

const plan005Openings = [
  door("p5-entrance-door", "p5-left-upper", 650, 4225, 950, 90, "right"),
  door("p5-bath-door", "p5-bath-right", 3300, 2850, 800, 90, "left"),
  door("p5-bedroom-door", "p5-bedroom-bottom", 3900, 3600, 900, 0, "right"),
  door("p5-loggia-door", "p5-loggia-boundary", 8200, 4450, 900, 90, "left"),
  windowOpening("p5-bedroom-window", "p5-loggia-boundary", 8200, 1900, 1500, 90),
  windowOpening("p5-kitchen-window", "p5-loggia-boundary", 8200, 5800, 1300, 90),
];

const plan006Walls = [
  wall("p6-top", 600, 500, 8600, 500, 320, "external"),
  wall("p6-left-upper", 600, 500, 600, 3300, 320, "external"),
  wall("p6-left-lower", 600, 4250, 600, 6800, 320, "external"),
  wall("p6-bottom", 600, 6800, 8600, 6800, 320, "external"),
  wall("p6-right", 8600, 500, 8600, 6800, 320, "external"),
  wall("p6-loggia-top", 8600, 2700, 10100, 2700, 150, "external"),
  wall("p6-loggia-right", 10100, 2700, 10100, 6100, 150, "external"),
  wall("p6-loggia-bottom", 8600, 6100, 10100, 6100, 150, "external"),
  wall("p6-bath-bottom", 600, 3000, 3600, 3000, 220, "partition"),
  wall("p6-bath-right", 3600, 500, 3600, 3000, 220, "partition"),
  wall("p6-room-divider", 3600, 3000, 8600, 3000, 260, "partition"),
  wall("p6-loggia-boundary", 8600, 2700, 8600, 6100, 170, "balcony-boundary"),
];

const plan006Openings = [
  door("p6-entrance-door", "p6-left-upper", 600, 3775, 950, 90, "right"),
  door("p6-bath-door", "p6-bath-bottom", 2850, 3000, 800, 0, "right"),
  door("p6-room-door", "p6-room-divider", 4250, 3000, 900, 0, "left"),
  door("p6-loggia-door", "p6-loggia-boundary", 8600, 3600, 900, 90, "left"),
  windowOpening("p6-living-window", "p6-loggia-boundary", 8600, 5000, 1350, 90),
];

const plan007Walls = [
  wall("p7-top", 550, 550, 8200, 550, 320, "external"),
  wall("p7-left", 550, 550, 550, 5600, 320, "external"),
  wall("p7-bottom", 550, 5600, 8200, 5600, 320, "external"),
  wall("p7-right", 8200, 550, 8200, 5600, 320, "external"),
  wall("p7-balcony-top", 8200, 550, 9700, 550, 150, "external"),
  wall("p7-balcony-right", 9700, 550, 9700, 5600, 150, "external"),
  wall("p7-balcony-bottom", 8200, 5600, 9700, 5600, 150, "external"),
  wall("p7-wet-right", 3600, 550, 3600, 2350, 220, "partition"),
  wall("p7-wet-bottom", 550, 2350, 3600, 2350, 220, "partition"),
  wall("p7-bedroom-bottom", 3600, 2900, 8200, 2900, 280, "partition"),
  wall("p7-balcony-boundary", 8200, 550, 8200, 5600, 170, "balcony-boundary"),
];

const plan007Openings = [
  door("p7-bath-door", "p7-wet-bottom", 3000, 2350, 800, 0, "left"),
  door("p7-bedroom-door", "p7-bedroom-bottom", 4250, 2900, 900, 0, "right"),
  door("p7-loggia-door", "p7-balcony-boundary", 8200, 3900, 900, 90, "left"),
  windowOpening("p7-bedroom-window", "p7-balcony-boundary", 8200, 1600, 1300, 90),
  windowOpening("p7-kitchen-window", "p7-balcony-boundary", 8200, 5050, 950, 90),
];

const plan008Walls = [
  wall("p8-northwest", 2100, 900, 7200, 6000, 320, "external"),
  wall("p8-northeast", 7200, 6000, 10400, 2800, 320, "external"),
  wall("p8-east", 10400, 2800, 13000, 5400, 320, "external"),
  wall("p8-southeast", 13000, 5400, 7700, 10700, 320, "external"),
  wall("p8-southwest", 7700, 10700, 3200, 6200, 320, "external"),
  wall("p8-west", 3200, 6200, 2100, 5100, 180, "external"),
  wall("p8-west-balcony", 2100, 5100, 2100, 900, 150, "external"),
  wall("p8-room-divider-a", 5000, 4200, 7600, 6800, 250, "partition"),
  wall("p8-room-divider-b", 7600, 6800, 9300, 5100, 250, "partition"),
  wall("p8-bath-divider", 9300, 5100, 11200, 7000, 220, "partition"),
  wall("p8-balcony-boundary", 2100, 5100, 3200, 6200, 130, "balcony-boundary"),
];

const plan008Openings = [
  door("p8-entrance-door", "p8-northeast", 8800, 4400, 900, -45, "right"),
  door("p8-room-door", "p8-room-divider-a", 6300, 5500, 900, 45, "left"),
  door("p8-bath-door", "p8-bath-divider", 10150, 5950, 800, 45, "right"),
  door("p8-balcony-door", "p8-balcony-boundary", 2650, 5650, 850, 45, "left"),
  windowOpening("p8-living-window", "p8-southwest", 5900, 8900, 1500, 45),
];

const plan009Walls = [
  wall("p9-top-left", 700, 550, 3600, 550, 320, "external"),
  wall("p9-top-right", 4500, 550, 8800, 550, 320, "external"),
  wall("p9-left", 700, 550, 700, 6400, 320, "external"),
  wall("p9-right", 8800, 550, 8800, 6400, 320, "external"),
  wall("p9-bottom", 700, 6400, 8800, 6400, 320, "external"),
  wall("p9-balcony-left", 2200, 6400, 2200, 8000, 150, "external"),
  wall("p9-balcony-right", 6000, 6400, 6000, 8000, 150, "external"),
  wall("p9-balcony-bottom", 2200, 8000, 6000, 8000, 150, "external"),
  wall("p9-wet1-right", 3000, 550, 3000, 2300, 220, "partition"),
  wall("p9-wet1-bottom", 700, 2300, 3000, 2300, 220, "partition"),
  wall("p9-wet2-left", 5600, 550, 5600, 2500, 220, "partition"),
  wall("p9-wet2-bottom", 5600, 2500, 8800, 2500, 220, "partition"),
  wall("p9-room-divider", 3000, 3300, 8800, 3300, 280, "partition"),
  wall("p9-balcony-boundary", 2200, 6400, 6000, 6400, 150, "balcony-boundary"),
];

const plan009Openings = [
  door("p9-entrance-door", "p9-top-left", 4050, 550, 900, 0, "right"),
  door("p9-wet1-door", "p9-wet1-bottom", 2350, 2300, 800, 0, "left"),
  door("p9-wet2-door", "p9-wet2-left", 5600, 1900, 800, 90, "right"),
  door("p9-room-door", "p9-room-divider", 4900, 3300, 900, 0, "left"),
  door("p9-balcony-door", "p9-balcony-boundary", 5200, 6400, 850, 0, "right"),
  windowOpening("p9-balcony-window", "p9-balcony-boundary", 3350, 6400, 1600, 0),
];

const plan010Walls = [
  wall("p10-top", 700, 500, 7600, 500, 320, "external"),
  wall("p10-left-upper", 700, 500, 700, 5000, 320, "external"),
  wall("p10-left-lower", 700, 5900, 700, 11200, 320, "external"),
  wall("p10-right", 7600, 500, 7600, 11200, 320, "external"),
  wall("p10-bottom", 700, 11200, 7600, 11200, 320, "external"),
  wall("p10-balcony-a-left", 700, 5000, 250, 5000, 150, "external"),
  wall("p10-balcony-a-outer", 250, 5000, 250, 8000, 150, "external"),
  wall("p10-balcony-a-bottom", 250, 8000, 700, 8000, 150, "external"),
  wall("p10-balcony-b-left", 7600, 2300, 9000, 2300, 150, "external"),
  wall("p10-balcony-b-right", 9000, 2300, 9000, 6600, 150, "external"),
  wall("p10-balcony-b-bottom", 7600, 6600, 9000, 6600, 150, "external"),
  wall("p10-wet-left", 5000, 500, 5000, 2700, 220, "partition"),
  wall("p10-wet-bottom", 5000, 2700, 7600, 2700, 220, "partition"),
  wall("p10-room-divider-a", 700, 4100, 5000, 4100, 260, "partition"),
  wall("p10-room-divider-b", 5000, 4100, 7600, 4100, 260, "partition"),
  wall("p10-balcony-a-boundary", 700, 5000, 700, 8000, 140, "balcony-boundary"),
  wall("p10-balcony-b-boundary", 7600, 2300, 7600, 6600, 140, "balcony-boundary"),
];

const plan010Openings = [
  door("p10-entrance-door", "p10-left-upper", 700, 5450, 900, 90, "right"),
  door("p10-wet-door", "p10-wet-left", 5000, 2050, 800, 90, "left"),
  door("p10-room-a-door", "p10-room-divider-a", 4100, 4100, 900, 0, "right"),
  door("p10-room-b-door", "p10-room-divider-b", 5900, 4100, 900, 0, "left"),
  door("p10-balcony-a-door", "p10-balcony-a-boundary", 700, 7150, 850, 90, "right"),
  door("p10-balcony-b-door", "p10-balcony-b-boundary", 7600, 5600, 850, 90, "left"),
  windowOpening("p10-balcony-a-window", "p10-balcony-a-boundary", 700, 5900, 900, 90),
  windowOpening("p10-balcony-b-window", "p10-balcony-b-boundary", 7600, 3500, 1400, 90),
];

const plan011Walls = [
  wall("p11-top", 1100, 700, 9600, 700, 340, "external"),
  wall("p11-left-upper", 1100, 700, 1100, 3100, 340, "external"),
  wall("p11-left-mid", 1100, 3100, 500, 3100, 180, "external"),
  wall("p11-left-lower", 500, 3100, 500, 7600, 180, "external"),
  wall("p11-bottom-left", 500, 7600, 6200, 7600, 340, "external"),
  wall("p11-bottom-right", 7200, 7600, 9600, 7600, 340, "external"),
  wall("p11-right", 9600, 700, 9600, 7600, 340, "external"),
  wall("p11-balcony-top", 9600, 1600, 11000, 1600, 150, "external"),
  wall("p11-balcony-right", 11000, 1600, 11000, 6000, 150, "external"),
  wall("p11-balcony-bottom", 9600, 6000, 11000, 6000, 150, "external"),
  wall("p11-wet-a-right", 3600, 700, 3600, 2600, 220, "partition"),
  wall("p11-wet-a-bottom", 1100, 2600, 3600, 2600, 220, "partition"),
  wall("p11-wet-b-left", 6500, 700, 6500, 2600, 220, "partition"),
  wall("p11-wet-b-bottom", 6500, 2600, 9600, 2600, 220, "partition"),
  wall("p11-room-divider", 3600, 3500, 9600, 3500, 280, "partition"),
  wall("p11-balcony-boundary", 9600, 1600, 9600, 6000, 150, "balcony-boundary"),
];

const plan011Openings = [
  door("p11-entrance-door", "p11-left-mid", 800, 3100, 850, 0, "right"),
  door("p11-wet-a-door", "p11-wet-a-right", 3600, 2050, 800, 90, "left"),
  door("p11-wet-b-door", "p11-wet-b-left", 6500, 2050, 800, 90, "right"),
  door("p11-room-door", "p11-room-divider", 5550, 3500, 900, 0, "left"),
  door("p11-balcony-door", "p11-balcony-boundary", 9600, 5100, 850, 90, "right"),
  windowOpening("p11-bedroom-window", "p11-balcony-boundary", 9600, 2800, 1400, 90),
  windowOpening("p11-kitchen-window", "p11-bottom-left", 5200, 7600, 1350, 0),
];

const plan012Walls = [
  wall("p12-top-left", 500, 700, 4200, 700, 320, "external"),
  wall("p12-top-mid", 5100, 700, 8700, 700, 320, "external"),
  wall("p12-top-right", 9600, 700, 12500, 700, 320, "external"),
  wall("p12-left", 500, 700, 500, 6900, 320, "external"),
  wall("p12-bottom-left", 500, 6900, 7600, 6900, 320, "external"),
  wall("p12-bottom-right", 8500, 6900, 12500, 6900, 320, "external"),
  wall("p12-right", 12500, 700, 12500, 6900, 320, "external"),
  wall("p12-wet-a-left", 7600, 3500, 7600, 6900, 220, "partition"),
  wall("p12-wet-a-top", 7600, 3500, 9800, 3500, 220, "partition"),
  wall("p12-wet-b-left", 10100, 3500, 10100, 6900, 220, "partition"),
  wall("p12-wet-b-top", 10100, 3500, 12500, 3500, 220, "partition"),
  wall("p12-room-divider", 7600, 700, 7600, 3500, 280, "partition"),
  wall("p12-balcony-left", 500, 700, 500, 6900, 150, "balcony-boundary"),
];

const plan012Openings = [
  door("p12-entrance-door", "p12-top-mid", 4650, 700, 900, 0, "right"),
  door("p12-room-door", "p12-room-divider", 7600, 2850, 900, 90, "left"),
  door("p12-wet-a-door", "p12-wet-a-top", 8900, 3500, 800, 0, "right"),
  door("p12-wet-b-door", "p12-wet-b-top", 11200, 3500, 800, 0, "left"),
  windowOpening("p12-window-left", "p12-top-left", 2850, 700, 1350, 0),
  windowOpening("p12-window-mid", "p12-top-mid", 6700, 700, 1300, 0),
  windowOpening("p12-window-right", "p12-top-right", 10900, 700, 1200, 0),
  windowOpening("p12-window-bottom", "p12-bottom-right", 10600, 6900, 1450, 0),
];

export const realAnalogueDefinitions = Object.freeze([
  analogue({
    privateSourceId: "real-plan-001",
    description: "Landscape one-room plan with a thin loggia boundary, mixed wall thickness, visible windows and sanitary fixture clutter.",
    tags: ["landscape", "one-room", "loggia", "thin-loggia-wall", "windows-heavy", "sanitary-clutter", "current-regression"],
    walls: plan001Walls,
    openings: plan001Openings,
    decorations: [
      fixtureSymbol("p1-bath", "bath", 5450, 700, 650, 1500),
      fixtureSymbol("p1-sink", "sink", 6550, 700, 600, 450),
      fixtureSymbol("p1-toilet", "toilet", 6750, 1650, 650, 450),
      fixtureSymbol("p1-kitchen-sink", "sink", 6500, 4550, 500, 500),
      fixtureSymbol("p1-cooktop", "cooktop", 6500, 5450, 500, 500),
      label("p1-area-large", "2", 3300, 5000, 128),
      dashedGuide("p1-guide", 5050, 3450, 6100, 3450),
    ],
    mustDetect: [
      mustDetect("wall", "balcony-thin-wall"),
      mustDetect("window", "living-window"),
      mustDetect("window", "loggia-window"),
      mustDetect("door", "bathroom-door"),
      mustDetect("door", "entrance-door"),
      mustDetect("door", "living-door"),
    ],
    mustNotDetectRegions: [
      forbiddenRegion("kitchen-sink-symbol", 0.75, 0.58, 0.86, 0.76, "Kitchen fixture contours must not become walls."),
      forbiddenRegion("toilet-service-symbols", 0.72, 0.12, 0.88, 0.34, "Sanitary symbols and service shafts must not become structural walls."),
    ],
  }),
  analogue({
    privateSourceId: "real-plan-002",
    description: "Portrait studio with a long living zone, compact wet block, entrance door and a shallow external balcony.",
    tags: ["portrait", "studio", "balcony", "sanitary-heavy", "entrance-door"],
    walls: plan002Walls,
    openings: plan002Openings,
    decorations: [fixtureSymbol("p2-bath", "bath", 1050, 850, 1700, 600), fixtureSymbol("p2-toilet", "toilet", 2300, 2500, 450, 650), label("p2-label", "C", 1800, 6900, 110)],
    mustDetect: [mustDetect("door", "p2-entrance-door"), mustDetect("door", "p2-balcony-door"), mustDetect("window", "p2-balcony-window")],
    mustNotDetectRegions: [forbiddenRegion("p2-wet-fixtures", 0.12, 0.12, 0.48, 0.36, "Dense sanitary symbols must remain non-structural.")],
  }),
  analogue({
    privateSourceId: "real-plan-003",
    description: "Landscape studio with a right-side sanitary block, one exterior window and large typography close to partitions.",
    tags: ["landscape", "studio", "exterior-window", "sanitary-block", "label-heavy"],
    walls: plan003Walls,
    openings: plan003Openings,
    decorations: [fixtureSymbol("p3-bath", "bath", 6900, 2600, 800, 1800), fixtureSymbol("p3-sink", "sink", 4500, 3000, 650, 500), label("p3-label", "C", 1500, 1800, 120)],
    mustDetect: [mustDetect("window", "p3-living-window"), mustDetect("door", "p3-bath-door")],
    mustNotDetectRegions: [forbiddenRegion("p3-service-shafts", 0.52, 0.45, 0.72, 0.82, "Service shafts must not form an extra room wall network.")],
  }),
  analogue({
    privateSourceId: "real-plan-004",
    description: "Portrait one-room layout with multiple door conventions, mixed partition thickness and a projecting balcony footprint.",
    tags: ["portrait", "one-room", "balcony", "multiple-doors", "mixed-wall-thickness"],
    walls: plan004Walls,
    openings: plan004Openings,
    decorations: [fixtureSymbol("p4-bath", "bath", 5300, 800, 1500, 500), fixtureSymbol("p4-kitchen", "cooktop", 5800, 3700, 500, 500)],
    mustDetect: [mustDetect("door", "p4-room-door"), mustDetect("door", "p4-balcony-door"), mustDetect("window", "p4-balcony-window")],
    mustNotDetectRegions: [forbiddenRegion("p4-kitchen-symbols", 0.62, 0.34, 0.82, 0.55, "Kitchen symbols must remain decorations.")],
  }),
  analogue({
    privateSourceId: "real-plan-005",
    description: "Landscape one-room plan with thick exterior bands, an elongated loggia and a dense sanitary group at the left edge.",
    tags: ["landscape", "one-room", "loggia", "thick-walls", "sanitary-heavy", "windows-heavy"],
    walls: plan005Walls,
    openings: plan005Openings,
    decorations: [fixtureSymbol("p5-bath", "bath", 900, 900, 1800, 600), fixtureSymbol("p5-washer", "washer", 2500, 2500, 500, 500)],
    mustDetect: [mustDetect("wall", "p5-loggia-boundary"), mustDetect("window", "p5-bedroom-window"), mustDetect("window", "p5-kitchen-window")],
    mustNotDetectRegions: [forbiddenRegion("p5-sanitary-symbols", 0.08, 0.12, 0.34, 0.45, "Sanitary outlines must not duplicate nearby thick walls.")],
  }),
  analogue({
    privateSourceId: "real-plan-006",
    description: "Landscape one-room layout with an external loggia, several openings and a compact wet zone connected to the entrance hall.",
    tags: ["landscape", "one-room", "loggia", "openings-heavy", "wet-zone"],
    walls: plan006Walls,
    openings: plan006Openings,
    decorations: [fixtureSymbol("p6-bath", "bath", 900, 800, 1700, 600), fixtureSymbol("p6-sink", "sink", 4300, 5000, 550, 500)],
    mustDetect: [mustDetect("door", "p6-loggia-door"), mustDetect("window", "p6-living-window"), mustDetect("door", "p6-bath-door")],
    mustNotDetectRegions: [forbiddenRegion("p6-wet-fixtures", 0.08, 0.10, 0.35, 0.38, "Wet-zone fixture rails must not be structural walls.")],
  }),
  analogue({
    privateSourceId: "real-plan-007",
    description: "Landscape two-room analogue with a full-height balcony boundary, service block and multiple host-wall windows.",
    tags: ["landscape", "two-room", "balcony", "service-block", "windows-heavy"],
    walls: plan007Walls,
    openings: plan007Openings,
    decorations: [fixtureSymbol("p7-bath", "bath", 900, 800, 1600, 550), fixtureSymbol("p7-kitchen", "sink", 4200, 4000, 550, 500)],
    mustDetect: [mustDetect("window", "p7-bedroom-window"), mustDetect("window", "p7-kitchen-window"), mustDetect("wall", "p7-balcony-boundary")],
    mustNotDetectRegions: [forbiddenRegion("p7-service-block", 0.12, 0.12, 0.38, 0.40, "Service-block contours must not create parallel wall duplicates.")],
  }),
  analogue({
    privateSourceId: "real-plan-008",
    description: "Diagonal two-room plan that exercises arbitrary-angle walls, rotation invariance, a balcony edge and multiple wet-zone symbols.",
    tags: ["diagonal", "two-room", "rotation-invariance", "balcony", "multiple-wet-zones"],
    millimetersPerPixel: 9,
    walls: plan008Walls,
    openings: plan008Openings,
    decorations: [fixtureSymbol("p8-kitchen", "cooktop", 4700, 2400, 500, 500, 45), fixtureSymbol("p8-bath", "bath", 10000, 6200, 1600, 550, 45)],
    mustDetect: [mustDetect("wall", "p8-northwest"), mustDetect("door", "p8-room-door"), mustDetect("window", "p8-living-window")],
    mustNotDetectRegions: [forbiddenRegion("p8-diagonal-fixtures", 0.58, 0.32, 0.79, 0.58, "Rotated fixture contours must not become diagonal walls.")],
  }),
  analogue({
    privateSourceId: "real-plan-009",
    description: "Landscape two-room plan with a balcony, two separate service blocks and an openings-heavy internal circulation pattern.",
    tags: ["landscape", "two-room", "balcony", "two-service-blocks", "openings-heavy", "two-wet-zones"],
    walls: plan009Walls,
    openings: plan009Openings,
    decorations: [fixtureSymbol("p9-wet-a", "bath", 950, 800, 1600, 550), fixtureSymbol("p9-wet-b", "bath", 6200, 800, 1700, 550)],
    mustDetect: [mustDetect("door", "p9-wet1-door"), mustDetect("door", "p9-wet2-door"), mustDetect("window", "p9-balcony-window")],
    mustNotDetectRegions: [forbiddenRegion("p9-two-service-blocks", 0.08, 0.10, 0.88, 0.33, "Two wet-zone fixture groups must stay separate from structural topology.")],
  }),
  analogue({
    privateSourceId: "real-plan-010",
    description: "Portrait two-room irregular footprint with two projecting balconies, several windows and mixed interior door placements.",
    tags: ["portrait", "two-room", "multiple-balconies", "balcony", "windows-heavy", "irregular-footprint"],
    walls: plan010Walls,
    openings: plan010Openings,
    decorations: [fixtureSymbol("p10-bath", "bath", 5350, 850, 1700, 550), fixtureSymbol("p10-kitchen", "cooktop", 5800, 7600, 500, 500)],
    mustDetect: [mustDetect("wall", "p10-balcony-a-boundary"), mustDetect("wall", "p10-balcony-b-boundary"), mustDetect("window", "p10-balcony-b-window")],
    mustNotDetectRegions: [forbiddenRegion("p10-wet-fixtures", 0.62, 0.08, 0.88, 0.27, "Wet-zone symbols must not extend irregular exterior walls inward.")],
  }),
  analogue({
    privateSourceId: "real-plan-011",
    description: "Landscape two-room irregular plan with two wet zones, a side balcony and windows distributed across different exterior bands.",
    tags: ["landscape", "two-room", "balcony", "irregular-footprint", "multiple-wet-zones", "window-heavy"],
    walls: plan011Walls,
    openings: plan011Openings,
    decorations: [fixtureSymbol("p11-bath-a", "bath", 1300, 900, 1600, 550), fixtureSymbol("p11-bath-b", "bath", 7000, 900, 1700, 550), fixtureSymbol("p11-kitchen", "sink", 4300, 5200, 550, 500)],
    mustDetect: [mustDetect("door", "p11-wet-a-door"), mustDetect("door", "p11-wet-b-door"), mustDetect("window", "p11-bedroom-window")],
    mustNotDetectRegions: [forbiddenRegion("p11-multiple-wet-zones", 0.08, 0.08, 0.88, 0.31, "Multiple sanitary groups must not create phantom partitions.")],
  }),
  analogue({
    privateSourceId: "real-plan-012",
    description: "Wide two-room openings-heavy plan with two wet zones and several exterior windows separated by thick structural piers.",
    tags: ["landscape", "two-room", "openings-heavy", "windows-heavy", "two-wet-zones", "balcony"],
    walls: plan012Walls,
    openings: plan012Openings,
    decorations: [fixtureSymbol("p12-wet-a", "bath", 7900, 3900, 1600, 550), fixtureSymbol("p12-wet-b", "bath", 10400, 3900, 1700, 550), label("p12-large", "2", 3300, 3300, 120)],
    mustDetect: [mustDetect("window", "p12-window-left"), mustDetect("window", "p12-window-mid"), mustDetect("window", "p12-window-right"), mustDetect("door", "p12-room-door")],
    mustNotDetectRegions: [forbiddenRegion("p12-two-wet-zones", 0.58, 0.43, 0.93, 0.83, "Two dense wet zones must not produce short false walls.")],
  }),
]);
