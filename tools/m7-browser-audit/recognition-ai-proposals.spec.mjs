import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { realAnalogueDefinitions } from "../../packages/recognition/benchmarks/real-analogues/source-definitions.mjs";
import { renderRealFixtureSvg } from "../recognition-benchmark/real-fixture-renderer.mjs";

const auditRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(auditRoot, "artifacts");
const fixture = realAnalogueDefinitions.find(({ id }) => id === "real-plan-001-anonymized");
if (!fixture) throw new Error("Public real-plan-001-anonymized fixture is missing.");

const projectId = "browser-ai-proposals-project";
const assetId = "browser-ai-proposals-asset";
const referenceRevision = "browser-ai-proposals-reference-v1";
const now = "2026-08-06T08:00:00.000Z";
const modelId = "recorded/provider-model";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function renderFixturePng(browser) {
  const page = await browser.newPage({
    viewport: { width: fixture.sourceWidthPx + 20, height: fixture.sourceHeightPx + 20 },
    colorScheme: "light",
  });
  try {
    await page.setContent(
      `<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f3f5f8}svg{display:block}</style></head><body>${renderRealFixtureSvg(fixture)}</body></html>`,
      { waitUntil: "load" },
    );
    return await page.locator("svg").screenshot({ animations: "disabled", caret: "hide" });
  } finally {
    await page.close();
  }
}

async function seedProject(page, png) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  const base64 = png.toString("base64");
  await page.evaluate(async (input) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("vlezet", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open Vlezet IndexedDB."));
    });
    try {
      const bytes = Uint8Array.from(atob(input.base64), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/png" });
      const project = {
        storageVersion: 2,
        id: input.projectId,
        name: "Browser AI Proposal Acceptance",
        createdAt: input.now,
        updatedAt: input.now,
        document: {
          schemaVersion: 3,
          vertices: [],
          walls: [],
          openings: [],
          roomAnnotations: [],
          placedObjects: [],
        },
        viewport: { offsetX: 140, offsetY: 140, pixelsPerMillimeter: 0.12 },
        ui: { furnitureCatalogOpen: false, referencePanelOpen: false },
        referencePlan: {
          assetId: input.assetId,
          referenceRevision: input.referenceRevision,
          source: { kind: "image", originalMimeType: "image/png" },
          widthPx: input.widthPx,
          heightPx: input.heightPx,
          transform: {
            originWorld: { x: 0, y: 0 },
            millimetersPerPixel: input.millimetersPerPixel,
            rotationDeg: 0,
          },
          calibration: {
            pointA: { x: 30, y: 30 },
            pointB: { x: 130, y: 30 },
            knownLengthMm: 1000,
            alignment: "horizontal",
          },
          display: { visible: true, opacity: 0.45, locked: true },
        },
      };
      const asset = {
        id: input.assetId,
        projectId: input.projectId,
        kind: "reference-raster",
        mimeType: "image/png",
        byteLength: blob.size,
        createdAt: input.now,
        blob,
      };
      const transaction = database.transaction(["projects", "assets", "settings"], "readwrite");
      transaction.objectStore("projects").put(project);
      transaction.objectStore("assets").put(asset);
      transaction.objectStore("settings").put({ key: "lastProjectId", value: input.projectId });
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Unable to seed Vlezet IndexedDB."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Vlezet IndexedDB seed aborted."));
      });
    } finally {
      database.close();
    }
  }, {
    base64,
    projectId,
    assetId,
    referenceRevision,
    now,
    widthPx: fixture.sourceWidthPx,
    heightPx: fixture.sourceHeightPx,
    millimetersPerPixel: fixture.millimetersPerPixel,
  });
  await page.reload();
  await expect(page.locator(".editor-project-bar")).toBeVisible();
  await expect(page.locator(".canvas-shell")).toBeVisible();
}

async function indexedDbRecord(page, storeName, key, indexName = null) {
  return page.evaluate(async ({ storeName: store, key: recordKey, indexName: index }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("vlezet", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to read Vlezet IndexedDB."));
    });
    try {
      const transaction = database.transaction(store, "readonly");
      const objectStore = transaction.objectStore(store);
      const request = index ? objectStore.index(index).get(recordKey) : objectStore.get(recordKey);
      const result = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error ?? new Error("Unable to read Vlezet record."));
      });
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Vlezet read transaction failed."));
      });
      return result;
    } finally {
      database.close();
    }
  }, { storeName, key, indexName });
}

