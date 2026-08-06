import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(auditRoot, "artifacts");
const now = "2026-08-06T08:00:00.000Z";
const modelId = "recorded/provider-model";
const recordedFingerprint = "recognition-local-draft-v1:bc170b3e112ce71ab22b8d3e66a081b70ee063c645557377b917c70bc1543abf";
const recordedRequestId = "recorded-product-owner-current-plan-stage1-v1";

const recordedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600">
  <rect width="1000" height="600" fill="#f3f5f8"/>
  <g stroke="#111" stroke-linecap="square">
    <line x1="100" y1="300" x2="444" y2="300" stroke-width="20"/>
    <line x1="556" y1="300" x2="900" y2="300" stroke-width="20"/>
    <line x1="100" y1="48" x2="434" y2="48" stroke-width="20"/>
    <line x1="566" y1="48" x2="900" y2="48" stroke-width="20"/>
    <line x1="450" y1="330" x2="450" y2="450" stroke-width="24"/>
  </g>
  <g fill="none" stroke="#555" stroke-width="2">
    <line x1="444" y1="300" x2="444" y2="400"/>
    <path d="M 556 300 A 112 112 0 0 1 444 412"/>
    <line x1="434" y1="42" x2="566" y2="42"/>
    <line x1="434" y1="48" x2="566" y2="48"/>
    <line x1="434" y1="54" x2="566" y2="54"/>
    <line x1="445" y1="434" x2="555" y2="434"/>
    <line x1="445" y1="466" x2="555" y2="466"/>
    <ellipse cx="500" cy="450" rx="48" ry="20"/>
  </g>
