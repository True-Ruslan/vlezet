# 2026-08-08 — M7.8C automatic-recognition product retest

## Result

**Product acceptance: FAIL.**

The closed automatic-recognition experiment in PR #42 passed its deterministic automated gates but did not meet product usefulness requirements on the original real apartment plan.

Observed retest:

```text
walls:        28
openings:      2
confident:     4
needs review: 26
```

Observed product problems:

- structural geometry remained fragmented or inexact;
- visible windows were not recovered reliably;
- service/sanitary notation remained structurally ambiguous;
- thin real construction remained difficult to distinguish from symbols;
- AI verification did not materially recover missing geometry because the current authority boundary allows it to review existing local candidates, not repair missing local recall.

## Decision

PRs #42, #44 and #45 were closed unmerged and retained as R&D evidence.

No deterministic safety or benchmark result is reclassified as invalid; instead, the retest demonstrates that those gates measure safety/reproducibility rather than sufficient real-plan usefulness.

The selected product direction is **Assisted Tracing** from a fresh branch based on `main`:

- the user explicitly indicates the wall/opening being created;
- local source-image analysis may improve placement only when bounded evidence is unambiguous;
- ambiguous evidence falls back to ordinary manual editing;
- ordinary topology/opening validation and semantic Undo/Redo remain authoritative;
- no AI or network dependency is added to tracing;
- no unaccepted automatic-recognition heuristics are merged wholesale.

Automatic full-plan reconstruction is deferred to R&D. A future architecture should investigate semantic segmentation → topology reconstruction → vectorization → deterministic validation.