async function projectSnapshot(page) {
  return indexedDbRecord(page, "projects", projectId);
}

async function sessionSnapshot(page) {
  return indexedDbRecord(page, "recognitionSessions", projectId, "projectId");
}

async function openRecognitionPanel(page) {
  await page.getByRole("button", { name: "Распознать", exact: true }).click();
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Распознавание");
}

async function runLocalRecognition(page) {
  await openRecognitionPanel(page);
  const start = page.getByRole("button", { name: "Распознать план", exact: true });
  if (await start.isVisible()) await start.click();
  await expect(page.locator(".context-panel-phase")).toHaveText("Проверка черновика", { timeout: 150_000 });
  await expect(page.locator('[data-local-candidate-kind="wall"]')).not.toHaveCount(0);
}

function schemaCoordinate(value) {
  return Math.max(0, Math.min(10_000, Math.round(value * 10_000)));
}

function schemaRegion(center, width = 0.12, height = 0.12) {
  const x = Math.max(0, Math.min(1 - width, center.x - width / 2));
  const y = Math.max(0, Math.min(1 - height, center.y - height / 2));
  return {
    x: schemaCoordinate(x),
    y: schemaCoordinate(y),
    width: Math.max(1, schemaCoordinate(width)),
    height: Math.max(1, schemaCoordinate(height)),
  };
}

