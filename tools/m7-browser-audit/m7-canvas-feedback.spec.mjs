import { expect, test } from "@playwright/test";

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".canvas-shell")).toBeVisible();
  await expect(page.locator(".canvas-mode-status")).toBeVisible();
}

async function canvasPosition(page, x, y) {
  const canvas = page.locator(".canvas-shell");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box.");
  return { x: box.x + x, y: box.y + y };
}

async function clickCanvasPoint(page, x, y) {
  const point = await canvasPosition(page, x, y);
  await page.mouse.click(point.x, point.y);
}

async function moveCanvasPoint(page, x, y) {
  const point = await canvasPosition(page, x, y);
  await page.mouse.move(point.x, point.y);
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

  test("distinguishes selectable hover and live opening preview", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);

    await page.getByRole("button", { name: "Стена" }).click();
    await clickCanvasPoint(page, 240, 280);
    await clickCanvasPoint(page, 640, 280);
    await expectMode(page, "wall-start", "Стена", "Укажите первую точку стены.");
    await page.keyboard.press("Escape");
    await expectMode(page, "select", "Выбор", "Выберите объект на плане.");

    await moveCanvasPoint(page, 440, 280);
    await expect(page.locator(".canvas-shell")).toHaveClass(/is-hovering-selectable/);
    await expectMode(page, "select", "Выбор", "Кликните, чтобы выбрать объект.");

    await page.getByRole("button", { name: "Дверь" }).click();
    await moveCanvasPoint(page, 440, 280);
    await expect(page.locator(".canvas-shell")).toHaveAttribute("data-preview-state", "valid");
    await expect(page.locator(".canvas-shell")).toHaveClass(/is-preview-valid/);
    await expectMode(page, "door", "Дверь", "Кликните, чтобы добавить дверь.");
    await expect(page.locator(".canvas-mode-preview")).toHaveText("Предпросмотр");

    await moveCanvasPoint(page, 900, 600);
    await expect(page.locator(".canvas-shell")).toHaveAttribute("data-preview-state", "none");
    await expectMode(page, "door", "Дверь", "Наведите на стену.");
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
