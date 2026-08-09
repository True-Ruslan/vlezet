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

async function fitPlanThroughActions(page) {
  const details = page.locator("details.editor-actions-menu");
  if (!(await details.evaluate((element) => element.open))) {
    await details.locator("summary").click();
  }
  await details.getByRole("button", { name: /Показать весь план/ }).click();
}

async function expectObjectCount(page, count) {
  const details = page.locator("details.editor-actions-menu");
  const wasOpen = await details.evaluate((element) => element.open);
  if (!wasOpen) await details.locator("summary").click();
  await expect(details.locator(".editor-actions-facts")).toContainText(`${count} предмет`);
  if (!wasOpen) await details.locator("summary").click();
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

async function selectTwoChairs(page) {
  const first = await placeChair(page, 0.42, 0.48);
  const second = await placeChair(page, 0.62, 0.48);
  await page.keyboard.down("Shift");
  await page.mouse.click(first.x, first.y);
  await page.keyboard.up("Shift");
  await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");
  await expect(page.locator(".multi-selection-summary")).toContainText("Предметы: 2");
  return { first, second };
}

async function movePointerToCanvasSafeArea(page) {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.05);
}

async function dragMarquee(page, start, end, additive = false) {
  await page.mouse.move(start.x, start.y);
  if (additive) await page.keyboard.down("Shift");
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  if (additive) await page.keyboard.up("Shift");
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

    await fitPlanThroughActions(page);

    const box = await canvasBox(page);
    await page.mouse.click(box.x + box.width * 0.05, box.y + box.height * 0.05, { button: "right" });

    const menu = page.getByRole("menu", { name: "Действия на холсте" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Выбрать всё" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Показать весь план" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Вставить" })).toHaveCount(0);

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

  test("does not bind bare view keys and keeps explicit fit action history-free", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);

    const initialFacts = await projectFacts(page);
    await expect(initialFacts).toContainText("4 стен");
    await page.keyboard.press("Escape");

    const box = await canvasBox(page);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.wheel(90, 80);
    const beforeBareKeys = await canvasScreenshot(page);

    for (const key of ["0", "1", "2", "=", "-"]) {
      await page.keyboard.press(key);
    }
    await page.keyboard.down("Shift");
    await page.keyboard.press("=");
    await page.keyboard.up("Shift");
    await page.waitForTimeout(120);
    expect((await canvasScreenshot(page)).equals(beforeBareKeys)).toBe(true);

    await fitPlanThroughActions(page);
    await expectCanvasToChange(page, beforeBareKeys);

    await page.getByRole("button", { name: "Отменить" }).click();
    const afterUndoFacts = await projectFacts(page);
    await expect(afterUndoFacts).toContainText("3 стен");
  });

  test("executes the same registered commands from the semantic context menu", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);
    const chair = await placeChair(page, 0.5, 0.48);

    await page.mouse.click(chair.x, chair.y, { button: "right" });
    const menu = page.getByRole("menu", { name: "Действия с выделением" });
    await expect(menu).toBeVisible();
    for (const label of ["Копировать", "Вырезать", "Дублировать", "Показать выделение", "Удалить"]) {
      await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
    }
    await expect(menu.getByRole("menuitem", { name: "Вставить" })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "Повернуть на 90°" })).toHaveCount(0);

    await menu.getByRole("menuitem", { name: "Дублировать" }).click();
    await expect(menu).toBeHidden();
    await expectObjectCount(page, 2);
  });

  test("keeps an additive furniture group rigid through one Undo and Redo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);
    const { first } = await selectTwoChairs(page);

    await movePointerToCanvasSafeArea(page);
    const beforeMove = await canvasScreenshot(page);

    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(first.x + 80, first.y + 45, { steps: 6 });
    await page.mouse.up();
    await movePointerToCanvasSafeArea(page);

    const afterMove = await canvasScreenshot(page);
    expect(afterMove.equals(beforeMove)).toBe(false);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");
    await expect(page.locator(".multi-selection-summary")).toContainText("Предметы: 2");

    await page.getByRole("button", { name: "Отменить" }).click();
    await expect.poll(async () => (await canvasScreenshot(page)).equals(beforeMove)).toBe(true);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");

    await page.getByRole("button", { name: "Повторить" }).click();
    await expect.poll(async () => (await canvasScreenshot(page)).equals(afterMove)).toBe(true);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");
  });

  test("copies, pastes, duplicates and cuts the selected furniture group atomically", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);
    await selectTwoChairs(page);
    await expectObjectCount(page, 2);

    await page.keyboard.press("Control+C");
    await expectObjectCount(page, 2);

    await page.keyboard.press("Control+V");
    await expectObjectCount(page, 4);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");

    await page.keyboard.press("Control+D");
    await expectObjectCount(page, 6);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");

    await page.keyboard.press("Control+X");
    await expectObjectCount(page, 4);

    await page.getByRole("button", { name: "Отменить" }).click();
    await expectObjectCount(page, 6);
  });

  test("replaces and additively extends furniture selection with marquee drag inside a room", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);
    const first = await placeChair(page, 0.32, 0.48);
    const second = await placeChair(page, 0.5, 0.48);
    const third = await placeChair(page, 0.68, 0.48);

    await dragMarquee(
      page,
      { x: first.x - 60, y: first.y - 60 },
      { x: second.x + 60, y: second.y + 60 },
    );
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");
    await expect(page.locator(".multi-selection-summary")).toContainText("Предметы: 2");

    await dragMarquee(
      page,
      { x: third.x - 60, y: third.y - 60 },
      { x: third.x + 60, y: third.y + 60 },
      true,
    );
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 3");
    await expect(page.locator(".multi-selection-summary")).toContainText("Предметы: 3");
  });

  test("selects all concrete entities without derived rooms and fails mixed mutations closed", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);
    const chair = await placeChair(page, 0.5, 0.48);

    await page.keyboard.press("Control+A");
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 5");
    const summary = page.locator(".multi-selection-summary");
    await expect(summary).toContainText("Стены: 4");
    await expect(summary).toContainText("Предметы: 1");
    await expect(summary).not.toContainText("Комнаты:");

    const actions = page.locator(".multi-selection-inspector .context-panel-action-area");
    await expect(actions.getByRole("button", { name: "Копировать" })).toHaveCount(0);
    await expect(actions.getByRole("button", { name: "Вырезать" })).toHaveCount(0);
    await expect(actions.getByRole("button", { name: "Дублировать" })).toHaveCount(0);
    await expect(actions.getByRole("button", { name: "Удалить" })).toHaveCount(0);

    await page.mouse.click(chair.x, chair.y, { button: "right" });
    const menu = page.getByRole("menu", { name: "Действия с выделением" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Показать выделение" })).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveCount(1);
  });
});
