import { readFileSync, writeFileSync } from "node:fs";

function patchFile(path, operations) {
  let source = readFileSync(path, "utf8");
  for (const [search, replacement, label] of operations) {
    const first = source.indexOf(search);
    const last = source.lastIndexOf(search);
    if (first < 0 || first !== last) {
      throw new Error(`${path}: ${label} expected exactly once, found ${first < 0 ? 0 : "multiple"}`);
    }
    source = source.replace(search, replacement);
  }
  writeFileSync(path, source);
}

const canvasPath = "apps/web/components/editor/editor-canvas.tsx";
const canvasSource = readFileSync(canvasPath, "utf8");
if (!canvasSource.includes("referenceAssetBlob: Blob | null")) {
  patchFile(canvasPath, [
    [
      '  proposeOpeningPlacement,\n  screenToWorld,',
      '  proposeOpeningPlacement,\n  referencePlanBounds,\n  screenToWorld,',
      "reference bounds import",
    ],
    [
      'import type Konva from "konva";',
      'import type { ReferencePlan } from "@vlezet/projects";\nimport type Konva from "konva";',
      "project reference type import",
    ],
    [
      'import { PlacedObjectShape } from "./placed-object-shape";\nimport { editorStore, type TopologySnapTarget } from "./use-editor-store";',
      'import { PlacedObjectShape } from "./placed-object-shape";\nimport { ReferenceLayer } from "../reference/reference-layer";\nimport { useReferenceImage } from "../reference/use-reference-image";\nimport { editorStore, type TopologySnapTarget } from "./use-editor-store";',
      "reference component imports",
    ],
    [
      'export type EditorCanvasProps = Readonly<{\n  initialViewport: ViewportTransform;\n  onViewportChange: (viewport: ViewportTransform) => void;\n  fitRequest: number;\n}>;',
      'export type EditorCanvasProps = Readonly<{\n  initialViewport: ViewportTransform;\n  onViewportChange: (viewport: ViewportTransform) => void;\n  fitRequest: number;\n  fitReferenceRequest: number;\n  referencePlan: ReferencePlan | null;\n  referenceAssetBlob: Blob | null;\n  tracingMode: boolean;\n  onReferenceMoveEnd: (originWorld: Point2) => void;\n}>;',
      "canvas props",
    ],
    [
      'export function EditorCanvas({ initialViewport, onViewportChange, fitRequest }: EditorCanvasProps) {',
      'export function EditorCanvas({ initialViewport, onViewportChange, fitRequest, fitReferenceRequest, referencePlan, referenceAssetBlob, tracingMode, onReferenceMoveEnd }: EditorCanvasProps) {',
      "component arguments",
    ],
    [
      '  const handledFitRequestRef = useRef(fitRequest);',
      '  const handledFitRequestRef = useRef(fitRequest);\n  const handledFitReferenceRequestRef = useRef(fitReferenceRequest);',
      "fit request refs",
    ],
    [
      '  const visibleOpeningPreview = tool === "door" || tool === "window" ? openingPreview : null;\n  const visiblePlacementPreview = placementPresetId && placementPreview?.presetId === placementPresetId ? placementPreview : null;',
      '  const visibleOpeningPreview = tool === "door" || tool === "window" ? openingPreview : null;\n  const visiblePlacementPreview = placementPresetId && placementPreview?.presetId === placementPresetId ? placementPreview : null;\n  const { image: referenceImage } = useReferenceImage(referenceAssetBlob);\n  const visibleReferenceBounds = useMemo(() => referencePlan?.display.visible ? referencePlanBounds(referencePlan) : null, [referencePlan]);',
      "reference image state",
    ],
    [
      '    commitViewport(fitViewportToBounds(deriveDocumentBounds(document), size, 64));\n  }, [commitViewport, document, fitRequest, size]);',
      '    commitViewport(fitViewportToBounds(deriveDocumentBounds(document, { additionalBounds: visibleReferenceBounds }), size, 64));\n  }, [commitViewport, document, fitRequest, size, visibleReferenceBounds]);\n\n  useEffect(() => {\n    if (fitReferenceRequest === handledFitReferenceRequestRef.current || size.width <= 1 || size.height <= 1 || !visibleReferenceBounds) return;\n    handledFitReferenceRequestRef.current = fitReferenceRequest;\n    commitViewport(fitViewportToBounds(visibleReferenceBounds, size, 64));\n  }, [commitViewport, fitReferenceRequest, size, visibleReferenceBounds]);',
      "reference-aware fit effects",
    ],
    [
      '        <Layer listening={false}>{gridLines.map((line) => <Line key={line.key} points={line.points} stroke={line.major ? "#d9dde3" : "#eceff3"} strokeWidth={1} perfectDrawEnabled={false} />)}</Layer>\n        <Layer>',
      '        <Layer listening={false}>{gridLines.map((line) => <Line key={line.key} points={line.points} stroke={line.major ? "#d9dde3" : "#eceff3"} strokeWidth={1} perfectDrawEnabled={false} />)}</Layer>\n        {referencePlan && referenceImage ? <Layer><ReferenceLayer referencePlan={referencePlan} image={referenceImage} viewport={viewport} onMoveEnd={onReferenceMoveEnd} /></Layer> : null}\n        <Layer>',
      "reference canvas layer",
    ],
    [
      'opacity={selected ? 0.9 : 0.72}',
      'opacity={tracingMode ? (selected ? 0.42 : 0.2) : (selected ? 0.9 : 0.72)}',
      "tracing room opacity",
    ],
  ]);
}

const fileFormatPath = "packages/projects/src/file-format.ts";
const fileFormatSource = readFileSync(fileFormatPath, "utf8");
if (fileFormatSource.includes('  validTimestamp(envelope.exportedAt);\n  return envelope;')) {
  patchFile(fileFormatPath, [
    [
      '  validTimestamp(envelope.exportedAt);\n  return envelope;',
      '  return envelope;',
      "defer timestamp validation",
    ],
    [
      '  if (envelope.fileVersion !== 1) {\n    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается этим режимом импорта.");\n  }\n  try { return createImportedProject(object(envelope.project), options); }',
      '  if (envelope.fileVersion !== 1) {\n    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается этим режимом импорта.");\n  }\n  validTimestamp(envelope.exportedAt);\n  try { return createImportedProject(object(envelope.project), options); }',
      "legacy timestamp validation",
    ],
    [
      '  if (envelope.fileVersion !== 2) {\n    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается.");\n  }\n\n  try {',
      '  if (envelope.fileVersion !== 2) {\n    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается.");\n  }\n  validTimestamp(envelope.exportedAt);\n\n  try {',
      "portable timestamp validation",
    ],
  ]);
}

console.log("Applied M4 integration patch.");
