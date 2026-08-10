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

function pointAlong(start, end, ratio = 0.5) {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

async function clickScreenPoint(page, point, additive = false) {
  if (additive) await page.keyboard.down("Shift");
  await page.mouse.click(point.x, point.y);
  if (additive) await page.keyboard.up("Shift");
}

async function dismissFirstProjectGuide(page) {
  const hide = page.getByRole("button", { name: "Скрыть", exact: true });
  if (await hide.isVisible()) {
    await hide.click();
    await expect(hide).toBeHidden();
  }
}

async function setSnapping(page, enabled) {
  const button = page.getByRole("button", { name: "Привязки", exact: true });
  await expect(button).toBeVisible();
  const current = await button.getAttribute("aria-pressed");
  if ((current === "true") !== enabled) await button.click();
  await expect(button).toHaveAttribute("aria-pressed", enabled ? "true" : "false");
}

async function expectProjectFact(page, text) {
  const details = page.locator("details.editor-actions-menu");
  const wasOpen = await details.evaluate((element) => element.open);
  if (!wasOpen) await details.locator("summary").click();
  await expect(details.locator(".editor-actions-facts")).toContainText(text);
  if (!wasOpen) await details.locator("summary").click();
}

async function expectWallCount(page, count) {
  await expectProjectFact(page, `${count} стен`);
}

async function expectOpeningCount(page, count) {
  await expectProjectFact(page, `${count} проём`);
}

async function enterSelectMode(page) {
  await page.getByRole("button", { name: "Выбор", exact: true }).click();
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
}

async function drawIsolatedWall(page, start, end) {
  await setSnapping(page, false);
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  const startPoint = await clickCanvasRatio(page, ...start);
  const endPoint = await clickCanvasRatio(page, ...end);
  await enterSelectMode(page);
  await dismissFirstProjectGuide(page);
  return { start: startPoint, end: endPoint, probe: pointAlong(startPoint, endPoint) };
}

async function drawLShape(page) {
  await setSnapping(page, false);
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  const start = await clickCanvasRatio(page, 0.34, 0.34);
  const shared = await clickCanvasRatio(page, 0.64, 0.34);
  const end = await clickCanvasRatio(page, 0.64, 0.66);
  await enterSelectMode(page);
  await expectWallCount(page, 2);
  await dismissFirstProjectGuide(page);
  return {
    start,
    shared,
    end,
    firstProbe: pointAlong(start, shared, 0.4),
    secondProbe: pointAlong(shared, end, 0.5),
  };
}

async function selectAt(page, xRatio, yRatio, additive = false) {
  const point = await canvasPoint(page, xRatio, yRatio);
  await clickScreenPoint(page, point, additive);
  return point;
}

async function wallLengthValue(page, probe) {
  const input = page.getByLabel("Длина по оси стены");
  if (!(await input.isVisible())) await clickScreenPoint(page, probe);
  await expect(input).toBeVisible();
  return input.inputValue();
}

async function attachPageScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
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

    await expectWallCount(page, 2);
    await expect(exactGroup).toBeVisible();
    await attachPageScreenshot(page, testInfo, "m8.2-exact-wall-input");

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(exactGroup).toBeHidden();
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

    const length = page.getByRole("textbox", { name: "Длина стены, мм" });
    await expect(length).toBeVisible();

    await page.mouse.move(a.x + 10, a.y);
    const acquired = await length.inputValue();
    await page.mouse.move(a.x + 15, a.y);
    await expect(length).toHaveValue(acquired);
    await attachPageScreenshot(page, testInfo, "m8.2-endpoint-snap-acquired");

    await page.mouse.move(a.x + 22, a.y);
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
    await page.mouse.move(a.x + 10, a.y);
    const disabledValue = await length.inputValue();
    expect(disabledValue).not.toBe(acquired);

    await page.getByRole("button", { name: "Привязки", exact: true }).click();
    await page.mouse.move(a.x + 10, a.y);
    await expect(length).toHaveValue(acquired);

    await page.mouse.move(a.x + 12, a.y);
    await page.keyboard.down("Alt");
    await page.mouse.move(a.x + 10, a.y);
    await page.keyboard.up("Alt");
    await expect.poll(() => length.inputValue()).not.toBe(acquired);
  });

  test("moves a shared endpoint atomically through exact Undo Redo Undo", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const shape = await drawLShape(page);

    await clickScreenPoint(page, shape.firstProbe);
    const initialLength = await wallLengthValue(page, shape.firstProbe);
    const movedShared = { x: shape.shared.x + 44, y: shape.shared.y + 28 };
    const movedProbe = pointAlong(shape.start, movedShared, 0.4);

    await page.mouse.move(shape.shared.x, shape.shared.y);
    await page.mouse.down();
    await page.keyboard.down("Alt");
    await page.mouse.move(movedShared.x, movedShared.y, { steps: 6 });
    await page.keyboard.up("Alt");
    await page.mouse.up();

    const movedLength = await wallLengthValue(page, movedProbe);
    expect(movedLength).not.toBe(initialLength);
    await attachPageScreenshot(page, testInfo, "m8.2-shared-endpoint-move");

    await page.getByRole("button", { name: "Отменить" }).click();
    await expect.poll(() => wallLengthValue(page, shape.firstProbe)).toBe(initialLength);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect.poll(() => wallLengthValue(page, movedProbe)).toBe(movedLength);
    await page.getByRole("button", { name: "Отменить" }).click();
    await expect.poll(() => wallLengthValue(page, shape.firstProbe)).toBe(initialLength);
  });

  test("translates a wall with its opening but rejects a topology-breaking translation without partial history", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "webkit", "Chromium covers the full safe/unsafe wall translation matrix.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const shape = await drawLShape(page);

    const doorPoint = pointAlong(shape.start, shape.shared, 0.55);
    await page.getByRole("button", { name: "Дверь", exact: true }).click();
    await page.mouse.move(doorPoint.x, doorPoint.y);
    await page.mouse.click(doorPoint.x, doorPoint.y);
    await expectOpeningCount(page, 1);
    await enterSelectMode(page);

    await clickScreenPoint(page, shape.firstProbe);
    const initialLength = await wallLengthValue(page, shape.firstProbe);
    const safeDeltaY = -52;
    const safeProbe = { x: shape.firstProbe.x, y: shape.firstProbe.y + safeDeltaY };
    await page.mouse.move(shape.firstProbe.x, shape.firstProbe.y);
    await page.mouse.down();
    await page.keyboard.down("Alt");
    await page.mouse.move(safeProbe.x, safeProbe.y, { steps: 7 });
    await page.keyboard.up("Alt");
    await page.mouse.up();
    await expectOpeningCount(page, 1);
    await expect.poll(() => wallLengthValue(page, safeProbe)).toBe(initialLength);
    await attachPageScreenshot(page, testInfo, "m8.2-safe-wall-translation");

    await page.getByRole("button", { name: "Отменить" }).click();
    await expectOpeningCount(page, 1);
    await expect.poll(() => wallLengthValue(page, shape.firstProbe)).toBe(initialLength);

    const reversalDelta = shape.end.y - shape.shared.y + 80;
    const unsafeEnd = { x: shape.firstProbe.x, y: shape.firstProbe.y + reversalDelta };
    await page.mouse.move(shape.firstProbe.x, shape.firstProbe.y);
    await page.mouse.down();
    await page.keyboard.down("Alt");
    await page.mouse.move(unsafeEnd.x, unsafeEnd.y, { steps: 12 });
    await page.keyboard.up("Alt");
    await expect(page.locator(".topology-alert")).toBeVisible();
    await attachPageScreenshot(page, testInfo, "m8.2-unsafe-wall-translation");
    await page.mouse.up();
    await expectOpeningCount(page, 1);
    await expect.poll(() => wallLengthValue(page, shape.firstProbe)).toBe(initialLength);

    await page.getByRole("button", { name: "Отменить" }).click();
    await expectOpeningCount(page, 0);
  });

  test("applies multi-wall thickness atomically and restores the shared value with one Undo", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "webkit", "Chromium covers the full multi-wall inspector path.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);

    const firstWall = await drawIsolatedWall(page, [0.34, 0.34], [0.64, 0.34]);
    const secondWall = await drawIsolatedWall(page, [0.34, 0.62], [0.64, 0.62]);
    await expectWallCount(page, 2);
    await clickScreenPoint(page, firstWall.probe);
    await clickScreenPoint(page, secondWall.probe, true);

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

  test("copies and pastes a dependency-closed structure atomically and rejects an open structural fragment", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const isolated = await drawIsolatedWall(page, [0.34, 0.40], [0.64, 0.40]);
    await expectWallCount(page, 1);
    await clickScreenPoint(page, isolated.probe);
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
    const connected = await drawLShape(page);
    await clickScreenPoint(page, connected.firstProbe);
    await page.mouse.click(connected.firstProbe.x, connected.firstProbe.y, { button: "right" });
    const menu = page.getByRole("menu", { name: "Действия с выделением" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Копировать" })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "Вырезать" })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "Дублировать" })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "Показать выделение" })).toBeVisible();
  });
});
