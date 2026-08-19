# M8.4 Wall Assisted Tracing — Second real-plan Product Owner FAIL

**Date:** 2026-08-19  
**Tracker:** #51  
**Draft PR:** #94  
**Branch:** `feat/m8-4-wall-assisted-tracing`  
**Status:** **SECOND PRODUCT OWNER REAL-PLAN FAIL / AUTOMATION STILL TOO NARROW / NOT MERGED**

## Observed outcome

The corrective automated GREEN on `183b7b0615ac2bc7a309a19c035a569f28a96006` did not translate into acceptable real-plan behavior. In the Product Owner retest, `По подложке` was enabled but attraction was not perceptible/reliable enough and the resulting traced geometry was visibly crooked. The project also displayed the geometry diagnostic `Стены пересекаются без явного соединения`.

This invalidates the previous automation as acceptance evidence. It remains useful only as narrow regression evidence for isolated single-wall acquisition, dense-fixture sampling, Alt suppression, Off behavior and ordinary history.

## Acceptance gap

The existing M8.4 browser proof is still primarily an isolated A→B wall journey. A real apartment trace is a multi-segment structural workflow:

- source evidence must remain stable over continuous pointer movement;
- horizontal and vertical wall axes meet at corners/intersections;
- one assisted endpoint becomes structural topology for the next segment;
- ordinary structural snapping and source assistance must coexist;
- imprecise human clicks must still produce shared vertices where topology requires them;
- the final document must be topologically valid, not merely visually close to the raster.

Turning ordinary `Привязки` Off remains a diagnostic mode for isolating the source provider, not the primary acceptance mode for tracing a connected apartment shell. Primary acceptance must use `Привязки` ON together with `По подложке` ON.

## New blocking test contract

Before any further production change, establish genuine RED evidence for:

1. source-axis stability over a sequence of noisy pointer positions along one architectural wall;
2. corner transition horizontal → intersection → vertical;
3. hysteresis that keeps the active wall axis without hopping to a nearby parallel line;
4. source assistance coexisting with endpoint/junction topology authority;
5. a Playwright multi-wall chain with intentionally imprecise clicks and both assist systems enabled;
6. shared vertex IDs at expected corners/closure;
7. absence of near-duplicate corner vertices;
8. absence of `Стены пересекаются без явного соединения` after the trace;
9. Chromium + representative WebKit with workers=1 and retries=0.

Only then may production corrections be made one root cause at a time under RED → GREEN.

## Guardrails retained

- `VlezetDocument` remains the only persistent geometry authority.
- M8.3 reference transforms remain the only source/world transform authority.
- Existing topology remains stronger than source-image evidence.
- Exact numeric input remains authoritative.
- Weak/ambiguous/unavailable source evidence abstains.
- Source assistance remains runtime-only and optional.
- No AI/network dependency or second document state.
- No threshold/validator/coverage-policy weakening to obtain GREEN.
- Hosted door/window assistance remains blocked until wall tracing receives explicit real-plan Product Owner PASS and protected integration.
