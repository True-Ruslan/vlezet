import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(auditRoot, "artifacts");

async function screenshot(page, name) {
  await mkdir(artifactsDir, { recursive: true });
  await page.screenshot({ path: path.join(artifactsDir, name), fullPage: false });
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

async function clickCanvasPoint(page, point) {
  const canvas = page.locator(".canvas-shell");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box in WebKit.");
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

async function moveAndClickCanvasPoint(page, point) {
  const canvas = page.locator(".canvas-shell");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box in WebKit.");
  await page.mouse.move(box.x + point.x, box.y + point.y);
  await page.waitForTimeout(100);
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

async function createRoom(page) {
  await page.getByRole("button", { name: "Стена" }).click();
  await clickCanvasPoint(page, { x: 170, y: 150 });
  await clickCanvasPoint(page, { x: 610, y: 150 });
  await clickCanvasPoint(page, { x: 610, y: 500 });
  await clickCanvasPoint(page, { x: 170, y: 500 });
  await clickCanvasPoint(page, { x: 170, y: 150 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Выбор" }).click();
  await clickCanvasPoint(page, { x: 215, y: 445 });
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
}

test("WebKit M7.3 shared UI, workflow return, compact state, fit, 3D and dialog smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await expect(page.locator(".ui-notice-local")).toBeVisible();
  await expect(page.locator(".ui-empty-state")).toBeVisible();
  await expectMinimumFont(page.locator(".ui-notice-local .ui-notice-title"));
  await expectMinimumHeight(page.getByRole("button", { name: "Новый проект" }));
  await expectNoDocumentOverflow(page);
  await screenshot(page, "webkit-01-dashboard-1440x900.png");

  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".editor-project-bar")).toBeVisible();
  await expect(page.locator(".editor-tool-bar")).toBeVisible();
  await expect(page.locator(".canvas-shell")).toBeVisible();
  await expect(page.locator(".save-status")).toContainText("локально", { ignoreCase: true });
  await expectMinimumFont(page.locator(".canvas-help"));

  await createRoom(page);
  const nameField = page.getByLabel("Название комнаты");
  await expectMinimumHeight(nameField);
  await nameField.fill("Гостиная WebKit с длинным названием");
  await page.getByRole("button", { name: "Сохранить название" }).click();
  await expect(page.locator(".context-panel-title")).toHaveText("Гостиная WebKit с длинным названием");
  await expectNoDocumentOverflow(page);
  await screenshot(page, "webkit-02-room-context-1440x900.png");

  await page.getByRole("button", { name: "Варианты расстановки" }).click();
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Варианты расстановки");
  await expect(page.locator(".context-panel-navigation")).toHaveAccessibleName("К комнате «Гостиная WebKit с длинным названием»");
  await page.locator(".context-panel-navigation").click();
  await expect(page.locator(".context-panel-title")).toHaveText("Гостиная WebKit с длинным названием");

  await page.getByRole("button", { name: /Диван/ }).first().click();
  await moveAndClickCanvasPoint(page, { x: 390, y: 325 });
  await expect(page.locator(".context-panel-title")).toHaveText("Диван");
  await expect(page.locator(".fit-status-badge")).toBeVisible();
  await expectMinimumFont(page.locator(".fit-status-badge"));

  await page.setViewportSize({ width: 960, height: 600 });
  const contextSurface = page.locator("#editor-context-surface");
  await expect(contextSurface).toBeVisible();
  const objectName = contextSurface.getByLabel("Название");
  await objectName.fill("Черновик WebKit");
  await contextSurface.getByRole("button", { name: "Закрыть панель" }).click();
  await expect(contextSurface).toBeHidden();
  await expect(page.locator(".toolbar-project-name")).toBeVisible();
  await expect(page.locator(".save-status")).toBeVisible();
  await page.locator(".editor-context-trigger").click();
  await expect(contextSurface).toBeVisible();
  await expect(contextSurface.getByLabel("Название")).toHaveValue("Черновик WebKit");
  await expectNoDocumentOverflow(page);

  await page.getByRole("button", { name: "Подложка" }).click();
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Подложка");
  await expect(page.locator(".context-panel-navigation")).toHaveAccessibleName("К предмету «Диван»");
  await page.locator(".context-panel-navigation").click();
  await expect(page.locator(".context-panel-title")).toHaveText("Диван");
  await screenshot(page, "webkit-03-object-return-960x600.png");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "3D" }).click();
  await expect(page.getByLabel("Трёхмерный вид квартиры")).toBeVisible();
  await expect(page.locator("#editor-context-surface")).toHaveCount(0);
  await screenshot(page, "webkit-04-spatial-view-1440x900.png");
  await page.getByRole("button", { name: "2D" }).click();

  await page.getByLabel("Вернуться к моим проектам").click();
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  const deleteButton = page.getByRole("button", { name: "Удалить", exact: true });
  await deleteButton.click();
  const dialog = page.getByRole("dialog", { name: "Удалить проект?" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Отмена" })).toBeFocused();
  await screenshot(page, "webkit-05-delete-confirmation-1440x900.png");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(deleteButton).toBeFocused();
});
