# Vlezet — M7.0 Browser Evidence

**Phase:** M7.0 Product and UX Audit  
**Status:** accepted automated browser evidence  
**Date:** 2026-07-30  
**Feature head:** `7278a278f1a33d99d383a54139a20be987417c85`  
**Standard CI:** run `30571093677` — PASS  
**Browser audit:** run `30571095361` — PASS  
**Evidence artifact:** `m7-browser-audit-evidence`, artifact `8770860354`, digest `sha256:1d4991a03f6e8b4d6388119dc296fe4f9cd311cbf2c3dbc6099b730630a3ec61`

## 1. Purpose and limits

This document records observable browser evidence for the source-backed findings in `UX_AUDIT.md`. It does not change editor behaviour and does not turn screenshots into geometry or persistence authority.

The automated pass used:

- Chromium through Playwright for the representative end-to-end workflow and responsive matrix;
- Playwright WebKit for a core engine-level compatibility smoke covering dashboard, IndexedDB startup, room creation/editing, 3D transition and destructive confirmation;
- the real Next.js product and real user-facing controls;
- a clean browser profile for each scenario.

WebKit is a useful engine-level proxy, but it is not represented as a manual run in the shipping Safari browser. Native Safari verification is retained as an M7.1 acceptance gate because M7.0 itself contains no product UI implementation.

## 2. Exercised workflow

The Chromium pass completed:

1. empty dashboard;
2. new local project;
3. editor shell at the required desktop widths;
4. effective-width equivalents of 150% and 200% zoom;
5. drawing and closing a rectangular room with Canvas pointer interaction;
6. room selection and room inspector;
7. furniture selection, placement and object inspector;
8. planning panel;
9. reference-plan panel;
10. 2D → 3D → 2D transition;
11. return to dashboard;
12. delete confirmation dialog.

The WebKit pass independently completed:

1. dashboard startup;
2. new project;
3. rectangular room creation;
4. room selection;
5. room-name form edit and commit;
6. 3D transition;
7. return to dashboard;
8. delete confirmation.

## 3. Captured evidence

### Chromium screenshots

| Evidence ID | Artifact file | State |
|---|---|---|
| `EV-M7-BROWSER-001` | `01-dashboard-1440x900.png` | empty dashboard |
| `EV-M7-BROWSER-002` | `02-editor-1920x1080.png` | complete editor shell |
| `EV-M7-BROWSER-003` | `03-editor-1440x900.png` | standard desktop shell |
| `EV-M7-BROWSER-004` | `04-editor-1366x768.png` | compact desktop shell |
| `EV-M7-BROWSER-005` | `05-editor-1280x800.png` | minimum planned desktop width |
| `EV-M7-BROWSER-006` | `06-editor-effective-150.png` | effective 150% zoom width |
| `EV-M7-BROWSER-007` | `07-editor-effective-200.png` | effective 200% zoom width |
| `EV-M7-BROWSER-008` | `08-room-inspector-1440x900.png` | room geometry and inspector |
| `EV-M7-BROWSER-009` | `09-object-inspector-1440x900.png` | furniture and object inspector |
| `EV-M7-BROWSER-010` | `10-object-inspector-1280x800.png` | furniture at minimum desktop width |
| `EV-M7-BROWSER-011` | `11-object-inspector-effective-150.png` | selected furniture with hidden inspector |
| `EV-M7-BROWSER-012` | `12-planning-panel-1440x900.png` | planning entry and provider controls |
| `EV-M7-BROWSER-013` | `13-reference-panel-1440x900.png` | reference-plan workflow |
| `EV-M7-BROWSER-014` | `14-spatial-view-1440x900.png` | initial 3D perspective |
| `EV-M7-BROWSER-015` | `15-delete-confirmation-1440x900.png` | project deletion confirmation |

### WebKit screenshots

| Evidence ID | Artifact file | State |
|---|---|---|
| `EV-M7-WEBKIT-001` | `webkit-01-dashboard-1440x900.png` | dashboard |
| `EV-M7-WEBKIT-002` | `webkit-02-room-inspector-1440x900.png` | room form and Canvas |
| `EV-M7-WEBKIT-003` | `webkit-03-spatial-view-1440x900.png` | initial 3D perspective |
| `EV-M7-WEBKIT-004` | `webkit-04-delete-confirmation-1440x900.png` | destructive dialog |

## 4. Measured Chromium observations

The machine-readable artifact contains `audit-report.json` with 15 records and 53 observations.

