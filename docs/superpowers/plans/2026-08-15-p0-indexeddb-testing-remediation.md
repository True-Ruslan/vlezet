# P0 IndexedDB Testing Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` with deterministic IndexedDB adapter failure contracts plus real Chromium/WebKit persistence and schema-upgrade evidence, fixing production code only when a newly added contract proves a real defect.

**Architecture:** Keep the production `IndexedDbProjectRepository` API and schema unchanged unless a focused test exposes a defect. Use a small event-driven test-only double for rare `IDBFactory`/request/transaction lifecycle failures, while all actual IndexedDB schema, upgrade, persistence, reload, corruption and cascade-delete semantics are proven in real browsers through the existing application lifecycle. Chromium continues automatic discovery; the complete new persistence spec is explicitly registered in the machine-checked WebKit set.

**Tech Stack:** TypeScript 6.0.3, Vitest 4.1.10, V8 coverage, Node >=22.13.0 / CI Node 22.16.0, pnpm 11.15.1, Playwright 1.54.2, native browser IndexedDB, Next.js 16 development server, GitHub Actions.

## Global Constraints

- Base implementation work on the then-current integrated `main`; the approved design base is `cc594bae218e9e16724d7574f48be8886852e7ad`.
- Do not implement from the docs-only design branch. Create the implementation branch from current `main`, then cherry-pick the approved spec/plan documentation commits if they are not already present on `main`.
- `VLEZET_DATABASE_NAME` remains `vlezet`; `VLEZET_DATABASE_VERSION` remains `3` unless a separately justified product/schema defect requires a change.
- Historical upgrade contracts are mandatory for v1 -> v3 and v2 -> v3 in both Chromium and WebKit.
- The complete `m8-indexeddb-persistence.spec.mjs` is mandatory in the WebKit registry; no smaller hidden subset.
- Browser retries remain `0`, workers remain `1`, and all browser specs use `./fixtures.mjs` so `pageerror` and `console.error` stay blocking.
- `page.evaluate` may reset/prepare/inspect IndexedDB, but it must not replace the normal application UI/lifecycle for user-visible save -> reload -> restore proof.
- Do not export `openDatabase`, `requestResult`, `transactionDone`, asset-deletion internals or any new production helper merely for testing.
- Do not add production debug routes, query switches, fault-injection flags, test modes, or hidden hooks.
- Do not add `fake-indexeddb` initially. Stop and reassess if the minimal deterministic harness starts becoming a general IndexedDB emulator.
- Existing correct behavior may be characterized by a test that starts GREEN. Never fabricate RED by breaking production or weakening an assertion.
- When a new contract exposes a real defect, preserve the focused failing test/run as genuine RED before the minimal production fix; then rerun that exact contract to GREEN.
- Any changed critical production code must satisfy 100% changed lines/statements/functions and at least 95% changed branches.
- Coverage baseline/ratchet changes are generated from measured reports only; never hand-edit percentages or lower thresholds.
- Keep `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` OPEN until all exact-head evidence required by the approved spec exists.

---

## File Structure

**Create during implementation:**

- `packages/projects/src/indexeddb.test.ts` — public-API characterization and deterministic failure/lifecycle contracts for the IndexedDB adapter.
- `packages/projects/src/indexeddb.test-support.ts` — only if Task 1 proves a shared event-driven double materially improves readability; test-only, never exported from `src/index.ts`.
- `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs` — native-browser schema/persistence/upgrade/corruption/cascade evidence.

**Modify during implementation:**

- `tools/testing-policy/browser-policy.mjs` — append the new IndexedDB browser spec to `WEBKIT_SPECS` only after the policy test has demonstrated RED.
- `tools/testing-policy/browser-policy.test.mjs` — explicit policy contract that IndexedDB persistence cannot be omitted from WebKit.
- `docs/testing/TEST_COVERAGE_AUDIT.md` — keep OPEN during development; close only on the final exact head with measured evidence.
- `tools/testing-policy/coverage-baseline.json` — update only through `pnpm coverage:baseline` after final evidence; never edit by hand.
- `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md` — final truthful state sync only after exact-head verification; do not claim acceptance/merge prematurely.

**Production files changed only if a real RED proves a defect:**

- `packages/projects/src/indexeddb.ts`
- `packages/projects/src/indexeddb-schema.ts` only if the defect is truly a schema-contract defect; no version bump just for testing.

**Read-only integration points to preserve:**

- `apps/web/components/projects/project-app.tsx` — production creation of `createIndexedDbProjectRepository()`, autosave lifecycle and dashboard/editor transitions.
- `apps/web/components/projects/project-dashboard.tsx` — project create/open/delete UI roles/labels.
- `apps/web/components/editor/editor-toolbar.tsx` — `aria-label="Название проекта"` and save-status surface.
- `tools/m7-browser-audit/fixtures.mjs` — shared runtime-error fixture.
- `tools/m7-browser-audit/playwright.config.mjs` / `playwright.webkit.config.mjs` — existing auto-discovery and registry mechanics.

