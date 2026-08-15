# P0 IndexedDB Testing Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` with deterministic adapter failure contracts plus native Chromium/WebKit schema, persistence, upgrade, corruption and data-isolation evidence, fixing production code only when a focused automated contract proves a real defect.

**Architecture:** Keep `IndexedDbProjectRepository` and database schema v3 unchanged unless a genuine failing contract proves otherwise. Vitest uses a deliberately narrow event-driven `IDBFactory`/request/transaction harness only for rare controllable failure branches. Playwright uses real browser IndexedDB for fresh schema, v1 -> v3, v2 -> v3, reload persistence, assets, corruption and recognition-session preservation. Browser setup gets same-origin storage access through a Playwright-fulfilled HTML route, not a product route or production test hook.

**Tech Stack:** TypeScript 6.0.3, Vitest 4.1.10, V8 coverage, Node >=22.13.0 / CI Node 22.16.0, pnpm 11.15.1, Playwright 1.54.2, native IndexedDB, Next.js 16, GitHub Actions.

## Constraints

- Start implementation from the then-current integrated `main`; the approved design base is `cc594bae218e9e16724d7574f48be8886852e7ad`.
- Do not implement on `docs/p0-indexeddb-testing-design`. Create a new implementation branch from current `main` and carry only approved spec/plan docs forward.
- Database remains `vlezet`, version `3`; no version bump or schema redesign merely for testing.
- v1 -> v3 and v2 -> v3 are mandatory real-browser contracts in both Chromium and WebKit.
- The complete `m8-indexeddb-persistence.spec.mjs` is mandatory in `WEBKIT_SPECS`.
- Chromium/WebKit retries stay `0`, workers stay `1`, and shared `./fixtures.mjs` runtime guards remain active.
- `page.evaluate` may prepare/inspect storage; user-visible save -> reload -> restore must run through normal product UI/lifecycle.
- No production debug route, reset endpoint, query flag, fault switch, test mode or private-helper export.
- Do not add `fake-indexeddb` initially. If the deterministic harness starts reproducing persistence semantics, stop and request a design change instead of growing an emulator.
- Correct historical behavior may start GREEN and is recorded as characterization. Never fabricate RED.
- A real defect requires preserved focused RED evidence before the smallest production fix, followed by the exact same contract GREEN.
- Changed critical persistence production code must satisfy 100% changed lines/statements/functions and >=95% changed branches. Other changed production code follows its applicable Phase A threshold.
- Coverage/baseline movement is measured and upward-only. Never hand-edit coverage percentages or weaken thresholds, validators or assertions.
- `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` remains OPEN until every mandatory exact-head evidence item exists.

## Verified interfaces

- `packages/projects/src/indexeddb.ts`: public `createIndexedDbProjectRepository`, `IndexedDbProjectRepository`, `ProjectStorageError`; private open/request/transaction helpers remain private.
- schema v3: `projects`, `settings`, `assets`, `recognitionSessions`; indexes `projects.updatedAt`, `assets.projectId`, unique `recognitionSessions.projectId`.
- history: M3 v1 (`projects`, `settings`), M4 v2 (+`assets` / `projectId`), M4.5 v3 (+`recognitionSessions` / unique `projectId`).
- `ProjectApp`: real IndexedDB repository, 150 ms autosave, `lastProjectId`, automatic last-project open.
- editor: `aria-label="Название проекта"`, saved copy `Сохранено локально`, back `aria-label="Вернуться к моим проектам"`.
- dashboard: heading `Планировки, к которым можно вернуться`, button `Новый проект`, delete action `Удалить`, confirmation `Удалить проект`.
- Chromium: `**/*.spec.mjs`; WebKit: machine-checked `WEBKIT_SPECS`.

## Files

Create:

- `packages/projects/src/indexeddb.test.ts`
- `packages/projects/src/indexeddb.test-support.ts`
- `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`

Modify:

- `tools/testing-policy/browser-policy.test.mjs`
- `tools/testing-policy/browser-policy.mjs`
- `docs/testing/TEST_COVERAGE_AUDIT.md` after evidence exists
- `tools/testing-policy/coverage-baseline.json` only via generator after final coverage
- `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md` for truthful state sync

