import { readFileSync, writeFileSync } from "node:fs";

function patchFile(path, operations) {
  let source = readFileSync(path, "utf8");
  for (const [search, replacement, label] of operations) {
    const first = source.indexOf(search);
    const last = source.lastIndexOf(search);
    if (first < 0 || first !== last) throw new Error(`${path}: ${label} expected exactly once, found ${first < 0 ? 0 : "multiple"}`);
    source = source.replace(search, replacement);
  }
  writeFileSync(path, source);
}

const canvasPath = "apps/web/components/editor/editor-canvas.tsx";
const canvasSource = readFileSync(canvasPath, "utf8");
if (!canvasSource.includes("referenceAssetBlob: Blob | null")) {
  patchFile(canvasPath, [
    ['  proposeOpeningPlacement,\n  screenToWorld,', '  proposeOpeningPlacement,\n  referencePlanBounds,\n  screenToWorld,', "reference bounds import"],
    ['import type Konva from "konva";', 'import type { ReferencePlan } from "@vlezet/projects";\nimport type Konva from "konva";', "project reference type import"],
    ['import { PlacedObjectShape } from "./placed-object-shape";\nimport { editorStore, type TopologySnapTarget } from "./use-editor-store";', 'import { PlacedObjectShape } from "./placed-object-shape";\nimport { ReferenceLayer } from "../reference/reference-layer";\nimport { useReferenceImage } from "../reference/use-reference-image";\nimport { editorStore, type TopologySnapTarget } from "./use-editor-store";', "reference component imports"],
    ['export type EditorCanvasProps = Readonly<{\n  initialViewport: ViewportTransform;\n  onViewportChange: (viewport: ViewportTransform) => void;\n  fitRequest: number;\n}>;', 'export type EditorCanvasProps = Readonly<{\n  initialViewport: ViewportTransform;\n  onViewportChange: (viewport: ViewportTransform) => void;\n  fitRequest: number;\n  fitReferenceRequest: number;\n  referencePlan: ReferencePlan | null;\n  referenceAssetBlob: Blob | null;\n  tracingMode: boolean;\n  onReferenceMoveEnd: (originWorld: Point2) => void;\n}>;', "canvas props"],
    ['export function EditorCanvas({ initialViewport, onViewportChange, fitRequest }: EditorCanvasProps) {', 'export function EditorCanvas({ initialViewport, onViewportChange, fitRequest, fitReferenceRequest, referencePlan, referenceAssetBlob, tracingMode, onReferenceMoveEnd }: EditorCanvasProps) {', "component arguments"],
    ['  const handledFitRequestRef = useRef(fitRequest);', '  const handledFitRequestRef = useRef(fitRequest);\n  const handledFitReferenceRequestRef = useRef(fitReferenceRequest);', "fit request refs"],
    ['  const visibleOpeningPreview = tool === "door" || tool === "window" ? openingPreview : null;\n  const visiblePlacementPreview = placementPresetId && placementPreview?.presetId === placementPresetId ? placementPreview : null;', '  const visibleOpeningPreview = tool === "door" || tool === "window" ? openingPreview : null;\n  const visiblePlacementPreview = placementPresetId && placementPreview?.presetId === placementPresetId ? placementPreview : null;\n  const { image: referenceImage } = useReferenceImage(referenceAssetBlob);\n  const visibleReferenceBounds = useMemo(() => referencePlan?.display.visible ? referencePlanBounds(referencePlan) : null, [referencePlan]);', "reference image state"],
    ['    commitViewport(fitViewportToBounds(deriveDocumentBounds(document), size, 64));\n  }, [commitViewport, document, fitRequest, size]);', '    commitViewport(fitViewportToBounds(deriveDocumentBounds(document, { additionalBounds: visibleReferenceBounds }), size, 64));\n  }, [commitViewport, document, fitRequest, size, visibleReferenceBounds]);\n\n  useEffect(() => {\n    if (fitReferenceRequest === handledFitReferenceRequestRef.current || size.width <= 1 || size.height <= 1 || !visibleReferenceBounds) return;\n    handledFitReferenceRequestRef.current = fitReferenceRequest;\n    commitViewport(fitViewportToBounds(visibleReferenceBounds, size, 64));\n  }, [commitViewport, fitReferenceRequest, size, visibleReferenceBounds]);', "reference-aware fit effects"],
    ['        <Layer listening={false}>{gridLines.map((line) => <Line key={line.key} points={line.points} stroke={line.major ? "#d9dde3" : "#eceff3"} strokeWidth={1} perfectDrawEnabled={false} />)}</Layer>\n        <Layer>', '        <Layer listening={false}>{gridLines.map((line) => <Line key={line.key} points={line.points} stroke={line.major ? "#d9dde3" : "#eceff3"} strokeWidth={1} perfectDrawEnabled={false} />)}</Layer>\n        {referencePlan && referenceImage ? <Layer><ReferenceLayer referencePlan={referencePlan} image={referenceImage} viewport={viewport} onMoveEnd={onReferenceMoveEnd} /></Layer> : null}\n        <Layer>', "reference canvas layer"],
    ['opacity={selected ? 0.9 : 0.72}', 'opacity={tracingMode ? (selected ? 0.42 : 0.2) : (selected ? 0.9 : 0.72)}', "tracing room opacity"],
  ]);
}

