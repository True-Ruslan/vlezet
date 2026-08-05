# M7.8C.1 Hybrid AI Proposal Recovery — Design

Date: 2026-08-05  
Status: product direction approved; written specification pending final product-owner review  
Repository: `True-Ruslan/vlezet`  
Current integration branch: `feat/m7-9-real-fixture-ai-benchmark` / PR #44  
Related base: PR #42, M7.8C opening classification and host-wall validation  
Canonical slice label: **M7.8C.1 Hybrid AI Proposal Recovery**

The M7.8C.1 label avoids colliding with canonical roadmap milestone M7.9 Accessibility and Responsive Hardening. The existing branch name may remain until branch sequencing is resolved, but product documentation and PR metadata must use the canonical label before merge.

## 1. Decision

Vlezet will replace verification-only AI with a conservative hybrid recognition workflow:

1. the local engine builds a deterministic high-precision structural Draft;
2. AI may discover omissions and question suspicious local candidates;
3. every raw AI result is a separate untrusted proposal, never ordinary Draft geometry;
4. deterministic validation converts only sufficiently supported proposals into reviewable suggestions;
5. the user explicitly accepts or rejects suggestions;
6. only explicit Apply may mutate `VlezetDocument`, after full revalidation.

Delivery is staged:

- **Stage 1:** missing door/window proposals and exact-ID false-wall review suggestions;
- **Stage 2:** narrowly validated missing thin walls, initially balcony/loggia boundaries and short anchored partitions;
- **Stage 3:** bounded reconciliation of several connected proposals, requiring a separate design amendment.

This rejects both unsafe full-plan AI generation and the current architecture in which AI can only downgrade geometry that local recognition already found.

## 2. Product evidence

The product-owner retest on the current PR #44 result produced:

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

- only some doors were found;
- no windows were found;
- a sanitary symbol near the washbasin became an extra wall;
- the thin balcony/loggia wall was missed;
- AI recovered no missing geometry and mainly reduced confidence;
- the result was not materially better for the real plan.

The current code behaves this way by design: cloud results with unknown local IDs are rejected or deferred, and cloud geometry cannot change local coordinates. Therefore a model cannot recover an object absent from the local Draft.

The public analogue benchmark improved to wall F1 `0.839858` and opening F1 `0.750000`, but the real product flow still failed. The retest is recorded as a product acceptance failure, not an accepted limitation.

## 3. Goals

- preserve a deterministic local structural baseline;
- recover missing doors and windows through separately reviewable AI proposals;
- let AI identify a specific local candidate as likely sanitary/furniture clutter without deleting it;
- later recover narrowly scoped thin walls;
- expose provider origin, model confidence, deterministic confidence and validation reasons;
- keep all provider failures non-destructive;
- retain explicit review, Apply, Undo and Redo authority;
- measure local quality and AI-proposal quality independently.

A successful workflow must make four states visually and semantically distinct:

1. reliable local geometry;
2. uncertain local geometry;
3. eligible AI proposals that passed deterministic validation;
4. blocked AI proposals with explicit reasons.

## 4. Non-goals

The first delivery excludes:

- authoritative AI coordinates;
- full-plan AI generation;
- automatic deletion or movement of local candidates;
- automatic proposal acceptance;
- room faces, OCR labels or area reconciliation;
- door swing direction as a blocking acceptance criterion;
- arbitrary long or diagonal AI walls;
- perspective-photo reconstruction;
- live paid AI in pull-request CI;
- lowering any existing benchmark threshold or reviewed baseline.

## 5. Architectural invariants

1. `VlezetDocument` remains the only persistent apartment source of truth.
2. Raw provider output is never represented as `RecognitionWallCandidate` or `RecognitionOpeningCandidate`.
3. Raw proposals are runtime-only and cannot be applied.
4. Every batch is bound to the exact request ID, reference revision and local Draft fingerprint.
5. A stale revision or fingerprint rejects the entire batch.
6. AI cannot mutate local IDs, geometry, thickness, classification, host or decisions.
7. Every eligible opening has exactly one deterministically selected active host wall.
8. AI confidence alone never produces high confidence.
9. A false-wall suggestion remains advisory until the user explicitly changes the Draft decision.
10. Apply revalidates all accepted geometry against the current document and host mapping.
11. Provider errors leave the local Draft byte-equivalent except for append-only diagnostics.
12. Candidate, token, response-size and retry budgets fail closed.
13. No hidden provider or model substitution is allowed.
14. Local-only recognition remains fully usable without network access or a provider key.
15. Existing project schema, document migrations and ordinary apartment geometry remain unchanged until explicit Apply.

