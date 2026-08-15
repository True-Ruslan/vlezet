import { expect, test } from "./fixtures.mjs";
import { deflateSync } from "node:zlib";

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

function wideReferencePng(width = 800, height = 200) {
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
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".canvas-shell")).toBeVisible();
}

async function readReferenceEvidence(page) {
  return page.evaluate((dbName) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB reference evidence open failed"));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["projects", "assets"], "readonly");
      const projectsRequest = transaction.objectStore("projects").getAll();
      const assetsRequest = transaction.objectStore("assets").getAll();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB reference evidence read failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB reference evidence read aborted"));
      transaction.oncomplete = () => {
        const project = projectsRequest.result[0] ?? null;
        const asset = assetsRequest.result[0] ?? null;
        database.close();
        resolve({
          projectId: project?.id ?? null,
          referenceAssetId: project?.referencePlan?.assetId ?? null,
          referenceRevision: project?.referencePlan?.referenceRevision ?? null,
          asset: asset ? {
            id: asset.id,
            projectId: asset.projectId,
            mimeType: asset.mimeType,
            byteLength: asset.byteLength,
            storageKind: asset.blobBytes instanceof ArrayBuffer
              ? "array-buffer"
              : asset.blob instanceof Blob
                ? "blob"
                : null,
            blobBytesSize: asset.blobBytes instanceof ArrayBuffer ? asset.blobBytes.byteLength : null,
            blobSize: asset.blob instanceof Blob ? asset.blob.size : null,
            blobType: asset.blob instanceof Blob ? asset.blob.type : null,
          } : null,
        });
      };
    };
  }), DB_NAME);
}

test("keeps magnifier coordinates on the rendered image and persists the calibrated reference through the real import path", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openNewProject(page);
  await page.getByRole("button", { name: "Подложка" }).click();
  await page.locator('input[type="file"][aria-label="Загрузить план квартиры"]').setInputFiles({
    name: "wide-calibration-plan.png",
    mimeType: "image/png",
    buffer: wideReferencePng(),
  });
  await expect(page.locator(".context-panel-title")).toHaveText("Калибровка масштаба");

  const stage = page.locator(".calibration-stage");
  const renderedImage = stage.locator("img");
  await expect(renderedImage).toBeVisible();
  const stageBox = await stage.boundingBox();
  const imageBox = await renderedImage.boundingBox();
  if (!stageBox || !imageBox) throw new Error("Calibration viewport has no visible bounding boxes.");
  expect(stageBox.height).toBeGreaterThan(imageBox.height + 20);

  await stage.evaluate((node) => {
    globalThis.__vlezetCalibrationPointer = null;
    node.addEventListener("pointermove", (event) => {
      globalThis.__vlezetCalibrationPointer = { x: event.clientX, y: event.clientY };
    }, { once: true });
  });
  const hoverX = imageBox.x + imageBox.width * 0.5;
  const hoverY = imageBox.y + imageBox.height * 0.25;
  await page.mouse.move(hoverX, hoverY);
  const magnifier = page.locator(".calibration-magnifier");
  await expect(magnifier).toBeVisible();
  const deliveredPointer = await page.evaluate(() => globalThis.__vlezetCalibrationPointer);
  if (!deliveredPointer) throw new Error("Calibration stage did not receive the pointer move.");
  const expectedBackground = await renderedImage.evaluate((node, pointer) => {
    const rect = node.getBoundingClientRect();
    const localX = Math.min(rect.width, Math.max(0, pointer.x - rect.left));
    const localY = Math.min(rect.height, Math.max(0, pointer.y - rect.top));
    const imageX = localX / rect.width * node.naturalWidth;
    const imageY = localY / rect.height * node.naturalHeight;
    return {
      x: -imageX * 2 + 52,
      y: -imageY * 2 + 52,
    };
  }, deliveredPointer);
  const actualBackground = await magnifier.evaluate((node) => {
    const [x, y] = node.style.backgroundPosition.split(" ").map(Number.parseFloat);
    return { x, y };
  });
  expect(actualBackground.x).toBeCloseTo(expectedBackground.x, 5);
  expect(actualBackground.y).toBeCloseTo(expectedBackground.y, 5);

  await page.mouse.click(imageBox.x + imageBox.width * 0.5, imageBox.y + imageBox.height * 0.8);
  await page.mouse.click(imageBox.x + imageBox.width * 0.5, imageBox.y + imageBox.height * 0.2);
  await page.getByLabel("Реальная длина").fill("3000");
  await page.getByLabel("Выравнивание").selectOption("vertical");
  await page.getByRole("button", { name: "Сохранить и открыть план" }).click();

  await expect(page.locator(".context-panel-title")).toHaveText("Подложка настроена");
  await expect(page.locator(".reference-local-note")).toContainText("Подложка сохранена локально");
  const rotation = Number(await page.getByLabel("Поворот, °").inputValue());
  expect(Math.abs(rotation)).toBeLessThan(0.01);

  const beforeReload = await readReferenceEvidence(page);
  expect(beforeReload.projectId).toBeTruthy();
  expect(beforeReload.referenceAssetId).toBeTruthy();
  expect(beforeReload.referenceRevision).toBeTruthy();
  expect(beforeReload.asset).toMatchObject({
    id: beforeReload.referenceAssetId,
    projectId: beforeReload.projectId,
    mimeType: "image/png",
    storageKind: "array-buffer",
    blobSize: null,
    blobType: null,
  });
  expect(beforeReload.asset.byteLength).toBeGreaterThan(0);
  expect(beforeReload.asset.blobBytesSize).toBe(beforeReload.asset.byteLength);

  await page.reload();
  await expect(page.getByLabel("Название проекта")).toHaveValue("Моя квартира");
  await page.getByRole("button", { name: "Подложка" }).click();
  await expect(page.locator(".context-panel-title")).toHaveText("Подложка настроена");
  await expect(page.locator(".reference-local-note")).toContainText("Подложка сохранена локально");
  const afterReload = await readReferenceEvidence(page);
  expect(afterReload).toEqual(beforeReload);
});