import { expect, test } from "@playwright/test";
import { deflateSync } from "node:zlib";

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

test("keeps magnifier coordinates on the rendered image and treats calibration as an undirected axis", async ({ page }) => {
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

  const hoverX = imageBox.x + imageBox.width * 0.5;
  const hoverY = imageBox.y + imageBox.height * 0.25;
  await page.mouse.move(hoverX, hoverY);
  const magnifier = page.locator(".calibration-magnifier");
  await expect(magnifier).toBeVisible();
  const naturalSize = await renderedImage.evaluate((node) => ({ width: node.naturalWidth, height: node.naturalHeight }));
  const expectedBackground = {
    x: -(naturalSize.width * 0.5) * 2 + 52,
    y: -(naturalSize.height * 0.25) * 2 + 52,
  };
  const actualBackground = await magnifier.evaluate((node) => {
    const [x, y] = node.style.backgroundPosition.split(" ").map(Number.parseFloat);
    return { x, y };
  });
  expect(actualBackground.x).toBeCloseTo(expectedBackground.x, 0);
  expect(actualBackground.y).toBeCloseTo(expectedBackground.y, 0);

  await page.mouse.click(imageBox.x + imageBox.width * 0.5, imageBox.y + imageBox.height * 0.8);
  await page.mouse.click(imageBox.x + imageBox.width * 0.5, imageBox.y + imageBox.height * 0.2);
  await page.getByLabel("Реальная длина").fill("3000");
  await page.getByLabel("Выравнивание").selectOption("vertical");
  await page.getByRole("button", { name: "Сохранить и открыть план" }).click();

  await expect(page.locator(".context-panel-title")).toHaveText("Подложка настроена");
  const rotation = Number(await page.getByLabel("Поворот, °").inputValue());
  expect(Math.abs(rotation)).toBeLessThan(0.01);
});
