# P0 IndexedDB Testing Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` with deterministic adapter failure contracts plus native Chromium/WebKit schema, persistence, upgrade, corruption and data-isolation evidence, fixing production code only when a focused automated contract proves a real defect.

**Architecture:** Keep `IndexedDbProjectRepository` and schema v3 unchanged unless a genuine failing contract proves otherwise. Vitest uses a deliberately narrow event-driven `IDBFactory`/request/transaction harness only for rare controllable failure branches. Playwright uses real browser IndexedDB for fresh schema, v1 -> v3, v2 -> v3, reload persistence, assets, corruption and recognition-session preservation. Browser setup gets same-origin storage access through a Playwright-fulfilled HTML route, not a product route or production test hook.

**Tech Stack:** TypeScript 6.0.3, Vitest 4.1.10, V8 coverage, Node >=22.13.0 / CI Node 22.16.0, pnpm 11.15.1, Playwright 1.54.2, native IndexedDB, Next.js 16, GitHub Actions.

## Non-negotiable constraints

- Implementation starts from the then-current integrated `main`; approved design base is `cc594bae218e9e16724d7574f48be8886852e7ad`.
- Do not implement on `docs/p0-indexeddb-testing-design`. Create a new implementation branch from current `main` and carry only the approved spec/plan docs forward.
- Database remains `vlezet`, version `3`; no version bump or schema redesign merely to enable testing.
- v1 -> v3 and v2 -> v3 are mandatory real-browser contracts in **both** Chromium and WebKit.
- The complete `m8-indexeddb-persistence.spec.mjs` is mandatory in `WEBKIT_SPECS`; no silent smaller subset.
- Chromium/WebKit retries remain `0`, workers remain `1`, and the shared `./fixtures.mjs` runtime guard remains active.
- `page.evaluate` may prepare or inspect storage, but user-visible save -> reload -> restore must run through normal product UI/lifecycle.
- No production debug route, reset endpoint, query flag, fault switch, test mode or private-helper export.
- Do not add `fake-indexeddb` initially. If the deterministic harness starts reproducing persistence semantics, stop and request a design change instead of growing an emulator.
- Existing correct historical behavior may start GREEN and is recorded as characterization. Do not fabricate RED.
- A real defect requires preserved focused RED evidence before the smallest production fix, followed by the exact same test GREEN.
- Changed critical persistence production code must satisfy 100% changed lines/statements/functions and >=95% changed branches. Other changed production code obeys the applicable Phase A threshold.
- Coverage/baseline movement is measured and upward-only. Never hand-edit coverage percentages or weaken thresholds/validators/assertions.
- `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` stays OPEN until all mandatory exact-head evidence exists.

## Verified current interfaces

The plan relies only on interfaces verified on integrated `main`:

- `packages/projects/src/indexeddb.ts`: `createIndexedDbProjectRepository`, `IndexedDbProjectRepository`, `ProjectStorageError`; private open/request/transaction helpers stay private.
- schema v3 stores: `projects`, `settings`, `assets`, `recognitionSessions`; indexes `projects.updatedAt`, `assets.projectId`, unique `recognitionSessions.projectId`.
- historical DB boundaries: M3 v1 (`projects`, `settings`), M4 v2 (+`assets` / `projectId`), M4.5 v3 (+`recognitionSessions` / unique `projectId`).
- `ProjectApp` creates the real IndexedDB repository, autosaves after 150 ms, persists `lastProjectId`, and auto-opens the last project.
- editor project-name input: `aria-label="Название проекта"`; saved indicator: `Сохранено локально`; back button: `aria-label="Вернуться к моим проектам"`.
- dashboard heading: `Планировки, к которым можно вернуться`; create button: `Новый проект`; project actions include `Удалить`; confirm action: `Удалить проект`.
- Chromium auto-discovers `**/*.spec.mjs`; WebKit uses machine-checked `WEBKIT_SPECS`.

## Files

Create:

- `packages/projects/src/indexeddb.test.ts`
- `packages/projects/src/indexeddb.test-support.ts`
- `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`

Modify:

- `tools/testing-policy/browser-policy.test.mjs`
- `tools/testing-policy/browser-policy.mjs`
- `docs/testing/TEST_COVERAGE_AUDIT.md` only after evidence exists
- `tools/testing-policy/coverage-baseline.json` only via generator after final coverage
- `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md` for truthful final state sync

Modify production only after genuine RED evidence:

- `packages/projects/src/indexeddb.ts`
- `packages/projects/src/indexeddb-schema.ts` only for a proven schema defect
- the exact web error boundary file only if a browser corruption contract proves handled local corruption is incorrectly emitted as an unexpected runtime console error

---

### Task 1: Bootstrap the implementation branch and characterize open lifecycle

**Files:**
- Create: `packages/projects/src/indexeddb.test.ts`
- Create: `packages/projects/src/indexeddb.test-support.ts`
- Read only initially: `packages/projects/src/indexeddb.ts`

- [ ] **Step 1: Create an isolated implementation branch from current main**

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c test/p0-indexeddb-remediation
BASE_SHA=$(git rev-parse HEAD)
printf '%s\n' "$BASE_SHA"
```

Before carrying docs forward:

```bash
git diff --name-only origin/main...origin/docs/p0-indexeddb-testing-design
```

Expected docs-only paths:

```text
docs/superpowers/specs/2026-08-14-p0-indexeddb-testing-design.md
docs/superpowers/plans/2026-08-15-p0-indexeddb-testing-remediation.md
```

Cherry-pick only the approved docs commits needed to obtain those two files. Re-run `git diff --name-only "$BASE_SHA"...HEAD` and verify no production/test implementation came from the docs branch.

- [ ] **Step 2: Add the narrow deterministic event harness**

Create `packages/projects/src/indexeddb.test-support.ts` with only scripted event controls:

```ts
export type RequestController<T> = Readonly<{
  request: IDBRequest<T>;
  succeed(value: T): void;
  fail(error: DOMException): void;
}>;

export function controlledRequest<T>(): RequestController<T> {
  let result: T;
  let error: DOMException | null = null;
  const target: {
    result?: T;
    error: DOMException | null;
    onsuccess: ((event: Event) => unknown) | null;
    onerror: ((event: Event) => unknown) | null;
  } = { error: null, onsuccess: null, onerror: null };

  Object.defineProperties(target, {
    result: { get: () => result },
    error: { get: () => error },
  });

  const request = target as unknown as IDBRequest<T>;
  return {
    request,
    succeed(value) {
      result = value;
      request.onsuccess?.({} as Event);
    },
    fail(cause) {
      error = cause;
      request.onerror?.({} as Event);
    },
  };
}

export type TransactionController = Readonly<{
  transaction: IDBTransaction;
  complete(): void;
  abort(error: DOMException): void;
  fail(error: DOMException): void;
}>;
```

Implement `TransactionController` with only `objectStore(name)`, `error`, `oncomplete`, `onabort`, `onerror`. Accept a `ReadonlyMap<string, IDBObjectStore>` in its constructor/helper; unknown store names throw. Do not implement cursors, key ranges, database versions or persistence.

Add an `OpenController` whose factory `open()` returns one writable `IDBOpenDBRequest` double with `onsuccess`, `onerror`, `onblocked`; expose methods `succeed(database)`, `fail(error)`, `block()`. Do not emulate `onupgradeneeded` here; real schema upgrade belongs to Playwright.

Add `databaseWithTransaction(factory)` returning an `IDBDatabase` double with writable `onversionchange`, `close`, and `transaction()` delegated to the supplied factory. This is enough for public repository calls and versionchange characterization.

- [ ] **Step 3: Add exact unsupported/open failure characterization tests**

Create `packages/projects/src/indexeddb.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject, createProjectAsset } from "./index";
import {
  ProjectStorageError,
  createIndexedDbProjectRepository,
} from "./indexeddb";
import {
  controlledOpen,
  controlledRequest,
  controlledTransaction,
  databaseWithTransaction,
} from "./indexeddb.test-support";

afterEach(() => vi.unstubAllGlobals());