const fileFormatPath = "packages/projects/src/file-format.ts";
let fileFormatSource = readFileSync(fileFormatPath, "utf8");
if (fileFormatSource.includes('  validTimestamp(envelope.exportedAt);\n  return envelope;')) {
  patchFile(fileFormatPath, [
    ['  validTimestamp(envelope.exportedAt);\n  return envelope;', '  return envelope;', "defer timestamp validation"],
    ['  if (envelope.fileVersion !== 1) {\n    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается этим режимом импорта.");\n  }\n  try { return createImportedProject(object(envelope.project), options); }', '  if (envelope.fileVersion !== 1) {\n    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается этим режимом импорта.");\n  }\n  validTimestamp(envelope.exportedAt);\n  try { return createImportedProject(object(envelope.project), options); }', "legacy timestamp validation"],
    ['  if (envelope.fileVersion !== 2) {\n    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается.");\n  }\n\n  try {', '  if (envelope.fileVersion !== 2) {\n    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается.");\n  }\n  validTimestamp(envelope.exportedAt);\n\n  try {', "portable timestamp validation"],
  ]);
  fileFormatSource = readFileSync(fileFormatPath, "utf8");
}
if (fileFormatSource.includes('      blob: new Blob([bytes], { type: mimeType }),')) {
  patchFile(fileFormatPath, [[
    '    const asset = createProjectAsset({\n      id: options.assetId,\n      projectId: options.id,\n      mimeType,\n      createdAt: options.now,\n      blob: new Blob([bytes], { type: mimeType }),\n    });',
    '    const assetBuffer = new ArrayBuffer(bytes.byteLength);\n    new Uint8Array(assetBuffer).set(bytes);\n    const asset = createProjectAsset({\n      id: options.assetId,\n      projectId: options.id,\n      mimeType,\n      createdAt: options.now,\n      blob: new Blob([assetBuffer], { type: mimeType }),\n    });',
    "portable Blob ArrayBuffer",
  ]]);
}