---

### Task 1: Establish the deterministic adapter harness and open lifecycle characterization

**Files:**
- Create: `packages/projects/src/indexeddb.test.ts`
- Optional create only if the test file becomes difficult to read: `packages/projects/src/indexeddb.test-support.ts`
- Read, do not modify unless a genuine defect is proved: `packages/projects/src/indexeddb.ts`

**Interfaces:**
- Consumes: `createIndexedDbProjectRepository(factory?: IDBFactory)`, `IndexedDbProjectRepository`, `ProjectStorageError` from `./indexeddb`.
- Produces: a test-only `DeferredOpenFactory`/equivalent event harness capable of emitting `onsuccess`, `onerror`, `onblocked`, `onupgradeneeded`, and observing `onversionchange`/`close` without emulating browser persistence semantics.
- The harness may use narrow structural objects cast to DOM IndexedDB interfaces; it must not be exported from production package index.

- [ ] **Step 1: Create the implementation branch from current main and carry documentation forward**

Run:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c test/p0-indexeddb-remediation
```

If the approved spec/plan commits are not on `main`, cherry-pick only the docs commits from `docs/p0-indexeddb-testing-design` after verifying their diff contains only:

```text
docs/superpowers/specs/2026-08-14-p0-indexeddb-testing-design.md
docs/superpowers/plans/2026-08-15-p0-indexeddb-testing-remediation.md
```

Record the actual implementation base:

```bash
git rev-parse HEAD
git merge-base HEAD origin/main
```

Expected: merge base is the current `origin/main` integration SHA; no product/test implementation inherited from a stale feature branch.

- [ ] **Step 2: Add open/availability characterization tests through the public API**

Start `packages/projects/src/indexeddb.test.ts` with public imports only:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  ProjectStorageError,
  createIndexedDbProjectRepository,
} from "./indexeddb";

function expectStorageError(error: unknown, message: string): void {
  expect(error).toBeInstanceOf(ProjectStorageError);
  expect((error as ProjectStorageError).message).toBe(message);
}
```

Add the unsupported-factory contract without relying on the ambient Node global:

```ts
it("fails explicitly when IndexedDB is unavailable", () => {
  expect(() => createIndexedDbProjectRepository(undefined as unknown as IDBFactory))
    .toThrow(ProjectStorageError);
});
```

Because the production default parameter substitutes `globalThis.indexedDB` when the argument is literally `undefined`, implement this test by temporarily replacing/restoring `globalThis.indexedDB` with `vi.stubGlobal`/`vi.unstubAllGlobals` if the first expression does not reach the unsupported branch. Do not change production solely to simplify the test.

Add a factory whose `open()` throws synchronously:

```ts
it("wraps a synchronous IDBFactory.open failure", async () => {
  const cause = new Error("open exploded");
  const factory = {
    open: () => { throw cause; },
  } as unknown as IDBFactory;

  const repository = createIndexedDbProjectRepository(factory);
  await expect(repository.list()).rejects.toMatchObject({
    name: "ProjectStorageError",
    message: "Не удалось открыть локальное хранилище проектов.",
    cause,
  });
});
```

Add narrow deferred open-request tests for `onerror` and `onblocked`; trigger the assigned callback synchronously from the test harness after repository construction, then assert exact public messages:

```ts
expectStorageError(error, "Закройте другие вкладки Vlezet и попробуйте снова.");
```

and default open failure:

```ts
expectStorageError(error, "Не удалось открыть локальное хранилище проектов.");
```

- [ ] **Step 3: Run the focused tests and classify the result honestly**

Run:

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts
```

Expected for historical correct behavior: PASS. Record these as characterization contracts, not RED evidence.

If any contract FAILS because production behavior violates the approved contract, stop Task 1 before changing production. Save the exact failure output and commit the failing test as genuine RED. Do not continue with a speculative fix in the same commit.

- [ ] **Step 4: Add successful open + versionchange close characterization**

Use a minimal database double with a `close` spy and only the object-store/index surface required by `onupgradeneeded`. Drive `request.onupgradeneeded` before `request.onsuccess`, then call a harmless public operation such as `list()` with a deterministic readonly transaction that resolves its request and transaction completion.

After successful open, invoke the installed `database.onversionchange` handler and assert:

```ts
expect(close).toHaveBeenCalledOnce();
```

Do not export or import `openDatabase` to achieve this.

- [ ] **Step 5: Run focused projects tests and coverage for the first measured delta**

Run:

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts src/repository.test.ts
pnpm --dir packages/projects exec vitest run --coverage --coverage.provider=v8 --coverage.include='src/**/*.{ts,tsx,js,jsx,mjs,cjs}' --coverage.reporter=text --coverage.reporter=json --coverage.reportsDirectory=coverage
```