</svg>`;

function recordedProposal(input) {
  return {
    id: `ai-proposal:${recordedRequestId}:${input.rawProposalId}`,
    rawProposalId: input.rawProposalId,
    kind: input.kind,
    state: input.state,
    geometry: input.geometry ?? null,
    targetLocalCandidateId: input.targetLocalCandidateId ?? null,
    hostWallCandidateId: input.hostWallCandidateId ?? null,
    provider: {
      providerId: "openrouter-direct",
      modelId,
      requestId: recordedRequestId,
    },
    modelConfidence: input.modelConfidence ?? 0.96,
    deterministicConfidence: input.deterministicConfidence ?? "medium",
    sourceRegion: input.sourceRegion,
    evidence: {
      providerReasons: input.providerReasons,
      validatorReasons: input.validatorReasons,
    },
    localDraftFingerprint: recordedFingerprint,
  };
}

function recordedSession(projectId, assetId, referenceRevision) {
  const proposals = [
    recordedProposal({
      rawProposalId: "raw-door-living",
      kind: "door",
      state: "eligible",
      geometry: { kind: "opening", center: { x: 0.5, y: 0.5 }, widthNormalized: 0.1, orientationDeg: 0 },
      hostWallCandidateId: "wall-door-host",
      sourceRegion: { x: 0.44, y: 0.42, width: 0.12, height: 0.16 },
      providerReasons: ["visible-gap", "door-leaf"],
      validatorReasons: ["host-wall-validated", "opening-span-validated", "local-door-evidence-validated"],
    }),
    recordedProposal({
      rawProposalId: "raw-window-living",
      kind: "window",
      state: "eligible",
      geometry: { kind: "opening", center: { x: 0.5, y: 0.08 }, widthNormalized: 0.12, orientationDeg: 0 },
      hostWallCandidateId: "wall-window-host",
      sourceRegion: { x: 0.43, y: 0.02, width: 0.14, height: 0.12 },
      providerReasons: ["visible-gap", "parallel-window-rails", "window-frame", "exterior-boundary-context"],
      validatorReasons: ["host-wall-validated", "window-evidence-validated", "opening-span-validated"],
    }),
    recordedProposal({
      rawProposalId: "raw-wall-washbasin",
      kind: "local-wall-review",
      state: "eligible",
      targetLocalCandidateId: "wall-washbasin",
      deterministicConfidence: "low",
      sourceRegion: { x: 0.44, y: 0.7, width: 0.12, height: 0.1 },
      providerReasons: ["sanitary-symbol-overlap", "weak-structural-mask-support", "short-clutter-profile"],
      validatorReasons: [
        "exact-local-wall-target-validated",
        "source-region-overlap-validated",
        "local-clutter-profile-validated",
        "weak-structural-support-validated",
        "single-anchor-or-less-validated",
      ],
    }),
    recordedProposal({
      rawProposalId: "raw-door-duplicate",
      kind: "door",
      state: "duplicate",
      geometry: { kind: "opening", center: { x: 0.5, y: 0.5 }, widthNormalized: 0.1, orientationDeg: 0 },
      hostWallCandidateId: "wall-door-host",
      deterministicConfidence: "low",
      sourceRegion: { x: 0.44, y: 0.42, width: 0.12, height: 0.16 },
      providerReasons: ["visible-gap", "door-leaf"],
      validatorReasons: ["opening-duplicate-existing"],
    }),
    recordedProposal({
      rawProposalId: "raw-door-unknown-host",
      kind: "door",
      state: "blocked",
      geometry: { kind: "opening", center: { x: 0.9, y: 0.9 }, widthNormalized: 0.08, orientationDeg: 0 },
      deterministicConfidence: "low",
      sourceRegion: { x: 0.82, y: 0.82, width: 0.1, height: 0.1 },
      providerReasons: ["visible-gap", "door-leaf"],
      validatorReasons: ["unknown-host-wall-hint"],
    }),
  ];
  const proposalDecisions = Object.fromEntries(proposals.map(({ id }) => [id, "pending"]));
  const draft = {
    id: "recorded-product-owner-current-plan-stage1-draft",
    projectId,
    referenceAssetId: assetId,
    referenceRevision,
    engineVersion: "5",
    status: "reconciled",
    walls: [
      {
        id: "wall-door-host",
        start: { x: 0.1, y: 0.5 },
        end: { x: 0.9, y: 0.5 },
        estimatedThicknessPx: 20,
        confidence: "high",
        evidence: { localScore: 0.91, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
        origin: "local",
        conflict: null,
      },
      {
        id: "wall-window-host",
        start: { x: 0.1, y: 0.08 },
        end: { x: 0.9, y: 0.08 },
        estimatedThicknessPx: 20,
        confidence: "high",
        evidence: { localScore: 0.91, cloudScore: null, reasons: ["filled-wall-region-evidence", "exterior-boundary-host-bridge"] },
        origin: "local",
        conflict: null,
      },
      {
        id: "anchor-left",
        start: { x: 0.45, y: 0.55 },
        end: { x: 0.45, y: 0.75 },
        estimatedThicknessPx: 24,
        confidence: "medium",
        evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
        origin: "local",
        conflict: null,
      },
      {
        id: "wall-washbasin",
        start: { x: 0.45, y: 0.75 },
        end: { x: 0.55, y: 0.75 },
        estimatedThicknessPx: 36,
        confidence: "low",
        evidence: { localScore: 0.48, cloudScore: null, reasons: ["filled-wall-region-evidence", "structural-clutter-veto"] },
        origin: "local",
        conflict: "unsupported",
      },
    ],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: {
      "wall-door-host": "pending",
      "wall-window-host": "pending",
      "anchor-left": "pending",
      "wall-washbasin": "pending",
    },
    source: { local: true, cloud: false },
    createdAt: now,
    updatedAt: now,
    aiProposals: proposals,
    proposalDecisions,
    aiProposalMetadata: {
      schemaVersion: "recognition-ai-proposals-v1",
      requestId: recordedRequestId,
      referenceRevision,
      localDraftFingerprint: recordedFingerprint,
      providerId: "openrouter-direct",
      modelId,
      completedAt: now,
    },
  };
  return {
    id: "recorded-product-owner-current-plan-stage1-session",
    projectId,
    referenceAssetId: assetId,
    referenceRevision,
    engineVersion: "5",
    draft,
    cloudMetadata: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function renderPng(browser) {
  const page = await browser.newPage({ viewport: { width: 1020, height: 620 }, colorScheme: "light" });
  try {
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#f3f5f8">${recordedSvg}</body></html>`);
    return await page.locator("svg").screenshot({ animations: "disabled", caret: "hide" });
  } finally {
    await page.close();
  }
}

