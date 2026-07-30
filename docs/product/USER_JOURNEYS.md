# Vlezet — Current User Journeys

**Audit phase:** M7.0 Product and UX Audit  
**Purpose:** describe current behaviour before redesign and provide stable journey IDs for findings

## J01 — Create a project and draw the first room

### User goal
Create a new apartment project and obtain one valid room from walls.

### Entry point
`SUR-DASHBOARD` → `Новый проект` or empty-state `Начать с нуля`.

### Preconditions
Local project storage is available. No geometry knowledge is assumed.

### Current steps
1. Create a project; the editor opens immediately.
2. Select `Стена` in `CMP-TOOLBAR` or press W.
3. Click successive Canvas points; snapping assists connections.
4. Close the wall loop.
5. Select the derived room to see area and room controls.
6. Optionally rename the project and room.

### Modes and hidden state
The wall tool is exclusive and remains active. The project autosaves after document changes. A room is derived rather than directly created.

### Required prior knowledge
The user must infer that a closed valid wall topology produces a room and that wall centre lines plus thickness determine usable boundaries.

### Feedback and completion evidence
Active toolbar styling, crosshair cursor, snapping guides, topology alert and the appearance of a selectable room/area.

### Error and recovery paths
Invalid topology produces a Canvas alert. Undo can remove recent wall operations. Startup/storage errors use the recovery or global-error surfaces.

### Reversibility and persistence
Wall actions are semantic Undo/Redo operations. The resulting document is autosaved locally.

### Accessibility and viewport risks
Canvas drawing is pointer-first. At widths below 980 px the right inspector is hidden, reducing completion evidence and repair access.

### Evidence references
`EV-M7-SOURCE-SHELL`, `EV-M7-SOURCE-TOOLBAR`, `EV-M7-SOURCE-CSS`.

### Open audit questions
Does a first-time user recognise the need to close the contour, and is the recovery from a topology error sufficiently actionable?

## J02 — Enter real dimensions and verify area

### User goal
Make a real rectangular room match known clear dimensions and trust the displayed area.

### Entry point
Select a rectangular room or one of its walls in `SUR-EDITOR-2D`.

### Preconditions
A valid simple rectangular room exists.

### Current steps
1. Select the room.
2. Enter `Чистые внутренние размеры` for width and length.
3. Choose which side or centre remains fixed.
4. Apply each dimension.
5. Inspect the useful area and optional dimension lines.
6. Select a wall for axis length, thickness and physical alignment controls.

### Modes and hidden state
Room dimension edits move boundary walls according to explicit anchors. Wall length edits operate on the wall axis, not necessarily the clear room size.

### Required prior knowledge
The user must distinguish wall-axis length, clear internal size, wall thickness and useful area.

### Feedback and completion evidence
Explicit labels/helpers and area calculated from the same clear geometry. Accepted regression: `3550 × 3300 mm → 11.72 m²`.

### Error and recovery paths
Invalid numbers show inline errors. Complex non-rectangular rooms do not expose ambiguous clear-dimension editing.

### Reversibility and persistence
Each applied geometry change is undoable and autosaved.

### Accessibility and viewport risks
The room inspector is long and requires repeated label/input/select/button groups. Essential explanations use compact text and disappear with the inspector below 980 px.

### Evidence references
`EV-M7-BROWSER-M4.6`, `EV-M7-SOURCE-INSPECTOR`.

### Open audit questions
Are `Ширина` and `Длина` stable relative to screen orientation, and do anchor labels remain understandable after rotated or unusual apartment geometry?

## J03 — Add and edit a door and a window

### User goal
Place openings on a wall with real dimensions and, for a door, correct swing direction.

### Entry point
Toolbar `Дверь` or `Окно`, then click a host wall.

### Preconditions
At least one valid wall exists.

### Current steps
1. Activate the opening tool.
2. Click the wall position.
3. Select the created opening.
4. Edit width and offset from wall start.
5. For a door, choose hinge at opening start/end and swing left/right relative to wall direction.
6. Apply or delete.

### Modes and hidden state
Opening placement uses wall-relative offsets. Door semantics are relative to the directed wall rather than the viewer’s ordinary room language.

### Required prior knowledge
The user must understand where a wall “starts,” its direction, and how left/right maps to visible door swing.

### Feedback and completion evidence
Canvas opening geometry and swing arc plus inspector values.

### Error and recovery paths
Invalid sizes/offsets show inline errors. Delete is immediate from the inspector but undoable.

