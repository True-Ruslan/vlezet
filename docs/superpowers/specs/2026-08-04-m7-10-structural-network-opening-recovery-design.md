# M7.10 Structural Network and Opening Recovery — Design

Date: 2026-08-04
Branch: `feat/m7-9-real-fixture-ai-benchmark`
PR: #43 (Draft, temporary base `main`, do not merge)

## Context

M7.9 replaced screenshot-driven iteration with a public, provenance-safe corpus of twelve deterministic analogues anchored to the twelve private source hashes. The exact browser/OpenCV baseline now reports:

- real wall geometry F1: `0.721569`;
- real opening F1: `0.422222`;
- incorrect active high-confidence rate: `0.073529`;
- unknown-host openings: `0`;
- stale decisions: `0`.

The existing nine-fixture Core and Source gates remain green:

- Core opening F1: `0.896552`;
- Source opening F1: `0.872727`;
- unknown-host, stale and incorrect-high-confidence safety regressions: `0`.

The real corpus isolates three root causes:

1. thin walls and balcony/loggia boundaries survive the raw grayscale Hough pass but are removed before they can enter the structural topology;
2. many missing doors/windows are secondary failures caused by a missing or fragmented host wall;
3. the diagonal orthogonal plan is not represented by the current horizontal/vertical structural-region model.

In region mode the engine commonly produces 15–25 supplemental line candidates but accepts zero because the current fusion requires both endpoints to anchor directly to primary walls, or requires a bounded collinear gap between two primary fragments. Supplemental candidates cannot form a bounded structural component together.

## Goals

- recover thin architectural walls from the pre-morphology ink mask without treating text, windows, furniture or sanitary symbols as walls;
- admit a bounded connected supplemental component when it is strongly supported by ink and anchored to the authoritative primary network or image boundary;
- allow one expected wall to remain represented by deterministic collinear fragments while preserving semantic topology;
- restore host walls before door/window classification;
- support a dominant rotated orthogonal frame without rotating or mutating the persisted reference plan;
- preserve all M7.8C safety gates and explicit Apply authority;
- never weaken the M7.9 target thresholds to make CI green.

## Non-goals

- OCR, room-name extraction or area reconciliation;
- curved/non-orthogonal architectural walls;
- AI-created geometry;
- automatic acceptance or application of recovered candidates;
- changing project, IndexedDB, backup or document schemas;
- changing the reference-plan rotation stored by the user.

## Stage A — Thin-ink structural component recovery

The existing thin-symbol Hough segments are reused; no third network request or raster upload is introduced. A new pure recognition module consumes:

- authoritative primary wall candidates;
- raw grayscale Hough segments;
- a read-only binary ink mask created before thick-wall morphology;
- image dimensions and bounded options.

### Dominant orthogonal frame

Long Hough segments vote by length for an angle modulo 90 degrees. A deterministic two-degree histogram selects the dominant frame. Near-axis results are normalized to `0°`; otherwise the frame is retained for diagonal-plan analysis.

Only segments within the frame-angle tolerance or its perpendicular family may become structural candidates.

### Ink-band measurement

Each candidate segment is sampled along its tangent. For each sample, a bounded perpendicular scan locates the contiguous ink interval nearest the Hough axis. Median interval centre and width provide:

- corrected centreline offset;
- estimated thickness;
- supported-sample ratio;
- median and dispersion diagnostics.

This prevents a Hough edge from becoming a second wall axis and distinguishes filled wall bands from white space between paired window rails.

### Canonicalization

Measured lines are:

- snapped to the dominant orthogonal frame;
- deduplicated by physical centreline and interval overlap;
- merged only when collinear gaps are bounded;
- capped at medium confidence;
- assigned deterministic IDs independent of input ordering.

### Component graph

Candidate endpoints and intersections form a bounded graph. Component admission is evidence based:

- at least one independent primary-network anchor plus sufficient total length/span; or
- a long single wall with one primary anchor and one image-boundary anchor; or
- for a rotated frame only, a large orthogonal component with multiple lines, two-dimensional span and multiple image-boundary anchors.

Supplemental-to-supplemental connectivity may support one component, but cannot cross component boundaries or create unbounded chains. Every accepted component is evaluated from the original candidate set; already accepted output is not reused as new evidence.

