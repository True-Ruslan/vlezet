# M4.5 — Assisted Recognition Design

**Date:** 2026-07-22  
**Status:** Approved design, implementation not started

## 1. Purpose

M4.5 adds assisted recognition on top of the existing calibrated reference-plan workflow.

The goal is not to let AI "draw the apartment" autonomously. The goal is to help the user reduce repetitive manual tracing while preserving the core product promise of Vlezet:

- geometry remains deterministic and editable;
- the user stays in control;
- recognition produces a reviewable draft, not irreversible changes;
- local processing is the default privacy-preserving baseline;
- cloud AI is an optional expert, not the geometry authority.

The feature should help a user go from:

```text
uploaded plan → calibrated reference → structured apartment geometry
```

with significantly less manual wall tracing, while remaining trustworthy enough for real apartment planning.

## 2. Product principles

M4.5 follows and extends existing Vlezet product principles.

1. **Recognition suggestions must remain editable.** Recognition output is always a draft.
2. **Deterministic geometry stays authoritative.** AI or CV suggestions never directly become the apartment model without validation.
3. **Local-first by default.** The first recognition pass should work offline in-browser on the user’s machine.
4. **Cloud is optional and explicit.** A cloud request is only made after the user opts in.
5. **Privacy is preserved by default.** The uploaded apartment plan is not sent anywhere unless the user explicitly chooses cloud assistance.
6. **Recognition must never silently overwrite existing geometry.** Conflicts are surfaced for review.
7. **Undo must remain meaningful.** Applying accepted suggestions is one semantic history action.

## 3. Scope

### 3.1 Included in M4.5

- local wall recognition from the calibrated reference raster;
- local opening hypotheses for likely doors and windows;
- confidence levels and diagnostics;
- persistent recognition session storage per project;
- review mode for inspecting, editing, accepting and rejecting suggestions;
- hybrid reconciliation of local recognition and optional cloud AI output;
- OpenRouter BYOK cloud provider;
- provider abstraction compatible with future managed Vlezet backend;
- atomic apply of selected suggestions to normal Vlezet entities;
- semantic undo/redo for the apply step;
- review-safe coexistence with existing manually created geometry.

### 3.2 Explicitly excluded from M4.5

- automatic one-click replacement of the apartment model;
- mandatory server-side processing;
- Vlezet-managed API billing or backend proxy;
- OCR-driven authoritative room dimensions;
- perspective correction for phone photos;
- non-plan images such as room photos;
- DWG/DXF/BIM parsing;
- training custom ML models;
- automatic final-room generation with no user review;
- multi-floor recognition;
- portable backup of unfinished recognition sessions.

## 4. User journeys

### 4.1 Local-only assisted recognition

1. User opens a project with a calibrated reference plan.
2. User clicks `Распознать план`.
3. Vlezet runs local recognition in a worker.
4. User sees a review draft with wall/opening candidates and diagnostics.
5. User accepts, edits or rejects suggestions.
6. User clicks `Применить выбранное`.
7. Vlezet applies validated suggestions to the apartment model.

### 4.2 Hybrid local + AI refinement

1. User runs local recognition first.
2. User sees the local draft summary.
3. User chooses `Проверить с AI`.
4. User enters OpenRouter API key and chooses a compatible vision model.
5. Vlezet sends the normalized plan image plus structured context.
6. Cloud output is reconciled with the existing local draft.
7. User reviews the enriched draft and applies selected suggestions.

### 4.3 Existing geometry present

1. User already traced some walls or openings manually.
2. User launches recognition.
3. Recognition results are compared against existing geometry.
4. Duplicates are ignored; conflicts are flagged.
5. Only safe, reviewed additions are applied.

## 5. High-level architecture

M4.5 introduces a new framework-independent package:

```text
packages/recognition
├── src/
│   ├── model/
│   ├── local/
│   ├── normalize/
│   ├── providers/
│   ├── reconcile/
│   ├── validate/
│   ├── apply/
│   └── session/
```

