# M7.2 — Context Inspector Foundation Acceptance

**Status:** ACCEPTED / VERIFIED; pending squash-merge.  
**Branch:** `feat/m7-2-context-inspector-foundation`  
**PR:** #23

## Product goal

Make the right-side context surface predictable across ordinary selection and bounded workflows without changing project, geometry, persistence, planner, recognition or history authority.

Owned findings:

- `UX-SHELL-003` — advanced workflows replaced selection context without one navigation model;
- `UX-PATTERN-001` — panel headers, sections and destructive actions used inconsistent patterns;
- foundational part of `UX-CONTENT-001` — context identity and action language needed one governed structure.

## Delivered contract

### Shared context anatomy

Every migrated context uses one semantic structure:

```text
optional back action
entity/workflow category
user-facing title
short summary or workflow phase
viewport-constrained scrolled content sections
ordinary action area
separated danger zone where applicable
```

Implemented for:

- empty selection;
- wall;
- room;
- door/window;
- furniture object;
- reference-plan workflow;
- recognition workflow;
- planning workflow.

Raw entity IDs are no longer the dominant panel identity.

The context frame is explicitly constrained to the available side-surface height. Its header remains stable while `.context-panel-body` owns vertical scrolling, so long room and workflow panels cannot be clipped below the viewport.

### Workflow navigation

- entering the first bounded workflow captures the current ordinary context;
- workflow-to-workflow transitions preserve that original ordinary target;
- back actions use explicit labels such as `К комнате «Гостиная»` and `К предмету «Диван»`;
- return validates the entity against the current document before restoring selection;
- deleted or stale targets fail closed to `Ничего не выбрано`;
- compact sheet close only hides presentation and preserves workflow, selection and uncommitted local form state;
- no return-target state is persisted in `VlezetDocument`, IndexedDB or project UI snapshots.

### Destructive hierarchy

- object and opening deletion remain immediate semantic commands and explicitly state that they can be restored through `Отменить`;
- reference removal remains inline-confirmed;
- reference removal copy explicitly says that walls, openings and furniture remain;
- recognition draft deletion is visually separated from Apply;
- project-delete modal semantics remain unchanged.

### Honest product copy

- internal `M6.4` roadmap identity was removed from ordinary planning UI;
- immediate reference display/transform edits are described as locally saved with the project, not falsely promised as editor-history Undo operations.

## TDD evidence

| Slice | RED evidence | GREEN evidence |
|---|---|---|
| Pure context descriptors and stale validation | head `253a1452d018674643a61d6ed419bebc30a0a6b5`, CI `30589773295` failed only on missing module | head `67d032bf331783c4871b2139a160bf51c3988c9c`, CI `30589879136` PASS |
| Shared semantic frame | head `32611f05ecffa9ce42f1b287efff91f4f063b031`, CI `30590012393` failed only on missing frame | head `dba68fd0dcbacd544eec70c956d0936563fe0f19`, CI `30590160008` PASS |
| Entity inspector anatomy | head `acd243da0612540c6c0ac25c2024c2ae6e7ec71f`, source contracts failed against legacy panels | head `7900879e97b6292bff9e6ae9a5b3fcdbd92ffc6d`, CI `30590462649` PASS |
| Pure workflow return selection | head `23a724b4fbd5dcacc25737bc185ec739dd2e7018`, CI `30590623595` failed only on missing module | head `3bf740a6b66a7e2881b8210a26f0df4406701cd9`, CI `30590726616` PASS |
| ApartmentEditor return integration | head `7dbbbc8a6b052611e3cd855bd68fc36dd4b916b3`, navigation assertions RED | head `911ead092d3714d669b031c457cdc485d8128889`, CI `30591087163` PASS |
| Workflow frames and navigation | head `ae6a32f3c9d223fa7b08306824609b218ea5de39`, workflow source contracts RED | head `e230b3b7fe3175bca5fc96cbc44abd99bd4b77b8`, CI `30591902093` PASS |
| Honest content contract | head `a60634fac49132a1577641bfa5493af072469eac`, Unit tests RED on roadmap badge and false Undo copy | implementation head `2cb085a5f637020bdba7dafe38bc258cc4ebdca7`, CI/browser PASS |
| Context-panel vertical scrolling | head `90b43f197dad3cc168ef50a2a43f8e4717b9b3cd`, Unit tests RED because the M7.2 frame was not height-constrained | head `376f38cafc0a46b67a04d7be54527a83d0220375`, static CSS contract plus Chromium/WebKit real-scroll regression PASS |

