# M7.9 Real Fixture Dataset and AI Benchmark Foundation — Design

Date: 2026-08-04
Current base branch: `feat/m7-8c-opening-classification-host-wall-validation`
Current base head: `82360b6d802c4f4ddff5956f4a9ddfcf6fa0d53d`
Target implementation branch: `feat/m7-9-real-fixture-ai-benchmark`
Status: design approved in principle by product owner; implementation must remain separate from PR #42

## 1. Context

Repeated product-owner tests show that the current recognition development loop is too dependent on individual screenshots and local visual judgement. A correction may improve one plan while leaving another unchanged or introducing a different failure. The existing nine-fixture corpus is useful but does not represent the observed real plans closely enough:

- thin balcony and loggia walls;
- mixed thick and thin external walls;
- window rails inside heavy exterior walls;
- door leaves and arcs in several drawing conventions;
- sanitary and kitchen symbols connected to real walls;
- irregular footprints;
- multiple wet zones;
- portrait, landscape and diagonally rotated plans;
- labels and large room-number typography;
- disconnected structural components caused by openings.

The product owner supplied twelve additional real plan images and explicitly requested that all of them be preserved as test inputs and used to restructure local and AI recognition development.

## 2. Chosen approach

### Recommended and selected: hash-anchored private sources plus public redrawn analogues

The repository is public and its existing benchmark policy prohibits committing privately supplied source rasters. The original plans may also have third-party copyright or listing provenance that is not established. Therefore the implementation will use two layers:

1. **Private source inventory** — immutable source IDs, SHA-256 digests, dimensions, categories and annotation state. No original raster bytes are committed to the public repository.
2. **Public redrawn analogue corpus** — repository-owned deterministic vector reconstructions that reproduce the architectural geometry, drawing conventions and known failure modes without original labels, metadata or raster pixels.

This approach gives reproducible CI while respecting the existing privacy/provenance boundary.

### Rejected: commit the original images to the public repository

Rejected because explicit redistribution rights are not established and the current benchmark policy forbids original privately supplied regression sources.

### Rejected: run CI directly against external private URLs

Rejected because URLs expire, external storage adds availability and credential dependencies, and results would not be reproducible from the repository alone.

### Deferred: encrypted original corpus committed to the repository

Deferred because it would require a separate encryption key, rotation policy, decryption tooling and incident process. It is unnecessary for the first benchmark foundation because redrawn analogues can reproduce the required geometry and failure taxonomy.

## 3. Immutable private source inventory

The following twelve sources were supplied in one product-owner batch. The aliases below identify the current session files only; the SHA-256 digest is the canonical identity.

