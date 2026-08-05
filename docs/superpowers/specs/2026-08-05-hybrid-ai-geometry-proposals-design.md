# Hybrid AI Geometry Proposals — Design

Date: 2026-08-05  
Status: product direction approved; written specification pending final product-owner review  
Repository: `True-Ruslan/vlezet`  
Current integration branch: `feat/m7-9-real-fixture-ai-benchmark` / PR #44  
Related base: PR #42, M7.8C opening classification and host-wall validation

## 1. Decision summary

Vlezet will move from a verification-only AI workflow to a conservative hybrid recognition workflow:

1. the local engine builds a deterministic high-precision structural Draft;
2. AI may discover omissions and question suspicious local candidates, but cannot mutate the Draft or `VlezetDocument`;
3. every AI result is represented as a separate untrusted proposal;
4. deterministic validation converts only sufficiently supported proposals into reviewable candidates;
5. the user remains the final authority and only explicit Apply mutates the apartment document.

Delivery is staged:

- **Stage 1:** missing door/window proposals and exact-ID false-wall review suggestions;
- **Stage 2:** missing thin-wall proposals, initially limited to balcony/loggia and short partition cases;
- **Stage 3:** bounded multi-proposal reconciliation for a connected structural fragment.

This design deliberately rejects both extremes: continuing to encode one local heuristic per screenshot, and allowing a vision model to author authoritative geometry.

## 2. Product evidence and problem statement

The product-owner retest on the current exact PR #44 implementation returned:

```text
Local Draft:
- walls: 40
- openings: 2
- confident: 7
- review: 35

After AI verification:
- walls: 40
- openings: 2
- confident: 2
- review: 40
```

Observed defects:

- some doors are still missing;
- no windows were detected;
- a sanitary symbol near the washbasin was interpreted as an extra wall;
- the thin balcony/loggia wall was not detected;
- AI did not recover any missing geometry and mainly downgraded local confidence;
- the visual result was not materially better than the earlier product result.

The current behaviour is expected from the existing contract. `sanitizeCloudRecognitionResult` rejects unknown wall and opening IDs, while reconciliation defers every cloud-only opening or wall. AI can therefore verify only hypotheses already created locally. When local recall is poor, a stronger model still has no legal path to help.

The current public real-fixture benchmark improved to wall F1 `0.839858` and opening F1 `0.750000`, but the product-owner plan demonstrates that aggregate analogue progress does not yet represent the critical real workflow. The retest is therefore a product acceptance failure, not an accepted limitation.

## 3. Goals

### 3.1 Primary goals

- preserve a deterministic, high-precision local structural baseline;
- let AI discover missing doors and windows that do not exist in the local Draft;
- let AI point to a specific local wall that is likely furniture, sanitary notation or other clutter;
- later let AI propose narrowly scoped missing thin walls;
- show AI origin, confidence, evidence and deterministic validation outcome clearly;
- guarantee that AI cannot silently create, move, delete, resize or apply apartment geometry;
- keep errors, timeouts and weak model results non-destructive;
- measure proposal usefulness separately from local recognition quality.

### 3.2 Success from the user’s perspective

After local recognition and AI assistance, the user should be able to distinguish:

- reliable local geometry;
- uncertain local geometry requiring review;
- new AI-discovered proposals that passed local validation;
- AI proposals blocked by deterministic validation;
- local candidates questioned by AI but not automatically rejected.

The workflow must explain what the system found, what evidence supports it, what remains uncertain and what will happen on Apply.

## 4. Non-goals

The first delivery does not include:

- AI-authored authoritative coordinates;
- full-plan generation from a vision model;
- automatic deletion of local walls;
- automatic acceptance of AI proposals;
- room polygons, OCR labels or area reconciliation;
- arbitrary diagonal or curved wall generation;
- door swing-direction acceptance as a blocking criterion;
- perspective-photo reconstruction;
- autonomous correction of existing `VlezetDocument` entities;
- live paid AI calls in pull-request CI;
- lowering existing Core, Source or real-fixture thresholds.

## 5. Considered approaches

### 5.1 Selected: conservative local baseline plus AI proposals

The local engine owns high-confidence structural evidence. AI returns separate discovery and review proposals. A deterministic sanitizer decides whether each proposal is eligible for human review.

Benefits:

- improves recall without surrendering geometry authority;
- failures remain inspectable and reversible;
- providers can be compared using a stable contract;
- local-only operation remains fully functional;
- the same proposal validator can be tested without live AI.

Cost:

- requires a new proposal model, validator, review UX and benchmark layer.

### 5.2 Rejected: AI only classifies existing local candidates

This is the current verifier-only architecture. It is safe but cannot recover omissions. The product retest proves that it does not satisfy the recognition goal.

### 5.3 Rejected: AI generates the complete plan and local code validates it

This can increase recall but creates unstable coordinates, model dependence, large validation ambiguity, higher cost and weak reproducibility. It conflicts with Vlezet’s deterministic authority and local-first product principles.

## 6. Architectural invariants

The following rules are mandatory:

1. `VlezetDocument` remains the only persistent apartment source of truth.
2. Raw AI output is never a `RecognitionWallCandidate` or `RecognitionOpeningCandidate`.
3. Raw AI proposals are runtime-only and cannot be applied.
4. Every proposal is bound to the exact reference revision and exact local Draft fingerprint used in the request.
5. A stale proposal batch is rejected as a whole.
6. AI cannot mutate local candidate IDs, coordinates, thickness, type, host or decisions.
7. A proposed opening must obtain exactly one known active host wall through deterministic validation.
8. AI confidence alone can never produce high confidence.
9. A local candidate questioned by AI remains unchanged until the user explicitly changes its Draft decision.
10. Accepted proposal review decisions do not mutate the apartment until explicit Apply.
11. Apply revalidates against the current document and current accepted host mapping.
12. Errors leave the existing local Draft byte-equivalent except for an append-only diagnostic.
13. Candidate and proposal budgets fail closed.
14. No hidden provider fallback or silent model substitution is allowed.
15. Existing local-only, Apply, Undo, Redo, persistence and recovery paths must continue to work without a provider key.

## 7. Component boundaries

### 7.1 Local recognition engine

Responsibilities:

- create wall and opening candidates from deterministic image evidence;
- retain diagnostic candidates when review is useful;
- expose structural masks, active wall topology and bounded evidence summaries needed by proposal validation;
- compute deterministic unresolved regions and candidate fingerprints.

It does not know provider schemas or provider confidence.

### 7.2 AI request builder

Responsibilities:

- create a bounded provider-neutral request;
- include the original plan image, a labelled local overlay and structured local candidate summaries;
- declare allowed proposal types for the current stage;
- include coordinate-system, Draft fingerprint and reference-revision contracts;
- omit runtime secrets and unrelated project/document data.

It does not validate returned geometry.

### 7.3 Provider adapter

Responsibilities:

- translate the provider-neutral request to OpenRouter or another provider;
- enforce timeout, response-size and token budgets;
- parse only the exact response schema;
- return an untrusted `AiProposalBatch`;
- record safe provider/model metadata.

It does not reconcile, snap or apply proposals.

### 7.4 AI proposal sanitizer

Responsibilities:

- validate schema, budgets, IDs, coordinates and batch freshness;
- reject unsupported proposal kinds;
- bind proposed openings to an exact active local host;
- snap only within fixed tolerances and preserve both raw and normalized geometry;
- corroborate the proposal using local raster and topology evidence;
- detect duplicates and conflicts;
- cap confidence;
- emit an immutable `SanitizedRecognitionProposal` with explicit validation reasons;
- preserve rejected proposals as diagnostics without exposing them as applicable geometry.

This component is the sole authority that may convert raw AI output into a reviewable proposal.

### 7.5 Proposal reconciliation

Responsibilities:

- combine sanitized proposals with the local Draft without mutating local candidates;
- deduplicate proposals against local candidates and other proposals;
- preserve proposal provenance and validation state;
- expose review decisions separately from local candidate decisions;
- invalidate proposal decisions when the reference revision or local Draft fingerprint changes.

### 7.6 Review UI

Responsibilities:

- visually distinguish Local, Local + AI verification and AI proposal sources;
- show proposal type, model confidence, deterministic confidence and validation explanation;
- provide explicit actions such as “Accept proposal”, “Reject proposal” and “Agree that local wall is suspicious”;
- show blocked proposals in diagnostics, not as selectable geometry;
- explain that accepting a false-wall suggestion changes only the Draft decision;
- keep local-only operation and previous Draft restoration available.

### 7.7 Apply adapter

Responsibilities:

- convert accepted sanitized proposals into ordinary domain commands only at Apply time;
- resolve the accepted host wall to the current document wall or the wall created in the same atomic batch;
- re-run geometry, overlap, host-span and document-conflict validation;
- fail the whole dependent proposal operation if its host cannot be resolved;
- preserve semantic Undo/Redo and idempotence.

## 8. Data model

### 8.1 Raw provider batch

Raw provider output must use a new contract rather than `RecognitionProviderResult` geometry arrays.

```ts
type AiProposalBatch = Readonly<{
  schemaVersion: "recognition-ai-proposals-v1";
  requestId: string;
  referenceRevision: string;
  localDraftFingerprint: string;
  proposals: readonly AiRecognitionProposal[];
  diagnostics: readonly AiProviderDiagnostic[];
}>;
```

### 8.2 Stage 1 proposal union

```ts
type AiRecognitionProposal =
  | AiOpeningAdditionProposal
  | AiLocalWallReviewProposal;

type AiOpeningAdditionProposal = Readonly<{
  id: string;
  kind: "opening-addition";
  openingKind: "door" | "window";
  center: NormalizedPoint;
  widthNormalized: number;
  orientationDeg: number;
  hostWallHintIds: readonly string[];
  sourceRegion: NormalizedBox;
  modelConfidence: number;
  reasonCodes: readonly AiOpeningReasonCode[];
}>;

type AiLocalWallReviewProposal = Readonly<{
  id: string;
  kind: "local-wall-review";
  targetWallCandidateId: string;
  recommendation: "likely-clutter";
  sourceRegion: NormalizedBox;
  modelConfidence: number;
  reasonCodes: readonly AiWallReviewReasonCode[];
}>;
```

Provider reason codes are an allow-listed vocabulary. Free-form prose may be retained only as truncated diagnostic text and is never used for validation.

### 8.3 Stage 2 extension

Stage 2 extends the union with:

```ts
type AiThinWallAdditionProposal = Readonly<{
  id: string;
  kind: "thin-wall-addition";
  start: NormalizedPoint;
  end: NormalizedPoint;
  estimatedThicknessNormalized: number;
  wallRoleHint: "balcony-boundary" | "partition";
  endpointAnchorHintIds: readonly string[];
  sourceRegion: NormalizedBox;
  modelConfidence: number;
  reasonCodes: readonly AiThinWallReasonCode[];
}>;
```

This type is forbidden by the Stage 1 request and sanitizer.

### 8.4 Sanitized proposal

```ts
type SanitizedRecognitionProposal = Readonly<{
  id: string;
  rawProposalId: string;
  kind: "door" | "window" | "local-wall-review" | "thin-wall";
  state: "eligible" | "blocked" | "duplicate";
  geometry: SanitizedProposalGeometry | null;
  targetLocalCandidateId: string | null;
  hostWallCandidateId: string | null;
  provider: Readonly<{ providerId: string; modelId: string; requestId: string }>;
  modelConfidence: number;
  deterministicConfidence: "medium" | "low";
  sourceRegion: NormalizedBox;
  evidence: Readonly<{
    providerReasons: readonly string[];
    validatorReasons: readonly string[];
  }>;
  localDraftFingerprint: string;
}>;
```

No sanitized proposal can be `high`. High confidence remains reserved for strong local evidence or explicit local-plus-AI agreement on existing immutable geometry.

### 8.5 Draft integration

`RecognitionDraft` gains separate collections:

```ts
aiProposals: readonly SanitizedRecognitionProposal[];
proposalDecisions: Readonly<Record<string, "pending" | "accepted" | "rejected">>;
aiProposalMetadata: RecognitionAiProposalMetadata | null;
```

Local `walls`, `openings` and `decisions` remain semantically unchanged. This avoids treating untrusted AI discovery as local recognition output and allows old local-only Drafts to migrate by defaulting the new fields to empty values.

## 9. Request contract and prompt inputs

The provider receives three aligned inputs:

1. **Original source image** — bounded and normalized for provider limits.
2. **Labelled overlay image** — same dimensions, with stable candidate IDs and distinct wall/opening markers.
3. **Structured local summary** — candidate IDs, normalized geometry, confidence, conflict state, active/diagnostic status and compact evidence codes.

The request also contains:

- exact allowed proposal types;
- maximum result counts;
- source coordinate convention;
- plan bounds;
- reference revision;
- local Draft fingerprint;
- explicit instructions not to repeat existing correct candidates;
- explicit instructions that furniture, sanitary symbols, dimensions and text are not walls;
- exact JSON schema.