### Clutter vetoes

A component is rejected when any mandatory safety condition fails. Additional deterministic vetoes include:

- paired close parallel rails with low ink fill between them (window/door symbol evidence);
- small closed enclosures;
- short unanchored underlines/text strokes;
- low supported-sample ratio;
- excessive candidate/component/comparison budget;
- thickness outside architectural raster bounds.

Rejected candidates remain available only as diagnostics and never become host walls.

## Stage B — Host-aware door and window recovery

Opening analysis runs only after Stage A, thick-wall consolidation, clutter veto and topology sanitation.

The existing mask-supported window and wall-gap logic is retained. It is extended to tolerate a host represented by a deterministic collinear chain:

- an opening may reference one active fragment;
- validation projects the opening onto the canonical host chain;
- chain fragments must share orientation, thickness class and bounded gaps;
- no opening may reference a rejected or unknown wall;
- door-leaf and paired-window-rail evidence remain mutually exclusive;
- unknown or ambiguous openings remain low confidence and are not bulk accepted.

The expected effect is that many currently missing openings are recovered automatically once their structural host exists. Any remaining opening misses are addressed only after a new exact-head corpus run.

## Stage C — Rotated orthogonal frame

For a non-zero dominant frame, wall analysis occurs in an internal local coordinate frame:

- points are projected onto the dominant tangent/normal basis;
- topology and component rules operate in that frame;
- output points are inverse-projected to original raster coordinates;
- persisted reference-plan rotation remains unchanged;
- normalized output geometry stays in the original image coordinate system.

The rotated-frame path is fail-closed. It requires:

- a minimum dominant-angle vote share;
- at least four substantial lines;
- two-dimensional component span;
- multiple boundary/network anchors;
- deterministic agreement under segment order permutations.

## Confidence policy

- primary filled-region evidence keeps its existing calibrated confidence;
- recovered thin/component walls are at most medium;
- opening candidates are at most medium until exact local+AI agreement;
- AI verification cannot raise topology-warning or unsupported candidates to high;
- a model result never modifies geometry, thickness, host, centre, width or orientation.

## Budgets and failure handling

Default hard limits:

- raw thin segments: `512`;
- canonical structural candidates: `96`;
- component candidates: `48`;
- pair comparisons: `4096`;
- component size: `24` edges;
- accepted recovered walls: `32`;
- perpendicular mask samples: bounded per line and per cross-section.

Invalid dimensions, missing masks, budget overflow or insufficient orientation consensus return the unchanged primary result plus a warning diagnostic.

## Tests

### Pure RED → GREEN contracts

- long thin balcony wall from primary network to boundary is accepted;
- two/three white-space window rails are rejected as wall geometry;
- short sink/sanitary rectangle attached at one corner is rejected;
- two connected thin partition fragments with one primary anchor are accepted as one bounded component;
- unanchored text underline is rejected;
- filled thick-band edge duplicates collapse to one centreline;
- input order is deterministic;
- budget overflow preserves the primary result unchanged;
- rotated orthogonal rectangle and partitions are recovered in original coordinates;
- arbitrary non-orthogonal clutter does not create a rotated frame.

### Opening contracts

- newly recovered host enables a window with paired rails;
- newly recovered host enables a door with anchored leaf/arc evidence;
- one host chain accepts one opening without duplicate host IDs;
- unsupported fragments cannot become opening hosts;
- wrong-kind and unknown-host candidates remain rejected.

### Required gates

- full unit suite, typecheck, lint and build;
- existing Core and Source benchmarks unchanged and green;
- twelve-fixture browser/OpenCV benchmark;
- real wall geometry F1 target `>= 0.85`;
- real opening F1 target `>= 0.85`;
- incorrect active high-confidence rate `0`;
- unknown-host openings `0`;
- stale decisions `0`;
- all named must-detect and must-not-detect expectations pass;
- Chromium audit and WebKit smoke pass.

## Delivery and acceptance

M7.10 remains on Draft PR #43. The PR is not retargeted or marked ready until:

1. exact-head deterministic gates pass;
2. the manual OpenRouter benchmark completes with normalized evidence and no secret leakage;
3. model results remain informational and `qualified: false`;
4. the same user source plan is retested locally after the deterministic corpus is green;
5. the product owner explicitly accepts the result.
