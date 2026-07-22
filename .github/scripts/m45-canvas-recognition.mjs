import fs from "node:fs";

const path = "apps/web/components/editor/editor-canvas.tsx";
let text = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`Missing expected snippet: ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Expected unique snippet: ${label}`);
  text = text.slice(0, first) + replacement + text.slice(first + search.length);
}

replaceOnce(
`import type { ReferencePlan } from "@vlezet/projects";
import type Konva from "konva";`,
`import type { ReferencePlan } from "@vlezet/projects";
import type { NormalizedPoint, RecognitionDraft } from "@vlezet/recognition";
import type Konva from "konva";`,
"recognition types import",
);

replaceOnce(
`import { PlacedObjectShape } from "./placed-object-shape";
import { ReferenceLayer } from "../reference/reference-layer";`,
`import { PlacedObjectShape } from "./placed-object-shape";
import { RecognitionLayer } from "../recognition/recognition-layer";
import { ReferenceLayer } from "../reference/reference-layer";`,
"recognition layer import",
);

replaceOnce(
`  referenceAssetBlob: Blob | null;
  tracingMode: boolean;
  onReferenceMoveEnd: (originWorld: Point2) => void;
}>;`,
`  referenceAssetBlob: Blob | null;
  tracingMode: boolean;
  recognitionDraft: RecognitionDraft | null;
  selectedRecognitionCandidateId: string | null;
  recognitionReviewActive: boolean;
  onSelectRecognitionCandidate: (candidateId: string | null) => void;
  onEditRecognitionWall: (candidateId: string, patch: Readonly<{ start?: NormalizedPoint; end?: NormalizedPoint }>) => void;
  onReferenceMoveEnd: (originWorld: Point2) => void;
}>;`,
"canvas recognition props",
);

replaceOnce(
`export function EditorCanvas({ initialViewport, onViewportChange, fitRequest, fitReferenceRequest, referencePlan, referenceAssetBlob, tracingMode, onReferenceMoveEnd }: EditorCanvasProps) {`,
`export function EditorCanvas({ initialViewport, onViewportChange, fitRequest, fitReferenceRequest, referencePlan, referenceAssetBlob, tracingMode, recognitionDraft, selectedRecognitionCandidateId, recognitionReviewActive, onSelectRecognitionCandidate, onEditRecognitionWall, onReferenceMoveEnd }: EditorCanvasProps) {`,
"canvas props destructure",
);

replaceOnce(
`    if (shouldPan) { event.evt.preventDefault(); panRef.current = { active: true, last: pointer }; return; }
    if (event.evt.button !== 0) return;

    if (placementPresetId && visiblePlacementPreview) {`,
`    if (shouldPan) { event.evt.preventDefault(); panRef.current = { active: true, last: pointer }; return; }
    if (event.evt.button !== 0) return;
    if (recognitionReviewActive) { onSelectRecognitionCandidate(null); return; }

    if (placementPresetId && visiblePlacementPreview) {`,
"review mouse down guard",
);

replaceOnce(
`      updateViewport((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));
      return;
    }
    if (placementPresetId) updatePlacementPreview(pointer);`,
`      updateViewport((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));
      return;
    }
    if (recognitionReviewActive) return;
    if (placementPresetId) updatePlacementPreview(pointer);`,
"review mouse move guard",
);

replaceOnce(
`          {document.openings.flatMap((opening) => renderOpeningSymbol(opening))}
          {visibleOpeningPreview ? renderOpeningSymbol(visibleOpeningPreview.opening, true) : null}
          {tool === "wall" ? document.vertices.map((vertex) => { const screen = worldToScreen(vertex.position, viewport); const isJunction = document.walls.some((wall) => wall.junctionVertexIds.includes(vertex.id)); return <Circle key={vertex.id} x={screen.x} y={screen.y} radius={isJunction ? 4.5 : 3.5} fill={isJunction ? "#fff" : "#1769ff"} stroke="#1769ff" strokeWidth={1.5} opacity={0.8} listening={false} />; }) : null}
        </Layer>
        <Layer>
          {clearancePolygon ?`,
`          {document.openings.flatMap((opening) => renderOpeningSymbol(opening))}
          {visibleOpeningPreview ? renderOpeningSymbol(visibleOpeningPreview.opening, true) : null}
          {tool === "wall" && !recognitionReviewActive ? document.vertices.map((vertex) => { const screen = worldToScreen(vertex.position, viewport); const isJunction = document.walls.some((wall) => wall.junctionVertexIds.includes(vertex.id)); return <Circle key={vertex.id} x={screen.x} y={screen.y} radius={isJunction ? 4.5 : 3.5} fill={isJunction ? "#fff" : "#1769ff"} stroke="#1769ff" strokeWidth={1.5} opacity={0.8} listening={false} />; }) : null}
        </Layer>
        {recognitionDraft && referencePlan ? <Layer><RecognitionLayer draft={recognitionDraft} referencePlan={referencePlan} viewport={viewport} selectedCandidateId={selectedRecognitionCandidateId} onSelect={onSelectRecognitionCandidate} onEditWall={onEditRecognitionWall} /></Layer> : null}
        <Layer>
          {clearancePolygon ?`,
"recognition overlay layer",
);

fs.writeFileSync(path, text);
console.log("Recognition canvas integration applied.");
