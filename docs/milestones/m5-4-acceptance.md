# M5.4 Spatial Inspection — Acceptance

**Date:** 2026-07-22  
**PR:** #10 `feat: M5.4 spatial inspection`  
**Status:** implementation complete; automated gates PASS; real-browser acceptance pending before merge.

## Product contract

M5.4 turns the existing read-only 3D projection into a semantic inspection surface without introducing a second geometry authority.

```text
Three.js ray hit
      ↓
semantic entity id / kind
      ↓
ephemeral hover / selection
      ↓
VlezetDocument + SpatialScene + deterministic geometry/fit engines
      ↓
read-only inspector
```

Non-negotiable boundaries:

- `VlezetDocument` remains the only persistent apartment source of truth;
- Three.js meshes are never measurement, fit, collision or persistence authority;
- hover/select never writes document/history/autosave state;
- no direct 3D editing;
- no decorative asset pipeline;
- no M6 planning/AI generation mixed into this milestone.

## Delivered implementation

### Semantic inspection targets

Inspectable:

- room floors → stable `roomId`;
- wall meshes → stable `wallId`;
- placed-object meshes → stable `objectId`.

Not independently inspectable in this slice:

- schematic opening placeholders;
- unknown renderer objects.

Ray-hit resolution skips non-inspectable hits and chooses the nearest valid semantic entity behind them. Unknown or stale metadata fails closed.

### Authoritative details

Room:

- derived room name;
- canonical usable area;
- canonical M4.6 area rounding from square millimetres;
- clear rectangular width/length only when deterministically derivable.

Wall:

- centreline length from canonical wall endpoints;
- physical wall thickness;
- number of rendered split segments for the same semantic wall.

Placed object:

- existing name/category;
- exact width/depth;
- stored height when authoritative;
- projection-only default height explicitly labelled when used;
- rotation;
- `fits / tight / blocked` from existing deterministic `evaluateObjectFits`;
- existing deterministic diagnostic reasons.

### Interaction

- hover previews an inspectable entity;
- click selects it persistently;
- empty click clears selection;
- pointer leave clears hover;
- drag-vs-click threshold prevents ordinary camera orbit from being treated as selection;
- selected entity takes precedence over hover;
- stale semantic IDs fail closed without state effects or persistence writes.

### Visual emphasis lifecycle

- only matched inspectable meshes receive temporary cloned highlight materials;
- one semantic wall highlights all visible split segments sharing the same `wallId`;
- unrelated entities remain untouched;
- previous base materials are restored when emphasis changes/clears;
- temporary materials are explicitly disposed;
- renderer disposal clears emphasis before disposing base scene resources.

## TDD / automated evidence

Observed RED→GREEN cycles:

1. missing pure `spatial-inspection` contract → RED → authoritative resolver GREEN;
2. missing renderer `emphasize` lifecycle → RED → multi-segment semantic emphasis + disposal GREEN;
3. missing `SpatialInspector` → RED → read-only inspector GREEN;
4. direct floating-point `11.715.toFixed(2) = 11.71` regression → FAIL → reuse canonical M4.6 square-mm formatter → `11.72` GREEN;
5. missing nearest inspectable ray-hit resolver → RED → deterministic fail-closed picking GREEN;
6. React lint rejected synchronous stale-selection `setState` inside effect → resolver changed to derived fail-closed inspection without state-effect writes.

Accepted implementation code head before this documentation commit:

```text
776112fd08e6ecb693ff7184bece098c1b115f46
GitHub Actions 29943692683 — PASS
```

All required gates passed on that implementation head:

- [x] `pnpm install --frozen-lockfile`
- [x] full unit suite
- [x] TypeScript typecheck
- [x] ESLint
- [x] production Next build

## Automated contract checks

- [x] floor metadata maps to room semantic target
- [x] wall metadata maps to wall semantic target
- [x] placed-object metadata maps to placed-object semantic target
- [x] opening placeholders are not independent inspection targets
- [x] nearest inspectable hit is chosen after non-inspectable hits
- [x] stale/unknown semantic metadata fails closed
- [x] room details use derived authoritative area/dimensions
- [x] `11.715 m²` displays canonically as `11.72 m²`
- [x] wall details use canonical endpoints/thickness
- [x] object details reuse deterministic fit status/diagnostics
- [x] one wall semantic target emphasizes all split wall segments
- [x] unrelated entities are not emphasized
- [x] temporary highlight materials restore/dispose correctly
- [x] renderer disposal includes active emphasis resources
- [x] viewer source contains no inspection writes to `editorStore`, history or autosave

## Real-browser acceptance — required before merge

Use the same representative apartment project previously used for M5.1/M5.2 acceptance.

- [ ] hover a room floor and verify preview inspector appears
- [ ] click a room and verify persistent selection/highlight
- [ ] room area matches 2D exactly
- [ ] rectangular room clear dimensions match 2D exactly
- [ ] hover/click a wall and verify the whole semantic wall highlights, including split segments around openings
- [ ] wall centreline length/thickness match 2D/domain values
- [ ] hover/click each placed object
- [ ] object dimensions/rotation match 2D
- [ ] fit status and reason match existing 2D deterministic fit result
- [ ] clicking empty 3D space clears selected inspector
- [ ] orbit drag does not accidentally select an entity
- [ ] Perspective / Isometric / Top still work
- [ ] orbit / pan / zoom still work
- [ ] 2D↔3D switching remains reliable
- [ ] inspection causes no unexpected save/history/geometry changes
- [ ] no visible M5.1 shell or M5.2 furniture regression

## Merge gate

Do not mark M5.4 DONE or merge PR #10 until:

1. the final exact PR head has strict CI PASS;
2. the real-browser checklist above is accepted;
3. any acceptance-discovered regression is fixed and reverified.

After browser acceptance:

```text
mark PR #10 Ready for Review
→ verify exact head + CI
→ squash merge
→ update PROJECT_STATE / ROADMAP / CHANGELOG with final merge SHA
→ choose evidence-driven M5 polish or begin M6 Intelligent Planning
```
