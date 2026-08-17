# M8.3 Precision Reference Calibration — accepted Product Owner feedback hardening

Date: 2026-08-17  
PR: #92  
Accepted product/test head: `53ee9399f2496ff3847761b9290cef03d8aa4b7e`  
Status: **PRODUCT-OWNER ACCEPTED; protected integration pending**.

This focused record supplements the earlier technical-GREEN record `docs/changelog/2026-08-16-m8-3-precision-reference-calibration-technical-green.md` with the final Product Owner feedback cycle.

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

## Exact-head automated evidence

```text
head:                         53ee9399f2496ff3847761b9290cef03d8aa4b7e
CI #5246:                     PASS
  docs contract:              PASS
  unit tests:                 PASS
  coverage:                   PASS
  Testing Policy:             PASS
  Core Recognition Benchmark: PASS
  typecheck:                  PASS
  lint:                       PASS
  build:                      PASS
Browser Acceptance #1691:    PASS
  Chromium:                   67/67 PASS
  WebKit representative:      57/57 PASS
  workers:                    1
  retries:                    0
```

No threshold, retry, skip/fixme, validator, persistence rule or architecture authority was weakened.

## Product Owner acceptance

The Product Owner repeated the focused real-plan journey and reported:

> «Сценарий PASS.»

Acceptance therefore covers the feedback-hardened M8.3 interaction, not merely the earlier technical implementation.

## Integration boundary

This record does **not** claim merge. The actual protected merge identity must be recorded only after GitHub reports it, followed by post-merge `main` verification. M8.4 remains blocked until then.