Expected: focused tests PASS; `indexeddb.ts` is no longer entirely unexecuted. Do not update repository baseline yet.

- [ ] **Step 6: Commit the characterization harness**

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts
git commit -m "test: characterize IndexedDB open lifecycle"
```

If no support file was created, omit it from `git add`.

---

### Task 2: Prove request failures, transaction failures, CRUD semantics and cascade isolation deterministically

**Files:**
- Modify: `packages/projects/src/indexeddb.test.ts`
- Modify if already created: `packages/projects/src/indexeddb.test-support.ts`
- Modify production only after a preserved real RED: `packages/projects/src/indexeddb.ts`

**Interfaces:**
- Consumes public methods: `list`, `get`, `put`, `delete`, `getLastProjectId`, `setLastProjectId`, `getAsset`, `putAsset`, `deleteAsset`, `deleteAssetsForProject`.
- Produces deterministic event scripts that can resolve/reject `IDBRequest` and complete/error/abort `IDBTransaction` independently.
- Does not implement database query semantics beyond exact values scripted by each test.

- [ ] **Step 1: Add request-success/error primitives to the test-only harness**

Define a narrow helper shape, keeping callbacks writable because production assigns them:

```ts
type RequestController<T> = Readonly<{
  request: IDBRequest<T>;
  succeed(value: T): void;
  fail(error: DOMException | null): void;
}>;

type TransactionController = Readonly<{
  transaction: IDBTransaction;
  complete(): void;
  abort(error?: DOMException | null): void;
  error(error?: DOMException | null): void;
}>;
```

The backing object needs only `result`, `error`, `onsuccess`, `onerror` for requests and `oncomplete`, `onabort`, `onerror`, `error`, `objectStore()` for transactions. Do not add cursor/range/version APIs unless a public operation in this task actually needs them.

- [ ] **Step 2: Characterize generic and contextual request failures**

Add one public project read failure:

```ts
it("rejects a project read request error without hanging", async () => {
  // Arrange an already-open repository and a `get(id)` request controller.
  const result = repository.get("project-a");
  getRequest.fail(new DOMException("read failed", "UnknownError"));
  await expect(result).rejects.toMatchObject({
    name: "ProjectStorageError",
    message: "Не удалось прочитать локальные проекты.",
  });
});
```

Add one asset-specific failure proving the distinct message:

```ts
await expect(repository.getAsset("asset-a")).rejects.toMatchObject({
  name: "ProjectStorageError",
  message: "Не удалось прочитать подложку.",
});
```

Add the `deleteAssetsForProject` index-key request failure and assert:

```ts
message: "Не удалось прочитать подложки проекта."
```

No timeout is the assertion mechanism; the test explicitly emits the failure event.

- [ ] **Step 3: Characterize transaction complete, abort and error as distinct branches**

Use a successful request/write setup, then independently emit transaction outcomes:

```ts
it("rejects a write when the transaction aborts after the request was issued", async () => {
  const pending = repository.put(validProject);
  transaction.abort(new DOMException("aborted", "AbortError"));
  await expect(pending).rejects.toMatchObject({
    name: "ProjectStorageError",
    message: "Не удалось сохранить изменения проекта.",
  });
});

it("rejects a write when the transaction errors", async () => {
  const pending = repository.put(validProject);
  transaction.error(new DOMException("failed", "UnknownError"));
  await expect(pending).rejects.toMatchObject({
    name: "ProjectStorageError",
    message: "Не удалось сохранить изменения проекта.",
  });
});
```

Keep abort/error event emissions independent even if a real browser may co-fire related events.

- [ ] **Step 4: Add deterministic public result contracts not requiring native IndexedDB semantics**

Script exact request results and complete transactions to prove:

```ts
expect(await repository.get("missing")).toBeNull();
expect(await repository.getLastProjectId()).toBeNull();
```

For `list()`, provide three already-valid project records with timestamps that prove newest-first and ID tie-break ordering, then assert IDs in deterministic order. Use the existing `createProject` test helper/import from `./project` or package public API rather than hand-building an invalid document.

For `delete(id)`, script:

- assets index returns only project A asset keys;
- current `LAST_PROJECT_KEY` points to project A in one test and project B in another;
- assert project A delete and returned asset-key deletes are issued;
- assert settings `put({ key: LAST_PROJECT_KEY, value: null })` occurs only in the matching case.

This deterministic test proves orchestration. Native atomicity/data preservation is still reserved for Task 4 browser evidence.

- [ ] **Step 5: Run focused tests; if any existing behavior fails, preserve RED before fixing production**

Run:

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts
```

Expected for characterization: PASS.

