import { deflateSync } from "node:zlib";
import { expect, test } from "./fixtures.mjs";

const DB_NAME = "vlezet";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function within(value, start, end) {
  return value >= start && value <= end;
}

function tracingChainReferencePng(width = 900, height = 700) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = [];

  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3, 244);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const outerFaces =
        within(x, 94, 96) || within(x, 109, 111) ||
        within(x, 694, 696) || within(x, 709, 711) ||
        within(y, 94, 96) || within(y, 109, 111) ||
        within(y, 544, 546) || within(y, 559, 561);
      const innerFaces =
        (within(y, 294, 296) || within(y, 309, 311)) && within(x, 110, 500) ||
        (within(x, 494, 496) || within(x, 509, 511)) && within(y, 110, 310);
      const detail = !outerFaces && !innerFaces && (
        (within(x, 210, 270) && y === 390) ||
        (x === 610 && within(y, 180, 245)) ||
        (within(x, 560, 625) && within(y, 430, 432))
      );
      const value = outerFaces || innerFaces ? 25 : detail ? 188 : 244;
      const offset = 1 + x * 3;
      row[offset] = value;
      row[offset + 1] = value;
      row[offset + 2] = value;
    }
    rows.push(row);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.locator(".projects-page, .editor-app").first()).toBeVisible();
  if (await page.locator(".editor-app").isVisible()) {
    await page.getByRole("button", { name: "Вернуться к моим проектам" }).click();
  }
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".canvas-shell")).toBeVisible();
}

async function readProject(page) {
  return page.evaluate((dbName) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB project open failed"));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("projects", "readonly");
      const projectsRequest = transaction.objectStore("projects").getAll();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB project read failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB project read aborted"));
      transaction.oncomplete = () => {
        const project = projectsRequest.result[0] ?? null;
        database.close();
        resolve(project);
      };
    };
  }), DB_NAME);
}

async function canvasBox(page) {
  const box = await page.locator(".konvajs-content").first().boundingBox();
  if (!box) throw new Error("Canvas stage is not visible.");
  return box;
}

function sourcePointToWorld(reference, sourcePoint) {
  const radians = reference.transform.rotationDeg * Math.PI / 180;
  const scaled = {
    x: sourcePoint.x * reference.transform.millimetersPerPixel,
    y: sourcePoint.y * reference.transform.millimetersPerPixel,
  };
  return {
    x: reference.transform.originWorld.x + scaled.x * Math.cos(radians) - scaled.y * Math.sin(radians),
    y: reference.transform.originWorld.y + scaled.x * Math.sin(radians) + scaled.y * Math.cos(radians),
  };
}

function sourcePointToPage(project, box, sourcePoint) {
  const reference = project.referencePlan;
  if (!reference) throw new Error("Reference plan is missing.");
  const world = sourcePointToWorld(reference, sourcePoint);
  return {
    x: box.x + world.x * project.viewport.pixelsPerMillimeter + project.viewport.offsetX,
    y: box.y + world.y * project.viewport.pixelsPerMillimeter + project.viewport.offsetY,
  };
}

function imagePointToPage(imageBox, sourceSize, sourcePoint) {
  return {
    x: imageBox.x + imageBox.width * sourcePoint.x / sourceSize.width,
    y: imageBox.y + imageBox.height * sourcePoint.y / sourceSize.height,
  };
}

async function imageClientPoint(image, sourceSize, sourcePoint) {
  const imageBox = await image.boundingBox();
  if (!imageBox) throw new Error("Calibration image is not visible.");
  return imagePointToPage(imageBox, sourceSize, sourcePoint);
}

async function installReference(page) {
  await page.getByRole("button", { name: "Подложка", exact: true }).click();
  await page.locator('input[type="file"][aria-label="Загрузить план квартиры"]').setInputFiles({
    name: "m8-4-chain.png",
    mimeType: "image/png",
    buffer: tracingChainReferencePng(),
  });
  await expect(page.locator(".context-panel-title")).toHaveText("Калибровка масштаба");
  const image = page.locator(".calibration-stage img");
  await expect(image).toBeVisible();
  await page.getByRole("button", { name: "Вписать план" }).click();
  const sourceSnap = page.getByRole("checkbox", { name: "Привязка к линиям плана" });
  if (await sourceSnap.isChecked()) await sourceSnap.uncheck();
  const pointA = await imageClientPoint(image, { width: 900, height: 700 }, { x: 102, y: 102 });
  await page.mouse.click(pointA.x, pointA.y);
  const pointB = await imageClientPoint(image, { width: 900, height: 700 }, { x: 702, y: 102 });
  await page.mouse.click(pointB.x, pointB.y);
  await page.getByLabel("Реальная длина").fill("6000");
  await page.getByLabel("Выравнивание").selectOption("horizontal");
  await page.getByRole("button", { name: "Сохранить и открыть план" }).click();
  await expect(page.locator(".context-panel-title")).toHaveText("Подложка настроена");

  const beforeFit = await readProject(page);
  if (!beforeFit?.referencePlan) throw new Error("Calibrated reference is unavailable before viewport fit.");
  await page.getByRole("button", { name: "Показать подложку", exact: true }).click();
  await expect.poll(async () => JSON.stringify((await readProject(page))?.viewport))
    .not.toBe(JSON.stringify(beforeFit.viewport));
  return readProject(page);
}

