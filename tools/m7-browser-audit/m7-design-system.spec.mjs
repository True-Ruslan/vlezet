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

function referencePng(width = 640, height = 480) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3, 255);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      if (x === 15 || x === width - 16 || y === 15 || y === height - 16) {
        const offset = 1 + x * 3;
        row[offset] = 44;
        row[offset + 1] = 62;
        row[offset + 2] = 80;
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

async function expectMinimumFont(locator, minimum = 12) {
  await expect(locator).toBeVisible();
  const size = await locator.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThanOrEqual(minimum);
}

async function expectMinimumHeight(locator, minimum = 40) {
  await expect(locator).toBeVisible();
  const height = await locator.evaluate((node) => node.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(minimum);
}

async function expectNoDocumentOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

async function clickCanvasPoint(page, point, moveFirst = false) {
  const canvas = page.locator(".canvas-shell");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box.");
  if (moveFirst) {
    await page.mouse.move(box.x + point.x, box.y + point.y);
    await page.waitForTimeout(100);
  }
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

const points = {
  topLeft: { x: 170, y: 150 },
  topRight: { x: 610, y: 150 },
  bottomRight: { x: 610, y: 500 },
  bottomLeft: { x: 170, y: 500 },
  roomSelection: { x: 215, y: 445 },
  centre: { x: 390, y: 325 },
};

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".canvas-shell")).toBeVisible();
}

async function createRoom(page) {
  await page.getByRole("button", { name: "Стена" }).click();
  await clickCanvasPoint(page, points.topLeft);
  await clickCanvasPoint(page, points.topRight);
  await clickCanvasPoint(page, points.bottomRight);
  await clickCanvasPoint(page, points.bottomLeft);
  await clickCanvasPoint(page, points.topLeft);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Выбор" }).click();
  await clickCanvasPoint(page, points.roomSelection);
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
}

async function placeSofa(page) {
  await page.getByRole("button", { name: /Диван/ }).first().click();
  await clickCanvasPoint(page, points.centre, true);
  await expect(page.locator(".context-panel-title")).toHaveText("Диван");
}

async function setObjectValues(page, values) {
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label, { exact: true }).fill(String(value));
  await page.getByRole("button", { name: "Применить параметры" }).click();
}

async function installReference(page) {
  await page.getByRole("button", { name: "Подложка" }).click();
  await page.locator('input[type="file"][aria-label="Загрузить план квартиры"]').setInputFiles({
    name: "m7-3-plan.png",
    mimeType: "image/png",
    buffer: referencePng(),
  });
  await expect(page.locator(".context-panel-title")).toHaveText("Калибровка масштаба");
  const stage = page.locator(".calibration-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("Calibration stage has no bounding box.");
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.getByLabel("Реальная длина").fill("3000");
  await page.getByRole("button", { name: "Сохранить и открыть план" }).click();
  await expect(page.locator(".context-panel-title")).toHaveText("Подложка настроена");
}

test.describe.serial("M7.3 design system browser acceptance", () => {
  test("uses shared dashboard feedback and accessible project dialog focus", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.locator(".ui-notice-local")).toBeVisible();
    await expect(page.locator(".ui-empty-state")).toBeVisible();
    await expectMinimumFont(page.locator(".ui-notice-local .ui-notice-title"));
    await expectMinimumFont(page.locator(".ui-empty-state-copy"));
    await expectMinimumHeight(page.getByRole("button", { name: "Новый проект" }));
    await expectNoDocumentOverflow(page);

    await page.getByRole("button", { name: "Новый проект" }).click();
    await page.getByLabel("Вернуться к моим проектам").click();
    const deleteButton = page.getByRole("button", { name: "Удалить", exact: true });
    await deleteButton.click();

    const dialog = page.getByRole("dialog", { name: "Удалить проект?" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Отмена" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Удалить проект" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Закрыть" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(deleteButton).toBeFocused();
  });

  test("keeps balanced density, long Russian content, catalogue and all fit states readable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await createRoom(page);

    const roomName = page.getByLabel("Название комнаты");
    await expectMinimumHeight(roomName);
    await expectMinimumHeight(page.getByRole("button", { name: "Сохранить название" }));
    await expectMinimumFont(page.locator(".context-panel-subtitle"));
    await expectMinimumFont(page.locator(".canvas-help"));

    const longName = "Гостиная для большой семьи с рабочей зоной и системой хранения";
    await roomName.fill(longName);
    await page.getByRole("button", { name: "Сохранить название" }).click();
    await expect(page.locator(".context-panel-title")).toHaveText(longName);
    await expectNoDocumentOverflow(page);

    const presetCard = page.locator(".furniture-preset-card").first();
    await expect(presetCard).toBeVisible();
    await expectMinimumFont(presetCard.locator("strong"));
    await expectMinimumFont(presetCard.locator("small"));
    await placeSofa(page);

    const fitBadge = page.locator(".fit-status-badge");
    await expectMinimumFont(fitBadge);
    await setObjectValues(page, {
      "Ширина": 1000,
      "Глубина": 500,
      "Спереди": 0,
      "Справа": 0,
      "Сзади": 0,
      "Слева": 0,
    });
    await expect(fitBadge).toHaveText("Влезает");

    await setObjectValues(page, {
      "Спереди": 5000,
      "Справа": 5000,
      "Сзади": 5000,
      "Слева": 5000,
    });
    await expect(fitBadge).toHaveText("Влезает, но тесно");

    await setObjectValues(page, { "Ширина": 12000, "Глубина": 12000 });
    await expect(fitBadge).toHaveText("Не влезает");

    for (const viewport of [{ width: 960, height: 600 }, { width: 720, height: 450 }]) {
      await page.setViewportSize(viewport);
      await expectNoDocumentOverflow(page);
      await expect(page.locator(".editor-context-trigger")).toBeVisible();
    }
  });

  test("uses shared recognition feedback and OpenRouter dialog states", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await expectMinimumFont(page.locator(".canvas-help"));

    await installReference(page);
    await page.getByRole("button", { name: "Распознать" }).click();
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Распознавание");
    await page.getByRole("button", { name: "Распознать план" }).click();
    await expect(page.getByRole("button", { name: "Проверить с AI" }).first()).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Проверить с AI" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Проверить план с AI" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Ключ не сохраняется")).toBeVisible();
    await expectMinimumFont(dialog.getByText("Ключ не сохраняется"));
    const apiKey = page.getByLabel("OpenRouter API key");
    await expect(apiKey).toBeFocused();
    await expectMinimumHeight(apiKey);
    await expect(page.getByRole("button", { name: "Анализировать" })).toBeDisabled();

    await page.route("**/api/v1/models**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "Неверный API key" } }) });
    });
    await apiKey.fill("invalid-key");
    await page.getByRole("button", { name: "Выбрать модель вручную" }).click();
    await expect(page.getByRole("button", { name: "Проверяем модели…" })).toBeVisible();
    await expect(dialog.locator(".ui-notice-error")).toBeVisible();
    await expectMinimumFont(dialog.locator(".ui-notice-error"));
    await expectNoDocumentOverflow(page);
  });
});
