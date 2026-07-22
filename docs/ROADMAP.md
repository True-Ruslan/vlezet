# Vlezet — Roadmap

**Last updated:** 2026-07-22  
**Rule:** roadmap order is intentional. Do not start the next major milestone until the current release gate is satisfied.

For current implementation truth, read `docs/PROJECT_STATE.md` first.

## Roadmap summary

```text
DONE        M0 Foundation + Infinite Canvas
DONE        M1 Apartment Shell
DONE        M2 Furnishing + Fit
DONE        M3 Local-First Projects
DONE        M4 Reference Plan Import
NOW         M4.5 Assisted Recognition — RC / manual acceptance
NEXT        M5 Spatial 3D
THEN        M6 Intelligent Planning
LATER       public-product infrastructure and optional expansion areas
```

## P0 — Finish M4.5 Assisted Recognition

**Status:** active Draft PR #6, latest RC under real-plan acceptance.

### Goal

Make imported-plan recognition genuinely useful while preserving Vlezet's trust model:

- local-first;
- editable suggestions;
- optional AI;
- no silent replacement of user geometry;
- deterministic validation before apply.

### Merge gate

M4.5 can be merged only when the latest RC passes the same real apartment plan that exposed earlier failures.

Required acceptance:

1. project startup/reload is stable;
2. local CV returns useful candidates or a clear honest empty-state;
3. local candidates accelerate tracing more than they create noise;
4. previously malformed AI responses no longer kill valid candidates;
5. page/bounding-box/frame hallucinations do not pass as ordinary walls;
6. orphan/invalid openings are rejected;
7. local/cloud reconciliation is understandable;
8. candidate editing/accept/reject is usable;
9. apply creates normal Vlezet geometry;
10. one Undo removes the whole recognition batch;
11. reload restores valid current-version drafts;
12. M0–M4 workflows remain intact;
13. final strict CI is green on the exact merge head.

### If recognition quality is still weak

Do **not** weaken deterministic validation just to increase candidate count.

Improve in this order:

1. collect representative real-plan fixtures;
2. tune/preprocess local CV using measurable evidence;
3. improve candidate merging/junction reconstruction;
4. strengthen cloud semantic validation;
5. add model-quality ranking/recommendations based on actual plan-recognition results;
6. only then consider more sophisticated ML/custom recognition.

Any future model must still output editable candidates and pass the same deterministic apply boundary.

### Completion action

```text
manual acceptance
→ mark PR #6 Ready for Review
→ verify exact head + CI
→ squash merge to main
→ update PROJECT_STATE and CHANGELOG with merge SHA/date
→ begin M5 brainstorming/design
```

---

## P1 — M5 Spatial 3D

**Status:** planned direction; design not yet approved/implemented.

### Product goal

Give the user immediate spatial comprehension of the **same apartment model** without creating a second editor or sacrificing 2D precision.

3D is a projection:

```text
VlezetDocument
   ├── 2D Konva projection
   └── 3D Three.js projection
```

There must never be separate 2D and 3D geometry sources of truth.

### Recommended first M5 scope

#### M5.1 — Deterministic 3D shell

- floor plane from derived room/plan bounds;
- wall extrusion using real wall thickness;
- configurable/default wall height metadata;
- doors/windows cut or represented consistently from existing openings;
- deterministic mapping from world millimetres to 3D units;
- no photorealistic materials requirement.

#### M5.2 — Furniture projection

- existing placed objects represented from the same width/depth/height/rotation;
- generic geometric models first;
- selection identity shared with 2D where practical;
- no branded asset marketplace.

#### M5.3 — Camera/navigation UX

- orbit/pan/zoom;
- useful top/isometric/perspective presets;
- `2D ↔ 3D` switching without losing editor state;
- fit apartment to camera;
- responsive rendering for normal apartment-sized projects.

#### M5.4 — Spatial inspection

- highlight selected room/object;
- inspect dimensions and fit status already computed by deterministic 2D/domain logic;
- optional simple wall visibility/cutaway controls if needed for comprehension.

### M5 non-goals

- photorealistic rendering;
- ray tracing;
- material marketplace;
- generative interior images;
- separate 3D editing model;
- VR;
- construction documentation/BIM.

### M5 acceptance

A real M4/M4.5 apartment can be opened in 3D and visually matches the structured 2D model:

- wall positions/thicknesses/openings align;
- furniture dimensions/rotation align;
- switching views never mutates geometry unexpectedly;
- save/reload remains deterministic;
- 3D defects cannot corrupt the document model.

---

