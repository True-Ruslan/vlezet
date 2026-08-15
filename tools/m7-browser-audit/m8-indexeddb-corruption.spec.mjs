import { expect, test } from "./fixtures.mjs";

const DB_NAME = "vlezet";
const SETUP_PATH = "/__playwright-idb-corruption-setup";
const NOW = "2026-08-15T00:00:00.000Z";

const CORRUPTED_PROJECT = {
  storageVersion: 2,
  id: "corrupt-project",
  name: 42,
  createdAt: NOW,
  updatedAt: NOW,
  document: {
    schemaVersion: 3,
    vertices: [],
    walls: [],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  },
  viewport: { offsetX: 140, offsetY: 140, pixelsPerMillimeter: 0.12 },
  ui: { furnitureCatalogOpen: true, referencePanelOpen: false },
  referencePlan: null,
};

async function seedCorruptedProject(page) {
  await page.route(`**${SETUP_PATH}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>IndexedDB corruption setup</body></html>",
    });
  });
  await page.goto(SETUP_PATH);
  await page.evaluate(async ({ dbName, project }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 3);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB corruption setup open failed"));
      request.onblocked = () => reject(new Error("IndexedDB corruption setup open blocked"));
      request.onupgradeneeded = () => {
        const upgradeDatabase = request.result;
        const projects = upgradeDatabase.createObjectStore("projects", { keyPath: "id" });
        projects.createIndex("updatedAt", "updatedAt", { unique: false });
        upgradeDatabase.createObjectStore("settings", { keyPath: "key" });
        const assets = upgradeDatabase.createObjectStore("assets", { keyPath: "id" });
        assets.createIndex("projectId", "projectId", { unique: false });
        const sessions = upgradeDatabase.createObjectStore("recognitionSessions", { keyPath: "id" });
        sessions.createIndex("projectId", "projectId", { unique: true });
      };
      request.onsuccess = () => resolve(request.result);
    });

    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(["projects", "settings"], "readwrite");
        transaction.objectStore("projects").put(project);
        transaction.objectStore("settings").put({ key: "lastProjectId", value: project.id });
        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB corruption seed failed"));
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB corruption seed aborted"));
        transaction.oncomplete = resolve;
      });
    } finally {
      database.close();
    }
  }, { dbName: DB_NAME, project: CORRUPTED_PROJECT });
  await page.unroute(`**${SETUP_PATH}`);
}

test("fails closed with a user-facing recovery state for a corrupted persisted project", async ({ page }) => {
  await seedCorruptedProject(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Не удалось открыть локальные проекты" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Локальный проект повреждён и не был открыт." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
});
