import { expect, test } from "./fixtures.mjs";

const DB_NAME = "vlezet";
const SETUP_PATH = "/__playwright-idb-setup";
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

function legacyV1Project(id, name) {
  return {
    storageVersion: 1,
    id,
    name,
    createdAt: NOW,
    updatedAt: NOW,
    document: EMPTY_DOCUMENT,
    viewport: VIEWPORT,
    ui: { furnitureCatalogOpen: true },
  };
}

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

function recognitionSession(projectId) {
  const draft = {
    id: "draft-v3",
    projectId,
    referenceAssetId: "reference-v3",
    referenceRevision: "revision-v3",
    engineVersion: "test-engine",
    status: "local-complete",
    walls: [],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: {},
    source: { local: true, cloud: false },
    createdAt: NOW,
    updatedAt: NOW,
  };
  return {
    id: "session-v3",
    projectId,
    referenceAssetId: draft.referenceAssetId,
    referenceRevision: draft.referenceRevision,
    engineVersion: draft.engineVersion,
    draft,
    cloudMetadata: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function openStorageSetupPage(page) {
  await page.route(`**${SETUP_PATH}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>IndexedDB test setup</body></html>",
    });
  });
  await page.goto(SETUP_PATH);
}

async function leaveStorageSetupPage(page) {
  await page.unroute(`**${SETUP_PATH}`);
}

async function seedLegacyDatabase(page, { version, project, asset = null }) {
  await page.evaluate(async ({ dbName, version: targetVersion, project: storedProject, asset: assetInput }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, targetVersion);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB legacy open failed"));
      request.onblocked = () => reject(new Error("IndexedDB legacy open blocked"));
      request.onupgradeneeded = () => {
        const database = request.result;
        const projects = database.createObjectStore("projects", { keyPath: "id" });
        projects.createIndex("updatedAt", "updatedAt", { unique: false });
        database.createObjectStore("settings", { keyPath: "key" });
        if (targetVersion >= 2) {
          const assets = database.createObjectStore("assets", { keyPath: "id" });
          assets.createIndex("projectId", "projectId", { unique: false });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        const storeNames = ["projects", "settings", ...(targetVersion >= 2 ? ["assets"] : [])];
        const transaction = database.transaction(storeNames, "readwrite");
        transaction.objectStore("projects").put(storedProject);
        transaction.objectStore("settings").put({ key: "lastProjectId", value: storedProject.id });
        if (assetInput && targetVersion >= 2) {
          const blob = new Blob([String.fromCharCode(...assetInput.bytes)], { type: assetInput.mimeType });
          transaction.objectStore("assets").put({
            id: assetInput.id,
            projectId: assetInput.projectId,
            kind: "reference-raster",
            mimeType: assetInput.mimeType,
            byteLength: blob.size,
            createdAt: assetInput.createdAt,
            blob,
          });
        }
        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB legacy seed failed"));
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB legacy seed aborted"));
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
      };
    });
  }, { dbName: DB_NAME, version, project, asset });
}

async function seedCurrentDatabase(page, { projects, assets = [], settings = [] }) {
  await page.evaluate(async ({ dbName, storedProjects, storedAssets, storedSettings }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 3);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB current seed open failed"));
      request.onblocked = () => reject(new Error("IndexedDB current seed open blocked"));
      request.onupgradeneeded = () => {
        const database = request.result;
        const projectStore = database.createObjectStore("projects", { keyPath: "id" });
        projectStore.createIndex("updatedAt", "updatedAt", { unique: false });
        database.createObjectStore("settings", { keyPath: "key" });
        const assetStore = database.createObjectStore("assets", { keyPath: "id" });
        assetStore.createIndex("projectId", "projectId", { unique: false });
        const sessionStore = database.createObjectStore("recognitionSessions", { keyPath: "id" });
        sessionStore.createIndex("projectId", "projectId", { unique: true });
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(["projects", "settings", "assets"], "readwrite");
        const projectStore = transaction.objectStore("projects");
        const settingsStore = transaction.objectStore("settings");
        const assetStore = transaction.objectStore("assets");
        for (const project of storedProjects) projectStore.put(project);
        for (const setting of storedSettings) settingsStore.put(setting);
        for (const asset of storedAssets) {
          const blob = new Blob([asset.content], { type: asset.mimeType });
          assetStore.put({
            id: asset.id,
            projectId: asset.projectId,
            kind: "reference-raster",
            mimeType: asset.mimeType,
            byteLength: blob.size,
            createdAt: asset.createdAt,
            blob,
          });
        }
        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB current seed failed"));
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB current seed aborted"));
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
      };
    });
  }, {
    dbName: DB_NAME,
    storedProjects: projects,
    storedAssets: assets,
    storedSettings: settings,
  });
}

async function schemaSnapshot(page) {
  return page.evaluate((dbName) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB inspect open failed"));
    request.onblocked = () => reject(new Error("IndexedDB inspect open blocked"));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["projects", "assets", "recognitionSessions"], "readonly");
      const projects = transaction.objectStore("projects");
      const assets = transaction.objectStore("assets");
      const sessions = transaction.objectStore("recognitionSessions");
      const snapshot = {
        version: database.version,
        stores: Array.from(database.objectStoreNames).sort(),
        projectsIndexes: Array.from(projects.indexNames).sort(),
        updatedAtUnique: projects.index("updatedAt").unique,
        assetsIndexes: Array.from(assets.indexNames).sort(),
        assetProjectIdUnique: assets.index("projectId").unique,
        recognitionIndexes: Array.from(sessions.indexNames).sort(),
        recognitionProjectIdUnique: sessions.index("projectId").unique,
      };
      database.close();
      resolve(snapshot);
    };
  }), DB_NAME);
}

async function readStorageEvidence(page, { projectId, assetId = null, sessionId = null }) {
  return page.evaluate(({ dbName, projectId: requestedProjectId, assetId: requestedAssetId, sessionId: requestedSessionId }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB evidence open failed"));
    request.onblocked = () => reject(new Error("IndexedDB evidence open blocked"));
    request.onsuccess = () => {
      const database = request.result;
      const storeNames = ["projects", "settings", ...(requestedAssetId ? ["assets"] : []), ...(requestedSessionId ? ["recognitionSessions"] : [])];
      const transaction = database.transaction(storeNames, "readonly");
      const reads = {
        project: transaction.objectStore("projects").get(requestedProjectId),
        setting: transaction.objectStore("settings").get("lastProjectId"),
        asset: requestedAssetId ? transaction.objectStore("assets").get(requestedAssetId) : null,
        session: requestedSessionId ? transaction.objectStore("recognitionSessions").get(requestedSessionId) : null,
      };
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB evidence read failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB evidence read aborted"));
      transaction.oncomplete = () => {
        const rawAsset = reads.asset?.result;
        const rawSession = reads.session?.result;
        const evidence = {
          project: reads.project.result ?? null,
          setting: reads.setting.result ?? null,
          asset: rawAsset ? {
            id: rawAsset.id,
            projectId: rawAsset.projectId,
            kind: rawAsset.kind,
            mimeType: rawAsset.mimeType,
            byteLength: rawAsset.byteLength,
            createdAt: rawAsset.createdAt,
            blobSize: rawAsset.blob?.size ?? null,
            blobType: rawAsset.blob?.type ?? null,
          } : null,
          session: rawSession ? {
            id: rawSession.id,
            projectId: rawSession.projectId,
            draftId: rawSession.draft?.id ?? null,
            draftProjectId: rawSession.draft?.projectId ?? null,
            referenceRevision: rawSession.referenceRevision,
          } : null,
        };
        database.close();
        resolve(evidence);
      };
    };
  }), { dbName: DB_NAME, projectId, assetId, sessionId });
}

async function readSetting(page, key) {
  return page.evaluate(({ dbName, settingKey }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB setting open failed"));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("settings", "readonly");
      const get = transaction.objectStore("settings").get(settingKey);
      get.onerror = () => reject(get.error ?? new Error("IndexedDB setting read failed"));
      get.onsuccess = () => {
        const value = get.result ?? null;
        database.close();
        resolve(value);
      };
    };
  }), { dbName: DB_NAME, settingKey: key });
}

async function readFirstProject(page) {
  return page.evaluate((dbName) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB project inspect failed"));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("projects", "readonly");
      const getAll = transaction.objectStore("projects").getAll();
      getAll.onerror = () => reject(getAll.error ?? new Error("IndexedDB project list failed"));
      getAll.onsuccess = () => {
        const value = getAll.result[0] ?? null;
        database.close();
        resolve(value);
      };
    };
  }), DB_NAME);
}

async function putRecognitionSession(page, session) {
  await page.evaluate(({ dbName, session: storedSession }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB session open failed"));
    request.onblocked = () => reject(new Error("IndexedDB session open blocked"));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("recognitionSessions", "readwrite");
      transaction.objectStore("recognitionSessions").put(storedSession);
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB session write failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB session write aborted"));
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    };
  }), { dbName: DB_NAME, session });
}

test("creates the current native IndexedDB schema", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  const schema = await schemaSnapshot(page);
  expect(schema).toEqual({
    version: 3,
    stores: ["assets", "projects", "recognitionSessions", "settings"],
    projectsIndexes: ["updatedAt"],
    updatedAtUnique: false,
    assetsIndexes: ["projectId"],
    assetProjectIdUnique: false,
    recognitionIndexes: ["projectId"],
    recognitionProjectIdUnique: true,
  });
});

test("upgrades a native v1 database to v3 without losing project or lastProjectId", async ({ page }) => {
  const project = legacyV1Project("legacy-v1", "Legacy v1");
  await openStorageSetupPage(page);
  await seedLegacyDatabase(page, { version: 1, project });
  await leaveStorageSetupPage(page);

  await page.goto("/");
  await expect(page.getByLabel("Название проекта")).toHaveValue("Legacy v1");
  expect(await schemaSnapshot(page)).toMatchObject({ version: 3 });

  const evidence = await readStorageEvidence(page, { projectId: project.id });
  expect(evidence.project).toMatchObject({ id: project.id, name: project.name, storageVersion: 1 });
  expect(evidence.setting).toEqual({ key: "lastProjectId", value: project.id });
});

test("upgrades a native v2 database to v3 without losing project, setting, or asset", async ({ page }) => {
  const project = legacyV2Project("legacy-v2", "Legacy v2");
  const asset = {
    id: "asset-v2",
    projectId: project.id,
    mimeType: "image/png",
    createdAt: NOW,
    bytes: [1, 2, 3, 4],
  };
  await openStorageSetupPage(page);
  await seedLegacyDatabase(page, { version: 2, project, asset });
  await leaveStorageSetupPage(page);

  await page.goto("/");
  await expect(page.getByLabel("Название проекта")).toHaveValue("Legacy v2");
  expect(await schemaSnapshot(page)).toMatchObject({ version: 3 });

  const evidence = await readStorageEvidence(page, { projectId: project.id, assetId: asset.id });
  expect(evidence.project).toMatchObject({ id: project.id, name: project.name, storageVersion: 2 });
  expect(evidence.setting).toEqual({ key: "lastProjectId", value: project.id });
  expect(evidence.asset).toEqual({
    id: asset.id,
    projectId: project.id,
    kind: "reference-raster",
    mimeType: "image/png",
    byteLength: 4,
    createdAt: NOW,
    blobSize: 4,
    blobType: "image/png",
  });
});

test("preserves a current recognition session across a real application reopen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.getByLabel("Название проекта")).toHaveValue("Моя квартира");

  const projectId = await page.evaluate((dbName) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB project inspect failed"));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("projects", "readonly");
      const getAll = transaction.objectStore("projects").getAll();
      getAll.onerror = () => reject(getAll.error ?? new Error("IndexedDB project list failed"));
      getAll.onsuccess = () => {
        const id = getAll.result[0]?.id;
        database.close();
        if (!id) reject(new Error("Created project was not persisted"));
        else resolve(id);
      };
    };
  }), DB_NAME);

  await openStorageSetupPage(page);
  const session = recognitionSession(projectId);
  await putRecognitionSession(page, session);
  await leaveStorageSetupPage(page);

  await page.goto("/");
  await expect(page.getByLabel("Название проекта")).toHaveValue("Моя квартира");
  const evidence = await readStorageEvidence(page, { projectId, sessionId: session.id });
  expect(evidence.session).toEqual({
    id: session.id,
    projectId,
    draftId: session.draft.id,
    draftProjectId: projectId,
    referenceRevision: session.referenceRevision,
  });
});

test("persists project edits and last-project navigation through the real UI", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();

  const nameField = page.getByLabel("Название проекта");
  await expect(nameField).toHaveValue("Моя квартира");
  await nameField.fill("IndexedDB reload proof");
  await nameField.press("Enter");

  await expect.poll(async () => (await readFirstProject(page))?.name ?? null).toBe("IndexedDB reload proof");
  const projectId = (await readFirstProject(page)).id;
  expect(await readSetting(page, "lastProjectId")).toEqual({ key: "lastProjectId", value: projectId });

  await page.reload();
  await expect(page.getByLabel("Название проекта")).toHaveValue("IndexedDB reload proof");

  await page.getByRole("button", { name: "Вернуться к моим проектам" }).click();
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  expect(await readSetting(page, "lastProjectId")).toEqual({ key: "lastProjectId", value: null });

  await page.getByRole("button", { name: "Открыть проект IndexedDB reload proof" }).click();
  await expect(page.getByLabel("Название проекта")).toHaveValue("IndexedDB reload proof");
  await expect.poll(async () => (await readSetting(page, "lastProjectId"))?.value ?? null).toBe(projectId);
});

test("deleting one project removes only its own assets and preserves unrelated state", async ({ page }) => {
  const projectA = legacyV2Project("project-a", "Project A");
  const projectB = legacyV2Project("project-b", "Project B");
  const assetA = { id: "asset-a", projectId: projectA.id, mimeType: "image/png", createdAt: NOW, content: "AAAA" };
  const assetB = { id: "asset-b", projectId: projectB.id, mimeType: "image/png", createdAt: NOW, content: "BBBB" };

  await openStorageSetupPage(page);
  await seedCurrentDatabase(page, {
    projects: [projectA, projectB],
    assets: [assetA, assetB],
    settings: [
      { key: "lastProjectId", value: null },
      { key: "unrelated", value: "preserve-me" },
    ],
  });
  await leaveStorageSetupPage(page);

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Открыть проект Project A" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Открыть проект Project B" })).toBeVisible();
  await page.getByLabel("Действия с проектом Project A").getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByRole("heading", { name: "Удалить проект?" })).toBeVisible();
  await page.getByRole("button", { name: "Удалить проект" }).click();

  await expect(page.getByRole("button", { name: "Открыть проект Project A" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Открыть проект Project B" })).toBeVisible();

  const removed = await readStorageEvidence(page, { projectId: projectA.id, assetId: assetA.id });
  const preserved = await readStorageEvidence(page, { projectId: projectB.id, assetId: assetB.id });
  expect(removed.project).toBeNull();
  expect(removed.asset).toBeNull();
  expect(preserved.project).toMatchObject({ id: projectB.id, name: projectB.name });
  expect(preserved.asset).toMatchObject({ id: assetB.id, projectId: projectB.id, blobSize: 4 });
  expect(await readSetting(page, "unrelated")).toEqual({ key: "unrelated", value: "preserve-me" });
});
