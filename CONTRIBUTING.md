# Contributing to Vlezet

Vlezet is a precision apartment editor. Changes are welcome when they preserve the project's physical semantics, deterministic authority and local-first behavior.

## Start with project context

Read, in order:

1. `docs/PROJECT_STATE.md`;
2. `docs/ROADMAP.md`;
3. `docs/CHANGELOG.md`;
4. the active design/spec and implementation plan for the slice you are changing.

Do not infer accepted product state from an old feature branch or a green experimental PR.

## Development setup

Requirements:

- Node.js `>=22.13.0`;
- pnpm `11.15.1`.

```bash
corepack enable
corepack prepare pnpm@11.15.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

## Branches

Use short-lived branches from the current accepted base:

```text
feat/<slice-or-feature>
fix/<problem>
chore/<maintenance>
docs/<documentation-change>
test/<verification-only-change>
```

Do not create temporary remote branches when a local branch or a Draft PR already provides the needed isolation. Delete merged/superseded remote branches after their history is preserved by the PR/merge record.

## Architecture boundaries

The following are not implementation preferences; they are product invariants:

- `VlezetDocument` is the only persistent apartment/layout source of truth;
- millimetres are canonical;
- Canvas/WebGL coordinates are never persistent geometry authority;
- rooms, areas, dimensions and 3D projections remain derived;
- `packages/domain`, `packages/geometry` and `packages/editor-core` keep domain authority independent of React/Konva/Three.js;
- semantic Undo/Redo wraps committed edits;
- M2 remains fit/collision/door/clearance authority unless an explicitly accepted milestone changes that contract;
- AI/CV is optional assistance and cannot create authoritative coordinates or bypass validation;
- ambiguous destructive/structural behavior fails closed;
- core manual editing must work without network access.

## TDD and verification

For changed deterministic behavior, use real RED → GREEN:

1. write or identify a focused behavioral contract that fails for the intended reason;
2. run it and record the real failure;
3. implement the smallest correct change;
4. rerun the focused test to GREEN;
5. run neighboring and full regressions;
6. refactor only while the suite remains green.

Do not weaken a validator, baseline, threshold or assertion merely to obtain a green pipeline.

Baseline quality gate:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Use additional browser/benchmark gates required by the active milestone.

## Pull requests

Keep one PR focused on one coherent delivery slice. Use Draft while evidence or acceptance is incomplete.

A PR should explain:

- why the change is required;
- user-visible behavior;
- architecture/authority boundaries;
- tests and meaningful RED/GREEN evidence;
- regressions fixed;
- intentional non-goals;
- exact-head CI/browser evidence when relevant;
- required manual/product-owner acceptance that is still pending.

Green CI alone does not imply product acceptance.

## Documentation discipline

Do not update canonical completion state optimistically.

`docs/PROJECT_STATE.md`, `docs/ROADMAP.md` and canonical `docs/CHANGELOG.md` must describe what is actually accepted/merged. Detailed milestone or in-development history belongs in focused changelog/acceptance records.

## Security and private data

Read `SECURITY.md` before touching provider integrations, project import/export, persistence, workflows or recognition evidence.

Never commit:

- API keys/tokens;
- `.env` files;
- private apartment-plan rasters;
- unsanitized provider responses;
- sensitive logs or evidence artifacts.

## Commit quality

Prefer small, reviewable commits whose message states the outcome, for example:

```text
feat: define unified editor selection contract
fix: preserve opening host during wall edit
chore: harden repository workflows
```

Avoid commits whose only purpose is to retrigger CI or preserve temporary debugging markers.