If a contract FAILS against current production:

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts
git commit -m "test: expose IndexedDB <specific defect>"
```

Then make only the minimal corresponding change in `packages/projects/src/indexeddb.ts`, rerun that exact named test to GREEN, rerun the whole `indexeddb.test.ts`, and commit separately:

```bash
git add packages/projects/src/indexeddb.ts
git commit -m "fix: <specific IndexedDB defect>"
```

Do not combine unrelated defects or change schema/version opportunistically.

- [ ] **Step 6: Commit the deterministic failure/CRUD evidence when GREEN**

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts
git commit -m "test: cover IndexedDB failure contracts"
```

Again omit the optional helper path if it does not exist.

---

### Task 3: Make the new browser persistence suite impossible to omit from WebKit

**Files:**
- Modify: `tools/testing-policy/browser-policy.test.mjs`
- Modify: `tools/testing-policy/browser-policy.mjs`
- Create in the GREEN step only after policy RED is observed: `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`

**Interfaces:**
- Consumes: exported `WEBKIT_SPECS`, automatic Chromium `**/*.spec.mjs` discovery, shared `./fixtures.mjs` import rule.
- Produces: policy-enforced registration of `m8-indexeddb-persistence.spec.mjs` in the complete WebKit set.

- [ ] **Step 1: Write the policy RED before creating the browser spec**

Extend the exact expected registry in `browser-policy.test.mjs` by appending:

```js
"m8-indexeddb-persistence.spec.mjs",
```

Also add a focused semantic assertion so future list refactors cannot silently remove the P0 spec:

```js
test("requires IndexedDB persistence evidence in WebKit", () => {
  assert.ok(WEBKIT_SPECS.includes("m8-indexeddb-persistence.spec.mjs"));
});
```

- [ ] **Step 2: Run policy self-tests and observe genuine RED**

Run:

```bash
pnpm test:policy
```

Expected: FAIL because current `WEBKIT_SPECS` does not contain `m8-indexeddb-persistence.spec.mjs`. Preserve the terminal output as RED evidence.

Commit test-only RED:

```bash
git add tools/testing-policy/browser-policy.test.mjs
git commit -m "test: require IndexedDB WebKit acceptance"
```

- [ ] **Step 3: Add the minimal registry change and executable spec shell**

Append exactly one entry to `WEBKIT_SPECS` in `browser-policy.mjs`:

```js
"m8-indexeddb-persistence.spec.mjs",
```

Create the executable spec with the shared fixture and one non-skipped smoke contract that will be expanded in Tasks 4-5:

```js
import { expect, test } from "./fixtures.mjs";

const DB_NAME = "vlezet";

async function deleteDatabase(page) {
  await page.goto("/");
  await page.evaluate(async (name) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("deleteDatabase failed"));
      request.onblocked = () => reject(new Error("deleteDatabase blocked"));
    });
  }, DB_NAME);
}

test("creates a native IndexedDB-backed project", async ({ page }) => {
  await deleteDatabase(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Планировки, к которым можно вернуться" })).toBeVisible();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.getByLabel("Название проекта")).toHaveValue("Моя квартира");
  await expect(page.locator(".save-status")).toContainText(/Сохранено локально|Локальный проект/);
});
```

If deleting the database after navigating opens a connection and causes blocking, move reset into `page.addInitScript`/a fresh `browser.newContext()` helper during Task 4 rather than weakening the assertion. Do not add production reset hooks.

- [ ] **Step 4: Run policy GREEN**

Run:

```bash
pnpm test:policy
```

Expected: PASS including the explicit WebKit requirement and current-browser-infrastructure policy.

- [ ] **Step 5: Run the new spec alone in Chromium and WebKit**

With the real app running on `127.0.0.1:3000`:

```bash
npm --prefix tools/m7-browser-audit exec playwright test -- m8-indexeddb-persistence.spec.mjs
npm --prefix tools/m7-browser-audit exec playwright test -- --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

If npm argument forwarding differs in the active environment, run from the harness directory instead:

```bash
cd tools/m7-browser-audit
npx playwright test m8-indexeddb-persistence.spec.mjs
npx playwright test --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

Expected: both PASS, retries 0, shared runtime guard active.

- [ ] **Step 6: Commit the minimal GREEN infrastructure**

```bash
git add tools/testing-policy/browser-policy.mjs tools/testing-policy/browser-policy.test.mjs tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs
git commit -m "test: register IndexedDB browser acceptance"
```

---

### Task 4: Prove fresh schema, mandatory v1/v2 upgrades, and current-v3 recognition-session preservation in native browsers

**Files:**
- Modify: `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`
- Read: `packages/projects/src/indexeddb-schema.ts`
- Read historical truth from commits documented in the spec; do not copy mutable current schema constants into production.

**Interfaces:**
- Consumes native `window.indexedDB`, production application opening current DB v3, current store/index names.
- Produces browser setup/inspection helpers local to the spec: `deleteDatabase`, `openDatabaseVersion`, `inspectSchema`, `seedLegacyV1`, `seedLegacyV2`, `seedCurrentV3RecognitionRecord`.

