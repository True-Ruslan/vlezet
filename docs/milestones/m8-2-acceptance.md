# M8.2 Precision Drawing / Direct Manipulation Foundation — Acceptance

**Date:** 2026-08-13  
**Tracker:** #56  
**PR:** #87  
**Branch:** `feat/m8-2-precision-structural-editing`  
**Product-accepted head:** `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`  
**Status:** PRODUCT-OWNER ACCEPTED — PROTECTED MERGE PENDING

## Product outcome

M8.2 establishes the precision structural-editing and direct-manipulation foundation required before M8.3 reference calibration and M8.4 assisted tracing.

Accepted user-visible behavior includes:

- named structural snapping with deterministic priority/hysteresis and visible guides;
- near-cursor exact wall length/angle input;
- endpoint/junction editing and topology-safe wall translation;
- atomic compatible multi-wall thickness editing;
- dependency-aware wall and whole-room Copy/Duplicate/Paste with fail-closed unsupported Cut semantics;
- exact polygonal room hit-testing, hover fallback and whole-room no-modifier marquee selection;
- explicit mixed room + furniture clipboard/movement semantics without implicit containment ownership;
- direct room translation from free interior or an ordinary already-selected furniture member;
- `Выбрать мебель в комнате` using full-footprint containment;
- hosted door/window drag constrained to the current host wall with stable `wallId`, valid-span/overlap validation and no silent re-hosting;
- practical window hit targets while preserving thin visuals;
- practical door acquisition from the full host-wall opening span, visible leaf and swing arc, while the filled swing sector remains non-listening;
- deterministic compact room-label degradation;
- one semantic history command per committed structural/composite operation and none for preview/cancel/reject;
- explicit fail-closed invalid feedback with no partial structural mutation.

## Architecture acceptance

Verified boundaries:

- `VlezetDocument` remains the sole persistent apartment/layout truth;
- millimetres remain canonical;
- rooms remain derived; no room-ownership field was introduced;
- no project/document schema or migration change was introduced by M8.2;
- `@vlezet/geometry` retains pure geometry/snap/derived-room authority;
- `@vlezet/editor-core` retains structural candidate, validation and semantic-history authority;
- Konva/Canvas owns projection, pointer intent and transient gesture coordination only;
- M2 containment/collision/door/clearance authority is unchanged;
- hosted openings remain attached to validated current host walls during ordinary drag;
- no topology validator, recognition threshold or safety contract was weakened;
- AI/CV remains reviewable assistance only and is not part of the authoritative M8.2 path;
- preserved dev-runtime/HMR action repair is narrowly scoped to missing actions on the live store and never replaces document/history state.

## TDD and regression evidence

M8.2 was developed through repeated genuine RED → GREEN cycles. Historical evidence is preserved in the focused changelogs, including:

- `docs/changelog/2026-08-12-m8-2-direct-manipulation-opening-drag-correction.md`;
- `docs/changelog/2026-08-13-m8-2-runtime-marquee-window-regressions.md`;
- `docs/changelog/2026-08-13-m8-2-door-hit-target-correction.md`.

The final product-owner usability finding concerned door acquisition. Functional hosted-door movement already passed, but the door was inconvenient to acquire because pointer-down effectively required the thin leaf.

The permanent Playwright contract was strengthened so the drag begins from the centre of the **wall-opening span** rather than a mathematically precise leaf point.

```text
harness-only syntax failure:       9e037fce958d91f07a504756922de4b5c8389b3b / Browser #1523 — excluded from product RED
valid RED head:                    e41c695b193a9e20ec0173453cd23d093f1bfaab
CI #5074:                          PASS
Browser Acceptance #1524:         EXPECTED FAIL — 54 PASS / 1 FAIL (door opening-span drag only)
production door patch:             9f37c7c0db394e7f924c732e4d191d3bff724ecf
product-code GREEN head:           8f9317db650bd076df957028035f6a643d0ec470
CI #5082 / run 31679924606:        PASS
Browser Acceptance #1532:         PASS — Chromium + WebKit
browser artifact:                  9173229566
artifact digest:                   sha256:14ff9ba47d708c881adfdccf89f11218efac4af9f54862f332ebd0f487b65ea3
```

The complete swing sector was deliberately not made clickable because it would steal ordinary room/furniture interaction. The wall opening, leaf and arc form the accepted practical target instead.

## Exact-head automated evidence before product acceptance

Accepted head `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`:

```text
CI #5090 / run 31680995080:        PASS
  documentation contract:          PASS
  unit tests:                      PASS
  Core Recognition Benchmark:      PASS
  typecheck:                       PASS
  lint:                            PASS
  build:                           PASS
Browser Acceptance #1540:         PASS
  Chromium:                        PASS
  WebKit:                          PASS
browser run:                       31680995082
browser artifact:                  9173706386
artifact digest:                   sha256:b020c1cf31ef4ecbfdb1dbc1907f54ceaa60abf0f11b8b89082adf7a9220f1c0
unresolved review threads:         0
```

## Product-owner acceptance

On 2026-08-13 the product owner completed the final focused door-UX retest and reported:

> «Все 3 теста PASS»

This confirms:

1. the door can be comfortably acquired/dragged from the wall-opening area without aiming at the thin leaf;
2. the leaf and arc remain usable door targets;
3. ordinary surrounding room/furniture interaction remains reachable inside the swing sector away from the opening/leaf/arc.

The room + furniture marquee/movement and representative window movement scenarios had already received explicit PASS in the immediately preceding product-owner round.

This closes the manual product acceptance gate for M8.2.

## Remaining delivery gate

Product acceptance does not by itself constitute merge. Before integration:

1. synchronize canonical M8.2 acceptance state in `docs/CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md` and `docs/product/UX_ROADMAP.md`;
2. run fresh exact-head CI and Chromium/WebKit Browser Acceptance after those documentation changes;
3. mark PR #87 Ready only after those gates are green;
4. perform the repository's protected squash merge using the accepted delivery authorization;
5. verify the actual squash-merge identity and required Actions on `main`;
6. close #56 only after successful integration and update canonical state if the merge identity requires a post-merge record.

M8.3 must not begin before M8.2 is integrated into `main`.
