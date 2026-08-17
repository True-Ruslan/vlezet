# M8.4 Wall Assisted Tracing — Automated Technical GREEN

**Date:** 2026-08-17  
**Tracker:** #51  
**Draft PR:** #94  
**Branch:** `feat/m8-4-wall-assisted-tracing`  
**Status:** **IMPLEMENTED / AUTOMATED TECHNICAL GATES GREEN / PRODUCT OWNER REAL-PLAN ACCEPTANCE PENDING / NOT MERGED**

## Product outcome

The wall-only M8.4 slice adds optional deterministic source-image assistance inside the ordinary Wall tool. It consumes the accepted M8.3 calibrated reference substrate and never creates a second geometry authority.

The ordinary manual editor remains complete and authoritative:

- `VlezetDocument` is the only persistent apartment geometry truth;
- `ReferencePlan.transform` plus `worldPointToImage()` / `imagePointToWorld()` are the only source/world transform authority;
- source assistance defaults Off and is runtime-only;
- existing topology targets beat source-image evidence;
- high-confidence unambiguous source evidence may beat construction/grid fallback;
- weak, ambiguous, outside-reference, unavailable-image and read-error cases abstain to ordinary behavior;
- Alt/Option suppresses assistance for the current gesture;
- an assisted wall is committed through the ordinary wall path and remains one semantic Undo/Redo command;
- no source-assist field or evidence is persisted in `VlezetDocument` or the project schema;
- no AI or network request is required.

Hosted door/window assistance and whole-plan recognition are explicitly outside this wall-only acceptance boundary.

## Implemented scope

- pure reference-side source-assist resolution built from the accepted M8.3 transform/snap primitives;
- explicit structural/source precedence helper instead of changing global structural-snap priorities;
- runtime-only Zustand setting with default Off;
- visible keyboard-reachable `По подложке` toolbar control with `aria-pressed`;
- bounded wall-source feature reader reusing the accepted M8.3 image-analysis policy;
- wall source-assist controller with fail-closed exception handling and hysteresis identity;
- Canvas wall-draft integration after ordinary structural snapping and before existing exact numeric input;
- runtime context invalidation across wall draft, reference revision, reference asset/image and toggle changes;
- explicit ephemeral acquired-state feedback without export/document authority;
- semantic-history regression proving commit → Undo → Redo with no source metadata persistence;
- dedicated real-browser M8.4 acceptance in complete Chromium discovery and the explicit representative WebKit registry.

## Meaningful RED → GREEN evidence

The slice was implemented under genuine TDD. Important final hardening checkpoints include:

- stale Canvas handler/lifecycle defects were reproduced before fixing live runtime context/state handling;
- a focused browser RED initially exposed an invalid test assumption about a hard-coded `25 mm/px` calibration scale; the test contract was corrected to derive scale and expected endpoint from the actually persisted calibration/`ReferenceTransform` rather than weakening product behavior;
- `72252498ec229a11815542d4cd8ea0fb2f6a3f38` intentionally made Testing Policy RED because the new M8.4 browser spec was not yet present in the explicit WebKit registry;
- `b4f1ede701aaa28b5ee91d9a017a5e7fb6ff23d5` added the M8.4 spec to `WEBKIT_SPECS` and returned the policy plus full browser suite to GREEN.

No retry, skip/fixme, coverage threshold, validator, project schema or authority rule was weakened.

## Verified implementation checkpoint

The immutable implementation/policy head before canonical documentation sync is:

```text
technical implementation head:        b4f1ede701aaa28b5ee91d9a017a5e7fb6ff23d5
CI #5289 / run 32047239604:           PASS
  project documentation contract:     PASS
  unit tests:                         PASS
  coverage:                           PASS
  Testing Policy:                     PASS
  Core Recognition Benchmark:         PASS
  typecheck:                          PASS
  lint:                               PASS
  build:                              PASS
Browser Acceptance #1732 / run 32047239648: PASS
  Chromium:                           68/68 PASS
  M8.4 Chromium position:             17/68 PASS
  WebKit representative:              58/58 PASS
  M8.4 WebKit position:               10/58 PASS
  workers:                            1
  retries:                            0
CodeQL check 95437977365:             PASS
  result:                             No new alerts in code changed by this pull request
```

The dedicated M8.4 browser scenario performs the real product path:

1. creates a project;
2. imports a deterministic generated PNG reference;
3. calibrates and persists the reference through the real UI/storage path;
4. verifies `По подложке` starts Off and enables it explicitly;
5. acquires strong source evidence with visible `По подложке` feedback;
6. commits an ordinary wall and checks the endpoint against the persisted `ReferenceTransform`;
7. proves existing topology wins;
8. proves Alt/Option suppression;
9. proves Off restores ordinary behavior;
10. proves one-step Undo/Redo;
11. fails on browser `pageerror` / `console.error`;
12. asserts no fetch/XHR dependency for source assistance.

## Canonical docs-head verification and CodeQL retry evidence

Canonical technical-state sync head `33201c6d6bf2aee373debb3b2e6ed92fd5846ca8` was verified after the documentation-only sync:

```text
CI #5290 / run 32049070547:           PASS through build
Browser Acceptance #1733 / run 32049070178: PASS
  Chromium:                           68/68 PASS
  dedicated M8.4 flow:                17/68 PASS
  WebKit representative:              58/58 PASS
  dedicated M8.4 flow:                10/58 PASS
  browser artifact:                   9294244947
  artifact digest:                    sha256:a5a7ef8e6f094950bc3db23f96146d1b8cdebac083bdf75c9ecf2da332a4a096
```

The first CodeQL attempt on that docs-only head did **not** produce a valid `actions` analysis result because GitHub's CodeQL service was unavailable during `Initialize CodeQL`. Exact log messages included `No server is currently available to service your request. Sorry about that.` and `Please try resubmitting your request`. The JavaScript/TypeScript analysis itself passed; the `actions` job failed before analysis. No repository code, workflow, dependency or policy defect was identified.

GitHub default-setup CodeQL does not allow this run/job to be re-run through the ordinary Actions rerun endpoint (`403: Jobs in this workflow run cannot be re-run`). This evidence-only follow-up commit therefore records the external failure and intentionally triggers a fresh exact-head CodeQL analysis through the normal pull-request push event. No product behavior, workflow configuration, test threshold, skip/retry rule or authority boundary changes in this retry step.

## Acceptance boundary

This record is **not** product-owner acceptance and is **not** merge evidence.

Required next sequence:

```text
canonical docs sync
→ fresh exact-head CI + Chromium/WebKit + CodeQL
→ Product Owner real-plan acceptance
→ acceptance truth sync
→ protected squash merge
→ post-merge main verification
```

Focused Product Owner real-plan checklist:

1. On a real calibrated plan, confirm `По подложке` is Off by default.
2. Enable it and trace near a clear strong wall line; explicit `По подложке` feedback should appear and the wall should follow that evidence.
3. Try a weak/ambiguous/noisy area; assistance must abstain rather than force geometry.
4. Trace near an existing endpoint/junction/wall axis; existing topology must win.
5. Hold Alt/Option; source assistance must be suppressed for the gesture.
6. Turn `По подложке` Off; ordinary wall editing must remain unchanged.
7. Commit one assisted wall; one Undo removes it and one Redo restores it.

Only an explicit Product Owner PASS may move PR #94 out of the acceptance-pending state.