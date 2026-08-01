# M7.5 — Onboarding, Status and Recovery Acceptance

**Status:** ACCEPTED / READY FOR PROTECTED SQUASH MERGE  
**Date:** 2026-08-01  
**PR:** #31  
**Implementation head:** `d28340e7b71b6c1c05675821ebddd9796e868b31`  
**Accepted documentation head:** `c07ffff661ef71ec6dd1da9319e4e3f7bdf03fc9`

## 1. Accepted scope

M7.5 delivers:

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

The guide never creates or closes geometry. Progress and success evidence cannot mark an operation complete; they are derived or published only after existing authoritative state or commands prove completion.

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
- compact overlay and Canvas grid behavior;
- Chromium/WebKit end-to-end onboarding flow.

Browser-found regressions fixed during release-candidate hardening:

1. the guide container intercepted Canvas clicks — the card is now pointer-transparent outside explicit controls;
2. a React effect synchronously changed local state — guide runtime state moved to an external ephemeral store;
3. planning Apply and panel close could occur in separate store updates — evidence derives directly from the semantic history append;
4. a docked catalogue could cover the guide — overlays are anchored to the central Canvas grid column;
5. compact flow placed the guide in ordinary grid layout and hid the Canvas — compact presentation remains an absolute overlay;
6. the WebKit test selector matched both dismiss controls — the acceptance selector now requires the exact visible label.

## 4. Exact-head automated verification

Implementation-bearing head:

```text
head:          d28340e7b71b6c1c05675821ebddd9796e868b31
standard CI:   30691763167 / #2072 — PASS
browser audit: 30691763181 / #269 — PASS
artifact:      8815924390
digest:        sha256:1d5075a9d564c6c25741117024bb0beb7e267d143c4f28785b3993a90a08b60c
```

Accepted documentation head:

```text
head:          c07ffff661ef71ec6dd1da9319e4e3f7bdf03fc9
standard CI:   30691866086 / #2074 — PASS
browser audit: 30691866095 / #270 — PASS
artifact:      8815957652
digest:        sha256:2dd52036bf3191c849a12539e187ba391968c629b774d0fc945e580d00c4c0f5
```

The exact accepted head passed:

- frozen dependency installation;
- M7 documentation contract;
- complete unit suite;
- TypeScript typecheck;
- ESLint;
- production Next.js build;
- Chromium full M7 regression suite;
- WebKit core smoke suite;
- browser evidence upload.

## 5. Product-owner browser acceptance

The product owner completed the representative browser scenarios on 2026-08-01 and confirmed:

> «Все работает четко как надо и как ты описал.»

This confirmation covers the approved manual acceptance path:

1. non-blocking fresh-project guidance;
2. Wall activation from the guide;
3. open-contour guidance;
4. first closed-room guidance and durable evidence;
5. evidence persistence beyond transient-toast timeout;
6. room selection from evidence;
7. Undo clearing stale room evidence;
8. per-project dismissal surviving project reopen;
9. independent guidance for another fresh project;
10. planning Apply evidence and Undo;
11. recognition Apply evidence and Undo;
12. editable-backup evidence;
13. compact-width Canvas visibility, panel safety and no horizontal overflow;
14. correct hiding during 3D and bounded workflows without document-state loss.

## 6. Merge gate

All M7.5 merge conditions are satisfied:

- product-owner browser acceptance is recorded;
- standard CI and browser audit passed on the exact accepted documentation head;
- no unresolved review threads remain;
- PR #31 is mergeable;
- merge must use squash mode with expected-head protection.