## P2 — M6 Intelligent Planning

**Status:** planned direction; requires strong structured geometry and M5 is not technically required for the algorithm, but should follow roadmap order unless product evidence changes it.

### Product goal

Help answer:

- Where should the bed/desk/storage go?
- Can several required objects fit?
- Which layout has better passages?
- What trade-offs exist between alternatives?

### Architecture principle

AI/planning output must resolve to normal structured entities:

```text
constraints + VlezetDocument
        ↓
planning engine / AI
        ↓
structured candidate layout
        ↓
deterministic geometry + fit validation
        ↓
editable alternative
```

No generated image is ever an authoritative plan.

### Recommended M6 scope

#### M6.1 — Constraint model

- required/optional objects;
- preferred rooms/zones;
- orientation preferences;
- minimum/recommended clearances;
- keep-clear areas;
- user priorities such as storage vs passage vs workspace.

#### M6.2 — Deterministic candidate generation/evaluation

- reuse current collision/containment/clearance engine;
- score candidates using explicit criteria;
- reject geometrically invalid layouts before presenting them.

#### M6.3 — AI-assisted alternatives

- several editable layout variants;
- explain trade-offs in human language;
- AI proposes structure/constraints, not pixels;
- preserve user-authored geometry and locked objects.

#### M6.4 — Compare layouts

- side-by-side or variant switching;
- measurable differences: passages, collisions, usable clearances, object coverage;
- ability to apply a chosen variant as one semantic operation.

### M6 acceptance

Given a real apartment and a concrete list of furniture requirements, Vlezet can produce several editable, geometrically valid alternatives and explain why they differ.

---

## Cross-cutting public-quality work

These are not separate product milestones unless their scope grows, but they should be introduced when they become the highest-risk gap.

### Browser automation

Add Playwright coverage for the highest-value journeys:

- project create/save/reload;
- wall/opening editing;
- furniture transform/fit;
- reference import/calibration;
- recognition review/apply;
- 2D↔3D once M5 exists.

Canvas interaction should still retain manual visual acceptance because unit/E2E tests cannot prove every interaction quality issue.

### Observability and diagnostics

Keep structured development diagnostics for complex pipelines such as recognition while ensuring:

- no API keys;
- no Authorization headers;
- no private image base64;
- no noisy permanent production logging.

### Performance budgets

Track:

- Canvas/Konva layer count;
- large-plan rendering;
- recognition Worker memory/runtime;
- 3D object count/frame rate in M5;
- IndexedDB project/asset size.

### Migration discipline

Every persistent schema/storage/file-format change must include:

- explicit version;
- deterministic migration;
- backward compatibility where reasonable;
- safe failure for unsupported future versions;
- regression fixtures.

### First-time UX/onboarding

Before public-quality release, ensure a new non-CAD user can discover:

```text
import/draw apartment
→ calibrate dimensions
→ walls/openings
→ furniture
→ fit feedback
→ save/export
```

without reading developer documentation.

---

## Deferred / optional future areas

These are **not committed roadmap milestones yet** and should not distract from M4.5→M5→M6:

- accounts/authentication;
- cloud sync and multi-device projects;
- sharing/collaboration;
- managed Vlezet AI backend instead of BYOK;
- mobile-first editing;
- multi-floor projects/stairs;
- curved walls;
- perspective-corrected phone-photo import;
- authoritative OCR-assisted dimensions;
- DWG/DXF/BIM import;
- electrical/plumbing plans;
- finishes/materials;
- branded furniture catalogue/marketplace;
- renovation estimates/budgets;
- photorealistic rendering/VR;
- billing/subscriptions.

Any of these requires a fresh product/design decision before implementation.

## Decision rules for future development

1. Finish the current acceptance gate before starting the next major milestone.
2. Prefer real apartment evidence over synthetic demos.
3. Never trade deterministic geometry correctness for visually impressive AI/3D output.
4. Fix architectural causes of RC defects, not only visible symptoms.
5. Keep optional features isolated so they cannot block the core editor.
6. Preserve local-first low-latency editing.
7. Add complexity only when a validated user journey requires it.
8. Before every new major milestone, run a fresh brainstorming/design/spec/plan process.

## Recommended question for a new chat

A future chat can start with:

> Open `docs/PROJECT_STATE.md`, `docs/ROADMAP.md` and `docs/CHANGELOG.md` in `True-Ruslan/vlezet`, then check the latest PRs and CI. Tell me what is done, what changed after the state snapshot, what remains, and what we should develop next.

That workflow intentionally combines the durable written context with live repository state.