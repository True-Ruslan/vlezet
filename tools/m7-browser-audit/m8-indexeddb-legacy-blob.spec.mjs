import { expect, test } from "./fixtures.mjs";

const DB_NAME = "vlezet";
const SETUP_PATH = "/__playwright-idb-legacy-blob";
const NOW = "2026-08-15T00:00:00.000Z";
const EMPTY_DOCUMENT = {
  schemaVersion: 3,
  vertices: [],
  walls: [],
  openings: [],
  roomAnnotations: [],
  placedObjects: [],
};
const VIEWPORT = { offsetX: 140, offsetY: 140, pixelsPerMillimeter: 0.12 };

function legacyV2Project(id, name) {
  return {
    storageVersion: 2,
    id,
    name,
    createdAt: NOW,
    updatedAt: NOW,
    document: EMPTY_DOCUMENT,
    viewport: VIEWPORT,
    ui: { furnitureCatalogOpen: true, referencePanelOpen: false },
    referencePlan: null,
  };
}

async function openStorageSetupPage(page) {
  await page.route(`**${SETUP_PATH}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>IndexedDB legacy Blob setup</body></html>",
    });
  });
  await page.goto(SETUP_PATH);
}

async function seedLegacyBlobDatabase(page, { project, asset }) {
  return page.evaluate(async ({ dbName, storedProject, storedAsset }) => {
    const transactionDone = (transaction, label) => new Promise((resolve, reject) => {
      transaction.onerror = () => reject(new Error(`${label}: ${transaction.error?.name ?? "UnknownError"}: ${transaction.error?.message ?? "unknown transaction error"}`));
      transaction.onabort = () => reject(new Error(`${label} aborted: ${transaction.error?.name ?? "AbortError"}: ${transaction.error?.message ?? "unknown transaction abort"}`));
      transaction.oncomplete = resolve;
    });

    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 2);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB legacy Blob open failed"));
      request.onblocked = () => reject(new Error("IndexedDB legacy Blob open blocked"));
      request.onupgradeneeded = () => {
        const upgradeDatabase = request.result;
        const projects = upgradeDatabase.createObjectStore("projects", { keyPath: "id" });
        projects.createIndex("updatedAt", "updatedAt", { unique: false });
        upgradeDatabase.createObjectStore("settings", { keyPath: "key" });
        const assets = upgradeDatabase.createObjectStore("assets", { keyPath: "id" });
        assets.createIndex("projectId", "projectId", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
    });

    try {
      const metadataTransaction = database.transaction(["projects", "settings"], "readwrite");
      metadataTransaction.objectStore("projects").put(storedProject);
      metadataTransaction.objectStore("settings").put({ key: "lastProjectId", value: storedProject.id });
      await transactionDone(metadataTransaction, "IndexedDB legacy Blob metadata seed failed");

      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("IndexedDB legacy Blob canvas was unavailable");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 1, 1);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) resolve(value);
          else reject(new Error("IndexedDB legacy Blob canvas output was unavailable"));
        }, storedAsset.mimeType);
      });
      if (!(blob instanceof Blob)) throw new Error("IndexedDB legacy asset did not produce a Blob");
      if (blob.type !== storedAsset.mimeType) throw new Error(`IndexedDB legacy asset MIME mismatch: ${blob.type}`);

      const assetTransaction = database.transaction("assets", "readwrite");
      assetTransaction.objectStore("assets").put({
        id: storedAsset.id,
        projectId: storedAsset.projectId,
        kind: "reference-raster",
        mimeType: storedAsset.mimeType,
        byteLength: blob.size,
        createdAt: storedAsset.createdAt,
        blob,
      });
      await transactionDone(assetTransaction, "IndexedDB legacy Blob asset seed failed");
      return blob.size;
    } finally {
      database.close();
    }
  }, { dbName: DB_NAME, storedProject: project, storedAsset: asset });
}

async function readLegacyEvidence(page, { projectId, assetId }) {
  return page.evaluate(({ dbName, projectId: requestedProjectId, assetId: requestedAssetId }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB legacy Blob evidence open failed"));
    request.onblocked = () => reject(new Error("IndexedDB legacy Blob evidence open blocked"));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["projects", "settings", "assets"], "readonly");
      const projectRequest = transaction.objectStore("projects").get(requestedProjectId);
      const settingRequest = transaction.objectStore("settings").get("lastProjectId");
      const assetRequest = transaction.objectStore("assets").get(requestedAssetId);
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB legacy Blob evidence read failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB legacy Blob evidence read aborted"));
      transaction.oncomplete = () => {
        const rawAsset = assetRequest.result;
        const evidence = {
          version: database.version,
          project: projectRequest.result ?? null,
          setting: settingRequest.result ?? null,
          asset: rawAsset ? {
            id: rawAsset.id,
            projectId: rawAsset.projectId,
            kind: rawAsset.kind,
            mimeType: rawAsset.mimeType,
            byteLength: rawAsset.byteLength,
            createdAt: rawAsset.createdAt,
            isBlob: rawAsset.blob instanceof Blob,
            blobSize: rawAsset.blob instanceof Blob ? rawAsset.blob.size : null,
            blobType: rawAsset.blob instanceof Blob ? rawAsset.blob.type : null,
          } : null,
        };
        database.close();
        resolve(evidence);
      };
    };
  }), { dbName: DB_NAME, projectId, assetId });
}

test("preserves a native legacy Blob-backed v2 asset through the v3 upgrade", async ({ page }) => {
  const project = legacyV2Project("legacy-v2-blob", "Legacy v2 Blob");
  const asset = {
    id: "asset-v2-blob",
    projectId: project.id,
    mimeType: "image/png",
    createdAt: NOW,
  };

  await openStorageSetupPage(page);
  const byteLength = await seedLegacyBlobDatabase(page, { project, asset });
  await page.unroute(`**${SETUP_PATH}`);
  expect(byteLength).toBeGreaterThan(0);

  await page.goto("/");
  await expect(page.getByLabel("Название проекта")).toHaveValue("Legacy v2 Blob");

  const evidence = await readLegacyEvidence(page, { projectId: project.id, assetId: asset.id });
  expect(evidence.version).toBe(3);
  expect(evidence.project).toMatchObject({ id: project.id, name: project.name, storageVersion: 2 });
  expect(evidence.setting).toEqual({ key: "lastProjectId", value: project.id });
  expect(evidence.asset).toEqual({
    id: asset.id,
    projectId: project.id,
    kind: "reference-raster",
    mimeType: "image/png",
    byteLength,
    createdAt: NOW,
    isBlob: true,
    blobSize: byteLength,
    blobType: "image/png",
  });
});