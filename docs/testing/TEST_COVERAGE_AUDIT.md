# Vlezet Test Coverage Audit

**Status:** measured Phase A baseline. This file is the canonical audit and test-debt truth. Coverage numbers are copied from `tools/testing-policy/coverage-baseline.json` and must not be hand-authored.

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

Remediation order is P0 -> P1 -> P2 -> P3 unless a currently blocking defect justifies promotion. P0/P1 closure is a later evidence-driven plan after Phase A infrastructure is accepted.

## Confirmed gaps and audit candidates

### TEST-DEBT-INDEXEDDB-FAILURE-PATHS

- **ID:** TEST-DEBT-INDEXEDDB-FAILURE-PATHS
- **Risk:** P0
- **Area:** projects/indexeddb
- **Behavior:** IndexedDB open, upgrade, request-error, blocked, and transaction-abort recovery
- **Current evidence:** none confirmed as dedicated failure-path coverage. Workspace coverage reports show `packages/projects/src/indexeddb.ts` as unexecuted; that is measured non-execution of the adapter, not an inference from a missing same-name test file. Memory-repository, project, file-format, assets and autosave contracts are not dedicated IndexedDB failure-path evidence.
- **Required evidence:** IndexedDB integration and failure-path contract covering open/upgrade/transaction abort and request errors
- **Status:** OPEN — P0 **audit candidate** until dedicated evidence proves coverage or debt

No other historical gap is recorded here until dedicated evidence confirms it. Package totals below later target floors are baseline facts, not individual debt items.

## Policy gates that consume this audit

- `pnpm test:policy` — policy self-tests, including the docs contract that this file and `docs/testing/TESTING_POLICY.md` must satisfy.
- `pnpm verify:policy` — static policy checks plus coverage ratchet/changed-code against the measured baseline.