Production files change only after genuine RED evidence:

- `packages/projects/src/indexeddb.ts`
- `packages/projects/src/indexeddb-schema.ts` only for a proven schema defect
- the exact web error-boundary file only if a corruption contract proves a handled typed local-data error is incorrectly emitted as unexpected runtime failure

---

### Task 1: Bootstrap branch and characterize open lifecycle

**Files:** create `packages/projects/src/indexeddb.test.ts`, `packages/projects/src/indexeddb.test-support.ts`; initially read-only `packages/projects/src/indexeddb.ts`.

- [ ] **Step 1: Create implementation branch from current main**

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c test/p0-indexeddb-remediation
BASE_SHA=$(git rev-parse HEAD)
printf '%s\n' "$BASE_SHA"
git diff --name-only origin/main...origin/docs/p0-indexeddb-testing-design
```

Expected docs-branch diff contains only:

```text
docs/superpowers/specs/2026-08-14-p0-indexeddb-testing-design.md
docs/superpowers/plans/2026-08-15-p0-indexeddb-testing-remediation.md
```

Carry only those approved docs commits/files forward. Verify:

```bash
git diff --name-only "$BASE_SHA"...HEAD
```

No product/test implementation may arrive from the docs branch.

- [ ] **Step 2: Create narrow event controls in `indexeddb.test-support.ts`**

Implement only these public test-support contracts:

```ts
export type RequestController<T> = Readonly<{
  request: IDBRequest<T>;
  succeed(value: T): void;
  fail(error: DOMException): void;
}>;

export type TransactionController = Readonly<{
  transaction: IDBTransaction;
  complete(): void;
  abort(error: DOMException): void;
  fail(error: DOMException): void;
}>;

export type OpenController = Readonly<{
  factory: IDBFactory;
  succeed(database: IDBDatabase): void;
  fail(error: DOMException): void;
  block(): void;
}>;

export function controlledRequest<T>(): RequestController<T>;
export function controlledTransaction(stores: ReadonlyMap<string, IDBObjectStore>): TransactionController;
export function controlledOpen(): OpenController;
export function databaseWithTransaction(
  transactionFactory: (storeNames: string | string[], mode?: IDBTransactionMode) => IDBTransaction,
  close: () => void,
): IDBDatabase;
```

Implementation rules:

- request double exposes only `result`, `error`, `onsuccess`, `onerror`;
- transaction double exposes only `objectStore`, `error`, `oncomplete`, `onabort`, `onerror`;
- open request exposes only `onsuccess`, `onerror`, `onblocked`, `result`, `error`;
- database exposes only `transaction`, writable `onversionchange`, `close`;
- unknown object-store names throw;
- no cursor, key-range, version, index persistence or data-store emulation.

- [ ] **Step 3: Add exact unsupported/open-failure characterization**

Start `indexeddb.test.ts` with:

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
```

Unsupported global factory:

```ts
it("fails explicitly when IndexedDB is unavailable", () => {
  vi.stubGlobal("indexedDB", undefined);
  expect(() => createIndexedDbProjectRepository()).toThrow(
    "Этот браузер не поддерживает локальное хранилище проектов.",
  );
});
```

Synchronous `open()` throw:

```ts
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
```

Controlled async error:

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

Controlled blocked path:

```ts
const open = controlledOpen();
const repository = createIndexedDbProjectRepository(open.factory);
const pending = repository.list();
open.block();
await expect(pending).rejects.toMatchObject({
  name: "ProjectStorageError",
  message: "Закройте другие вкладки Vlezet и попробуйте снова.",
});
```

- [ ] **Step 4: Run focused tests and classify truthfully**

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts
```

Correct pre-existing behavior may PASS immediately and is characterization. If a contract fails because behavior is wrong, commit the failing test/support and preserve exact RED output before touching production.

- [ ] **Step 5: Characterize successful open and versionchange close**

Create a controlled `getAll` request, transaction and database. Call `repository.list()`, then drive `open.succeed(database)`, `getAll.succeed([])`, `transaction.complete()`. Assert result `[]`.

Invoke installed `database.onversionchange` and assert the supplied `close` spy ran once.

- [ ] **Step 6: Verify + commit**

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts src/repository.test.ts
pnpm --dir packages/projects exec vitest run --coverage \
  --coverage.provider=v8 \
  --coverage.include='src/**/*.{ts,tsx,js,jsx,mjs,cjs}' \
  --coverage.reporter=text \
  --coverage.reporter=json \
  --coverage.reportsDirectory=coverage
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts
git commit -m "test: characterize IndexedDB open lifecycle"
```

