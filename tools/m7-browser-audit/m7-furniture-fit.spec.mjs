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

async function moveCanvasRatio(page, xRatio, yRatio) {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width * xRatio, box.y + box.height * yRatio);
}

async function drawRectangle(page) {
  await page.getByRole("button", { name: "Стена", exact: true }).click();
  await clickCanvasRatio(page, 0.55, 0.28);
  await clickCanvasRatio(page, 0.82, 0.28);
  await clickCanvasRatio(page, 0.82, 0.68);
  await clickCanvasRatio(page, 0.55, 0.68);
  await clickCanvasRatio(page, 0.55, 0.28);

  await expect(page.locator('[data-operation-kind="first-room-created"]')).toBeVisible();
  const guide = page.locator('[data-first-project-phase="room-created"]');
  await guide.getByRole("button", { name: "Завершить", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-canvas-mode="select"]')).toBeVisible();
}

async function documentHasNoHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

test.describe("M7.7 furniture and fit workflow", () => {
  test("connects catalogue discovery, fit preview, inspector and local recovery", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await drawRectangle(page);

    const search = page.getByRole("searchbox", { name: "Поиск мебели и техники" });
    await expect(search).toBeVisible();
    await search.fill("тв тумба");
    await expect(page.getByRole("button", { name: /ТВ-тумба/ })).toHaveCount(1);
    await expect(page.getByText("Найдено:")).toContainText("1");
    await search.fill("диван");

    await page.getByRole("button", { name: /Диван/ }).click();
    await moveCanvasRatio(page, 0.685, 0.48);
    await expect(page.locator(".placement-fit-label")).toBeVisible();
    await expect(page.locator(".placement-fit-label")).toContainText(/Влезает|Влезает, но тесно|Не влезает/);

    await clickCanvasRatio(page, 0.685, 0.48);
    await expect(page.locator(".context-panel-title")).toHaveText("Диван");
    await expect(page.getByText("Проверка размещения", { exact: true })).toBeVisible();
    await expect(page.getByText("Основные параметры", { exact: true })).toBeVisible();
    await expect(page.getByText("Зоны использования", { exact: true })).toBeVisible();
    await expect(page.getByText("Точное положение", { exact: true })).toBeVisible();

    const legend = page.locator(".object-canvas-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toContainText("Размер предмета");
    await expect(legend).toContainText("Рекомендуемая зона использования");
    await expect(legend).toContainText("Свободно сейчас");

    const initialWidth = await page.locator("#object-width").inputValue();
    await page.locator("#object-width").fill("0");
    await page.getByRole("button", { name: "Применить изменения", exact: true }).click();
    await expect(page.getByText("Введите ширину больше 0 мм", { exact: true })).toBeVisible();
    await expect(page.locator("#object-width")).toHaveValue("0");
    await page.locator("#object-width").fill(initialWidth);

    await page.getByRole("button", { name: "Повернуть 90°", exact: true }).click();
    await expect(page.getByText("Поворот 90°", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    await expect(page.getByText("Поворот 0°", { exact: false })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 760 });
    await expect.poll(() => documentHasNoHorizontalOverflow(page)).toBe(true);
  });
});
