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
  `        </Layer>\n        <Layer>\n          {resolvedWalls.flatMap`,
  `          {resolvedWalls.flatMap`,
  "merge room and wall layers",
);

replaceOnce(
  `        </Layer>\n        {recognitionDraft && referencePlan ? <Layer><RecognitionLayer draft={recognitionDraft} referencePlan={referencePlan} viewport={viewport} selectedCandidateId={selectedRecognitionCandidateId} onSelect={onSelectRecognitionCandidate} onEditWall={onEditRecognitionWall} /></Layer> : null}\n        <Layer>`,
  `          {recognitionDraft && referencePlan ? <RecognitionLayer draft={recognitionDraft} referencePlan={referencePlan} viewport={viewport} selectedCandidateId={selectedRecognitionCandidateId} onSelect={onSelectRecognitionCandidate} onEditWall={onEditRecognitionWall} /> : null}\n        </Layer>\n        <Layer>`,
  "merge recognition into geometry layer",
);

fs.writeFileSync(path, text);
console.log("Konva layer budget reduced to five physical layers.");
