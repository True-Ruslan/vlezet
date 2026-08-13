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

async function expectObjectCount(page, count) {
  const details = page.locator("details.editor-actions-menu");
  const wasOpen = await details.evaluate((element) => element.open);
  if (!wasOpen) await details.locator("summary").click();
  await expect(details.locator(".editor-actions-facts")).toContainText(`${count} предмет`);
  if (!wasOpen) await details.locator("summary").click();
}

async function placeChair(page, xRatio, yRatio) {
  const search = page.getByRole("searchbox", { name: "Поиск мебели и техники" });
  if (!(await search.isVisible())) {
    await page.getByRole("button", { name: "Мебель", exact: true }).click();
  }
  await expect(search).toBeVisible();
  await search.fill("стул");
  await page.getByRole("button", { name: /^Стул,/ }).click();

  const point = await canvasPoint(page, xRatio, yRatio);
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(".placement-fit-label")).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".context-panel-title")).toHaveText("Стул");
  return point;
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

test("pastes an explicit room and furniture selection at the latest Canvas pointer as one semantic operation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openNewProject(page);
  await drawRoom(page);
  await placeChair(page, 0.685, 0.48);
  await expectObjectCount(page, 1);

  const emptyRoomPoint = await canvasPoint(page, 0.60, 0.40);
  await page.keyboard.down("Shift");
  await page.mouse.click(emptyRoomPoint.x, emptyRoomPoint.y);
  await page.keyboard.up("Shift");
  await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");
  const sourceSummary = page.locator(".multi-selection-summary");
  await expect(sourceSummary).toContainText("Комнаты: 1");
  await expect(sourceSummary).toContainText("Предметы: 1");

  const actions = page.locator(".multi-selection-inspector .context-panel-action-area");
  const disclosure = actions.locator("details.multi-selection-actions-menu");
  await disclosure.locator("summary").click();
  const copyAction = disclosure.getByRole("button", { name: "Копировать" });
  await expect(copyAction).toBeVisible();
  await expect(disclosure.getByRole("button", { name: "Вырезать" })).toHaveCount(0);
  await copyAction.click();

  const pasteTarget = await canvasPoint(page, 0.30, 0.48);
  await page.mouse.move(pasteTarget.x, pasteTarget.y);
  await page.keyboard.press("Control+V");

  await expectWallCount(page, 8);
  await expectObjectCount(page, 2);
  await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 5");
  const pastedSummary = page.locator(".multi-selection-summary");
  await expect(pastedSummary).toContainText("Стены: 4");
  await expect(pastedSummary).toContainText("Предметы: 1");

  await page.mouse.click(pasteTarget.x, pasteTarget.y);
  await expect(page.locator(".context-panel-title")).toHaveText("Стул");

  await testInfo.attach("m8.2-composite-room-furniture-paste", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "Отменить" }).click();
  await expectWallCount(page, 4);
  await expectObjectCount(page, 1);

  await page.getByRole("button", { name: "Повторить" }).click();
  await expectWallCount(page, 8);
  await expectObjectCount(page, 2);
});
