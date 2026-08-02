# M7.8A — Recognition Benchmark Foundation Acceptance

**Status:** PRODUCT OWNER ACCEPTANCE PASS / READY FOR MERGE  
**Date:** 2026-08-02  
**PR:** #40  
**Feature branch:** `feat/m7-8a-recognition-benchmark-foundation`  
**Final product head:** `322fd13658ac168b92e65d7837c25e0d9434c40f`  
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
- dedicated merge-blocking Recognition Benchmark workflow without live provider calls;
- corrected calibration pointer/magnifier projection through the actual rendered image rectangle;
- undirected horizontal/vertical calibration axes that cannot flip a source plan when A/B order is reversed.

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

The only production-path recognition refactor extracts existing local OpenCV behaviour from `recognition.worker.ts` into a shared browser function. Regression coverage preserves Worker protocol, progress phases, algorithm constants and browser-safe `Crypto.randomUUID()` invocation.

The calibration correction changes only runtime coordinate projection and alignment normalization. It introduces no persisted coordinate system, schema or geometry authority.

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

The additional product-owner calibration and recognition feedback was recorded without committing the supplied private plan or screenshots.

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

Manual product review additionally confirmed the baseline gap on a clear real plan:

- local CV can return zero walls and zero openings;
- cloud output can remain structurally unrelated to the source topology.

This evidence is the first required RED case for M7.8B and remains tracked by issue #27.

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

Calibration direction and letterbox projection
RED:   2f60983d8edb15a8faf50561769250c65c087b1b — CI #2586 FAIL
       reversed vertical/horizontal axes produced approximately 180° rotation
GREEN: 322fd13658ac168b92e65d7837c25e0d9434c40f — CI #2602 / Benchmark #52 / Browser #505 PASS
```

The calibration RED slice reproduced the product-owner screenshots before correction:

- vertical A-lower/B-upper calibration yielded approximately `179.91°`;
- reversed horizontal calibration yielded `-180°`;
- cursor coordinates were derived from the letterboxed stage rather than the rendered image rectangle.

The GREEN implementation maps pointer, A/B markers, line overlay and magnifier through the same rendered-image rectangle and treats horizontal/vertical calibration as an undirected axis.

## Final product-head verification

```text
head:                  322fd13658ac168b92e65d7837c25e0d9434c40f
standard CI:           30745755973 / #2602 — PASS
recognition benchmark: 30745755951 / #52 — PASS
M7 browser audit:      30745755956 / #505 — PASS
artifact:              8832821537
artifact digest:       sha256:f99acff95b428ffcefd6896cc5085a4ef4480d48cbac629d5825ffb8956945a4
```

The exact product head passed:

- M7 documentation contract;
- complete unit regression suite, including 385 web tests and 75 geometry tests;
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
- Chromium regression for a wide letterboxed image and vertical A-lower/B-upper calibration;
- WebKit core smoke.

The benchmark workflow used no OpenRouter key and made no live AI/provider call.

## Product-owner acceptance

The product owner re-tested the corrected calibration workflow on the supplied real plan and confirmed:

> Все работает теперь четко.

This accepts the two blocking calibration behaviours:

1. the magnifier/crosshair now follows the same source point;
2. vertical A-lower/B-upper calibration with the entered real length preserves the source-plan orientation.

Recognition quality is not falsely accepted as complete. The zero-result local CV case and structurally incorrect cloud reconstruction remain explicit M7.8B work under issue #27.

## Integration decision

M7.8A is accepted. The remaining integration procedure is documentation-only:

1. rerun Standard CI, Recognition Benchmark and M7 Browser Audit on the acceptance-record head;
2. verify no unresolved review threads;
3. mark PR #40 Ready for review;
4. squash merge into `main`;
5. select M7.8B Source Normalisation and Wall Topology as the next implementation slice.
