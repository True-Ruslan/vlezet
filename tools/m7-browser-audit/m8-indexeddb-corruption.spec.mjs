import { expect, test } from "./fixtures.mjs";

const DB_NAME = "vlezet";
const SETUP_PATH = "/__playwright-idb-corruption-setup";
const NOW = "2026-08-15T00:00:00.000Z";
const EMPTY_DOCUMENT = {
  schemaVersion: 3,
  vertices: [],
  walls: [],
  openings: [],
  roomAnnotations: [],
  placedObjects: [],
};

const CORRUPTED_PROJECT = {
  storageVersion: 2,
  id: "corrupt-project",
  name: 42,
  createdAt: NOW,
  updatedAt: NOW,
  document: EMPTY_DOCUMENT,
  viewport: { offsetX: 140, offsetY: 140, pixelsPerMillimeter: 0.12 },
  ui: { furnitureCatalogOpen: true, referencePanelOpen: false },
  referencePlan: null,
};

const PROJECT_WITH_CORRUPTED_ASSET = {
  storageVersion: 2,
  id: "asset-project",
  name: "Asset corruption proof",
  createdAt: NOW,
  updatedAt: NOW,
  document: EMPTY_DOCUMENT,
  viewport: { offsetX: 140, offsetY: 140, pixelsPerMillimeter: 0.12 },
  ui: { furnitureCatalogOpen: true, referencePanelOpen: true },
  referencePlan: {
    assetId: "corrupt-asset",
    referenceRevision: "revision-corrupt-asset",
    source: { kind: "image", originalMimeType: "image/png" },
    widthPx: 100,
    heightPx: 100,
    transform: {
      originWorld: { x: 0, y: 0 },
      millimetersPerPixel: 10,
      rotationDeg: 0,
    },
    calibration: {
      pointA: { x: 0, y: 0 },
      pointB: { x: 100, y: 0 },
      knownLengthMm: 1000,
      alignment: "none",
    },
    display: { visible: true, opacity: 0.5, locked: true },
  },
};

async function openSetupPage(page) {
  await page.route(`**${SETUP_PATH}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>IndexedDB corruption setup</body></html>",
    });
  });
  await page.goto(SETUP_PATH);
}

async function closeSetupPage(page) {
  await page.unroute(`**${SETUP_PATH}`);
}

async function openCurrentDatabase(page) {
  return page.evaluate((dbName) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 3);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB corruption setup open failed"));
    request.onblocked = () => reject(new Error("IndexedDB corruption setup open blocked"));
    request.onupgradeneeded = () => {
      const database = request.result;
      const projects = database.createObjectStore("projects", { keyPath: "id" });
      projects.createIndex("updatedAt", "updatedAt", { unique: false });
      database.createObjectStore("settings", { keyPath: "key" });
      const assets = database.createObjectStore("assets", { keyPath: "id" });
      assets.createIndex("projectId", "projectId", { unique: false });
      const sessions = database.createObjectStore("recognitionSessions", { keyPath: "id" });
      sessions.createIndex("projectId", "projectId", { unique: true });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  }), DB_NAME);
}

async function seedProjectAndSetting(page, project) {
  await page.evaluate(({ dbName, storedProject }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB corruption metadata open failed"));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["projects", "settings"], "readwrite");
      transaction.objectStore("projects").put(storedProject);
      transaction.objectStore("settings").put({ key: "lastProjectId", value: storedProject.id });
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB corruption metadata seed failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB corruption metadata seed aborted"));
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    };
  }), { dbName: DB_NAME, storedProject: project });
}

async function seedCorruptedProject(page) {
  await openSetupPage(page);
  await openCurrentDatabase(page);
  await seedProjectAndSetting(page, CORRUPTED_PROJECT);
  await closeSetupPage(page);
}

async function seedCorruptedAsset(page) {
  await openSetupPage(page);
  await openCurrentDatabase(page);
  await seedProjectAndSetting(page, PROJECT_WITH_CORRUPTED_ASSET);
  await page.evaluate(({ dbName, projectId, assetId }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB corrupt asset open failed"));
    request.onsuccess = () => {
      const database = request.result;
      const blob = new Blob(["asset"], { type: "image/png" });
      const transaction = database.transaction("assets", "readwrite");
      transaction.objectStore("assets").put({
        id: assetId,
        projectId,
        kind: "reference-raster",
        mimeType: "image/png",
        byteLength: blob.size + 1,
        createdAt: NOW,
        blob,
      });
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB corrupt asset seed failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB corrupt asset seed aborted"));
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    };
  }), {
    dbName: DB_NAME,
    projectId: PROJECT_WITH_CORRUPTED_ASSET.id,
    assetId: PROJECT_WITH_CORRUPTED_ASSET.referencePlan.assetId,
  });
  await closeSetupPage(page);
}

test("fails closed with a user-facing recovery state for a corrupted persisted project", async ({ page }) => {
  await seedCorruptedProject(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Не удалось открыть локальные проекты" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Локальный проект повреждён и не был открыт.");
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
});

test("fails closed with a user-facing recovery state for a corrupted persisted reference asset", async ({ page }) => {
  await seedCorruptedAsset(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Не удалось открыть локальные проекты" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Подложка проекта повреждена и не была открыта.");
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
  await expect(page.getByLabel("Название проекта")).toHaveCount(0);
});
