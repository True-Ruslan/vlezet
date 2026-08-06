import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(auditRoot, "artifacts");
const now = "2026-08-06T08:00:00.000Z";
const projectId = "recorded-browser-project-webkit";
const assetId = "recorded-browser-asset-webkit";
const referenceRevision = "recorded-browser-reference-webkit";
const modelId = "recorded/provider-model";
const requestId = "recorded-product-owner-current-plan-stage1-v1";
const fingerprint = "recognition-local-draft-v1:bc170b3e112ce71ab22b8d3e66a081b70ee063c645557377b917c70bc1543abf";
const proposalId = `ai-proposal:${requestId}:raw-door-living`;

function projectRecord() {
  return {
    storageVersion: 2,
    id: projectId,
    name: "Recorded AI Proposal WebKit",
    createdAt: now,
    updatedAt: now,
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
      assetId,
      referenceRevision,
      source: { kind: "image", originalMimeType: "image/png" },
      widthPx: 1000,
      heightPx: 600,
      transform: {
        originWorld: { x: 0, y: 0 },
        millimetersPerPixel: 10,
        rotationDeg: 0,
      },
      calibration: {
        pointA: { x: 100, y: 300 },
        pointB: { x: 200, y: 300 },
        knownLengthMm: 1000,
        alignment: "horizontal",
      },
      display: { visible: true, opacity: 0.45, locked: true },
    },
  };
}

function sessionRecord() {
  const proposal = {
    id: proposalId,
    rawProposalId: "raw-door-living",
    kind: "door",
    state: "eligible",
    geometry: {
      kind: "opening",
      center: { x: 0.5, y: 0.5 },
      widthNormalized: 0.1,
      orientationDeg: 0,
    },
    targetLocalCandidateId: null,
    hostWallCandidateId: "wall-door-host",
    provider: { providerId: "openrouter-direct", modelId, requestId },
    modelConfidence: 0.96,
    deterministicConfidence: "medium",
    sourceRegion: { x: 0.44, y: 0.42, width: 0.12, height: 0.16 },
    evidence: {
      providerReasons: ["visible-gap", "door-leaf"],
      validatorReasons: [
        "host-wall-validated",
        "opening-span-validated",
        "local-door-evidence-validated",
      ],
    },
    localDraftFingerprint: fingerprint,
  };
  const draft = {
    id: "recorded-product-owner-current-plan-stage1-draft-webkit",
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
        evidence: {
          localScore: 0.91,
          cloudScore: null,
          reasons: ["filled-wall-region-evidence"],
        },
        origin: "local",
        conflict: null,
      },
      {
        id: "wall-window-host",
        start: { x: 0.1, y: 0.08 },
        end: { x: 0.9, y: 0.08 },
        estimatedThicknessPx: 20,
        confidence: "high",
        evidence: {
          localScore: 0.91,
          cloudScore: null,
          reasons: ["filled-wall-region-evidence", "exterior-boundary-host-bridge"],
        },
        origin: "local",
        conflict: null,
      },
    ],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: {
      "wall-door-host": "pending",
      "wall-window-host": "pending",
    },
    source: { local: true, cloud: false },
    createdAt: now,
    updatedAt: now,
    aiProposals: [proposal],
    proposalDecisions: { [proposalId]: "pending" },
    aiProposalMetadata: {
      schemaVersion: "recognition-ai-proposals-v1",
      requestId,
      referenceRevision,
      localDraftFingerprint: fingerprint,
      providerId: "openrouter-direct",
      modelId,
      completedAt: now,
    },
  };
  return {
    id: "recorded-product-owner-current-plan-stage1-session-webkit",
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

async function seedRepresentativeState(page) {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  await page.evaluate(async ({ project, session }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("vlezet", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open Vlezet IndexedDB."));
    });

    const failure = (event, transaction, label) => {
      const target = event.target;
      const error = target && "error" in target ? target.error : transaction.error;
      const name = error?.name ?? "UnknownError";
      const message = error?.message ? `: ${error.message}` : "";
      return new Error(`${label}: ${name}${message}`);
    };

    const write = async (stores, values, label) => {
      const transaction = database.transaction(stores, "readwrite");
      const done = new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(failure(event, transaction, label));
        transaction.onabort = (event) => reject(failure(event, transaction, label));
      });
      for (const entry of values) {
        const request = transaction.objectStore(entry.store).put(entry.value);
        request.onerror = (event) => {
          event.preventDefault();
          transaction.abort();
        };
      }
      await done;
    };

    try {
      await write(
        ["projects", "settings"],
        [
          { store: "projects", value: project },
          { store: "settings", value: { key: "lastProjectId", value: project.id } },
        ],
        "Unable to seed project state",
      );
      await write(
        ["recognitionSessions"],
        [{ store: "recognitionSessions", value: session }],
        "Unable to seed recognition session",
      );
    } finally {
      database.close();
    }
  }, { project: projectRecord(), session: sessionRecord() });

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
      return await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error ?? new Error("Unable to read Vlezet record."));
      });
    } finally {
      database.close();
    }
  }, { storeName, key, indexName });
}

async function openRecognition(page) {
  await page.getByRole("button", { name: "Распознать", exact: true }).click();
  await expect(page.locator(".context-panel-eyebrow")).toHaveText("Распознавание");
}

test("WebKit reviews, applies and restores an eligible recorded AI door", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "WebKit-only representative acceptance scenario.");
  test.setTimeout(180_000);

  await seedRepresentativeState(page);
  await openRecognition(page);

  const proposal = page.locator(
    '.recognition-proposal-card[data-proposal-kind="door"][data-proposal-state="eligible"]',
  );
  await expect(proposal).toHaveCount(1);
  await expect(page.getByText("AI-предложения отделены от локального черновика", { exact: true })).toBeVisible();
  expect((await readRecord(page, "projects", projectId)).document.openings).toHaveLength(0);

  await page.getByRole("button", { name: "Принять уверенные", exact: true }).click();
  await proposal.getByRole("button", { name: "Принять предложение", exact: true }).click();
  await expect(proposal.locator("em")).toHaveText("Принято");
  await expect(page.getByRole("button", { name: "Применить выбранное", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Применить выбранное", exact: true }).click();

  await expect.poll(async () => {
    const project = await readRecord(page, "projects", projectId);
    return project?.document?.openings?.length ?? 0;
  }).toBe(1);
  await expect(page.getByRole("button", { name: "Уже применено", exact: true })).toBeDisabled();

  await mkdir(artifactsDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactsDir, "webkit-ai-proposals-applied.png"),
    fullPage: false,
  });

  await page.reload();
  await expect(page.locator(".editor-project-bar")).toBeVisible();
  await openRecognition(page);
  await expect(page.locator('.recognition-proposal-card[data-proposal-kind="door"] em')).toHaveText("Принято");
  const restored = await readRecord(page, "recognitionSessions", projectId, "projectId");
  expect(restored.draft.aiProposalMetadata).toMatchObject({
    providerId: "openrouter-direct",
    modelId,
    requestId,
  });
  expect((await readRecord(page, "projects", projectId)).document.openings).toHaveLength(1);
});
