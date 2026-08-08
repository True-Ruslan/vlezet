import { expect, test } from "@playwright/test";

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.locator(".projects-page, .editor-app").first()).toBeVisible();
  if (await page.locator(".editor-app").isVisible()) {
    await page.getByRole("button", { name: "Вернуться к моим проектам" }).click();
  }
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".editor-app")).toBeVisible();
  await expect(page.locator(".konvajs-content canvas").first()).toBeVisible();
}

async function canvasBox(page) {
  const box = await page.locator(".konvajs-content").first().boundingBox();
  if (!box) throw new Error("Canvas stage is not visible.");
  return box;
}

async function clickCanvasRatio(page, xRatio, yRatio) {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
}

async function drawRectangle(page) {
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await clickCanvasRatio(page, 0.18, 0.28);
  await clickCanvasRatio(page, 0.82, 0.28);
  await clickCanvasRatio(page, 0.82, 0.68);
  await clickCanvasRatio(page, 0.18, 0.68);
  await clickCanvasRatio(page, 0.18, 0.28);

  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  await page.locator('[data-first-project-phase="room-created"]').getByRole("button", { name: "Завершить", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
}

async function documentHasNoHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

test.describe("M8.1 editor interaction acceptance", () => {
  test("keeps the semantic context menu inside a compact viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await openNewProject(page);
    await drawRectangle(page);

    const box = await canvasBox(page);
    await page.mouse.click(box.x + box.width * 0.82, box.y + box.height * 0.48, { button: "right" });

    const menu = page.locator(".editor-context-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toContainText("Нет доступных действий");

    const menuBox = await menu.boundingBox();
    if (!menuBox) throw new Error("Context menu did not produce layout bounds.");
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Viewport size is unavailable.");

    expect(menuBox.x).toBeGreaterThanOrEqual(8);
    expect(menuBox.y).toBeGreaterThanOrEqual(8);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height - 8);
    await expect.poll(() => documentHasNoHorizontalOverflow(page)).toBe(true);
  });
});