## 6. Components and responsibilities

### 6.1 Local recognition engine

Creates deterministic walls/openings and exposes bounded supporting evidence needed by the sanitizer:

- structural masks;
- active wall topology;
- window rail and door leaf/gap evidence;
- symbol-clutter evidence;
- plan bounds;
- exact candidate fingerprint.

It does not parse provider responses or use provider confidence.

### 6.2 AI request builder

Creates a provider-neutral request containing:

- the bounded original source image;
- an aligned overlay with stable candidate IDs;
- structured local candidates and compact evidence codes;
- plan bounds and coordinate convention;
- exact allowed proposal types and budgets;
- request ID, reference revision and Draft fingerprint;
- strict JSON schema.

It must state that text, dimensions, furniture and sanitary symbols are not walls, and that existing correct candidates must not be repeated as new geometry.

### 6.3 Provider adapter

- maps the provider-neutral request to OpenRouter or another provider;
- enforces provider/model identity, timeout and response limits;
- parses only the exact schema;
- returns an untrusted `AiProposalBatch`;
- records safe route, model, latency and usage metadata.

It cannot snap, reconcile or apply geometry.

### 6.4 Proposal sanitizer

The sanitizer is the only authority that may convert a raw AI proposal into a reviewable suggestion. It validates:

- schema and batch identity;
- supported proposal type;
- coordinate bounds and finite values;
- exact local target IDs;
- host selection and span;
- local raster evidence;
- topology, overlap and duplicate safety;
- confidence caps;
- proposal budgets.

It preserves raw and normalized evidence separately and emits an immutable `SanitizedRecognitionProposal` in state `eligible`, `blocked` or `duplicate`.

### 6.5 Proposal reconciliation

Adds sanitized proposals to separate Draft collections without changing local walls, openings or decisions. Proposal decisions have their own namespace and are invalidated when the reference or local Draft changes.

### 6.6 Review UI

The UI must distinguish:

- Local;
- Local + AI verification of immutable geometry;
- AI proposal;
- Local candidate questioned by AI;
- Blocked AI suggestion in diagnostics.

Eligible proposals use a distinct dashed treatment and explicit “AI suggestion” label. Blocked proposals never render as normal selectable geometry.

### 6.7 Apply adapter

Converts accepted sanitized proposals to ordinary domain commands only during Apply. It resolves hosts, reruns all validators, uses deterministic IDs, preserves idempotence and participates in semantic Undo/Redo.

## 7. Data contract

### 7.1 Raw provider batch

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

### 7.2 Stage 1 proposals

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

Reason codes are allow-listed. Free-form provider prose may be retained only as bounded diagnostic text and never drives validation.

### 7.3 Stage 2 proposal

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

The Stage 1 request and sanitizer reject this type.

### 7.4 Sanitized proposal

```ts
type SanitizedRecognitionProposal = Readonly<{
  id: string;
  rawProposalId: string;
  kind: "door" | "window" | "local-wall-review" | "thin-wall";
  state: "eligible" | "blocked" | "duplicate";
  geometry: SanitizedProposalGeometry | null;
  targetLocalCandidateId: string | null;
  hostWallCandidateId: string | null;
  provider: Readonly<{
    providerId: string;
    modelId: string;
    requestId: string;
  }>;
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

No AI-created proposal may be high confidence.

### 7.5 Draft integration

`RecognitionDraft` gains separate fields:

```ts
aiProposals: readonly SanitizedRecognitionProposal[];
proposalDecisions: Readonly<
  Record<string, "pending" | "accepted" | "rejected">
