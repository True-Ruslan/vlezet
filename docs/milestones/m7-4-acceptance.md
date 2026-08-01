# M7.4 — Canvas Selection and Mode Feedback Acceptance

## Status

Automated acceptance: **PASS**

Product-owner browser acceptance: **PASS**

Milestone acceptance: **COMPLETE**

The product owner completed the prescribed browser smoke on 2026-08-01 and confirmed that every scenario behaved exactly as specified.

## Tested implementation

- Repository: `True-Ruslan/vlezet`
- Pull request: `#29`
- Branch: `feat/m7-4-canvas-selection-mode-feedback`
- Tested implementation SHA: `0140f48c2de1d9c0f235f382d674e0151d7c265c`
- Final acceptance-document SHA before this evidence-only update: `005571b5662be5c483e7b81a41724961d375b39f`
- Base SHA: `be85f807017ff47f524baafb16a9349c5654a049`

The implementation and browser-test candidate above is the exact SHA used by both required implementation workflow gates. Subsequent commits are acceptance documentation only.

## Required workflow evidence

### Implementation CI

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

### Implementation browser acceptance

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

### Final acceptance-head verification

The product-owner acceptance head `005571b5662be5c483e7b81a41724961d375b39f` passed both required workflows:

- CI — PASS — run `30686257574` / #1943
- M7 Browser Audit — PASS — run `30686257558` / #210
- Chromium full flow — PASS
- WebKit core smoke — PASS
- browser evidence upload — PASS

Final-head browser artifact:

- Artifact name: `m7-browser-audit-evidence`
- Artifact ID: `8814039131`
- Size: `1,898,196` bytes
- Digest: `sha256:272f3f120e1e6270f04b15bd663b9f7641b2b51c191579055434e748519bc30f`
- Created: `2026-08-01T05:42:08Z`
- Expires: `2026-08-15T05:42:07Z`
- Artifact: https://github.com/True-Ruslan/vlezet/actions/runs/30686257558/artifacts/8814039131

## Original implementation browser evidence artifact

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

## Product-owner browser acceptance

Accepted on 2026-08-01.

The product owner manually verified:

1. Wall first-point and second-point feedback.
2. Sequential one-level `Escape` behaviour for Wall.
3. Measure first-point and second-point feedback.
4. Sequential one-level `Escape` behaviour for Measure.
5. Hover presentation distinct from persistent selection.
6. Door and window preview appearance and clearing.
7. Invalid opening-placement feedback and blocked commit.
8. Read-only 3D status and `Escape` return to 2D.
9. Compact layout readability without horizontal overflow.
10. Pan cursor states and furniture placement feedback.

Result: all checks passed exactly as prescribed; no acceptance deviations were reported.

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

## Acceptance conclusion

M7.4 is accepted at product and automated levels. PR #29 is eligible to leave Draft and proceed to integration.
