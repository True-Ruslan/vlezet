# M7.0 Product and UX Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a complete, evidence-backed audit of the current Vlezet product and a dependency-aware UX redesign roadmap without changing product behaviour or trusted geometry/persistence authority.

**Architecture:** M7.0 is documentation-first. Source inspection and representative browser walkthroughs feed one canonical finding ledger, which then drives the target information architecture, interaction model, design-system foundation, terminology, accessibility requirements and implementation roadmap. A small repository validation script keeps the audit package complete, internally linked and free of unresolved placeholders.

**Tech Stack:** Markdown, Node.js 22+, pnpm 11.15.1, Turbo, Next.js 16, React, TypeScript, existing Vitest/ESLint/build pipeline, Chromium/Yandex Browser and Safari manual review.

## Global Constraints

- Do not change `VlezetDocument`, domain schema, migrations, IndexedDB, project file format, backup/import/export or geometry semantics.
- Do not implement redesign UI in M7.0; product code changes are limited to non-product documentation validation tooling.
- Do not add cloud, accounts, collaboration, autonomous AI, photorealism or direct 3D editing.
- Preserve local-first core editing and optional, reviewable AI/CV assistance.
- Treat Canvas and Three.js as projections, never geometry or measurement authority.
- Keep Preview temporary and Apply explicit wherever the current product already uses that contract.
- Use stable finding IDs, explicit evidence, acceptance criteria and recommended implementation slices.
- Target desktop-first editing. Required browser evidence covers Chromium/Yandex Browser on macOS or Windows and Safari core-editing regression on macOS.
- Required viewport review: 1920×1080 at 100% and 125%; 1440×900 at 100% and 125%; 1366×768 at 100%; 1280×800 at 100%; narrower widths for graceful limitation.
- Review browser zoom at 100%, 125%, 150% and 200% for accessibility and reachability.
- Target WCAG 2.2 AA for applicable web UI, without claiming formal conformance until separately verified.
- Do not promise mobile-first editing. Narrow layouts must avoid horizontal escape and unreachable controls.
- Do not preselect the first redesign implementation slice before the accepted audit and prioritisation gate.

## File Structure

### Create

- `scripts/validate-m7-docs.mjs` — verifies required audit files, journey IDs, finding structure, uniqueness and roadmap coverage.
- `docs/product/PRODUCT_VISION.md` — product purpose, users, value proposition and non-negotiable trust principles.
- `docs/product/USER_JOURNEYS.md` — eleven current-state journeys with evidence, friction and completion signals.
- `docs/product/UX_AUDIT.md` — canonical finding ledger and evidence record.
- `docs/product/INFORMATION_ARCHITECTURE.md` — current and target surface hierarchy.
- `docs/product/INTERACTION_MODEL.md` — selection, tools, modes, Escape, Preview, Apply, feedback and recovery rules.
- `docs/product/UX_ROADMAP.md` — prioritised, dependency-aware implementation programme.
- `docs/design/DESIGN_SYSTEM.md` — proposed token and component foundations.
- `docs/design/COMPONENT_INVENTORY.md` — current routes, panels, controls, states and visual patterns.
- `docs/design/CONTENT_AND_TERMINOLOGY.md` — canonical Russian user-facing glossary and copy rules.
- `docs/design/ACCESSIBILITY.md` — keyboard, focus, semantics, contrast, zoom and responsive requirements.
- `docs/milestones/m7-0-acceptance.md` — review and acceptance checklist for the audit package.

### Modify

- `package.json` — add `validate:m7-docs` without changing existing scripts.
- `docs/PROJECT_STATE.md` — record M7.0 audit status and accepted output after completion.
- `docs/ROADMAP.md` — replace the generic prioritisation gate with the accepted M7 implementation sequence.
- `docs/CHANGELOG.md` — preserve the M7.0 decision, evidence and selected follow-up slice.

### Primary source surfaces to inspect