| Source ID | Session alias | Dimensions | SHA-256 | Primary tags |
|---|---|---:|---|---|
| `real-plan-001` | `photo_2026-07-22 01.10.07(3).jpeg` | 1177×884 | `c9ed200640c13770821947a5d3628e357e7400679dd6bb174e2a52a6c0f2f9ef` | landscape, one-room, loggia, service-block, windows, doors, current-regression |
| `real-plan-002` | `image(64).png` | 818×1270 | `bd89ecb927d9c7d8bea0273c3124cbd30a7a62a156b8ff4903aca10aad753527` | portrait, studio, balcony, sanitary-heavy, entrance-door |
| `real-plan-003` | `image(65).png` | 936×646 | `39e5b58fbf0e980e85f1e45f80376bdfa548c05c0a45e0d40a92721fb4f2d950` | landscape, studio, exterior-window, sanitary-block, label-heavy |
| `real-plan-004` | `image(66).png` | 1026×1174 | `ddead2d9bcde29d4ad5b858327f0578ab5257fa2485aa031062ec60721d0d83f` | portrait, one-room, multiple-doors, balcony, mixed-wall-thickness |
| `real-plan-005` | `image(67).png` | 1108×888 | `7d73b9995b1fed6080e83b125c19c641bbb2da31b5fb3754ce773126509c202a` | landscape, one-room, loggia, thick-walls, sanitary-heavy |
| `real-plan-006` | `image(68).png` | 1148×848 | `6f275e4c9ac2264287988d7528fb43960ed676ba7e0f1a979f246a06436314b2` | landscape, one-room, loggia, openings-heavy, wet-zone |
| `real-plan-007` | `image(69).png` | 940×710 | `b84719058cbd82b02ac7b223789158b8ba956d9b530bba8d2a85e26037f61ec5` | landscape, two-room, balcony, service-block, windows |
| `real-plan-008` | `image(70).png` | 1502×1488 | `5cf1f7e6368c5ec5ccd6fe1955d8c6e1e5f00166158e4e6e4a03f29233f4499e` | diagonal, two-room, rotation-invariance, balcony, multiple-wet-zones |
| `real-plan-009` | `image(71).png` | 1002×838 | `15f9a6e6c9e27f17b3928fb27d3bbda9e424ce2a4640668f6d5f4521680b3d17` | landscape, two-room, balcony, two-service-blocks, openings-heavy |
| `real-plan-010` | `image(72).png` | 1084×1316 | `d4b53a310d8d2be1822d1ba3e0320e3b915cb504caa93cd88f9fdcf4acb91b19` | portrait, two-room, multiple-balconies, windows-heavy, irregular-footprint |
| `real-plan-011` | `image(73).png` | 1578×1340 | `66f9f51a331384574ac5cabf77d98c3a9a0e302c006c4f31961f9cc610b9d968` | landscape, two-room, irregular-footprint, multiple-wet-zones, window-heavy |
| `real-plan-012` | `image(74).png` | 1424×990 | `54ef43f094dd54eb1947e21a4623b11ff104812f87653c160c34849df9733203` | landscape, two-room, openings-heavy, windows-heavy, two-wet-zones |

The implementation will add a machine-readable `private-source-manifest.json` containing these entries. It records no secret, URL, personal data or binary raster.

## 4. Corpus structure

The existing `recognition-corpus-v1` remains unchanged for PR #42. M7.9 introduces a separate versioned corpus layer rather than silently changing the current baseline.

```text
packages/recognition/benchmarks/
  fixtures/                         # existing corpus v1
  real-analogues/
    private-source-manifest.json    # hashes and metadata only
    analogue-manifest.json          # public fixture IDs and source links by digest
    source-definitions.mjs          # repository-owned vector definitions
    fixtures/
      real-plan-001-anonymized/
        source.png
        source.sha256
        fixture.json
        segments.json
        failure-expectations.json
      ...
      real-plan-012-anonymized/
```

### Private source manifest schema

```json
{
  "schemaVersion": "recognition-private-source-manifest-v1",
  "batchId": "product-owner-real-plans-2026-08-04",
  "sources": [
    {
      "sourceId": "real-plan-001",
      "sha256": "...",
      "widthPx": 1177,
      "heightPx": 884,
      "mediaType": "image/jpeg",
      "tags": ["landscape", "current-regression"],
      "annotationStatus": "registered",
      "redistribution": "not-committed"
    }
  ]
}
```

### Public analogue provenance

Every public analogue must declare:

- `kind: "redrawn-anonymized"`;
- the matching private `sourceId` and SHA-256 digest;
- a note that geometry and failure characteristics were manually reconstructed;
- no original text labels, development names, apartment identifiers or raster pixels;
- a repository-owned generated source raster and digest.

## 5. Annotation and ground-truth model

Each analogue fixture must contain complete ground truth for the metrics that are visually determinable:

- wall centerlines and physical thickness;
- wall kind: external, partition, balcony/loggia boundary or unknown structural;
- junctions and disconnected structural components;
- doors and windows with host wall, center and width;
- opening classification and optional swing only when unambiguous;
- room polygons where topology is complete;
- negative regions and forbidden false positives;
- known ambiguity declarations.

### Failure expectations

A new `failure-expectations.json` complements generic F1 scoring. It encodes scenario-specific assertions that aggregate metrics can hide.

```json
{
  "schemaVersion": "recognition-failure-expectations-v1",
  "mustDetect": [
    { "kind": "wall", "id": "balcony-thin-wall" },
    { "kind": "window", "id": "living-window-1" }
  ],
  "mustNotDetectRegions": [
    { "id": "kitchen-sink-symbol", "kind": "wall", "polygonNormalized": [] },
    { "id": "toilet-service-symbols", "kind": "wall", "polygonNormalized": [] }
  ],
  "knownAmbiguities": []
}
```

