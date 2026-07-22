import fs from "node:fs";

function edit(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No changes produced for ${path}`);
  fs.writeFileSync(path, after);
}

function replaceOnce(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`Missing expected snippet: ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Expected unique snippet: ${label}`);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

edit("apps/web/components/recognition/recognition.worker.ts", (text) => {
  text = replaceOnce(
    text,
    `  LOCAL_RECOGNITION_ENGINE_VERSION,\n} from "@vlezet/recognition";`,
    `  LOCAL_RECOGNITION_ENGINE_VERSION,\n  rescaleRecognitionPixelEvidence,\n} from "@vlezet/recognition";`,
    "source scale import",
  );
  const scalePattern = /\n\s*const sourcePixelScale = \(input\.sourceWidthPx \/ input\.imageData\.width \+ input\.sourceHeightPx \/ input\.imageData\.height\) \/ 2;\n\s*const walls = analysisWalls\.map\(\(wall\) => \(\{ \.\.\.wall, estimatedThicknessPx: wall\.estimatedThicknessPx == null \? null : wall\.estimatedThicknessPx \* sourcePixelScale \}\)\);\n\s*const openings = analysisOpenings\.map\(\(opening\) => \(\{ \.\.\.opening, widthPx: opening\.widthPx == null \? null : opening\.widthPx \* sourcePixelScale \}\)\);/;
  if (!scalePattern.test(text)) throw new Error("Missing expected inline source scale block");
  return text.replace(scalePattern, `\n    const { walls, openings } = rescaleRecognitionPixelEvidence({\n      walls: analysisWalls,\n      openings: analysisOpenings,\n      analysisWidthPx: input.imageData.width,\n      analysisHeightPx: input.imageData.height,\n      sourceWidthPx: input.sourceWidthPx,\n      sourceHeightPx: input.sourceHeightPx,\n    });`);
});

edit("apps/web/components/editor/editor-canvas.tsx", (text) => replaceOnce(
  text,
  `        {recognitionDraft && referencePlan ? <Layer><RecognitionLayer draft={recognitionDraft} referencePlan={referencePlan} viewport={viewport} selectedCandidateId={selectedRecognitionCandidateId} onSelect={onSelectRecognitionCandidate} onEditWall={onEditRecognitionWall} /></Layer> : null}`,
  `        {recognitionReviewActive ? <Layer><Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill="rgba(255,255,255,0.001)" /></Layer> : null}\n        {recognitionDraft && referencePlan ? <Layer><RecognitionLayer draft={recognitionDraft} referencePlan={referencePlan} viewport={viewport} selectedCandidateId={selectedRecognitionCandidateId} onSelect={onSelectRecognitionCandidate} onEditWall={onEditRecognitionWall} /></Layer> : null}`,
  "recognition event shield",
));

console.log("M4.5 final hardening applied.");
