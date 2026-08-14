import { expect, test } from "./fixtures.mjs";

const DB_NAME = "vlezet";
const SETUP_PATH = "/__playwright-idb-setup";

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

test("persists a project through native browser IndexedDB", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.getByLabel("Название проекта")).toHaveValue("Моя квартира");

  await openStorageSetupPage(page);
  const version = await page.evaluate((dbName) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
    request.onsuccess = () => {
      const database = request.result;
      const value = database.version;
      database.close();
      resolve(value);
    };
  }), DB_NAME);
  expect(version).toBe(3);
  await leaveStorageSetupPage(page);
});
