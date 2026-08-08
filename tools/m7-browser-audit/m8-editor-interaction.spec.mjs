import { appendFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const DIAGNOSTIC_LOG = "/tmp/vlezet-dev.log";

function recordDiagnostic(phase, payload = {}) {
  appendFileSync(DIAGNOSTIC_LOG, `\nM8_BROWSER_DIAGNOSTIC ${JSON.stringify({ phase, ...payload })}\n`);
}

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.locator(".projects-page, .editor-app").first()).toBeVisible();
  if (await page.locator(".editor-app").isVisible()) {
    await page.getByRole("button", { name: "Вернуться к моим проектам" }).click();
  }
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".editor-app")).toBeVisible();
  await expect(page.locator(".konvajs-content canvas").first()).toBeVisible();
  recordDiagnostic("project-opened", { viewport: page.viewportSize() });
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

  recordDiagnostic("rectangle-clicks-complete", {
    operationCount: await page.locator('[data-operation-kind="first-room-created"]').count(),
  });
  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  await page.locator('[data-first-project-phase="room-created"]').getByRole("button", { name: "Завершить", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
  recordDiagnostic("rectangle-ready", {
    canvas: await canvasBox(page),
  });
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
    const clickPoint = { x: box.x + box.width * 0.82, y: box.y + box.height * 0.48 };
    await page.mouse.click(clickPoint.x, clickPoint.y, { button: "right" });

    const menu = page.locator(".editor-context-menu");
    const menuCount = await menu.count();
    const menuVisible = menuCount > 0 ? await menu.first().isVisible() : false;
    const menuBox = menuVisible ? await menu.first().boundingBox() : null;
    const menuText = menuCount > 0 ? await menu.first().textContent() : null;
    recordDiagnostic("after-right-click", {
      viewport: page.viewportSize(),
      canvas: box,
      clickPoint,
      menuCount,
      menuVisible,
      menuBox,
      menuText,
      noHorizontalOverflow: await documentHasNoHorizontalOverflow(page),
    });

    await expect(menu).toBeVisible();
    await expect(menu).toContainText("Нет доступных действий");

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