Stage 1 budgets:

```text
opening-addition proposals: maximum 12
local-wall-review proposals: maximum 12
provider diagnostics: maximum 20
source images: exactly 2
provider attempts: 1 normal attempt + at most 1 schema-repair attempt
request timeout: bounded by provider configuration
```

A schema-repair attempt receives no new image and only the invalid response’s structural error summary. It cannot silently switch model or provider.

## 10. Deterministic validation

### 10.1 Common validation

Every batch must pass:

- supported schema version;
- exact request ID, reference revision and local Draft fingerprint;
- unique bounded proposal IDs;
- finite normalized coordinates inside plan bounds;
- bounded result counts and source-region areas;
- allow-listed reason codes;
- no unknown target local candidate IDs;
- no unsupported proposal type for the active stage.

A stale fingerprint or revision rejects the whole batch. Individual invalid proposals are blocked while valid independent proposals may continue, unless the budget or identity contract is violated.

### 10.2 Door proposal validation

A proposed door becomes eligible only when all mandatory conditions pass:

- exactly one active host wall is selected deterministically;
- the proposed centre projects inside the host span with the existing end-margin invariant;
- orientation is compatible with the host;
- width is within architectural and calibrated bounds;
- local evidence supports a gap, leaf, arc or equivalent bounded door notation;
- structural support exists on the required sides of the opening;
- it does not overlap an existing opening or eligible proposal;
- it does not create a corner/junction topology conflict;
- it is not explained better by text, dimension or sanitary-symbol evidence.

Host hints may narrow candidates but never override deterministic host selection.

### 10.3 Window proposal validation

A proposed window becomes eligible only when:

- exactly one active exterior or balcony-compatible host is selected;
- the centre and width lie inside the valid host chain;
- local evidence contains a mask-supported gap and window-rail/frame evidence, or another explicitly versioned window evidence contract;
- the proposal is not a door gap;
- the proposal is not an interior furniture/sanitary symbol;
- overlap, duplicate and host validity checks pass.

AI alone cannot classify an unexplained arbitrary gap as a window.

### 10.4 Local false-wall review validation

A `local-wall-review` proposal never deletes or changes a local candidate. It is eligible as an advisory review action only when:

- the target ID exists and is still the exact same local candidate;
- the target has weak structural-mask support, topology conflict or existing symbol-clutter evidence;
- the target is short or otherwise within the bounded clutter-review profile;
- the target is not a long, strongly mask-backed or two-anchor structural wall;
- the proposal source region overlaps the target geometry.

If deterministic evidence strongly supports the wall, the AI suggestion is blocked and a diagnostic explains why.

### 10.5 Thin-wall validation in Stage 2

A thin-wall proposal is eligible only when:

- it is horizontal, vertical or within an explicitly calibrated axis tolerance;
- length and thickness are within the versioned thin-wall profile;
- at least one endpoint attaches to active structural geometry, and the second endpoint is anchored or mask-supported;
- the source region contains continuous thin structural evidence rather than furniture, window rails or dimensions;
- topology does not create an isolated micro-wall or duplicate an existing wall;
- balcony/loggia proposals agree with exterior-boundary context;
- all candidate and comparison budgets pass.

Stage 2 initially excludes arbitrary long interior walls and diagonal reconstruction.

## 11. Confidence policy

Confidence is computed from two independent dimensions:

- `modelConfidence`: normalized provider confidence, displayed but never authoritative;
- `deterministicConfidence`: the sanitizer’s bounded result.

Rules:

- AI proposal without sufficient local corroboration is blocked;
- eligible AI proposal is at most `medium`;
- partially corroborated but reviewable advisory information is `low`;
- repeated model agreement does not raise confidence by itself;
- user acceptance does not rewrite evidence confidence;
- Apply always revalidates regardless of displayed confidence.

## 12. Review workflow

The user-visible sequence is:

```text
Local recognition
→ reviewable local Draft
→ optional “Find omissions with AI”
→ AI request progress with provider/model shown
→ sanitized proposal results
→ combined review with source filters
→ explicit decisions
→ Apply
```

Source filters:

- `Local`;
- `AI proposals`;
- `Local candidates questioned by AI`;
- `Blocked AI suggestions` in diagnostics.

