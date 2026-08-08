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

async function canvasScreenshot(page) {
  return page.locator(".konvajs-content").first().screenshot();
}

async function expectCanvasToChange(page, before) {
  await expect.poll(async () => {
    const after = await canvasScreenshot(page);
    return after.equals(before);
  }).toBe(false);
}

async function expectSemanticHistoryEmpty(page) {
  await expect(page.getByRole("button", { name: "Отменить" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Повторить" })).toBeDisabled();
}

async function projectFacts(page) {
  const details = page.locator("details.editor-actions-menu");
  if (!(await details.evaluate((element) => element.open))) {
    await details.locator("summary").click();
  }
  return details.locator(".editor-actions-facts");
}

test.describe("M8.1 editor interaction acceptance", () => {
  test("keeps the semantic context menu inside a compact viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);

    await page.setViewportSize({ width: 390, height: 760 });
    await expect(page.locator(".konvajs-content canvas").first()).toBeVisible();

    const closeInspector = page.getByRole("button", { name: "Закрыть панель" });
    await expect(closeInspector).toBeVisible();
    await closeInspector.click();
    await expect(closeInspector).toBeHidden();

    await page.keyboard.press("1");

    const box = await canvasBox(page);
    await page.mouse.click(box.x + box.width * 0.82, box.y + box.height * 0.5, { button: "right" });

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

  test("pans with ordinary wheel and zooms with modified wheel without semantic history", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await expectSemanticHistoryEmpty(page);

    const box = await canvasBox(page);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);

    const beforePan = await canvasScreenshot(page);
    await page.mouse.wheel(72, 96);
    await expectCanvasToChange(page, beforePan);
    await expectSemanticHistoryEmpty(page);

    const beforeZoom = await canvasScreenshot(page);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -180);
    await page.keyboard.up("Control");
    await expectCanvasToChange(page, beforeZoom);
    await expectSemanticHistoryEmpty(page);
  });

  test("pans with Space drag and middle-button drag without semantic history", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await expectSemanticHistoryEmpty(page);

    const box = await canvasBox(page);
    const start = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.45 };

    const beforeSpacePan = await canvasScreenshot(page);
    await page.mouse.move(start.x, start.y);
    await page.keyboard.down("Space");
    await page.mouse.down();
    await page.mouse.move(start.x + 90, start.y + 55, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    await expectCanvasToChange(page, beforeSpacePan);
    await expectSemanticHistoryEmpty(page);

    const beforeMiddlePan = await canvasScreenshot(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(start.x - 80, start.y + 45, { steps: 5 });
    await page.mouse.up({ button: "middle" });
    await expectCanvasToChange(page, beforeMiddlePan);
    await expectSemanticHistoryEmpty(page);
  });

  test("keeps Ctrl+A/C/V native inside the project-name input", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await expectSemanticHistoryEmpty(page);

    const input = page.getByRole("textbox", { name: "Название проекта" });
    await input.fill("Alpha");
    await input.evaluate((element) => {
      const events = [];
      globalThis.__m8NativeClipboardEvents = events;
      element.addEventListener("copy", () => events.push("copy"));
      element.addEventListener("paste", () => events.push("paste"));
    });

    await input.press("Control+A");
    await input.type("Beta");
    await expect(input).toHaveValue("Beta");

    await input.press("Control+A");
    await input.press("Control+C");
    await input.press("Control+V");
    await expect.poll(() => page.evaluate(() => globalThis.__m8NativeClipboardEvents)).toEqual(["copy", "paste"]);
    await expectSemanticHistoryEmpty(page);
  });

  test("routes 0, 1, 2, plus and minus as view commands without semantic history entries", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);

    const initialFacts = await projectFacts(page);
    await expect(initialFacts).toContainText("4 стен");
    await page.keyboard.press("Escape");

    await clickCanvasRatio(page, 0.5, 0.28);
    await page.keyboard.press("2");
    await page.keyboard.press("1");

    const beforeActualSize = await canvasScreenshot(page);
    await page.keyboard.press("0");
    await expectCanvasToChange(page, beforeActualSize);

    const beforeZoomIn = await canvasScreenshot(page);
    await page.keyboard.down("Shift");
    await page.keyboard.press("=");
    await page.keyboard.up("Shift");
    await expectCanvasToChange(page, beforeZoomIn);

    const beforeZoomOut = await canvasScreenshot(page);
    await page.keyboard.press("-");
    await expectCanvasToChange(page, beforeZoomOut);

    await page.getByRole("button", { name: "Отменить" }).click();
    const afterUndoFacts = await projectFacts(page);
    await expect(afterUndoFacts).toContainText("3 стен");
  });
});