function angleDelta(first, second) {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function wallGeometry(wall, widthPx, heightPx) {
  const start = { x: wall.start.x * widthPx, y: wall.start.y * heightPx };
  const end = { x: wall.end.x * widthPx, y: wall.end.y * heightPx };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthPx = Math.hypot(dx, dy);
  const normalizedLength = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  return {
    wall,
    start,
    end,
    dx,
    dy,
    lengthPx,
    normalizedLength,
    angleDeg: ((Math.atan2(dy, dx) * 180 / Math.PI) + 180) % 180,
    pixelScalePerNormalizedUnit: lengthPx / normalizedLength,
  };
}

function distanceToWall(point, geometry) {
  if (!(geometry.lengthPx > 0)) return Number.POSITIVE_INFINITY;
  const relativeX = point.x - geometry.start.x;
  const relativeY = point.y - geometry.start.y;
  const projection = Math.max(0, Math.min(1,
    (relativeX * geometry.dx + relativeY * geometry.dy) / (geometry.lengthPx * geometry.lengthPx),
  ));
  const closestX = geometry.start.x + geometry.dx * projection;
  const closestY = geometry.start.y + geometry.dy * projection;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function sourcePoint(opening) {
  return {
    x: 30 + opening.centerMm.x / fixture.millimetersPerPixel,
    y: 30 + opening.centerMm.y / fixture.millimetersPerPixel,
  };
}

function nearestHighConfidenceHost(summary, opening) {
  const point = sourcePoint(opening);
  const candidates = summary.walls
    .filter((wall) => wall.conflict === null && wall.confidence === "high")
    .map((wall) => wallGeometry(wall, fixture.sourceWidthPx, fixture.sourceHeightPx))
    .map((geometry) => ({
      geometry,
      score: distanceToWall(point, geometry) + angleDelta(opening.orientationDeg, geometry.angleDeg) * 8,
    }))
    .sort((first, second) => first.score - second.score || first.geometry.wall.id.localeCompare(second.geometry.wall.id));
  const selected = candidates[0]?.geometry;
  if (!selected) throw new Error(`No high-confidence host wall for ${opening.id}.`);
  return selected;
}

function parseProposalRequest(request) {
  const body = request.postDataJSON();
  const content = body.messages?.[0]?.content;
  const prompt = Array.isArray(content)
    ? content.find((item) => item?.type === "text")?.text
    : null;
  if (typeof prompt !== "string" || !prompt.includes("mode=proposal-discovery-stage1")) {
    throw new Error("Unexpected OpenRouter proposal request body.");
  }
  const line = (prefix) => {
    const value = prompt.split("\n").find((entry) => entry.startsWith(prefix));
    if (!value) throw new Error(`Proposal prompt is missing ${prefix}.`);
    return value.slice(prefix.length);
  };
  return {
    requestId: line("requestId="),
    referenceRevision: line("referenceRevision="),
    localDraftFingerprint: line("localDraftFingerprint="),
    summary: JSON.parse(line("localSummary=")),
  };
}

function recordedProposalBatch(request) {
  const identity = parseProposalRequest(request);
  const proposals = fixture.openings.map((opening) => {
    const host = nearestHighConfidenceHost(identity.summary, opening);
    const point = sourcePoint(opening);
    const center = {
      x: point.x / fixture.sourceWidthPx,
      y: point.y / fixture.sourceHeightPx,
    };
    const widthPx = opening.widthMm / fixture.millimetersPerPixel;
    return {
      id: `recorded-${opening.kind}-${opening.id}`,
      kind: "opening-addition",
      openingKind: opening.kind,
      center: { x: schemaCoordinate(center.x), y: schemaCoordinate(center.y) },
      widthNormalized: Math.max(1, schemaCoordinate(widthPx / host.pixelScalePerNormalizedUnit)),
      orientationDeg: Number(host.angleDeg.toFixed(4)),
      hostWallHintIds: [host.wall.id],
      sourceRegion: schemaRegion(center, 0.14, 0.14),
      modelConfidence: 0.96,
      reasonCodes: opening.kind === "door"
        ? ["visible-gap", "door-leaf"]
        : ["visible-gap", "parallel-window-rails", "window-frame", "exterior-boundary-context"],
    };
  });
  if (proposals.length > 0) {
    proposals.push({
      ...proposals[0],
      id: `${proposals[0].id}-duplicate`,
      modelConfidence: 0.91,
    });
  }
  proposals.push({
    id: "recorded-blocked-unknown-host",
    kind: "opening-addition",
    openingKind: "door",
    center: { x: 9500, y: 9500 },
    widthNormalized: 800,
    orientationDeg: 0,
    hostWallHintIds: ["unknown-host-wall"],
    sourceRegion: { x: 9000, y: 9000, width: 900, height: 900 },
    modelConfidence: 0.7,
    reasonCodes: ["visible-gap", "door-leaf"],
  });

  const clutter = identity.summary.clutterEvidence?.[0];
  if (!clutter) throw new Error("Public fixture did not produce deterministic clutter evidence.");
  const clutterWall = identity.summary.walls.find(({ id }) => id === clutter.wallCandidateId);
  if (!clutterWall) throw new Error("Clutter evidence target is absent from the local summary.");
  const clutterCenter = {
    x: (clutterWall.start.x + clutterWall.end.x) / 2,
    y: (clutterWall.start.y + clutterWall.end.y) / 2,
  };
  proposals.push({
    id: "recorded-washbasin-advisory",
    kind: "local-wall-review",
    targetWallCandidateId: clutter.wallCandidateId,
    recommendation: "likely-clutter",
    sourceRegion: schemaRegion(clutterCenter, 0.12, 0.12),
    modelConfidence: 0.96,
    reasonCodes: ["sanitary-symbol-overlap", "weak-structural-mask-support", "short-clutter-profile"],
  });

  return {
    schemaVersion: "recognition-ai-proposals-v1",
    requestId: identity.requestId,
    referenceRevision: identity.referenceRevision,
    localDraftFingerprint: identity.localDraftFingerprint,
    proposals,
    diagnostics: [],
  };
}

async function installModelRoute(page) {
  await page.route("https://openrouter.ai/api/v1/models**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{
          id: modelId,
          name: "Recorded Stage 1 model",
          context_length: 64_000,
          architecture: { input_modalities: ["text", "image"] },
          supported_parameters: ["structured_outputs", "response_format"],
        }],
      }),
    });
  });
}

