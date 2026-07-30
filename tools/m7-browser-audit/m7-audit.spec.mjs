import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(auditRoot, "artifacts");
const records = [];

async function capture(page, name, context = {}) {
  await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
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
      };
    };
    const toolbar = document.querySelector(".editor-toolbar");
    const activeTools = [...document.querySelectorAll(".tool-button.is-active")]
      .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
      .filter(Boolean);
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
      toolbar: {
        ...elementMetrics(".editor-toolbar"),
        overflowing: toolbar instanceof HTMLElement ? toolbar.scrollWidth > toolbar.clientWidth : false,
      },
      inspector: elementMetrics(".inspector-panel"),
      catalogue: elementMetrics(".furniture-catalog"),
      canvas: elementMetrics(".canvas-shell"),
      saveStatus: elementMetrics(".save-status"),
      canvasHelp: elementMetrics(".canvas-help"),
      activeTools,
    };
  });

  const screenshot = `${name}.png`;
  await page.screenshot({ path: path.join(artifactsDir, screenshot), fullPage: false });
  records.push({ name, screenshot, context, metrics });
}

async function openNewProject(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.locator(".editor-toolbar")).toBeVisible();
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
  await page.waitForTimeout(120);
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

test.describe.serial("M7 representative browser audit", () => {
  test.beforeAll(async () => {
    await mkdir(artifactsDir, { recursive: true });
  });

  test.afterAll(async () => {
    const observations = records.flatMap((record) => {
      const output = [];
      if (record.metrics.inspector.present && !record.metrics.inspector.visible) {
        output.push({ record: record.name, code: "context-surface-hidden", detail: "The contextual inspector exists but is not reachable in the rendered layout." });
      }
      if (record.metrics.toolbar.overflowing) {
        output.push({ record: record.name, code: "toolbar-overflow", detail: "Toolbar content is wider than its rendered container." });
      }
      if (record.metrics.document.horizontalOverflow) {
        output.push({ record: record.name, code: "document-horizontal-overflow", detail: "The document exceeds the CSS viewport width." });
      }
      if (record.metrics.saveStatus.present && record.metrics.saveStatus.fontSizePx < 12) {
        output.push({ record: record.name, code: "save-status-microtext", detail: `Save status is rendered at ${record.metrics.saveStatus.fontSizePx}px.` });
      }
      if (record.metrics.canvasHelp.present && record.metrics.canvasHelp.fontSizePx < 12) {
        output.push({ record: record.name, code: "canvas-help-microtext", detail: `Canvas help is rendered at ${record.metrics.canvasHelp.fontSizePx}px.` });
      }
      return output;
    });
    await writeFile(path.join(artifactsDir, "audit-report.json"), `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      browser: "Chromium via Playwright",
      note: "960×600 and 720×450 are effective CSS viewport equivalents used to exercise 150% and 200% zoom reachability from a 1440×900 desktop window.",
      records,
      observations,
    }, null, 2)}\n`, "utf8");
  });

  test("captures dashboard and editor shell across desktop and effective zoom widths", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
    await capture(page, "01-dashboard-1440x900", { surface: "dashboard", zoom: "100%" });

    await page.getByRole("button", { name: "Новый проект" }).click();
    await expect(page.locator(".editor-toolbar")).toBeVisible();

    const states = [
      { width: 1920, height: 1080, name: "02-editor-1920x1080", zoom: "100%" },
      { width: 1440, height: 900, name: "03-editor-1440x900", zoom: "100%" },
      { width: 1366, height: 768, name: "04-editor-1366x768", zoom: "100%" },
      { width: 1280, height: 800, name: "05-editor-1280x800", zoom: "100%" },
      { width: 960, height: 600, name: "06-editor-effective-150", zoom: "effective 150%" },
      { width: 720, height: 450, name: "07-editor-effective-200", zoom: "effective 200%" },
    ];
    for (const state of states) {
      await page.setViewportSize({ width: state.width, height: state.height });
      await capture(page, state.name, { surface: "blank editor", zoom: state.zoom });
    }
  });

  test("captures room, furniture, planning, reference, 3D and lifecycle states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);

    const canvas = page.locator(".canvas-shell");
    await page.getByRole("button", { name: /^Стена/ }).click();
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
    await page.getByRole("button", { name: /^Выбор/ }).click();

    await clickCanvasPoint(page, canvas, points.roomSelection);
    await expect(page.locator(".inspector-panel").getByText("Комната", { exact: true })).toBeVisible();
    await capture(page, "08-room-inspector-1440x900", { surface: "selected room" });

    await page.getByRole("button", { name: /Диван/ }).first().click();
    await moveAndClickCanvasPoint(page, canvas, points.centre);
    await expect(page.locator(".object-inspector").getByText("Предмет", { exact: true })).toBeVisible();
    await capture(page, "09-object-inspector-1440x900", { surface: "selected furniture" });

    await page.setViewportSize({ width: 1280, height: 800 });
    await capture(page, "10-object-inspector-1280x800", { surface: "selected furniture", zoom: "100%" });
    await page.setViewportSize({ width: 960, height: 600 });
    await capture(page, "11-object-inspector-effective-150", { surface: "selected furniture", zoom: "effective 150%" });

    await page.setViewportSize({ width: 1440, height: 900 });
    await clickCanvasPoint(page, canvas, points.roomSelection);
    await expect(page.locator(".inspector-panel").getByText("Комната", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Варианты расстановки" }).click();
    await expect(page.locator(".planning-panel")).toBeVisible();
    await capture(page, "12-planning-panel-1440x900", { surface: "planning" });
    await page.locator(".planning-panel").getByRole("button", { name: "Закрыть" }).click();

    await page.getByRole("button", { name: "Подложка" }).click();
    await expect(page.getByLabel("Подложка плана")).toBeVisible();
    await capture(page, "13-reference-panel-1440x900", { surface: "reference workflow" });
    await page.getByLabel("Подложка плана").getByRole("button", { name: "Закрыть панель" }).click();

    await page.getByRole("button", { name: "3D", exact: true }).click();
    await expect(page.getByLabel("Трёхмерный вид квартиры")).toBeVisible();
    await capture(page, "14-spatial-view-1440x900", { surface: "3D" });
    await page.getByRole("button", { name: "2D", exact: true }).click();

    await page.getByLabel("Вернуться к моим проектам").click();
    await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
    await page.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture(page, "15-delete-confirmation-1440x900", { surface: "destructive confirmation" });
  });
});