async function seedProject(page, input) {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  const base64 = input.png.toString("base64");
  await page.evaluate(async (seed) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("vlezet", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open Vlezet IndexedDB."));
    });
    try {
      const bytes = Uint8Array.from(atob(seed.base64), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/png" });
      const project = {
        storageVersion: 2,
        id: seed.projectId,
        name: seed.name,
        createdAt: seed.now,
        updatedAt: seed.now,
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
          assetId: seed.assetId,
          referenceRevision: seed.referenceRevision,
          source: { kind: "image", originalMimeType: "image/png" },
          widthPx: 1000,
          heightPx: 600,
          transform: { originWorld: { x: 0, y: 0 }, millimetersPerPixel: 10, rotationDeg: 0 },
          calibration: {
            pointA: { x: 100, y: 300 },
            pointB: { x: 200, y: 300 },
            knownLengthMm: 1000,
            alignment: "horizontal",
          },
          display: { visible: true, opacity: 0.45, locked: true },
        },
      };
      const asset = {
        id: seed.assetId,
        projectId: seed.projectId,
        kind: "reference-raster",
        mimeType: "image/png",
        byteLength: blob.size,
        createdAt: seed.now,
        blob,
      };
      const stores = ["projects", "assets", "settings", ...(seed.session ? ["recognitionSessions"] : [])];
      const transaction = database.transaction(stores, "readwrite");
      transaction.objectStore("projects").put(project);
      transaction.objectStore("assets").put(asset);
      transaction.objectStore("settings").put({ key: "lastProjectId", value: seed.projectId });
      if (seed.session) transaction.objectStore("recognitionSessions").put(seed.session);
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Unable to seed Vlezet IndexedDB."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Vlezet IndexedDB seed aborted."));
      });
    } finally {
      database.close();
    }
  }, { ...input, base64, now });
  await page.reload();
  await expect(page.locator(".editor-project-bar")).toBeVisible();
  await expect(page.locator(".canvas-shell")).toBeVisible();
}

async function readRecord(page, storeName, key, indexName = null) {
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
      return result;
    } finally {
      database.close();
    }
  }, { storeName, key, indexName });
}

async function openRecognition(page) {
  await page.getByRole("button", { name: "Распознать", exact: true }).click();
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Распознавание");
}

