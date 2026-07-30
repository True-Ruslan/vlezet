import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(auditRoot, "artifacts");
const records = [];

async function capture(page, name, context = {}) {
  await page.waitForTimeout(180);
  const metrics = await page.evaluate(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && !element.hidden && rect.width > 0 && rect.height > 0;
    };
    const elementMetrics = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return { present: false, visible: false };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        present: true,
        visible: visible(element),
        display: style.display,
        fontSizePx: Number.parseFloat(style.fontSize),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowing: element.scrollWidth > element.clientWidth,
      };
    };
    return {
      url: location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      },
      projectBar: elementMetrics(".editor-project-bar"),
      toolBar: elementMetrics(".editor-tool-bar"),
      projectName: elementMetrics(".toolbar-project-name"),
      saveStatus: elementMetrics(".save-status"),
      contextTrigger: elementMetrics(".editor-context-trigger"),
      actionsTrigger: elementMetrics(".editor-project-action"),
      undo: elementMetrics('.editor-history-button[aria-label="Отменить"]'),
      redo: elementMetrics('.editor-history-button[aria-label="Повторить"]'),
      contextSurface: elementMetrics("#editor-context-surface"),
      catalogueSurface: elementMetrics("#editor-catalogue-surface"),
      inspector: elementMetrics(".inspector-panel"),
      catalogue: elementMetrics(".furniture-catalog"),
      canvas: elementMetrics(".canvas-shell"),
      canvasHelp: elementMetrics(".canvas-help"),
      spatial: elementMetrics('[aria-label="Трёхмерный вид квартиры"]'),
      activeTools: [...document.querySelectorAll(".editor-command-button[aria-pressed=true]")]
        .map((element) => element.getAttribute("aria-label"))
        .filter(Boolean),
    };
  });

  const screenshot = `${name}.png`;
  await page.screenshot({ path: path.join(artifactsDir, screenshot), fullPage: false });
  records.push({ name, screenshot, context, metrics });
  return metrics;
}

function expectStableShell(metrics, stateName) {
  expect(metrics.document.horizontalOverflow, `${stateName}: document overflow`).toBe(false);
  expect(metrics.projectBar.visible, `${stateName}: project bar`).toBe(true);
  expect(metrics.projectBar.overflowing, `${stateName}: project bar overflow`).toBe(false);
  expect(metrics.toolBar.visible, `${stateName}: tool bar`).toBe(true);
  expect(metrics.projectName.visible, `${stateName}: project identity`).toBe(true);
  expect(metrics.saveStatus.visible, `${stateName}: save status`).toBe(true);
  expect(metrics.saveStatus.fontSizePx, `${stateName}: save status font`).toBeGreaterThanOrEqual(12);
  expect(metrics.actionsTrigger.visible, `${stateName}: actions`).toBe(true);
  expect(metrics.undo.visible, `${stateName}: Undo`).toBe(true);
  expect(metrics.redo.visible, `${stateName}: Redo`).toBe(true);
  expect(metrics.activeTools, `${stateName}: active selection tool`).toContain("Выбор");
  expect(metrics.activeTools, `${stateName}: active 2D view`).toContain("2D");
}

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".editor-project-bar")).toBeVisible();
  await expect(page.locator(".editor-tool-bar")).toBeVisible();
  await expect(page.locator(".canvas-shell")).toBeVisible();
}

async function clickCanvasPoint(page, canvas, point) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box.");
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

async function moveAndClickCanvasPoint(page, canvas, point) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box.");
  await page.mouse.move(box.x + point.x, box.y + point.y);
  await page.waitForTimeout(100);
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

