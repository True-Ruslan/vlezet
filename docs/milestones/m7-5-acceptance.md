# M7.5 — Onboarding, Status and Recovery Acceptance

**Status:** AUTOMATED PASS / PRODUCT-OWNER BROWSER ACCEPTANCE PENDING  
**Date:** 2026-08-01  
**PR:** #31  
**Implementation head:** `d28340e7b71b6c1c05675821ebddd9796e868b31`

## 1. Accepted automated scope

M7.5 currently delivers:

- a dismissible first-project guide derived only from the current document wall count and existing authoritative `deriveRooms()` output;
- a path from empty project to first wall, open contour and first closed room;
- per-project browser-local guide dismissal under the versioned UI-preference key;
- durable runtime-only evidence for:
  - first authoritative room creation;
  - successful recognition Apply;
  - successful planning Apply;
  - successful editable Vlezet JSON backup export;
- recoverable backup-export failure evidence with a valid retry action;
- one active evidence item scoped to the current project;
- stale room evidence removal after Undo or room deletion;
- compact-width guide/evidence placement inside the Canvas grid column;
- Chromium and WebKit regression coverage.

## 2. Authority boundaries

Confirmed unchanged:

- `VlezetDocument`, schema and migrations;
- IndexedDB project records and portable project format;
- wall topology, room derivation, geometry and snapping;
- semantic history command behavior;
- recognition candidate generation/reconciliation;
- planning generation, validation and Apply authority;
- Canvas and Three.js geometry authority;
- read-only 3D behavior.

The guide never creates or closes geometry. Progress and success evidence cannot mark an operation complete; they are derived or published only after existing authoritative state/commands prove completion.

## 3. TDD and regression evidence

The implementation was delivered through explicit RED/GREEN slices covering:

- first-project progress derivation;
- guarded local dismissal preference;
- runtime evidence replacement, dismissal and project scoping;
- guide and evidence presentation through existing M7.3 primitives;
- first-room transition behavior;
- planning and recognition semantic-history transitions;
- successful and failed backup download events;
- retry routing to the active JSON export callback;
- compact overlay/Canvas grid behavior;
- Chromium/WebKit end-to-end onboarding flow.

Browser-found regressions fixed during release-candidate hardening:

1. the guide container intercepted Canvas clicks — the card is now pointer-transparent outside explicit controls;
2. a React effect synchronously changed local state — guide runtime state moved to an external ephemeral store;
3. planning Apply and panel close could occur in separate store updates — evidence derives directly from the semantic history append;
4. a docked catalogue could cover the guide — overlays are anchored to the central Canvas grid column;
5. compact flow placed the guide in ordinary grid layout and hid the Canvas — compact presentation remains an absolute overlay;
6. the WebKit test selector matched both dismiss controls — the acceptance selector now requires the exact visible label.

## 4. Exact implementation-head verification

```text
head:          d28340e7b71b6c1c05675821ebddd9796e868b31
standard CI:   30691763167 / #2072 — PASS
browser audit: 30691763181 / #269 — PASS
artifact:      8815924390
digest:        sha256:1d5075a9d564c6c25741117024bb0beb7e267d143c4f28785b3993a90a08b60c
```

Standard CI passed:

- frozen dependency installation;
- M7 documentation contract;
- complete unit suite;
- TypeScript typecheck;
- ESLint;
- production Next.js build.

Browser audit passed:

- Chromium full M7 regression suite;
- WebKit core smoke suite;
- fresh-project onboarding path;
- Wall activation from the guide;
- open-contour guidance;
- first closed-room durable evidence;
- evidence remaining after transient-toast timeout;
- Undo removing stale room evidence;
- per-project dismissal surviving project reopen;
- editable backup durable evidence in Chromium;
- compact-width horizontal-overflow and Canvas visibility checks;
- browser evidence upload.

## 5. Product-owner manual acceptance required

Use a fresh test project and verify:

1. `Первый план` appears without blocking Canvas interaction.
2. `Начать со стены` activates the Wall tool.
3. After the first wall, the guide says `Контур ещё не замкнут`.
4. Closing a valid rectangular contour produces both:
   - `Первая комната готова` in the guide;
   - durable `Первая комната создана` evidence with area.
5. The evidence remains after several seconds.
6. `Открыть комнату` selects the derived room.
7. Undo removes the room and clears stale success evidence.
8. `Скрыть` dismisses the guide only for the current project and remains dismissed after reopening that project.
9. A different fresh project receives its own guide.
10. Applying a planning alternative produces durable success evidence and its Undo action works.
11. Applying reviewed recognition produces durable success evidence and its Undo action works.
12. Exporting `Vlezet JSON` produces durable backup evidence after the download begins.
13. At compact width, the guide does not hide the Canvas, create horizontal overflow or sit beneath side panels.
14. Entering 3D or a bounded reference/recognition/planning workflow hides onboarding guidance without losing document state.

## 6. Merge gate

Do not mark PR #31 ready or merge until:

- the product owner confirms the representative browser scenarios;
- the acceptance statement is recorded;
- both standard CI and browser audit pass again on the exact final documentation head;
- review threads are resolved;
- squash merge uses expected-head protection.
