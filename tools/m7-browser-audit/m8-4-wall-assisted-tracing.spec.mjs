import { deflateSync } from "node:zlib";
import { expect, test } from "./fixtures.mjs";

const DB_NAME = "vlezet";
const REGRESSION_FIXTURE_PATH = "../../packages/recognition/benchmarks/fixtures/m7-3-regression-anonymized/source.png";
const REGRESSION_FIXTURE_SIZE = { width: 840, height: 640 };

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

function assistedTracingReferencePng(width = 800, height = 200) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3, 242);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const architecturalWallFace =
        within(x, 94, 96) || within(x, 104, 106) ||
        within(x, 694, 696) || within(x, 704, 706) ||
        within(y, 24, 26) || within(y, 34, 36) ||
        within(y, 164, 166) || within(y, 174, 176);
      const faintPlanDetail = !architecturalWallFace && (
        (within(x, 240, 300) && y === 100) ||
        (x === 560 && within(y, 75, 125))
      );
      const value = architecturalWallFace ? 25 : faintPlanDetail ? 205 : 242;
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

async function setSnapping(page, enabled) {
  const button = page.getByRole("button", { name: "Привязки", exact: true });
  const current = await button.getAttribute("aria-pressed");
  if ((current === "true") !== enabled) await button.click();
  await expect(button).toHaveAttribute("aria-pressed", enabled ? "true" : "false");
}

async function expectWallCount(page, count) {
  const details = page.locator("details.editor-actions-menu");
  const wasOpen = await details.evaluate((element) => element.open);
  if (!wasOpen) await details.locator("summary").click();
  await expect(details.locator(".editor-actions-facts")).toContainText(`${count} стен`);
  if (!wasOpen) await details.locator("summary").click();
}

async function expectSourceAssistState(page, expected) {
  await expect(page.locator(".canvas-shell")).toHaveAttribute("data-source-assist", expected);
}

async function sourceFeedbackContent(page) {
  return page.locator(".canvas-shell").evaluate((element) => getComputedStyle(element, "::after").content);
}

async function finishReferenceCalibration(page, input) {
  await page.getByLabel("Реальная длина").fill(String(input.knownLengthMm));
  await page.getByLabel("Выравнивание").selectOption(input.alignment);
  await page.getByRole("button", { name: "Сохранить и открыть план" }).click();
  await expect(page.locator(".context-panel-title")).toHaveText("Подложка настроена");

  const beforeFit = await readProject(page);
  if (!beforeFit?.referencePlan) throw new Error("Reference was not persisted.");
  const calibration = beforeFit.referencePlan.calibration;
  const calibrationPixels = Math.hypot(
    calibration.pointB.x - calibration.pointA.x,
    calibration.pointB.y - calibration.pointA.y,
  );
  expect(calibration.knownLengthMm).toBe(input.knownLengthMm);
  expect(calibrationPixels).toBeGreaterThan(0);
  expect(beforeFit.referencePlan.transform.millimetersPerPixel)
    .toBeCloseTo(calibration.knownLengthMm / calibrationPixels, 8);

  await page.getByRole("button", { name: "Показать подложку", exact: true }).click();
  await expect.poll(async () => JSON.stringify((await readProject(page))?.viewport)).not.toBe(JSON.stringify(beforeFit.viewport));
  return readProject(page);
}

async function installReference(page) {
  await page.getByRole("button", { name: "Подложка", exact: true }).click();
  await page.locator('input[type="file"][aria-label="Загрузить план квартиры"]').setInputFiles({
    name: "m8-4-assisted-tracing.png",
    mimeType: "image/png",
    buffer: assistedTracingReferencePng(),
  });
  await expect(page.locator(".context-panel-title")).toHaveText("Калибровка масштаба");

  const image = page.locator(".calibration-stage img");
  await expect(image).toBeVisible();
  const imageBox = await image.boundingBox();
  if (!imageBox) throw new Error("Calibration image is not visible.");
  await page.mouse.click(imageBox.x + imageBox.width * 0.5, imageBox.y + imageBox.height * (165 / 200));
  await page.mouse.click(imageBox.x + imageBox.width * 0.5, imageBox.y + imageBox.height * (35 / 200));

  const project = await finishReferenceCalibration(page, { knownLengthMm: 3000, alignment: "vertical" });
  expect(Math.abs(project.referencePlan.transform.rotationDeg)).toBeLessThan(0.01);
  return project;
}