Visual language must not imply that AI proposals already exist in the apartment. Proposed geometry uses a distinct dashed treatment and a clear “AI suggestion” label. Blocked proposals do not render as normal candidates.

For a false-wall review suggestion, the action text must be explicit:

> AI considers this local line likely to be a sanitary/furniture symbol. Agreeing will reject the local Draft candidate; it will not remove an existing apartment wall.

## 13. Apply, Undo and Redo

Apply rules:

- local candidates and sanitized proposals may be accepted in one atomic batch;
- an accepted proposed opening can depend on a local wall accepted in the same batch;
- proposal-to-document IDs are generated deterministically from Draft ID and proposal ID;
- an already applied proposal is an idempotent no-op;
- a proposal with an unresolved or changed host is rejected before mutation;
- accepting a false-wall review suggestion only changes the ephemeral Draft decision and does not create a domain command;
- every actual geometry mutation participates in semantic Undo/Redo;
- repeated Apply, Undo and Redo must not duplicate or orphan openings.

## 14. Error handling and recovery

### Missing key or disabled provider

- local recognition remains available;
- the AI action explains that no provider is configured;
- no Draft fields are cleared.

### Timeout, provider error or rate limit

- stop the request;
- retain the local Draft and earlier proposal batch;
- append one safe diagnostic with provider/model and category, not raw secrets or full response bodies;
- allow an explicit retry.

### Invalid JSON or schema

- perform at most one bounded schema-repair attempt;
- if still invalid, reject the batch;
- do not partially parse prose or infer omitted coordinates.

### Stale reference or Draft

- reject the whole batch;
- explain that local recognition changed and AI must be run again;
- preserve the stale batch only as non-applicable diagnostic metadata if useful.

### Proposal overload

- reject the affected proposal category or entire batch according to the violated identity/budget rule;
- never truncate silently and treat the truncated result as complete.

### Apply-time conflict

- block the dependent proposal;
- do not partially create an orphan opening;
- leave unrelated independently valid accepted items eligible according to the existing atomic-batch policy selected in the implementation plan.

## 15. Security, privacy and cost controls

- `OPENROUTER_API_KEY` remains server-side or in explicit local developer configuration and is never serialized into the browser Draft;
- request and response logs redact authorization data;
- base64 image data and raw provider bodies are not written to ordinary logs;
- public CI uses only repository-owned redrawn analogues;
- private source images remain outside git and are used only with explicit local opt-in;
- provider workflow permissions remain read-only;
- live paid AI never runs automatically on pull requests;
- model, fixture, repetition, image, token, response-size and timeout limits are hard-coded and tested;
- no provider result promotes a benchmark baseline automatically;
- model substitution and fallback routing are reported explicitly;
- artifacts have bounded retention and contain sanitized proposal records rather than secrets.

## 16. Test strategy

Implementation follows strict RED → GREEN slices. No production path is added without focused failing contracts first.

### 16.1 Schema and model tests

Required tests:

- valid Stage 1 batch parses;
- unsupported schema version fails;
- duplicate proposal IDs fail;
- non-finite and out-of-range geometry fails;
- unknown reason code fails;
- unsupported Stage 2 proposal in Stage 1 fails;
- stale request ID, reference revision or Draft fingerprint rejects the batch;
- old Drafts migrate to empty proposal collections;
- proposal decisions cannot reference unknown proposals.

### 16.2 Provider adapter tests

Required tests:

- exact provider-neutral request is generated from source, overlay and local summary;
- secret is never present in serialized logs or errors;
- timeout and abort are handled;
- response-size and token budgets are enforced;
- one schema-repair attempt is allowed and no more;
- model/provider fallback metadata is explicit;
- invalid provider output never becomes a candidate.

### 16.3 Opening sanitizer tests

Positive contracts:

- missing door with one exact host and local leaf/gap evidence becomes eligible;
- missing window with one exterior host and rail/gap evidence becomes eligible;
- host hint may select among otherwise equivalent candidates only when deterministic geometry confirms it;
- normalized geometry snaps within tolerance while preserving raw geometry in evidence;
- duplicate AI and local opening collapses to a duplicate diagnostic.

Negative contracts:

- no host, unknown host, ambiguous two-host result;
- outside host span or insufficient end margin;
- unsupported width or orientation;
- no local gap/leaf/rail evidence;
- door proposed on window evidence and vice versa;
- text, dimension, furniture or sanitary-symbol false proposal;
- corner/junction conflict;
- overlap with existing opening;
- proposal count overload;
- provider confidence cannot bypass any validator.