describe("IndexedDbProjectRepository", () => {
  it("fails explicitly when IndexedDB is unavailable", () => {
    vi.stubGlobal("indexedDB", undefined);
    expect(() => createIndexedDbProjectRepository()).toThrow(
      "Этот браузер не поддерживает локальное хранилище проектов.",
    );
  });

  it("wraps a synchronous factory.open exception", async () => {
    const cause = new Error("open exploded");
    const factory = { open: () => { throw cause; } } as unknown as IDBFactory;
    const repository = createIndexedDbProjectRepository(factory);
    await expect(repository.list()).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось открыть локальное хранилище проектов.",
      cause,
    });
  });
});
```

Add asynchronous open error and blocked tests using `controlledOpen()`:

```ts
const open = controlledOpen();
const repository = createIndexedDbProjectRepository(open.factory);
const pending = repository.list();
open.fail(new DOMException("open failed", "UnknownError"));
await expect(pending).rejects.toMatchObject({
  name: "ProjectStorageError",
  message: "Не удалось открыть локальное хранилище проектов.",
});
```

and:

```ts
open.block();
await expect(pending).rejects.toMatchObject({
  name: "ProjectStorageError",
  message: "Закройте другие вкладки Vlezet и попробуйте снова.",
});
```

- [ ] **Step 4: Run focused tests and classify them honestly**

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts
```

Expected for already-correct historical behavior: PASS. Label those tests characterization, not RED.

If any contract fails because current behavior is wrong, commit the focused failing test/support first and save the exact failure as RED. Do not modify production in the same commit.

- [ ] **Step 5: Characterize successful open and `versionchange` close**

Create a `getAll` request, readonly transaction and database double. Construct repository, call `list()`, drive open success, request success with `[]`, then transaction complete. Assert `list()` resolves `[]`.

After open succeeds, invoke the installed `database.onversionchange` handler and assert the `close` spy was called once:

```ts
expect(close).toHaveBeenCalledTimes(1);
```

No private production helper is exported.

- [ ] **Step 6: Verify focused regression + first measured coverage delta**

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts src/repository.test.ts
pnpm --dir packages/projects exec vitest run --coverage \
  --coverage.provider=v8 \
  --coverage.include='src/**/*.{ts,tsx,js,jsx,mjs,cjs}' \
  --coverage.reporter=text \
  --coverage.reporter=json \
  --coverage.reportsDirectory=coverage
```

Expected: tests PASS and `indexeddb.ts` is no longer wholly unexecuted. Do not regenerate repository baseline yet.

- [ ] **Step 7: Commit**

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts
git commit -m "test: characterize IndexedDB open lifecycle"
```

---

### Task 2: Characterize request failures, transaction failures and public repository orchestration

**Files:**
- Modify: `packages/projects/src/indexeddb.test.ts`
- Modify: `packages/projects/src/indexeddb.test-support.ts`
- Production change only after genuine RED: `packages/projects/src/indexeddb.ts`

- [ ] **Step 1: Add reusable valid project/asset factories in the test file**

Use production constructors, not hand-built domain records:

```ts
const NOW = "2026-08-15T00:00:00.000Z";

function project(id: string, updatedAt = NOW) {
  const value = createProject({ id, name: id, now: NOW });
  return { ...value, updatedAt };
}

function asset(id: string, projectId: string) {
  return createProjectAsset({
    id,
    projectId,
    mimeType: "image/png",
    createdAt: NOW,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
  });
}
```

- [ ] **Step 2: Add generic and contextual request-error contracts**

For a controlled already-open database, expose one exact request controller per public call. Test:

```ts
const pending = repository.get("project-a");
getRequest.fail(new DOMException("read failed", "UnknownError"));
await expect(pending).rejects.toMatchObject({
  name: "ProjectStorageError",
  message: "Не удалось прочитать локальные проекты.",
});
```

For asset lookup:

```ts
message: "Не удалось прочитать подложку."
```

For `deleteAssetsForProject` index `getAllKeys` failure:

```ts
message: "Не удалось прочитать подложки проекта."
```

The test explicitly emits the request error; timeout expiration is never the assertion.

- [ ] **Step 3: Add transaction complete / abort / error as independent branches**

For `put(project("p"))`, drive transaction outcomes independently:

```ts
const pending = repository.put(project("p"));
transaction.abort(new DOMException("aborted", "AbortError"));
await expect(pending).rejects.toMatchObject({
  name: "ProjectStorageError",
  message: "Не удалось сохранить изменения проекта.",
});
```

