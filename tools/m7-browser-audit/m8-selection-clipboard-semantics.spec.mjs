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

async function clickRatio(page, xRatio, yRatio, options = {}) {
  const point = await canvasPoint(page, xRatio, yRatio);
  await page.mouse.click(point.x, point.y, options);
  return point;
}

async function moveRatio(page, xRatio, yRatio) {
  const point = await canvasPoint(page, xRatio, yRatio);
  await page.mouse.move(point.x, point.y);
  return point;
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

async function drawRectangle(page, bounds = { left: 0.55, top: 0.28, right: 0.82, bottom: 0.68 }) {
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await clickRatio(page, bounds.left, bounds.top);
  await clickRatio(page, bounds.right, bounds.top);
  await clickRatio(page, bounds.right, bounds.bottom);
  await clickRatio(page, bounds.left, bounds.bottom);
  await clickRatio(page, bounds.left, bounds.top);
  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  await finishFirstRoomGuide(page);
}

async function drawConcaveAndSmallRoom(page) {
  const bounds = { left: 0.24, top: 0.22, right: 0.78, bottom: 0.72 };
  const splitX = 0.60;
  const splitY = 0.47;

  // Build the large room as a closed L. The cut-out corners are authoritative
  // endpoints from the start, so the adjacent room can close endpoint-to-endpoint.
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await clickRatio(page, bounds.left, bounds.top);
  await clickRatio(page, bounds.right, bounds.top);
  await clickRatio(page, bounds.right, splitY);
  await clickRatio(page, splitX, splitY);
  await clickRatio(page, splitX, bounds.bottom);
  await clickRatio(page, bounds.left, bounds.bottom);
  await clickRatio(page, bounds.left, bounds.top);
  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  await finishFirstRoomGuide(page);

  // The small room needs only the two missing outer edges; the other two sides
  // are the existing concave boundary. No T-junction or wall-axis intersection.
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await clickRatio(page, bounds.right, splitY);
  await clickRatio(page, bounds.right, bounds.bottom);
  await clickRatio(page, splitX, bounds.bottom);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Выбор", exact: true }).click();
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
  await expect(page.locator(".topology-alert")).toHaveCount(0);
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
  const point = await moveRatio(page, xRatio, yRatio);
  await expect(page.locator(".placement-fit-label")).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".context-panel-title")).toHaveText("Стул");
  return point;
}

async function editorFactsText(page) {
  const details = page.locator("details.editor-actions-menu");
  const wasOpen = await details.evaluate((element) => element.open);
  if (!wasOpen) await details.locator("summary").click();
  const text = await details.locator(".editor-actions-facts").innerText();
  if (!wasOpen) await details.locator("summary").click();
  return text;
}

async function editorCounts(page) {
  const text = await editorFactsText(page);
  const walls = Number(text.match(/(\d+)\s+стен/)?.[1] ?? 0);
  const objects = Number(text.match(/(\d+)\s+предмет/)?.[1] ?? 0);
  return { walls, objects };
}

async function expectCounts(page, expected) {
  await expect.poll(() => editorCounts(page)).toEqual(expected);
}

async function selectRoomAndObjects(page, roomPoint, objectPoints) {
  await page.mouse.click(roomPoint.x, roomPoint.y);
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
  await page.keyboard.down("Shift");
  for (const point of objectPoints) {
    await page.mouse.click(point.x, point.y);
  }
  await page.keyboard.up("Shift");
}

