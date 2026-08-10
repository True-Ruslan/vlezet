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

async function canvasPoint(page, xRatio, yRatio) {
  const box = await page.locator(".konvajs-content").first().boundingBox();
  if (!box) throw new Error("Canvas stage is not visible.");
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

async function clickRatio(page, xRatio, yRatio) {
  const point = await canvasPoint(page, xRatio, yRatio);
  await page.mouse.click(point.x, point.y);
  return point;
}

async function expectWallCount(page, count) {
  const details = page.locator("details.editor-actions-menu");
  const wasOpen = await details.evaluate((element) => element.open);
  if (!wasOpen) await details.locator("summary").click();
  await expect(details.locator(".editor-actions-facts")).toContainText(`${count} стен`);
  if (!wasOpen) await details.locator("summary").click();
}

async function drawRoom(page) {
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await clickRatio(page, 0.55, 0.28);
  await clickRatio(page, 0.82, 0.28);
  await clickRatio(page, 0.82, 0.68);
  await clickRatio(page, 0.55, 0.68);
  await clickRatio(page, 0.55, 0.28);
  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();

  const guide = page.locator('[data-first-project-phase="room-created"]');
  if (await guide.isVisible()) {
    await guide.getByRole("button", { name: "Завершить" }).click();
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Выбор", exact: true }).click();
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
  await expectWallCount(page, 4);
}

test("copies and pastes a whole derived room as one safe structural operation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openNewProject(page);
  await drawRoom(page);

  const roomCenter = await canvasPoint(page, 0.685, 0.48);
  await page.mouse.click(roomCenter.x, roomCenter.y);
  await expect(page.getByText("Внутренние размеры", { exact: true })).toBeVisible();

  await page.mouse.click(roomCenter.x, roomCenter.y, { button: "right" });
  const menu = page.getByRole("menu", { name: "Действия с выделением" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Копировать" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Вырезать" })).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: "Дублировать" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press("Control+C");
  await page.keyboard.press("Control+V");
  await expectWallCount(page, 8);
  await testInfo.attach("m8.2-whole-room-copy", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "Отменить" }).click();
  await expectWallCount(page, 4);
  await page.getByRole("button", { name: "Повторить" }).click();
  await expectWallCount(page, 8);
});