- `apps/web/app/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/editor-viewport.css`
- `apps/web/app/planning-exact-gap.css`
- `apps/web/components/projects/project-app.tsx`
- `apps/web/components/projects/project-dashboard.tsx`
- `apps/web/components/projects/confirm-dialog.tsx`
- `apps/web/components/editor/apartment-editor.tsx`
- `apps/web/components/editor/editor-toolbar.tsx`
- `apps/web/components/editor/editor-canvas.tsx`
- `apps/web/components/editor/furniture-catalog.tsx`
- `apps/web/components/editor/wall-inspector.tsx`
- `apps/web/components/editor/keyboard.ts`
- `apps/web/components/reference/reference-panel.tsx`
- `apps/web/components/recognition/recognition-panel.tsx`
- `apps/web/components/recognition/cloud-dialog.tsx`
- `apps/web/components/spatial/spatial-viewer.tsx`
- `apps/web/components/spatial/spatial-inspector.tsx`
- `apps/web/components/planning/planning-panel.tsx`
- `apps/web/components/planning/planning-intent-section.tsx`

---

### Task 1: Add the audit-document contract validator

**Files:**
- Create: `scripts/validate-m7-docs.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the eleven required M7.0 Markdown files listed in `requiredFiles`.
- Produces: command `pnpm validate:m7-docs`; exit code `0` only when the audit package is structurally complete.

- [ ] **Step 1: Add the package script**

Add this exact entry to the root `scripts` object without modifying existing commands:

```json
"validate:m7-docs": "node scripts/validate-m7-docs.mjs"
```

- [ ] **Step 2: Create the validator**

Create `scripts/validate-m7-docs.mjs` with the following implementation:

```js
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "docs/product/PRODUCT_VISION.md",
  "docs/product/USER_JOURNEYS.md",
  "docs/product/UX_AUDIT.md",
  "docs/product/INFORMATION_ARCHITECTURE.md",
  "docs/product/INTERACTION_MODEL.md",
  "docs/product/UX_ROADMAP.md",
  "docs/design/DESIGN_SYSTEM.md",
  "docs/design/COMPONENT_INVENTORY.md",
  "docs/design/CONTENT_AND_TERMINOLOGY.md",
  "docs/design/ACCESSIBILITY.md",
  "docs/milestones/m7-0-acceptance.md",
];

const errors = [];
const contents = new Map();
for (const file of requiredFiles) {
  if (!existsSync(file)) {
    errors.push(`Missing required M7.0 document: ${file}`);
    continue;
  }
  const content = readFileSync(file, "utf8");
  contents.set(file, content);
  if (/\b(?:TODO|TBD|FIXME)\b/i.test(content)) {
    errors.push(`Unresolved placeholder in ${file}`);
  }
}

const journeys = contents.get("docs/product/USER_JOURNEYS.md") ?? "";
for (let index = 1; index <= 11; index += 1) {
  const id = `J${String(index).padStart(2, "0")}`;
  if (!new RegExp(`^## ${id}\\b`, "m").test(journeys)) {
    errors.push(`Missing journey ${id}`);
  }
}

const audit = contents.get("docs/product/UX_AUDIT.md") ?? "";
const roadmap = contents.get("docs/product/UX_ROADMAP.md") ?? "";
const headingPattern = /^## (UX-[A-Z0-9-]+-\d{3})\s*$/gm;
const headings = [...audit.matchAll(headingPattern)];
const seen = new Set();
for (let index = 0; index < headings.length; index += 1) {
  const match = headings[index];
  const id = match[1];
  if (seen.has(id)) errors.push(`Duplicate finding id: ${id}`);
  seen.add(id);
  const start = (match.index ?? 0) + match[0].length;
  const end = headings[index + 1]?.index ?? audit.length;
  const block = audit.slice(start, end);
  const requiredFields = [
    "**Severity:**",
    "**Affected journey:**",
    "**Evidence:**",
    "**Root cause:**",
    "**Recommended response:**",
    "**Acceptance criterion:**",
    "**Recommended slice:**",
  ];
  for (const field of requiredFields) {
    if (!block.includes(field)) errors.push(`${id} is missing ${field}`);
  }
  const severity = block.match(/\*\*Severity:\*\*\s*(P[0-4])/i)?.[1]?.toUpperCase();
  if (!severity) errors.push(`${id} has no valid severity`);
  if (severity && ["P0", "P1", "P2"].includes(severity) && !roadmap.includes(id)) {
    errors.push(`${id} (${severity}) is not referenced by UX_ROADMAP.md`);
  }
}
if (headings.length === 0) errors.push("UX_AUDIT.md contains no structured findings");

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`M7.0 documentation contract passed: ${requiredFiles.length} files, ${headings.length} findings.`);
```

- [ ] **Step 3: Run the validator to establish the expected RED state**

Run:

```bash
pnpm validate:m7-docs
```

Expected: exit code `1`, listing the required documents that do not exist yet.

- [ ] **Step 4: Verify existing repository checks are unaffected**

Run:

```bash
pnpm lint
```

Expected: PASS; the validator is not product code and does not alter the existing pipeline.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/validate-m7-docs.mjs
git commit -m "test: add M7 audit documentation contract"
```

