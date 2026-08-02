# M7.8A — Recognition Benchmark Foundation Acceptance

**Status:** AUTOMATED ACCEPTANCE PASS / PRODUCT OWNER REVIEW PENDING  
**Date:** 2026-08-02  
**PR:** #40  
**Feature branch:** `feat/m7-8a-recognition-benchmark-foundation`  
**Final product head:** `15d0066eab770e632382459e1795993d5c3213cb`  
**Base:** `039ddba143cd03ddec0b090606dfdde752446014`

## Delivered scope

M7.8A establishes the deterministic measurement authority required before any M7.8 recognition-quality tuning:

- versioned `recognition-corpus-v1` with exactly eight public-safe fixtures;
- synthetic and redrawn-anonymized source provenance with immutable source hashes;
- fail-closed fixture, result and baseline schemas;
- deterministic maximum-cardinality/minimum-cost wall and opening assignment;
- wall geometry, wall topology, opening, room, area, confidence and reconciliation scoring;
- explicit committed baseline with reviewed source and harness SHAs;
- Core Benchmark in Node/Vitest;
- Source Benchmark through the real Chromium/OpenCV path;
- shared browser recognition engine used by both the production Worker and benchmark harness;
- benchmark-only guarded route absent from normal navigation;
- baseline comparison that rejects schema, corpus, engine-version and metric-applicability drift;
- documented numerical non-regression allowances for deterministic continuous metrics and zero allowance for defect counts;
- eight deterministic SVG overlays containing the source plan, expected and predicted geometry, and colour-independent TP/FP/FN evidence;
- one self-contained evidence directory with Core result, Source result, aggregate summary, eight overlays and portable `SHA256SUMS` verification;
- dedicated merge-blocking Recognition Benchmark workflow without live provider calls.

M7.8A intentionally does not tune Canny, Hough, adaptive thresholds, wall reconstruction, opening classification, room derivation or OpenRouter prompts.

## Authority boundaries

Confirmed unchanged against base `039ddba143cd03ddec0b090606dfdde752446014`:

- `VlezetDocument`, domain schema, migrations and IndexedDB;
- project backup, duplicate and import authority;
- recognition Draft → explicit Apply workflow;
- editor-core geometry validation and semantic Undo/Redo;
- M2 containment, collision, clearance and fit authority;
- planner and 3D authority;
- OpenRouter production request/response behaviour;
- runtime-only treatment of secrets and raw provider interactions.

The only production-path refactor extracts existing local OpenCV behaviour from `recognition.worker.ts` into a shared browser function. Regression coverage preserves Worker protocol, progress phases, algorithm constants and browser-safe `Crypto.randomUUID()` invocation.

## Corpus and privacy evidence

Corpus version: `recognition-corpus-v1`  
Recognition engine version: `3`  
Fixture count: `8`

Fixtures:

1. `clean-studio`;
2. `clean-multi-room`;
3. `openings-heavy`;
4. `labels-and-areas`;
5. `furniture-heavy`;
6. `low-resolution`;
7. `perspective-photo`;
8. `m7-3-regression-anonymized`.

The original privately supplied regression plan was not committed. The regression fixture is a newly rendered redrawn analogue with changed geometry, labels and raster data. Fixture validation rejects undeclared assets, invalid provenance, metadata-bearing rasters, oversized files and source-hash mismatches.

Each Source Benchmark fixture has a deterministic SVG evidence overlay. Expected walls use solid or dashed square-oriented evidence, predictions use dotted/dash-dot circular evidence, and explicit `FN`/`FP` labels preserve meaning without relying on colour.

## Baseline metrics

The committed baseline deliberately records the current quality gap. It is below the final M7.8 product thresholds and must not be interpreted as recognition-quality completion.

| Metric | Core baseline | Source baseline |
| --- | ---: | ---: |
| Wall geometry F1 | 0.131737 | 0 |
| Wall topology F1 | 0.131737 | 0 |
| Opening F1 | 0 | 0 |
| Exact zone-count rate | 0 | 0 |
| Total-area median absolute percentage error | 1 | 1 |
| Room-area median absolute percentage error | not applicable | not applicable |
| Incorrect high-confidence rate | 1 | 0 |
| Unknown-host openings | 0 | 0 |
| Stale decisions | 0 | 0 |

The low values make the next work measurable: M7.8B must improve wall filtering and topology against this corpus rather than tune arbitrary thresholds for one plan.

## TDD evidence

Representative RED → GREEN slices:

```text
Benchmark route and Worker extraction
RED:   4b0fe8fd814b672b6ce6579643ea88954a116db0 — CI #2521 FAIL
GREEN: bccf1e35ce4e01d55a7be11b220b8e5764524244 — CI #2528 PASS

Baseline applicability and evidence contract
RED:   27b83eadd1a60163267b5fc64ccac86411beee5a — CI #2534 FAIL
GREEN: 8788c4db4b68000f4ac53412c9886d1b63f8bb1f — Recognition Benchmark #25 PASS

Portable evidence checksums
RED:   8578fdfdeec2c574ea23f5f1c21ede352c0279e2 — CI #2554 FAIL on stale acceptance assertion
GREEN: e338dcc97322eb16d9fb631fbcc1f3b141cf0ef5 — CI #2556 PASS

Real overlays and regression allowances
RED:   2472d54b72c5c4f5e445faabf83c8277781d05df — CI #2564 FAIL
GREEN: 15d0066eab770e632382459e1795993d5c3213cb — CI #2578 / Recognition Benchmark #40 PASS
```

The final RED slice proved three review findings before correction:

- no real overlay renderer existed;
- documented continuous-metric allowances were not implemented;
- recognition-engine version drift did not require explicit baseline migration.

## Final product-head verification

```text
head:                  15d0066eab770e632382459e1795993d5c3213cb
standard CI:           30742709585 / #2578 — PASS
recognition benchmark: 30742709587 / #40 — PASS
M7 browser audit:      30742709579 / #493 — PASS
artifact:              8831835746
artifact digest:       sha256:a3ebe3bffedcb0a05446032b2cdadf781755ade4fe8b003aa69e6e63150a42f7
```

The exact product head passed:

- M7 documentation contract;
- complete unit regression suite;
- Core Recognition Benchmark with eight fixtures and no baseline regressions;
- TypeScript;
- ESLint;
- production build;
- fixture privacy/integrity validation;
- Chromium Source Benchmark for all eight fixtures;
- production Worker/shared-engine semantic equality;
- Source scoring and aggregate report generation;
- generation of eight source-plan SVG overlays with TP/FP/FN semantics;
- autonomous evidence-bundle verification through `sha256sum -c SHA256SUMS` for all reports and overlays;
- Chromium full M7 browser regression;
- WebKit core smoke.

The benchmark workflow used no OpenRouter key and made no live AI/provider call. Manual artifact inspection confirmed that the overlays contain the actual synthetic/redrawn source plans and geometric evidence rather than screenshots of the benchmark harness.

## Product-owner acceptance gate

Pending product-owner review of:

- eight Source Benchmark overlays;
- aggregate Core and Source metric table;
- representative false positives and false negatives;
- public-safety and anonymisation evidence;
- confirmation that the ordinary recognition Draft → AI review → explicit Apply workflow still behaves correctly.

PR #40 must remain Draft until the product owner confirms this evidence. After confirmation, this record requires the literal acceptance text, fresh exact-head workflows, unresolved-thread verification, Ready transition and squash merge.