### 16.4 False-wall review tests

Positive contract:

- short washbasin/sanitary contour with weak mask support and symbol evidence becomes an eligible advisory review suggestion.

Negative contracts:

- long structural wall remains protected;
- strongly mask-backed wall remains protected;
- two-anchor partition remains protected;
- unknown or geometrically changed target ID is rejected;
- accepting the suggestion changes only the Draft decision;
- no existing document wall is removed.

### 16.5 Stage 2 thin-wall tests

Positive contracts:

- thin balcony/loggia boundary with structural continuity and endpoint anchors becomes eligible;
- short thin partition with two valid anchors becomes eligible.

Negative contracts:

- window rail is not a wall;
- furniture edge is not a wall;
- dimension line is not a wall;
- detached micro-segment is blocked;
- duplicate and overlapping walls are blocked;
- long arbitrary AI wall is blocked;
- diagonal unsupported geometry is blocked.

### 16.6 Reconciliation and Draft tests

Required tests:

- local candidates are byte-equivalent before and after AI proposal reconciliation;
- eligible, blocked and duplicate proposals remain distinct;
- local and proposal decisions use separate namespaces;
- repeated identical batch is deterministic and idempotent;
- a changed local Draft invalidates old proposal decisions;
- provider failure preserves the prior local Draft and prior accepted decisions;
- no stale decisions remain after rerun.

### 16.7 Apply/history tests

Required tests:

- accepted proposed opening applies to an existing accepted wall;
- accepted wall and dependent proposed opening apply in one batch;
- unresolved host blocks the opening;
- second Apply does not duplicate geometry;
- two Apply batches undo and redo independently;
- proposal revalidation catches document changes between review and Apply;
- false-wall advisory acceptance creates no document mutation;
- rollback after a failed dependent proposal leaves the document consistent.

### 16.8 Browser tests

Chromium full-flow and WebKit representative tests must cover:

- local-only workflow without provider key;
- AI progress, cancellation and retry;
- source filters and distinct proposal styling;
- explanation of eligible and blocked proposals;
- explicit false-wall advisory action;
- Apply, Undo and Redo with a proposed opening;
- restored Draft with proposal metadata;
- narrow viewport and keyboard operation for the proposal review controls.

### 16.9 Deterministic benchmark tests

Pull-request CI uses recorded/fake provider batches and public redrawn analogues. It must measure:

- local wall and opening metrics unchanged from the current exact baseline unless intentionally improved;
- AI proposal precision and recall separately from local metrics;
- sanitizer acceptance precision;
- recovered missing door/window count;
- false proposal count;
- unknown-host eligible proposals = 0;
- outside-host eligible proposals = 0;
- direct geometry mutation count = 0;
- stale proposal decisions = 0;
- protected strong-wall false-rejection suggestions = 0;
- forbidden-region proposals and accepted candidates = 0;
- determinism across repeated recorded runs.

The corpus must include intentionally suppressed local ground truth so that AI omission recovery is tested rather than accidentally receiving already complete local candidates.

### 16.10 Manual live-model benchmark

The existing cost-bounded manual OpenRouter benchmark is extended to proposal mode. Qualification requires:

- at least three repetitions per selected fixture;
- representative doors, windows, sanitary clutter and later thin-wall cases;
- stable proposal identity after deterministic normalization;
- no schema, budget or security violation;
- measurable recall improvement after sanitation;
- acceptable false-proposal rate;
- reviewed latency and cost;
- no product default promotion from a single model run.

## 17. Acceptance gates

### 17.1 Stage 1 automated gates

- all existing Standard CI, Core and Source gates pass;
- current local-only predictions remain unchanged unless a separately reviewed local fix is included;
- eligible AI openings have 100% known valid hosts;
- eligible AI openings outside host span: 0;
- AI direct local-candidate mutations: 0;
- protected structural walls incorrectly eligible for rejection: 0;
- stale proposal decisions: 0;
- proposal sanitizer deterministic across repeated recorded runs;
- Apply/Undo/Redo proposal tests pass;
- Chromium full flow and WebKit representative flow pass.

A numerical proposal F1 threshold will be promoted only after the first reviewed recorded-provider baseline. Until then, scenario-specific gates are merge-blocking and no baseline may be weakened to make a pull request green.