const cssPath = "apps/web/app/globals.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes(".reference-panel {")) {
  css += `

.reference-tool { position:relative; }
.reference-present-dot { width:7px; height:7px; border-radius:50%; background:#16a34a; box-shadow:0 0 0 2px #fff; }
.reference-panel { z-index:4; min-width:0; padding:16px; border-left:1px solid var(--line); background:#fff; overflow:auto; }
.reference-panel-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:15px; }
.reference-panel-heading>div { display:grid; gap:4px; }
.reference-panel-heading strong { font-size:14px; }
.reference-panel-heading span,.reference-local-note { color:var(--muted); font-size:10px; line-height:1.45; }
.reference-panel-heading>button { width:28px; height:28px; border:0; border-radius:7px; background:#f4f6f8; cursor:pointer; }
.reference-warning,.reference-error { margin:0 0 12px; padding:10px; border:1px solid #fed7aa; border-radius:9px; background:#fff7ed; color:#9a3412; font-size:11px; line-height:1.45; }
.reference-error { border-color:#fecaca; background:#fef2f2; color:#991b1b; }
.reference-progress { padding:26px 8px; color:var(--muted); font-size:12px; text-align:center; }
.reference-actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
.reference-actions .primary-action,.reference-actions .secondary-action { margin-top:0; }
.reference-toggle { display:flex; align-items:center; gap:8px; margin-top:13px; color:#475569; font-size:11px; }
.reference-range { width:100%; accent-color:var(--accent); }
.reference-panel input[type=number],.reference-panel input:not([type]),.reference-panel select,.calibration-step input,.calibration-step select { width:100%; height:36px; padding:0 9px; border:1px solid #cfd5dc; border-radius:8px; outline:none; background:#fff; font-size:12px; }
.reference-remove-confirm { margin-top:14px; padding:10px; border:1px solid #fecaca; border-radius:9px; background:#fffafa; }
.reference-remove-confirm p { margin:0 0 8px; color:#7f1d1d; font-size:11px; line-height:1.4; }
.reference-remove-confirm .secondary-action,.reference-remove-confirm .danger-action { width:auto; min-width:92px; margin:0 6px 0 0; }
.pdf-page-step,.calibration-step { display:grid; gap:10px; }
.pdf-page-step h2,.calibration-step h2 { margin:0; font-size:15px; }
.pdf-page-step p,.calibration-step>p { margin:0; color:var(--muted); font-size:11px; line-height:1.5; }
.calibration-stage-wrap { position:relative; }
.calibration-stage { position:relative; overflow:hidden; min-height:180px; border:1px solid #cfd5dc; border-radius:10px; background:#eef1f5; cursor:crosshair; }
.calibration-stage img { display:block; width:100%; max-height:330px; object-fit:contain; user-select:none; pointer-events:none; }
.calibration-line { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
.calibration-line line { stroke:#1769ff; stroke-width:3; stroke-dasharray:8 5; vector-effect:non-scaling-stroke; }
.calibration-handle { position:absolute; z-index:3; display:grid; place-items:center; width:26px; height:26px; border:2px solid #fff; border-radius:50%; background:#1769ff; color:#fff; font-size:10px; font-weight:800; transform:translate(-50%,-50%); box-shadow:0 2px 8px rgba(15,23,42,.28); cursor:grab; }
.calibration-handle.is-b { background:#f97316; }
.calibration-magnifier { position:absolute; z-index:5; right:8px; bottom:8px; width:110px; height:110px; border:3px solid #fff; border-radius:50%; background-repeat:no-repeat; box-shadow:0 6px 22px rgba(15,23,42,.24); pointer-events:none; }
.calibration-magnifier::after { content:""; position:absolute; left:50%; top:50%; width:14px; height:14px; border:1px solid #ef4444; border-radius:50%; transform:translate(-50%,-50%); }
.calibration-point-fields { display:grid; gap:3px; padding:8px; border-radius:8px; background:#f8fafc; color:#64748b; font-size:10px; }
.tracing-banner { position:fixed; z-index:40; left:50%; bottom:18px; display:flex; align-items:center; gap:10px; padding:9px 10px 9px 13px; border:1px solid #bfdbfe; border-radius:11px; background:rgba(239,246,255,.96); color:#1e3a8a; box-shadow:0 10px 28px rgba(30,64,175,.14); transform:translateX(-50%); backdrop-filter:blur(8px); }
.tracing-banner strong { font-size:11px; }
.tracing-banner span { font-size:10px; }
.tracing-banner button { padding:6px 10px; border:0; border-radius:7px; background:#1769ff; color:#fff; font-size:10px; font-weight:700; cursor:pointer; }
.empty-actions { display:flex; gap:8px; }
@media (max-width:980px) { .reference-panel { display:none; } .tracing-banner span { display:none; } }
`;
  writeFileSync(cssPath, css);
}

console.log("Applied M4 integration patch.");