High-level flow:

```text
ReferencePlan asset
        │
        ├── Local recognizer (OpenCV.js + heuristics)
        │
        ├── Optional cloud provider (OpenRouter BYOK)
        │
        └── Reconciler
                │
         RecognitionDraft
                │
         Review / edit UI
                │
         Deterministic validator
                │
       ApplyRecognitionDraft command
                │
         Vlezet domain document
```

### 5.1 Layering rules

- `@vlezet/recognition` must not depend on React, Konva or Next.js.
- Browser-only APIs such as Workers, Blob and fetch stay in the web app adapter layer.
- Provider-specific HTTP logic stays behind provider interfaces.
- Recognition output is never persisted inside `VlezetDocument`.

## 6. Core recognition model

Recognition works with a draft model that is independent from the apartment document.

### 6.1 Coordinate system

Candidates are stored in **normalized reference-image coordinates**, not directly in world millimetres.

The canonical internal contract is:

```ts
export type NormalizedPoint = {
  x: number; // finite, inclusive range [0, 1]
  y: number; // finite, inclusive range [0, 1]
};
```

`(0, 0)` is the raster's top-left corner and `(1, 1)` is its bottom-right corner. Provider adapters may use another wire representation, such as integer coordinates `0..10000`, but must normalize it to `[0, 1]` before producing `RecognitionProviderResult`.

World-space conversion always uses the current `ReferencePlan` transform. Therefore:

- the draft stays aligned if the reference image is moved or rotated;
- AI does not become the metric authority;
- the same draft can be re-projected into world millimetres after viewport-independent reference display changes.

### 6.2 Draft entities

```ts
export type RecognitionDraft = {
  id: string;
  projectId: string;
  referenceAssetId: string;
  referenceRevision: string;
  engineVersion: string;
  status: 'local-complete' | 'cloud-complete' | 'reconciled' | 'applied';
  walls: RecognitionWallCandidate[];
  openings: RecognitionOpeningCandidate[];
  roomLabels: RecognitionRoomLabelCandidate[];
  diagnostics: RecognitionDiagnostic[];
  decisions: RecognitionDecisionMap;
  source: RecognitionSourceSummary;
  createdAt: string;
  updatedAt: string;
};
```

#### Wall candidate

```ts
export type RecognitionWallCandidate = {
  id: string;
  start: NormalizedPoint;
  end: NormalizedPoint;
  estimatedThicknessPx: number | null;
  confidence: 'high' | 'medium' | 'low';
  evidence: RecognitionEvidenceSummary;
  origin: 'local' | 'cloud' | 'merged';
  conflict: RecognitionConflictKind | null;
};
```

#### Opening candidate

```ts
export type RecognitionOpeningCandidate = {
  id: string;
  kind: 'door' | 'window' | 'unknown-opening';
  hostWallCandidateId: string | null;
  center: NormalizedPoint;
  widthPx: number | null;
  orientationDeg: number | null;
  confidence: 'high' | 'medium' | 'low';
  evidence: RecognitionEvidenceSummary;
  origin: 'local' | 'cloud' | 'merged';
  conflict: RecognitionConflictKind | null;
};
```

#### Room label candidate

```ts
export type RecognitionRoomLabelCandidate = {
  id: string;
  text: string;
  anchor: NormalizedPoint;
  confidence: 'high' | 'medium' | 'low';
  origin: 'cloud';
};
```

Room labels are optional metadata suggestions only. They do not create rooms.

### 6.3 User decisions

Each candidate has a user-review state:

```ts
export type RecognitionDecision =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'edited';
```

## 7. Local recognizer

### 7.1 Implementation direction

The local recognizer runs fully in-browser and is lazy-loaded.

Primary technology direction:

- OpenCV.js for raster operations and line extraction;
- worker-based execution so the UI stays responsive;
- heuristics written in TypeScript for post-processing and candidate building.

### 7.2 Input

The recognizer consumes the normalized calibrated raster produced by M4.