>;
aiProposalMetadata: RecognitionAiProposalMetadata | null;
```

Old Drafts migrate deterministically to empty proposal collections. Local `walls`, `openings` and `decisions` retain their existing meaning.

## 8. Request budgets

Stage 1 uses these default hard limits:

```text
opening proposals:              12
local-wall review proposals:    12
provider diagnostics:           20
source images:                   exactly 2
primary timeout:                 45 seconds
schema-repair timeout:           15 seconds
maximum attempts:                2 total
maximum response body:           96 KiB
maximum generated tokens:        4096
```

Attempt 2 is allowed only for schema repair. It receives the schema and a structural error summary, not a new image. It cannot change provider or model. Budget values are versioned configuration constants and covered by tests.

## 9. Deterministic validation

### 9.1 Batch validation

The whole batch is rejected for:

- unsupported schema;
- mismatched request ID, revision or Draft fingerprint;
- duplicate proposal IDs;
- category overload;
- unsupported proposal type;
- structurally invalid top-level response.

An independently malformed proposal is blocked while other valid proposals may continue only when batch identity and budgets remain valid.

### 9.2 Door proposal

A door is eligible only when:

- exactly one active host wall is selected deterministically;
- its centre and width fit the valid host span with the existing end margin;
- orientation and calibrated width are compatible;
- local evidence supports a bounded gap plus leaf, arc or equivalent door notation;
- structural support exists on required sides;
- no existing opening or eligible proposal overlaps it;
- it creates no corner or junction conflict;
- text, dimensions and sanitary/furniture notation do not explain it better.

Host hints only narrow search. They never override geometry.

### 9.3 Window proposal

A window is eligible only when:

- exactly one active exterior or balcony-compatible host is selected;
- centre and width lie within the valid host chain;
- local evidence supports a gap plus rails/frame or another versioned window contract;
- the evidence is not a door gap;
- no interior furniture/sanitary explanation dominates;
- duplicate, overlap and host checks pass.

An arbitrary unexplained gap cannot become a window from AI confidence alone.

### 9.4 False-wall review suggestion

The suggestion never removes or mutates a local wall. It is eligible only when:

- the exact target candidate still exists unchanged;
- the source region overlaps it;
- structural-mask support is weak or the candidate already has topology/symbol-clutter evidence;
- it lies inside the bounded clutter-review profile;
- it is not a long, strongly supported or two-anchor structural wall.

Strong deterministic wall evidence blocks the AI suggestion and explains why.

### 9.5 Thin-wall proposal

Stage 2 permits a wall only when:

- it follows a calibrated architectural axis;
- length and thickness match the versioned thin-wall profile;
- at least one endpoint connects to active structure and the other is anchored or mask-supported;
- evidence is continuous and not a window rail, furniture edge or dimension line;
- it is not detached, duplicate or topology-degenerate;
- balcony/loggia role agrees with exterior-boundary context.

Long arbitrary interior walls and unsupported diagonals remain forbidden.

## 10. Confidence policy

Two confidences are shown separately:

- provider `modelConfidence`;
- sanitizer `deterministicConfidence`.

Rules:

- insufficient local corroboration means blocked;
- eligible AI geometry is at most medium;
- partial advisory evidence is low;
- repeated model agreement alone never raises confidence;
- user acceptance does not rewrite evidence;
- Apply always revalidates.

## 11. Review and Apply semantics

User flow:

```text
Local recognition
→ local Draft review
→ optional “Find omissions with AI”
→ provider/model progress
→ sanitized proposal result
→ combined review with source filters
→ explicit decisions
→ Apply
```

For a false-wall suggestion the UI must state:

> AI considers this local line likely to be a sanitary or furniture symbol. Agreeing rejects only the local Draft candidate; it does not remove an existing apartment wall.

Apply is strictly atomic for geometry:

1. all accepted local geometry and accepted AI geometry are prevalidated against the current document;
2. dependent host mappings are resolved before any command executes;
3. if any accepted geometry item is invalid or stale, no geometry mutation occurs;
4. the UI identifies invalid items and asks the user to reject, correct or rerun them;
5. after a valid Apply, deterministic IDs make repeated Apply a no-op;
6. each successful Apply batch is one semantic Undo/Redo unit;
7. accepting a false-wall advisory creates no domain command.

This removes ambiguity about partial application and prevents orphan openings.

## 12. Error handling

### Missing key or disabled provider

Local recognition remains available. The AI action reports that no provider is configured and changes no Draft data.

### Timeout, rate limit or provider failure

The request stops, the local Draft and previous proposal batch remain intact, and one redacted diagnostic is appended. Retry is explicit.

### Invalid JSON or schema

At most one bounded schema-repair attempt is made. A second failure rejects the batch. Prose is never heuristically parsed into geometry.

### Stale Draft or reference

The batch is rejected in full and marked non-applicable. The user must rerun AI against the new local Draft.

### Overload

The affected batch is rejected. Results are never silently truncated and treated as complete.

### Apply conflict

No accepted geometry is applied. Invalid items are identified while the document remains unchanged.

## 13. Security, privacy and cost controls

- `OPENROUTER_API_KEY` remains server-side or in explicit local developer configuration;
- secrets, authorization headers, base64 images and raw provider bodies are excluded from ordinary logs;
- public CI uses repository-owned redrawn analogues only;
- private source rasters remain outside git and require explicit local opt-in;
- live paid AI never runs automatically on pull requests;
- provider workflows retain read-only repository permissions;
- model, image, token, response, retry and timeout limits are hard-coded and tested;
- model substitution and provider routing are reported explicitly;
- no result updates a baseline automatically;
- artifacts contain sanitized proposal records and bounded retention only.

## 14. Test strategy

Implementation uses strict RED → GREEN slices. No production path is added before its focused failing contracts.

### 14.1 Schema and migration tests

- valid Stage 1 batch parses;
- unsupported version fails;
- duplicate IDs fail;
- non-finite/out-of-range geometry fails;
- unknown reason code fails;
- Stage 2 type fails in Stage 1;
- stale request/revision/fingerprint rejects the batch;
- old Drafts migrate to empty proposal fields;
- proposal decisions cannot reference unknown proposals.

### 14.2 Request and provider tests

- request contains exactly source image, aligned overlay and structured summary;
- IDs and coordinate conventions are stable;
- secrets never appear in logs or errors;
- timeout, abort, response size and token limits are enforced;
- only one schema-repair attempt is allowed;
- model/provider identity is explicit;
- invalid output never becomes a candidate.

### 14.3 Door/window sanitizer tests

Positive:

- missing door with one host and leaf/gap evidence becomes eligible;
- missing window with one exterior host and rail/gap evidence becomes eligible;
- bounded snapping preserves raw geometry as evidence;
- duplicate of a local opening becomes `duplicate`.

Negative:

- missing, unknown or ambiguous host;
- outside host span or end margin;
- invalid width/orientation;
- absent local evidence;
- door/window evidence mismatch;
- text, dimension, furniture or sanitary false proposal;
- corner/junction conflict;
- opening overlap;
- overload;
- confidence cannot bypass validation.

### 14.4 False-wall advisory tests

Positive:

- the known washbasin/sanitary contour profile becomes an eligible advisory suggestion when mask and symbol evidence agree.

Negative:

- long structural wall protected;
- strongly mask-backed wall protected;
- two-anchor partition protected;
- unknown or changed target rejected;
- accepting advisory changes only the Draft decision;
- existing document walls remain untouched.

### 14.5 Thin-wall tests

Positive:

- thin balcony/loggia boundary with continuity and anchors becomes eligible;
- short thin partition with two anchors becomes eligible.

Negative:

- window rail, furniture edge and dimension line rejected;
- detached micro-segment rejected;
- duplicate/overlap rejected;
- long arbitrary or unsupported diagonal wall rejected.

### 14.6 Reconciliation tests

- local candidates remain byte-equivalent after AI reconciliation;
- eligible, blocked and duplicate states remain separate;
- local and proposal decisions cannot collide;
- identical batch is deterministic and idempotent;
- changed local Draft invalidates old decisions;
- provider failure preserves local state;
- rerun creates no stale decisions.

### 14.7 Apply and history tests

- proposed opening applies to an existing accepted wall;
- local wall and dependent proposal apply in one atomic batch;
- unresolved host blocks the entire geometry batch;
- repeated Apply creates no duplicates;
- two successful Apply batches Undo/Redo independently;
- document changes between review and Apply are detected;
- false-wall advisory creates no document mutation;
- failed prevalidation leaves the document byte-equivalent.

### 14.8 Browser tests

Chromium full flow and WebKit representative flow cover:

- local-only operation without a key;
- progress, cancellation and retry;
- source filters and distinct proposal visuals;
- eligible/blocked explanations;
- false-wall advisory wording and action;
- Apply, Undo and Redo with a proposed opening;
- restored Draft proposal metadata;
- keyboard and narrow-viewport operation.

### 14.9 Deterministic benchmark

Pull-request CI uses recorded provider batches and public analogues. It measures:

- local wall/opening metrics separately and unchanged unless explicitly improved;
- proposal precision and recall;
- sanitizer acceptance precision;
- recovered missing openings;
- false proposal count;
- eligible unknown-host openings = 0;
- eligible outside-host openings = 0;
- direct local mutation count = 0;
- stale proposal decisions = 0;
- protected strong-wall false advisory count = 0;
- forbidden-region eligible proposals = 0;
- determinism across repeated recorded runs.

Fixtures must intentionally suppress selected true local openings so omission recovery is actually tested.

### 14.10 Manual live-model benchmark

The cost-bounded OpenRouter benchmark runs manually with at least three repetitions per selected fixture. Qualification requires stable normalized proposals, no contract violation, measurable sanitized recall improvement, acceptable false-proposal rate, and reviewed latency/cost. No model becomes default from one run.

## 15. Acceptance gates

### 15.1 Stage 1 automated

- Standard CI, Core and Source gates pass;
- current local-only predictions remain unchanged unless a separate reviewed local fix is included;
- eligible AI openings have known valid hosts: 100%;
- eligible openings outside host span: 0;
- direct AI mutation of local candidates: 0;
- protected structural walls eligible for rejection: 0;
- stale proposal decisions: 0;
- recorded proposal replay is deterministic;
- atomic Apply/history tests pass;
- Chromium and WebKit gates pass.

A numerical proposal F1 threshold is promoted only after the first reviewed recorded-provider baseline. Scenario-specific safety gates are merge-blocking from the first implementation commit and cannot be weakened to make CI green.

### 15.2 Stage 1 product-owner retest

On the current real plan:

- at least one previously missing unambiguous door is recovered as an eligible proposal;
- at least one previously missing unambiguous window is recovered as an eligible proposal;
- every other product-owner-marked unambiguous window is either eligible or has a specific validator blocker reviewed by the product owner;
- the extra washbasin wall is identified by an eligible advisory suggestion or removed by an independently tested local fix;
- no local geometry moves after AI;
- no proposal applies automatically;
- proposal source, confidence and evidence are understandable;
- local Draft survives provider failure;
- Apply, repeated Apply, Undo and Redo remain correct.

This gate requires material improvement; returning only blocked explanations cannot count as Stage 1 acceptance.

The thin balcony/loggia wall is the main Stage 2 product gate, not a Stage 1 requirement.

### 15.3 Stage 2

- all Stage 1 gates remain green;
- the known thin balcony/loggia wall becomes an eligible validated proposal;
- window rails, furniture and dimensions do not become eligible walls;
- no arbitrary long, detached or unsupported diagonal wall is eligible;
- topology, atomic Apply and history remain consistent.

## 16. Delivery sequence

### Stage 0 — documentation and benchmark contract

- preserve product-owner FAIL evidence;
- adopt canonical M7.8C.1 naming;
- add recorded proposal fixtures and scenario expectations before changing production behaviour.

### Stage 1A — proposal schema and request

- add raw/sanitized proposal types and Draft migration defaults;
- add labelled overlay and structured summary;
- preserve verifier-only compatibility during transition.

### Stage 1B — opening sanitizer

- implement host selection, snapping, evidence validation, dedupe and confidence caps;
- keep proposal Apply disabled until all sanitizer contracts pass.

### Stage 1C — false-wall advisory

- implement exact-ID advisory proposals and structural protection rules;
- verify that advisory acceptance changes only Draft state.

### Stage 1D — UI and Apply

- expose sources, evidence and blocked reasons;
- add proposal decisions and atomic Apply mapping;
- complete history and browser tests.

### Stage 1E — benchmark and product retest

- run exact-head deterministic gates;
- run bounded live-model comparisons manually;
- retest the original plan;
- keep PR Draft until explicit acceptance.

### Stage 2 — thin walls

- add the new type only after Stage 1 acceptance;
- implement balcony/loggia-first validation;
- expand benchmark and acceptance independently.

## 17. Branch and merge strategy

- PR #42 remains unmerged and requires either independent acceptance or an explicit supersession decision;
- PR #44 remains Draft and contains the real-fixture evidence motivating this design;
- this specification is committed to PR #44;
- production implementation uses a dedicated stacked branch from the reviewed exact PR #44 head after specification approval;
- no implementation starts before a written implementation plan;
- no PR is marked Ready or merged before automated and product-owner acceptance;
- protected squash merge remains mandatory;
- `PROJECT_STATE`, `ROADMAP` and changelog update only after accepted merge sequencing is resolved.

## 18. Observability

Every run records bounded safe metadata:

- request ID;
- reference revision and Draft fingerprint;
- provider and actual routed model;
- duration, token usage and estimated cost when available;
- proposal counts by type/state;
- validator reason counts;
- validator version;
- deterministic result hash.

The UI exposes a readable subset. Artifacts contain sanitized records, not secrets or private raster bytes.

## 19. Final design statement

> Local recognition supplies a conservative structural baseline. AI may discover omissions and question suspicious local candidates through separate proposals. Deterministic validation remains the only authority that can turn an AI suggestion into reviewable geometry, and the user remains the only authority that can Apply it.

Stage 1 delivers doors, windows and false-wall advisory suggestions. Stage 2 adds narrowly validated thin walls. The system prefers a transparent omission over unsupported geometry and never trades deterministic safety for a higher aggregate recall number.
