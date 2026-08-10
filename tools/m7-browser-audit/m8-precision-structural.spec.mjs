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

async function canvasPoint(page, xRatio, yRatio) {
  const box = await canvasBox(page);
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

async function clickCanvasRatio(page, xRatio, yRatio) {
  const point = await canvasPoint(page, xRatio, yRatio);
  await page.mouse.click(point.x, point.y);
  return point;
}

async function moveCanvasRatio(page, xRatio, yRatio) {
  const point = await canvasPoint(page, xRatio, yRatio);
  await page.mouse.move(point.x, point.y);
  return point;
}

async function setSnapping(page, enabled) {
  const button = page.getByRole("button", { name: "Привязки", exact: true });
  await expect(button).toBeVisible();
  const current = await button.getAttribute("aria-pressed");
  if ((current === "true") !== enabled) await button.click();
  await expect(button).toHaveAttribute("aria-pressed", enabled ? "true" : "false");
}

async function projectFacts(page) {
  const details = page.locator("details.editor-actions-menu");
  if (!(await details.evaluate((element) => element.open))) {
    await details.locator("summary").click();
  }
  return details.locator(".editor-actions-facts");
}

async function expectWallCount(page, count) {
  await expect(await projectFacts(page)).toContainText(`${count} стен`);
}

async function expectOpeningCount(page, count) {
  await expect(await projectFacts(page)).toContainText(`${count} проём`);
}

async function enterSelectMode(page) {
  await page.getByRole("button", { name: "Выбор", exact: true }).click();
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
}

async function drawRawRectangle(page) {
  await setSnapping(page, false);
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await clickCanvasRatio(page, 0.22, 0.30);
  await clickCanvasRatio(page, 0.78, 0.30);
  await clickCanvasRatio(page, 0.78, 0.70);
  await clickCanvasRatio(page, 0.22, 0.70);
  await clickCanvasRatio(page, 0.22, 0.30);
  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  await page.locator('[data-first-project-phase="room-created"]').getByRole("button", { name: "Завершить", exact: true }).click();
  await enterSelectMode(page);
  await setSnapping(page, true);
  await expectWallCount(page, 4);
}

async function drawRawIsolatedWall(page) {
  await setSnapping(page, false);
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  const start = await clickCanvasRatio(page, 0.30, 0.40);
  const end = await clickCanvasRatio(page, 0.66, 0.40);
  await enterSelectMode(page);
  await setSnapping(page, true);
  await expectWallCount(page, 1);
  return { start, end };
}

async function selectWallAt(page, xRatio, yRatio, additive = false) {
  const point = await canvasPoint(page, xRatio, yRatio);
  if (additive) await page.keyboard.down("Shift");
  await page.mouse.click(point.x, point.y);
  if (additive) await page.keyboard.up("Shift");
  return point;
}

async function attachPageScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function movePointerToCanvasSafeArea(page) {
  await moveCanvasRatio(page, 0.05, 0.05);
}

async function canvasScreenshot(page) {
  return page.locator(".konvajs-content").first().screenshot();
}

test.describe("M8.2 precision structural acceptance", () => {
  test("keeps pointer-only wall creation and exact keyboard wall input as one-step semantic operations", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);

    await setSnapping(page, false);
    await page.getByRole("button", { name: "Стена", exact: true }).click();
    await clickCanvasRatio(page, 0.20, 0.28);
    await clickCanvasRatio(page, 0.44, 0.28);
    await expectWallCount(page, 1);

    await clickCanvasRatio(page, 0.58, 0.38);
    const exactGroup = page.getByRole("group", { name: "Точные параметры стены" });
    await expect(exactGroup).toBeVisible();
    const length = page.getByRole("textbox", { name: "Длина стены, мм" });
    const angle = page.getByRole("textbox", { name: "Угол стены, градусы" });
    await length.focus();
    await length.fill("2400");
    await page.keyboard.press("Tab");
    await expect(angle).toBeFocused();
    await angle.fill("90");
    await angle.press("Enter");

    await expect(exactGroup).toBeHidden();
    await expectWallCount(page, 2);
    await attachPageScreenshot(page, testInfo, "m8.2-exact-wall-input");

    await page.getByRole("button", { name: "Отменить" }).click();
    await expectWallCount(page, 1);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expectWallCount(page, 2);
  });

  test("keeps dynamic-input Escape local before cancelling the wall draft", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await page.getByRole("button", { name: "Стена", exact: true }).click();
    await clickCanvasRatio(page, 0.28, 0.36);

    const group = page.getByRole("group", { name: "Точные параметры стены" });
    const length = page.getByRole("textbox", { name: "Длина стены, мм" });
    await expect(group).toBeVisible();
    await length.focus();
    await length.fill("3100");
    await length.press("Escape");
    await expect(length).not.toBeFocused();
    await expect(group).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(group).toBeHidden();
    await expectWallCount(page, 0);
  });

  test("holds semantic snap acquisition through jitter, exposes snap toggle and honors temporary Alt suppression", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await setSnapping(page, false);
    await page.getByRole("button", { name: "Стена", exact: true }).click();
    const a = await clickCanvasRatio(page, 0.30, 0.34);
    const b = await clickCanvasRatio(page, 0.70, 0.34);
    await expectWallCount(page, 1);
    await setSnapping(page, true);

    await clickCanvasRatio(page, 0.48, 0.66);
    const length = page.getByRole("textbox", { name: "Длина стены, мм" });
    await expect(length).toBeVisible();

    await page.mouse.move(b.x + 10, b.y);
    const acquired = await length.inputValue();
    await page.mouse.move(b.x + 15, b.y);
    await expect(length).toHaveValue(acquired);
    await attachPageScreenshot(page, testInfo, "m8.2-endpoint-snap-acquired");

    await page.mouse.move(b.x + 22, b.y);
    await expect.poll(() => length.inputValue()).not.toBe(acquired);

    await page.mouse.move((a.x + b.x) / 2, a.y + 8);
    const midpoint = await length.inputValue();
    await page.mouse.move((a.x + b.x) / 2, a.y + 10);
    await expect(length).toHaveValue(midpoint);
    await attachPageScreenshot(page, testInfo, "m8.2-midpoint-snap");

    await page.mouse.move(a.x + (b.x - a.x) * 0.28, a.y + 8);
    const wallAxis = await length.inputValue();
    await page.mouse.move(a.x + (b.x - a.x) * 0.28, a.y + 10);
    await expect(length).toHaveValue(wallAxis);
    await attachPageScreenshot(page, testInfo, "m8.2-wall-axis-snap");

    await page.getByRole("button", { name: "Привязки", exact: true }).click();
    await expect(page.getByRole("button", { name: "Привязки", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.mouse.move(b.x + 10, b.y);
    const disabledValue = await length.inputValue();
    expect(disabledValue).not.toBe(acquired);

    await page.getByRole("button", { name: "Привязки", exact: true }).click();
    await page.mouse.move(b.x + 10, b.y);
    await expect(length).toHaveValue(acquired);

    await page.keyboard.down("Alt");
    await page.mouse.move(b.x + 10, b.y);
    await page.keyboard.up("Alt");
    await expect.poll(() => length.inputValue()).not.toBe(acquired);
  });

  test("moves a shared endpoint atomically through exact Undo Redo Undo", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRawRectangle(page);

    await selectWallAt(page, 0.50, 0.30);
    await expect(page.locator(".context-panel-title")).toContainText("Стена");
    const endpoint = await canvasPoint(page, 0.22, 0.30);
    const before = await canvasScreenshot(page);

    await page.mouse.move(endpoint.x, endpoint.y);
    await page.mouse.down();
    await page.mouse.move(endpoint.x + 44, endpoint.y + 28, { steps: 6 });
    await page.mouse.up();
    await movePointerToCanvasSafeArea(page);
    const after = await canvasScreenshot(page);
    expect(after.equals(before)).toBe(false);
    await attachPageScreenshot(page, testInfo, "m8.2-shared-endpoint-move");

    await page.getByRole("button", { name: "Отменить" }).click();
    await movePointerToCanvasSafeArea(page);
    await expect.poll(async () => (await canvasScreenshot(page)).equals(before)).toBe(true);
    await page.getByRole("button", { name: "Повторить" }).click();
    await movePointerToCanvasSafeArea(page);
    await expect.poll(async () => (await canvasScreenshot(page)).equals(after)).toBe(true);
    await page.getByRole("button", { name: "Отменить" }).click();
    await movePointerToCanvasSafeArea(page);
    await expect.poll(async () => (await canvasScreenshot(page)).equals(before)).toBe(true);
  });

  test("translates a wall with its opening but rejects a topology-breaking translation without partial history", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "webkit", "Chromium covers the full safe/unsafe wall translation matrix.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRawRectangle(page);

    await page.getByRole("button", { name: "Дверь", exact: true }).click();
    const topMid = await canvasPoint(page, 0.50, 0.30);
    await page.mouse.move(topMid.x, topMid.y);
    await page.mouse.click(topMid.x, topMid.y);
    await expectOpeningCount(page, 1);
    await enterSelectMode(page);

    await selectWallAt(page, 0.50, 0.30);
    const wallLength = page.getByLabel("Длина по оси стены");
    const initialLength = await wallLength.inputValue();
    const beforeSafeMove = await canvasScreenshot(page);
    const safeStart = await canvasPoint(page, 0.50, 0.30);
    await page.mouse.move(safeStart.x, safeStart.y);
    await page.mouse.down();
    await page.mouse.move(safeStart.x, safeStart.y - 52, { steps: 7 });
    await page.mouse.up();
    await movePointerToCanvasSafeArea(page);
    expect((await canvasScreenshot(page)).equals(beforeSafeMove)).toBe(false);
    await expectOpeningCount(page, 1);
    await expect(wallLength).toHaveValue(initialLength);
    await attachPageScreenshot(page, testInfo, "m8.2-safe-wall-translation");

    await page.getByRole("button", { name: "Отменить" }).click();
    await selectWallAt(page, 0.50, 0.30);
    const beforeUnsafeMove = await canvasScreenshot(page);
    const unsafeStart = await canvasPoint(page, 0.50, 0.30);
    const unsafeEnd = await canvasPoint(page, 0.50, 0.70);
    await page.mouse.move(unsafeStart.x, unsafeStart.y);
    await page.mouse.down();
    await page.mouse.move(unsafeEnd.x, unsafeEnd.y, { steps: 10 });
    await expect(page.locator(".topology-alert")).toBeVisible();
    await attachPageScreenshot(page, testInfo, "m8.2-unsafe-wall-translation");
    await page.mouse.up();
    await movePointerToCanvasSafeArea(page);
    await expect.poll(async () => (await canvasScreenshot(page)).equals(beforeUnsafeMove)).toBe(true);
    await expectOpeningCount(page, 1);

    await page.getByRole("button", { name: "Отменить" }).click();
    await expectOpeningCount(page, 0);
  });

  test("applies multi-wall thickness atomically and restores the shared value with one Undo", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "webkit", "Chromium covers the full multi-wall inspector path.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRawRectangle(page);

    await selectWallAt(page, 0.50, 0.30);
    await selectWallAt(page, 0.78, 0.50, true);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");
    await expect(page.locator(".multi-selection-summary")).toContainText("Стены: 2");
    const form = page.locator(".multi-selection-thickness-form");
    const thickness = form.getByRole("spinbutton", { name: "Толщина стен, мм" });
    const initial = await thickness.inputValue();
    await thickness.fill("240");
    await form.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(thickness).toHaveValue("240");
    await attachPageScreenshot(page, testInfo, "m8.2-batch-wall-thickness");

    await page.getByRole("button", { name: "Отменить" }).click();
    await expect(thickness).toHaveValue(initial);
  });

  test("copies and pastes a dependency-closed wall atomically and rejects an open structural fragment", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRawIsolatedWall(page);
    await selectWallAt(page, 0.48, 0.40);
    await expect(page.locator(".context-panel-title")).toContainText("Стена");

    await page.keyboard.press("Control+C");
    await page.keyboard.press("Control+V");
    await expectWallCount(page, 2);
    await attachPageScreenshot(page, testInfo, "m8.2-structural-paste");
    await page.getByRole("button", { name: "Отменить" }).click();
    await expectWallCount(page, 1);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expectWallCount(page, 2);
    await page.getByRole("button", { name: "Отменить" }).click();
    await expectWallCount(page, 1);

    await openNewProject(page);
    await drawRawRectangle(page);
    const topMid = await selectWallAt(page, 0.50, 0.30);
    await page.mouse.click(topMid.x, topMid.y, { button: "right" });
    const menu = page.getByRole("menu", { name: "Действия с выделением" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Копировать" })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "Вырезать" })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "Дублировать" })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "Показать выделение" })).toBeVisible();
  });
});