It does not re-open the original PDF or original source file.

### 7.3 Processing pipeline

```text
gray
→ contrast normalization
→ threshold / morphology
→ edge detection
→ Hough line segments
→ orientation clustering
→ parallel edge pairing
→ centerline hypotheses
→ collinear merge
→ junction reconstruction
→ opening-gap hypotheses
→ candidate confidence scoring
```

### 7.4 Wall recognition rules

The local recognizer should prefer structural walls and reject likely noise such as:

- dimension lines;
- furniture symbols;
- text underlines;
- extremely short detached line segments;
- isolated raster artifacts.

Wall candidates are built from evidence such as:

- repeated parallel edges;
- consistent thickness estimate;
- angular stability near horizontal/vertical axes;
- participation in junction topology.

### 7.5 Opening hypotheses

Openings are treated as **hypotheses** rather than authoritative detections.

The local recognizer may identify likely doors and windows from patterns such as:

- breaks in wall edge pairs;
- door arc shapes;
- narrow aligned gaps within a host wall;
- window-like cut patterns.

Low-confidence opening candidates remain visible but require explicit review.

### 7.6 Local confidence levels

Local confidence is coarse and product-facing:

- `high` — strong geometric evidence;
- `medium` — likely but should be reviewed;
- `low` — tentative suggestion, keep disabled by default for bulk accept.

## 8. Optional cloud recognition

### 8.1 Product posture

Cloud recognition is optional and opt-in.

The user must explicitly choose it after local recognition or from the recognition panel.

### 8.2 First provider strategy

The first cloud provider is:

```text
OpenRouterDirectProvider
```

This provider uses a user-supplied API key (BYOK).

### 8.3 Provider abstraction

```ts
export interface RecognitionProvider {
  id: string;
  displayName: string;
  canUseStructuredOutput(modelId: string): Promise<boolean>;
  canUseVision(modelId: string): Promise<boolean>;
  recognize(
    input: RecognitionProviderInput,
    signal: AbortSignal,
  ): Promise<RecognitionProviderResult>;
}
```

Future provider:

```text
ManagedVlezetProvider
```

The rest of the recognition engine must not need changes when switching from BYOK to a managed backend.

### 8.4 API key handling

BYOK requirements:

- key is entered explicitly by the user;
- key is not written to `VlezetDocument`;
- key is not written to `.vlezet.json`;
- key is not stored in IndexedDB;
- key is not logged;
- key lives only in runtime memory for the current page session.

### 8.5 Cloud input

The cloud provider receives:

- normalized plan raster;
- reference metadata such as image width/height;
- optional local recognition summary to guide the model;
- explicit structured-output schema.

The cloud provider does **not** receive any secret project history or arbitrary user content beyond what is necessary for recognition.

### 8.6 Cloud output requirements

Cloud output must be structured JSON conforming to a schema.

It may suggest:

- walls;
- openings;
- room labels.

It must not claim authoritative metric lengths.

Provider output coordinates must be normalized by the adapter into the canonical `[0, 1]` image-space contract before reconciliation.

### 8.7 Model selection

The UI should filter to models that support:

- image input;
- structured output.

A recommended default may be provided, but users can select compatible models.

## 9. Reconciliation

The recognizer’s most important control layer is reconciliation.

### 9.1 Purpose

Local CV and cloud AI may disagree. Reconciliation merges and grades suggestions rather than blindly picking one source.

### 9.2 Inputs

- local draft;
- optional cloud result;
- existing apartment geometry;
- current reference transform.

### 9.3 Responsibilities

- detect duplicate or near-duplicate wall candidates;
- merge agreeing candidates;
- downgrade unsupported cloud-only candidates;
- flag topology conflicts;
- compare against existing walls/openings;
- retain evidence provenance.

### 9.4 Output semantics

Candidate origin after reconciliation:

- `local` — only local evidence;
- `cloud` — only cloud evidence;
- `merged` — both systems support it.