### Reversibility and persistence
Opening updates and deletion participate in Undo/Redo and autosave.

### Accessibility and viewport risks
Door placement and swing interpretation are visual. The inspector is hidden on narrow widths.

### Evidence references
`EV-M7-SOURCE-INSPECTOR`, `EV-M7-SOURCE-CANVAS`.

### Open audit questions
Can a non-technical user predict `Со стороны начала проёма` and `Влево от направления стены` without trial and error?

## J04 — Place furniture and diagnose fit

### User goal
Place a real item, set exact dimensions and understand whether it fits safely.

### Entry point
Toolbar `Мебель`/F and `CMP-FURNITURE-CATALOG`.

### Preconditions
A room exists for meaningful fit evaluation.

### Current steps
1. Open the catalogue.
2. Choose a preset/category.
3. Click the Canvas to place it.
4. Select the object.
5. Edit name, centre X/Y, width, depth, optional height, rotation and four recommended clearances.
6. Apply parameters.
7. Review `Влезает`, `Влезает вплотную` or `Не влезает` and diagnostic reasons.
8. Rotate, duplicate or delete.

### Modes and hidden state
Choosing a preset enters placement state until placement, explicit catalogue cancellation or another tool. Clearances rotate with the item’s local front/right/back/left.

### Required prior knowledge
The user must understand centre coordinates, object-local directions, dimensions versus clearances, and recommendation versus hard invalidity.

### Feedback and completion evidence
Active preset, Canvas shape/handles, fit badge, diagnostic list and measured obstacle distances.

### Error and recovery paths
Invalid fields show one shared error area. Fit diagnostics identify collisions, containment, doors and clearance recommendations.

### Reversibility and persistence
Placement and parameter updates are undoable and autosaved.

### Accessibility and viewport risks
The catalogue disappears below 760 px and the inspector below 980 px. Dense two-column fields may become difficult at high zoom. Glyph-only category illustrations have no unique visual resemblance to real furniture.

### Evidence references
`EV-M7-SOURCE-CATALOG`, `EV-M7-SOURCE-INSPECTOR`, `EV-M7-SOURCE-CSS`.

### Open audit questions
Do users understand that X/Y are centres and that “front” is object-relative after rotation?

## J05 — Measure an arbitrary distance

### User goal
Measure between two chosen points without changing apartment geometry.

### Entry point
Toolbar `Измерить` or M.

### Preconditions
2D mode is active.

### Current steps
1. Activate measurement.
2. Choose the first point.
3. Choose the second point.
4. Read the ephemeral result.
5. Exit/cancel through Escape or another tool.

### Modes and hidden state
Measurement is separate from the editor tool state but visually represented as an active toolbar tool. It is temporary and not persisted.

### Required prior knowledge
The user must choose meaningful endpoints and distinguish this tape measurement from automatic dimensions and planning contour witnesses.

### Feedback and completion evidence
Active toolbar state, Canvas points/line and numeric result.

### Error and recovery paths
Escape cancels the transient measurement. Invalid/no second point leaves an incomplete temporary state.

### Reversibility and persistence
No document mutation or history entry is expected.

### Accessibility and viewport risks
Pointer-first point selection has no documented keyboard equivalent. Multiple measurement visual languages can be confused without canonical terminology.

### Evidence references
`EV-M7-SOURCE-TOOLBAR`, `EV-M7-SOURCE-CANVAS`.

### Open audit questions
Is the temporary lifecycle obvious, and can users tell arbitrary point distance from clear room size or contour gap?

## J06 — Import and calibrate a reference plan

### User goal
Load a developer plan and align its pixels to real-world millimetres.

### Entry point
Dashboard `Из плана JPG/PDF`, empty-state `Загрузить план`, or toolbar `Подложка`.

### Preconditions
A supported local JPG, PNG or PDF is available.

### Current steps
1. Choose a file.
2. If PDF has multiple pages, choose a page.
3. Wait for raster preparation.
4. Place points A and B on a known line.
5. Enter known real length and optional horizontal/vertical alignment.
6. Save and open.
7. Control visibility, lock, opacity, X/Y and rotation.
8. Fit the reference or start tracing.

### Modes and hidden state
Import is a panel-internal state machine. Reference pixels and transform are persisted as project reference state/asset, not apartment geometry.

### Required prior knowledge
The user needs a trustworthy known length, understands calibration, and can identify a suitable line on the source plan.

### Feedback and completion evidence
Progress states, calibration markers/line/magnifier, local-file note and visible aligned reference on Canvas.

