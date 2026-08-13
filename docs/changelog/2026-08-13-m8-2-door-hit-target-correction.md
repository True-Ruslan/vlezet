# M8.2 Door Hit-Target Correction — 2026-08-13

Status: **PRODUCT-OWNER PASS / M8.2 ACCEPTANCE RECORDED / PROTECTED MERGE PENDING**

This record documents the final focused M8.2 usability correction requested during product-owner acceptance. Canonical milestone acceptance is recorded separately in `docs/milestones/m8-2-acceptance.md`. PR #87 remains unmerged until fresh acceptance-head delivery gates and protected integration complete.

## Product-owner evidence

The product owner rechecked the three latest regression paths:

1. hosted door movement/runtime — **functional PASS**, but the door remained inconvenient to acquire because the pointer had to land on the thin rendered leaf;
2. no-modifier room + furniture marquee/movement — **PASS**;
3. representative window movement — **PASS**.

The supplied screenshot made the usability problem concrete: the visually meaningful door consists of the wall opening, leaf and swing arc, but only the narrow leaf had a practical listening hit target.

The remaining door issue was therefore treated as a real UX finding rather than being dismissed because movement itself already worked.

## Interaction decision

The complete quarter-circle swing sector is deliberately **not** made clickable. A filled sector would be much larger than the rendered door and could steal ordinary room/furniture clicks inside the sweep area.

The practical door target is instead limited to visible/semantic door geometry:

- the full opening span where the door interrupts the host wall;
- the door leaf;
- the swing arc.

The wall-opening and arc targets use a minimum 12 px listening stroke. Visual thickness is unchanged.

This preserves the user's intuitive target while keeping surrounding room/furniture interaction available.

## Architecture / authority preserved

The correction is Canvas/Konva interaction-only:

- `VlezetDocument` and project schema are unchanged;
- opening geometry, `wallId` and host-wall semantics are unchanged;
- `@vlezet/editor-core` remains hosted-opening mutation/validation/history authority;
- no silent re-hosting is introduced;
- overlap/end-span validation is unchanged;
- one accepted drag remains one semantic Undo/Redo operation;
- M2 fit/collision/door/clearance authority is unchanged;
- recognition behavior/thresholds are unchanged.

## Genuine RED

A real Playwright regression was changed to begin the drag from the **centre of the door opening span on the wall**, not from the thin door leaf.

The first test-only commit contained a syntax typo and is explicitly excluded from product evidence:

```text
9e037fce958d91f07a504756922de4b5c8389b3b
Browser Acceptance #1523 — HARNESS-ONLY syntax failure before tests
```

After fixing only the harness syntax, the valid RED was:

```text
RED head:                     e41c695b193a9e20ec0173453cd23d093f1bfaab
CI #5074:                    PASS
Browser Acceptance #1524:    EXPECTED FAIL
  Chromium:                  54 PASS / 1 FAIL
  only failure:              door wall-opening-span drag
  observed after drag:       selection/marquee path (`Выбрано: 2`)
  expected:                  hosted door remains selected and offset changes
  WebKit:                    skipped after Chromium failure
RED artifact:                9172541137
```

This proved the failure at the actual pointer interaction boundary: the wall gap did not own the opening gesture.

## Production correction

Production patch commit:

```text
9f37c7c0db394e7f924c732e4d191d3bff724ecf
fix(canvas): widen door direct-manipulation hit target
```

The patch:

- gives the non-preview door gap opening identity + hosted-opening pointer handlers;
- uses `max(12 px, rendered gap width)` as the wall-opening hit stroke;
- keeps the existing 12 px leaf hit target;
- gives the rendered swing arc opening identity + 12 px hit stroke;
- keeps preview geometry non-listening;
- does not create a filled clickable swing sector.

## Connector/tooling provenance

Because `editor-canvas.tsx` is a large file and GitHub Contents replacement requires the entire file body, temporary source-export / one-shot patch tooling was used solely to avoid truncating or corrupting the source through the connector.

Those runs are **not** product RED/GREEN evidence:

- Browser #1525/#1526/#1527 — temporary connector source-export mechanics;
- one-shot patch workflow run `31679871369` — applied the exact two-site source patch and committed it;
- all temporary source-export files/workflows were removed before the clean product-code GREEN head.

## Product-code GREEN

Clean product-code head after temporary tooling removal:

```text
head:                          8f9317db650bd076df957028035f6a643d0ec470
CI #5082 / run 31679924606:   PASS
  documentation contract:      PASS
  unit tests:                  PASS
  Core Recognition Benchmark:  PASS
  typecheck:                   PASS
  lint:                        PASS
  build:                       PASS
Browser Acceptance #1532:     PASS
  Chromium:                    PASS
  WebKit:                      PASS
browser run:                   31679924617
browser artifact:              9173229566
artifact digest:               sha256:14ff9ba47d708c881adfdccf89f11218efac4af9f54862f332ebd0f487b65ea3
```

The permanent browser contract now covers the actual product-owner complaint: drag begins from the wall-opening span instead of relying on mathematically precise leaf targeting. Global `pageerror` and `console.error` guards remain active.

## Product-owner acceptance result

On 2026-08-13 the product owner completed the final focused retest and reported: **«Все 3 теста PASS»**. This confirms comfortable acquisition from the wall-opening area, continued leaf/arc targeting and no unexpected click capture by the non-listening swing sector.

The earlier room + furniture marquee/movement, representative window movement and functional hosted-door movement/runtime checks were already PASS. No manual M8.2 acceptance scenario remains open. Canonical acceptance record: `docs/milestones/m8-2-acceptance.md`.

Remaining work is delivery-only: fresh exact-head CI + Chromium/WebKit Browser Acceptance after acceptance truth-sync, Ready state, protected squash merge and integration verification on `main`.