async function runLocal(page) {
  await openRecognition(page);
  const start = page.getByRole("button", { name: "Распознать план", exact: true });
  if (await start.isVisible()) await start.click();
  await expect(page.getByRole("heading", { name: "Проверка черновика", exact: true })).toBeVisible({ timeout: 150_000 });
  await expect(page.locator('[data-local-candidate-kind="wall"]')).not.toHaveCount(0);
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

async function verifyCancellation(page) {
  let release;
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  const releasePromise = new Promise((resolve) => { release = resolve; });
  const handler = async (route) => {
    started();
    await releasePromise;
    try { await route.abort("aborted"); } catch { /* already cancelled */ }
  };
  await page.route("https://openrouter.ai/api/v1/chat/completions", handler);
  const dialog = await openProposalDialog(page);
  await dialog.getByRole("button", { name: "Анализировать", exact: true }).click();
  await startedPromise;
  await expect(page.getByRole("heading", { name: "AI-поиск пропущенных элементов", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Отменить AI-поиск", exact: true }).click();
  release();
  await page.unroute("https://openrouter.ai/api/v1/chat/completions", handler);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Проверка черновика", exact: true })).toBeVisible();
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

async function acceptProposal(page, kind) {
  const card = page.locator(`.recognition-proposal-card[data-proposal-kind="${kind}"][data-proposal-state="eligible"]`).first();
  await card.getByRole("button", { name: "Принять предложение", exact: true }).click();
  await expect(card.locator("em")).toHaveText("Принято");
}

async function applySelected(page, projectId) {
  await page.getByRole("button", { name: "Применить выбранное", exact: true }).click();
  await expect(page.getByRole("button", { name: "Уже применено", exact: true })).toBeDisabled();
  await expect.poll(async () => (await readRecord(page, "projects", projectId))?.document?.walls?.length ?? 0).toBeGreaterThan(0);
  return readRecord(page, "projects", projectId);
}

async function seedRecordedReview(page, browser, suffix) {
  const png = await renderPng(browser);
  const projectId = `recorded-browser-project-${suffix}`;
  const assetId = `recorded-browser-asset-${suffix}`;
  const referenceRevision = `recorded-browser-reference-${suffix}`;
  const session = recordedSession(projectId, assetId, referenceRevision);
  await seedProject(page, {
    png,
    projectId,
    assetId,
    referenceRevision,
    name: `Recorded AI Proposal ${suffix}`,
    session,
  });
  return { projectId, session };
}

async function exerciseRecordedReview(page, browser, full) {
  const { projectId } = await seedRecordedReview(page, browser, full ? "chromium" : "webkit");
  await openRecognition(page);
  await expect(page.getByText("AI-предложения отделены от локального черновика", { exact: true })).toBeVisible();
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="door"][data-proposal-state="eligible"]')).toHaveCount(1);
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="window"][data-proposal-state="eligible"]')).toHaveCount(1);

  const blocked = page.locator('.recognition-proposal-card[data-proposal-state="blocked"]');
  const duplicate = page.locator('.recognition-proposal-card[data-proposal-state="duplicate"]');
  await expect(blocked).toHaveCount(1);
  await expect(duplicate).toHaveCount(1);
  await expect(blocked.getByRole("button", { name: "Принять предложение", exact: true })).toHaveCount(0);
  await expect(duplicate.getByRole("button", { name: "Принять предложение", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Предложения AI", exact: true }).click();
  await expect(page.locator('[data-local-candidate-kind="wall"]')).toHaveCount(0);
  expect(await violetCanvasPixels(page)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Только Local", exact: true }).click();
  await expect(page.locator(".recognition-proposal-card")).toHaveCount(0);
  expect(await violetCanvasPixels(page)).toBe(0);
  await page.getByRole("button", { name: "Все источники", exact: true }).click();

  const documentBeforeAdvisory = (await readRecord(page, "projects", projectId)).document;
  const advisory = page.locator('.recognition-proposal-card[data-proposal-kind="local-wall-review"][data-proposal-state="eligible"]');
  await expect(advisory).toContainText("AI считает эту локальную линию вероятным обозначением сантехники или мебели.");
  await advisory.getByRole("button", { name: "Согласиться и отклонить только локальный кандидат", exact: true }).click();
  await expect(advisory.locator("em")).toHaveText("Принято");
  await expect.poll(async () => {
    const session = await readRecord(page, "recognitionSessions", projectId, "projectId");
    return session?.draft?.decisions?.["wall-washbasin"];
  }).toBe("rejected");
  expect((await readRecord(page, "projects", projectId)).document).toEqual(documentBeforeAdvisory);

  await page.getByRole("button", { name: "Принять уверенные", exact: true }).click();
  await acceptProposal(page, "door");
  const firstProject = await applySelected(page, projectId);
  const firstOpeningCount = firstProject.document.openings.length;
  expect(firstOpeningCount).toBe(1);

  await acceptProposal(page, "window");
  await expect(page.getByRole("button", { name: "Применить выбранное", exact: true })).toBeEnabled();
  const secondProject = await applySelected(page, projectId);
  const secondOpeningCount = secondProject.document.openings.length;
  expect(secondOpeningCount).toBe(2);

  if (full) {
    const undo = page.locator('.editor-history-button[aria-label="Отменить"]');
    const redo = page.locator('.editor-history-button[aria-label="Повторить"]');
    await undo.click();
    await expect.poll(async () => (await readRecord(page, "projects", projectId)).document.openings.length).toBe(firstOpeningCount);
    await undo.click();
    await expect.poll(async () => (await readRecord(page, "projects", projectId)).document.openings.length).toBe(0);
    await redo.click();
    await expect.poll(async () => (await readRecord(page, "projects", projectId)).document.openings.length).toBe(firstOpeningCount);
    await redo.click();
    await expect.poll(async () => (await readRecord(page, "projects", projectId)).document.openings.length).toBe(secondOpeningCount);
  }

  await mkdir(artifactsDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactsDir, `${full ? "chromium" : "webkit"}-ai-proposals-applied.png`),
    fullPage: false,
  });

  await page.reload();
  await expect(page.locator(".editor-project-bar")).toBeVisible();
  await openRecognition(page);
  await expect(page.getByText("AI-предложения отделены от локального черновика", { exact: true })).toBeVisible();
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="door"] em').first()).toHaveText("Принято");
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="window"] em').first()).toHaveText("Принято");
  const restored = await readRecord(page, "recognitionSessions", projectId, "projectId");
  expect(restored.draft.aiProposalMetadata).toMatchObject({ providerId: "openrouter-direct", modelId });

  if (!full) return;

  await page.setViewportSize({ width: 720, height: 450 });
  const surface = page.locator("#editor-context-surface");
  if (!(await surface.isVisible())) await page.locator(".editor-context-trigger").click();
  const aiFilter = page.getByRole("button", { name: "Предложения AI", exact: true });
  await aiFilter.focus();
  await page.keyboard.press("Enter");
  await expect(aiFilter).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await page.setViewportSize({ width: 1440, height: 900 });
  if (!(await surface.isVisible())) await page.locator(".editor-context-trigger").click();
  await page.getByRole("button", { name: "Повторить локально", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Проверка черновика", exact: true })).toBeVisible({ timeout: 150_000 });
  await expect(page.locator(".recognition-proposal-card")).toHaveCount(0);
  await expect(page.getByText("AI-предложения отделены от локального черновика", { exact: true })).toHaveCount(0);
}

test.describe.serial("M7.8C.1 hybrid AI proposal browser acceptance", () => {
  test("Chromium covers local-only cancellation and recorded review/history/restore", async ({ page, browser, browserName }) => {
    test.skip(browserName !== "chromium", "Chromium-only full acceptance scenario.");
    test.setTimeout(360_000);
    const png = await renderPng(browser);
    const projectId = "runtime-browser-ai-project";
    await seedProject(page, {
      png,
      projectId,
      assetId: "runtime-browser-ai-asset",
      referenceRevision: "runtime-browser-ai-reference",
      name: "Runtime AI Cancellation",
      session: null,
    });
    await installModelRoute(page);
    await runLocal(page);
    const localWallCount = await page.locator('[data-local-candidate-kind="wall"]').count();
    expect(localWallCount).toBeGreaterThan(0);
    expect((await readRecord(page, "projects", projectId)).document).toMatchObject({ walls: [], openings: [] });
    await verifyCancellation(page);
    await expect(page.locator(".recognition-proposal-card")).toHaveCount(0);
    await expect(page.locator('[data-local-candidate-kind="wall"]')).toHaveCount(localWallCount);
    expect((await readRecord(page, "projects", projectId)).document).toMatchObject({ walls: [], openings: [] });

    await exerciseRecordedReview(page, browser, true);
  });

  test("WebKit covers recorded eligible review, atomic Apply and restore", async ({ page, browser, browserName }) => {
    test.skip(browserName !== "webkit", "WebKit-only representative acceptance scenario.");
    test.setTimeout(240_000);
    await exerciseRecordedReview(page, browser, false);
  });
});
