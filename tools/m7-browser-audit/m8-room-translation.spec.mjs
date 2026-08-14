import { expect, test } from "./fixtures.mjs";

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.locator(".projects-page, .editor-app").first()).toBeVisible();
  if (await page.locator(".editor-app").isVisible()) {
    await page.getByRole("button", { name: "Вернуться к моим проектам" }).click();
  }
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".editor-app")).toBeVisible();
  await expect(page.locator(".canvas-shell")).toBeVisible();
  await expect(page.locator(".konvajs-content canvas").first()).toBeVisible();
}

async function canvasBox(page) {
  const box = await page.locator(".konvajs-content").first().boundingBox();
  if (!box) throw new Error("Canvas stage is not visible.");
  return box;
}

async function canvasPoint(page, xRatio, yRatio) {
  const box = await canvasBox(page);
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

async function stagePoint(page, offset) {
  const box = await canvasBox(page);
  return { x: box.x + offset.x, y: box.y + offset.y };
}

async function clickRatio(page, xRatio, yRatio, options = {}) {
  const point = await canvasPoint(page, xRatio, yRatio);
  await page.mouse.click(point.x, point.y, options);
  return point;
}

async function clickStageOffset(page, offset, options = {}) {
  const point = await stagePoint(page, offset);
  await page.mouse.click(point.x, point.y, options);
  return point;
}

async function setSnapping(page, enabled) {
  const button = page.getByRole("button", { name: "Привязки", exact: true });
  await expect(button).toBeVisible();
  const current = await button.getAttribute("aria-pressed");
  if ((current === "true") !== enabled) await button.click();
  await expect(button).toHaveAttribute("aria-pressed", enabled ? "true" : "false");
}

async function finishFirstRoomGuide(page) {
  const guide = page.locator('[data-first-project-phase="room-created"]');
  if (await guide.isVisible()) {
    await guide.getByRole("button", { name: "Завершить", exact: true }).click();
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Выбор", exact: true }).click();
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
}

async function drawRoom(page) {
  const box = await canvasBox(page);
  const point = (xRatio, yRatio) => ({ x: box.width * xRatio, y: box.height * yRatio });
  const a = point(0.55, 0.28);
  const b = point(0.82, 0.28);
  const c = point(0.82, 0.68);
  const d = point(0.55, 0.68);

  await page.getByRole("button", { name: "Стена", exact: true }).click();
  for (const offset of [a, b, c, d, a]) await clickStageOffset(page, offset);
  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  await finishFirstRoomGuide(page);
  await expect(page.locator(".topology-alert")).toHaveCount(0);
  return {
    corners: { a, b, c, d },
    sourceOffset: point(0.60, 0.61),
    targetOffset: point(0.30, 0.61),
  };
}

async function drawUnsafeConnectedRoom(page) {
  const room = await drawRoom(page);
  await setSnapping(page, true);
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await clickStageOffset(page, room.corners.a);
  await clickStageOffset(page, {
    x: room.corners.a.x - 120,
    y: room.corners.a.y - 100,
  });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Выбор", exact: true }).click();
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
  await expect(page.locator(".topology-alert")).toHaveCount(0);
  return room;
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
  const point = await canvasPoint(page, xRatio, yRatio);
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(".placement-fit-label")).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".context-panel-title")).toHaveText("Стул");
  return point;
}

async function drag(page, start, end, options = {}) {
  await page.mouse.move(start.x, start.y);
  if (options.alt) await page.keyboard.down("Alt");
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  if (options.beforeUp) await options.beforeUp();
  await page.mouse.up();
  if (options.alt) await page.keyboard.up("Alt");
}

async function selectRoomAndObjects(page, roomPoint, objectPoints) {
  await page.mouse.click(roomPoint.x, roomPoint.y);
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
  await page.keyboard.down("Shift");
  for (const point of objectPoints) await page.mouse.click(point.x, point.y);
  await page.keyboard.up("Shift");
}

async function editorFactsText(page) {
  const details = page.locator("details.editor-actions-menu");
  const wasOpen = await details.evaluate((element) => element.open);
  if (!wasOpen) await details.locator("summary").click();
  const text = await details.locator(".editor-actions-facts").innerText();
  if (!wasOpen) await details.locator("summary").click();
  return text;
}

async function expectCounts(page, expected) {
  await expect.poll(async () => {
    const text = await editorFactsText(page);
    return {
      walls: Number(text.match(/(\d+)\s+стен/)?.[1] ?? 0),
      objects: Number(text.match(/(\d+)\s+предмет/)?.[1] ?? 0),
    };
  }).toEqual(expected);
}

async function clearSelection(page) {
  await page.keyboard.press("Escape");
}