`mustNotDetectRegions` prevents a high aggregate F1 from masking repeated furniture or sanitary false positives.

## 6. Annotation workflow

The initial implementation will provide a local annotation command and review output instead of hand-editing large JSON files without validation.

```text
pnpm benchmark:recognition:real:annotate --source real-plan-001
pnpm benchmark:recognition:real:render --fixture real-plan-001-anonymized
pnpm benchmark:recognition:real:verify
```

The first command imports a local source path from an ignored directory, verifies its digest against the private manifest, runs the current local engine to create a starting Draft and writes an uncommitted annotation workspace. The product-safe public output is generated only from reviewed vector ground truth.

Original files are expected locally under:

```text
.local/recognition-private-sources/
```

This path must be covered by `.gitignore`, secret scanning tests and fixture verification.

## 7. Benchmark layers

### Layer A — mandatory deterministic real-analogue gate

Runs on relevant pull requests and contains no network or secret dependency.

Checks:

- schema and provenance validation;
- deterministic regeneration and source hashes;
- Core line-evidence benchmark;
- Chromium/OpenCV Source Benchmark;
- per-fixture failure expectations;
- no regression against explicit reviewed baseline;
- no unknown-host accepted openings;
- no stale decisions;
- no incorrect high-confidence candidates;
- no original private source bytes or digest-matching files committed accidentally.

### Layer B — manual and scheduled AI benchmark

A separate workflow uses `OPENROUTER_API_KEY` from GitHub Actions Secrets.

Triggers:

- `workflow_dispatch`;
- optional weekly schedule after the first stable baseline;
- never automatically for every pull request.

Inputs:

- model IDs as a bounded comma-separated list;
- fixture subset;
- repetition count, default 3 and maximum 5;
- mode: full-plan verification or disputed-zone crops;
- maximum fixture count and maximum generated tokens.

The workflow must fail closed when the secret is absent and must never print request headers, secret values or raw provider payloads containing sensitive data.

### Layer C — local private-source exploratory benchmark

Runs only on a developer machine against `.local/recognition-private-sources/`. It compares the real private raster with its redrawn analogue and helps ensure that the analogue preserves the target failure characteristics. It is informative and never required for public CI.

## 8. AI benchmark contract

AI remains a verifier, not geometry authority.

For each model, fixture and repetition the harness records:

- model ID and provider route metadata returned by OpenRouter;
- exact local Draft hash;
- candidate confirmation/rejection decisions;
- door/window classification changes;
- confidence changes;
- unsupported candidate confirmation rate;
- false downgrade rate;
- valid host-wall rate;
- latency;
- token usage and estimated cost when available;
- response-schema failures and timeout status.

The harness rejects any response that:

- creates an unknown candidate ID;
- changes wall coordinates or thickness;
- changes opening center, width or host wall;
- introduces cloud-only geometry;
- omits the required JSON schema contract;
- exceeds bounded response size or timeout.

### Model selection policy

No model becomes the product default from a single run. Qualification requires:

- at least three repeated runs per fixture;
- a minimum representative subset covering all major tags;
- stable decisions across repetitions;
- no safety-contract violations;
- improvement over local-only review precision without unacceptable recall loss;
- reviewed cost and latency ceiling.

Gemini 2.5 Flash is recorded as the first baseline profile because it was used in product testing. It is not considered qualified.

## 9. Metrics and acceptance targets

M7.9 is a benchmark-foundation milestone, not a claim that recognition is solved.

### Dataset acceptance

- exactly 12 private source records with matching SHA-256 and dimensions;
- exactly 12 public analogue definitions linked one-to-one to source digests;
- deterministic generated assets and immutable hashes;
- every fixture has walls, openings or an explicit non-applicable metric declaration;
- every fixture has at least one scenario-specific failure expectation;
- all original private rasters remain absent from git history and generated artifacts.

### Harness acceptance

