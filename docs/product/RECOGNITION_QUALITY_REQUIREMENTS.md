# Vlezet — Recognition Quality Requirements

**Status:** APPROVED BACKLOG CONTRACT  
**Approved:** 2026-07-31  
**Primary owner:** future M7.8 Reference and Recognition Workflow / recognition hardening  
**Current implementation status:** M4.5 remains DONE/MVP; structural reliability is usable, recognition accuracy requires measurable refinement.

## 1. Product problem

The recognition pipeline can now complete local and OpenRouter-assisted checks without transport, malformed-JSON or stale-candidate failures, but a technically valid result may still reconstruct the source plan incorrectly.

Manual evidence from 2026-07-31 showed a real apartment plan producing:

```text
walls:      16
openings:    7
confident:   3
review:     26
```

The generated orange geometry visibly did not follow the authoritative wall topology and did not reliably distinguish walls, doors, windows or room boundaries. This is a quality limitation, not an M7.3 design-system failure.

The target is not to maximise candidate count. The target is to produce the smallest geometrically coherent, explainable draft that approximates the source plan and exposes uncertainty where evidence is insufficient.

## 2. Required source understanding

Future recognition work must treat the source plan as a constrained semantic drawing rather than a generic collection of lines.

The pipeline must attempt to recover:

1. external and internal wall topology;
2. wall centre-lines or equivalent authoritative geometry;
3. intersections, corners and connected wall chains;
4. doors and windows attached to valid host walls;
5. door width and swing/orientation where visible;
6. closed room faces and the number of spatial zones;
7. room-name and area labels associated with the correct faces;
8. total stated apartment area where present;
9. scale evidence from dimensions, calibration and recognised areas;
10. confidence and provenance for every proposed element.

Text, furniture symbols, sanitary equipment, hatching, image borders and dimension guides must not be promoted to walls merely because they contain strong line segments.

## 3. Geometry invariants

A recognition result is not acceptable merely because it passes JSON validation. Before review, deterministic post-processing must enforce or diagnose these invariants.

### Walls

- no zero-length or near-zero-length walls;
- duplicate and near-collinear overlapping segments are merged or explicitly diagnosed;
- endpoints that represent one corner are snapped within a documented tolerance;
- long image-frame or crop-border artefacts are rejected;
- text baselines, dimension lines and furniture contours are rejected where evidence indicates they are not architectural walls;
- wall chains should form a coherent connected graph;
- exterior boundaries and internal partitions remain distinguishable where the source provides enough evidence;
- wall thickness evidence is retained separately from wall-axis geometry.

### Openings

- every door or window must reference a surviving host wall;
- the opening centre must project onto the host wall within tolerance;
- width must be plausible relative to the host wall and source scale;
- duplicate openings are merged or rejected;
- doors and windows must be classified separately when visual evidence permits;
- a door swing arc must not be interpreted as an additional wall;
- an uncertain opening remains reviewable rather than being silently converted into a wall or applied automatically.

### Rooms

- room candidates must be derived from closed or intentionally bounded wall faces;
- overlapping or impossible room faces are rejected or diagnosed;
- room count is evaluated against recognised labels and optional user-provided expectations;
- corridors, bathrooms, kitchens, balconies and living rooms remain separate spatial zones when bounded separately in the source;
- labels and areas must be associated with the containing or nearest plausible room face, not only by list order.

## 4. Area and room-count constraints

Recognition must use area information as evidence and validation, not as unquestioned geometry authority.

The system should support three evidence sources:

1. text recognised directly from the plan;
2. optional user-provided expected total area, room count and known room areas;
3. areas computed from calibrated recognised geometry.

The review UI must compare them explicitly, for example:

```text
Stated total area:       34.4 m²
Recognised geometry:     33.8 m²
Difference:              −0.6 m² / −1.7%

Expected spatial zones:  5
Recognised zones:        5
```

A mismatch must never be hidden. It should lower confidence and identify the affected rooms or boundaries.

### Initial acceptance targets

These targets are provisional until a versioned benchmark corpus exists. They define the intended release threshold for a future recognition-quality milestone.