---

### Task 2: Build the current interface and component inventory

**Files:**
- Create: `docs/design/COMPONENT_INVENTORY.md`

**Interfaces:**
- Consumes: current source surfaces listed in the File Structure section and all user-visible CSS selectors in the three app CSS files.
- Produces: stable inventory IDs `SUR-*`, `CMP-*`, `PAT-*` used by journeys and findings.

- [ ] **Step 1: Inventory routes and top-level application modes**

Document at minimum:

```text
SUR-DASHBOARD  /               ProjectDashboard
SUR-LOADING    ProjectApp      startup state
SUR-RECOVERY   ProjectApp      storage/startup recovery
SUR-EDITOR     ProjectApp      ApartmentEditor
SUR-EDITOR-2D  ApartmentEditor Canvas workspace
SUR-EDITOR-3D  ApartmentEditor SpatialViewer workspace
```

Record for each surface: source path, entry condition, exit condition, persistent state touched, transient state, primary user goal and existing feedback.

- [ ] **Step 2: Inventory editor regions and competing panels**

Document the current shell exactly as implemented:

```text
CMP-TOOLBAR
CMP-FURNITURE-CATALOG
CMP-CANVAS
CMP-SPATIAL-VIEWER
CMP-CONTEXT-INSPECTOR
CMP-REFERENCE-PANEL
CMP-RECOGNITION-PANEL
CMP-PLANNING-PANEL
CMP-TRACING-BANNER
CMP-RECOGNITION-BANNER
```

For each component record: ownership, visibility rule, width/density behaviour, keyboard behaviour, async states, destructive actions and known viewport risks.

- [ ] **Step 3: Inventory controls and feedback patterns**

Create tables for:

- buttons and icon buttons;
- inputs, selects, toggles and checkboxes;
- cards, section groups and inspector headings;
- dialogs, toasts, alerts, banners and status text;
- selected, hover, focus, disabled, error, warning, success and Preview states;
- Canvas labels, dimensions, guides, witnesses and ghost geometry.

Use `PAT-*` IDs for repeated patterns and mark one-off implementations that should become shared patterns.

- [ ] **Step 4: Extract current visual values**

From `globals.css`, `editor-viewport.css` and `planning-exact-gap.css`, record observed values for:

- font sizes;
- spacing and gaps;
- control heights;
- radii;
- panel widths;
- borders and shadows;
- semantic colours;
- responsive breakpoints.

Do not label these values as the target design system. Mark them as `current implementation evidence`.

- [ ] **Step 5: Review completeness**

Verify every imported visible child of `ProjectDashboard` and `ApartmentEditor` appears in the inventory. Record any source file that combines several unrelated UX responsibilities as an architectural observation, not an automatic refactor request.

- [ ] **Step 6: Commit**

```bash
git add docs/design/COMPONENT_INVENTORY.md
git commit -m "docs: inventory current Vlezet interface"
```

---

### Task 3: Define product vision and current user journeys

**Files:**
- Create: `docs/product/PRODUCT_VISION.md`
- Create: `docs/product/USER_JOURNEYS.md`

**Interfaces:**
- Consumes: `docs/PROJECT_STATE.md`, accepted milestone checklists, `COMPONENT_INVENTORY.md` and current product source.
- Produces: canonical user groups, product principles and journey IDs `J01`–`J11` referenced by every audit finding.

- [ ] **Step 1: Write PRODUCT_VISION.md**

Include these sections with concrete current-product language:

```text
1. Product promise
2. Primary users
3. Jobs to be done
4. Trust and precision principles
5. Local-first and AI-assistance boundaries
6. Desktop platform position
7. What Vlezet is not
8. Product success signals
```

Explicitly distinguish the apartment owner/buyer from the power user. Preserve the promise that precision is understandable without requiring professional CAD knowledge.

- [ ] **Step 2: Create journey J01 — project creation and first room**

Document current steps from dashboard through new project, wall tool, snapping, room derivation and completion evidence.

- [ ] **Step 3: Create journey J02 — real dimensions and area verification**

