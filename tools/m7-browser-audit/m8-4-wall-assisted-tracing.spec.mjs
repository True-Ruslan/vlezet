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

function assistedTracingReferencePng(width = 800, height = 200) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3, 245);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      if (x === 100 || x === 700 || y === 30 || y === 170) {
        const offset = 1 + x * 3;
        row[offset] = 20;
        row[offset + 1] = 20;
        row[offset + 2] = 20;
      }
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

function sourcePointToPage(project, box, sourcePoint) {
  const reference = project.referencePlan;
  if (!reference) throw new Error("Reference plan is missing.");
  const radians = reference.transform.rotationDeg * Math.PI / 180;
  const scaled = {
    x: sourcePoint.x * reference.transform.millimetersPerPixel,
    y: sourcePoint.y * reference.transform.millimetersPerPixel,
  };
  const world = {
    x: reference.transform.originWorld.x + scaled.x * Math.cos(radians) - scaled.y * Math.sin(radians),
    y: reference.transform.originWorld.y + scaled.x * Math.sin(radians) + scaled.y * Math.cos(radians),
  };
  return {
    x: box.x + world.x * project.viewport.pixelsPerMillimeter + project.viewport.offsetX,
    y: box.y + world.y * project.viewport.pixelsPerMillimeter + project.viewport.offsetY,
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

async function installReference(page) {
  await page.getByRole("button", { name: "Подложка", exact: true }).click();
  await page.locator('input[type="file"][aria-label="Загрузить план квартиры"]').setInputFiles({
    name: "m8-4-assisted-tracing.png",
    mimeType: "image/png",
    buffer: assistedTracingReferencePng(),
  });
  await expect(page.locator(".context-panel-title")).toHaveText("Калибровка масштаба");

  const stage = page.locator(".calibration-stage");
  const image = stage.locator("img");
  await expect(image).toBeVisible();
  const imageBox = await image.boundingBox();
  if (!imageBox) throw new Error("Calibration image is not visible.");
  await page.mouse.click(imageBox.x + imageBox.width * 0.5, imageBox.y + imageBox.height * 0.8);
  await page.mouse.click(imageBox.x + imageBox.width * 0.5, imageBox.y + imageBox.height * 0.2);
  await page.getByLabel("Реальная длина").fill("3000");
  await page.getByLabel("Выравнивание").selectOption("vertical");
  await page.getByRole("button", { name: "Сохранить и открыть план" }).click();
  await expect(page.locator(".context-panel-title")).toHaveText("Подложка настроена");

  const beforeFit = await readProject(page);
  if (!beforeFit?.referencePlan) throw new Error("Reference was not persisted.");
  expect(Math.abs(beforeFit.referencePlan.transform.rotationDeg)).toBeLessThan(0.01);
  expect(beforeFit.referencePlan.transform.millimetersPerPixel).toBeCloseTo(25, 1);

  await page.getByRole("button", { name: "Показать подложку", exact: true }).click();
  await expect.poll(async () => JSON.stringify((await readProject(page))?.viewport)).not.toBe(JSON.stringify(beforeFit.viewport));
  return readProject(page);
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
  const start = sourcePointToPage(project, box, { x: 400, y: 30 });
  const endProbe = sourcePointToPage(project, box, { x: 706, y: 100 });
  const topologyProbe = sourcePointToPage(project, box, { x: 400, y: 34 });
  const suppressionProbe = sourcePointToPage(project, box, { x: 106, y: 100 });

  await setSnapping(page, false);
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await page.mouse.click(start.x, start.y);
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
  const wall = committed.document.walls[0];
  const vertices = new Map(committed.document.vertices.map((vertex) => [vertex.id, vertex.position]));
  const endpoint = vertices.get(wall.endVertexId);
  expect(endpoint.x).toBeCloseTo(17_500, -1);
  expect(endpoint.y).toBeCloseTo(2_500, -1);

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
