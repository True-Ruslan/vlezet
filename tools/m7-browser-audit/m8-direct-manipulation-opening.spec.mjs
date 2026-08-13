import { expect, test } from "@playwright/test";

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

function pointAlong(start, end, ratio = 0.5) {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
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

async function enterSelectMode(page) {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Выбор", exact: true }).click();
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
}

async function finishFirstRoomGuide(page) {
  const guide = page.locator('[data-first-project-phase="room-created"]');
  if (await guide.isVisible()) {
    await guide.getByRole("button", { name: "Завершить", exact: true }).click();
  }
  await enterSelectMode(page);
}

async function dismissFirstProjectGuide(page) {
  const hide = page.getByRole("button", { name: "Скрыть", exact: true });
  if (await hide.isVisible()) {
    await hide.click();
    await expect(hide).toBeHidden();
  }
}

async function drawRoom(page, geometry = {}) {
  const box = await canvasBox(page);
  const left = geometry.left ?? 0.55;
  const right = geometry.right ?? 0.82;
  const top = geometry.top ?? 0.28;
  const bottom = geometry.bottom ?? 0.68;
  const point = (xRatio, yRatio) => ({ x: box.width * xRatio, y: box.height * yRatio });
  const a = point(left, top);
  const b = point(right, top);
  const c = point(right, bottom);
  const d = point(left, bottom);

  await page.getByRole("button", { name: "Стена", exact: true }).click();
  for (const offset of [a, b, c, d, a]) await clickStageOffset(page, offset);
  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  await finishFirstRoomGuide(page);
  await expect(page.locator(".topology-alert")).toHaveCount(0);
  return {
    corners: { a, b, c, d },
    interior: point((left + right) / 2, (top + bottom) / 2),
    freeInterior: point(right - Math.min(0.04, (right - left) / 4), bottom - Math.min(0.06, (bottom - top) / 4)),
  };
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
  await page.mouse.move(end.x, end.y, { steps: options.steps ?? 10 });
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
  await expect(page.locator(".context-panel-title")).toHaveText(`Выбрано: ${objectPoints.length + 1}`);
}

async function expectRoomFurnitureSelection(page, furnitureCount) {
  await expect(page.locator(".multi-selection-summary")).toContainText("Комнаты: 1");
  await expect(page.locator(".multi-selection-summary")).toContainText(`Предметы: ${furnitureCount}`);
}

async function clearSelection(page) {
  await page.keyboard.press("Escape");
}

async function editorFactsText(page) {
  const details = page.locator("details.editor-actions-menu");
  const wasOpen = await details.evaluate((element) => element.open);
  if (!wasOpen) await details.locator("summary").click();
  const text = await details.locator(".editor-actions-facts").innerText();
  if (!wasOpen) await details.locator("summary").click();
  return text;
}

async function expectOpeningCount(page, count) {
  await expect.poll(async () => {
    const text = await editorFactsText(page);
    return Number(text.match(/(\d+)\s+проём/)?.[1] ?? 0);
  }).toBe(count);
}

async function drawIsolatedWall(page, startRatio = [0.20, 0.34], endRatio = [0.80, 0.34]) {
  await setSnapping(page, false);
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  const start = await canvasPoint(page, ...startRatio);
  const end = await canvasPoint(page, ...endRatio);
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(end.x, end.y);
  await enterSelectMode(page);
  await dismissFirstProjectGuide(page);
  const probe = pointAlong(start, end, 0.5);
  await page.mouse.click(probe.x, probe.y);
  const lengthInput = page.locator("#wall-length");
  await expect(lengthInput).toBeVisible();
  const lengthMm = Number((await lengthInput.inputValue()).replace(",", "."));
  expect(lengthMm).toBeGreaterThan(0);
  const thicknessInput = page.locator("#wall-thickness");
  await expect(thicknessInput).toBeVisible();
  const thicknessMm = Number((await thicknessInput.inputValue()).replace(",", "."));
  expect(thicknessMm).toBeGreaterThan(0);
  await clearSelection(page);
  return { start, end, lengthMm, thicknessMm };
}

async function placeOpening(page, kind, wall, ratio) {
  const label = kind === "door" ? "Дверь" : "Окно";
  await page.getByRole("button", { name: label, exact: true }).click();
  const point = pointAlong(wall.start, wall.end, ratio);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await enterSelectMode(page);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".context-panel-title")).toHaveText(label);
  return point;
}

