# Vlezet Test Coverage Audit

**Status:** measured Phase A baseline with active debt registry. Testing-policy Phase A is accepted and merged; `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` is technically remediated in Draft PR #90 pending product-owner acceptance and protected integration. Coverage numbers below are copied from `tools/testing-policy/coverage-baseline.json` and must not be hand-authored.

A missing same-name test file is never proof of no coverage. This registry records only confirmed gaps or explicit audit candidates.

## Baseline identity

- **schemaVersion:** 1
- **sourceCommit:** `95b99baf2d0f0aad51109b311c70c9b38aa3db38`
- **Generation command:**

```bash
pnpm coverage
POLICY_BASE_SHA=95b99baf2d0f0aad51109b311c70c9b38aa3db38 pnpm coverage:baseline
```

The accepted base SHA is the `main` commit from which Phase A measured the first baseline. `pnpm coverage` emits workspace Istanbul JSON; `pnpm coverage:baseline` writes only those measured values.

## Measured coverage

Table cells are `covered/total (pct%)` copied from the generated baseline.

| Area | Lines | Statements | Functions | Branches |
|---|---|---|---|---|
| repository | 5745/9294 (61.81%) | 6553/11234 (58.33%) | 1505/2485 (60.56%) | 4023/7722 (52.1%) |
| web | 2521/5661 (44.53%) | 2879/6868 (41.92%) | 722/1606 (44.96%) | 2051/4996 (41.05%) |
| domain | 46/63 (73.02%) | 52/74 (70.27%) | 10/15 (66.67%) | 25/50 (50%) |
| editor-core | 565/631 (89.54%) | 688/837 (82.2%) | 179/200 (89.5%) | 386/548 (70.44%) |
| geometry | 894/960 (93.13%) | 1026/1168 (87.84%) | 179/197 (90.86%) | 471/629 (74.88%) |
| planning | 355/384 (92.45%) | 403/445 (90.56%) | 88/90 (97.78%) | 270/315 (85.71%) |
| projects | 279/434 (64.29%) | 297/493 (60.24%) | 75/110 (68.18%) | 169/312 (54.17%) |
| recognition | 1032/1105 (93.39%) | 1153/1291 (89.31%) | 241/256 (94.14%) | 621/839 (74.02%) |
| spatial | 53/56 (94.64%) | 55/58 (94.83%) | 11/11 (100%) | 30/33 (90.91%) |

Workspace mapping: `web` is `apps/web`; `domain`, `editor-core`, `geometry`, `planning`, `projects`, `recognition` and `spatial` are the corresponding `packages/*` workspaces.

These percentages are the ratchet floor, not a claim that the corresponding behaviors are fully evidenced. Later global targets remain repository 90/90/90/85 and critical areas 95/95/95/90; Phase A does not treat those historical targets as already enforced.

## Risk inventory

Classification of production areas. This is a risk map, not a list of confirmed missing tests.

- **P0 — authority/data integrity:** domain, migrations, geometry/topology, editor-core, validators, persistence/import/export, fit/collision, semantic history.
- **P1 — user-critical interaction:** Canvas, selection, drawing, direct manipulation, snapping, project lifecycle, calibration.
- **P2 — supporting behavior:** panels, onboarding, secondary visual/application state and utilities.
- **P3 — experimental:** recognition/AI R&D and benchmark/evidence tooling.

Remediation order is P0 -> P1 -> P2 -> P3 unless a currently blocking defect justifies promotion. Phase A infrastructure is accepted/merged; the first explicit P0 debt item below is now technically remediated, while any future P0/P1 items still require dedicated evidence before being added or closed.

## Confirmed gaps and audit candidates

### TEST-DEBT-INDEXEDDB-FAILURE-PATHS

- **ID:** TEST-DEBT-INDEXEDDB-FAILURE-PATHS
- **Risk:** P0
- **Area:** projects/indexeddb
- **Behavior:** IndexedDB open, schema upgrade, request errors, blocked upgrade, transaction abort/error, CRUD/settings/cascade semantics, persisted-read corruption boundaries and binary asset persistence
- **Original evidence:** the Phase A baseline measured `packages/projects/src/indexeddb.ts` as unexecuted. Memory-repository, project, file-format, assets and autosave contracts were not dedicated native IndexedDB failure-path evidence.
- **Remediation evidence:**
  - deterministic public-adapter unit contracts for open/request/transaction/result/cascade behavior;
  - failure-path validation translated at the persistence boundary to stable `ProjectStorageError` recovery semantics while direct writes keep strict domain validation;
  - current asset writes serialize public `Blob` payloads to raw IndexedDB `ArrayBuffer`, then hydrate back to the unchanged public Blob contract on read;
  - legacy Blob-backed records remain readable through the public repository;
  - malformed scalar/array records, invalid MIME metadata and binary-size mismatch fail closed;
  - native browser v1/v2 -> v3 metadata upgrades and current schema/index contracts;
  - current reference import -> save -> reload -> hydrate tested in Chromium and WebKit;
  - project deletion/cascade preserves unrelated project, asset and setting state;
  - Chromium additionally proves a native historical v2 Blob-backed asset survives the v3 upgrade;
  - WebKit proves the current ArrayBuffer-backed storage path and registered corruption/recovery contracts without skips/retries;
  - changed production code passes the accepted coverage ratchet and changed-code thresholds.
- **Technical evidence head:** `25bf1dea0b823dbec92538cf06f9c178581b5424`
- **Delivery gates at that head:** CI #5159 PASS; CodeQL #512 PASS; Browser Acceptance #1606 PASS — Chromium 65/65, WebKit 57/57, workers=1, retries=0
- **Status:** **TECHNICALLY REMEDIATED in Draft PR #90** — dedicated evidence now exists. Product-owner acceptance and protected integration are still pending, so this status must not be read as merged/released truth.

No other historical gap is recorded here until dedicated evidence confirms it. Package totals below later target floors are baseline facts, not individual debt items.

## Policy gates that consume this audit

- `pnpm test:policy` — policy self-tests, including the docs contract that this file and `docs/testing/TESTING_POLICY.md` must satisfy.
- `pnpm verify:policy` — static policy checks plus coverage ratchet/changed-code against the measured baseline.