### Error and recovery paths
Unsupported/decode failures show panel errors. Missing stored asset preserves apartment geometry and offers replacement/removal.

### Reversibility and persistence
Reference installation/configuration is persisted locally. Removing the reference preserves walls/furniture and uses an inline confirmation.

### Accessibility and viewport risks
Calibration is pointer-driven; markers are `aria-hidden`. The panel is hidden below 980 px. X/Y/rotation fields update immediately while calibration uses explicit Save, creating mixed commitment models.

### Evidence references
`EV-M7-SOURCE-REFERENCE`, `EV-M7-SOURCE-CSS`.

### Open audit questions
Can users distinguish calibrating the source from tracing trusted geometry, and is the immediate transform-edit model predictable?

## J07 — Run and review assisted recognition

### User goal
Accelerate tracing while retaining control over every suggested wall/opening.

### Entry point
Toolbar `Распознать`, available after a reference plan exists.

### Preconditions
A reference raster and metric calibration are available.

### Current steps
1. Open recognition.
2. Start local analysis.
3. Wait through phase/progress feedback.
4. Inspect candidate counts and candidate list.
5. Select candidates; accept, reject or reclassify an opening.
6. Optionally accept high-confidence candidates.
7. Optionally open AI refinement and provide runtime API key/model.
8. Apply accepted candidates or discard the draft.

### Modes and hidden state
Recognition review replaces the right inspector and activates a Canvas draft overlay/banner. The draft is separate from trusted geometry until Apply.

### Required prior knowledge
The user must understand confidence, conflict, local versus cloud origin, pending/accepted/rejected state and stale drafts.

### Feedback and completion evidence
Progress card, counts, colour/confidence indicators, selected candidate detail, review banner and Apply count.

### Error and recovery paths
Prerequisite, missing asset, stale draft, empty result and provider errors each have explicit paths. Manual editor remains available.

### Reversibility and persistence
Draft/session state is separate. Apply creates one undoable batch; discard does not change the apartment.

### Accessibility and viewport risks
Candidate confidence relies partly on colour and small 9–10 px labels. Panel is hidden below 980 px. Large component-specific inline CSS makes cross-product focus/contrast consistency harder to verify.

### Evidence references
`EV-M7-SOURCE-RECOGNITION`, accepted M4.5 evidence.

### Open audit questions
Is the distinction among source image, draft, accepted candidate and applied geometry understandable without reading all helper text?

## J08 — Inspect the project in 3D

### User goal
Understand the same apartment spatially without changing it.

### Entry point
Toolbar `3D`.

### Preconditions
None; empty-state guidance is available. A valid document improves the scene.

### Current steps
1. Switch from 2D to 3D.
2. Choose perspective, isometric or top camera.
3. Orbit, pan and zoom.
4. Hover or click a room, wall or object.
5. Read the spatial inspector.
6. Fit the entire plan through the toolbar.
7. Return to 2D.

### Modes and hidden state
3D disables editing tools and cancels active measurement/current actions. Hover and selected inspection are ephemeral.

### Required prior knowledge
Pointer mapping for orbit/pan/zoom and that 3D is read-only.

### Feedback and completion evidence
Camera active state, cursor, highlight, inspector, help line, warning/error/empty messages.

### Error and recovery paths
Projection diagnostics may skip part of geometry. WebGL failure states that 2D remains available. Escape returns to 2D.

### Reversibility and persistence
No geometry mutation or independent 3D state is persisted.

### Accessibility and viewport risks
Camera and selection are pointer-first. Help is compact. 3D inspection uses an overlay rather than the same right-inspector location as 2D.

### Evidence references
`EV-M7-SOURCE-3D`, accepted M5.1–M5.4 evidence.

### Open audit questions
Does the mode switch sufficiently communicate read-only status, and should 2D/3D selection/context feel more continuous?

## J09 — Generate, Preview and Apply a layout alternative

### User goal
Compare safe deterministic rearrangements for selected existing furniture.

### Entry point
Room inspector → `Варианты расстановки`.

### Preconditions
One supported rectangular room and 1–3 existing objects.

### Current steps
1. Open planning from the room inspector.
2. Select 1–3 objects.
3. Optionally lock objects, choose wall/corner preferences and pair near/far preferences.
4. Optionally enter exact minimum contour gaps.
5. Generate alternatives.
6. Read result count, ranking reason and evidence.
7. Preview one alternative and optional exact witness.
8. Apply the chosen alternative explicitly.

### Modes and hidden state
Planning replaces the normal inspector. Constraints/results/Preview are ephemeral. Non-selected objects are fixed obstacles.

