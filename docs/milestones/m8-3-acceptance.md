# M8.3 Precision Reference Calibration — acceptance

Date: 2026-08-17  
PR: #92  
Tracker: #57  
Status: **PRODUCT-OWNER ACCEPTED / PROTECTED SQUASH-MERGED / POST-MERGE VERIFIED**.

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

Both cases are protected by deterministic/unit coverage and real browser acceptance.

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

## Accepted exact-head evidence

Accepted product-code/test head:

```text
53ee9399f2496ff3847761b9290cef03d8aa4b7e
```

Final acceptance/documentation head:

```text
bcb38150e0e6b823e2679b751ae1d96ea84b7ea8
```

Exact-head gates on the final PR head:

```text
CI #5247:                         PASS
project documentation contract:  PASS
unit tests:                       PASS
coverage:                         PASS
Testing Policy:                   PASS
Core Recognition Benchmark:       PASS
typecheck:                        PASS
lint:                             PASS
build:                            PASS
Browser Acceptance #1692:        PASS
Chromium:                         67/67 PASS
WebKit representative suite:      57/57 PASS
workers:                          1
retries:                          0
CodeQL #607:                      PASS
```

## Protected integration

GitHub protected squash-merged PR #92 on 2026-08-17 and reported the actual integration identity:

```text
01f520988a84291fb6e4f918e21f3403f17c4529
```

`main` was confirmed to point at that exact commit. Post-merge verification on the actual merge SHA:

```text
CI #5248:       PASS through build
CodeQL #608:    PASS
```

The browser workflow is pull-request scoped; no post-merge Browser Acceptance run is claimed. The accepted browser evidence remains Browser Acceptance #1692 on the final PR head.

## Milestone outcome

M8.3 is complete: **implemented → tested → product-owner accepted → protected-integrated → post-merge verified**.

M8.4 Assisted Tracing is now unblocked. It must consume this accepted M8.3 source-coordinate/calibration substrate rather than invent a parallel image/world transform or reintroduce whole-plan recognition as a beta gate.