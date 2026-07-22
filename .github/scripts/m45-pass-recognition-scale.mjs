import fs from "node:fs";

const path = "apps/web/components/projects/project-app.tsx";
let text = fs.readFileSync(path, "utf8");
const search = `        referenceAssetId: project.referencePlan.assetId,\n        referenceRevision: project.referencePlan.referenceRevision,\n        now: new Date().toISOString(),`;
const replacement = `        referenceAssetId: project.referencePlan.assetId,\n        referenceRevision: project.referencePlan.referenceRevision,\n        sourceMillimetersPerPixel: project.referencePlan.transform.millimetersPerPixel,\n        now: new Date().toISOString(),`;
const first = text.indexOf(search);
if (first < 0) throw new Error("Expected startRecognition input block not found");
if (text.indexOf(search, first + search.length) >= 0) throw new Error("Expected unique startRecognition input block");
text = text.slice(0, first) + replacement + text.slice(first + search.length);
fs.writeFileSync(path, text);
console.log("Recognition calibrated scale wired to worker input.");
