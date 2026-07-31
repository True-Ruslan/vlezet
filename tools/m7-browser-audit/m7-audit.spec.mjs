import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const auditRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(auditRoot, "artifacts");
const records = [];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function referencePng(width = 120, height = 90) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3, 255);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      if (x === 15 || x === width - 16 || y === 15 || y === height - 16) {
        const offset = 1 + x * 3;
        row[offset] = 44;
        row[offset + 1] = 62;
        row[offset + 2] = 80;
      }
    }
    rows.push(row);
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

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
        text: element.textContent?.trim() ?? "",
      };
    };
    return {
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
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
      contextFrame: elementMetrics(".context-panel-frame"),
      contextEyebrow: elementMetrics(".context-panel-eyebrow"),
      contextTitle: elementMetrics(".context-panel-title"),
      contextSubtitle: elementMetrics(".context-panel-subtitle"),
      contextPhase: elementMetrics(".context-panel-phase"),
      contextNavigation: elementMetrics(".context-panel-navigation"),
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

async function clickCanvasPoint(page, point) {
  const canvas = page.locator(".canvas-shell");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box.");
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

async function moveAndClickCanvasPoint(page, point) {
  const canvas = page.locator(".canvas-shell");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no visible bounding box.");
  await page.mouse.move(box.x + point.x, box.y + point.y);
  await page.waitForTimeout(100);
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

const points = {
  topLeft: { x: 170, y: 150 },
  topRight: { x: 610, y: 150 },
  bottomRight: { x: 610, y: 500 },
  bottomLeft: { x: 170, y: 500 },
  centre: { x: 390, y: 325 },
  roomSelection: { x: 215, y: 445 },
  topWall: { x: 390, y: 150 },
};

async function createRoom(page) {
  await page.getByRole("button", { name: "Стена" }).click();
  await clickCanvasPoint(page, points.topLeft);
  await clickCanvasPoint(page, points.topRight);
  await clickCanvasPoint(page, points.bottomRight);
  await clickCanvasPoint(page, points.bottomLeft);
  await clickCanvasPoint(page, points.topLeft);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Выбор" }).click();
  await clickCanvasPoint(page, points.roomSelection);
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
}

async function placeSofa(page) {
  await page.getByRole("button", { name: /Диван/ }).first().click();
  await moveAndClickCanvasPoint(page, points.centre);
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Предмет");
  await expect(page.locator(".context-panel-title")).toHaveText("Диван");
}

async function selectRoom(page) {
  await page.getByRole("button", { name: "Выбор" }).click();
  await clickCanvasPoint(page, points.roomSelection);
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
}

async function installReference(page) {
  const input = page.locator('input[type="file"][aria-label="Загрузить план квартиры"]');
  await input.setInputFiles({ name: "audit-plan.png", mimeType: "image/png", buffer: referencePng() });
  await expect(page.locator(".context-panel-title")).toHaveText("Калибровка масштаба");
  const stage = page.locator(".calibration-stage");
  await expect(stage).toBeVisible();
  const box = await stage.boundingBox();
  if (!box) throw new Error("Calibration stage has no bounding box.");
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.getByLabel("Реальная длина").fill("3000");
  await page.getByRole("button", { name: "Сохранить и открыть план" }).click();
  await expect(page.locator(".context-panel-title")).toHaveText("Подложка настроена");
}

test.describe.serial("M7.2 context inspector browser acceptance", () => {
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
      milestone: "M7.2 Context Inspector Foundation",
      browser: "Chromium via Playwright",
      note: "Tests semantic context identity, bounded workflow return, compact presentation-only close, stale-target failure, Undo copy and reference removal confirmation.",
      records,
      observations,
    }, null, 2)}\n`, "utf8");
  });

  test("keeps the shell and empty context reachable at required effective widths", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
    await capture(page, "01-dashboard-1440x900", { surface: "dashboard" });
    await page.getByRole("button", { name: "Новый проект" }).click();

    const states = [
      { width: 1920, height: 1080, name: "02-editor-1920x1080", compact: false },
      { width: 1440, height: 900, name: "03-editor-1440x900", compact: false },
      { width: 1280, height: 800, name: "04-editor-1280x800", compact: false },
      { width: 1152, height: 720, name: "05-editor-effective-125", compact: false },
      { width: 960, height: 600, name: "06-editor-effective-150", compact: true },
      { width: 720, height: 450, name: "07-editor-effective-200", compact: true },
    ];
    for (const state of states) {
      await page.setViewportSize({ width: state.width, height: state.height });
      const metrics = await capture(page, state.name, { surface: "blank editor" });
      expectStableShell(metrics, state.name);
      if (state.compact) expect(metrics.contextTrigger.visible, `${state.name}: context trigger`).toBe(true);
    }

    await page.setViewportSize({ width: 960, height: 600 });
    await page.locator(".editor-context-trigger").click();
    await expect(page.locator(".context-panel-title")).toHaveText("Ничего не выбрано");
    await capture(page, "08-empty-context-sheet-960x600", { surface: "empty context" });
    await page.locator("#editor-context-surface").getByRole("button", { name: "Закрыть панель" }).click();
    await expect(page.locator("#editor-context-surface")).toBeHidden();
  });

  test("uses one entity anatomy, undoable danger actions and room planning return", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await createRoom(page);
    await expect(page.locator(".context-panel-title")).toContainText("Комната");
    await expect(page.locator(".context-panel-subtitle")).toContainText("м²");
    await capture(page, "09-room-context-1440x900", { surface: "room" });

    await page.getByRole("button", { name: "Дверь" }).click();
    await moveAndClickCanvasPoint(page, points.topWall);
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Дверь");
    await expect(page.locator(".context-panel-danger-description")).toContainText("Можно отменить через «Отменить»");
    await capture(page, "10-opening-context-1440x900", { surface: "door" });
    await page.getByRole("button", { name: "Удалить дверь" }).click();
    await expect(page.locator('.editor-history-button[aria-label="Отменить"]')).toBeEnabled();
    await page.locator('.editor-history-button[aria-label="Отменить"]').click();

    await placeSofa(page);
    await expect(page.locator(".context-panel-danger-description")).toContainText("Можно отменить через «Отменить»");
    await capture(page, "11-object-context-1440x900", { surface: "object" });
    await page.getByRole("button", { name: "Удалить предмет" }).click();
    await expect(page.locator('.editor-history-button[aria-label="Отменить"]')).toBeEnabled();
    await page.locator('.editor-history-button[aria-label="Отменить"]').click();

    await selectRoom(page);
    const roomTitle = await page.locator(".context-panel-title").innerText();
    await page.getByRole("button", { name: "Варианты расстановки" }).click();
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Варианты расстановки");
    await expect(page.locator(".context-panel-phase")).toHaveText("Настройка пожеланий и ограничений");
    await expect(page.locator(".context-panel-navigation")).toHaveAccessibleName(`К комнате «${roomTitle}»`);
    await capture(page, "12-planning-workflow-1440x900", { surface: "planning" });
    await page.locator(".context-panel-navigation").click();
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Комната");
    await expect(page.locator(".context-panel-title")).toHaveText(roomTitle);
  });

  test("preserves object context across reference and recognition workflows and compact hiding", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await createRoom(page);
    await placeSofa(page);

    await page.setViewportSize({ width: 960, height: 600 });
    const contextSurface = page.locator("#editor-context-surface");
    await expect(contextSurface).toBeVisible();
    await contextSurface.getByLabel("Название").fill("Черновик дивана");
    await contextSurface.getByRole("button", { name: "Закрыть панель" }).click();
    await expect(contextSurface).toBeHidden();
    await page.locator(".editor-context-trigger").click();
    await expect(contextSurface.getByLabel("Название")).toHaveValue("Черновик дивана");

    await page.getByRole("button", { name: "Подложка" }).click();
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Подложка");
    await expect(page.locator(".context-panel-navigation")).toHaveAccessibleName("К предмету «Диван»");
    await contextSurface.getByRole("button", { name: "Закрыть панель" }).click();
    await expect(contextSurface).toBeHidden();
    await page.locator(".editor-context-trigger").click();
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Подложка");

    await installReference(page);
    await page.getByRole("button", { name: "Распознать" }).click();
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Распознавание");
    await expect(page.locator(".context-panel-navigation")).toHaveAccessibleName("К предмету «Диван»");
    await capture(page, "13-recognition-return-target-960x600", { surface: "recognition" });
    await page.locator(".context-panel-navigation").click();
    await expect(page.locator(".context-panel-eyebrow")).toHaveText("Предмет");
    await expect(page.locator(".context-panel-title")).toHaveText("Диван");
  });

  test("fails stale return targets closed and exposes reference removal consequences", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
    await createRoom(page);
    await placeSofa(page);

    await page.getByRole("button", { name: "Подложка" }).click();
    await expect(page.locator(".context-panel-navigation")).toHaveAccessibleName("К предмету «Диван»");
    await page.keyboard.press("Delete");
    await page.locator(".context-panel-navigation").click();
    await expect(page.locator(".context-panel-title")).toHaveText("Ничего не выбрано");
    await page.locator('.editor-history-button[aria-label="Отменить"]').click();

    await page.getByRole("button", { name: "Подложка" }).click();
    await installReference(page);
    await expect(page.locator(".context-panel-danger-description")).toContainText("Стены, проёмы и мебель останутся");
    await page.getByRole("button", { name: "Удалить подложку" }).click();
    await expect(page.getByText("Стены, проёмы и мебель останутся. Удалить только исходный план?", { exact: true })).toBeVisible();
    await capture(page, "14-reference-remove-confirmation-1440x900", { surface: "reference danger confirmation" });
    await page.getByRole("button", { name: "Отмена" }).click();

    await page.getByRole("button", { name: "3D" }).click();
    await expect(page.getByLabel("Трёхмерный вид квартиры")).toBeVisible();
    await expect(page.locator("#editor-context-surface")).toHaveCount(0);
    const spatial = await capture(page, "15-spatial-view-1440x900", { surface: "3D" });
    expect(spatial.document.horizontalOverflow).toBe(false);
    await page.getByRole("button", { name: "2D" }).click();
  });
});
