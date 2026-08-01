import { expect, test } from "@playwright/test";

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.locator(".projects-page, .editor-app").first()).toBeVisible();

  if (await page.locator(".editor-app").isVisible()) {
    await page.getByRole("button", { name: "Вернуться к моим проектам" }).click();
  }

  await expect(page.locator(".projects-page")).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".editor-app")).toBeVisible();
  await expect(page.locator(".konvajs-content canvas").first()).toBeVisible();
}

async function canvasBox(page) {
  const stage = page.locator(".konvajs-content").first();
  const box = await stage.boundingBox();
  if (!box) throw new Error("Canvas stage is not visible.");
  return box;
}

async function clickCanvasRatio(page, xRatio, yRatio) {
  const box = await canvasBox(page);
  await page.mouse.click(
    Math.round(box.x + box.width * xRatio),
    Math.round(box.y + box.height * yRatio),
  );
}

async function moveCanvasRatio(page, xRatio, yRatio) {
  const box = await canvasBox(page);
  await page.mouse.move(
    Math.round(box.x + box.width * xRatio),
    Math.round(box.y + box.height * yRatio),
  );
}

async function drawRectangle(page) {
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  // Reuse the accepted M7.5 closed-room path: these points reliably snap the
  // last segment back to the first authoritative vertex in both engines.
  await clickCanvasRatio(page, 0.55, 0.28);
  await clickCanvasRatio(page, 0.82, 0.28);
  await clickCanvasRatio(page, 0.82, 0.68);
  await clickCanvasRatio(page, 0.55, 0.68);
  await clickCanvasRatio(page, 0.55, 0.28);

  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  const guide = page.locator('[data-first-project-phase="room-created"]');
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: "Скрыть", exact: true }).click();

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
}

async function applyAndUndoDimension(page, inputSelector, buttonName, anchorSelector, anchorValue) {
  const input = page.locator(inputSelector);
  const initial = Number(await input.inputValue());
  const next = Math.round(initial + 200);
  await page.locator(anchorSelector).selectOption(anchorValue);
  await input.fill(String(next));
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  await expect(page.locator(inputSelector)).toHaveValue(String(next));
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(page.locator(inputSelector)).toHaveValue(String(Math.round(initial)));
}

async function documentHasNoHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

