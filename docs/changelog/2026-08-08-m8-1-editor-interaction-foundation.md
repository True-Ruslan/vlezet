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

This branch was created fresh from that exact merge commit.

Baseline documentation-only head:

```text
head:     15e2989dcdbdc7e9b7fabac433238015abdaef8f
CI #4660: PASS
```

The baseline `verify` job passed the documentation contract, full unit suite, Core Recognition Benchmark, typecheck, lint and production build before the first M8.1 RED commit.

## TDD evidence

### Task 1 — unified semantic selection contract

The first M8.1 production contract is a pure runtime value model for `(kind,id)` entity refs, deterministic insertion order, primary selection, additive/toggle operations and history-safe sanitisation across walls, vertices, derived rooms, openings and placed objects.

RED:

```text
head:     fe9de7f9a604fec318b1335428fd8311cd4ec0fb
CI #4661: FAIL as intended at web unit tests
reason:   Cannot find module './editor-selection'
existing web tests: 395 PASS
```

The RED commit contained the nine behavioural invariants only; no production implementation existed.

GREEN:

```text
head:     c591a409819870b25b5b58b2d18abaff22d27e42
CI #4662: PASS
```

GREEN evidence includes:

- all new selection invariants PASS;
- full unit suite PASS;
- Core Recognition Benchmark PASS;
- typecheck PASS;
- lint PASS;
- production build PASS.

The implementation is intentionally pure: no Zustand, Konva, DOM, clipboard, command registry or persistence changes were introduced. Selection remains runtime-only and `VlezetDocument` remains the sole persistent document truth.

## Acceptance / merge

Not yet accepted. No completion or merge claim is made by this record.
