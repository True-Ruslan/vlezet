# M7.8B — Evidence-Gated Wall Completion Acceptance

**Status:** PRODUCT OWNER NEUTRAL / EXPERIMENT RETAINED / PRODUCTION RUNTIME DISABLED  
**Date:** 2026-08-02  
**PR:** #41  
**Branch:** `feat/m7-8b-source-normalization-wall-topology`  
**Accepted runtime decision:** keep recognition engine `5`; do not migrate the benchmark baseline  

## Product-owner evidence

The representative apartment plan was repeated after the evidence-gated completion implementation.

Local recognition produced:

```text
walls:       27
openings:     0
confident:    0
to review:   27
```

The local overlay remained incomplete: several principal exterior and interior wall spans were absent, while the detected candidates remained concentrated around the bathroom, service blocks, right boundary, and lower boundary.

After verification with a stronger vision model, the same draft contained:

```text
walls:       27
openings:     0
confident:   17
to review:   10
```

The model materially improved confidence assignment, but the candidate count and geometry remained unchanged. Missing walls were not added, moved, or reconstructed.

This is the intended verification-only AI behavior and confirms that stronger models can classify existing local evidence better. It also proves that AI verification does not solve incomplete local wall extraction.

## Product decision

The completion experiment did not demonstrate a clearly visible geometry improvement on the representative plan and therefore does not satisfy the approved product gate.

Outcome: **Product Owner Neutral**.

Consequences:

- recognition engine remains version `5`;
- no reviewed baseline migration is created;
- the completion algorithm is not enabled in production runtime;
- the pure algorithm, deterministic diagnostics, and test corpus are retained for future research;
- M7.8B remains open because source extraction and topology are still incomplete on a representative real plan.

## Retained experimental behavior

The internal experimental module still implements:

### Collinear micro-gap completion

Two fragments may merge only when:

- both are axis-aligned within a deterministic tolerance;
- perpendicular offset and thickness are compatible;
- the gap is bounded by wall thickness, image size, and a hard pixel ceiling;
- a sampled structural-mask corridor exceeds occupancy and continuity thresholds;
- the pair is mutual-best;
- newly created geometry is not reused as evidence in the same pass.

A clean raster gap remains split as a likely opening.

### Corner and T-junction completion

An endpoint may extend only to one unique nearby perpendicular wall when:

- thicknesses are compatible;
- the projected intersection lies on the target wall;
- extension distance is bounded relative to thickness;
- structural-mask evidence supports the extension;
- no competing target exists.

Ambiguous extensions fail closed.

### Confidence and resource limits

- experimental completion emits only `low` or `medium` confidence;
- even two `high` inputs cannot produce a `high` completed wall;
- near-threshold support becomes `low`;
- maximum input centerlines: `80`;
- maximum pair comparisons: `512`;
- maximum hypotheses: `64`;
- maximum accepted completions: `16`;
- maximum mask samples per hypothesis: `4096`;
- invalid input or budget overflow returns the original canonical wall set without partial completion.

## Production runtime gate

The package now has two explicit paths:

- `experimentalCompleteWallCenterlines` — retained for direct tests and future benchmark work;
- `completeWallCenterlines` — production export that returns immutable copies of the original centerlines, accepts zero completions, and records `completion-disabled-product-neutral`.

The browser engine imports only through the public `@vlezet/recognition` package boundary. It cannot bypass the production gate by importing the experimental implementation directly.

This keeps the rollback small, auditable, and reversible while preventing benchmark-neutral behavior from entering the accepted product path.

## Automated evidence before rollback

The enabled experiment was safe but benchmark-neutral:

| Metric | Before completion | Enabled experiment |
| --- | ---: | ---: |
| Source wall geometry F1 | `0.837989` | `0.837989` |
| Source wall topology F1 | `0.837989` | `0.837989` |
| Incorrect high-confidence rate | `0` | `0` |
| Unknown-host openings | `0` | `0` |
| Stale decisions | `0` | `0` |

Protected fixtures remained:

```text
clutter-symbol-regression: TP 12 / FP 0 / FN 0
openings-heavy:            TP 12 / FP 0 / FN 0
m7-3-regression:           geometry/topology F1 0.88 / 0.88
```

The remaining orthogonal-corpus false negatives are primarily host-wall spans interrupted by intentionally rendered windows. Bridging them would raise the wall-only metric by closing actual openings, which is explicitly forbidden.

## TDD rollback evidence

The rollback followed RED → GREEN:

1. A source contract first failed while the browser engine could still invoke completion.
2. A package-boundary test then failed because the production export still accepted a raster bridge.
3. The public runtime export was replaced with a fail-closed no-op while the direct experimental export remained active.
4. The new runtime test proves:
   - experimental path accepts the supported synthetic bridge;
   - production path accepts zero completions;
   - original centerlines remain unchanged;
   - the product-neutral diagnostic is emitted.

At the production-gate head, the complete unit suites pass:

```text
recognition: 179 passed, 2 skipped
web:         395 passed
```

## Architecture preserved

Unchanged:

- `VlezetDocument` as the only persisted source of truth;
- IndexedDB and project formats;
- explicit Apply and one semantic Undo;
- M2 fit and collision authority;
- planner and 3D projections;
- provider-key handling;
- verification-only AI geometry authority;
- manual editing and provider-failure workflows.

## Next development target

Do not continue tuning confidence or re-enable completion against the same fragmented candidates.

The next bounded step must improve **source extraction before verification**, using the representative plan as a protected regression:

1. separate thick wall mass from text, furniture, sanitary symbols, and appliance blocks;
2. derive continuous wall bands and their centerlines before topology splitting;
3. preserve explicit opening evidence rather than treating every gap as damage;
4. measure recall of principal exterior/interior walls separately from confidence;
5. keep AI verification downstream and geometry-immutable.

M7.8B can be accepted only when local extraction captures the principal wall skeleton on the real plan without candidate explosion or false bridges.
