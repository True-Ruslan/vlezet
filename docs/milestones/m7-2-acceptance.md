# M7.2 — Context Inspector Foundation Acceptance

**Status:** RC complete; automated acceptance PASS; product-owner browser acceptance pending before merge.  
**Branch:** `feat/m7-2-context-inspector-foundation`  
**Draft PR:** #23

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
scrolled content sections
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

Browser harness hardening retained product validation and corrected only automation realism:

- opening placement uses `pointermove → click` so host-wall preview exists;
- recognition scenario satisfies the real calibrated-reference prerequisite;
- reference fixture is a representative `640 × 480` image rather than bypassing minimum-size validation;
- WebKit furniture placement uses the same real hover-preview gesture.

## Automated acceptance

Implementation head before this evidence record:

```text
2cb085a5f637020bdba7dafe38bc258cc4ebdca7
```

Standard CI:

```text
GitHub Actions 30594115306 — PASS
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
GitHub Actions 30594115312 — PASS
artifact: 8779465503
digest: sha256:3b22de4e1ea0b2ca258c40be1702ef49904836dc4b87df9655bd13b066bde224
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
11. no document horizontal overflow.

WebKit core smoke independently verified:

- dashboard and editor startup;
- room identity and rename;
- planning return to room;
- object identity;
- compact hide/reopen with preserved draft;
- reference return to object;
- clean 3D composition;
- project-delete dialog regression.

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

## Remaining manual gate

Product-owner browser acceptance must verify:

1. room, wall, door/window and object panels feel like one family;
2. identity/title/summary hierarchy is clearer than before;
3. `К комнате…` from planning restores the room;
4. `К предмету…` after reference/recognition restores the original object;
5. compact panel X hides only the panel and reopening preserves the workflow/draft;
6. object/opening danger zones clearly communicate Undo;
7. reference removal clearly communicates that apartment geometry remains;
8. no important existing action became harder to reach.

Do not merge PR #23 before explicit product-owner acceptance and fresh exact-head standard/browser gates including this acceptance record.
