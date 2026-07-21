import { readFileSync, writeFileSync } from "node:fs";

const path = "apps/web/components/editor/editor-canvas.tsx";
let source = readFileSync(path, "utf8");

if (source.includes("export type EditorCanvasProps")) {
  console.log("M3 canvas patch already applied.");
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  const last = source.lastIndexOf(search);
  if (first < 0 || first !== last) {
    throw new Error(`Cannot apply ${label}: expected exactly one match, found ${first < 0 ? 0 : "multiple"}`);
  }
  source = source.replace(search, replacement);
}

replaceOnce(
  '  chooseGridStep,\n  deriveRooms,',
  '  chooseGridStep,\n  deriveDocumentBounds,\n  deriveRooms,',
  "bounds import",
);
replaceOnce(
  '  expandedOrientedRectangle,\n  localToWorld,',
  '  expandedOrientedRectangle,\n  fitViewportToBounds,\n  localToWorld,',
  "fit import",
);
replaceOnce(
  'import { useEffect, useMemo, useRef, useState } from "react";',
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
  "React import",
);
replaceOnce('const INITIAL_SCALE = 0.12;\n', "", "obsolete initial scale");
replaceOnce(
  'export function EditorCanvas() {',
  `export type EditorCanvasProps = Readonly<{\n  initialViewport: ViewportTransform;\n  onViewportChange: (viewport: ViewportTransform) => void;\n  fitRequest: number;\n}>;\n\ntype ViewportUpdater = ViewportTransform | ((current: ViewportTransform) => ViewportTransform);\n\nexport function EditorCanvas({ initialViewport, onViewportChange, fitRequest }: EditorCanvasProps) {`,
  "component props",
);
replaceOnce(
  '  const panRef = useRef<{ active: boolean; last: Point2 }>({ active: false, last: { x: 0, y: 0 } });',
  `  const panRef = useRef<{ active: boolean; last: Point2 }>({ active: false, last: { x: 0, y: 0 } });\n  const handledFitRequestRef = useRef(fitRequest);\n  const viewportRef = useRef<ViewportTransform>({ ...initialViewport });`,
  "viewport refs",
);
replaceOnce(
  '  const [viewport, setViewport] = useState<ViewportTransform>({ offsetX: 140, offsetY: 140, pixelsPerMillimeter: INITIAL_SCALE });',
  `  const [viewport, setViewport] = useState<ViewportTransform>(() => ({ ...initialViewport }));\n\n  const commitViewport = useCallback((next: ViewportTransform) => {\n    viewportRef.current = next;\n    setViewport(next);\n    onViewportChange(next);\n  }, [onViewportChange]);\n\n  const updateViewport = useCallback((update: ViewportUpdater) => {\n    const next = typeof update === "function" ? update(viewportRef.current) : update;\n    commitViewport(next);\n  }, [commitViewport]);`,
  "controlled viewport state",
);
replaceOnce(
  `  useEffect(() => {\n    const onKeyDown = (event: KeyboardEvent) => {`,
  `  useEffect(() => {\n    if (fitRequest === handledFitRequestRef.current || size.width <= 1 || size.height <= 1) return;\n    handledFitRequestRef.current = fitRequest;\n    commitViewport(fitViewportToBounds(deriveDocumentBounds(document), size, 64));\n  }, [commitViewport, document, fitRequest, size]);\n\n  useEffect(() => {\n    const onKeyDown = (event: KeyboardEvent) => {`,
  "fit request effect",
);
replaceOnce(
  '    setViewport((current) => zoomViewportAt(current, pointer, Math.exp(-event.evt.deltaY * 0.0015), { min: MIN_SCALE, max: MAX_SCALE }));',
  '    updateViewport((current) => zoomViewportAt(current, pointer, Math.exp(-event.evt.deltaY * 0.0015), { min: MIN_SCALE, max: MAX_SCALE }));',
  "wheel viewport publication",
);
replaceOnce(
  '      setViewport((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));',
  '      updateViewport((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));',
  "pan viewport publication",
);

writeFileSync(path, source);
console.log("Applied M3 controlled viewport patch.");