Document clear internal dimensions, wall thickness semantics, area display, dimension annotations and the expected `3550 × 3300 mm → 11.72 m²` trust regression.

- [ ] **Step 4: Create journeys J03–J06**

```text
J03 Add and edit a door and window
J04 Place furniture and diagnose fit
J05 Measure an arbitrary distance
J06 Import and calibrate a reference plan
```

- [ ] **Step 5: Create journeys J07–J11**

```text
J07 Run and review assisted recognition
J08 Inspect the project in 3D
J09 Generate, Preview and Apply a layout alternative
J10 Describe planning preferences in ordinary language
J11 Undo, redo, reload, export and restore
```

- [ ] **Step 6: Use one mandatory journey schema**

Every journey must contain:

```markdown
### User goal
### Entry point
### Preconditions
### Current steps
### Modes and hidden state
### Required prior knowledge
### Feedback and completion evidence
### Error and recovery paths
### Reversibility and persistence
### Accessibility and viewport risks
### Evidence references
### Open audit questions
```

- [ ] **Step 7: Commit**

```bash
git add docs/product/PRODUCT_VISION.md docs/product/USER_JOURNEYS.md
git commit -m "docs: map Vlezet product vision and user journeys"
```

---

### Task 4: Audit dashboard, editor shell, geometry and furniture workflows

**Files:**
- Create: `docs/product/UX_AUDIT.md`
- Modify: `docs/product/USER_JOURNEYS.md`

**Interfaces:**
- Consumes: `SUR-*`, `CMP-*`, `PAT-*`, journeys `J01`–`J05`, current source and representative browser evidence.
- Produces: structured findings with prefixes `UX-DASH-*`, `UX-SHELL-*`, `UX-GEO-*`, `UX-FURN-*` and evidence IDs `EV-M7-*`.

- [ ] **Step 1: Add the audit header and finding schema**

Start `UX_AUDIT.md` with methodology, evidence confidence and this exact block structure:

```markdown
## UX-SURFACE-001

**Title:** Concise problem statement  
**Severity:** P0|P1|P2|P3|P4  
**Affected journey:** J01  
**Affected surface:** SUR-... / CMP-...  
**Frequency:** high|medium|low  
**Confidence:** high|medium|low  
**Evidence:** EV-M7-...  
**Root cause:** ...  
**Recommended response:** ...  
**Architecture impact:** none|low|medium|high  
**Acceptance criterion:** ...  
**Recommended slice:** M7.x candidate name
```

- [ ] **Step 2: Start the product locally**

