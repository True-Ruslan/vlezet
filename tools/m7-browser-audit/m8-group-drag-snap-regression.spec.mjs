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

async function ensureFurnitureCatalog(page) {
  const search = page.getByRole("searchbox", { name: "Поиск мебели и техники" });
  if (!(await search.isVisible())) {
    await page.getByRole("button", { name: "Мебель", exact: true }).click();
  }
  await expect(search).toBeVisible();
  return search;
}

async function placeChair(page, xRatio, yRatio) {
  const search = await ensureFurnitureCatalog(page);
  await search.fill("стул");
  await page.getByRole("button", { name: /^Стул,/ }).click();
  const box = await canvasBox(page);
  const point = { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(".placement-fit-label")).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".context-panel-title")).toHaveText("Стул");
  return point;
}

async function canvasScreenshot(page) {
  return page.locator(".konvajs-content").first().screenshot();
}

async function movePointerToCanvasSafeArea(page) {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.05);
}

test("keeps a grid-snapped furniture group visually identical after jittered drag and Undo/Redo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openNewProject(page);
  await drawRectangle(page);

  const first = await placeChair(page, 0.38, 0.48);
  const second = await placeChair(page, 0.58, 0.48);

  await page.mouse.click(first.x, first.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(second.x, second.y);
  await page.keyboard.up("Shift");
  await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");

  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await page.mouse.move(first.x + 91, first.y + 53, { steps: 6 });
  for (const [dx, dy] of [[4, -3], [-5, 4], [3, 2], [-2, -4], [5, 3], [-3, 1]]) {
    await page.mouse.move(first.x + 91 + dx, first.y + 53 + dy, { steps: 2 });
  }
  await page.mouse.up();
  await movePointerToCanvasSafeArea(page);

  const afterJitteredMove = await canvasScreenshot(page);
  await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");

  await page.getByRole("button", { name: "Отменить" }).click();
  await page.getByRole("button", { name: "Повторить" }).click();
  await movePointerToCanvasSafeArea(page);

  await expect.poll(async () => (await canvasScreenshot(page)).equals(afterJitteredMove)).toBe(true);
  await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");
});