function wallEndpoints(document) {
  const vertices = new Map(document.vertices.map((vertex) => [vertex.id, vertex.position]));
  return document.walls.map((wall) => ({
    wall,
    start: vertices.get(wall.startVertexId),
    end: vertices.get(wall.endVertexId),
  }));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function clickSource(page, project, box, sourcePoint, offset = { x: 0, y: 0 }) {
  const point = sourcePointToPage(project, box, sourcePoint);
  const clickPoint = { x: point.x + offset.x, y: point.y + offset.y };
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Browser viewport is unavailable.");
  const visibleCanvas = {
    minX: Math.max(0, box.x),
    minY: Math.max(0, box.y),
    maxX: Math.min(viewport.width, box.x + box.width),
    maxY: Math.min(viewport.height, box.y + box.height),
  };
  if (
    clickPoint.x < visibleCanvas.minX || clickPoint.x > visibleCanvas.maxX ||
    clickPoint.y < visibleCanvas.minY || clickPoint.y > visibleCanvas.maxY
  ) {
    throw new Error(
      `Source click (${clickPoint.x.toFixed(1)}, ${clickPoint.y.toFixed(1)}) is outside the visible canvas ` +
      `[${visibleCanvas.minX.toFixed(1)}, ${visibleCanvas.minY.toFixed(1)}]–` +
      `[${visibleCanvas.maxX.toFixed(1)}, ${visibleCanvas.maxY.toFixed(1)}].`,
    );
  }
  await page.mouse.move(clickPoint.x, clickPoint.y, { steps: 4 });
  await page.mouse.click(clickPoint.x, clickPoint.y);
}

test("M8.4 traces a connected multi-wall shell with source + structural snapping together", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openNewProject(page);
  const project = await installReference(page);
  if (!project?.referencePlan) throw new Error("Calibrated reference is unavailable.");

  const snapping = page.getByRole("button", { name: "Привязки", exact: true });
  if (await snapping.getAttribute("aria-pressed") !== "true") await snapping.click();
  await expect(snapping).toHaveAttribute("aria-pressed", "true");

  const assist = page.getByRole("button", { name: "По подложке", exact: true });
  if (await assist.getAttribute("aria-pressed") !== "true") await assist.click();
  await expect(assist).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Стена", exact: true }).click();
  const box = await canvasBox(page);

  const shell = [
    { source: { x: 102, y: 102 }, offset: { x: 6, y: -5 } },
    { source: { x: 702, y: 102 }, offset: { x: -7, y: 4 } },
    { source: { x: 702, y: 552 }, offset: { x: 5, y: -6 } },
    { source: { x: 102, y: 552 }, offset: { x: -5, y: 7 } },
    { source: { x: 102, y: 102 }, offset: { x: 7, y: 5 } },
  ];

  for (const point of shell) {
    await clickSource(page, project, box, point.source, point.offset);
  }

  await expect.poll(async () => (await readProject(page))?.document?.walls?.length ?? 0).toBe(4);
  const committed = await readProject(page);
  const endpoints = wallEndpoints(committed.document);
  expect(endpoints).toHaveLength(4);

  for (const endpoint of endpoints) {
    expect(endpoint.start).toBeTruthy();
    expect(endpoint.end).toBeTruthy();
  }

  for (let index = 0; index < endpoints.length - 1; index += 1) {
    expect(endpoints[index].wall.endVertexId).toBe(endpoints[index + 1].wall.startVertexId);
  }
  expect(endpoints.at(-1).wall.endVertexId).toBe(endpoints[0].wall.startVertexId);

  const uniqueVertexIds = new Set(committed.document.vertices.map((vertex) => vertex.id));
  expect(uniqueVertexIds.size).toBe(4);

  const expectedCorners = shell.slice(0, 4).map((point) => sourcePointToWorld(committed.referencePlan, point.source));
  for (const expected of expectedCorners) {
    const nearest = committed.document.vertices.reduce((best, vertex) =>
      Math.min(best, distance(vertex.position, expected)), Number.POSITIVE_INFINITY);
    expect(nearest).toBeLessThanOrEqual(committed.referencePlan.transform.millimetersPerPixel * 2);
  }

  await expect(page.getByText("Стены пересекаются без явного соединения", { exact: false })).toHaveCount(0);

  await testInfo.attach("m8.4-multi-wall-chain", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