Run:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000` in the available desktop browser.

- [ ] **Step 3: Review dashboard and lifecycle states**

Exercise:

- empty dashboard;
- one and many project cards;
- create from scratch;
- create from JPG/PDF;
- rename with mouse and keyboard;
- duplicate;
- delete confirmation;
- import failure and recovery;
- long project name;
- loading, autosave and failed-save feedback.

Record evidence with browser, OS, viewport, zoom, scenario and observed result.

- [ ] **Step 4: Review editor shell and mode clarity**

Exercise:

- toolbar at every required viewport;
- catalogue open/closed;
- right inspector states;
- reference and recognition panel competition;
- 2D/3D switching;
- active tool indication;
- Escape hierarchy;
- Undo/Redo availability;
- long Russian labels and project name;
- browser zoom at 125%, 150% and 200%.

- [ ] **Step 5: Review geometry and measurement journeys**

Exercise J01, J02, J03 and J05 completely. Verify selection, snapping, wall thickness/alignment, room area, openings, door swing, dimensions, tape tool, topology errors and recovery.

- [ ] **Step 6: Review furniture and fit journey**

Exercise furniture discovery, placement, selection, dimensions, rotation, clearances, collisions, door obstruction, multi-selection, duplication, deletion and fit explanations.

- [ ] **Step 7: Record strengths as well as defects**

Add a `Current strengths to preserve` section. Do not rewrite working patterns solely to make the audit appear comprehensive.

- [ ] **Step 8: Commit**

```bash
git add docs/product/UX_AUDIT.md docs/product/USER_JOURNEYS.md
git commit -m "docs: audit core Vlezet editing workflows"
```

---

### Task 5: Audit reference, recognition, 3D, planning and persistence workflows

**Files:**
- Modify: `docs/product/UX_AUDIT.md`
- Modify: `docs/product/USER_JOURNEYS.md`

**Interfaces:**
- Consumes: journeys `J06`–`J11` and accepted M4–M6 authority boundaries.
- Produces: structured findings with prefixes `UX-REF-*`, `UX-REC-*`, `UX-3D-*`, `UX-PLAN-*`, `UX-DATA-*`.

- [ ] **Step 1: Review reference-plan import**

Exercise image and PDF import, validation, calibration, alignment, fit-to-reference, tracing entry/exit, moving the reference, missing asset and removal confirmation.

- [ ] **Step 2: Review assisted recognition**

Exercise local start, progress, empty/failed result, candidate selection, accept/reject/edit, high-confidence bulk action, cloud BYOK dialog, malformed provider response, stale draft, Apply and discard.

Verify that reference, recognition draft and trusted apartment geometry are visually and verbally distinct.

- [ ] **Step 3: Review 3D**

Exercise 2D→3D→2D transitions, camera controls, fit camera, hover/select, room/wall/object inspection, empty scene, unsupported geometry and consistency with 2D selection.

- [ ] **Step 4: Review deterministic planning**

Exercise object selection, no constraints, hard lock, wall/corner preference, near/far pair preference, exact contour gap, alternatives, ranking evidence, Preview, active witness overlay, Apply, stale input and impossible request.

- [ ] **Step 5: Review natural-language intent**

Use the accepted representative request:

```text
Диван не двигать, кресло поставить ближе к углу,
между креслом и столом оставить минимум 800 мм.
Стол поставить ближе к окну.
```

Verify ambiguity handling, unsupported language, acknowledgement, transfer, manual-control visibility and separate `Найти варианты` action.

- [ ] **Step 6: Review persistence and recovery**

Exercise Undo/Redo, reload, autosave, JSON export, PNG export, portable import, missing reference asset, corrupted import and startup recovery.

- [ ] **Step 7: Reconcile audit questions**

For every `Open audit question` in journeys J06–J11, either link a finding/evidence item or mark it explicitly as `no issue observed in the reviewed scenarios`.

- [ ] **Step 8: Commit**

```bash
git add docs/product/UX_AUDIT.md docs/product/USER_JOURNEYS.md
git commit -m "docs: audit advanced Vlezet workflows"
```

---

### Task 6: Design the target information architecture and interaction model

**Files:**
- Create: `docs/product/INFORMATION_ARCHITECTURE.md`
- Create: `docs/product/INTERACTION_MODEL.md`

**Interfaces:**
- Consumes: all inventory entries and P0–P2 audit findings.
- Produces: target surface hierarchy and interaction rules used by the implementation roadmap.

- [ ] **Step 1: Document current information architecture**

Show the actual current composition:

```text
ProjectApp
├── dashboard / loading / recovery
└── ApartmentEditor
    ├── global toolbar
    ├── optional furniture catalogue
    ├── 2D canvas or 3D viewer
    └── recognition panel / reference panel / contextual inspector