| Metric | Initial target |
|---|---:|
| Exact spatial-zone count | at least 90% of benchmark plans |
| Total-area absolute percentage error | median ≤ 5% |
| Per-room area absolute percentage error | median ≤ 10% and ≤ 0.5 m² where practical |
| Wall topology F1 | ≥ 0.90 |
| Door/window detection F1 | ≥ 0.85 |
| Incorrect high-confidence candidates | ≤ 2% |
| Unknown-host openings after post-processing | 0 |
| Stale decisions referencing removed candidates | 0 |

A high-confidence result must satisfy stricter thresholds than a merely reviewable result.

## 5. Recommended pipeline

The future implementation should remain hybrid and authority-safe.

```text
source image
→ crop / perspective / contrast normalisation
→ calibration and scale evidence
→ local line / contour / symbol candidates
→ AI semantic candidates and text/area extraction
→ deterministic snapping, merging and topology construction
→ room-face derivation
→ area, room-count and label constraint evaluation
→ confidence calibration
→ editable Draft review
→ explicit Apply
```

AI may propose candidates and semantic classifications, but it must not become the sole authority for geometry, room area or Apply.

## 6. Candidate identity and reconciliation

Candidate IDs are ephemeral within one recognition result and must not be treated as stable semantic identities across repeated AI checks.

Reconciliation must:

- preserve a user decision only when the corresponding final candidate still exists or is deterministically matched to an equivalent candidate;
- discard decisions for removed candidates;
- assign `pending` to newly introduced candidates;
- retain provenance for local, cloud and merged candidates;
- explain merges, replacements and rejections in diagnostics;
- never apply a decision to another candidate merely because IDs are similar.

## 7. Review experience requirements

The recognition review must prioritise structural understanding over a long flat candidate list.

Required future presentation:

- summary by walls, doors, windows, rooms and unresolved conflicts;
- total-area and per-room area comparison;
- recognised room count and expected room count;
- candidate grouping by room or wall chain where possible;
- direct highlight between a candidate card and its geometry;
- reasons for confidence, conflict or rejection;
- bulk acceptance only for candidates that satisfy deterministic invariants;
- clear distinction between `Черновик`, `Проверено`, `Принято` and `Применено`;
- no automatic mutation of the apartment before explicit Apply.

## 8. Benchmark and regression corpus

Before algorithm implementation begins, create a versioned, anonymised benchmark corpus containing varied plan styles:

- clean developer floor plans;
- low-resolution screenshots;
- scans and photographs with perspective distortion;
- plans with dimensions and area labels;
- plans with furniture and sanitary symbols;
- monochrome and coloured plans;
- one-room, multi-room and irregular apartments;
- balconies/loggias and complex openings.

Each fixture must include ground truth for:

- wall graph;
- door/window type and host wall;
- room polygons;
- room names where known;
- room areas and total area where stated;
- expected candidate confidence or review requirement.

The plan observed during manual M7.3 acceptance must become an anonymised regression fixture before M7.8 recognition-quality implementation is declared complete.

## 9. Delivery decomposition

Recognition quality should be implemented as independent, measurable slices rather than one opaque AI rewrite.

Recommended order:

1. benchmark corpus and scoring harness;
2. source normalisation and architectural-line filtering;
3. wall snapping, merging and topology graph;
4. door/window symbol and host-wall classification;
5. room-face derivation;
6. OCR/label association and area constraints;
7. hybrid local/cloud reconciliation and confidence calibration;
8. room-oriented review UX;
9. Chromium/WebKit workflow acceptance plus benchmark report.

## 10. Non-goals

This contract does not require immediate implementation during M7.3.

It does not authorise:

- automatic Apply without review;
- replacing deterministic geometry with raw model output;
- cloud-only project persistence;
- storing API keys;
- claiming exact reconstruction for unreadable source plans;
- silently inventing missing dimensions, rooms or openings;
- weakening validation merely to accept more model responses.

## 11. Completion rule

A future recognition-quality milestone is complete only when:

- the benchmark corpus and scoring tool are committed;
- thresholds are measured on exact-head CI;
- the observed manual plan no longer produces visibly incoherent topology;
- room count and area mismatches are shown and explained;
- all candidates remain editable and non-authoritative until Apply;
- product-owner browser acceptance confirms that the reconstructed plan is materially close to the source, not merely syntactically valid.