async function openProposalDialog(page) {
  await page.getByRole("button", { name: "Найти пропущенные двери и окна с AI", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Проверить план с AI" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("OpenRouter API key").fill("recorded-browser-key");
  return dialog;
}

async function cancelProposalRun(page) {
  let releaseRoute;
  let startedRoute;
  const started = new Promise((resolve) => { startedRoute = resolve; });
  const release = new Promise((resolve) => { releaseRoute = resolve; });
  const handler = async (route) => {
    startedRoute(route);
    await release;
    try { await route.abort("aborted"); } catch { /* request was already cancelled */ }
  };
  await page.route("https://openrouter.ai/api/v1/chat/completions", handler);
  const dialog = await openProposalDialog(page);
  await dialog.getByRole("button", { name: "Анализировать", exact: true }).click();
  await started;
  await expect(page.locator(".context-panel-phase")).toHaveText("AI-поиск пропущенных элементов");
  await dialog.getByRole("button", { name: "Отменить запрос", exact: true }).click();
  releaseRoute();
  await page.unroute("https://openrouter.ai/api/v1/chat/completions", handler);
  await expect(dialog).toBeHidden();
  await expect(page.locator(".context-panel-phase")).toHaveText("Проверка черновика");
}

async function runRecordedProposalDiscovery(page) {
  const handler = async (route) => {
    const batch = recordedProposalBatch(route.request());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify(batch) } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }),
    });
  };
  await page.route("https://openrouter.ai/api/v1/chat/completions", handler);
  const dialog = await openProposalDialog(page);
  await dialog.getByRole("button", { name: "Анализировать", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="door"][data-proposal-state="eligible"]')).not.toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="window"][data-proposal-state="eligible"]')).not.toHaveCount(0);
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="local-wall-review"][data-proposal-state="eligible"]')).toHaveCount(1);
  await page.unroute("https://openrouter.ai/api/v1/chat/completions", handler);
}

async function violetCanvasPixels(page) {
  return page.evaluate(() => {
    let pixels = 0;
    for (const canvas of document.querySelectorAll(".canvas-shell canvas")) {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) continue;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 0; index < data.length; index += 4) {
        if (
          Math.abs(data[index] - 124) <= 14
          && Math.abs(data[index + 1] - 58) <= 14
          && Math.abs(data[index + 2] - 237) <= 14
          && data[index + 3] > 100
        ) pixels += 1;
      }
    }
    return pixels;
  });
}

async function acceptFirstProposal(page, kind) {
  const card = page.locator(`.recognition-proposal-card[data-proposal-kind="${kind}"][data-proposal-state="eligible"]`).first();
  await card.getByRole("button", { name: "Принять предложение", exact: true }).click();
  await expect(card.locator("em")).toHaveText("Принято");
}

async function applyAndReadProject(page) {
  await page.getByRole("button", { name: "Применить выбранное", exact: true }).click();
  await expect(page.getByRole("button", { name: "Уже применено", exact: true })).toBeDisabled();
  await expect.poll(async () => (await projectSnapshot(page))?.document).not.toBeNull();
  return projectSnapshot(page);
}

async function ensureCompactPanel(page) {
  await page.setViewportSize({ width: 720, height: 450 });
  const surface = page.locator("#editor-context-surface");
  if (!(await surface.isVisible())) {
    await page.locator(".editor-context-trigger").click();
    await expect(surface).toBeVisible();
  }
}