```

Record where project, tool, context and workflow actions currently compete.

- [ ] **Step 2: Define the four target layers**

Document exact ownership rules for:

```text
Global product layer
Tool layer
Context layer
Canvas feedback layer
```

Include which current controls move, remain or require later redesign validation.

- [ ] **Step 3: Define selection rules**

Specify click, Shift selection, empty-canvas click, 2D/3D semantic consistency, stale selection and inspector ownership.

- [ ] **Step 4: Define tool and mode rules**

Specify exclusive tools, transient commands, visible active state, panel interaction, tracing/recognition modes and the exact Escape hierarchy:

```text
1. cancel pointer/transient action;
2. close temporary Preview or dialog;
3. exit exclusive tool/mode;
4. clear selection only when no higher-priority cancellation exists.
```

- [ ] **Step 5: Define Preview and Apply rules**

Distinguish immediate reversible property edits from multi-entity or externally generated proposals. Define temporary styling, stale clearing, confirmation, cancellation and persistence language.

- [ ] **Step 6: Define status and error hierarchy**

Specify inline field errors, inspector notices, canvas notices, toasts, global failures, recovery surfaces and async announcements. Prevent one error from being represented simultaneously in several competing patterns without reason.

- [ ] **Step 7: Trace P0–P2 findings**

Add a matrix mapping every P0–P2 finding to one target IA or interaction rule. Do not leave a high-priority finding with only a visual-polish response.

- [ ] **Step 8: Commit**

```bash
git add docs/product/INFORMATION_ARCHITECTURE.md docs/product/INTERACTION_MODEL.md
git commit -m "docs: define target Vlezet UX architecture"
```

---

### Task 7: Define design-system, terminology and accessibility foundations

**Files:**
- Create: `docs/design/DESIGN_SYSTEM.md`
- Create: `docs/design/CONTENT_AND_TERMINOLOGY.md`
- Create: `docs/design/ACCESSIBILITY.md`

**Interfaces:**
- Consumes: current visual inventory, target IA/interaction model and audit findings.
- Produces: implementation-ready token/component/copy/accessibility requirements without CSS implementation.

- [ ] **Step 1: Define target design tokens**

Specify named roles, not arbitrary component-specific values:

```text
Typography: display, heading, body, compact body, label, helper, numeric evidence
Spacing: 2, 4, 8, 12, 16, 24, 32
Controls: compact and standard heights with minimum pointer targets
Surfaces: canvas, panel, elevated, muted, danger, warning, success, Preview
Borders/radii/elevation/focus/motion/panel widths
```

Record proposed numeric values and explain where dense desktop exceptions are allowed. Essential information must not depend on 9–10 px text.

- [ ] **Step 2: Define component families**

Document anatomy and states for toolbar actions, inspector sections, fields, checkboxes, selects, segmented controls, cards, notices, dialogs, empty states, result cards and evidence cards.

- [ ] **Step 3: Create the canonical Russian glossary**

Define and differentiate at minimum:

```text
длина стены
внутренний размер комнаты
площадь по внутреннему контуру
толщина стены
размер предмета
расстояние между центрами
минимальный зазор между контурами
рекомендация
предпочтение
обязательное ограничение
черновик распознавания
проверяемый черновик пожеланий
вариант расстановки
предпросмотр
применённое изменение
```

For every term include preferred UI wording, prohibited/confusing alternatives, short helper copy and where the term appears.

- [ ] **Step 4: Define content rules**

Specify button verb style, destructive wording, disabled-state explanation, units, number rounding, error recovery, optional provider language and when helper text is necessary.

- [ ] **Step 5: Define accessibility requirements**

Cover landmarks, headings, labels, focus order, keyboard access, Escape, visible focus, contrast, non-colour cues, minimum targets, `aria-live`, dialogs, Canvas alternatives, reduced motion and zoom behaviour.

- [ ] **Step 6: Add the viewport acceptance matrix**

For each required viewport and zoom, list surfaces and failure criteria:

- no horizontal inspector escape;
- no unreachable primary action;
- no clipped essential label;
- Canvas retains usable area;
- dialogs remain within viewport;
- keyboard focus remains visible.

- [ ] **Step 7: Commit**

```bash
git add docs/design/DESIGN_SYSTEM.md docs/design/CONTENT_AND_TERMINOLOGY.md docs/design/ACCESSIBILITY.md
git commit -m "docs: define Vlezet design system foundations"
```

---

### Task 8: Prioritise findings and define the implementation programme

**Files:**
- Create: `docs/product/UX_ROADMAP.md`
- Modify: `docs/product/UX_AUDIT.md`

**Interfaces:**
- Consumes: all findings, target architecture and design foundations.
- Produces: accepted M7.x candidate slices, dependencies, scope boundaries and acceptance gates.

- [ ] **Step 1: Normalise all findings**

Verify each finding has severity, frequency, confidence, root cause, response, acceptance criterion and candidate slice. Merge duplicate symptoms only when they share one root cause; preserve separate evidence references.

- [ ] **Step 2: Apply the prioritisation model**

Use these ordered factors rather than a false-precision numeric score:

```text
1. destructive/data-integrity or incorrect-understanding risk;
2. reach across journeys and surfaces;
3. observed/reasonable frequency;
4. dependency value for later fixes;
5. implementation and regression risk;
6. confidence of evidence.
```

- [ ] **Step 3: Define programme tiers**

Classify work as:

```text
Critical correction      P0/P1 or core trust blocker
Foundation               cross-surface P2 and prerequisites
Workflow improvement     bounded journey-level P2
Accessibility hardening  keyboard/semantics/zoom blockers
Visual consolidation     P3 consistency after structure is correct
Optional polish          P4 evidence-driven refinements
```

- [ ] **Step 4: Define candidate implementation slices**

Each slice must include:

```markdown
### M7.x — Name
**Problem:** linked finding IDs
**Goal:** one sentence
**Scope:** exact surfaces and behaviours
**Dependencies:** prior slices
**Non-goals:** explicit exclusions
**Acceptance:** browser and automated gates
**Risk:** architecture/regression assessment
```

Do not retain provisional names from the design spec when evidence suggests a better decomposition.

- [ ] **Step 5: Select only the first recommended slice**

Choose one next slice with the highest foundation value and bounded risk. Later slices remain roadmap candidates and may be reordered after browser evidence.

- [ ] **Step 6: Verify P0–P2 coverage**

Run:

```bash
pnpm validate:m7-docs
```

Expected at this stage: remaining failures may only be the not-yet-created acceptance document or canonical-doc updates. There must be no duplicate finding, missing finding field or orphan P0–P2 finding.

- [ ] **Step 7: Commit**

```bash
git add docs/product/UX_AUDIT.md docs/product/UX_ROADMAP.md
git commit -m "docs: prioritise Vlezet UX redesign programme"
```

---

### Task 9: Complete acceptance, canonical state and Draft PR

**Files:**
- Create: `docs/milestones/m7-0-acceptance.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CHANGELOG.md`

**Interfaces:**
- Consumes: the complete M7.0 audit package and exact CI/browser evidence.
- Produces: reconstructable canonical state and one selected first redesign slice.

- [ ] **Step 1: Create the acceptance checklist**

Include checkboxes for:

- all current surfaces inventoried;
- J01–J11 complete;
- strengths and findings documented;
- all P0–P2 findings evidence-backed;
- target IA and interaction model internally consistent;
- design system covers current component families;
- terminology is canonical;
- accessibility and viewport matrix complete;
- every P0–P2 finding mapped to roadmap;
- first implementation slice selected;
- no product behaviour/schema/persistence change;
- product-owner review;
- exact-head CI.

- [ ] **Step 2: Update PROJECT_STATE.md**

Record M7.0 as the active audit until acceptance. After product-owner acceptance, record:

- audit package status;
- count of findings by severity;
- highest-priority themes;
- selected next slice;
- preserved architecture boundaries;
- exact head, CI and PR evidence.

- [ ] **Step 3: Update ROADMAP.md**

Mark M7.0 as the current programme during review. After acceptance, mark M7.0 DONE and set only the selected first implementation slice to NOW.

- [ ] **Step 4: Update CHANGELOG.md**

Record why feature expansion paused, audit methodology, browser environments, important strengths, highest-priority findings, rejected redesign approaches and the selected implementation sequence.

- [ ] **Step 5: Run the documentation contract**

Run:

```bash
pnpm validate:m7-docs
```

Expected: PASS with eleven required files and a non-zero finding count.

- [ ] **Step 6: Run the complete repository verification**

Run:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands PASS on the exact branch head.

- [ ] **Step 7: Inspect scope**

Run:

```bash
git diff --name-only main...HEAD
```

Expected: only M7 documentation, `scripts/validate-m7-docs.mjs` and the root `package.json`. No `apps/web` product implementation, package domain/geometry/persistence or migration files.

- [ ] **Step 8: Open or update the Draft PR**

The PR body must include:

- audit purpose and methodology;
- exact changed-file scope;
- browser evidence status;
- finding counts by severity;
- target architecture summary;
- selected first implementation slice;
- documentation validator result;
- exact-head full CI result;
- statement that no product behaviour changed.

Keep the PR Draft until the product owner reviews the audit package.

- [ ] **Step 9: Commit final canonical documentation**

```bash
git add docs/PROJECT_STATE.md docs/ROADMAP.md docs/CHANGELOG.md docs/milestones/m7-0-acceptance.md
git commit -m "docs: complete M7.0 product UX audit"
```

---

## Final Review Checklist

- [ ] Every requirement in the approved M7 Product UX Foundation spec maps to at least one task above.
- [ ] The plan contains no product redesign implementation.
- [ ] All eleven required audit documents have a clear owner and production task.
- [ ] Journey IDs, finding IDs and roadmap references are mechanically validated.
- [ ] Browser evidence covers core and advanced workflows, required viewports and zoom levels.
- [ ] Strengths are preserved, not only defects catalogued.
- [ ] High-priority findings have explicit acceptance criteria and roadmap ownership.
- [ ] The first redesign slice is selected only after audit synthesis.
- [ ] Full repository CI remains mandatory even though M7.0 is documentation-first.