- [ ] **Step 1: Implement event-driven browser IndexedDB helpers with no arbitrary sleeps**

Use promise wrappers like:

```js
async function openRawDatabase(page, version, upgradeSource) {
  return page.evaluate(async ({ name, version, upgradeSource }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => {
        const db = request.result;
        // `upgradeSource` selects only explicit historical v1/v2 setup branches.
        if (upgradeSource === "v1") {
          const projects = db.createObjectStore("projects", { keyPath: "id" });
          projects.createIndex("updatedAt", "updatedAt", { unique: false });
          db.createObjectStore("settings", { keyPath: "key" });
        }
        if (upgradeSource === "v2") {
          const projects = db.createObjectStore("projects", { keyPath: "id" });
          projects.createIndex("updatedAt", "updatedAt", { unique: false });
          db.createObjectStore("settings", { keyPath: "key" });
          const assets = db.createObjectStore("assets", { keyPath: "id" });
          assets.createIndex("projectId", "projectId", { unique: false });
        }
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error ?? new Error("open failed"));
      request.onblocked = () => reject(new Error("open blocked"));
    });
  }, { name: DB_NAME, version, upgradeSource });
}
```

Do not use `setTimeout` to wait for IndexedDB.

- [ ] **Step 2: Add fresh-v3 schema assertions**

Reset storage, load `/`, wait for dashboard initialization, then inspect native IndexedDB and assert:

```js
expect(schema.version).toBe(3);
expect(schema.stores).toEqual(expect.arrayContaining([
  "projects",
  "settings",
  "assets",
  "recognitionSessions",
]));
expect(schema.projects.updatedAt).toMatchObject({ keyPath: "updatedAt", unique: false });
expect(schema.assets.projectId).toMatchObject({ keyPath: "projectId", unique: false });
expect(schema.recognitionSessions.projectId).toMatchObject({ keyPath: "projectId", unique: true });
```

Use transaction/objectStore/index metadata from the real browser. Close inspection connections so later upgrades cannot be blocked.

- [ ] **Step 3: Add v1 -> v3 preservation test**

Prepare v1 with:

- one valid historical project record compatible with current migration/validation expectations;
- `settings` with `lastProjectId` referencing it.

Then load current `/`. Assert production opens/upgrades the database and that:

- dashboard/editor starts successfully according to the stored last project;
- project record remains present;
- setting remains present;
- `assets` now exists with nonunique `projectId` index;
- `recognitionSessions` now exists with unique `projectId` index.

If current application intentionally auto-opens the last project, assert `page.getByLabel("Название проекта")` has the seeded project name rather than forcing dashboard state.

- [ ] **Step 4: Add v2 -> v3 preservation test**

Prepare v2 with one project, settings and one asset owned by that project. Load current app and assert:

```js
expect(snapshot.project.id).toBe(projectId);
expect(snapshot.asset.id).toBe(assetId);
expect(snapshot.asset.projectId).toBe(projectId);
expect(snapshot.schema.recognitionSessions.projectId.unique).toBe(true);
```

Also call a current UI/repository-backed action after upgrade (for example opening the seeded project and observing editor state) so the test proves the resulting DB is usable, not just structurally present.

- [ ] **Step 5: Add current-v3 reopen preservation for recognition sessions**

Create a current v3 DB through the real app, close the page/context connection as needed, seed one structurally valid recognition-session record directly into `recognitionSessions`, reopen current app without a version change, then inspect and assert the record still exists unchanged.

Do not claim v1/v2 recognition-record preservation; those historical schemas never had this store.

- [ ] **Step 6: Run the exact new spec in both engines**

Run from `tools/m7-browser-audit`:

```bash
npx playwright test m8-indexeddb-persistence.spec.mjs
npx playwright test --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

Expected: all fresh/upgrade/reopen cases PASS in Chromium and WebKit, retries 0.

If a real browser exposes a production schema/upgrade defect, preserve the focused failing case as RED before modifying `indexeddb.ts`/`indexeddb-schema.ts`; make the smallest production correction, then rerun the exact failing case in both engines.

- [ ] **Step 7: Commit native schema/upgrade evidence**

```bash
git add tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs
git commit -m "test: prove IndexedDB schema upgrades"
```

Include production files in a separate prior/next commit only if a genuine defect required them.

---

### Task 5: Prove real application save -> reload, settings, assets, cascade isolation, and corrupted-record fail-closed behavior

**Files:**
- Modify: `tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs`
- Read-only selector contracts: `apps/web/components/projects/project-app.tsx`, `project-dashboard.tsx`, `editor-toolbar.tsx`
- Modify production only after a preserved real RED: `packages/projects/src/indexeddb.ts` or the actual defective application boundary.

**Interfaces:**
- Consumes normal UI labels: heading `Планировки, к которым можно вернуться`, button `Новый проект`, input `Название проекта`, `.save-status`, button/aria-label `Вернуться к моим проектам`, dashboard project open/delete actions.
- Produces browser evidence where actual project creation/edit/save/reload flows through `ProjectApp` and its production IndexedDB repository/autosave path.

- [ ] **Step 1: Add an isolated real UI save -> reload -> restore test**

Use a fresh context/database, then:

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

The wait on `Сохранено локально` is the autosave completion synchronization; do not replace it with a fixed sleep.

Inspect IndexedDB only after the user-visible assertion to record the stored project ID/name and last-project setting as secondary evidence.

- [ ] **Step 2: Prove last-project clear/preserve semantics through app plus native inspection**

Create two projects through normal UI. Use dashboard/open/back flows so one project becomes/ceases to be last-project through production code. Verify native settings after each relevant action.

For delete semantics, dashboard actions expose `Действия с проектом <name>` and `Удалить`; the confirmation dialog must be driven through its real accessible button labels from `ConfirmDialog`, not DOM event injection.

Assert:

- deleting the project referenced by `lastProjectId` results in null/cleared setting according to current repository representation;
- deleting a different project does not clear the retained project's last-project reference.

If the current UI always clears last-project before dashboard deletion, keep the public UI lifecycle proof and use deterministic Task 2 repository orchestration for the matching/nonmatching branch. Do not add a UI backdoor merely to force an otherwise unreachable state.

- [ ] **Step 3: Prove asset round trip and cross-project cascade isolation in native IndexedDB**

Use real app project/reference workflows where practical for at least one actual asset install, or seed assets directly only for storage preconditions that have no reasonable lightweight UI setup. Then invoke production project deletion through the dashboard UI.

Prepare project A and B with distinct assets and an unrelated setting. After deleting A, inspect native DB and assert:

```js
expect(projectIds).not.toContain(projectAId);
expect(projectIds).toContain(projectBId);
expect(assetProjectIds).not.toContain(projectAId);
expect(assetProjectIds).toContain(projectBId);
expect(unrelatedSetting).toEqual(originalSetting);
```

Also test `deleteAsset`/`deleteAssetsForProject` public behavior deterministically in Task 2 if the UI does not expose those operations independently. Do not manufacture extra product UI.

- [ ] **Step 4: Prove corrupted persisted project and asset records fail closed**

Reset/setup storage directly in browser, first let current v3 schema exist, then insert one structurally invalid project record and one invalid asset record in separate isolated cases.

For corrupted project startup/list behavior, reload the real application and assert the visible recovery/error boundary instead of silently accepting the record. For corrupted asset, seed a valid project whose reference points to the corrupt asset and open it through the real app; assert the operation reaches the existing error/fail-closed boundary.

Because `fixtures.mjs` globally fails on unexpected `console.error`, expected storage-validation failure tests must choose corruptions that the application handles without intentional console errors, or narrowly restructure the product error handling only if the current behavior itself is proven defective. Never globally suppress the runtime guard.

- [ ] **Step 5: Run the full IndexedDB browser spec in both engines**

```bash
cd tools/m7-browser-audit
npx playwright test m8-indexeddb-persistence.spec.mjs
npx playwright test --config=playwright.webkit.config.mjs m8-indexeddb-persistence.spec.mjs
```

Expected: all cases PASS in Chromium and WebKit with retries 0.

If a browser test exposes a real defect, preserve focused RED evidence and fix only that defect before continuing.

- [ ] **Step 6: Commit application-lifecycle persistence evidence**

```bash
git add tools/m7-browser-audit/m8-indexeddb-persistence.spec.mjs
git commit -m "test: prove IndexedDB persistence lifecycle"
```

---

### Task 6: Measure coverage, close only meaningful uncovered IndexedDB branches, and enforce the ratchet

**Files:**
- Modify: `packages/projects/src/indexeddb.test.ts` only for meaningful missing branches found by measurement.
- Modify optional: `packages/projects/src/indexeddb.test-support.ts`
- Generated modify after final GREEN only: `tools/testing-policy/coverage-baseline.json`
- Read: `packages/projects/coverage/coverage-final.json`
- Production modification only for proven dead/incorrect code in a separate RED/fix slice.

**Interfaces:**
- Consumes: Phase A V8 workspace coverage and `coverage:baseline` generator.
- Produces: measured upward/non-decreasing coverage with no percentage chasing.

- [ ] **Step 1: Generate complete workspace coverage on the implementation head**

Run from repository root:

```bash
pnpm coverage
```

Then inspect specifically:

```text
packages/projects/coverage/coverage-final.json
packages/projects/src/indexeddb.ts
packages/projects/src/indexeddb-schema.ts
```

Record exact uncovered statements/functions/branch arms before adding anything else.

- [ ] **Step 2: Classify each remaining uncovered IndexedDB location**

For every uncovered location, place it in one of these explicit buckets in working notes/PR evidence:

```text
A — meaningful public behavior/failure branch -> add a focused test
B — browser-only semantic already proven by Playwright but not visible to Vitest coverage -> do not duplicate unless the branch itself remains materially risky
C — genuinely unreachable/dead/redundant production branch -> open a separate simplification/fix decision; do not write nonsense coverage tests
D — unrelated module/debt -> leave outside this P0 slice
```

Do not implement a general in-memory database merely to turn B into green percentages.

- [ ] **Step 3: Add only category-A focused tests and rerun coverage**

For each category-A branch, write the smallest deterministic public-API contract, run it focused, then rerun:

```bash
pnpm --dir packages/projects exec vitest run src/indexeddb.test.ts
pnpm coverage
```

If a new test exposes real wrong behavior, follow the genuine RED -> minimal fix -> GREEN rule and commit test/fix separately.

- [ ] **Step 4: Verify changed-code policy before baseline update**

Resolve the actual base SHA once from the implementation branch:

```bash
POLICY_BASE_SHA=$(git merge-base HEAD origin/main)
echo "$POLICY_BASE_SHA"
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm verify:policy
```

Expected: PASS. Any changed critical production code must meet 100/100/100/95. Test-only changes do not justify lowering thresholds.

- [ ] **Step 5: Generate the new baseline only after coverage is final**

Run:

```bash
pnpm coverage
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm coverage:baseline
```

Then inspect the diff:

```bash
git diff -- tools/testing-policy/coverage-baseline.json
```

Expected: values are generated from actual reports and affected repository/workspace metrics do not move downward relative to the accepted base. If any metric regresses, investigate the measurement/test change; do not edit the JSON manually.

- [ ] **Step 6: Commit measured coverage accounting**

```bash
git add packages/projects/src/indexeddb.test.ts packages/projects/src/indexeddb.test-support.ts tools/testing-policy/coverage-baseline.json
git commit -m "test: ratchet IndexedDB coverage evidence"
```

Omit nonexistent/unchanged optional paths.

---

### Task 7: Close the canonical debt only after exact-head evidence exists

**Files:**
- Modify: `docs/testing/TEST_COVERAGE_AUDIT.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CHANGELOG.md`
- Do not change status to accepted/merged yet.

**Interfaces:**
- Consumes: exact measured coverage from Task 6; exact Chromium/WebKit/deterministic test results.
- Produces: canonical truth that distinguishes implemented/tested from product-owner accepted/merged.

- [ ] **Step 1: Run the full local/repository gate before changing OPEN to CLOSED**

Resolve base SHA once:

```bash
POLICY_BASE_SHA=$(git merge-base HEAD origin/main)
```

Run:

```bash
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

