# M7.8B Product-Owner Review — FAIL

**Date:** 2026-08-02  
**PR:** #41  
**Branch:** `feat/m7-8b-source-normalization-wall-topology`  
**Status:** PRODUCT-OWNER FAIL / DO NOT MERGE

## Observed result

A representative clear apartment plan produced:

- 417 local wall candidates;
- 0 local openings;
- 0 high-confidence candidates;
- furniture, sanitary fixtures, room/area labels, digits and door arcs represented as walls;
- a review list too large for meaningful manual validation;
- AI review that retained the polluted local network and added long geometrically unsupported horizontal and vertical lines.

The private source raster and screenshots are intentionally not committed.

## Acceptance decision

M7.8B is not accepted. PR #41 must remain Draft and must not be merged on the basis of the earlier benchmark PASS.

The earlier eight-fixture corpus did not represent this failure class strongly enough. Its green result proves repeatability only, not product fitness.

## Confirmed root cause

The browser path generated line evidence from the full raster. On the representative source this yielded roughly one thousand Hough segments. The pairwise wall-centreline stage then treated many parallel edges from text, furniture and sanitary symbols as possible wall faces, generating more than twelve thousand intermediate pairs before consolidation.

The primary-component heuristic could then select the dense symbol/furniture network because it had greater connected length than the actual architectural shell.

Cloud review was also contaminated because the 417 local candidates expanded the trusted bounds and were supplied as local context.

## Corrective work started

The branch now includes corrective commits after the failed review:

- `81182d49f1e52729e7dafb21fbc9c84feac9f98a` — RED structural-mask contract;
- `bfcd8fde79393ea2e33b6e27e1b67ec545d9d051` — thick-ink Otsu/morphological structural mask before Canny/Hough;
- `4be4f5a2d136ac35daed325867670f5fb204da07` — RED candidate-overload contract;
- `7f69b34799a80b1236754871aeb9412c0ec9f0e3` — fail-closed local review budget;
- `48d647c10fe9306b3a14377befc5962fd831b05e` — product-controller integration preventing unreviewable Draft persistence;
- `aac50eeca7fdedde3a9f8f34e6f532cfacebb43f` — RED cloud-safety contract;
- `842946a626a4ce8660df96a050e5f8d90dd21e81` — reject unbounded and overloaded cloud wall networks.

The structural mask reduced the representative source from approximately 948 unique line segments to approximately 115 and reduced admissible pair hypotheses from approximately 12,346 to approximately 249 in an isolated diagnostic reproduction.

## Required new acceptance conditions

Before M7.8B may be accepted:

1. the same representative source must no longer produce a candidate explosion;
2. furniture, sanitary symbols, labels and digits must not dominate the wall graph;
3. no almost-full-frame unsupported AI walls may enter review;
4. an overload must fail closed with an understandable warning;
5. the public-safe corpus must gain a redrawn clutter-heavy regression covering this failure class;
6. exact-head Standard CI, Source Benchmark, Chromium and WebKit must pass;
7. the product owner must repeat the real-source review and explicitly accept the result.

No recognition output may mutate `VlezetDocument` before explicit Apply.