Confidence can be raised or lowered by reconciliation.

### 9.5 Existing-geometry safety

If a candidate approximately matches existing geometry, it is not re-applied.

If it conflicts with existing geometry, it is flagged for review and not auto-accepted.

## 10. Review mode UX

Recognition introduces a dedicated review mode rather than mutating the apartment immediately.

### 10.1 Visual language

Suggested default meaning:

- green — high confidence / ready to accept;
- yellow — review recommended;
- red — conflict or invalid candidate;
- gray — rejected or hidden.

### 10.2 Review actions

The user can:

- select a candidate;
- inspect evidence/confidence;
- accept candidate;
- reject candidate;
- edit wall endpoints;
- reclassify opening type where allowed;
- delete false suggestions;
- accept all high-confidence candidates;
- filter by category or confidence.

### 10.3 Mode behavior

While in review mode:

- normal apartment geometry remains visible;
- recognition overlays are separate from the real document;
- user edits affect the draft, not the apartment document;
- `Esc` leaves sub-actions but does not silently discard the session.

### 10.4 Exit behavior

The user can:

- close the review and keep the draft for later;
- discard the draft entirely;
- apply accepted candidates.

## 11. Deterministic validation and apply

### 11.1 Validation before apply

Before converting accepted candidates into apartment entities, Vlezet runs deterministic validation.

Checks include:

- normalized candidate integrity;
- transform projection into world coordinates;
- minimum segment lengths;
- duplicate candidate collapse;
- host-wall matching for openings;
- ambiguous topology detection;
- overlap/conflict with existing geometry.

Unsupported or invalid candidates should fail visibly rather than silently apply incorrect geometry.

### 11.2 Apply command

Application happens via one semantic command:

```text
ApplyRecognitionDraft
```

This command:

1. transforms accepted candidates into world millimetres;
2. canonicalizes them into normal wall/opening inputs;
3. merges them with the existing apartment document;
4. writes resulting entities through normal domain/editor-core operations.

### 11.3 Undo/redo

The entire apply step is one history entry.

One `Undo` removes the whole applied recognition batch.

## 12. Recognition session persistence

Recognition work may take time and must survive reload.

### 12.1 Separate persistence

Recognition sessions are stored outside the apartment document.

New IndexedDB store direction:

```text
recognitionSessions
```

### 12.2 Session record

```ts
export type RecognitionSessionRecord = {
  id: string;
  projectId: string;
  referenceAssetId: string;
  referenceRevision: string;
  engineVersion: string;
  draft: RecognitionDraft;
  cloudMetadata: RecognitionCloudMetadata | null;
  createdAt: string;
  updatedAt: string;
};
```

### 12.3 Reference revision and stale semantics

A recognition session stores a deterministic `referenceRevision` derived from recognition-relevant input, at minimum:

- normalized reference raster identity/content revision;
- calibration scale/orientation inputs used by recognition thresholds.

The following do **not** invalidate a session because draft coordinates stay in reference-image space:

- viewport pan/zoom;
- reference opacity;
- reference visibility;
- reference world translation;
- reference display rotation.

Replacing the raster or materially changing calibration creates a new `referenceRevision`. A session whose revision no longer matches is marked `stale` and cannot be applied until recognition is rerun. It remains viewable or discardable so no work disappears silently.

### 12.4 Persistence and backup rules

- API keys are never persisted;
- local IndexedDB sessions survive reload;
- unfinished recognition sessions are **not** included in `.vlezet.json` portable backups in M4.5;
- portable backups continue to include the project/reference asset required to rerun recognition after import;
- applied sessions may be deleted automatically after a successful apply or retained temporarily for diagnostics, but they are never part of the domain document.

## 13. Performance strategy

### 13.1 Worker execution

Local recognition runs in a Web Worker.

The main thread remains responsible for:

- canvas rendering;
- user input;
- progress updates;
- review UI.

### 13.2 Lazy loading

Recognition dependencies such as OpenCV.js load only when recognition is first used.