Browser harness hardening retained product validation and corrected only automation realism:

- opening placement uses `pointermove → click` so host-wall preview exists;
- recognition scenario satisfies the real calibrated-reference prerequisite;
- reference fixture is a representative `640 × 480` image rather than bypassing minimum-size validation;
- WebKit furniture placement uses the same real hover-preview gesture;
- the context-scroll regression creates and selects a room at the proven desktop geometry, then reduces viewport height and performs a real scroll to `Варианты расстановки`.

## Product-owner acceptance

On 2026-07-31 the product owner manually tested the M7.2 branch and confirmed:

- the renewed context interface is clearer and works correctly;
- the right panel now scrolls reliably to actions below the viewport;
- `Варианты расстановки` is reachable and opens correctly after scrolling;
- the previously reported blocking regression is resolved;
- the result is accepted with the explicit statement: `Теперь все работает супер четко.`

This is product-owner browser acceptance. The exact browser and operating-system combination are not inferred beyond the owner's confirmed manual run.

## Final exact-head verification

Acceptance-record head verified before this final record-only commit:

```text
b2fed8b3829ae4db36b2f0ac15806e6bb547b92e
```

Standard CI:

```text
GitHub Actions 30624589575 — PASS
```

Passed:

- frozen install;
- M7 documentation contract;
- full unit suite;
- TypeScript;
- ESLint;
- production Next build.

Chromium/WebKit acceptance:

```text
GitHub Actions 30624589562 — PASS
artifact: 8790847195
digest: sha256:4740c2d9cfaf8d2fdfe45e28da60bb2f32bc92698ca0972420c05011e63f020e
```

Chromium full-flow verified:

1. shell and empty context at required effective widths;
2. room, opening and object identities;
3. Undo copy and one-step restoration after opening/object deletion;
4. room → planning → room return;
5. object → reference → recognition → original object return;
6. compact hide/reopen preserves an uncommitted object-name draft;
7. compact hide does not exit the active workflow;
8. stale deleted target returns to empty context;
9. real image upload, calibration and installed-reference danger confirmation;
10. 3D removes 2D side surfaces;
11. no document horizontal overflow;
12. a long room context has `scrollHeight > clientHeight`, scrolls vertically and exposes a working `Варианты расстановки` action.

WebKit core smoke independently verified:

- dashboard and editor startup;
- room identity and rename;
- planning return to room;
- object identity;
- compact hide/reopen with preserved draft;
- reference return to object;
- clean 3D composition;
- project-delete dialog regression;
- long room-context vertical scrolling and planning-action reachability.

WebKit is recorded as an engine-level proxy, not as a manual native-Safari claim.

## Architecture preservation

Branch comparison with `main` confirms no changes in:

- `VlezetDocument` or domain schema;
- migrations;
- IndexedDB or project/asset repositories;
- backup/import/export format;
- geometry or fit algorithms;
- planner generation/evaluation/Apply authority;
- recognition algorithms or draft persistence;
- semantic history implementation;
- Canvas or Three.js geometry authority.

Presentation state remains ephemeral React state.

## Merge rule

The final record-only head must pass standard CI and Chromium/WebKit once more. After PASS, PR #23 may be marked ready and squash-merged with expected-head SHA protection. Canonical state, roadmaps and changelog must then be updated from the merge commit.
