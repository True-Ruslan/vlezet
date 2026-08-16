# M8.3 Precision Reference Calibration — technical GREEN

Date: 2026-08-16  
PR: #92  
Milestone tracker: #57  
Status: **implemented and automated-tested; Product Owner acceptance pending; not merged**.

## Product outcome

M8.3 establishes a trustworthy source-image calibration layer before Assisted Tracing. The calibration workflow now operates in source-image coordinates and provides reviewable precision assistance without making world-grid or AI geometry authoritative before scale is known.

Implemented behavior:

- dedicated calibration viewport with fit, pan and pointer-centred zoom;
- source-image edge, line-centre and intersection feature detection;
- deterministic snapping with acquisition/release hysteresis and explicit enable/disable;
- temporary Alt suppression of snapping;
- magnifier, crosshair and coordinate readout;
- semantic A/B endpoint handles;
- source-pixel keyboard nudge, including Shift coarse nudge;
- fractional source-image coordinates;
- optional second known-distance verification;
- residual/error verification and distortion warning behavior;
- calibration state remains ephemeral until the existing explicit save path commits the reference calibration;
- no project-schema migration and no new geometry authority.

## Important defects found and corrected during GREEN hardening

### Live handler state

A single handler instance could read stale captured `draft`/viewport state across sequential events. Focused RED tests proved that the second placement could overwrite point A and sequential wheel gestures could lose accumulated state. The controller now keeps a synchronous ephemeral live mirror for the active calibration handler session while React remains the rendering owner.

### Native wheel lifecycle

Calibration wheel handling is installed as a native `{ passive: false }` listener with deterministic cleanup so `preventDefault()` is valid. Initial fit/bind lifecycle is separately covered.

### Rendered stage / CSS scaling

The calibration viewport is bound to the rendered stage and the source image explicitly uses its natural dimensions without responsive `max-width` rescaling. This removes double scaling between CSS layout and calibration transforms.

### Border/content coordinate origin

A real source-coordinate drift was found after browser acceptance showed points near `100` becoming approximately `103.38` source pixels. TDD isolated the cause: viewport fit uses the stage content box (`clientWidth`/`clientHeight`) while pointer coordinates had been measured from the border-box origin returned by `getBoundingClientRect()`.

A focused RED test with a 1 px border reproduced `(101, 101)` instead of `(100, 100)`. Pointer conversion now subtracts `clientLeft`/`clientTop`, aligning pointer coordinates with the same content origin used by viewport fitting.

### Legacy compact acceptance harness

The legacy reference-import browser helper calculated click coordinates while the calibration stage extended below a 960×600 viewport. The synthetic mouse clicks were therefore outside the visible viewport and never reached the product. The harness now scrolls the stage into view before measuring its box.

### Snap-suppression assertion

The final Chromium failure was a false-positive assertion: after snapping was disabled the point correctly became `113.50, 100.00`, but the test rejected any text containing `100.00` and accidentally matched the unchanged Y coordinate. The browser contract now reads and checks the X coordinate specifically.

## TDD / automated evidence

Key RED→GREEN evidence includes:

- stale draft/viewport handler tests;
- lifecycle binding and non-passive wheel listener tests;
- rendered-stage fit and source transform tests;
- border/content-origin RED: expected `(100,100)`, received `(101,101)` before the fix;
- precision browser journey covering fit, zoom, pan, source snapping, Alt suppression, keyboard nudge and snap disable;
- legacy real reference import/save path at compact viewport.

Final implementation head before this documentation record:

```text
0bcf0588b9a968748a220b340db2c69220d3e08b
```

Exact-head automated evidence on that implementation head:

```text
CI #5235:                  PASS
- project docs contract:  PASS
- unit tests:             PASS
- coverage:               PASS
- Testing Policy:         PASS
- Core Recognition Benchmark: PASS
- typecheck:              PASS
- lint:                   PASS
- build:                  PASS

Browser Acceptance #1680: PASS
- Chromium:               PASS — 66/66
- WebKit representative:  PASS
- evidence upload:        PASS
```

No coverage threshold, browser retry, skip/fixme, validation rule or architectural authority was weakened to obtain GREEN.

## Acceptance boundary

This record establishes **technical readiness only**.

Still pending:

1. Product Owner acceptance of the real reference-plan calibration journey;
2. canonical acceptance record/state transition after that decision;
3. protected integration of PR #92;
4. post-merge verification on `main`.

M8.4 Assisted Tracing remains intentionally **not started** until M8.3 is accepted and integrated. This prevents source-coordinate/calibration defects from being compounded by tracing assistance.