async function installDenseRegressionReference(page) {
  await page.getByRole("button", { name: "Подложка", exact: true }).click();
  await page.locator('input[type="file"][aria-label="Загрузить план квартиры"]').setInputFiles(REGRESSION_FIXTURE_PATH);
  await expect(page.locator(".context-panel-title")).toHaveText("Калибровка масштаба");

  const image = page.locator(".calibration-stage img");
  await expect(image).toBeVisible();
  const sourceSnap = page.getByRole("checkbox", { name: "Привязка к линиям плана" });
  await expect(sourceSnap).toBeChecked();
  await sourceSnap.uncheck();
  const imageBox = await image.boundingBox();
  if (!imageBox) throw new Error("Dense regression calibration image is not visible.");
  const pointA = imagePointToPage(imageBox, REGRESSION_FIXTURE_SIZE, { x: 30, y: 320 });
  const pointB = imagePointToPage(imageBox, REGRESSION_FIXTURE_SIZE, { x: 330, y: 320 });
  await page.mouse.click(pointA.x, pointA.y);
  await page.mouse.click(pointB.x, pointB.y);

  const project = await finishReferenceCalibration(page, { knownLengthMm: 3000, alignment: "horizontal" });
  expect(Math.abs(project.referencePlan.transform.rotationDeg)).toBeLessThan(0.01);
  expect(project.referencePlan.transform.millimetersPerPixel).toBeGreaterThan(9);
  expect(project.referencePlan.transform.millimetersPerPixel).toBeLessThan(11);
  return project;
}

function committedWallGeometry(project) {
  const wall = project.document.walls[0];
  if (!wall) throw new Error("Committed wall is missing.");
  const vertices = new Map(project.document.vertices.map((vertex) => [vertex.id, vertex.position]));
  const startpoint = vertices.get(wall.startVertexId);
  const endpoint = vertices.get(wall.endVertexId);
  if (!startpoint || !endpoint) throw new Error("Committed wall vertices are missing.");
  return { startpoint, endpoint };
}

