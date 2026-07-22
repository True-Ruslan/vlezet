from pathlib import Path

canvas_path = Path("apps/web/components/editor/editor-canvas.tsx")
canvas = canvas_path.read_text()
replacements = [
    (
        'import { RecognitionLayer } from "../recognition/recognition-layer";\n',
        'import { planningUiStore } from "../planning/planning-ui-store";\nimport { RecognitionLayer } from "../recognition/recognition-layer";\n',
    ),
    (
        '  const objectGesture = useStore(editorStore, (state) => state.objectGesture);\n',
        '  const objectGesture = useStore(editorStore, (state) => state.objectGesture);\n  const planningPreviewCandidate = useStore(planningUiStore, (state) => state.previewCandidate);\n',
    ),
    (
        '  const fitEvaluation = useMemo(() => evaluateObjectFits(evaluationDocument), [evaluationDocument]);\n',
        '''  const fitEvaluation = useMemo(() => evaluateObjectFits(evaluationDocument), [evaluationDocument]);\n  const planningPreviewObjects = useMemo(() => {\n    if (!planningPreviewCandidate) return [];\n    const placements = new Map(planningPreviewCandidate.placements.map((placement) => [placement.objectId, placement]));\n    return displayedObjects.flatMap((object) => {\n      const placement = placements.get(object.id);\n      return placement ? [{ ...object, position: { ...placement.position }, rotationDeg: placement.rotationDeg }] : [];\n    });\n  }, [displayedObjects, planningPreviewCandidate]);\n  const planningPreviewDocument = useMemo(() => {\n    if (!planningPreviewCandidate) return document;\n    const placements = new Map(planningPreviewCandidate.placements.map((placement) => [placement.objectId, placement]));\n    return {\n      ...document,\n      placedObjects: document.placedObjects.map((object) => {\n        const placement = placements.get(object.id);\n        return placement ? { ...object, position: { ...placement.position }, rotationDeg: placement.rotationDeg } : object;\n      }),\n    };\n  }, [document, planningPreviewCandidate]);\n  const planningPreviewFit = useMemo(() => evaluateObjectFits(planningPreviewDocument), [planningPreviewDocument]);\n''',
    ),
    (
        '          {visiblePlacementPreview ? (\n',
        '''          {planningPreviewObjects.map((object) => (\n            <PlacedObjectShape\n              key={`planning-preview:${object.id}`}\n              object={object}\n              viewport={viewport}\n              selected={false}\n              preview\n              fitStatus={planningPreviewFit.byObjectId.get(object.id)?.status ?? "blocked"}\n            />\n          ))}\n          {visiblePlacementPreview ? (\n''',
    ),
]
for old, new in replacements:
    if old not in canvas:
        raise SystemExit(f"Missing editor-canvas marker: {old!r}")
    canvas = canvas.replace(old, new, 1)
canvas_path.write_text(canvas)

panel_path = Path("apps/web/components/planning/planning-panel.tsx")
panel = panel_path.read_text()
panel = panel.replace('className="secondary-button"', 'className="secondary-action"')
panel = panel.replace('className="primary-button"', 'className="primary-action"')
panel = panel.replace('className="inspector-warning"', 'className="field-error"')
panel_path.write_text(panel)

globals_path = Path("apps/web/app/globals.css")
globals = globals_path.read_text()
marker = "/* M6.1 planning */"
if marker not in globals:
    globals += '''\n\n/* M6.1 planning */\n.planning-panel { max-height: calc(100vh - 130px); overflow: auto; }\n.planning-panel .inspector-heading-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }\n.planning-panel .inspector-kicker { display: block; margin-bottom: 4px; color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }\n.planning-panel h3 { margin: 0; font-size: 16px; }\n.planning-panel .inspector-help { margin: 6px 0 0; color: #64748b; font-size: 11px; line-height: 1.45; }\n.planning-panel .inspector-section { display: grid; gap: 10px; padding-top: 12px; margin-top: 12px; border-top: 1px solid #e5e7eb; }\n.planning-object-list { display: grid; gap: 6px; }\n.planning-object-choice { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; font-size: 12px; cursor: pointer; }\n.planning-object-choice input { margin: 0; }\n.planning-results { gap: 8px !important; }\n.planning-results-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }\n.planning-results-heading span { color: #64748b; font-size: 10px; }\n.planning-result-card { display: grid; gap: 8px; padding: 10px; border: 1px solid #dfe4ea; border-radius: 10px; background: #fff; }\n.planning-result-card.is-previewing { border-color: #93c5fd; background: #eff6ff; }\n.planning-result-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }\n.planning-best-badge { padding: 2px 6px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 10px; font-weight: 700; }\n.planning-reasons { display: grid; gap: 4px; margin: 0; padding-left: 16px; color: #475569; font-size: 11px; line-height: 1.4; }\n.planning-result-actions { display: flex; gap: 6px; }\n.planning-result-actions button { flex: 1; }\n'''
    globals_path.write_text(globals)