With Vlezet running locally, run full browser suites, not only the new spec:

```bash
cd tools/m7-browser-audit
M7_BASE_URL=http://127.0.0.1:3000 npm run audit
M7_BASE_URL=http://127.0.0.1:3000 npm run audit:webkit
```

Expected: all commands PASS; browser retries remain 0.

- [ ] **Step 2: Update `TEST_COVERAGE_AUDIT.md` with measured evidence**

Change `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` from OPEN only if every approved behavior-matrix item has evidence. Record:

```text
Status: CLOSED — exact-head automated evidence complete; product-owner acceptance pending
```

Include:

- exact implementation head SHA;
- focused deterministic IndexedDB test command/result count;
- exact `projects` and repository coverage values copied from generated baseline/report, not hand-derived guesses;
- Chromium result/count;
- WebKit result/count;
- statement that v1 -> v3 and v2 -> v3 both passed in both engines;
- statement that UI save -> reload -> restore passed;
- statement that project/asset corruption failed closed;
- any genuine RED -> GREEN defects found, with exact commits/runs;
- any newly discovered but out-of-scope data-integrity debt as a new OPEN item instead of silently changing semantics.

If even one mandatory scenario is missing, leave this item OPEN and document what remains.

- [ ] **Step 3: Update project truth without premature acceptance claims**

In `PROJECT_STATE.md`, `ROADMAP.md`, and `CHANGELOG.md`, record the slice as:

```text
implemented + automated exact-head verification pending/complete
product-owner acceptance pending
merge pending
```

Use whichever of `pending/complete` is factually true after Step 1. Do not state accepted/merged before those events occur.

- [ ] **Step 4: Re-run docs/policy checks after documentation changes**

```bash
pnpm validate:m7-docs
pnpm test:policy
pnpm coverage
POLICY_BASE_SHA="$POLICY_BASE_SHA" pnpm verify:policy
```

Expected: PASS; docs contract and coverage ratchet remain consistent.

- [ ] **Step 5: Commit canonical truth sync**