Do not regenerate repository baseline yet.

---

### Task 2: Characterize request, transaction, CRUD and cascade orchestration

**Files:** modify `indexeddb.test.ts`, `indexeddb.test-support.ts`; production only after preserved RED.

- [ ] **Step 1: Add valid production-built fixtures**

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

- [ ] **Step 2: Add request-error contracts**

Project read:

```ts
const pending = repository.get("project-a");
getRequest.fail(new DOMException("read failed", "UnknownError"));
await expect(pending).rejects.toMatchObject({
  name: "ProjectStorageError",
  message: "Не удалось прочитать локальные проекты.",
});
```

Asset lookup must reject with `Не удалось прочитать подложку.`. Asset-index `getAllKeys` failure inside `deleteAssetsForProject` must reject with `Не удалось прочитать подложки проекта.`. Emit events explicitly; no timeout assertions.

- [ ] **Step 3: Add independent transaction complete/abort/error contracts**

For `put(project("p"))`, independently drive:

```ts
transaction.complete();
transaction.abort(new DOMException("aborted", "AbortError"));
transaction.fail(new DOMException("failed", "UnknownError"));
```

Completion resolves. Abort and error each reject with `ProjectStorageError` and `Не удалось сохранить изменения проекта.`.

- [ ] **Step 4: Add deterministic result semantics**

Cover:

- missing project -> `null`;
- missing `lastProjectId` -> `null`;
- `setLastProjectId("p")` and `setLastProjectId(null)` write exact settings records and resolve only after transaction completion;
- list input `b@10:00`, `c@11:00`, `a@10:00` returns `c, a, b`;
- project delete issues project delete, deletes exactly asset keys returned for that project, clears `lastProjectId` only when it matches deleted project;
- `getAsset`, `putAsset`, `deleteAsset`, `deleteAssetsForProject` normal/null paths.

Task 2 proves orchestration. Native atomicity and cross-project preservation remain Task 5 browser authority.

- [ ] **Step 5: Run; preserve real RED before any production fix**

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts
```

If a contract exposes wrong production behavior:

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts
git commit -m "test: expose IndexedDB defect"
```

Apply only the smallest root-cause fix, rerun the exact failing named test and full file, then:

```bash
git add packages/projects/src/indexeddb.ts
git commit -m "fix: correct IndexedDB defect"
```

- [ ] **Step 6: Commit GREEN evidence**

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts
git commit -m "test: cover IndexedDB failure contracts"
```

---

### Task 3: Require the new P0 browser suite in WebKit with genuine policy RED -> GREEN

**Files:** modify `browser-policy.test.mjs`; after RED modify `browser-policy.mjs`; create `m8-indexeddb-persistence.spec.mjs`.

- [ ] **Step 1: Add policy RED**

Append `"m8-indexeddb-persistence.spec.mjs"` to the expected WebKit list in `browser-policy.test.mjs`, plus:

```js
test("requires IndexedDB persistence evidence in WebKit", () => {
  assert.ok(WEBKIT_SPECS.includes("m8-indexeddb-persistence.spec.mjs"));
});
```

- [ ] **Step 2: Observe and commit RED**

```bash
pnpm test:policy
```

Expected: FAIL because current `WEBKIT_SPECS` lacks the P0 spec.

```bash
git add tools/testing-policy/browser-policy.test.mjs
git commit -m "test: require IndexedDB WebKit acceptance"
```

- [ ] **Step 3: Minimal GREEN registration and spec shell**

Append exactly one entry to `WEBKIT_SPECS`:

```js
"m8-indexeddb-persistence.spec.mjs",
```

Create the new spec with shared fixtures and a same-origin setup page fulfilled only by Playwright:

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

Playwright supplies a fresh BrowserContext per test, so initial tests do not need `deleteDatabase` and cannot race a live app connection.

Smoke contract:

```js
test("persists a project through native browser IndexedDB", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.getByLabel("Название проекта")).toHaveValue("Моя квартира");
});
```

- [ ] **Step 4: Run GREEN policy and focused browsers**

```bash
pnpm test:policy
cd tools/m7-browser-audit
npx playwright test m8-indexeddb-persistence.spec.mjs
npx playwright test --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

