# 2026-07-31 — M7.1 Editor Shell and Responsive Context accepted and merged

PR #21 squash merge:

```text
6b6f8751b520722a54bb94a6947dae1135e07859
```

Final verified head and gates:

```text
head:       8c68bd288cd3dda1133f09a469cd7afe6dab83d9
standard:   30586557182 — PASS
browser:    30586557394 — PASS
artifact:   8776737145
digest:     sha256:e94a4d3737b8c4a9d562d848f51319b968a12be7952341cbc26cb2a526828855
```

## Why

M7.0 showed that the editor had accumulated useful capability faster than interface hierarchy. Project actions, tools, view toggles and history competed in one clipping row. The contextual inspector disappeared at reduced effective widths, browser zoom removed functionality, and local-save meaning was rendered as microtext.

M7.1 fixes the shell and reachability foundation before deeper inspector or workflow redesign.

## Delivered

- separate global project bar and editing tool bar;
- visible project identity and readable `Сохранено локально` state;
- directly reachable Undo/Redo;
- labelled `Действия` disclosure for secondary project commands;
- explicit active editing tool and 2D/3D mode;
- docked catalogue and context surfaces on wide layouts;
- non-modal left/right sheets on compact effective widths;
- explicit sheet close controls;
- preserved selection and uncommitted form state across close/reopen;
- catalogue sheet presentation decoupled from stored wide-layout preference;
- dedicated one-column 3D composition without stale 2D sheets;
- no horizontal document escape across required viewport/zoom scenarios.

## TDD and browser acceptance

Pure and source/layout contracts cover:

- context priority and labels;
- compact surface transitions;
- project/tool bar semantics;
- readable local-save copy;
- side-surface hidden/inert behaviour;
- non-persistence of responsive state;
- one-column spatial composition;
- responsive CSS and legacy-breakpoint overrides.

Chromium blocking acceptance covers:

- 1920×1080;
- 1440×900;
- 1366×768;
- 1280×800;
- effective 125%, 150% and 200% widths;
- room and object inspectors;
- context and catalogue sheets;
- uncommitted form-state preservation;
- planning, reference, 3D and project deletion.

WebKit independently covers dashboard, editor, room form, 3D and dialog. It remains an engine proxy rather than an inferred statement about the owner's local browser/version.

## Product-owner acceptance

> «Я все проверил. Выглядит уже лучше и понятнее.»

No blocking regression was reported.

## Architecture preserved

- no `VlezetDocument`, schema or migration change;
- no project-format or IndexedDB change;
- no geometry or fit authority change;
- no planner/evaluator/Apply authority change;
- no Canvas hit-testing or rendering-authority rewrite;
- no Three.js/spatial authority change;
- no new AI or planning capability;
- responsive shell state remains ephemeral presentation state.

## Roadmap consequence

M7.1 is closed as accepted and merged. **M7.2 Context Inspector Foundation** is the only selected `NOW` slice.

M7.2 will establish one predictable context/workflow panel anatomy with shared identity, back/close semantics, sections and action hierarchy while preserving the M7.1 responsive container and all domain authority boundaries.

Canonical evidence: `docs/milestones/m7-1-acceptance.md`.
