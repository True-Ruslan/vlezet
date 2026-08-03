# M7.8C Thick Walls, Windows and Clutter — Design

Date: 2026-08-03
Branch: `feat/m7-8c-opening-classification-host-wall-validation`
PR: #42

## Context

The latest product-owner retest on the same real apartment plan confirmed that orientation and principal-wall recovery improved, but three deterministic defects remain:

1. one thick load-bearing wall is represented by two parallel wall candidates;
2. visible windows in exterior walls are not emitted as opening candidates;
3. furniture/sanitary contours remain visible as rejected wall candidates and overload review.

Gemini 2.5 Flash was used for verification. It preserved candidate geometry but reduced confident candidates from 12 to 2 and did not recover missing windows. This is expected under the current safety contract: AI cannot create or move geometry and therefore cannot repair a defective local Draft.

## Goals

- merge duplicate parallel axes that describe one physically filled thick wall;
- never merge two real walls separated by a light room/corridor gap;
- derive window hypotheses from a structural-mask gap supported by at least two parallel window rails;
- require a known host wall and bounded placement for every new window;
- reject short furniture/sanitary wall candidates before they become normal review candidates;
- preserve diagnostics for every rejected or consolidated candidate;
- keep AI verification geometry-immutable;
- keep project schemas, migrations, IndexedDB, history and Apply authority unchanged.

## Thick-wall sibling consolidation

A new pure recognition module runs after region/Hough fusion and before window-host consolidation.

Two candidates may be siblings only when:

- both are axis-aligned with angle delta at most 8°;
- projected overlap is at least 72% of the shorter candidate;
- their physical bands overlap or are separated by at most 8 px;
- the combined outer band is no wider than 420 px and no wider than 3.2 times the larger source thickness;
- at least 72% of bounded samples between the outer band edges are structural pixels;
- candidate/comparison budgets are not exceeded.

Eligible siblings are merged into one deterministic candidate:

- axis: centre of the combined outer band;
- length: union of the projected intervals;
- thickness: combined outer-band width;
- confidence: at most medium;
- evidence: `thick-wall-sibling-consolidation` plus source reasons;
- ID: deterministic from canonical geometry and sorted source IDs.

The source candidates are replaced, not merely marked duplicate, because opening analysis must see one host wall.

## Mask-supported window recovery

A new pure module examines each accepted axis-aligned wall against the structural mask.

For each wall:

1. sample structural occupancy across the estimated wall band along its tangent;
2. find bounded low-occupancy intervals between supported structural spans;
3. require interval width between 28 and 240 px and at least 18 px wall support on both sides;
4. require at least two parallel thin symbol rails with similar projected extent inside the gap;
5. reject intervals with a door-leaf-like perpendicular segment;
6. create a medium-confidence `window` candidate with the existing wall ID as host.

Mask-derived hypotheses are deduplicated against existing gap/rail hypotheses before host validation. AI may confirm or reject their IDs but cannot create additional openings.

## Structural clutter veto

A new pure wall-support filter runs after thick-wall consolidation and before openings.

A candidate is blocked as `unsupported` when all of the following hold:

- its length is below 22% of the image short side;
- structural support within its wall band is below 62%;
- it has no two-endpoint attachment to the non-blocked wall network;
- nearby thin-symbol density is high, or it participates in a small enclosure already identified by topology sanitation.

Long boundary walls, long partitions, and candidates with two independent architectural anchors are never blocked by this rule.

Blocked candidates remain in the Draft with low confidence and explicit `structural-clutter-veto` evidence, preserving reviewability and diagnostics. They are excluded from opening-host analysis, bulk acceptance and Apply.

## AI model policy

Gemini 2.5 Flash remains selectable but is recorded as an unqualified model for this real-plan verification profile. Model quality will be benchmarked only after deterministic corrections land.

The future model benchmark will compare repeated verification runs on immutable candidate IDs. It will not allow model-specific geometry creation or model-specific safety exceptions.

## Failure handling

- mask/candidate budget overflow fails closed and preserves pre-stage candidates;
- invalid mask dimensions skip the stage with a warning diagnostic;
- ambiguous thick-wall pairs remain separate and reviewable;
- ambiguous openings remain absent rather than guessed;
- no automatic migration modifies existing user documents;
- no empty Apply command is created.

## Tests and acceptance

Required RED → GREEN regressions:

- two parallel axes inside one filled band merge into one thick wall;
- identical geometry separated by a white corridor does not merge;
- three sibling axes merge deterministically;
- overload preserves original candidates unchanged;
- a mask gap with two window rails emits one host-bound window;
- a similar gap with one rail emits no window;
- a door-leaf-supported gap is not classified as a window;
- duplicate existing window hypotheses collapse deterministically;
- a short low-support one-anchor sanitary contour becomes `unsupported`;
- a long partition and two-anchor short wall remain reviewable;
- source input ordering is deterministic.

Global gates:

- full unit suite;
- typecheck, lint and build;
- Core Recognition Benchmark;
- Chromium/OpenCV Source Benchmark;
- Chromium audit and WebKit smoke;
- opening F1 at least 0.85 for Core and Source;
- unknown-host openings, stale decisions and incorrect high-confidence predictions remain zero;
- no previously passing fixture may regress.

The PR remains Draft and `DO NOT MERGE` until the product owner repeats local and AI recognition on the same real source plan.
