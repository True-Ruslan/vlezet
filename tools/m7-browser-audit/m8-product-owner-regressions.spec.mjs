import { expect, test } from "@playwright/test";

const browserErrorsByPage = new WeakMap();

function trackBrowserErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.beforeEach(async ({ page }) => {
  browserErrorsByPage.set(page, trackBrowserErrors(page));
});

test.afterEach(async ({ page }) => {
  expect(browserErrorsByPage.get(page) ?? []).toEqual([]);
});

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

async function clickStageOffset(page, offset) {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + offset.x, box.y + offset.y);
}

function pointAlong(start, end, ratio = 0.5) {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

async function drag(page, start, end, steps = 12) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps });
  await page.mouse.up();
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

async function setSnapping(page, enabled) {
  const button = page.getByRole("button", { name: "Привязки", exact: true });
  await expect(button).toBeVisible();
  const current = await button.getAttribute("aria-pressed");
  if ((current === "true") !== enabled) await button.click();
  await expect(button).toHaveAttribute("aria-pressed", enabled ? "true" : "false");
}

async function drawRoom(page) {
  const box = await canvasBox(page);
  const geometry = { left: 0.55, right: 0.82, top: 0.28, bottom: 0.68 };
  const point = (xRatio, yRatio) => ({ x: box.width * xRatio, y: box.height * yRatio });
  const a = point(geometry.left, geometry.top);
  const b = point(geometry.right, geometry.top);
  const c = point(geometry.right, geometry.bottom);
  const d = point(geometry.left, geometry.bottom);

  await page.getByRole("button", { name: "Стена", exact: true }).click();
  for (const offset of [a, b, c, d, a]) await clickStageOffset(page, offset);
  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  await finishFirstRoomGuide(page);
  await expect(page.locator(".topology-alert")).toHaveCount(0);
  return geometry;
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

async function clearSelection(page) {
  await page.keyboard.press("Escape");
}

async function expectRoomFurnitureSelection(page, furnitureCount) {
  await expect(page.locator(".context-panel-title")).toHaveText(`Выбрано: ${furnitureCount + 1}`);
  await expect(page.locator(".multi-selection-summary")).toContainText("Комнаты: 1");
  await expect(page.locator(".multi-selection-summary")).toContainText(`Предметы: ${furnitureCount}`);
  await expect(page.locator(".multi-selection-summary")).not.toContainText(/Стены:\s*[1-9]/);
  await expect(page.locator(".multi-selection-summary")).not.toContainText(/Проёмы:\s*[1-9]/);
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
  const thicknessInput = page.locator("#wall-thickness");
  await expect(thicknessInput).toBeVisible();
  const thicknessMm = Number((await thicknessInput.inputValue()).replace(",", "."));
  expect(lengthMm).toBeGreaterThan(0);
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
  return point;
}

async function openingOffset(page) {
  const input = page.locator("#opening-offset");
  await expect(input).toBeVisible();
  return Number((await input.inputValue()).replace(",", "."));
}

async function openingWidth(page) {
  const input = page.locator("#opening-width");
  await expect(input).toBeVisible();
  return Number((await input.inputValue()).replace(",", "."));
}

function wallScreenBasis(wall) {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const lengthPx = Math.hypot(dx, dy);
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

test.describe("M8.2 product-owner direct manipulation regressions", () => {
  test("marquee encloses one room and furniture as one movable semantic composite without modifiers", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRoom(page);
    const first = await placeChair(page, 0.62, 0.43);
    const second = await placeChair(page, 0.72, 0.52);
    await enterSelectMode(page);

    const marqueeStart = await canvasPoint(page, 0.52, 0.24);
    const marqueeEnd = await canvasPoint(page, 0.85, 0.72);
    await drag(page, marqueeStart, marqueeEnd, 16);
    await expectRoomFurnitureSelection(page, 2);

    await setSnapping(page, false);
    const firstTarget = await canvasPoint(page, 0.40, 0.43);
    const secondTarget = await canvasPoint(page, 0.50, 0.52);
    const roomTarget = await canvasPoint(page, 0.56, 0.62);
    await drag(page, first, firstTarget, 16);
    await expectRoomFurnitureSelection(page, 2);
    await expect(page.locator(".topology-alert")).toHaveCount(0);

    await clearSelection(page);
    await page.mouse.click(firstTarget.x, firstTarget.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await clearSelection(page);
    await page.mouse.click(secondTarget.x, secondTarget.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await clearSelection(page);
    await page.mouse.click(roomTarget.x, roomTarget.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    await page.getByRole("button", { name: "Отменить" }).click();
    await clearSelection(page);
    await page.mouse.click(first.x, first.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    await clearSelection(page);
    const originalRoomPoint = await canvasPoint(page, 0.78, 0.62);
    await page.mouse.click(originalRoomPoint.x, originalRoomPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");

    await page.getByRole("button", { name: "Повторить" }).click();
    await clearSelection(page);
    await page.mouse.click(firstTarget.x, firstTarget.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Стул");
  });

  test("door supports ordinary select then drag with no runtime or console error", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const wall = await drawIsolatedWall(page);
    await placeOpening(page, "door", wall, 0.38);

    const centerProbe = pointAlong(wall.start, wall.end, 0.38);
    await page.mouse.click(centerProbe.x, centerProbe.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Дверь");
    const initialOffset = await openingOffset(page);
    const width = await openingWidth(page);
    const handle = renderedOpeningHandle(wall, "door", initialOffset, width);
    const target = pointAlong(wall.start, wall.end, 0.56);

    await drag(page, handle, target, 14);
    await expect(page.locator(".context-panel-title")).toHaveText("Дверь");
    await expect.poll(() => openingOffset(page)).not.toBe(initialOffset);
  });

  test("window has a practical hit target and moves from a user-like near-line drag", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    const wall = await drawIsolatedWall(page);
    await placeOpening(page, "window", wall, 0.34);

    const centerProbe = pointAlong(wall.start, wall.end, 0.34);
    await page.mouse.click(centerProbe.x, centerProbe.y);
    await expect(page.locator(".context-panel-title")).toHaveText("Окно");
    const initialOffset = await openingOffset(page);
    const width = await openingWidth(page);
    const exactHandle = renderedOpeningHandle(wall, "window", initialOffset, width);
    const { normal } = wallScreenBasis(wall);
    const userLikeHandle = {
      x: exactHandle.x + normal.x * 4,
      y: exactHandle.y + normal.y * 4,
    };
    const target = pointAlong(wall.start, wall.end, 0.57);

    await drag(page, userLikeHandle, target, 14);
    await expect(page.locator(".context-panel-title")).toHaveText("Окно");
    const movedOffset = await openingOffset(page);
    expect(movedOffset).not.toBe(initialOffset);
    expect(movedOffset).toBeGreaterThanOrEqual(0);
    expect(movedOffset).toBeLessThanOrEqual(wall.lengthMm - width + 0.001);
  });
});
