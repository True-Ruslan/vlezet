# 2026-08-08 — M8.1 Editor Interaction Foundation

**Status:** IN DEVELOPMENT  
**Tracker:** #54  
**Branch:** `feat/m8-1-editor-interaction-foundation`

## Why

M8.1 establishes one deterministic interaction substrate for selection, commands, navigation and safe multi-object editing before M8.2 expands topology-sensitive structural editing.

The accepted public-beta direction requires mature-canvas interaction quality without weakening apartment semantics: millimetres remain canonical, `VlezetDocument` remains the sole persistent truth, structural geometry remains topology-authoritative and arbitrary graphical group scaling remains forbidden.

## Scope

- unified semantic runtime selection;
- capability-aware fail-closed actions;
- atomic placed-object batch transforms;
- one writable selection truth in the editor store;
- rigid multi-furniture movement;
- semantic placed-object Copy/Cut/Paste/Duplicate;
- central command registry;
- wheel/trackpad/keyboard navigation and fit operations;
- semantic marquee selection;
- multi-selection/context UI;
- Chromium and representative WebKit acceptance.

Structural batch movement/clipboard is explicitly deferred to M8.2.

## Engineering policy

Every deterministic behaviour follows genuine RED → observed intended failure → minimal GREEN → adjacent/full regression. Existing validation, topology/opening authority, M2 fit authority and safety thresholds may not be weakened to obtain green CI.

## Baseline

M8.0 was product-owner approved and protected-squash-merged as `cf481ce3a2b882e5031ea18a576a4856b1043f3a` after up-to-date CI and Chromium/WebKit acceptance passed.

This branch was created fresh from that exact merge commit. The first branch change is documentation only so baseline `test`, `typecheck`, `lint` and `build` can be re-verified before Task 1 RED.

## TDD evidence

To be appended after each observed RED/GREEN checkpoint.

## Acceptance / merge

Not yet accepted. No completion or merge claim is made by this record.
