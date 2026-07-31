# M7.4 — Canvas Selection and Mode Feedback Acceptance

## Status

Automated acceptance: **PASS**

Product-owner browser acceptance: **pending**

The pull request must remain Draft until the product-owner browser smoke is explicitly accepted.

## Tested implementation

- Repository: `True-Ruslan/vlezet`
- Pull request: `#29`
- Branch: `feat/m7-4-canvas-selection-mode-feedback`
- Tested implementation SHA: `0140f48c2de1d9c0f235f382d674e0151d7c265c`
- Base SHA: `be85f807017ff47f524baafb16a9349c5654a049`

The acceptance evidence commit is documentation-only. The implementation and browser-test candidate above is the exact SHA used by both required workflow gates.

## Required workflow evidence

### Standard CI

- Workflow: `CI`
- Run ID: `30664624339`
- Run number: `1939`
- Conclusion: `success`
- Tested head SHA: `0140f48c2de1d9c0f235f382d674e0151d7c265c`
- Run: https://github.com/True-Ruslan/vlezet/actions/runs/30664624339

Verified gates:

- M7 documentation contract — PASS
- unit tests — PASS
- typecheck — PASS
- lint — PASS
- production build — PASS

### Browser acceptance

- Workflow: `M7 Browser Audit`
- Run ID: `30664624124`
- Run number: `208`
- Job ID: `91268585587`
- Conclusion: `success`
- Tested head SHA: `0140f48c2de1d9c0f235f382d674e0151d7c265c`
- Run: https://github.com/True-Ruslan/vlezet/actions/runs/30664624124

Verified gates:

- Chromium M7 full browser audit — PASS
- WebKit core smoke — PASS
- browser evidence upload — PASS

## Browser evidence artifact

- Artifact name: `m7-browser-audit-evidence`
- Artifact ID: `8806491228`
- Size: `1,892,622` bytes
- Digest: `sha256:fdddfffd7d8ca9f649940c136c7c1700ed029d9bd38f18d26852be5c74453afa`
- Created: `2026-07-31T20:56:04Z`
- Expires: `2026-08-14T20:56:03Z`
- Artifact: https://github.com/True-Ruslan/vlezet/actions/runs/30664624124/artifacts/8806491228

## Accepted automated scenarios

- active Select, Wall, Measure, opening placement and 3D mode communication;
- first-point and second-point phases for walls and tape measurement;
- one-level `Escape` priority;
- selectable hover distinct from selection;
- live valid opening preview and preview removal away from a wall;
- equivalent mode meaning at compact width;
- `Escape` return from read-only 3D to 2D;
- preservation of the existing M7.2 and M7.3 Chromium regression suite;
- WebKit core smoke.

## Regression diagnosis recorded during acceptance

The previous candidate `f5eebbce5043c85d37eb97b12a2522680a2a1997` passed standard CI but failed one Chromium hover assertion because the test pointer targeted the exact edge of the snapped wall hit stroke. The browser test was corrected to target the snapped wall centreline. Product geometry, hit width, snapping and selection order were not changed by that correction.

## Authority boundaries

The accepted implementation does not change:

- `VlezetDocument`, schemas or migrations;
- IndexedDB, autosave or backup contracts;
- geometry or snapping algorithms;
- hit tolerances or selection ordering;
- semantic history;
- recognition algorithms;
- planning authority;
- spatial/3D authority.

## Remaining manual gate

Before PR #29 leaves Draft, manually verify in a supported desktop browser:

1. Wall first point, second point and sequential `Escape` behaviour.
2. Measure first point, second point and sequential `Escape` behaviour.
3. Hover is visually distinct from selection for a wall and another selectable entity.
4. Door/window valid preview appears on a wall and clears away from it.
5. Compact layout remains readable without horizontal overflow.
6. `Escape` from 3D returns to 2D without closing an unrelated hidden workflow.