Expected: policy PASS; Chromium PASS; WebKit PASS; retries 0.

- [ ] **Step 5: Commit**

```bash
git add tools/testing-policy/browser-policy.mjs tools/testing-policy/browser-policy.test.mjs tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs
git commit -m "test: register IndexedDB browser acceptance"
```

---

### Task 4: Prove native fresh schema, v1/v2 upgrades and recognition-session preservation

**Files:** modify `m8-indexeddb-persistence.spec.mjs`; read `indexeddb-schema.ts`.

- [ ] **Step 1: Add exact historical/current browser fixtures**

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
```

- [ ] **Step 2: Add event-driven raw IndexedDB setup/inspection helpers**

On `openStorageSetupPage(page)`, use `page.evaluate` and native `indexedDB.open`. Each helper resolves on request/transaction completion and rejects on `error`/`blocked`. No arbitrary sleeps.

v1 `onupgradeneeded` creates:

```js
const projects = db.createObjectStore("projects", { keyPath: "id" });
projects.createIndex("updatedAt", "updatedAt", { unique: false });
const settings = db.createObjectStore("settings", { keyPath: "key" });
projects.put(project);
settings.put({ key: "lastProjectId", value: project.id });
```

v2 additionally creates:

```js
const assets = db.createObjectStore("assets", { keyPath: "id" });
assets.createIndex("projectId", "projectId", { unique: false });
assets.put(asset);
```

Close every raw/inspection connection before leaving setup.

- [ ] **Step 3: Fresh-v3 schema test**

Fresh context -> real `/` -> dashboard initialized -> inspect DB. Assert version 3, all four stores, `updatedAt` nonunique, assets `projectId` nonunique, recognition `projectId` unique.

- [ ] **Step 4: v1 -> v3 preservation test**

Setup DB v1 with `legacyV1Project("legacy-v1", "Legacy v1")` and matching `lastProjectId`, then navigate to real `/`.

Assert production upgraded and auto-opened:

```js
await expect(page.getByLabel("Название проекта")).toHaveValue("Legacy v1");
```

Inspect DB: project/settings survived; assets store/index exists; recognition store/unique index exists; version 3.

- [ ] **Step 5: v2 -> v3 preservation test**

Setup DB v2 with `legacyV2Project("legacy-v2", "Legacy v2")`, matching setting and `legacyV2Asset("asset-v2", "legacy-v2")`, then real `/`.

Assert editor opens `Legacy v2`; inspect and prove project, setting and asset meaningful fields survived; recognition store/index was added.

- [ ] **Step 6: Current-v3 recognition-session reopen preservation**

Fresh context -> real `/` once to create current v3 -> intercepted setup page -> put `recognitionSession("recognition-project")` into `recognitionSessions` -> close DB -> real `/` again -> inspect and assert record identity/draft identity unchanged.

Never describe this as v1/v2 recognition-record preservation; those schemas lacked the store.

- [ ] **Step 7: Run both engines and commit**

```bash
cd tools/m7-browser-audit
npx playwright test m8-indexeddb-persistence.spec.mjs
npx playwright test --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

If a real schema/upgrade defect appears, preserve the exact test as RED before production change; fix minimally and rerun that exact case in both engines.

```bash
git add tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs
git commit -m "test: prove IndexedDB schema upgrades"
```

---

### Task 5: Prove real save/reload, settings, cascade isolation and corruption fail-closed behavior

**Files:** modify `m8-indexeddb-persistence.spec.mjs`; production only after preserved RED.

- [ ] **Step 1: Real UI save -> reload -> restore**

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

`Сохранено локально` is synchronization; no fixed sleep. After visible assertion inspect DB and confirm persisted project and `lastProjectId` refer to the same ID.