### 17.2 Stage 1 product-owner gate on the current real plan

The product-owner retest must demonstrate:

- at least one previously missing real door is presented as an eligible AI proposal when supported by local evidence;
- missing visible windows are either presented as eligible proposals or explicitly blocked with a truthful validator reason;
- the extra washbasin wall is presented as an advisory false-wall review suggestion or is removed by an independent local fix;
- no existing local geometry moves after AI;
- no AI proposal is applied automatically;
- source and confidence are understandable in the UI;
- local-only Draft remains recoverable after AI failure;
- Apply, repeated Apply, Undo and Redo remain correct.

The thin balcony/loggia wall is not a Stage 1 acceptance requirement; it is the principal Stage 2 product gate.

### 17.3 Stage 2 gates

- current Stage 1 gates remain green;
- the known thin balcony/loggia wall is proposed and passes deterministic validation on the product-owner plan;
- window rails, furniture and dimensions do not become eligible walls;
- no arbitrary long or detached AI wall is eligible;
- topology, Apply and history remain consistent.

## 18. Delivery sequence

### Stage 0 — documentation and benchmark contract

- preserve this specification and the product-owner FAIL evidence;
- resolve milestone naming so recognition work does not collide with roadmap M7.9 Accessibility;
- add recorded proposal fixtures and scenario expectations before production behaviour.

### Stage 1A — proposal schema and provider-neutral request

- introduce new runtime proposal types and validators;
- add Draft migration defaults;
- generate labelled overlay and structured local summary;
- preserve existing verifier-only path behind a compatibility boundary during transition.

### Stage 1B — door/window sanitizer

- implement opening host selection, snapping, corroboration, dedupe and confidence caps;
- keep all Apply behaviour disabled until sanitizer tests pass.

### Stage 1C — local false-wall advisory

- implement exact-ID advisory proposals with structural protection rules;
- ensure accepting the advisory changes only Draft review state.

### Stage 1D — review UI and Apply integration

- expose source filters, evidence and blocked reasons;
- add proposal decisions and dependent Apply mapping;
- complete history and browser tests.

### Stage 1E — recorded and live benchmark

- run exact-head deterministic gates;
- manually run bounded OpenRouter comparisons;
- perform product-owner retest on the original plan;
- retain Draft status until explicit acceptance.

### Stage 2 — thin-wall proposals

- add the proposal type only after Stage 1 acceptance;
- implement balcony/loggia-first validation;
- expand benchmark and product acceptance separately.

### Stage 3 — connected proposal reconciliation

- considered only after Stages 1 and 2 provide evidence that isolated proposal validation is reliable;
- requires a separate design amendment before implementation.

## 19. Branch and merge strategy

- PR #42 remains unmerged and requires independent acceptance or an explicit decision to supersede it.
- PR #44 remains Draft and currently contains the real-fixture benchmark and recognition experiments.
- this design is committed to PR #44 because its evidence directly motivates the change;
- production implementation should use a dedicated stacked branch created from the reviewed exact PR #44 head after this specification is approved;
- no implementation commit is added before written-spec approval and an implementation plan;
- no PR is marked Ready or merged until automated gates and product-owner acceptance pass;
- protected squash merge remains mandatory;
- canonical `PROJECT_STATE`, `ROADMAP` and changelog updates occur only after accepted merge sequencing is resolved.

## 20. Observability and evidence

Every AI run records safe, bounded metadata:

- request ID;
- local Draft fingerprint;
- reference revision;
- provider and actual routed model;
- duration, token usage and estimated cost when available;
- proposal counts by type and sanitizer state;
- rejection reason counts;
- exact deterministic validator version;
- proposal result hash.

The UI exposes a user-readable subset. Benchmark artifacts contain the complete sanitized record. Raw secrets, authorization headers and private raster bytes are excluded.

## 21. Final design decision

The accepted product direction is:

> Local recognition supplies a conservative structural baseline. AI may discover omissions and question suspicious local candidates through separate proposals. Deterministic validation remains the only authority that can turn an AI suggestion into reviewable geometry, and the user remains the only authority that can Apply it.

Stage 1 will deliver doors, windows and false-wall advisory suggestions. Stage 2 will add narrowly validated thin walls. The system will prefer transparent omission over unsupported geometry and will never trade deterministic safety for a higher aggregate recall number.
