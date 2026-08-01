import { expect, test } from "@playwright/test";

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.locator(".dashboard, .editor-app").first()).toBeVisible();

  if (await page.locator(".editor-app").isVisible()) {
    await page.getByRole("button", { name: "Вернуться к моим проектам" }).click();
  }

  await expect(page.locator(".dashboard")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Мои проекты" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".editor-app")).toBeVisible();
  await expect(page.locator(".konvajs-content canvas").first()).toBeVisible();
}

async function clickCanvasRatio(page, xRatio, yRatio) {
  const stage = page.locator(".konvajs-content").first();
  const box = await stage.boundingBox();
  if (!box) throw new Error("Canvas stage is not visible.");
  await page.mouse.click(
    Math.round(box.x + box.width * xRatio),
    Math.round(box.y + box.height * yRatio),
  );
}

async function documentHasNoHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

test.describe("M7.5 onboarding, status and recovery", () => {
  test("guides the first closed room and retains truthful evidence", async ({ page }, testInfo) => {
    await openNewProject(page);

    const emptyGuide = page.locator('[data-first-project-phase="empty"]');
    await expect(emptyGuide).toBeVisible();
    await expect(emptyGuide.getByText("Первый план", { exact: true })).toBeVisible();
    await emptyGuide.getByRole("button", { name: "Начать со стены" }).click();
    await expect(page.locator('[data-canvas-mode="wall-start"]')).toBeVisible();

    await clickCanvasRatio(page, 0.55, 0.28);
    await clickCanvasRatio(page, 0.82, 0.28);
    const drawingGuide = page.locator('[data-first-project-phase="drawing"]');
    await expect(drawingGuide).toBeVisible();
    await expect(drawingGuide.getByText("Контур ещё не замкнут", { exact: true })).toBeVisible();

    await clickCanvasRatio(page, 0.82, 0.68);
    await clickCanvasRatio(page, 0.55, 0.68);
    await clickCanvasRatio(page, 0.55, 0.28);

    const successEvidence = page.locator('[data-operation-kind="first-room-created"]');
    await expect(successEvidence).toBeVisible();
    await expect(successEvidence.getByText("Первая комната создана", { exact: true })).toBeVisible();
    await expect(page.locator('[data-first-project-phase="room-created"]')).toBeVisible();

    await page.waitForTimeout(3_000);
    await expect(successEvidence).toBeVisible();

    await page.getByRole("button", { name: "Отменить" }).click();
    await expect(successEvidence).toHaveCount(0);
    await expect(page.locator('[data-first-project-phase="drawing"]')).toBeVisible();

    await page.locator('[data-first-project-phase="drawing"]').getByRole("button", { name: "Скрыть" }).click();
    await expect(page.locator("[data-first-project-phase]")).toHaveCount(0);
    await expect(page.getByText("Сохранено локально", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Вернуться к моим проектам" }).click();
    await expect(page.getByRole("heading", { name: "Мои проекты" })).toBeVisible();
    await page.locator(".project-card").first().locator(".project-open").click();
    await expect(page.locator(".editor-app")).toBeVisible();
    await expect(page.locator("[data-first-project-phase]")).toHaveCount(0);

    if (testInfo.project.name !== "webkit") {
      await page.locator(".editor-actions-menu summary").click();
      const downloadPromise = page.waitForEvent("download");
      await page.locator('.editor-actions-popover button:has-text("Vlezet JSON")').click();
      await downloadPromise;

      const backupEvidence = page.locator('[data-operation-kind="project-backup-exported"]');
      await expect(backupEvidence).toBeVisible();
      await expect(backupEvidence.getByText("Резервная копия сохранена", { exact: true })).toBeVisible();
      await page.waitForTimeout(3_000);
      await expect(backupEvidence).toBeVisible();
    }

    await page.setViewportSize({ width: 900, height: 760 });
    await expect.poll(() => documentHasNoHorizontalOverflow(page)).toBe(true);
  });
});