- public deterministic benchmark runs without secrets;
- AI benchmark is manually dispatchable using `OPENROUTER_API_KEY`;
- missing secret produces a clear skipped/fail-closed result without leaking data;
- AI results are stored as artifacts and never silently update baselines;
- per-model, per-fixture and aggregate reports are generated;
- budget, timeout and repetition bounds are enforced;
- benchmark code has unit tests for scoring, sanitization and secret-safe logging.

### Recognition quality policy after foundation

Subsequent local recognition changes must demonstrate improvement or neutrality across:

- wall geometry F1;
- wall topology F1;
- door F1;
- window F1;
- forbidden-region false-positive count;
- thin-wall recall;
- thick-wall duplicate count;
- unknown-host count;
- incorrect high-confidence count.

No aggregate improvement may hide a regression in a designated critical fixture expectation.

## 10. Branch and PR strategy

PR #42 remains the M7.8C implementation and product retest PR. M7.9 must not add thousands of dataset/benchmark lines to it.

The intended structure is a stacked branch:

```text
main
  └─ feat/m7-8c-opening-classification-host-wall-validation  # PR #42
      └─ feat/m7-9-real-fixture-ai-benchmark                 # new Draft PR
```

The M7.9 PR initially targets the M7.8C feature branch. After PR #42 is accepted and merged, M7.9 is rebased or retargeted to `main` without changing benchmark evidence.

The GitHub connector rejected automatic branch creation during this design step. No branch or implementation mutation was made. Branch creation will be retried after written-spec approval; if the connector remains blocked, the specification will include exact local Git commands for the product owner rather than force-updating an existing ref.

## 11. Security and cost controls

- `OPENROUTER_API_KEY` exists only in GitHub Actions Secrets and local environment variables;
- secrets are never accepted as workflow inputs;
- fork pull requests cannot access the secret or trigger paid AI jobs;
- AI workflow permissions are `contents: read` only;
- no provider response is committed automatically;
- maximum models, fixtures, repetitions, response tokens and timeout are hard-coded;
- raw images sent to AI are public redrawn analogues in CI, not private originals;
- private-source local mode requires explicit command-line opt-in;
- logs redact bearer tokens and truncate provider error bodies;
- artifacts have bounded retention;
- baseline promotion is a separate reviewed commit.

## 12. Error handling

- digest mismatch: stop before annotation or inference;
- missing private source: list exact source IDs still unavailable locally;
- invalid public analogue: fail fixture verification;
- ambiguous ground truth: mark the metric non-applicable or declare known ambiguity; do not guess;
- OpenRouter timeout/rate limit/provider failure: record the run as failed, preserve local-only result and continue other bounded matrix entries;
- schema-invalid AI response: reject entirely and record a sanitizer failure;
- cost/fixture/repetition limit exceeded: reject workflow configuration before making requests;
- benchmark regression: preserve overlays and reports, fail the gate and never update baseline automatically.

## 13. Implementation decomposition

This design is intentionally split into independently reviewable increments:

1. **M7.9A — Private inventory and corpus schemas**
   - manifest with all 12 source hashes;
   - schema validation;
   - ignored local source directory;
   - provenance and accidental-source leak checks.
2. **M7.9B — Annotation and redrawn analogue tooling**
   - annotation workspace format;
   - deterministic renderer;
   - first priority fixtures, then all twelve;
   - failure expectations.
3. **M7.9C — Deterministic real-analogue benchmark gate**
   - scoring extensions;
   - per-fixture critical assertions;
   - baseline and evidence.
4. **M7.9D — OpenRouter AI benchmark harness**
   - manual workflow;
   - model matrix and repetitions;
   - cost/latency/safety reports;
   - secret-safe artifacts.
5. **M7.10 — Local recognition pipeline revision**
   - changes driven by measured failure clusters rather than screenshot-specific thresholds.

## 14. Out of scope

- making AI the primary geometry generator;
- committing the supplied original images to the public repository;
- automatically selecting a production AI model before benchmark qualification;
- automatically updating benchmark baselines;
- room OCR and area reconciliation beyond fixture metadata needed for later milestones;
- training a custom neural network in M7.9;
- merging PR #42 without its own product acceptance.