- [ ] **Step 2: Normal UI back/reopen settings lifecycle**

Click `Вернуться к моим проектам`, await dashboard, inspect that current representation of `lastProjectId` is cleared. Reopen the same project through its accessible card action and confirm project/editor plus last-project setting are restored.

Matching/nonmatching project-delete setting branches remain Task 2 deterministic public-repository contracts; do not add UI backdoors.

- [ ] **Step 3: Native cross-project asset/cascade isolation**

On setup page create current v3 schema with project A, project B, valid asset A, valid asset B and an unrelated settings record; leave `lastProjectId` null. Navigate to real `/`; delete project A using dashboard `Удалить` then confirmation `Удалить проект`.

Inspect native DB:

```js
expect(projectIds).not.toContain("project-a");
expect(projectIds).toContain("project-b");
expect(assetProjectIds).not.toContain("project-a");
expect(assetProjectIds).toContain("project-b");
expect(unrelatedSetting).toEqual(originalUnrelatedSetting);
```

This is browser authority for no cross-project data loss.

- [ ] **Step 4: Corrupted-project fail-closed browser test**

Setup valid current schema plus one malformed project record with structurally invalid `document`, then navigate to real `/`.

Required: corrupt data is not accepted as a valid project and app reaches visible recovery/error boundary. Shared fixture must still report zero unexpected `console.error`.

If current code logs this typed handled validation failure with `console.error`, preserve the browser test/run as genuine RED. Root-cause the error boundary; fix only handled-error classification so typed local-data validation is user-facing without weakening `fixtures.mjs` or validation.

- [ ] **Step 5: Corrupted-asset fail-closed browser test**

Setup valid project metadata that references an asset ID, but store malformed asset metadata/blob under that ID; set `lastProjectId` to that project. Navigate to real `/`.

Required: invalid asset is rejected and never becomes valid reference state; shared runtime guard remains clean. If typed validation is logged as unexpected console error, preserve RED before correcting only the handled-error boundary.

- [ ] **Step 6: Full new spec in both engines + commit**

```bash
cd tools/m7-browser-audit
npx playwright test m8-indexeddb-persistence.spec.mjs
npx playwright test --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

Expected final: all PASS Chromium + WebKit, retries 0, no runtime-guard violations.

```bash
git add tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs
git commit -m "test: prove IndexedDB persistence lifecycle"
```

Any production fix remains a separate RED/fix commit pair before this consolidation commit.

---

### Task 6: Measure coverage and close only meaningful remaining adapter branches

**Files:** modify deterministic tests/support as evidence requires; generated `coverage-baseline.json` only after final GREEN.

- [ ] **Step 1: Generate full coverage**

```bash
pnpm coverage
```

Inspect `packages/projects/coverage/coverage-final.json` for `indexeddb.ts` and `indexeddb-schema.ts`.

- [ ] **Step 2: Classify every remaining uncovered location**

```text
A — meaningful public behavior/failure branch: add focused deterministic test
B — native-browser semantic already proven by Playwright: do not duplicate merely for V8 percentage
C — unreachable/dead/redundant production branch: separate simplification decision; no meaningless test
D — unrelated module/debt: outside this P0 slice
```

Do not build an IndexedDB emulator to convert B into unit coverage.

- [ ] **Step 3: Add only A tests; preserve RED for wrong production behavior**

For each A branch run focused test, full `indexeddb.test.ts`, then `pnpm coverage`.

- [ ] **Step 4: Verify policy gates against implementation base**

```bash
POLICY_BASE_SHA=$(git merge-base HEAD origin/main)
pnpm coverage
pnpm test:policy
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm verify:policy
```

- [ ] **Step 5: Generate improved baseline from measured reports only**

```bash
pnpm coverage
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm coverage:baseline
git diff -- tools/testing-policy/coverage-baseline.json
```

Current generator deliberately records resolved policy-base SHA as `sourceCommit`; do not hand-rewrite it to feature HEAD. Verify repository/projects metrics do not decrease from base baseline.

- [ ] **Step 6: Commit**

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts tools/testing-policy/coverage-baseline.json
git commit -m "test: ratchet IndexedDB coverage evidence"
```

---

