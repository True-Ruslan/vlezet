# M8.3 Precision Reference Calibration — accepted Product Owner feedback hardening

Date: 2026-08-17  
PR: #92  
Accepted product/test head: `53ee9399f2496ff3847761b9290cef03d8aa4b7e`  
Final acceptance/docs head: `bcb38150e0e6b823e2679b751ae1d96ea84b7ea8`  
Protected squash merge: `01f520988a84291fb6e4f918e21f3403f17c4529`  
Status: **PRODUCT-OWNER ACCEPTED / PROTECTED SQUASH-MERGED / POST-MERGE VERIFIED**.

This focused record supplements the earlier technical-GREEN record `docs/changelog/2026-08-16-m8-3-precision-reference-calibration-technical-green.md` with the final Product Owner feedback and integration cycle.

## Real-session findings

The first Product Owner session exposed two defects that automated GREEN had not yet protected adequately:

1. `Сохранить и открыть план` could look actionable but silently do nothing while required calibration data was incomplete.
2. After placing A, reacquiring/clicking A while B was missing could create B at A instead of leaving B missing.

## Corrections

- incomplete Save now follows an explicit actionable validation path and explains the exact missing requirement inline while keeping calibration open;
- the workflow shows the next required calibration step before Save;
- an existing endpoint hit has priority over creation of a missing endpoint;
- reacquiring A can no longer synthesize B on top of A;
- focused unit/handler tests protect incomplete Save, field updates, valid save, failure paths, cancel and endpoint state;
- Playwright protects the exact first-A / reacquire-A / separate-B / Save-without-length journey.

Two test-infrastructure issues were corrected without changing product semantics:

- TypeScript 6 infers generic `ReactElement.props` as `unknown`; the test harness now uses explicit narrow element props rather than `any`;
- the Playwright assertion now targets `.field-error[role="alert"]`, avoiding collision with the Next.js route-announcer alert.

## Product Owner acceptance

The Product Owner repeated the focused real-plan journey and reported:

> «Сценарий PASS.»

Acceptance therefore covers the feedback-hardened M8.3 interaction, not merely the earlier technical implementation.

## Final exact-head automated evidence

```text
head:                         bcb38150e0e6b823e2679b751ae1d96ea84b7ea8
CI #5247:                     PASS
  docs contract:              PASS
  unit tests:                 PASS
  coverage:                   PASS
  Testing Policy:             PASS
  Core Recognition Benchmark: PASS
  typecheck:                  PASS
  lint:                       PASS
  build:                      PASS
Browser Acceptance #1692:    PASS
  Chromium:                   67/67 PASS
  WebKit representative:      57/57 PASS
  workers:                    1
  retries:                    0
CodeQL #607:                  PASS
```

No threshold, retry, skip/fixme, validator, persistence rule or architecture authority was weakened.

## Protected integration and post-merge evidence

GitHub protected squash-merged PR #92 and reported the actual merge identity:

```text
01f520988a84291fb6e4f918e21f3403f17c4529
```

`main` was confirmed at that exact SHA. Post-merge gates:

```text
CI #5248:       PASS through build
CodeQL #608:    PASS
```

No post-merge browser run is claimed because Browser Acceptance is pull-request scoped; Browser #1692 remains the accepted cross-engine evidence.

M8.3 is therefore complete through **implemented → tested → accepted → merged → post-merge verified**. M8.4 Assisted Tracing is now unblocked, but must consume the accepted M8.3 source-coordinate/calibration substrate and preserve explicit user/topology authority.