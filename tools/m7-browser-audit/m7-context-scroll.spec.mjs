import { expect, test } from "@playwright/test";

async function clickCanvasPoint(page, point) {
  const canvas = page.locator(".canvas-shell");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box.");
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

async function createRoom(page) {
  await page.getByRole("button", { name: "Стена" }).click();
  const points = [
    { x: 170, y: 150 },
    { x: 610, y: 150 },
    { x: 610, y: 500 },
    { x: 170, y: 500 },
    { x: 170, y: 150 },
  ];
  for (const point of points) await clickCanvasPoint(page, point);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Выбор" }).click();
  await clickCanvasPoint(page, { x: 215, y: 445 });
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
}

test("scrolls a long room context to the planning action", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await createRoom(page);

  await page.setViewportSize({ width: 1152, height: 720 });

  const frame = page.locator(".context-panel-frame");
  const body = page.locator(".context-panel-body");
  const planningAction = body.getByRole("button", { name: "Варианты расстановки" });

  await expect(frame).toBeVisible();
  const metrics = await body.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
    initialScrollTop: element.scrollTop,
  }));

  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(["auto", "scroll"]).toContain(metrics.overflowY);
  expect(metrics.initialScrollTop).toBe(0);

  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(planningAction).toBeVisible();
  await planningAction.click();
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Варианты расстановки");
});