test.describe("M7.6 geometry and opening inspector", () => {
  test("keeps room, wall and door edits physically predictable", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);

    await clickCanvasRatio(page, 0.685, 0.48);
    await expect(page.getByText("Внутренние размеры", { exact: true })).toBeVisible();
    await expect(page.getByText("По горизонтали", { exact: true })).toBeVisible();
    await expect(page.getByText("По вертикали", { exact: true })).toBeVisible();

    await applyAndUndoDimension(
      page,
      "#room-clear-width",
      "Применить горизонтальный размер",
      "#room-clear-width-anchor",
      "max",
    );
    await applyAndUndoDimension(
      page,
      "#room-clear-height",
      "Применить вертикальный размер",
      "#room-clear-height-anchor",
      "max",
    );

    await clickCanvasRatio(page, 0.685, 0.28);
    await expect(page.getByText("Длина по оси", { exact: true })).toBeVisible();
    await expect(page.locator("#wall-length-anchor")).toContainText("Левый конец");
    await expect(page.locator("#wall-length-anchor")).toContainText("Правый конец");
    await expect(page.locator("#wall-thickness-growth")).toContainText("Внутренняя поверхность");
    await expect(page.locator("#wall-thickness-growth")).toContainText("Наружная поверхность");

    const wallLength = page.locator("#wall-length");
    const initialWallLength = Number(await wallLength.inputValue());
    const changedWallLength = Math.round(initialWallLength + 200);
    await page.locator("#wall-length-anchor").selectOption("visual-end");
    await wallLength.fill(String(changedWallLength));
    await page.getByRole("button", { name: "Применить осевую длину", exact: true }).click();
    await expect(page.locator("#wall-length")).toHaveValue(String(changedWallLength));
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    await expect(page.locator("#wall-length")).toHaveValue(String(Math.round(initialWallLength)));

    const wallThickness = page.locator("#wall-thickness");
    const initialThickness = Number(await wallThickness.inputValue());
    const changedThickness = Math.round(initialThickness + 20);
    await page.locator("#wall-thickness-growth").selectOption("inside");
    await wallThickness.fill(String(changedThickness));
    await page.getByRole("button", { name: "Применить толщину", exact: true }).click();
    await expect(page.locator("#wall-thickness")).toHaveValue(String(changedThickness));
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    await expect(page.locator("#wall-thickness")).toHaveValue(String(Math.round(initialThickness)));

    await page.getByRole("button", { name: "Дверь", exact: true }).click();
    await moveCanvasRatio(page, 0.685, 0.28);
    await expect(page.locator(".canvas-shell")).toHaveAttribute("data-preview-state", "valid");
    await clickCanvasRatio(page, 0.685, 0.28);
    await expect(page.getByText("Размер проёма", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    const reference = page.locator("#opening-offset-reference");
    const offset = page.locator("#opening-offset");
    const initialOffset = await offset.inputValue();
    await reference.selectOption("visual-end");
    await expect(offset).not.toHaveValue(initialOffset);
    await reference.selectOption("visual-start");
    await expect(offset).toHaveValue(initialOffset);

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(4);
    const choiceNames = [
      "Петли слева, открывание вниз",
      "Петли слева, открывание вверх",
      "Петли справа, открывание вниз",
      "Петли справа, открывание вверх",
    ];
    const previewScreens = new Set();
    for (const name of choiceNames) {
      const radio = page.getByRole("radio", { name, exact: true });
      await radio.click();
      await expect(radio).toHaveAttribute("aria-checked", "true");
      await page.waitForTimeout(80);
      previewScreens.add((await page.locator(".canvas-shell").screenshot()).toString("base64"));
    }
    expect(previewScreens.size).toBe(4);

    await page.getByRole("button", { name: "Применить параметры проёма", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Петли справа, открывание вверх", exact: true })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Петли слева, открывание вниз", exact: true })).toHaveAttribute("aria-checked", "true");

    const validWidth = await page.locator("#opening-width").inputValue();
    await page.locator("#opening-width").fill("999999");
    await expect(page.locator(".opening-position-cue")).toBeVisible();
    await page.getByRole("button", { name: "Применить параметры проёма", exact: true }).click();
    await expect(page.getByText("Положение проёма должно быть конечным и находиться в пределах стены.", { exact: true })).toBeVisible();
    await expect(page.getByText("Размер проёма", { exact: true })).toBeVisible();
    await page.locator("#opening-width").fill(validWidth);

    await page.setViewportSize({ width: 390, height: 760 });
    await expect.poll(() => documentHasNoHorizontalOverflow(page)).toBe(true);
    const firstRadioBox = await radios.nth(0).boundingBox();
    const secondRadioBox = await radios.nth(1).boundingBox();
    expect(firstRadioBox).not.toBeNull();
    expect(secondRadioBox).not.toBeNull();
    expect(Math.abs(firstRadioBox.x - secondRadioBox.x)).toBeLessThan(4);
    expect(secondRadioBox.y).toBeGreaterThan(firstRadioBox.y);

    if (testInfo.project.name !== "webkit") {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole("button", { name: "Вернуться к моим проектам" }).click();
      await page.getByRole("button", { name: "Новый проект" }).click();
      await expect(page.locator(".editor-app")).toBeVisible();

      await page.getByRole("button", { name: "Стена", exact: true }).click();
      await clickCanvasRatio(page, 0.72, 0.34);
      await clickCanvasRatio(page, 0.36, 0.34);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await clickCanvasRatio(page, 0.54, 0.34);

      await expect(page.locator("#wall-length-anchor")).toContainText("Левый конец");
      await expect(page.locator("#wall-length-anchor")).toContainText("Правый конец");
      await expect(page.locator("#wall-thickness-face")).toContainText("Верхняя поверхность");
      await expect(page.locator("#wall-thickness-face")).toContainText("Нижняя поверхность");

      await page.getByRole("button", { name: "Дверь", exact: true }).click();
      await moveCanvasRatio(page, 0.54, 0.34);
      await clickCanvasRatio(page, 0.54, 0.34);
      await expect(page.locator("#opening-offset-reference")).toContainText("От левого конца");
      await expect(page.locator("#opening-offset-reference")).toContainText("От правого конца");
      await expect(page.getByRole("radio", { name: "Петли справа, открывание вверх", exact: true })).toBeVisible();
    }
  });
});