async function openingOffset(page) {
  const input = page.locator("#opening-offset");
  await expect(input).toBeVisible();
  const value = Number((await input.inputValue()).replace(",", "."));
  expect(Number.isFinite(value)).toBe(true);
  return value;
}

async function openingWidth(page) {
  const input = page.locator("#opening-width");
  await expect(input).toBeVisible();
  const value = Number((await input.inputValue()).replace(",", "."));
  expect(value).toBeGreaterThan(0);
  return value;
}

function wallScreenBasis(wall) {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const lengthPx = Math.hypot(dx, dy);
  expect(lengthPx).toBeGreaterThan(0);
  return {
    pixelsPerMm: lengthPx / wall.lengthMm,
    tangent: { x: dx / lengthPx, y: dy / lengthPx },
    normal: { x: -dy / lengthPx, y: dx / lengthPx },
  };
}

function renderedOpeningHandle(wall, kind, offsetMm, widthMm) {
  const { pixelsPerMm, tangent, normal } = wallScreenBasis(wall);
  const alongMm = kind === "door" ? offsetMm : offsetMm + widthMm / 2;
  const normalMm = kind === "door" ? widthMm / 2 : wall.thicknessMm * 0.22;
  const base = {
    x: wall.start.x + tangent.x * alongMm * pixelsPerMm,
    y: wall.start.y + tangent.y * alongMm * pixelsPerMm,
  };
  return {
    x: base.x + normal.x * normalMm * pixelsPerMm,
    y: base.y + normal.y * normalMm * pixelsPerMm,
  };
}

async function objectHitAt(page, point) {
  await clearSelection(page);
  await page.mouse.click(point.x, point.y);
  return (await page.locator(".context-panel-title").textContent()) === "Стул";
}

async function findObjectEdge(page, inside, direction) {
  let inner = { ...inside };
  let outer = null;
  for (let distance = 8; distance <= 96; distance += 8) {
    const candidate = {
      x: inside.x + direction.x * distance,
      y: inside.y + direction.y * distance,
    };
    if (await objectHitAt(page, candidate)) inner = candidate;
    else { outer = candidate; break; }
  }
  if (!outer) throw new Error("Could not bracket the rendered furniture edge.");
  for (let index = 0; index < 5; index += 1) {
    const middle = { x: (inner.x + outer.x) / 2, y: (inner.y + outer.y) / 2 };
    if (await objectHitAt(page, middle)) inner = middle;
    else outer = middle;
  }
  return { x: (inner.x + outer.x) / 2, y: (inner.y + outer.y) / 2 };
}

async function renderedObjectBounds(page, inside) {
  const left = await findObjectEdge(page, inside, { x: -1, y: 0 });
  const right = await findObjectEdge(page, inside, { x: 1, y: 0 });
  const centerX = (left.x + right.x) / 2;
  const verticalInside = { x: centerX, y: inside.y };
  if (!(await objectHitAt(page, verticalInside))) throw new Error("Rendered furniture center probe missed the object.");
  const top = await findObjectEdge(page, verticalInside, { x: 0, y: -1 });
  const bottom = await findObjectEdge(page, verticalInside, { x: 0, y: 1 });
  const center = { x: centerX, y: (top.y + bottom.y) / 2 };
  await clearSelection(page);
  await page.mouse.click(center.x, center.y);
  await expect(page.locator(".context-panel-title")).toHaveText("Стул");
  return { left: left.x, right: right.x, top: top.y, bottom: bottom.y, center };
}

function trackBrowserErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function attachScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

