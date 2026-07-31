import { expect, test } from "@playwright/test";

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".canvas-shell")).toBeVisible();
  await expect(page.locator(".canvas-mode-status")).toBeVisible();
}

async function clickCanvasPoint(page, x, y) {
  const canvas = page.locator(".canvas-shell");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box.");
  await page.mouse.click(box.x + x, box.y + y);
}

async function expectMode(page, mode, label, instruction) {
  const status = page.locator(".canvas-mode-status");
  await expect(status).toHaveAttribute("data-canvas-mode", mode);
  await expect(status.locator(".canvas-mode-label")).toHaveText(label);
  await expect(status.locator(".canvas-mode-instruction")).toHaveText(instruction);
}

test.describe("M7.4 Canvas selection and mode feedback", () => {
  test("communicates Wall and Measure phases with one-level Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);

    await expectMode(page, "select", "Выбор", "Выберите объект на плане.");
    await expect(page.locator('[data-active-tool="true"]')).toHaveAccessibleName("Выбор");

    await page.getByRole("button", { name: "Стена" }).click();
    await expectMode(page, "wall-start", "Стена", "Укажите первую точку стены.");
    await expect(page.locator('[data-active-tool="true"]')).toHaveAccessibleName("Стена");

    await clickCanvasPoint(page, 220, 220);
    await expectMode(page, "wall-finish", "Стена · вторая точка", "Укажите вторую точку стены.");
    await expect(page.locator(".canvas-mode-escape")).toHaveText("Esc — отменить текущий отрезок.");

    await page.keyboard.press("Escape");
    await expectMode(page, "wall-start", "Стена", "Укажите первую точку стены.");
    await expect(page.locator('[data-active-tool="true"]')).toHaveAccessibleName("Стена");

    await page.keyboard.press("Escape");
    await expectMode(page, "select", "Выбор", "Выберите объект на плане.");
    await expect(page.locator('[data-active-tool="true"]')).toHaveAccessibleName("Выбор");

    await page.getByRole("button", { name: "Измерить" }).click();
    await expectMode(page, "measure-start", "Измерить", "Укажите первую точку.");
    await expect(page.locator('[data-active-tool="true"]')).toHaveAccessibleName("Измерить");

    await clickCanvasPoint(page, 260, 260);
    await expectMode(page, "measure-finish", "Измерить · вторая точка", "Укажите вторую точку.");

    await page.keyboard.press("Escape");
    await expectMode(page, "measure-start", "Измерить", "Укажите первую точку.");
    await expect(page.locator('[data-active-tool="true"]')).toHaveAccessibleName("Измерить");

    await page.keyboard.press("Escape");
    await expectMode(page, "select", "Выбор", "Выберите объект на плане.");
  });

  test("keeps equivalent mode meaning at compact width and returns from 3D", async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 450 });
    await openNewProject(page);

    const status = page.locator(".canvas-mode-status");
    await expect(status).toBeVisible();
    const statusBox = await status.boundingBox();
    expect(statusBox).not.toBeNull();
    expect(statusBox.width).toBeLessThanOrEqual(704);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.getByRole("button", { name: "3D" }).click();
    await expectMode(page, "spatial", "3D · только просмотр", "Осматривайте ту же модель. Редактирование доступно в 2D.");

    await page.keyboard.press("Escape");
    await expectMode(page, "select", "Выбор", "Выберите объект на плане.");
    await expect(page.getByRole("button", { name: "2D" })).toHaveAttribute("aria-pressed", "true");
  });
});