and separately:

```ts
transaction.fail(new DOMException("failed", "UnknownError"));
```

with the same public storage-error boundary. Add a completion case where transaction `complete()` resolves the write.

- [ ] **Step 4: Characterize deterministic result semantics**

Add tests for:

- `get("missing")` request result `undefined` + complete transaction -> `null`;
- `getLastProjectId()` missing setting -> `null`;
- `setLastProjectId("p")` and `setLastProjectId(null)` issue the exact settings `put` records and resolve only after transaction completion;
- `list()` receives projects `b@10:00`, `c@11:00`, `a@10:00` and returns `c, a, b`.

For `delete("project-a")`, script store operations with spies:

1. projects delete receives `project-a`;
2. assets index `getAllKeys("project-a")` returns only `asset-a-1`, `asset-a-2`;
3. both returned asset keys are deleted;
4. when settings record is `{key:"lastProjectId", value:"project-a"}`, settings writes `{key:"lastProjectId", value:null}`;
5. when it points to `project-b`, no clearing write occurs.

This proves orchestration only. Native atomicity and cross-project preservation are proven in Task 5.

- [ ] **Step 5: Characterize asset public methods**

Cover `getAsset`, `putAsset`, `deleteAsset`, `deleteAssetsForProject` with scripted request/transaction completion and exact return/null semantics. Validate that `putAsset` receives a production-validated asset from `createProjectAsset`.

- [ ] **Step 6: Run focused tests and preserve any real RED before production fixes**

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts
```

If a new contract fails against current production, commit the focused failing test/support first:

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts
git commit -m "test: expose IndexedDB <specific defect>"
```

Then apply only the smallest corresponding production change, rerun the exact named test and full `indexeddb.test.ts`, and commit separately:

```bash
git add packages/projects/src/indexeddb.ts
git commit -m "fix: <specific IndexedDB defect>"
```

- [ ] **Step 7: Commit GREEN characterization/failure coverage**

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts
git commit -m "test: cover IndexedDB failure contracts"
```

---

### Task 3: Make IndexedDB browser acceptance impossible to omit from WebKit

**Files:**
- Modify: `tools/testing-policy/browser-policy.test.mjs`
- Modify after RED: `tools/testing-policy/browser-policy.mjs`
- Create after RED: `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`

- [ ] **Step 1: Add policy RED**

Append the required filename to the explicit expected `WEBKIT_SPECS` list in `browser-policy.test.mjs` and add:

```js
test("requires IndexedDB persistence evidence in WebKit", () => {
  assert.ok(WEBKIT_SPECS.includes("m8-indexeddb-persistence.spec.mjs"));
});
```

- [ ] **Step 2: Run and record genuine RED**

```bash
pnpm test:policy
```

Expected: FAIL because current `WEBKIT_SPECS` lacks the new P0 spec. Commit only the failing policy test:

```bash
git add tools/testing-policy/browser-policy.test.mjs
git commit -m "test: require IndexedDB WebKit acceptance"
```

- [ ] **Step 3: Minimal GREEN registration + executable smoke spec**

Append exactly:

```js
"m8-indexeddb-persistence.spec.mjs",
```

to `WEBKIT_SPECS` in `browser-policy.mjs`.

Create `m8-indexeddb-persistence.spec.mjs` using only:

```js
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
```

This gives a real `http://127.0.0.1:3000` origin without loading `ProjectApp`; it does **not** create a production route.

Initial smoke test uses Playwright's fresh BrowserContext (new per test), so no database deletion race exists:

```js
test("persists a project through native browser IndexedDB", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.getByLabel("Название проекта")).toHaveValue("Моя квартира");
});
```

- [ ] **Step 4: Run policy GREEN**

```bash
pnpm test:policy
```

Expected: PASS, including the explicit IndexedDB WebKit requirement and current browser-policy contract.

- [ ] **Step 5: Run the new spec alone in both engines**

Start the real Vlezet dev server as the browser workflow does, then from `tools/m7-browser-audit`:

```bash
npx playwright test m8-indexeddb-persistence.spec.mjs
npx playwright test --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

Expected: PASS in Chromium and WebKit, retries 0, shared runtime guard active.

- [ ] **Step 6: Commit GREEN infrastructure**

```bash
git add tools/testing-policy/browser-policy.mjs tools/testing-policy/browser-policy.test.mjs tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs
git commit -m "test: register IndexedDB browser acceptance"
```

---

### Task 4: Prove fresh v3 schema, mandatory v1/v2 upgrades and v3 recognition-session preservation in native browsers

**Files:**
- Modify: `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`
- Read-only authority: `packages/projects/src/indexeddb-schema.ts`

- [ ] **Step 1: Add exact browser-side fixture factories**

Use current-valid empty document:

```js
const EMPTY_DOCUMENT = {
  schemaVersion: 3,
  vertices: [],
  walls: [],
  openings: [],
  roomAnnotations: [],
  placedObjects: [],
};
const VIEWPORT = { offsetX: 140, offsetY: 140, pixelsPerMillimeter: 0.12 };
const NOW = "2026-08-15T00:00:00.000Z";

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

function legacyV2Asset(id, projectId) {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
  return {
    id,
    projectId,
    kind: "reference-raster",
    mimeType: "image/png",
    byteLength: blob.size,
    createdAt: NOW,
    blob,
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
    walls: [], openings: [], roomLabels: [], diagnostics: [], decisions: {},
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
```

These shapes are based on verified historical/current repository schemas; do not invent alternate legacy fields.

- [ ] **Step 2: Add same-origin setup helpers that never mount the product app**

Use `openStorageSetupPage(page)`, execute native IndexedDB setup with `page.evaluate`, then `leaveStorageSetupPage(page)` and navigate to `/`.

Implement v1 setup in `onupgradeneeded`:

```js
const projects = db.createObjectStore("projects", { keyPath: "id" });
projects.createIndex("updatedAt", "updatedAt", { unique: false });
const settings = db.createObjectStore("settings", { keyPath: "key" });
projects.put(project);
settings.put({ key: "lastProjectId", value: project.id });
```

Implement v2 setup similarly, adding:

```js
const assets = db.createObjectStore("assets", { keyPath: "id" });
assets.createIndex("projectId", "projectId", { unique: false });
assets.put(asset);
```

Every IndexedDB helper resolves on request/transaction completion events and rejects on `error`/`blocked`; no arbitrary sleep.

- [ ] **Step 3: Add fresh-v3 schema contract**

On a fresh Playwright context, load `/`, wait for dashboard initialization, then inspect native DB metadata and assert:

```js
expect(schema.version).toBe(3);
expect(schema.stores).toEqual(expect.arrayContaining([
  "projects", "settings", "assets", "recognitionSessions",
]));
expect(schema.projects.updatedAt).toEqual({ keyPath: "updatedAt", unique: false });
expect(schema.assets.projectId).toEqual({ keyPath: "projectId", unique: false });
expect(schema.recognitionSessions.projectId).toEqual({ keyPath: "projectId", unique: true });
```

Close the inspection connection.

- [ ] **Step 4: Add v1 -> v3 preservation contract**

On setup page create DB version 1 with `legacyV1Project("legacy-v1", "Legacy v1")` and matching last-project setting. Then navigate to real `/`.

Current app should upgrade and auto-open the last project. Assert:

```js
await expect(page.getByLabel("Название проекта")).toHaveValue("Legacy v1");
```

Inspect DB and prove:

- version is 3;
- project still exists and ID/name match;
- setting still points to `legacy-v1`;
- `assets` exists with nonunique `projectId` index;
- `recognitionSessions` exists with unique `projectId` index.

- [ ] **Step 5: Add v2 -> v3 preservation contract**

Create DB version 2 with `legacyV2Project("legacy-v2", "Legacy v2")`, last-project setting and `legacyV2Asset("asset-v2", "legacy-v2")`. Navigate to real `/` and assert editor opens `Legacy v2`.

Inspect DB and assert project, setting and asset survived byte-for-byte in their meaningful fields, plus the v3 recognition store/index now exists.

- [ ] **Step 6: Add current-v3 recognition-session reopen preservation**

Use a fresh context, load real `/` once so production creates v3. Move to the intercepted setup page, open v3, put `recognitionSession("recognition-project")` directly into `recognitionSessions`, close DB, then navigate to real `/` again without a version change. Inspect and assert the record still exists with the same `id`, `projectId`, `referenceAssetId`, `referenceRevision` and nested draft identity.

Do not claim recognition-record preservation from v1/v2; those schemas did not have the store.

- [ ] **Step 7: Run both engines**

```bash
cd tools/m7-browser-audit
npx playwright test m8-indexeddb-persistence.spec.mjs
npx playwright test --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

Expected: all schema/upgrade/reopen tests PASS in Chromium and WebKit, retries 0.

If a real schema/upgrade defect appears, preserve that exact browser test as RED before changing production. Apply only the minimal schema/open fix and rerun the exact failing case in both engines before broader GREEN.

- [ ] **Step 8: Commit**

```bash
git add tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs
git commit -m "test: prove IndexedDB schema upgrades"
```

Any production fix is committed separately with its RED evidence.

---

### Task 5: Prove real save/reload, project/settings persistence, assets/cascade isolation and corrupted-record fail-closed behavior

**Files:**
- Modify: `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`
- Modify production only after preserved RED: exact defective boundary

- [ ] **Step 1: Add normal UI save -> reload -> restore contract**

```js
await page.goto("/");
await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
await page.getByRole("button", { name: "Новый проект" }).click();
const name = page.getByLabel("Название проекта");
await expect(name).toHaveValue("Моя квартира");
await name.fill("IndexedDB reload proof");
await name.press("Enter");
await expect(page.locator(".save-status")).toHaveText("Сохранено локально");
await page.reload();
await expect(page.getByLabel("Название проекта")).toHaveValue("IndexedDB reload proof");
```

`Сохранено локально` is the synchronization point; no fixed sleep. After the visible assertion, inspect DB as secondary evidence and verify the saved project plus `lastProjectId` refer to the same project.

- [ ] **Step 2: Prove dashboard/back last-project behavior through normal UI**

From the saved project click `Вернуться к моим проектам`, wait for dashboard heading, inspect settings and assert last-project is cleared according to current representation. Reopen the project through its accessible card action and assert reload/open restores it and last-project is set again.

Matching/nonmatching delete branches that cannot both be reached through normal UI are already deterministic public-repository contracts from Task 2; do not add a product backdoor to force them.

- [ ] **Step 3: Prove native asset isolation and project cascade deletion**

Use storage setup to create current v3 records for project A and B plus distinct valid assets, and an unrelated settings record. Keep `lastProjectId` null so the app opens dashboard. Navigate to real `/`; delete project A using dashboard `Удалить` and confirmation `Удалить проект`.

Inspect native DB and assert:

```js
expect(projectIds).not.toContain("project-a");
expect(projectIds).toContain("project-b");
expect(assetProjectIds).not.toContain("project-a");
expect(assetProjectIds).toContain("project-b");
expect(unrelatedSetting).toEqual(originalUnrelatedSetting);
```

This is the browser authority for no cross-project data loss. Independent `deleteAsset` and `deleteAssetsForProject` operation mechanics remain covered in Task 2 rather than inventing UI.

- [ ] **Step 4: Add corrupted-project browser contract**

On setup page create current v3 schema and put a malformed project such as a record with an empty/invalid `document` while keeping all unrelated DB structure valid. Navigate to real `/`.

Required public result: corrupt data is not accepted as a valid project; the app reaches its visible recovery/error boundary.

The shared fixture also requires zero unexpected `console.error`. If current code calls `console.error` for this handled local-data validation error, the browser test is a genuine RED. Preserve the RED commit/run before changing product code. Root-cause the boundary first; the likely minimal correction is to treat the existing typed project/asset validation error as handled user-facing local-data failure rather than logging it as an unexpected exception. Do not weaken `fixtures.mjs` or suppress console errors.

- [ ] **Step 5: Add corrupted-asset browser contract**

Create valid project metadata referencing an asset ID, then store a malformed asset record under that ID (for example wrong metadata/Blob contract). Configure `lastProjectId` to open the project through normal startup. Navigate to `/`.

Required result: the malformed asset is rejected by existing validation and never becomes a valid reference asset. Shared runtime guard remains clean. If the existing error boundary logs the typed validation failure with `console.error`, preserve RED and fix only that handled-error classification before rerunning.

- [ ] **Step 6: Run the complete new spec in both engines**

```bash
cd tools/m7-browser-audit
npx playwright test m8-indexeddb-persistence.spec.mjs
npx playwright test --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

Expected final result: all cases PASS in Chromium and WebKit, retries 0, no shared-runtime violations.

- [ ] **Step 7: Commit browser lifecycle/data-integrity evidence**

```bash
git add tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs
git commit -m "test: prove IndexedDB persistence lifecycle"
```

If Tasks 4-5 exposed production defects, their RED tests and minimal fixes remain separate commits before this final browser-test consolidation commit.

---

### Task 6: Measure coverage and close only meaningful remaining adapter branches

**Files:**
- Modify as evidence requires: `packages/projects/src/indexeddb.test.ts`, `indexeddb.test-support.ts`
- Generated modify only after final GREEN: `tools/testing-policy/coverage-baseline.json`
- Read: `packages/projects/coverage/coverage-final.json`

- [ ] **Step 1: Generate complete workspace coverage**

```bash
pnpm coverage
```

Inspect `packages/projects/coverage/coverage-final.json` specifically for `indexeddb.ts` and `indexeddb-schema.ts`.

- [ ] **Step 2: Classify every remaining uncovered IndexedDB location**

Use exactly these buckets in PR working evidence:

```text
A — meaningful public behavior/failure branch: add focused deterministic test
B — native-browser semantic already proven by Playwright: do not duplicate merely for V8 percentage
C — unreachable/dead/redundant production branch: separate simplification decision, no meaningless test
D — unrelated module/debt: outside this P0 slice
```

Do not build an IndexedDB emulator to turn B into unit coverage.

- [ ] **Step 3: Add only category-A tests**

For each A branch: focused test -> run focused -> full `indexeddb.test.ts` -> `pnpm coverage`. If wrong production behavior appears, preserve RED before minimal fix.

- [ ] **Step 4: Verify current coverage and changed-code gates against implementation base**

```bash
POLICY_BASE_SHA=$(git merge-base HEAD origin/main)
pnpm coverage
pnpm test:policy
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm verify:policy
```

Expected: no ratchet regression; any changed critical persistence production code passes 100/100/100/95.

- [ ] **Step 5: Generate improved baseline from measured reports only**

After all tests are final:

```bash
pnpm coverage
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm coverage:baseline
git diff -- tools/testing-policy/coverage-baseline.json
```

The generator's `sourceCommit` remains the resolved policy base by current tooling; do not hand-rewrite it to the feature head. Verify repository/projects metrics do not decrease compared with base baseline.

- [ ] **Step 6: Commit coverage accounting**

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts tools/testing-policy/coverage-baseline.json
git commit -m "test: ratchet IndexedDB coverage evidence"
```

---

### Task 7: Run full gates and synchronize canonical debt truth

**Files:**
- Modify: `docs/testing/TEST_COVERAGE_AUDIT.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Run the complete local gate before closing debt**

```bash
POLICY_BASE_SHA=$(git merge-base HEAD origin/main)
pnpm validate:m7-docs
pnpm test
pnpm coverage
pnpm test:policy
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm verify:policy
pnpm benchmark:recognition:core
pnpm typecheck
pnpm lint
pnpm build
```

Start the real app and run full browser suites, not only the IndexedDB file:

```bash
cd tools/m7-browser-audit
M7_BASE_URL=http://127.0.0.1:3000 npm run audit
M7_BASE_URL=http://127.0.0.1:3000 npm run audit:webkit
```

Expected: all PASS, retries 0.

- [ ] **Step 2: Close `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` only if every mandatory contract exists**

Update audit status to:

```text
CLOSED — exact-head automated evidence complete; product-owner acceptance pending
```

only when all approved behavior-matrix items pass. Record actual:

- implementation head SHA;
- deterministic IndexedDB test command/count;
- measured repository/projects coverage from generated data;
- Chromium test count/result;
- WebKit test count/result;
- v1 -> v3 and v2 -> v3 success in both engines;
- UI save -> reload -> restore result;
- corrupt project/asset fail-closed result;
- any genuine RED -> GREEN defect commits/runs;
- any newly discovered out-of-scope P0 debt as a separate OPEN item.

If one mandatory item is missing, debt remains OPEN.

- [ ] **Step 3: Update project state without premature acceptance/merge claims**

`PROJECT_STATE.md`, `ROADMAP.md`, `CHANGELOG.md` must distinguish:

```text
implemented: yes
tested/exact-head local evidence: yes
product-owner accepted: no
merged: no
released: no/not applicable
```

Do not state accepted/merged until those events occur.

- [ ] **Step 4: Re-run docs/policy after truth sync**

```bash
pnpm validate:m7-docs
pnpm test:policy
pnpm coverage
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm verify:policy
```

Expected: PASS.

- [ ] **Step 5: Commit canonical truth**

```bash
git add docs/testing/TEST_COVERAGE_AUDIT.md docs/PROJECT_STATE.md docs/ROADMAP.md docs/CHANGELOG.md
git commit -m "docs: record IndexedDB remediation evidence"
```

---

### Task 8: Draft PR, exact-head review, explicit acceptance and protected integration

**Files:**
- No new implementation unless exact-head verification reveals a defect.

- [ ] **Step 1: Push branch and open Draft PR**

```bash
git push -u origin test/p0-indexeddb-remediation
```

Title:

```text
test: close P0 IndexedDB persistence debt
```

PR body must separately list characterization tests, genuine RED -> GREEN defects (if any), deterministic failure evidence, native Chromium/WebKit evidence, measured coverage movement, debt state, and product-owner acceptance as pending.

- [ ] **Step 2: Require exact-head repository evidence**

On the exact PR SHA require:

```text
CI: PASS
Browser Acceptance: PASS — Chromium + complete registered WebKit suite, retries 0
Recognition Benchmark: PASS
CodeQL/security relevant to PR: PASS / no new alerts
unresolved review threads: 0
```

Record exact run IDs, artifact IDs and SHA-256 digests. Any later commit invalidates earlier exact-head evidence.

- [ ] **Step 3: Independently review final diff against approved design**

Verify:

```text
no production test hook/debug route/reset endpoint
no unapproved fake-indexeddb dependency
no database-version bump without genuine requirement
m8-indexeddb-persistence.spec.mjs is in WEBKIT_SPECS
shared fixtures import is used
no test.only / unmanaged skip / fixme
retries remain 0
no threshold/baseline/assertion weakening
no unrelated refactor
canonical debt closure matches exact-head evidence
```

If review finds a behavior defect, add a focused test first where applicable; preserve RED; fix minimally; regenerate exact-head evidence on the new SHA.

- [ ] **Step 4: Present candidate for explicit product-owner PASS**

Report separately:

```text
implemented: yes/no
tested: yes/no
debt evidence closed: yes/no
accepted: pending
merged: no
released: no/not applicable
```

Green CI does not equal acceptance.

- [ ] **Step 5: After explicit PASS, mark ready and squash-merge with expected head SHA**

Verify PR head has not moved. Use protected squash merge; no force push or protection bypass.

Suggested squash title:

```text
test: close P0 IndexedDB persistence debt
```

- [ ] **Step 6: Verify actual post-merge `main` SHA**

Fetch actual squash SHA and verify post-merge CI and CodeQL/security on that SHA. Current Browser Acceptance is PR-triggered, so preserve accepted exact-head PR browser evidence rather than claiming a nonexistent main-push browser run.

If canonical docs still say merge pending, create a docs-only truth-sync follow-up recording accepted head, squash SHA, post-merge CI/security, integrated debt closure and the next evidence-driven remediation slice.

## Final verification checklist

Before claiming completion:

```bash
pnpm validate:m7-docs
pnpm test
pnpm coverage
pnpm test:policy
POLICY_BASE_SHA=<exact-main-base-sha> pnpm verify:policy
pnpm benchmark:recognition:core
pnpm typecheck
pnpm lint
pnpm build
```

and full Chromium + WebKit browser suites from `tools/m7-browser-audit`, retries 0.

No completion claim is valid without fresh exact-head output. Characterization GREEN must never be rewritten as historical RED, and any real defect must retain its pre-fix failure evidence.