```bash
git add docs/testing/TEST_COVERAGE_AUDIT.md docs/PROJECT_STATE.md docs/ROADMAP.md docs/CHANGELOG.md
git commit -m "docs: record IndexedDB remediation evidence"
```

---

### Task 8: Draft PR, exact-head CI/browser/security review, product-owner acceptance, and protected integration

**Files:**
- No new implementation files unless exact-head verification exposes a defect.
- PR body/evidence and post-merge canonical docs may be updated through GitHub metadata/docs-only truth sync.

**Interfaces:**
- Consumes exact implementation head and all repository-required Actions.
- Produces accepted, protected squash merge only after explicit product-owner PASS; then post-merge verification on actual `main` SHA.

- [ ] **Step 1: Push and open a Draft PR against `main`**

```bash
git push -u origin test/p0-indexeddb-remediation
```

PR title:

```text
test: close P0 IndexedDB persistence debt
```

PR body must distinguish:

- characterization tests that started GREEN;
- any genuine RED -> GREEN production defect fixes;
- deterministic fault evidence;
- native Chromium/WebKit schema/persistence evidence;
- measured coverage/ratchet movement;
- debt status;
- product-owner acceptance still pending.

Keep Draft until exact-head review is clean.

- [ ] **Step 2: Verify exact-head GitHub Actions and artifacts**

On the exact PR head, require:

```text
CI: PASS
Browser Acceptance: PASS — Chromium + complete registered WebKit suite, retries 0
Recognition Benchmark: PASS
CodeQL/security checks relevant to the PR: PASS/no new alerts
review threads: 0 unresolved
```

Fetch/record the exact run IDs, artifact IDs and SHA-256 digests for testing-policy evidence and browser evidence. Do not cite a run from an earlier head after any commit changes.

- [ ] **Step 3: Independently review the final diff against the approved spec**

Check all of these before asking for acceptance:

```text
no production test hook/debug route/fault flag
no fake-indexeddb production/test dependency unless separately approved after reassessment
no VLEZET_DATABASE_VERSION bump unless backed by a genuine defect/product requirement
new spec present in WEBKIT_SPECS
shared fixtures import used
no test.only / unmanaged skip / fixme
no retry increase
no threshold/baseline weakening
no unrelated product refactor
TEST_COVERAGE_AUDIT closure backed by exact-head evidence
```

If review finds a defect, add a focused test first where applicable, preserve RED if behavior is wrong, fix minimally, then repeat all exact-head evidence on the new SHA.

- [ ] **Step 4: Present the verified candidate to the product owner**

Report states separately:

```text
implemented: yes/no
tested: yes/no
debt evidence closed: yes/no
accepted: pending
merged: no
released: no/not applicable
```

Ask for explicit PASS. Green CI is not acceptance.

- [ ] **Step 5: After explicit PASS, mark ready and protected squash-merge with expected head SHA**

Before merge, verify PR head has not moved. Use protected squash merge and the exact accepted SHA. Do not force-push or bypass branch protection.

Suggested squash title:

```text
test: close P0 IndexedDB persistence debt
```

- [ ] **Step 6: Verify actual post-merge `main`**

Fetch the actual squash merge SHA and require post-merge CI/security checks on that SHA. Because Browser Acceptance is PR-triggered in the current workflow, preserve the accepted exact-head PR browser evidence and do not invent a post-merge browser run unless one is explicitly triggered.

Update canonical integration truth if needed with a docs-only follow-up that records:

```text
accepted head
actual squash merge SHA
post-merge CI run/status
post-merge CodeQL/security status
P0 debt closed and integrated
next evidence-driven P0/P1 remediation slice
```

Do not begin the next product feature until the integration truth is synchronized.

---

## Execution Notes

- The new browser spec is deliberately a P0 storage contract, not a screenshot/aesthetic test. Screenshots/traces are failure evidence, while assertions target persistence/schema/data-integrity behavior.
- Browser tests and Vitest V8 coverage prove different things. Do not duplicate every native browser scenario in a fake deterministic harness solely to make the coverage percentage look better.
- If expected corrupted-storage behavior causes the global runtime fixture to report an intentional `console.error`, first determine whether that console error is actually part of the product's desired recovery contract. Do not suppress all console errors. A narrow expected-error fixture change would itself require a policy/design review because Phase A made runtime errors globally blocking.
- If database reset is blocked by a live connection, close the page/context or perform reset before application initialization; do not add sleeps or production reset hooks.
- If the deterministic test support grows beyond narrow scripted request/transaction events, stop before implementing more. Reassess whether a dedicated test dependency is now safer, and obtain explicit approval before deviating from the approved no-`fake-indexeddb` initial design.
- If an ambiguity is discovered around recognition-session deletion when a project is deleted, record it as separate P0 data-integrity debt. This plan does not silently alter that semantic contract.