test("M8.4 wall source assist stays optional, explicit, topology-safe, local-only and undoable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openNewProject(page);
  const project = await installReference(page);
  if (!project?.referencePlan) throw new Error("Calibrated reference is unavailable.");

  const assistButton = page.getByRole("button", { name: "По подложке", exact: true });
  await expect(assistButton).toBeVisible();
  await expect(assistButton).toHaveAttribute("aria-pressed", "false");
  await assistButton.click();
  await expect(assistButton).toHaveAttribute("aria-pressed", "true");

  const assistRequests = [];
  page.on("request", (request) => {
    if (request.resourceType() === "fetch" || request.resourceType() === "xhr") assistRequests.push(request.url());
  });

  const box = await canvasBox(page);
  const startProbe = sourcePointToPage(project, box, { x: 400, y: 33 });
  const endProbe = sourcePointToPage(project, box, { x: 703, y: 100 });
  const topologyProbe = sourcePointToPage(project, box, { x: 400, y: 34 });
  const suppressionProbe = sourcePointToPage(project, box, { x: 103, y: 100 });

  await setSnapping(page, false);
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await page.mouse.click(startProbe.x, startProbe.y);
  await page.mouse.move(endProbe.x, endProbe.y);
  await expectSourceAssistState(page, "acquired");
  await expect.poll(() => sourceFeedbackContent(page)).toContain("По подложке");
  await testInfo.attach("m8.4-source-assist-acquired", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.mouse.click(endProbe.x, endProbe.y);
  await expectWallCount(page, 1);

  await expect.poll(async () => (await readProject(page))?.document?.walls?.length ?? 0).toBe(1);
  const committed = await readProject(page);
  const { startpoint, endpoint } = committedWallGeometry(committed);
  const expectedStartpoint = sourcePointToWorld(committed.referencePlan, { x: 400, y: 30 });
  const expectedEndpoint = sourcePointToWorld(committed.referencePlan, { x: 700, y: 100 });
  const sourceToleranceMm = committed.referencePlan.transform.millimetersPerPixel * 2;
  expect(Math.abs(startpoint.x - expectedStartpoint.x)).toBeLessThanOrEqual(sourceToleranceMm);
  expect(Math.abs(startpoint.y - expectedStartpoint.y)).toBeLessThanOrEqual(sourceToleranceMm);
  expect(Math.abs(endpoint.x - expectedEndpoint.x)).toBeLessThanOrEqual(sourceToleranceMm);
  expect(Math.abs(endpoint.y - expectedEndpoint.y)).toBeLessThanOrEqual(sourceToleranceMm);

  await setSnapping(page, true);
  await page.mouse.move(topologyProbe.x, topologyProbe.y);
  await expectSourceAssistState(page, "idle");

  await setSnapping(page, false);
  await page.keyboard.down("Alt");
  await page.mouse.move(suppressionProbe.x, suppressionProbe.y);
  await expectSourceAssistState(page, "idle");
  await page.keyboard.up("Alt");
  await page.mouse.move(suppressionProbe.x + 1, suppressionProbe.y);
  await expectSourceAssistState(page, "acquired");

  await assistButton.click();
  await expect(assistButton).toHaveAttribute("aria-pressed", "false");
  await expectSourceAssistState(page, "idle");
  await page.mouse.move(suppressionProbe.x, suppressionProbe.y);
  await expectSourceAssistState(page, "idle");

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Отменить" }).click();
  await expectWallCount(page, 0);
  await page.getByRole("button", { name: "Повторить" }).click();
  await expectWallCount(page, 1);

  expect(assistRequests).toEqual([]);
});

test("M8.4 wall source assist acquires the repository dense regression floor plan", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openNewProject(page);
  const project = await installDenseRegressionReference(page);
  if (!project?.referencePlan) throw new Error("Dense regression reference is unavailable.");

  const assistButton = page.getByRole("button", { name: "По подложке", exact: true });
  await assistButton.click();
  await expect(assistButton).toHaveAttribute("aria-pressed", "true");
  await setSnapping(page, false);
  await page.getByRole("button", { name: "Стена", exact: true }).click();

  const box = await canvasBox(page);
  const startProbe = sourcePointToPage(project, box, { x: 370, y: 34 });
  const endProbe = sourcePointToPage(project, box, { x: 500, y: 26 });
  await page.mouse.click(startProbe.x, startProbe.y);
  await page.mouse.move(endProbe.x, endProbe.y);
  await expectSourceAssistState(page, "acquired");
  await page.mouse.click(endProbe.x, endProbe.y);
  await expectWallCount(page, 1);

  await expect.poll(async () => (await readProject(page))?.document?.walls?.length ?? 0).toBe(1);
  const committed = await readProject(page);
  const { startpoint, endpoint } = committedWallGeometry(committed);
  const expectedStartpoint = sourcePointToWorld(committed.referencePlan, { x: 370, y: 30 });
  const expectedEndpoint = sourcePointToWorld(committed.referencePlan, { x: 500, y: 30 });
  const sourceToleranceMm = committed.referencePlan.transform.millimetersPerPixel * 2;
  expect(Math.abs(startpoint.x - expectedStartpoint.x)).toBeLessThanOrEqual(sourceToleranceMm);
  expect(Math.abs(startpoint.y - expectedStartpoint.y)).toBeLessThanOrEqual(sourceToleranceMm);
  expect(Math.abs(endpoint.x - expectedEndpoint.x)).toBeLessThanOrEqual(sourceToleranceMm);
  expect(Math.abs(endpoint.y - expectedEndpoint.y)).toBeLessThanOrEqual(sourceToleranceMm);

  await testInfo.attach("m8.4-dense-regression-source-assist", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});