### Task 7: Run full gates and synchronize canonical debt truth

**Files:** `docs/testing/TEST_COVERAGE_AUDIT.md`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md`.

- [ ] **Step 1: Full gate before debt closure**

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

Run full browser suites against real app:

```bash
cd tools/m7-browser-audit
M7_BASE_URL=http://127.0.0.1:3000 npm run audit
M7_BASE_URL=http://127.0.0.1:3000 npm run audit:webkit
```

Expected: all PASS, retries 0.

- [ ] **Step 2: Close debt only with complete evidence**

Set:

```text
CLOSED — exact-head automated evidence complete; product-owner acceptance pending
```

only if every approved behavior-matrix item passes. Record actual implementation SHA, deterministic test count/result, generated repository/projects coverage, Chromium count/result, WebKit count/result, v1 -> v3 and v2 -> v3 results in both engines, UI reload result, corruption fail-closed result, and genuine RED/fix commits if any.

If a new out-of-scope data-integrity issue is discovered, create a separate OPEN debt item. If any mandatory scenario is missing, leave this item OPEN.

- [ ] **Step 3: Truthfully update state docs**

Before product-owner acceptance/merge, state remains:

```text
implemented: yes
tested: yes
product-owner accepted: no
merged: no
released: no/not applicable
```

- [ ] **Step 4: Re-run docs/policy and commit truth sync**

```bash
pnpm validate:m7-docs
pnpm test:policy
pnpm coverage
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm verify:policy
git add docs/testing/TEST_COVERAGE_AUDIT.md docs/PROJECT_STATE.md docs/ROADMAP.md docs/CHANGELOG.md
git commit -m "docs: record IndexedDB remediation evidence"
```

---

### Task 8: Draft PR, exact-head review, explicit acceptance and protected integration

- [ ] **Step 1: Push and open Draft PR**

```bash
git push -u origin test/p0-indexeddb-remediation
```

Title:

```text
test: close P0 IndexedDB persistence debt
```

PR body separately records characterization GREEN, genuine RED -> GREEN defects if any, deterministic failure evidence, Chromium/WebKit native evidence, measured ratchet movement, debt state and acceptance pending.

- [ ] **Step 2: Require exact-head GitHub evidence**

```text
CI: PASS
Browser Acceptance: PASS — Chromium + complete registered WebKit suite, retries 0
Recognition Benchmark: PASS
CodeQL/security relevant to PR: PASS / no new alerts
unresolved review threads: 0
```

Record exact run IDs, artifact IDs and SHA-256 digests. Any later commit invalidates prior exact-head evidence.

- [ ] **Step 3: Independent final diff review**

Verify all:

```text
no production test hook/debug route/reset endpoint
no unapproved fake-indexeddb dependency
no database-version bump without genuine requirement
m8-indexeddb-persistence.spec.mjs present in WEBKIT_SPECS
shared fixtures import used
no test.only / unmanaged skip / fixme
retries remain 0
no threshold/baseline/assertion weakening
no unrelated refactor
canonical debt closure backed by exact-head evidence
```

Any behavior defect gets test-first RED, minimal fix, and completely refreshed exact-head evidence.

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

Green CI is not acceptance.

- [ ] **Step 5: After explicit PASS, protected squash merge with expected head SHA**

Verify PR head unchanged; no force push or protection bypass.

Suggested squash title:

```text
test: close P0 IndexedDB persistence debt
```

- [ ] **Step 6: Verify actual post-merge main**

Fetch actual squash SHA. Require post-merge CI and CodeQL/security on that SHA. Browser Acceptance is currently PR-triggered, so preserve accepted exact-head PR browser evidence rather than claiming a nonexistent main-push browser run.

If canonical docs still say merge pending, create a docs-only truth-sync follow-up recording accepted head, squash SHA, post-merge CI/security, integrated debt closure and next evidence-driven remediation slice.

## Final verification

Resolve policy base dynamically and run fresh exact-head commands:

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

Then run the full Chromium and WebKit browser suites from `tools/m7-browser-audit`, retries 0.

No completion claim is valid without fresh exact-head output. Characterization GREEN is never rewritten as historical RED; every real defect keeps its pre-fix failure evidence.