test.describe.serial("M7.1 editor shell browser acceptance", () => {
  test.beforeAll(async () => {
    await mkdir(artifactsDir, { recursive: true });
  });

  test.afterAll(async () => {
    const observations = records.flatMap((record) => {
      const output = [];
      if (record.metrics.document.horizontalOverflow) output.push({ record: record.name, code: "document-horizontal-overflow" });
      if (record.metrics.projectBar.overflowing) output.push({ record: record.name, code: "project-bar-overflow" });
      if (record.metrics.saveStatus.present && record.metrics.saveStatus.fontSizePx < 12) output.push({ record: record.name, code: "save-status-microtext" });
      if (record.metrics.canvasHelp.present && record.metrics.canvasHelp.fontSizePx < 12) output.push({ record: record.name, code: "canvas-help-follow-up", owner: "M7.3/M7.4" });
      return output;
    });
    await writeFile(path.join(artifactsDir, "audit-report.json"), `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      milestone: "M7.1 Editor Shell and Responsive Context",
      browser: "Chromium via Playwright",
      note: "1152×720, 960×600 and 720×450 exercise effective 125%, 150% and 200% CSS viewport reachability from a 1440×900 reference window.",
      records,
      observations,
    }, null, 2)}\n`, "utf8");
  });

  test("keeps project, tools, history and context entry reachable at every required width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
    await capture(page, "01-dashboard-1440x900", { surface: "dashboard", zoom: "100%" });

    await page.getByRole("button", { name: "Новый проект" }).click();
    await expect(page.locator(".editor-project-bar")).toBeVisible();

    const states = [
      { width: 1920, height: 1080, name: "02-editor-1920x1080", zoom: "100%", compact: false },
      { width: 1440, height: 900, name: "03-editor-1440x900", zoom: "100%", compact: false },
      { width: 1366, height: 768, name: "04-editor-1366x768", zoom: "100%", compact: false },
      { width: 1280, height: 800, name: "05-editor-1280x800", zoom: "100%", compact: false },
      { width: 1152, height: 720, name: "06-editor-effective-125", zoom: "effective 125%", compact: false },
      { width: 960, height: 600, name: "07-editor-effective-150", zoom: "effective 150%", compact: true },
      { width: 720, height: 450, name: "08-editor-effective-200", zoom: "effective 200%", compact: true },
    ];

    for (const state of states) {
      await page.setViewportSize({ width: state.width, height: state.height });
      const metrics = await capture(page, state.name, { surface: "blank editor", zoom: state.zoom });
      expectStableShell(metrics, state.name);
      if (state.compact) expect(metrics.contextTrigger.visible, `${state.name}: context trigger`).toBe(true);
    }

    await page.setViewportSize({ width: 960, height: 600 });
    const contextTrigger = page.locator(".editor-context-trigger");
    await contextTrigger.click();
    await expect(page.locator("#editor-context-surface")).toBeVisible();
    await capture(page, "09-empty-context-sheet-960x600", { surface: "empty context sheet" });
    await page.locator("#editor-context-surface").getByRole("button", { name: "Закрыть панель" }).click();
    await expect(page.locator("#editor-context-surface")).toBeHidden();

    await page.locator(".editor-project-action").click();
    await expect(page.getByRole("button", { name: /Показать весь план/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Vlezet JSON/ })).toBeVisible();
  });

  test("preserves compact form state and all workflow surfaces", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);

    const canvas = page.locator(".canvas-shell");
    await page.getByRole("button", { name: "Стена" }).click();
    const points = {
      topLeft: { x: 170, y: 150 },
      topRight: { x: 610, y: 150 },
      bottomRight: { x: 610, y: 500 },
      bottomLeft: { x: 170, y: 500 },
      centre: { x: 390, y: 325 },
      roomSelection: { x: 215, y: 445 },
    };
    await clickCanvasPoint(page, canvas, points.topLeft);
    await clickCanvasPoint(page, canvas, points.topRight);
    await clickCanvasPoint(page, canvas, points.bottomRight);
    await clickCanvasPoint(page, canvas, points.bottomLeft);
    await clickCanvasPoint(page, canvas, points.topLeft);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Выбор" }).click();

    await clickCanvasPoint(page, canvas, points.roomSelection);
    await expect(page.locator(".inspector-panel").getByText("Комната", { exact: true })).toBeVisible();
    await capture(page, "10-room-inspector-1440x900", { surface: "selected room" });

    await page.getByRole("button", { name: /Диван/ }).first().click();
    await moveAndClickCanvasPoint(page, canvas, points.centre);
    await expect(page.locator(".object-inspector").getByText("Предмет", { exact: true })).toBeVisible();
    await capture(page, "11-object-inspector-1440x900", { surface: "selected furniture" });

    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopObject = await capture(page, "12-object-inspector-1280x800", { surface: "selected furniture", zoom: "100%" });
    expect(desktopObject.document.horizontalOverflow).toBe(false);
    expect(desktopObject.contextSurface.visible).toBe(true);

    await page.setViewportSize({ width: 960, height: 600 });
    const contextSurface = page.locator("#editor-context-surface");
    await expect(contextSurface).toBeVisible();
    const objectName = contextSurface.getByLabel("Название");
    await objectName.fill("Черновик дивана");
    await capture(page, "13-object-context-sheet-960x600", { surface: "selected object context sheet" });
    await contextSurface.getByRole("button", { name: "Закрыть панель" }).click();
    await expect(contextSurface).toBeHidden();
    await page.locator(".editor-context-trigger").click();
    await expect(contextSurface).toBeVisible();
    await expect(contextSurface.getByLabel("Название")).toHaveValue("Черновик дивана");

    await page.getByRole("button", { name: "Мебель" }).click();
    const catalogueSurface = page.locator("#editor-catalogue-surface");
    await expect(catalogueSurface).toBeVisible();
    await expect(page.getByRole("button", { name: "Мебель" })).toHaveAttribute("aria-pressed", "true");
    await capture(page, "14-catalogue-sheet-960x600", { surface: "catalogue sheet" });
    await catalogueSurface.getByRole("button", { name: "Закрыть панель" }).click();
    await expect(catalogueSurface).toBeHidden();
    await expect(page.getByRole("button", { name: "Мебель" })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Мебель" }).click();
    await expect(catalogueSurface).toBeVisible();
    await catalogueSurface.getByRole("button", { name: "Закрыть панель" }).click();

    await page.setViewportSize({ width: 1440, height: 900 });
    await clickCanvasPoint(page, canvas, points.roomSelection);
    await expect(page.locator(".inspector-panel").getByText("Комната", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Варианты расстановки" }).click();
    await expect(page.locator(".planning-panel")).toBeVisible();
    await capture(page, "15-planning-panel-1440x900", { surface: "planning" });
    await page.locator(".planning-panel").getByRole("button", { name: "Закрыть" }).click();

    await page.getByRole("button", { name: "Подложка" }).click();
    await expect(page.getByLabel("Подложка плана")).toBeVisible();
    await capture(page, "16-reference-panel-1440x900", { surface: "reference workflow" });
    await page.getByLabel("Подложка плана").getByRole("button", { name: "Закрыть панель" }).click();

    await page.getByRole("button", { name: "3D" }).click();
    await expect(page.getByLabel("Трёхмерный вид квартиры")).toBeVisible();
    await expect(page.locator("#editor-context-surface")).toHaveCount(0);
    await expect(page.locator("#editor-catalogue-surface")).toHaveCount(0);
    const spatialMetrics = await capture(page, "17-spatial-view-1440x900", { surface: "3D" });
    expect(spatialMetrics.document.horizontalOverflow).toBe(false);
    expect(spatialMetrics.spatial.visible).toBe(true);
    await page.getByRole("button", { name: "2D" }).click();

    await page.getByLabel("Вернуться к моим проектам").click();
    await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
    await page.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture(page, "18-delete-confirmation-1440x900", { surface: "destructive confirmation" });
  });
});