| Observation | Count | Interpretation |
|---|---:|---|
| save status rendered below 12 px | 13 | confirms `UX-DATA-001` and `UX-PATTERN-002` |
| Canvas help rendered below 12 px | 13 | confirms `UX-CANVAS-001` and `UX-PATTERN-002` |
| toolbar content wider than container | 12 | confirms `UX-SHELL-001` at common desktop widths |
| document wider than CSS viewport | 12 | confirms shell-level horizontal escape |
| contextual inspector present but hidden | 3 | confirms `UX-SHELL-002` and `UX-ACCESS-002` |

### Viewport results

| State | Toolbar overflow | Document overflow | Inspector | Catalogue |
|---|---:|---:|---|---|
| 1920×1080 | no | no | visible | visible |
| 1440×900 | yes | yes | visible | visible |
| 1366×768 | yes | yes | visible | visible |
| 1280×800 | yes | yes | visible | visible |
| effective 150% (`960×600`) | yes | yes | hidden | visible |
| effective 200% (`720×450`) | yes | yes | hidden | hidden |
| selected object, 1280×800 | yes | yes | visible | visible |
| selected object, effective 150% | yes | yes | hidden | visible |

The effective-width checks reproduce the layout consequences of browser zoom by reducing the CSS viewport. They verify task reachability and breakpoint behaviour; they are not presented as screenshots of the browser zoom UI itself.

## 5. Findings confirmed without new IDs

Browser evidence increased confidence in these existing findings:

- `UX-SHELL-001`: clipping is observable at 1440×900, 1366×768 and 1280×800, not only a theoretical width risk;
- `UX-SHELL-002`: selected-object controls disappear at the effective 150% width;
- `UX-ACCESS-002`: zoom-equivalent width removes functionality rather than reflowing it;
- `UX-DATA-001`: local save status is consistently 9 px;
- `UX-PATTERN-002`: essential helper/status meaning frequently depends on 9–11 px text;
- `UX-PLAN-001`: API key and model configuration precede manual planning;
- `UX-PLAN-002`: planning occupies a long, dense single-column context surface;
- `UX-SHELL-005`: internal `M6.4` labels are visible in the product;
- `UX-DASH-001`: project cards use a generic decorative preview;
- `UX-PATTERN-001`: the project delete dialog is clear, while destructive patterns remain inconsistent across entity types.

## 6. Strengths confirmed in the running product

- The dashboard has a clear primary action, calm hierarchy and understandable local-first promise.
- Room dimensions, area and Canvas annotations agree visually.
- The room and object inspectors expose precise controls without obscuring the authoritative plan.
- Selected furniture remains visually identifiable on Canvas.
- Planning remains explicit and does not mutate before Apply.
- Reference-plan absence is represented as a clear empty state.
- 2D remains available before and after 3D.
- The project deletion dialog explains scope and irreversibility clearly.
- Chromium and WebKit completed local project creation, editing and persistence startup without network dependency.

## UX-3D-003

**Title:** The default 3D perspective hides the room interior behind opaque exterior walls  
**Severity:** P2  
**Affected journey:** J08  
**Affected surface:** spatial viewer and default camera presentation  
**Frequency:** high on first 3D entry for closed rooms  
**Confidence:** high  
**Evidence:** `EV-M7-BROWSER-014` and `EV-M7-WEBKIT-003`; both engines open on a perspective dominated by the exterior wall faces. Interior furniture is absent from the readable first frame even when it exists in the document.  
**Root cause:** the camera fit treats the full opaque room shell as the presentation target without an interior-reveal strategy.  
**Recommended response:** make the first 3D frame useful for inspection through an evidence-tested interior-oriented preset, wall cutaway/visibility treatment or another deterministic presentation rule; preserve the read-only renderer and document authority.  
**Architecture impact:** medium  
**Acceptance criterion:** entering 3D for a representative furnished closed room reveals the room floor and at least the major interior objects without requiring blind camera manipulation; perspective, isometric and top presets remain deterministic and WebGL failure still preserves 2D.  
**Recommended slice:** M7.10 2D/3D Context Consistency

## 7. Combined finding count

`UX_AUDIT.md` contains the 38 source-backed findings. This browser evidence adds one non-duplicate finding.

```text
P0  0
P1 10
P2 23
P3  6
P4  0
TOTAL 39
```

## 8. Acceptance conclusion

The browser pass confirms that M7.1 remains the correct first implementation slice. Toolbar hierarchy, horizontal escape, contextual reachability and save-state readability affect more journeys than any isolated visual refinement.

The browser pass does not justify implementing fixes inside M7.0. It supplies the evidence and regression harness that M7.1 and later slices must use.
