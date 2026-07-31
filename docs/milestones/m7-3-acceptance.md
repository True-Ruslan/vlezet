# M7.3 — Design System and Content Components Acceptance

**Status:** DONE / ACCEPTED / MERGED  
**Accepted:** 2026-07-31  
**PR:** #26  
**Feature branch:** `feat/m7-3-design-system-implementation`  
**Merge:** `509dfc02e17c87a58da8356894564a8f27bc5a9b`

## Product goal

Create a governed, reusable presentation foundation without turning M7.3 into a product-wide rewrite or changing document, geometry, persistence, planning, recognition-detection, history or Canvas authority.

Accepted density model:

- ordinary interface text: 14 px;
- compact panel text: 13 px;
- meaningful helper/status text: at least 12 px;
- standard fields and primary actions: 40 px;
- compact secondary controls: 32–36 px where appropriate.

## Delivered

### Semantic style layers

```text
design-tokens.css
ui-primitives.css
legacy and feature styles
bounded migrations
```

The token layer governs semantic colors, typography, spacing, radii, shadows, control heights, focus treatment and motion durations while preserving compatible legacy aliases.

### Store-free UI primitives

Implemented under `apps/web/components/ui/`:

- `UiButton`;
- `UiField` and `UiFieldMessage`;
- `UiNotice`;
- `UiBadge`;
- `UiCard`;
- `UiEmptyState`;
- `UiDialog`.

These primitives contain no Zustand, repository, geometry, planner, recognition or persistence authority.

### Presentation formatting

Added presentation-only Russian formatting for:

- millimetres with non-breaking space and no visual thousands grouping;
- square metres with decimal comma;
- degrees with `°`.

Internal dimensions remain numeric millimetres.

### Representative migration

- room name and clear-dimension controls;
- furniture catalogue cards;
- canonical fit badges: `Влезает`, `Влезает, но тесно`, `Не влезает`;
- dashboard local-first notice, errors and empty state;
- project deletion and OpenRouter dialogs;
- recognition prerequisite/error/progress/candidate/confidence/action visuals;
- Canvas helper text raised to 12 px.

### Manual-acceptance defects fixed

1. Global `keydown` handling now ignores events without a string `key` instead of calling `toLowerCase()` unsafely.
2. OpenRouter requests use `response-healing` while retaining strict JSON Schema validation.
3. Repeated AI checks discard decisions for removed recognition candidates, preventing stale references such as `rl1`.

## Final evidence

```text
final accepted head: cabe8e44153d7a56ee23e6931ea204e2fbf82119
standard CI:         30654881419 — PASS
browser audit:       30654879141 — PASS
artifact:            8802854489
digest:              sha256:1f62c1695231d266a9e28e3a54b40402a85106e231c15ca6e53dc2d577b22b32
merge:               509dfc02e17c87a58da8356894564a8f27bc5a9b
```

Chromium full flow and WebKit core smoke preserved M7.1 shell, M7.2 context/scroll/workflow-return behaviour, compact state retention, fit states, dialogs, 3D transition and representative recognition flow.

## Product-owner acceptance

> «Подтверждаю все!»

The product owner confirmed the M7.3 presentation work and accepted recognition accuracy as a separately tracked future limitation.

## Deferred recognition-quality limitation

OpenRouter-assisted recognition now completes and returns a valid editable draft, but walls, openings, rooms and areas can still be reconstructed inaccurately.

This is not claimed as solved by M7.3.

Canonical future ownership:

- `docs/product/RECOGNITION_QUALITY_REQUIREMENTS.md`;
- issue #27 — `M7.8: improve recognition topology, openings, rooms and area accuracy`.

Recognition remains reviewable and non-authoritative until explicit Apply.

## Architecture preserved

No changes were made to:

- `VlezetDocument` or domain schema;
- migrations;
- IndexedDB or project/asset repositories;
- backup/import/export format;
- geometry, fit or snapping algorithms;
- planner generation/evaluation/Apply authority;
- semantic history;
- Canvas hit-testing or drawing authority;
- Three.js geometry authority.
