# M8.3 Precision Reference Calibration — acceptance

Date: 2026-08-17  
PR: #92  
Tracker: #57  
Status: **PRODUCT-OWNER ACCEPTED; protected integration pending**.

## Product acceptance

The Product Owner completed the focused real-plan calibration journey after the final feedback hardening and reported:

> «Сценарий PASS.»

Accepted real-session journey:

1. import a real reference plan;
2. place point A — only A is created;
3. reacquire/click A while B is still missing — B is not synthesized on top of A;
4. place B separately;
5. attempt Save without a real length — the workflow remains open and shows `Укажите реальную длину между точками A и B.`;
6. enter the real length and save — the calibrated reference opens in the ordinary planner workflow.

This acceptance closes the two Product Owner defects found after the first technical GREEN:

- an apparently actionable Save control could silently do nothing while calibration was incomplete;
- reacquiring the first endpoint could create the missing second endpoint at the same position.

Both cases are now protected by deterministic/unit coverage and real browser acceptance.

## Accepted product scope

M8.3 provides a dedicated source-image calibration layer before Assisted Tracing:

- calibration-specific fit, pan and pointer-centred zoom;
- source-image edge, line-centre and intersection feature detection;
- deterministic source snapping with acquisition/release hysteresis;
- explicit snap toggle and temporary Alt suppression;
- magnifier, crosshair and source-coordinate readout;
- semantic A/B endpoint handles;
- source-pixel keyboard nudge with Shift coarse nudge;
- fractional source-image coordinates;
- optional second known-distance verification;
- residual/error verification and distortion-warning behavior;
- explicit save through the existing reference persistence boundary.

## Authority boundaries preserved

- `ReferencePlan` remains the persistent reference authority;
- calibration viewport/navigation and verification state remain runtime-only until explicit save;
- source-image assistance does not create authoritative apartment geometry;
- world-grid snapping is not used as calibration authority before scale is known;
- no project-schema migration was introduced;
- no AI/network dependency was introduced;
- no coverage threshold, retry, skip/fixme, validator, persistence rule or geometry authority was weakened.

## Defects corrected during hardening

- stale handler closure state across sequential placement/wheel events;
- native passive wheel/preventDefault lifecycle;
- responsive CSS double scaling of the calibration image;
- rendered-stage/source transform mismatch;
- content-box vs border-box pointer-origin drift;
- compact legacy browser helper clicking below the visible viewport;
- snap-suppression assertion checking the unchanged Y coordinate instead of X;
- incomplete Save path with no user-facing explanation;
- missing-endpoint resolution that could synthesize B while reacquiring A;
- TypeScript 6 test-harness `ReactElement.props` inference issue;
- browser assertion collision with the Next.js route-announcer `alert` role.

## Exact-head automated evidence before acceptance truth-sync

Accepted product-code/test head:

```text
53ee9399f2496ff3847761b9290cef03d8aa4b7e
```

CI #5246:

```text
project documentation contract: PASS
unit tests:                     PASS
coverage:                       PASS
Testing Policy:                 PASS
Core Recognition Benchmark:     PASS
typecheck:                      PASS
lint:                           PASS
build:                          PASS
```

Browser Acceptance #1691:

```text
Chromium:                       67/67 PASS
WebKit representative suite:    57/57 PASS
Product Owner feedback regression: PASS
browser evidence upload:        PASS
workers:                        1
retries:                        0
```

## Remaining integration gate

1. canonical truth-sync is committed on PR #92;
2. exact-head CI and Browser Acceptance are GREEN on that documentation head;
3. PR #92 is protected-integrated into `main`;
4. the actual protected merge identity is recorded only after GitHub reports it;
5. post-merge `main` verification is GREEN.

M8.4 Assisted Tracing remains blocked until protected integration completes. It must consume the accepted M8.3 source-coordinate/calibration substrate rather than invent a parallel image/world transform.