### Required prior knowledge
The user must distinguish hard locks/gaps from soft preferences, centre distance from contour gap, valid alternatives from ranking and Preview from Apply.

### Feedback and completion evidence
Disabled Generate state, helper text, result cards, Best badge, Preview styling, exact contour witness and explicit Apply.

### Error and recovery paths
Unsupported room, invalid selection/constraint, all selected objects locked, impossible request, stale candidate and Apply revalidation errors are fail-closed.

### Reversibility and persistence
Preview does not mutate. Apply is one semantic multi-object Undo/Redo step; only ordinary transforms persist.

### Accessibility and viewport risks
The panel is vertically dense and scrollable. Selected objects create long per-object and pair sections. Important distinctions rely on several compact helper paragraphs.

### Evidence references
`EV-M7-SOURCE-PLANNING`, `EV-M7-BROWSER-M6.3`.

### Open audit questions
Can users form a correct mental model before configuring constraints, and can they compare alternatives without losing the Canvas context?

## J10 — Describe planning preferences in ordinary language

### User goal
Turn an ordinary-language request into explicit, reviewable planning controls.

### Entry point
Top section of `CMP-PLANNING-PANEL`.

### Preconditions
Planning is open; a runtime OpenRouter API key is available for interpretation.

### Current steps
1. Enter the request.
2. Enter an API key.
3. Analyze; a compatible model is selected/discovered.
4. Review supported clauses.
5. Resolve ambiguous/unresolved object names explicitly.
6. Acknowledge unsupported fragments or remove clauses.
7. Transfer to ordinary controls.
8. Inspect controls and separately Generate alternatives.

### Modes and hidden state
Request, key, model and review draft are local React state and disappear when the panel is closed/remounted. Provider output cannot run planning directly.

### Required prior knowledge
The user must understand that text parsing requires an external provider but the planner remains deterministic and manual controls are authoritative.

### Feedback and completion evidence
Review clause descriptions, source fragments, explicit selects, unsupported block, disabled transfer and populated ordinary controls.

### Error and recovery paths
Network/model/provider errors explain that manual constraints remain available. Unsupported language remains visible.

### Reversibility and persistence
No document mutation, no persisted key/raw response/language draft. Transfer changes ephemeral control state only.

### Accessibility and viewport risks
Provider configuration precedes the review result and adds substantial cognitive weight. Long Russian text and clauses expand a narrow inspector. Accepted M6.4 screenshots found spacing issues subsequently fixed.

### Evidence references
`EV-M7-BROWSER-M6.4`, `EV-M7-SOURCE-PLANNING`.

### Open audit questions
Is requiring the user to provide an API key inside the main workflow proportionate, and should manual planning be visually primary?

## J11 — Undo, redo, reload, export and restore

### User goal
Trust that work is saved, reversible, exportable and recoverable.

### Entry point
Any editor state; toolbar history/export; dashboard import; browser reload/startup.

### Preconditions
A local project exists.

### Current steps
1. Observe save status next to project name.
2. Undo/Redo document edits through toolbar/shortcuts.
3. Export clean PNG, PNG with reference or Vlezet JSON.
4. Return to dashboard or reload.
5. Reopen the last/local project.
6. Import a portable project backup if needed.

### Modes and hidden state
Autosave is delayed/coordinated. Viewport and UI panel state are project UI state; some workflow drafts are intentionally separate or runtime-only.

### Required prior knowledge
The user must know which export is an image and which is an editable backup, and which temporary states are intentionally not restored.

### Feedback and completion evidence
Saving/Saved/Not saved status, retry, toasts for export/copy/apply, global error, startup loading/recovery and dashboard project facts/date.

### Error and recovery paths
Failed save offers retry. Invalid import/global operations show error. Startup repository failure offers reload. Missing reference asset preserves apartment geometry.

### Reversibility and persistence
Document changes have semantic history. Project deletion is not undoable after confirmation. Export/import preserve authoritative project state within format boundaries.

### Accessibility and viewport risks
Save status is 9 px and can be easy to miss. Export uses native `<details>` and may not close predictably in every path. Transient toasts may expire before being read.

### Evidence references
`EV-M7-SOURCE-APP`, `EV-M7-SOURCE-TOOLBAR`, `EV-M7-SOURCE-DASHBOARD`.

### Open audit questions
Can users clearly tell “saved locally,” “portable backup downloaded,” “temporary draft not saved,” and “destructive deletion cannot be undone” apart?