test.describe("M8.2 room translation acceptance", () => {
  test("room-only drag moves the room while unselected furniture stays fixed and Undo Redo is one operation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const room = await drawRoom(page);
    const chair = await placeChair(page, 0.685, 0.48);
    await expectCounts(page, { walls: 4, objects: 1 });

    const source = await stagePoint(page, room.sourceOffset);
    const target = await stagePoint(page, room.targetOffset);
    await page.mouse.click(source.x, source.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
    await setSnapping(page, false);
    await drag(page, source, target);
    await expect(page.locator(".topology-alert")).toHaveCount(0);

    await page.getByRole("button", { name: "Отменить" }).click();
    await clearSelection(page);
    const restoredSource = await stagePoint(page, room.sourceOffset);
    await page.mouse.click(restoredSource.x, restoredSource.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    await page.getByRole("button", { name: "Повторить" }).click();
    await clearSelection(page);
    const restoredTarget = await stagePoint(page, room.targetOffset);
    await page.mouse.click(restoredTarget.x, restoredTarget.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    const currentChair = await canvasPoint(page, 0.685, 0.48);
    await page.mouse.click(currentChair.x, currentChair.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    expect(chair).toBeTruthy();
  });

  test("room plus exactly two explicitly selected furniture items translates as one rigid group", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRoom(page);
    const first = await placeChair(page, 0.62, 0.43);
    const second = await placeChair(page, 0.72, 0.52);
    const roomPoint = await canvasPoint(page, 0.78, 0.62);
    await selectRoomAndObjects(page, roomPoint, [first, second]);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 3");
    await expect(page.locator(".multi-selection-summary")).toContainText("Комнаты: 1");
    await expect(page.locator(".multi-selection-summary")).toContainText("Предметы: 2");

    await setSnapping(page, false);
    const target = await canvasPoint(page, 0.38, 0.62);
    await drag(page, roomPoint, target);
    await expect(page.locator(".topology-alert")).toHaveCount(0);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 3");

    await clearSelection(page);
    const movedFirst = await canvasPoint(page, 0.22, 0.43);
    const movedSecond = await canvasPoint(page, 0.32, 0.52);
    await page.mouse.click(movedFirst.x, movedFirst.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await clearSelection(page);
    await page.mouse.click(movedSecond.x, movedSecond.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
  });

  test("Выбрать мебель в комнате explicitly expands selection before the normal composite drag", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRoom(page);
    await placeChair(page, 0.62, 0.43);
    await placeChair(page, 0.72, 0.52);
    const roomPoint = await canvasPoint(page, 0.78, 0.62);
    await page.mouse.click(roomPoint.x, roomPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    await page.mouse.click(roomPoint.x, roomPoint.y, { button: "right" });
    const menu = page.getByRole("menu", { name: "Действия с выделением" });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Выбрать мебель в комнате" }).click();
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 3");
    await expect(page.locator(".multi-selection-summary")).toContainText("Комнаты: 1");
    await expect(page.locator(".multi-selection-summary")).toContainText("Предметы: 2");

    await setSnapping(page, false);
    const target = await canvasPoint(page, 0.38, 0.62);
    await drag(page, roomPoint, target);
    await expect(page.locator(".topology-alert")).toHaveCount(0);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 3");
  });

  test("furniture pointer hit keeps priority over the selected room drag gesture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRoom(page);
    const chair = await placeChair(page, 0.685, 0.48);
    const roomPoint = await canvasPoint(page, 0.60, 0.61);
    await page.mouse.click(roomPoint.x, roomPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    const chairTarget = await canvasPoint(page, 0.74, 0.48);
    await drag(page, chair, chairTarget);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await expect(page.locator(".topology-alert")).toHaveCount(0);

    await clearSelection(page);
    await page.mouse.click(roomPoint.x, roomPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
  });

  test("unsafe connected topology visibly rejects the drag and commits no structural movement", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const room = await drawUnsafeConnectedRoom(page);
    const source = await stagePoint(page, room.sourceOffset);
    const target = await stagePoint(page, room.targetOffset);
    await page.mouse.click(source.x, source.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    await page.mouse.move(source.x, source.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await expect(page.locator(".topology-alert")).toBeVisible();
    await expect(page.locator(".topology-alert")).toContainText(/недопустимо|общ|сосед|связан/i);
    await page.mouse.up();

    await clearSelection(page);
    const original = await stagePoint(page, room.sourceOffset);
    await page.mouse.click(original.x, original.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
  });

  test("Alt suppresses structural snapping locally without disabling the global setting", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRoom(page);
    const source = await canvasPoint(page, 0.60, 0.61);
    const target = await canvasPoint(page, 0.34, 0.57);
    await page.mouse.click(source.x, source.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
    await setSnapping(page, true);

    await drag(page, source, target, { alt: true });
    await expect(page.locator(".topology-alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Привязки", exact: true })).toHaveAttribute("aria-pressed", "true");

    await clearSelection(page);
    await page.mouse.click(target.x, target.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
  });
});