test.describe("M8.2 precise selection and clipboard acceptance", () => {
  test("targets the small room inside a concave cut-out and exposes room hover before click", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawConcaveAndSmallRoom(page);

    const smallRoom = await canvasPoint(page, 0.69, 0.59);
    const largeRoom = await canvasPoint(page, 0.42, 0.40);

    await page.mouse.move(smallRoom.x, smallRoom.y);
    await expect(page.locator(".canvas-shell")).toHaveClass(/is-hovering-selectable/);
    await expect(page.locator(".canvas-mode-instruction")).toHaveText("Кликните, чтобы выбрать объект.");

    await page.mouse.click(smallRoom.x, smallRoom.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
    const smallSubtitle = await page.locator(".context-panel-subtitle").innerText();

    await page.mouse.click(largeRoom.x, largeRoom.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
    const largeSubtitle = await page.locator(".context-panel-subtitle").innerText();
    expect(largeSubtitle).not.toBe(smallSubtitle);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.mouse.click(smallRoom.x, smallRoom.y);
      await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
      await expect(page.locator(".context-panel-subtitle")).toHaveText(smallSubtitle);
    }
  });

  test("pastes two explicitly selected furniture objects around the latest Canvas pointer with one Undo Redo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);

    const first = await placeChair(page, 0.62, 0.47);
    const second = await placeChair(page, 0.72, 0.47);
    await page.keyboard.down("Shift");
    await page.mouse.click(first.x, first.y);
    await page.keyboard.up("Shift");
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");

    await page.keyboard.press("Control+C");
    const target = await moveRatio(page, 0.34, 0.54);
    await page.keyboard.press("Control+V");
    await expectCounts(page, { walls: 4, objects: 4 });
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");

    const expectedLeftCopy = await canvasPoint(page, 0.29, 0.54);
    const expectedRightCopy = await canvasPoint(page, 0.39, 0.54);
    for (const point of [expectedLeftCopy, expectedRightCopy]) {
      await page.mouse.click(point.x, point.y);
      await expect(page.locator(".context-panel-title")).toHaveText("Стул");
    }
    await page.mouse.move(target.x, target.y);

    await page.getByRole("button", { name: "Отменить" }).click();
    await expectCounts(page, { walls: 4, objects: 2 });
    await page.getByRole("button", { name: "Повторить" }).click();
    await expectCounts(page, { walls: 4, objects: 4 });
  });

  test("copies a room plus only two explicitly selected furniture objects and keeps the third out", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);

    const first = await placeChair(page, 0.60, 0.43);
    const second = await placeChair(page, 0.68, 0.52);
    await placeChair(page, 0.76, 0.43);
    await expectCounts(page, { walls: 4, objects: 3 });

    const roomPoint = await canvasPoint(page, 0.57, 0.62);
    await selectRoomAndObjects(page, roomPoint, [first, second]);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 3");
    const sourceSummary = page.locator(".multi-selection-summary");
    await expect(sourceSummary).toContainText("Комнаты: 1");
    await expect(sourceSummary).toContainText("Предметы: 2");

    await page.keyboard.press("Control+C");
    await moveRatio(page, 0.28, 0.48);
    await page.keyboard.press("Control+V");
    await expectCounts(page, { walls: 8, objects: 5 });
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 6");
    const pastedSummary = page.locator(".multi-selection-summary");
    await expect(pastedSummary).toContainText("Стены: 4");
    await expect(pastedSummary).toContainText("Предметы: 2");

    await page.getByRole("button", { name: "Отменить" }).click();
    await expectCounts(page, { walls: 4, objects: 3 });
    await page.getByRole("button", { name: "Повторить" }).click();
    await expectCounts(page, { walls: 8, objects: 5 });
  });

  test("clears stale clipboard and reports why an explicit room plus wall Copy is rejected", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);

    const wallPoint = await canvasPoint(page, 0.66, 0.28);
    const roomPoint = await canvasPoint(page, 0.66, 0.48);
    await page.mouse.click(wallPoint.x, wallPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Стена");
    await page.keyboard.press("Control+C");

    await page.mouse.click(roomPoint.x, roomPoint.y);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
    await page.keyboard.down("Shift");
    await page.mouse.click(wallPoint.x, wallPoint.y);
    await page.keyboard.up("Shift");
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");
    await expect(page.locator(".multi-selection-summary")).toContainText("Комнаты: 1");
    await expect(page.locator(".multi-selection-summary")).toContainText("Стены: 1");

    await page.keyboard.press("Control+C");
    const notice = page.getByRole("status").filter({ hasText: "Копирование недоступно" });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/нельзя|безопасн|копир/i);

    const beforePaste = await editorCounts(page);
    await page.keyboard.press("Control+V");
    await page.waitForTimeout(150);
    expect(await editorCounts(page)).toEqual(beforePaste);
  });

  test("keeps composite structural fallback all-or-nothing when Paste targets occupied structure", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);
    const chair = await placeChair(page, 0.66, 0.48);

    const roomPoint = await canvasPoint(page, 0.57, 0.62);
    await selectRoomAndObjects(page, roomPoint, [chair]);
    await expect(page.locator(".context-panel-title")).toHaveText("Выбрано: 2");
    await page.keyboard.press("Control+C");

    const occupiedTarget = await moveRatio(page, 0.66, 0.48);
    await page.keyboard.press("Control+V");
    await page.waitForTimeout(200);

    const after = await editorCounts(page);
    const pastedTogether = after.walls === 8 && after.objects === 2;
    const rejectedTogether = after.walls === 4 && after.objects === 1;
    expect(pastedTogether || rejectedTogether).toBe(true);

    if (pastedTogether) {
      await page.getByRole("button", { name: "Отменить" }).click();
      await expectCounts(page, { walls: 4, objects: 1 });
      await page.getByRole("button", { name: "Повторить" }).click();
      await expectCounts(page, { walls: 8, objects: 2 });
    }

    await page.mouse.move(occupiedTarget.x, occupiedTarget.y);
  });
});
