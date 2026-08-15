# Vlezet Test Coverage Audit

**Status:** measured coverage ratchet with active debt registry. Testing-policy Phase A is accepted and merged. `TEST-DEBT-INDEXEDDB-FAILURE-PATHS` remediation is technically complete and product-owner accepted in PR #90; canonical acceptance truth is synchronized. Fresh exact-head delivery gates on the final documentation head, protected integration and post-merge verification remain pending. Coverage numbers below are copied from generated `tools/testing-policy/coverage-baseline.json` output and must not be hand-authored.

A missing same-name test file is never proof of no coverage. This registry records only confirmed gaps or explicit audit candidates.

## Baseline identity

- **schemaVersion:** 1
- **sourceCommit:** `cc594bae218e9e16724d7574f48be8886852e7ad`
- **Generation command:**

```bash
pnpm coverage
POLICY_BASE_SHA=cc594bae218e9e16724d7574f48be8886852e7ad pnpm coverage:baseline
```

`sourceCommit` is the resolved policy base (`main`) used for this remediation, as required by `tools/testing-policy/update-baseline.mjs`; the metric counts themselves are generated from the remediation-head Istanbul reports. Two independent GREEN runs (`25bf1dea0b823dbec92538cf06f9c178581b5424` and `4bb012127282ee7e4fec1205251bd20de9ebcad2`) produced identical generated counts before the baseline was committed.

## Measured coverage

Table cells are `covered/total (pct%)` copied from the generated baseline.

| Area | Lines | Statements | Functions | Branches |
|---|---|---|---|---|
| repository | 5850/9306 (62.86%) | 6674/11248 (59.33%) | 1541/2489 (61.91%) | 4068/7733 (52.61%) |
| web | 2521/5661 (44.53%) | 2881/6868 (41.95%) | 722/1606 (44.96%) | 2053/4996 (41.09%) |
| domain | 46/63 (73.02%) | 52/74 (70.27%) | 10/15 (66.67%) | 25/50 (50%) |
| editor-core | 565/631 (89.54%) | 688/837 (82.2%) | 179/200 (89.5%) | 386/548 (70.44%) |
| geometry | 894/960 (93.13%) | 1026/1168 (87.84%) | 179/197 (90.86%) | 471/629 (74.88%) |
| planning | 355/384 (92.45%) | 403/445 (90.56%) | 88/90 (97.78%) | 270/315 (85.71%) |
| projects | 384/446 (86.1%) | 416/507 (82.05%) | 111/114 (97.37%) | 212/323 (65.63%) |
| recognition | 1032/1105 (93.39%) | 1153/1291 (89.31%) | 241/256 (94.14%) | 621/839 (74.02%) |
| spatial | 53/56 (94.64%) | 55/58 (94.83%) | 11/11 (100%) | 30/33 (90.91%) |

Workspace mapping: `web` is `apps/web`; `domain`, `editor-core`, `geometry`, `planning`, `projects`, `recognition` and `spatial` are the corresponding `packages/*` workspaces.

The Phase A accepted floor was repository 5745/9294 lines (61.81%), 6553/11234 statements (58.33%), 1505/2485 functions (60.56%) and 4023/7722 branches (52.1%). The IndexedDB remediation therefore ratchets actual measured repository coverage upward rather than merely proving non-regression. `packages/projects` moved from 279/434 lines (64.29%), 297/493 statements (60.24%), 75/110 functions (68.18%) and 169/312 branches (54.17%) to the generated values above.

These percentages are the ratchet floor, not a claim that the corresponding behaviors are fully evidenced. Later global targets remain repository 90/90/90/85 and critical areas 95/95/95/90; those historical targets are not retroactively claimed as satisfied.

## Risk inventory

Classification of production areas. This is a risk map, not a list of confirmed missing tests.

- **P0 — authority/data integrity:** domain, migrations, geometry/topology, editor-core, validators, persistence/import/export, fit/collision, semantic history.
- **P1 — user-critical interaction:** Canvas, selection, drawing, direct manipulation, snapping, project lifecycle, calibration.
- **P2 — supporting behavior:** panels, onboarding, secondary visual/application state and utilities.
- **P3 — experimental:** recognition/AI R&D and benchmark/evidence tooling.

Remediation order is P0 -> P1 -> P2 -> P3 unless a currently blocking defect justifies promotion. Phase A infrastructure is accepted/merged; the first explicit P0 debt item below has complete dedicated behavior evidence and explicit product-owner acceptance. Protected integration remains the final repository gate.

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
  - `packages/projects/src/indexeddb.ts` and `indexeddb-schema.ts` are measured at 100% lines/statements/functions/branches in the final stable coverage reports;
  - the generated repository/package baseline has been ratcheted upward from the accepted Phase A floor.
- **Product-owner accepted implementation head:** `366ad1f880d5866264e94388412c6dfabf37f83b`
- **Acceptance evidence:** CI #5167 PASS; CodeQL #527 PASS; Browser Acceptance #1614 PASS — Chromium 65/65, WebKit 57/57, workers=1, retries=0; browser artifact `9248180775`, sha256 `58d22159c0ab995ef2659c46977def0d4e32cee8ea354af7cf8770c73a95eb75`.
- **Policy RED -> GREEN:** `760b0f21179a23bdd8199491a98bc7a2efa08734` exposed the obsolete immutable Phase A baseline-SHA contract; `366ad1f880d5866264e94388412c6dfabf37f83b` makes the canonical audit follow generated `baseline.sourceCommit` without weakening thresholds or measured cells.
- **Product-owner acceptance:** PASS — 2026-08-15, explicit message `Принимаю P0`.
- **Canonical truth sync:** `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md`, this audit and the focused P0 changelog record acceptance before integration. The resulting docs-only head must pass fresh exact-head delivery gates before merge.
- **Status:** **REMEDIATION IMPLEMENTED / DEDICATED DEBT EVIDENCE CLOSED / PRODUCT-OWNER ACCEPTED in PR #90**. Fresh final-head verification, protected squash integration and post-merge verification remain pending.

No other historical gap is recorded here until dedicated evidence confirms it. Package totals below later target floors are baseline facts, not individual debt items.

## Policy gates that consume this audit

- `pnpm test:policy` — policy self-tests, including the docs contract that this file and `docs/testing/TESTING_POLICY.md` must satisfy.
- `pnpm verify:policy` — static policy checks plus coverage ratchet/changed-code against the measured baseline.