### 13.3 Progressive processing

The worker reports explicit phases such as:

- preparing image;
- extracting lines;
- building wall candidates;
- finding openings;
- finalizing draft.

Progress percentages may be approximate, but phase ordering must be deterministic and cancellation-safe.

## 14. Error handling

Recognition errors are product states, not crashes.

### 14.1 Local errors

Examples:

- no usable reference plan found;
- reference is not calibrated;
- not enough structural lines detected;
- worker initialization failed;
- OpenCV failed to load.

### 14.2 Cloud errors

Examples:

- invalid API key;
- insufficient OpenRouter funds;
- selected model lacks image support;
- selected model lacks structured output support;
- timeout;
- rate limit;
- malformed model response;
- user cancelled request.

### 14.3 Product behavior

Failures must not damage the current project or existing recognition session.

The user should always retain a fallback path:

- retry locally;
- try cloud;
- continue manual tracing.

## 15. Security and privacy

- Local recognition should never upload the reference plan.
- Cloud recognition requires explicit opt-in every time it is used.
- Vlezet must clearly communicate that cloud AI sends the plan image to the selected provider.
- BYOK credentials are ephemeral runtime state only.
- The backup format must not include secrets.

## 16. Testing strategy

### 16.1 Unit tests

Highest priority:

- recognition model validation;
- normalized-coordinate boundary validation;
- local candidate post-processing;
- reconciliation rules;
- image-space to world-space transform application;
- apply validation;
- provider schema parsing/normalization;
- session persistence and stale detection.

### 16.2 Integration tests

Critical flows:

- local recognition draft creation;
- accept/reject/edit draft candidates;
- apply accepted candidates and undo;
- existing geometry conflict detection;
- project reload restores a compatible recognition session;
- raster/calibration revision change marks a session stale;
- portable backup excludes unfinished recognition sessions but preserves the reference asset needed to rerun recognition.

### 16.3 Browser tests

Later Playwright coverage should include:

- run local recognition on a sample plan;
- review and apply suggestions;
- enter OpenRouter key and run cloud refinement;
- cancel cloud step and continue with local draft.

## 17. Implementation milestones

### M4.5.1 — Local wall recognition foundation

- `@vlezet/recognition` package;
- session persistence;
- worker bootstrapping;
- local wall candidate extraction;
- review mode for wall candidates only.

### M4.5.2 — Openings and apply

- opening hypotheses;
- deterministic validation;
- apply command;
- undo/redo integration.

### M4.5.3 — Cloud refinement

- provider abstraction;
- OpenRouter BYOK provider;
- structured-output parsing;
- reconciliation between local and cloud results.

### M4.5.4 — UX hardening

- bulk accept flows;
- diagnostics polish;
- stale session handling;
- acceptance checklists;
- production-ready error messaging.

## 18. Acceptance criteria

M4.5 is complete when:

1. A user can run local recognition on a calibrated plan and receive a persistent editable draft.
2. The draft can be reviewed, edited, accepted and rejected without mutating the apartment prematurely.
3. Applying accepted suggestions creates normal Vlezet walls/openings and can be undone in one action.
4. Existing geometry is preserved and conflicts are surfaced.
5. A user can optionally run OpenRouter BYOK refinement without storing their API key.
6. AI output is parsed as structured data, reconciled, reviewed and then applied through the same deterministic validation path.
7. Recognition sessions survive reload while their reference revision is compatible, and stale sessions cannot be applied.
8. The project remains usable and safe even if local or cloud recognition fails.

## 19. Future evolution

This design intentionally leaves room for:

- a managed Vlezet cloud provider;
- OCR-assisted but non-authoritative dimension hints;
- recognition of symbols beyond doors/windows;
- adaptive tunable local-recognition sensitivity;
- eventual ensemble or multi-pass recognition strategies.

Those future layers must still preserve the same rule:

> recognition creates editable suggestions; deterministic geometry remains the source of truth.
