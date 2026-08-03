# M7.8C Real-Plan Recovery and Incremental Apply — Design

Date: 2026-08-03
Branch: `feat/m7-8c-opening-classification-host-wall-validation`
PR: #42

## Context

The latest product-owner retest exposed two independent defects on the same real apartment plan:

1. after one recognition Apply, accepting additional candidates leaves the Apply action disabled with `Уже применено`;
2. region-first local recognition finds a reviewable set, but misses or fragments principal walls that are interrupted by openings, windows, labels, or complex junctions.

Door-swing orientation is explicitly not part of this stabilization slice.

## Goals

- allow safe additive Apply after recognition decisions change;
- preserve one-step Undo/Redo for every Apply batch;
- prevent duplicate walls and duplicate openings during repeated Apply;
- keep filled structural regions as the primary local wall authority;
- add a bounded Hough supplement when region-first evidence is incomplete;
- admit supplemental walls only when they are anchored to the primary wall network;
- keep AI verification geometry-immutable and unable to raise topology-warning candidates to high confidence;
- preserve existing benchmark and safety gates.

## Non-goals

- removing geometry from the apartment when a previously applied candidate is later rejected;
- replacing already-applied geometry in place;
- automatic door-swing reconstruction;
- room-face derivation, OCR, labels, or stated-area reconciliation;
- perspective rectification.

## Application-state design

`RecognitionDraft.status = applied` describes the last completed Apply batch, not a permanent lock.

Any post-Apply mutation of candidate decisions or candidate geometry returns the Draft to its source review status:

- `local-complete` for local-only Drafts;
- `reconciled` for AI-verified Drafts.

A repeated Apply evaluates the current document and current accepted candidates:

- matching walls are mapped to their existing wall IDs and are not inserted again;
- matching openings are detected by host wall, centre and width and are not inserted again;
- conflicting overlapping openings are rejected with a diagnostic;
- only genuinely new safe geometry produces a new `recognition/apply` history entry.

Each successful Apply remains one semantic editor command and can be undone/redone independently.

## Hybrid wall-evidence design

The current engine stops wall Hough processing whenever at least three structural regions exist. The new pipeline keeps region-first authority but no longer treats it as the only evidence source.

1. Build primary candidates from filled structural regions exactly as today.
2. Run a bounded strict Hough pass on the opened structural mask even when primary regions exist.
3. Analyze Hough segments into supplemental wall candidates.
4. Pass primary and supplemental candidates through a pure deterministic fusion gate.
5. Accept a supplemental candidate only when all safety conditions hold:
   - it is axis-aligned within the existing tolerance;
   - it is not a physical duplicate of a primary candidate;
   - it has a bounded length and candidate budget;
   - both endpoints are anchored to the primary wall network, or it is a bounded collinear extension between primary fragments;
   - it has no pre-existing conflict.
6. Accepted supplemental candidates are capped at medium confidence and receive explicit `supplemental-hough-topology-anchor` evidence.
7. Isolated text, furniture and sanitary-symbol lines remain rejected because they are not anchored to the structural network.
8. The existing topology sanitizer remains the final authority before opening analysis and again before Apply.

## Failure handling

- candidate or comparison budget overflow fails closed and keeps the primary region result unchanged;
- ambiguous supplemental candidates remain absent rather than guessed;
- repeated Apply that contains no new geometry does not create an empty history entry;
- persisted older Drafts remain readable; no project or recognition-session schema migration is required.

## Test strategy

### Application regressions

- changing a decision after Apply returns local Drafts to `local-complete`;
- changing a decision after Apply returns AI Drafts to `reconciled`;
- repeated Apply does not duplicate previously applied walls;
- repeated Apply does not duplicate previously applied doors/windows;
- a newly accepted wall is added in a second independent Apply batch;
- Undo/Redo still synchronizes the Draft after each batch.

### Wall-evidence regressions

- a supplemental wall connecting two primary walls is accepted;
- an isolated numeral-like segment is rejected;
- a one-anchor short furniture segment is rejected;
- a collinear bounded missing fragment is accepted;
- physical duplicates are rejected;
- input ordering is deterministic;
- overflow preserves the primary result unchanged.

### Gates

- full unit suite;
- Core Recognition Benchmark;
- Chromium/OpenCV Source Benchmark;
- M7.8C opening F1 >= 0.85 for Core and Source;
- unknown-host openings = 0;
- stale decisions = 0;
- incorrect high-confidence = 0;
- typecheck, lint, build, Chromium audit and WebKit smoke.
