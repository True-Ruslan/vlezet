# M7.8B — Source Normalisation and Wall Topology Acceptance

**Status:** AUTOMATED ACCEPTANCE PASS / PRODUCT OWNER REVIEW PENDING  
**Date:** 2026-08-02  
**PR:** #41  
**Feature branch:** `feat/m7-8b-source-normalization-wall-topology`  
**Base:** `d6e8668c5ad0780a0a28d9c1fef6e9d37e9bbe4d`  
**Final product implementation head:** `4e1542e70749e02a6064b1f135dfd43fd28649cb`

## Delivered scope

M7.8B turns the accepted M7.8A benchmark into the first measurable local-recognition quality improvement.

Delivered:

- deterministic architectural-line canonicalisation and deduplication;
- image-frame and short-noise filtering;
- conservative diagonal suppression for strongly orthogonal sources;
- equalised strict and permissive browser edge passes;
- complete OpenCV.js Hough output extraction;
- paired-edge wall-centreline derivation;
- bounded collinear gap bridging;
- dominant wall-thickness evidence filtering;
- deterministic transient wall topology;
- endpoint snapping and bounded intersection extension;
- T/cross-junction splitting;
- stable geometry-derived junction and edge identities;
- primary structural-component selection;
- provisional local confidence capped at medium;
- fail-closed deferral of local opening candidates to M7.8C;
- engine version `4` with an explicitly reviewed benchmark baseline.

M7.8B intentionally does not implement final door/window classification, room faces, OCR, areas, cloud/local reconciliation or room-oriented review UX.

## Root-cause evidence

The original browser path iterated `HoughLinesP` through `lines.rows`. OpenCV.js exposes detected line coordinates through flat `lines.data32S` entries grouped as `x1, y1, x2, y2`. The old loop therefore processed one line per pass and discarded the remaining Hough output.

The corrected path iterates every complete four-value record. A source-contract test rejects regressions back to row-based iteration.

## Architecture and authority

Confirmed unchanged from base:

- `VlezetDocument`, schemas and migrations;
- IndexedDB and project backup/import/export formats;
- editor-core validation and semantic Undo/Redo;
- explicit Draft → Apply authority;
- M2 fit/collision/door-swing/clearance authority;
- planner and 3D authority;
- OpenRouter production request/response and runtime-only secrets;
- non-authoritative treatment of all AI/CV candidates.

The topology graph is transient recognition evidence. Only ordinary reviewed candidates cross into the existing Draft contract.

## RED → GREEN evidence

Representative slices:

```text
Architectural-line and topology contracts
RED:   b4e57372e005ccbfec3616b12cea6b72d50a96c6
       missing architectural-lines and wall-topology modules
GREEN: ba7ab986335c78ac0dbf0b6330f7203418d83193
       pure normalisation and topology modules implemented

Browser source normalisation
RED:   cf2bb7c3c8e48d8633b897a4f27b382b652b3365
       strict/permissive equalised passes not present
GREEN: 6cd08e32f8348fcd56de95b6364c38932f42f432
       bounded two-pass extraction implemented

Complete Hough output
RED evidence: browser debug showed two total segments from two passes
GREEN: 41ff39481e5dd565c96031ce4c58f1465a05b9dc
       flat data32S extraction reads every detected line

Source structural filtering
GREEN progression:
       58929a27a3709d62ab7d234a30b17de59069c356 — bounded gap bridge / primary component
       b559b2e314ca7350f1adb52d69924a52a1ae4761 — dominant thickness filtering
       55a85e25eccf1e09dfb60e324d7865db5c765cc3 — orthogonal-plan diagonal suppression

Fail-closed opening boundary
GREEN: 5e73e9af193ea004a440c209d538aecebb5be54b
       no local opening enters Draft before M7.8C classification and host validation
```

## Benchmark comparison

### Aggregate

| Metric | M7.8A | M7.8B Core | M7.8B Source |
| --- | ---: | ---: | ---: |
| Wall geometry F1 | Core `0.131737`; Source `0` | `0.834355828221` | `0.518518518519` |
| Wall topology F1 | Core `0.131737`; Source `0` | `0.809815950920` | `0.493827160494` |
| Opening F1 | `0` | `0` | `0` |
| Incorrect high-confidence rate | Core `1`; Source `0` | `0` | `0` |
| Unknown-host openings | `0` | `0` | `0` |
| Stale decisions | `0` | `0` | `0` |

### Dense anonymised regression

```text
wall geometry F1: 0.500000
wall topology F1: 0.400000
geometry evidence: TP 5 / FP 3 / FN 7
result: non-empty local wall Draft
```

The result is materially better than the accepted zero-wall product failure, but it is not final recognition accuracy.

## Exact product-head verification

```text
head:                    4e1542e70749e02a6064b1f135dfd43fd28649cb
Standard CI:             30749905614 / #2682 — PASS
Recognition Benchmark:  30749905562 / #89 — PASS
M7 Browser Audit:        30749905580 / #542 — PASS
benchmark artifact:      8834098293
benchmark digest:        sha256:9d34c6cb8dbd9f58995d479cf1ab0e873961942c512687689839d075a55107ed
browser artifact:        8834120926
browser digest:          sha256:714715f449fcabcd85a571a4dd5edc2fb969af254daed47fa5227764946c99f3
```

The product implementation head passed:

- complete unit regression suite, including 388 web tests;
- architectural-line, wall-evidence and topology tests;
- Core Benchmark baseline comparison for engine `4`;
- TypeScript;
- ESLint;
- production build;
- all eight Chromium/OpenCV source fixtures;
- dense source non-empty wall assertion;
- source scoring and all eight deterministic overlays;
- portable `sha256sum -c SHA256SUMS` verification;
- production Worker/shared-engine equality;
- Chromium full M7 regression;
- WebKit core smoke.

## Privacy evidence

The product-owner source plan and screenshots were not committed. Measurement uses only the accepted public-safe corpus and the redrawn anonymised regression fixture.

## Known limitations

- Source wall topology F1 `0.493827` remains below final M7.8 target `0.90`;
- the perspective-photo fixture remains unresolved at `0/0`;
- dense developer plans can still miss internal walls or retain several false-positive axes;
- local openings are intentionally absent until M7.8C;
- no room faces, labels or areas are produced;
- cloud reconstruction can remain structurally wrong and is still non-authoritative.

## Product-owner acceptance gate

The product owner must re-run the same representative clear plan on this branch and verify:

1. local recognition produces at least one wall candidate;
2. detected axes are visibly closer to exterior and principal internal walls than before M7.8B;
3. false positives are visible and individually rejectable;
4. the document does not mutate before explicit Apply;
5. the opening-deferral diagnostic is understandable;
6. optional AI review remains available;
7. Apply remains one semantic operation and Undo restores the previous document.

PR #41 remains Draft until literal product-owner acceptance is recorded. After acceptance, canonical state will mark M7.8B DONE and select M7.8C Openings, Rooms, Labels and Area Constraints as NOW.