test.describe("M8.2 direct manipulation correction acceptance", () => {
  test("selected room plus furniture moves rigidly when drag starts on a selected furniture body", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRoom(page);
    const first = await placeChair(page, 0.62, 0.43);
    const second = await placeChair(page, 0.72, 0.52);
    const roomPoint = await canvasPoint(page, 0.78, 0.62);
    await selectRoomAndObjects(page, roomPoint, [first, second]);
    await expectRoomFurnitureSelection(page, 2);

    await setSnapping(page, false);
    const firstTarget = await canvasPoint(page, 0.38, 0.43);
    await drag(page, first, firstTarget);
    await expect(page.locator(".topology-alert")).toHaveCount(0);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 3");
    await expectRoomFurnitureSelection(page, 2);

    await clearSelection(page);
    await page.mouse.click(firstTarget.x, firstTarget.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await clearSelection(page);
    const secondTarget = await canvasPoint(page, 0.48, 0.52);
    await page.mouse.click(secondTarget.x, secondTarget.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await clearSelection(page);
    const roomTarget = await canvasPoint(page, 0.54, 0.62);
    await page.mouse.click(roomTarget.x, roomTarget.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
  });

  test("equivalent composite drag from free room interior remains one Undo Redo operation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "webkit", "WebKit covers the product-owner regression from selected furniture body; Chromium covers equivalent free-interior history.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRoom(page);
    const first = await placeChair(page, 0.62, 0.43);
    const second = await placeChair(page, 0.72, 0.52);
    const roomPoint = await canvasPoint(page, 0.78, 0.62);
    await selectRoomAndObjects(page, roomPoint, [first, second]);
    await expectRoomFurnitureSelection(page, 2);
    await setSnapping(page, false);

    const roomTarget = await canvasPoint(page, 0.54, 0.62);
    await drag(page, roomPoint, roomTarget);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 3");
    await expectRoomFurnitureSelection(page, 2);

    await page.getByRole("button", { name: "Отменить" }).click();
    await clearSelection(page);
    await page.mouse.click(first.x, first.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await clearSelection(page);
    await page.mouse.click(roomPoint.x, roomPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    await page.getByRole("button", { name: "Повторить" }).click();
    await clearSelection(page);
    const firstTarget = await canvasPoint(page, 0.38, 0.43);
    const secondTarget = await canvasPoint(page, 0.48, 0.52);
    await page.mouse.click(firstTarget.x, firstTarget.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await clearSelection(page);
    await page.mouse.click(secondTarget.x, secondTarget.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
  });

  test("unselected furniture keeps ordinary drag priority and single-object Transformer handles remain usable", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRoom(page);
    const chair = await placeChair(page, 0.685, 0.48);
    const roomPoint = await canvasPoint(page, 0.60, 0.61);
    await page.mouse.click(roomPoint.x, roomPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    const movedChair = await canvasPoint(page, 0.74, 0.48);
    await drag(page, chair, movedChair);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await clearSelection(page);
    await page.mouse.click(roomPoint.x, roomPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    if (testInfo.project.name === "webkit") return;

    await clearSelection(page);
    await page.mouse.click(movedChair.x, movedChair.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await expect(page.locator("#object-width")).toHaveValue("500");
    await expect(page.locator("#object-depth")).toHaveValue("500");
    await expect(page.locator("#object-rotation")).toHaveValue("0");

    const bounds = await renderedObjectBounds(page, movedChair);
    const rotateHandle = { x: bounds.center.x, y: bounds.top - 24 };
    const rotateTarget = { x: bounds.center.x + 48, y: bounds.center.y - 48 };
    await drag(page, rotateHandle, rotateTarget, { steps: 12 });

    await clearSelection(page);
    await page.mouse.click(bounds.center.x, bounds.center.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await expect.poll(async () => Number(await page.locator("#object-rotation").inputValue())).not.toBe(0);

    await page.getByRole("button", { name: "Отменить" }).click();
    await clearSelection(page);
    await page.mouse.click(bounds.center.x, bounds.center.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await expect(page.locator("#object-rotation")).toHaveValue("0");

    const resetBounds = await renderedObjectBounds(page, bounds.center);
    const resizeHandle = { x: resetBounds.right, y: resetBounds.bottom };
    await drag(page, resizeHandle, { x: resizeHandle.x + 24, y: resizeHandle.y + 18 }, { steps: 10 });
    await clearSelection(page);
    await page.mouse.click(resetBounds.center.x, resetBounds.center.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await expect.poll(async () => ({
      width: Number(await page.locator("#object-width").inputValue()),
      depth: Number(await page.locator("#object-depth").inputValue()),
    })).not.toEqual({ width: 500, depth: 500 });
  });

  test("door stays hosted on its wall, clamps to the span and Undo Redo restores one move", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const wall = await drawIsolatedWall(page);
    await placeOpening(page, "door", wall, 0.38);
    await expectOpeningCount(page, 1);
    const initialOffset = await openingOffset(page);
    const width = await openingWidth(page);
    const doorHandle = renderedOpeningHandle(wall, "door", initialOffset, width);

    const movedDoor = pointAlong(wall.start, wall.end, 0.56);
    await drag(page, doorHandle, movedDoor);
    await expect(page.locator(".context-panel-title")).toHaveText("Дверь");
    const movedOffset = await openingOffset(page);
    expect(movedOffset).not.toBe(initialOffset);
    expect(movedOffset).toBeGreaterThanOrEqual(0);
    expect(movedOffset).toBeLessThanOrEqual(wall.lengthMm - width + 0.001);

    await page.getByRole("button", { name: "Отменить" }).click();
    await expect.poll(() => openingOffset(page)).toBe(initialOffset);
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect.poll(() => openingOffset(page)).toBe(movedOffset);

    const movedDoorHandle = renderedOpeningHandle(wall, "door", movedOffset, width);
    const beyondEnd = { x: wall.end.x + 320, y: wall.end.y };
    await drag(page, movedDoorHandle, beyondEnd, { steps: 14 });
    await expect(page.locator(".context-panel-title")).toHaveText("Дверь");
    await expectOpeningCount(page, 1);
    const clampedOffset = await openingOffset(page);
    expect(clampedOffset).toBeGreaterThanOrEqual(0);
    expect(clampedOffset).toBeLessThanOrEqual(wall.lengthMm - width + 0.001);
  });

  test("overlapping hosted openings reject visibly and commit no collision", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const wall = await drawIsolatedWall(page, [0.16, 0.36], [0.84, 0.36]);
    const first = await placeOpening(page, "door", wall, 0.32);
    const initialOffset = await openingOffset(page);
    const firstWidth = await openingWidth(page);
    const firstHandle = renderedOpeningHandle(wall, "door", initialOffset, firstWidth);
    await clearSelection(page);
    const second = await placeOpening(page, "door", wall, 0.70);
    await expectOpeningCount(page, 2);

    await clearSelection(page);
    await page.mouse.click(first.x, first.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Дверь");
    await page.mouse.move(firstHandle.x, firstHandle.y);
    await page.mouse.down();
    await page.mouse.move(second.x, second.y, { steps: 14 });
    await expect(page.locator(".topology-alert")).toBeVisible();
    await expect(page.locator(".topology-alert")).toContainText(/недопустимо|проём|пересеч|конфликт/i);
    await page.mouse.up();

    await expectOpeningCount(page, 2);
    await expect(page.locator(".context-panel-title")).toHaveText("Дверь");
    await expect.poll(() => openingOffset(page)).toBe(initialOffset);
  });

  test("window uses the same current-host-wall drag primitive", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "webkit", "WebKit minimum covers the door host-wall primitive; Chromium additionally proves the representative window path.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const wall = await drawIsolatedWall(page);
    await placeOpening(page, "window", wall, 0.34);
    const initialOffset = await openingOffset(page);
    const width = await openingWidth(page);
    const windowHandle = renderedOpeningHandle(wall, "window", initialOffset, width);
    const target = pointAlong(wall.start, wall.end, 0.57);

    await drag(page, windowHandle, target);
    await expect(page.locator(".context-panel-title")).toHaveText("Окно");
    const movedOffset = await openingOffset(page);
    expect(movedOffset).not.toBe(initialOffset);
    expect(movedOffset).toBeGreaterThanOrEqual(0);
    expect(movedOffset).toBeLessThanOrEqual(wall.lengthMm - width + 0.001);
  });

  test("compact room with a long name renders without browser errors and records visual evidence", async ({ page }, testInfo) => {
    const browserErrors = trackBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const room = await drawRoom(page);
    const roomPoint = await stagePoint(page, room.interior);
    await page.mouse.click(roomPoint.x, roomPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    const longName = "Очень длинное название компактной комнаты для проверки безопасного отображения";
    const nameInput = page.getByLabel("Название комнаты");
    await nameInput.fill(longName);
    await page.getByRole("button", { name: "Сохранить название", exact: true }).click();
    await expect(page.locator(".context-panel-title")).toHaveText(longName);
    await expect(page.locator(".topology-alert")).toHaveCount(0);
    await attachScreenshot(page, testInfo, "m8.2-compact-long-room-label");
    expect(browserErrors).toEqual([]);
  });
});
