# M7.1 Editor Shell and Responsive Context — Acceptance

**Status:** ACCEPTED / MERGED  
**Date:** 2026-07-31  
**PR:** #21 `feat: M7.1 editor shell and responsive context`  
**Implementation head:** `6c21653b30e627a9bf160baf6f3f8d0a4d058f16`  
**Final verified head:** `8c68bd288cd3dda1133f09a469cd7afe6dab83d9`  
**Squash merge:** `6b6f8751b520722a54bb94a6947dae1135e07859`

## 1. Purpose

M7.1 establishes a stable editor shell before deeper inspector, Canvas and workflow redesign.

The milestone owns:

- `UX-SHELL-001` — competing/clipping command hierarchy;
- `UX-SHELL-002` — disappearing contextual controls;
- `UX-DATA-001` — unreadable local-save status;
- `UX-ACCESS-002` — zoom-driven loss of functionality.

It changes presentation and composition only. Geometry, persistence, document authority, planning authority, Canvas authority and 3D authority remain unchanged.

## 2. Delivered shell

- [x] separate global project bar and editing tool bar;
- [x] project name remains visible across required widths;
- [x] readable `Сохранено локально` state at 12 px;
- [x] Undo and Redo remain directly reachable;
- [x] secondary project commands live in labelled `Действия` disclosure;
- [x] active tool and 2D/3D mode remain explicit;
- [x] existing command callbacks, shortcuts and disabled semantics are preserved.

## 3. Responsive context model

- [x] catalogue and context remain docked on wide desktop layouts;
- [x] reduced effective widths use non-modal left/right sheets;
- [x] Canvas remains visible and usable behind compact sheets;
- [x] sheets have explicit close controls;
- [x] closing a context sheet does not clear selection;
- [x] uncommitted form input survives close/reopen;
- [x] catalogue sheet visibility is presentation-only and does not rewrite the stored wide-layout preference;
- [x] compact presentation state is not written to `VlezetDocument`, project viewport or IndexedDB;
- [x] 3D uses a dedicated one-column composition with no stale 2D sheets.

## 4. Required viewport and zoom matrix

Chromium browser acceptance covers:

- [x] 1920×1080;
- [x] 1440×900;
- [x] 1366×768;
- [x] 1280×800;
- [x] effective 125% viewport;
- [x] effective 150% viewport;
- [x] effective 200% viewport.

Across the matrix:

- [x] no document horizontal overflow;
- [x] no project-bar overflow;
- [x] project identity remains visible;
- [x] save state remains visible and readable;
- [x] `Действия`, Undo and Redo remain reachable;
- [x] context entry remains reachable where compact layout is active;
- [x] active selection tool and 2D state remain detectable.

## 5. Workflow regression

- [x] dashboard and new-project lifecycle;
- [x] room creation and room inspector;
- [x] furniture placement and object inspector;
- [x] object form draft close/reopen preservation;
- [x] catalogue sheet close/reopen;
- [x] deterministic planning panel;
- [x] reference-plan panel;
- [x] 2D→3D→2D transition;
- [x] destructive project deletion dialog;
- [x] WebKit dashboard/editor/form/3D/dialog core smoke.

## 6. Automated verification evidence

### Implementation exact-head standard CI

```text
head: 6c21653b30e627a9bf160baf6f3f8d0a4d058f16
run:  30576951202 — PASS
```

### Implementation exact-head Chromium + WebKit acceptance

```text
head:     6c21653b30e627a9bf160baf6f3f8d0a4d058f16
run:      30576950984 — PASS
artifact: 8773105974
digest:   sha256:f608ddd3e4638b38b04e7ac8d814b962cd82b34437de0a184ac884710b698d62
```

### Final record-only exact-head standard CI

```text
head: 8c68bd288cd3dda1133f09a469cd7afe6dab83d9
run:  30586557182 — PASS
```

### Final record-only exact-head Chromium + WebKit acceptance

```text
head:     8c68bd288cd3dda1133f09a469cd7afe6dab83d9
run:      30586557394 — PASS
artifact: 8776737145
digest:   sha256:e94a4d3737b8c4a9d562d848f51319b968a12be7952341cbc26cb2a526828855
```

Verified:

- [x] frozen dependency installation;
- [x] M7 documentation contract;
- [x] full unit suite;
- [x] TypeScript;
- [x] ESLint;
- [x] production Next.js build;
- [x] Chromium full representative flow;
- [x] WebKit core smoke;
- [x] blocking shell/overflow/reachability assertions;
- [x] screenshots and machine-readable audit report uploaded.

WebKit remains recorded as an engine-level proxy. The assistant cannot independently observe the product owner's local browser or browser version.

## 7. Product-owner acceptance

The product owner completed a manual review and reported:

> «Я все проверил. Выглядит уже лучше и понятнее.»

This is recorded as:

- [x] manual owner review completed;
- [x] visual hierarchy accepted;
- [x] clarity improvement accepted;
- [x] no blocking regression reported;
- [x] authorization to complete the previously agreed merge workflow remained in effect.

The exact local browser/version is not asserted beyond the owner's report.

## 8. Architecture and scope protection

- [x] no `VlezetDocument` schema or migration change;
- [x] no project-format or IndexedDB change;
- [x] no geometry or fit authority change;
- [x] no planner/evaluator/Apply authority change;
- [x] no Canvas hit-testing or rendering-authority rewrite;
- [x] no Three.js/spatial authority change;
- [x] no new AI/planning capability;
- [x] responsive state remains ephemeral presentation state;
- [x] changed-file scope inspected;
- [x] PR #21 was Ready for Review and mergeable;
- [x] squash merge used expected-head SHA protection.

## 9. Remaining follow-up, not M7.1 blockers

- 11 px Canvas help remains owned by M7.3/M7.4;
- complete domain-specific inspector anatomy remains M7.2+;
- native browser details are not inferred by automation;
- 3D interior readability remains M7.10.

## 10. Final merge gate

- [x] implementation exact-head CI PASS;
- [x] implementation exact-head Chromium/WebKit PASS;
- [x] product-owner manual acceptance recorded;
- [x] final record-only exact-head CI PASS;
- [x] final record-only exact-head browser audit PASS;
- [x] PR #21 mergeable at expected head;
- [x] squash-merged as `6b6f8751b520722a54bb94a6947dae1135e07859`;
- [x] M7.2 selected as the next dependency-aware slice.
