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

async function clickCanvasPoint(page, point) {
  const canvas = page.locator(".canvas-shell");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box in WebKit.");
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

test("WebKit core dashboard, editor, form, 3D and dialog smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await screenshot(page, "webkit-01-dashboard-1440x900.png");

  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".editor-toolbar")).toBeVisible();
  await expect(page.locator(".canvas-shell")).toBeVisible();

  await page.getByRole("button", { name: /^Стена/ }).click();
  await clickCanvasPoint(page, { x: 170, y: 150 });
  await clickCanvasPoint(page, { x: 610, y: 150 });
  await clickCanvasPoint(page, { x: 610, y: 500 });
  await clickCanvasPoint(page, { x: 170, y: 500 });
  await clickCanvasPoint(page, { x: 170, y: 150 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Выбор/ }).click();
  await clickCanvasPoint(page, { x: 215, y: 445 });

  const roomInspector = page.locator(".inspector-panel");
  await expect(roomInspector.getByText("Комната", { exact: true })).toBeVisible();
  const nameField = roomInspector.getByLabel("Название");
  await nameField.fill("Гостиная WebKit");
  await roomInspector.getByRole("button", { name: "Сохранить название" }).click();
  await expect(nameField).toHaveValue("Гостиная WebKit");
  await screenshot(page, "webkit-02-room-inspector-1440x900.png");

  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByLabel("Трёхмерный вид квартиры")).toBeVisible();
  await screenshot(page, "webkit-03-spatial-view-1440x900.png");
  await page.getByRole("button", { name: "2D", exact: true }).click();

  await page.getByLabel("Вернуться к моим проектам").click();
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await screenshot(page, "webkit-04-delete-confirmation-1440x900.png");
});
