import { expect, test } from "./fixtures.mjs";
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

function precisionReferencePng(width = 800, height = 200) {
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

async function openCalibration(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".canvas-shell")).toBeVisible();
  await page.getByRole("button", { name: "Подложка" }).click();
  await page.locator('input[type="file"][aria-label="Загрузить план квартиры"]').setInputFiles({
    name: "precision-calibration-plan.png",
    mimeType: "image/png",
    buffer: precisionReferencePng(),
  });
  await expect(page.locator(".context-panel-title")).toHaveText("Калибровка масштаба");
}

async function imageClientPoint(image, sourcePoint, sourceSize = { width: 800, height: 200 }) {
  const box = await image.boundingBox();
  if (!box) throw new Error("Calibration image is not visible.");
  return {
    x: box.x + sourcePoint.x / sourceSize.width * box.width,
    y: box.y + sourcePoint.y / sourceSize.height * box.height,
  };
}

async function calibrationPointX(point) {
  const label = await point.getAttribute("aria-label");
  if (!label) return Number.NaN;
  return Number.parseFloat(label.replace(/^Точка [AB]: /, "").split(",")[0] ?? "NaN");
}

test("guides incomplete calibration, validates save and never creates B by reacquiring A", async ({ page }) => {
  await openCalibration(page);

  const stage = page.locator(".calibration-stage");
  const image = stage.locator("img");
  const pointA = page.locator('[data-calibration-point="a"]');
  const pointB = page.locator('[data-calibration-point="b"]');
  const save = page.getByRole("button", { name: "Сохранить и открыть план" });

  await expect(page.getByText("Поставьте точку A на одном конце известного размера.", { exact: true })).toBeVisible();
  await expect(save).toBeEnabled();

  const first = await imageClientPoint(image, { x: 100, y: 100 });
  await page.mouse.click(first.x, first.y);
  await expect(pointA).toBeVisible();
  await expect(pointB).toHaveCount(0);
  await expect(page.getByText("Теперь поставьте точку B на другом конце известного размера.", { exact: true })).toBeVisible();

  await pointA.click();
  await expect(pointB).toHaveCount(0);

  const second = await imageClientPoint(image, { x: 700, y: 100 });
  await page.mouse.click(second.x, second.y);
  await expect(pointB).toBeVisible();
  await expect(page.getByText("Укажите реальную длину между точками A и B.", { exact: true })).toBeVisible();

  await save.click();
  await expect(page.getByRole("alert")).toHaveText("Укажите реальную длину между точками A и B.");
  await expect(page.locator(".context-panel-title")).toHaveText("Калибровка масштаба");

  await page.getByLabel("Реальная длина").fill("3000");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("supports precision viewport navigation, source snapping, suppression and source-pixel keyboard nudge", async ({ page }) => {
  await openCalibration(page);

  const stage = page.locator(".calibration-stage");
  const image = stage.locator("img");
  const fitButton = page.getByRole("button", { name: "Вписать план" });
  const snapToggle = page.getByRole("checkbox", { name: "Привязка к линиям плана" });
  const pointA = page.locator('[data-calibration-point="a"]');
  const pointB = page.locator('[data-calibration-point="b"]');

  await expect(fitButton).toBeVisible();
  await expect(snapToggle).toBeChecked();
  await expect(stage).toHaveAttribute("tabindex", "0");

  const fitBox = await image.boundingBox();
  if (!fitBox) throw new Error("Calibration image has no initial fit bounds.");
  const anchor = await imageClientPoint(image, { x: 400, y: 100 });
  await page.mouse.move(anchor.x, anchor.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect.poll(async () => (await image.boundingBox())?.width ?? 0).toBeGreaterThan(fitBox.width * 1.05);

  await fitButton.click();
  await expect.poll(async () => (await image.boundingBox())?.width ?? 0).toBeCloseTo(fitBox.width, 0);

  const beforePan = await image.boundingBox();
  if (!beforePan) throw new Error("Calibration image has no pre-pan bounds.");
  await page.mouse.move(anchor.x, anchor.y);
  await page.mouse.wheel(18, 28);
  await expect.poll(async () => (await image.boundingBox())?.y ?? 0).not.toBeCloseTo(beforePan.y, 0);
  await fitButton.click();

  const nearFirstLine = await imageClientPoint(image, { x: 100, y: 100 });
  await page.mouse.click(nearFirstLine.x + 4, nearFirstLine.y);
  await expect(pointA).toContainText("100.00");
  await expect(page.locator(".calibration-magnifier-crosshair")).toBeVisible();

  const nearSecondLine = await imageClientPoint(image, { x: 700, y: 100 });
  await page.keyboard.down("Alt");
  await page.mouse.click(nearSecondLine.x + 4, nearSecondLine.y);
  await page.keyboard.up("Alt");
  await expect(pointB).not.toContainText("700.00");

  await pointA.focus();
  await expect(pointA).toBeFocused();
  await pointA.press("ArrowRight");
  await expect(pointA).toContainText("101.00");
  await pointA.press("Shift+ArrowDown");
  await expect(pointA).toContainText("101.00, 110.00");

  await snapToggle.uncheck();
  await page.mouse.click(nearFirstLine.x + 4, nearFirstLine.y);
  await expect.poll(() => calibrationPointX(pointA)).toBeGreaterThan(100.5);
});