async function runAcceptance(page, browser, full) {
  test.setTimeout(full ? 300_000 : 240_000);
  await mkdir(artifactsDir, { recursive: true });
  const png = await renderFixturePng(browser);
  await seedProject(page, png);
  await installModelRoute(page);
  await runLocalRecognition(page);

  const localWallCount = await page.locator('[data-local-candidate-kind="wall"]').count();
  expect(localWallCount).toBeGreaterThan(0);
  expect((await projectSnapshot(page)).document).toMatchObject({ walls: [], openings: [] });

  await cancelProposalRun(page);
  await expect(page.locator(".recognition-proposal-card")).toHaveCount(0);
  await expect(page.locator('[data-local-candidate-kind="wall"]')).toHaveCount(localWallCount);

  await runRecordedProposalDiscovery(page);
  await expect(page.locator('[data-local-candidate-kind="wall"]')).toHaveCount(localWallCount);
  expect((await projectSnapshot(page)).document).toMatchObject({ walls: [], openings: [] });

  const blocked = page.locator('.recognition-proposal-card[data-proposal-state="blocked"]').first();
  await expect(blocked).toBeVisible();
  await expect(blocked.getByRole("button", { name: "Принять предложение", exact: true })).toHaveCount(0);
  const duplicate = page.locator('.recognition-proposal-card[data-proposal-state="duplicate"]').first();
  if (await duplicate.count()) {
    await expect(duplicate.getByRole("button", { name: "Принять предложение", exact: true })).toHaveCount(0);
  }

  await page.getByRole("button", { name: "Предложения AI", exact: true }).click();
  await expect(page.getByRole("button", { name: "Предложения AI", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-local-candidate-kind="wall"]')).toHaveCount(0);
  expect(await violetCanvasPixels(page)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Только Local", exact: true }).click();
  await expect(page.locator(".recognition-proposal-card")).toHaveCount(0);
  expect(await violetCanvasPixels(page)).toBe(0);
  await page.getByRole("button", { name: "Все источники", exact: true }).click();

  const advisory = page.locator('.recognition-proposal-card[data-proposal-kind="local-wall-review"][data-proposal-state="eligible"]');
  await expect(advisory).toContainText("AI считает эту локальную линию вероятным обозначением сантехники или мебели. Согласие отклонит только кандидат локального черновика и не удалит уже существующую стену квартиры.");
  await advisory.getByRole("button", { name: "Согласиться и отклонить только локальный кандидат", exact: true }).click();
  await expect(advisory.locator("em")).toHaveText("Принято");
  const advisorySession = await sessionSnapshot(page);
  const advisoryProposal = advisorySession.draft.aiProposals.find(({ kind }) => kind === "local-wall-review");
  expect(advisoryProposal).toBeTruthy();
  expect(advisorySession.draft.decisions[advisoryProposal.targetLocalCandidateId]).toBe("rejected");
  expect((await projectSnapshot(page)).document).toMatchObject({ walls: [], openings: [] });

  await page.getByRole("button", { name: "Принять уверенные", exact: true }).click();
  await acceptFirstProposal(page, "door");
  const firstProject = await applyAndReadProject(page);
  expect(firstProject.document.walls.length).toBeGreaterThan(0);
  const firstOpeningCount = firstProject.document.openings.length;
  expect(firstOpeningCount).toBeGreaterThan(0);

  await acceptFirstProposal(page, "window");
  const secondProject = await applyAndReadProject(page);
  expect(secondProject.document.openings.length).toBeGreaterThan(firstOpeningCount);
  const secondOpeningCount = secondProject.document.openings.length;

  const undo = page.locator('.editor-history-button[aria-label="Отменить"]');
  const redo = page.locator('.editor-history-button[aria-label="Повторить"]');
  await undo.click();
  expect((await projectSnapshot(page)).document.openings.length).toBe(firstOpeningCount);
  await undo.click();
  expect((await projectSnapshot(page)).document.openings.length).toBe(0);
  await redo.click();
  expect((await projectSnapshot(page)).document.openings.length).toBe(firstOpeningCount);
  await redo.click();
  await expect.poll(async () => (await projectSnapshot(page)).document.openings.length).toBe(secondOpeningCount);

  await page.screenshot({
    path: path.join(artifactsDir, `${full ? "chromium" : "webkit"}-ai-proposals-applied.png`),
    fullPage: false,
  });

  await page.reload();
  await expect(page.locator(".editor-project-bar")).toBeVisible();
  await openRecognitionPanel(page);
  await expect(page.getByText("AI-предложения отделены от локального черновика", { exact: true })).toBeVisible();
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="door"] em').first()).toHaveText("Принято");
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="window"] em').first()).toHaveText("Принято");
  const restored = await sessionSnapshot(page);
  expect(restored.draft.aiProposalMetadata).toMatchObject({ providerId: "openrouter-direct", modelId });

  if (!full) return;

  await ensureCompactPanel(page);
  const aiFilter = page.getByRole("button", { name: "Предложения AI", exact: true });
  await aiFilter.focus();
  await page.keyboard.press("Enter");
  await expect(aiFilter).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await page.setViewportSize({ width: 1440, height: 900 });
  if (!(await page.locator("#editor-context-surface").isVisible())) {
    await page.locator(".editor-context-trigger").click();
  }
  await page.getByRole("button", { name: "Повторить локально", exact: true }).click();
  await expect(page.locator(".context-panel-phase")).toHaveText("Проверка черновика", { timeout: 150_000 });
  await expect(page.locator(".recognition-proposal-card")).toHaveCount(0);
  await expect(page.getByText("AI-предложения отделены от локального черновика", { exact: true })).toHaveCount(0);
}

test.describe.serial("M7.8C.1 hybrid AI proposal browser acceptance", () => {
  test("Chromium covers cancellation, reviewed proposals, atomic history, restore and invalidation", async ({ page, browser, browserName }) => {
    test.skip(browserName !== "chromium", "Chromium-only full acceptance scenario.");
    await runAcceptance(page, browser, true);
  });

  test("WebKit covers local-only, eligible review, atomic Apply and restore", async ({ page, browser, browserName }) => {
    test.skip(browserName !== "webkit", "WebKit-only representative acceptance scenario.");
    await runAcceptance(page, browser, false);
  });
});
